import { NextResponse } from "next/server";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import {
  adminUpdateContactSchema,
  adminUpdateUsernameSchema,
  authorizeResetSchema,
  createUserAccountSchema,
  updateUserRoleSchema,
} from "@/lib/auth/auth-schemas";
import { resolveEffectivePermissions } from "@/lib/auth/permission-engine";
import { getRoleMetadata, isValidUserRole, type Permission, type UserRole } from "@/lib/auth/rbac";
import {
  assignUserDepartments,
  authorizeServerAccountReset,
  createServerAccountProfile,
  duplicateUserCustomPermissions,
  findServerAccountById,
  listServerAccountProfiles,
  permanentlyDeleteServerAccount,
  updateServerAccountContact,
  updateServerAccountProfile,
  updateServerAccountUsername,
  updateUserCustomPermissions,
} from "@/lib/auth/server-account-store";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("tab") === "deleted" || searchParams.get("includeDeleted") === "true";

  // Viewing historical permanently deleted accounts is strictly Superadmin-only
  if (includeDeleted && !auth.actor.isSuperadmin) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        message: "Only the Superadmin (President) can view historical records of permanently deleted accounts.",
      },
      { status: 403 },
    );
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      let query = supabase
        .from("user_profiles")
        .select("id, email, username, full_name, role, is_active, must_change_password, security_question, recovery_authorized_at, recovery_expires_at, is_superadmin, designation, is_permanently_deleted, deleted_at, deleted_reason, deleted_by, custom_grants, custom_restrictions, created_at, updated_at")
        .order("created_at", { ascending: true });

      if (!includeDeleted) {
        query = query.or("is_permanently_deleted.is.null,is_permanently_deleted.eq.false");
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      const users = (data ?? [])
        .filter((row) => isValidUserRole(row.role))
        .map((row) => {
          const meta = getRoleMetadata(row.role);
          const username = row.username || row.email.split("@")[0];
          const isSuperadmin = Boolean(row.is_superadmin);
          const effectivePermissions = resolveEffectivePermissions({
            role: row.role,
            isSuperadmin,
            departments: [row.role],
            customGrants: row.custom_grants,
            customRestrictions: row.custom_restrictions,
          });

          return {
            id: row.id,
            username,
            email: row.email,
            fullName: row.full_name,
            role: row.role,
            roleLabel: isSuperadmin ? "Superadmin" : meta.label,
            accessLevel: isSuperadmin ? "admin" : meta.accessLevel,
            accessLevelLabel: isSuperadmin ? "Full Access" : meta.accessLevelLabel,
            isActive: row.is_active,
            isSuperadmin,
            designation: row.designation || (isSuperadmin ? "Superadmin" : undefined),
            isPermanentlyDeleted: Boolean(row.is_permanently_deleted),
            deletedAt: row.deleted_at,
            deletedReason: row.deleted_reason,
            deletedBy: row.deleted_by,
            customGrants: row.custom_grants ?? [],
            customRestrictions: row.custom_restrictions ?? [],
            effectivePermissions,
            mustChangePassword: Boolean(row.must_change_password),
            hasSecurityQuestion: Boolean(row.security_question),
            recoveryAuthorizedAt: row.recovery_authorized_at,
            recoveryExpiresAt: row.recovery_expires_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        });

      return NextResponse.json({ ok: true, users });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          code: "USER_QUERY_FAILED",
          message: err instanceof Error ? err.message : "Unable to load user accounts.",
        },
        { status: 500 },
      );
    }
  }

  const users = listServerAccountProfiles({ includeDeleted }).map((profile) => {
    const meta = getRoleMetadata(profile.role);
    const effectivePermissions = resolveEffectivePermissions({
      role: profile.role,
      isSuperadmin: profile.isSuperadmin,
      departments: profile.departments,
      customGrants: profile.customGrants,
      customRestrictions: profile.customRestrictions,
    });

    return {
      ...profile,
      roleLabel: profile.isSuperadmin ? "Superadmin" : meta.label,
      accessLevel: profile.isSuperadmin ? "admin" : meta.accessLevel,
      accessLevelLabel: profile.isSuperadmin ? "Full Access" : meta.accessLevelLabel,
      effectivePermissions,
    };
  });

  return NextResponse.json({ ok: true, users });
}

export async function POST(request: Request) {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createUserAccountSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Review user account details.",
      },
      { status: 400 },
    );
  }

  // Security Rule: Only Superadmin can create accounts with Superadmin designation or promote to Superadmin
  const requestIsSuperadmin = Boolean(rawBody?.isSuperadmin);
  if (requestIsSuperadmin) {
    return NextResponse.json(
      {
        ok: false,
        code: "SUPERADMIN_SINGLE_ACCOUNT_RESTRICTION",
        message: "Only one Superadmin (President) account can exist in RouteX. New Superadmin accounts cannot be created.",
      },
      { status: 400 },
    );
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("user_profiles")
        .insert({
          id: newId,
          username: parsed.data.username.trim(),
          normalized_username: parsed.data.username.trim().toLowerCase(),
          email: (parsed.data.email || `${parsed.data.username.trim().toLowerCase()}@routex.local`).toLowerCase(),
          full_name: parsed.data.fullName.trim(),
          role: parsed.data.role,
          is_active: true,
          must_change_password: true,
          is_superadmin: false,
          created_at: now,
          updated_at: now,
        })
        .select("id, email, username, full_name, role, is_active, must_change_password, created_at")
        .single();

      if (error) {
        const isConflict = error.code === "23505" || error.message.includes("unique");
        return NextResponse.json(
          {
            ok: false,
            code: isConflict ? "CONFLICT" : "USER_CREATION_FAILED",
            message: isConflict
              ? "An account with this username already exists."
              : error.message,
          },
          { status: isConflict ? 409 : 400 },
        );
      }

      const meta = getRoleMetadata(data.role as UserRole);
      recordAuditEntry({
        actorId: auth.actor.id,
        actorEmail: auth.actor.email,
        action: "user.created",
        entityType: "user",
        entityId: data.id,
        summary: `Created account for ${data.full_name} (@${data.username}).`,
        changes: { role: data.role, username: data.username, isActive: data.is_active, mustChangePassword: true },
      });

      return NextResponse.json(
        {
          ok: true,
          user: {
            id: data.id,
            username: data.username,
            email: data.email,
            fullName: data.full_name,
            role: data.role,
            roleLabel: meta.label,
            accessLevel: meta.accessLevel,
            accessLevelLabel: meta.accessLevelLabel,
            isActive: data.is_active,
            mustChangePassword: true,
            hasSecurityQuestion: false,
            createdAt: data.created_at,
          },
        },
        { status: 201 },
      );
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          code: "USER_CREATION_FAILED",
          message: err instanceof Error ? err.message : "Unable to create user.",
        },
        { status: 500 },
      );
    }
  }

  const created = createServerAccountProfile({
    username: parsed.data.username,
    fullName: parsed.data.fullName,
    role: parsed.data.role,
    temporaryPassword: parsed.data.temporaryPassword,
    email: parsed.data.email,
    phoneNumber: parsed.data.phoneNumber,
  });

  if (!created.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "CONFLICT",
        message: created.message,
      },
      { status: 409 },
    );
  }

  const meta = getRoleMetadata(created.profile.role);
  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "user.created",
    entityType: "user",
    entityId: created.profile.id,
    summary: `Created account for ${created.profile.fullName} (@${created.profile.username}).`,
    changes: {
      role: created.profile.role,
      username: created.profile.username,
      isActive: created.profile.isActive,
      mustChangePassword: true,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      user: {
        ...created.profile,
        roleLabel: meta.label,
        accessLevel: meta.accessLevel,
        accessLevelLabel: meta.accessLevelLabel,
      },
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const action = typeof rawBody?.action === "string" ? rawBody.action : "";

  // 1. Authorize Admin-assisted password reset
  if (action === "authorize-reset") {
    const parsed = authorizeResetSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Invalid user ID." }, { status: 400 });
    }

    const targetUser = findServerAccountById(parsed.data.userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }

    const resetAuth = authorizeServerAccountReset(targetUser.id, auth.actor.username);
    if (!resetAuth.ok) {
      return NextResponse.json({ ok: false, message: resetAuth.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "user.recovery_authorized",
      entityType: "user",
      entityId: targetUser.id,
      summary: `Admin @${auth.actor.username} authorized 24-hour password recovery for @${targetUser.username}.`,
      changes: {
        authorizedBy: auth.actor.username,
        targetUsername: targetUser.username,
        expiresAt: resetAuth.expiresAt,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Password reset authorized for @${targetUser.username}. The user can now use Forgot Password to reset their password within 24 hours.`,
      expiresAt: resetAuth.expiresAt,
    });
  }

  // 2. Admin update username
  if (action === "update-username") {
    const parsed = adminUpdateUsernameSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid username." },
        { status: 400 },
      );
    }

    const targetUser = findServerAccountById(parsed.data.userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }

    // Regular Admin cannot modify Superadmin
    if (targetUser.isSuperadmin && !auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Regular Admins cannot modify the Superadmin (President) account." },
        { status: 403 },
      );
    }

    const oldUsername = targetUser.username;
    const updateRes = updateServerAccountUsername(targetUser.id, parsed.data.newUsername);
    if (!updateRes.ok) {
      return NextResponse.json({ ok: false, message: updateRes.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "user.username_changed_by_admin",
      entityType: "user",
      entityId: targetUser.id,
      summary: `Admin @${auth.actor.username} changed username of ${targetUser.fullName} from '@${oldUsername}' to '@${updateRes.profile.username}'.`,
      changes: {
        oldUsername,
        newUsername: updateRes.profile.username,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Username updated to @${updateRes.profile.username}.`,
      profile: updateRes.profile,
    });
  }

  // 2b. Admin update contact info (email & phone number)
  if (action === "update-contact") {
    const parsed = adminUpdateContactSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid contact data." },
        { status: 400 },
      );
    }

    const targetUser = findServerAccountById(parsed.data.userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }

    // Regular Admin cannot modify Superadmin
    if (targetUser.isSuperadmin && !auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Regular Admins cannot modify the Superadmin (President) account." },
        { status: 403 },
      );
    }

    const oldEmail = targetUser.email;
    const oldPhone = targetUser.phoneNumber || "None";
    const updateRes = updateServerAccountContact(targetUser.id, parsed.data.email, parsed.data.phoneNumber);
    if (!updateRes.ok) {
      return NextResponse.json({ ok: false, message: updateRes.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "user.contact_changed_by_admin",
      entityType: "user",
      entityId: targetUser.id,
      summary: `Admin @${auth.actor.username} updated contact information for ${targetUser.fullName} (@${targetUser.username}).`,
      changes: {
        oldEmail,
        newEmail: updateRes.profile.email,
        oldPhone,
        newPhone: updateRes.profile.phoneNumber,
      },
    });

    const meta = getRoleMetadata(updateRes.profile.role);
    return NextResponse.json({
      ok: true,
      message: `Contact details updated for @${updateRes.profile.username}.`,
      user: {
        ...updateRes.profile,
        roleLabel: meta.label,
        accessLevel: meta.accessLevel,
        accessLevelLabel: meta.accessLevelLabel,
      },
    });
  }

  // 3. Update Custom Permissions (Grants & Restrictions)
  if (action === "update-permissions") {
    const userId = typeof rawBody?.userId === "string" ? rawBody.userId : "";
    const customGrants = Array.isArray(rawBody?.customGrants) ? (rawBody.customGrants as Permission[]) : [];
    const customRestrictions = Array.isArray(rawBody?.customRestrictions) ? (rawBody.customRestrictions as Permission[]) : [];

    const targetUser = findServerAccountById(userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }

    if (targetUser.isSuperadmin && !auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Regular Admins cannot modify Superadmin permissions." },
        { status: 403 },
      );
    }

    const res = updateUserCustomPermissions(userId, customGrants, customRestrictions);
    if (!res.ok) {
      return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "user.permissions_customized",
      entityType: "user",
      entityId: userId,
      summary: `@${auth.actor.username} updated individual permissions for @${targetUser.username}.`,
      changes: { customGrants, customRestrictions },
    });

    return NextResponse.json({
      ok: true,
      message: `Permissions updated for @${targetUser.username}.`,
      profile: res.profile,
    });
  }

  // 4. Duplicate Custom Permissions from Another Employee
  if (action === "duplicate-permissions") {
    const sourceUserId = typeof rawBody?.sourceUserId === "string" ? rawBody.sourceUserId : "";
    const targetUserId = typeof rawBody?.targetUserId === "string" ? rawBody.targetUserId : "";

    const targetUser = findServerAccountById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "Target user not found." }, { status: 404 });
    }

    if (targetUser.isSuperadmin && !auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Cannot modify Superadmin permissions." },
        { status: 403 },
      );
    }

    const res = duplicateUserCustomPermissions(sourceUserId, targetUserId);
    if (!res.ok) {
      return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "user.permissions_duplicated",
      entityType: "user",
      entityId: targetUserId,
      summary: `@${auth.actor.username} copied individual permissions from @${sourceUserId} to @${targetUser.username}.`,
      changes: { sourceUserId, targetUserId },
    });

    return NextResponse.json({
      ok: true,
      message: `Permissions copied successfully to @${targetUser.username}.`,
      profile: res.profile,
    });
  }

  // 5. Assign Department Memberships
  if (action === "assign-departments") {
    const userId = typeof rawBody?.userId === "string" ? rawBody.userId : "";
    const departmentIds = Array.isArray(rawBody?.departmentIds) ? (rawBody.departmentIds as string[]) : [];

    const targetUser = findServerAccountById(userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }

    if (targetUser.isSuperadmin && !auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Regular Admins cannot modify Superadmin department assignments." },
        { status: 403 },
      );
    }

    const res = assignUserDepartments(userId, departmentIds);
    if (!res.ok) {
      return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "user.departments_assigned",
      entityType: "user",
      entityId: userId,
      summary: `@${auth.actor.username} updated department memberships for @${targetUser.username}.`,
      changes: { departmentIds },
    });

    return NextResponse.json({
      ok: true,
      message: `Departments updated for @${targetUser.username}.`,
      profile: res.profile,
    });
  }

  // 6. Update role or active status
  const parsed = updateUserRoleSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid role update request.",
      },
      { status: 400 },
    );
  }

  const targetAccount = findServerAccountById(parsed.data.userId);
  if (!targetAccount) {
    return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
  }

  // Regular Admins cannot modify or deactivate Superadmin
  if (targetAccount.isSuperadmin && !auth.actor.isSuperadmin) {
    return NextResponse.json(
      {
        ok: false,
        code: "SUPERADMIN_PROTECTED",
        message: "Regular Admins cannot modify, deactivate, or alter the Superadmin (President) account.",
      },
      { status: 403 },
    );
  }

  // Self-lockout check
  if (parsed.data.userId === auth.actor.id) {
    if (parsed.data.isActive === false || (parsed.data.role && parsed.data.role !== "admin" && !auth.actor.isSuperadmin)) {
      return NextResponse.json(
        {
          ok: false,
          code: "SELF_LOCKOUT_PREVENTED",
          message: "You cannot deactivate or remove Admin access from your own active session.",
        },
        { status: 400 },
      );
    }
  }

  const updated = updateServerAccountProfile(parsed.data);
  if (!updated.ok) {
    return NextResponse.json({ ok: false, message: updated.message }, { status: 400 });
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "user.profile_updated",
    entityType: "user",
    entityId: updated.profile.id,
    summary: `Updated account status for @${updated.profile.username}.`,
    changes: { role: updated.profile.role, isActive: updated.profile.isActive },
  });

  const meta = getRoleMetadata(updated.profile.role);
  return NextResponse.json({
    ok: true,
    user: {
      ...updated.profile,
      roleLabel: meta.label,
      accessLevel: meta.accessLevel,
      accessLevelLabel: meta.accessLevelLabel,
    },
  });
}

export async function DELETE(request: Request) {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  // Strict Rule: Regular Admins CANNOT permanently delete any employee accounts.
  // Permanent deletion strictly requires Superadmin (President) authority.
  if (!auth.actor.isSuperadmin) {
    return NextResponse.json(
      {
        ok: false,
        code: "SUPERADMIN_AUTHORITY_REQUIRED",
        message: "Permanent account deletion strictly requires Superadmin (President) authority. Regular Admins cannot permanently delete user accounts.",
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || searchParams.get("id");
  let reason = searchParams.get("reason") || "";

  // Reason may also be passed via JSON body
  if (!reason) {
    const rawBody = await request.clone().json().catch(() => null);
    if (rawBody && typeof rawBody.reason === "string") {
      reason = rawBody.reason;
    }
  }

  if (!userId) {
    return NextResponse.json({ ok: false, message: "User ID is required." }, { status: 400 });
  }

  // Deletion reason is strictly required (min 5 characters)
  if (!reason || reason.trim().length < 5) {
    return NextResponse.json(
      {
        ok: false,
        code: "DELETION_REASON_REQUIRED",
        message: "A documented permanent deletion reason of at least 5 characters is required.",
      },
      { status: 400 },
    );
  }

  if (userId === auth.actor.id) {
    return NextResponse.json(
      { ok: false, message: "Superadmin cannot delete their own active account." },
      { status: 400 },
    );
  }

  const user = findServerAccountById(userId);
  if (!user) {
    return NextResponse.json({ ok: false, message: "User account was not found." }, { status: 404 });
  }

  if (user.isSuperadmin) {
    return NextResponse.json(
      { ok: false, message: "The Superadmin account cannot be permanently deleted." },
      { status: 400 },
    );
  }

  const result = permanentlyDeleteServerAccount(userId, auth.actor.username, reason.trim());
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "user.permanently_deleted",
    entityType: "user",
    entityId: userId,
    summary: `Permanently deleted user @${user.username} (${user.fullName}). Reason: ${reason.trim()}`,
    changes: {
      userId,
      username: user.username,
      fullName: user.fullName,
      deletedBy: auth.actor.username,
      reason: reason.trim(),
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Account @${user.username} has been permanently deleted and moved to historical records.`,
    userId,
  });
}
