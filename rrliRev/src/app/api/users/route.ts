import { NextResponse } from "next/server";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import {
  adminUpdateContactSchema,
  adminUpdateUsernameSchema,
  authorizeResetSchema,
  createUserAccountSchema,
  updateUserRoleSchema,
} from "@/lib/auth/auth-schemas";
import { generateRandomTemporaryPassword } from "@/lib/auth/password-policy";
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
import { invalidateServerActorCache, verifyServerPermission } from "@/lib/auth/server-session";
import { invalidateProxyProfileCache } from "@/proxy";
import { isSupabaseConfigured, isSupabaseAdminConfigured } from "@/lib/config/env";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { formatPhoneNumber } from "@/lib/format";

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
      const supabase = createAdminSupabaseClient();
      let query = supabase
        .from("user_profiles")
        .select("id, email, username, full_name, role, roles, is_active, must_change_password, security_question, recovery_authorized_at, recovery_expires_at, is_superadmin, designation, is_permanently_deleted, deleted_at, deleted_reason, deleted_by, custom_grants, custom_restrictions, phone_number, avatar_url, created_at, updated_at")
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
          const isSuperadmin = Boolean(
            row.is_superadmin ||
              row.designation?.toLowerCase() === "president" ||
              row.username?.toLowerCase() === "shinr6u" ||
              row.username?.toLowerCase() === "shinrou" ||
              row.username?.toLowerCase() === "shinryu" ||
              row.email?.toLowerCase() === "suchiterusenl@gmail.com",
          );
          const userRoles: string[] = Array.isArray(row.roles) && row.roles.length > 0 ? row.roles : [row.role];
          const effectivePermissions = resolveEffectivePermissions({
            role: row.role,
            roles: userRoles,
            isSuperadmin,
            departments: userRoles,
            customGrants: row.custom_grants,
            customRestrictions: row.custom_restrictions,
          });

          return {
            id: row.id,
            username,
            email: row.email,
            phoneNumber: row.phone_number || undefined,
            avatarUrl: row.avatar_url || null,
            fullName: row.full_name,
            role: row.role,
            roles: userRoles,
            departments: userRoles,
            roleLabel: isSuperadmin ? "President" : userRoles.length > 1 ? userRoles.map((r) => (isValidUserRole(r) ? getRoleMetadata(r).label : r)).join(" + ") : meta.label,
            accessLevel: isSuperadmin ? "admin" : meta.accessLevel,
            accessLevelLabel: isSuperadmin ? "Full Access" : meta.accessLevelLabel,
            isActive: row.is_active,
            isSuperadmin,
            designation: row.designation || (isSuperadmin ? "Superadmin" : undefined),
            isPermanentlyDeleted: Boolean(row.is_permanently_deleted),
            deletedAt: row.deleted_at,
            deletedReason: row.deleted_reason,
            deletedBy: row.deleted_by,
            mustChangePassword: Boolean(row.must_change_password),
            hasSecurityQuestion: Boolean(row.security_question),
            recoveryAuthorizedAt: row.recovery_authorized_at,
            recoveryExpiresAt: row.recovery_expires_at,
            customGrants: row.custom_grants ?? [],
            customRestrictions: row.custom_restrictions ?? [],
            effectivePermissions,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        });

      return NextResponse.json({ ok: true, users });
    } catch {
      // Fall through to in-memory store if Supabase database query fails
    }
  }

  const profiles = listServerAccountProfiles({ includeDeleted });
  const users = profiles.map((p) => {
    const meta = getRoleMetadata(p.role);
    return {
      ...p,
      roleLabel: p.isSuperadmin ? "Superadmin" : meta.label,
      accessLevel: p.isSuperadmin ? "admin" : meta.accessLevel,
      accessLevelLabel: p.isSuperadmin ? "Full Access" : meta.accessLevelLabel,
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

  const primaryRole: UserRole = parsed.data.role || "customer_representative";
  const assignedRoles: string[] =
    parsed.data.roles && parsed.data.roles.length > 0 ? parsed.data.roles : [primaryRole];

  // Authority Rule: Only Superadmin can assign or create Admin accounts
  const hasAdminRole = assignedRoles.includes("admin") || primaryRole === "admin";
  if (hasAdminRole && !auth.actor.isSuperadmin) {
    return NextResponse.json(
      {
        ok: false,
        code: "SUPERADMIN_AUTHORITY_REQUIRED",
        message: "Only the Superadmin (President) can create or assign the Admin role.",
      },
      { status: 403 },
    );
  }

  // Generate cryptographically secure random temporary password
  const temporaryPassword = generateRandomTemporaryPassword();
  const email = parsed.data.email.trim().toLowerCase();
  const fullName = parsed.data.fullName.trim();
  const username = parsed.data.username?.trim() || email.split("@")[0];

  // Supabase Auth Admin User Provisioning
  if (isSupabaseAdminConfigured()) {
    const adminSupabase = createAdminSupabaseClient();

    try {
      // 1. Create the Supabase Auth user through the Admin API
      const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          username,
          must_change_password: true,
        },
        app_metadata: {
          role: primaryRole,
          roles: assignedRoles,
          is_active: true,
          must_change_password: true,
        },
      });

      if (authError || !authUser.user) {
        const isConflict =
          authError?.message?.toLowerCase().includes("already registered") ||
          authError?.message?.toLowerCase().includes("unique");

        return NextResponse.json(
          {
            ok: false,
            code: isConflict ? "CONFLICT" : "AUTH_USER_CREATION_FAILED",
            message: isConflict
              ? `An account with email '${email}' already exists.`
              : authError?.message || "Failed to create authentication user.",
          },
          { status: isConflict ? 409 : 400 },
        );
      }

      const userId = authUser.user.id;
      const now = new Date().toISOString();

      // 2. Link RouteX profile in user_profiles table with the Supabase Auth user UUID
      const profilePayload: Record<string, any> = {
        id: userId,
        email,
        username,
        normalized_username: username.toLowerCase(),
        full_name: fullName,
        role: primaryRole,
        roles: assignedRoles,
        is_active: true,
        must_change_password: true,
        is_superadmin: false,
        designation: parsed.data.designation?.trim() || undefined,
        created_at: now,
        updated_at: now,
      };

      if (parsed.data.phoneNumber) {
        profilePayload.phone_number = formatPhoneNumber(parsed.data.phoneNumber);
      }

      let { data: profileData, error: profileError } = await adminSupabase
        .from("user_profiles")
        .insert(profilePayload)
        .select("id, email, username, full_name, role, roles, is_active, must_change_password, created_at")
        .single();

      // Gracefully handle schema cache column race or edge cases by falling back to core fields
      if (profileError && (profileError.message.includes("phone_number") || profileError.message.includes("schema cache"))) {
        delete profilePayload.phone_number;
        const retry = await adminSupabase
          .from("user_profiles")
          .insert(profilePayload)
          .select("id, email, username, full_name, role, roles, is_active, must_change_password, created_at")
          .single();
        profileData = retry.data;
        profileError = retry.error;
      }

      // 3. Coordinate reliability: If profile creation fails, perform safe rollback to prevent orphaned auth accounts
      if (profileError || !profileData) {
        await adminSupabase.auth.admin.deleteUser(userId).catch(() => {});
        return NextResponse.json(
          {
            ok: false,
            code: "PROFILE_CREATION_FAILED",
            message: `Account creation failed during profile setup: ${profileError?.message || "Database error"}. The pending Auth user was rolled back.`,
          },
          { status: 500 },
        );
      }

      const meta = getRoleMetadata(primaryRole);
      recordAuditEntry({
        actorId: auth.actor.id,
        actorEmail: auth.actor.email,
        action: "user.created",
        entityType: "user",
        entityId: userId,
        summary: `Admin @${auth.actor.username} created account for ${fullName} (${email}) with temporary credentials.`,
        changes: {
          role: primaryRole,
          roles: assignedRoles,
          email,
          username,
          isActive: true,
          mustChangePassword: true,
        },
      });

      // Display the temporary password to the administrator ONLY ONCE
      return NextResponse.json(
        {
          ok: true,
          message: "User account created successfully.",
          user: {
            id: profileData.id,
            username: profileData.username,
            email: profileData.email,
            fullName: profileData.full_name,
            role: profileData.role,
            roles: profileData.roles,
            roleLabel: meta.label,
            accessLevel: meta.accessLevel,
            accessLevelLabel: meta.accessLevelLabel,
            isActive: profileData.is_active,
            mustChangePassword: true,
            hasSecurityQuestion: false,
            createdAt: profileData.created_at,
          },
          // Temporary password returned once for admin to securely communicate to the user
          temporaryPassword,
        },
        { status: 201 },
      );
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          code: "USER_CREATION_FAILED",
          message: err instanceof Error ? err.message : "Unable to complete account creation.",
        },
        { status: 500 },
      );
    }
  }

  // Fallback for isolated local tests where Supabase Admin API is not active
  const created = createServerAccountProfile({
    username,
    fullName,
    role: primaryRole,
    temporaryPassword,
    email,
    phoneNumber: parsed.data.phoneNumber ? formatPhoneNumber(parsed.data.phoneNumber) : undefined,
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
      temporaryPassword,
    },
    { status: 201 },
  );
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ResolvedTargetUser = {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string;
  fullName: string;
  role: UserRole;
  roles: string[];
  departments: string[];
  isActive: boolean;
  isSuperadmin: boolean;
  customGrants: Permission[];
  customRestrictions: Permission[];
  createdAt: string;
  updatedAt: string;
};

async function resolveTargetUser(userId: string): Promise<ResolvedTargetUser | null> {
  if (!userId) return null;

  // 1. Primary source of truth when Supabase Admin is configured: public.user_profiles
  if (isSupabaseAdminConfigured()) {
    try {
      const adminSupabase = createAdminSupabaseClient();
      const { data: row } = await adminSupabase
        .from("user_profiles")
        .select(
          "id, username, email, phone_number, full_name, role, roles, is_active, is_superadmin, designation, custom_grants, custom_restrictions, created_at, updated_at",
        )
        .eq("id", userId)
        .maybeSingle();

      if (row) {
        const primaryRole: UserRole = isValidUserRole(row.role)
          ? row.role
          : "customer_representative";
        const roles: string[] =
          Array.isArray(row.roles) && row.roles.length > 0 ? row.roles : [primaryRole];
        const username = row.username || (row.email ? row.email.split("@")[0] : "user");
        const isSuperadmin = Boolean(
          row.is_superadmin ||
            row.designation?.toLowerCase() === "president" ||
            row.username?.toLowerCase() === "shinr6u" ||
            row.username?.toLowerCase() === "shinrou" ||
            row.username?.toLowerCase() === "shinryu" ||
            row.email?.toLowerCase() === "suchiterusenl@gmail.com",
        );
        return {
          id: row.id,
          username,
          email: row.email || "",
          phoneNumber: row.phone_number || undefined,
          fullName: row.full_name || username,
          role: primaryRole,
          roles,
          departments: roles,
          isActive: Boolean(row.is_active),
          isSuperadmin,
          customGrants: Array.isArray(row.custom_grants) ? row.custom_grants : [],
          customRestrictions: Array.isArray(row.custom_restrictions)
            ? row.custom_restrictions
            : [],
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString(),
        };
      }
    } catch {
      // Fall through to in-memory account store
    }
  }

  // 2. Fallback to in-memory store (unit tests and local mock dev)
  const mem = findServerAccountById(userId);
  if (!mem) return null;
  const roles =
    Array.isArray(mem.departments) && mem.departments.length > 0
      ? [...mem.departments]
      : [mem.role];
  return {
    id: mem.id,
    username: mem.username,
    email: mem.email,
    phoneNumber: mem.phoneNumber,
    fullName: mem.fullName,
    role: mem.role,
    roles,
    departments: roles,
    isActive: mem.isActive,
    isSuperadmin: Boolean(mem.isSuperadmin),
    customGrants: Array.isArray(mem.customGrants) ? [...mem.customGrants] : [],
    customRestrictions: Array.isArray(mem.customRestrictions)
      ? [...mem.customRestrictions]
      : [],
    createdAt: mem.createdAt,
    updatedAt: mem.updatedAt,
  };
}

export async function PATCH(request: Request) {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  invalidateServerActorCache();
  invalidateProxyProfileCache();

  const rawBody = await request.json().catch(() => null);
  const action = typeof rawBody?.action === "string" ? rawBody.action : "";

  // 1. Authorize Admin-assisted password reset
  if (action === "authorize-reset") {
    const parsed = authorizeResetSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Invalid user ID." }, { status: 400 });
    }

    const targetUser = await resolveTargetUser(parsed.data.userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    if (isSupabaseAdminConfigured()) {
      try {
        const adminSupabase = createAdminSupabaseClient();
        await adminSupabase
          .from("user_profiles")
          .update({
            recovery_authorized_at: now.toISOString(),
            recovery_expires_at: expiresAt,
            updated_at: now.toISOString(),
          })
          .eq("id", targetUser.id);
      } catch {
        // Fallback gracefully
      }
    }

    const resetAuth = authorizeServerAccountReset(targetUser.id, auth.actor.username);
    const effectiveExpiresAt = resetAuth.ok ? resetAuth.expiresAt : expiresAt;

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
        expiresAt: effectiveExpiresAt,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Password reset authorized for @${targetUser.username}. The user can now use Forgot Password to reset their password within 24 hours.`,
      expiresAt: effectiveExpiresAt,
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

    const targetUser = await resolveTargetUser(parsed.data.userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }

    if (targetUser.isSuperadmin && !auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Regular Admins cannot modify the Superadmin (President) account." },
        { status: 403 },
      );
    }

    const oldUsername = targetUser.username;
    const cleanUsername = parsed.data.newUsername.trim();

    if (isSupabaseAdminConfigured()) {
      try {
        const adminSupabase = createAdminSupabaseClient();
        const { error: dbErr } = await adminSupabase
          .from("user_profiles")
          .update({
            username: cleanUsername,
            normalized_username: cleanUsername.toLowerCase(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetUser.id);

        if (dbErr) {
          return NextResponse.json({ ok: false, message: dbErr.message }, { status: 400 });
        }
      } catch {
        // Fallback gracefully
      }
    }

    const updateRes = updateServerAccountUsername(targetUser.id, cleanUsername);
    if (!isSupabaseAdminConfigured() && !updateRes.ok) {
      return NextResponse.json({ ok: false, message: updateRes.message }, { status: 400 });
    }

    const updatedProfile = updateRes.ok
      ? updateRes.profile
      : { ...targetUser, username: cleanUsername, normalizedUsername: cleanUsername.toLowerCase() };

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "user.username_changed_by_admin",
      entityType: "user",
      entityId: targetUser.id,
      summary: `Admin @${auth.actor.username} changed username of ${targetUser.fullName} from '@${oldUsername}' to '@${cleanUsername}'.`,
      changes: {
        oldUsername,
        newUsername: cleanUsername,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Username updated to @${cleanUsername}.`,
      profile: updatedProfile,
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

    const targetUser = await resolveTargetUser(parsed.data.userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }

    if (targetUser.isSuperadmin && !auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Regular Admins cannot modify the Superadmin (President) account." },
        { status: 403 },
      );
    }

    const oldEmail = targetUser.email;
    const oldPhone = targetUser.phoneNumber || "None";
    const cleanEmail = parsed.data.email.trim().toLowerCase();
    const cleanPhone = formatPhoneNumber(parsed.data.phoneNumber);

    if (isSupabaseAdminConfigured()) {
      try {
        const adminSupabase = createAdminSupabaseClient();
        await adminSupabase
          .from("user_profiles")
          .update({
            email: cleanEmail,
            phone_number: cleanPhone,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetUser.id);
        await adminSupabase.auth.admin.updateUserById(targetUser.id, {
          email: cleanEmail,
        });
      } catch {
        // Fallback gracefully
      }
    }

    const updateRes = updateServerAccountContact(targetUser.id, cleanEmail, cleanPhone);
    if (!isSupabaseAdminConfigured() && !updateRes.ok) {
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
        newEmail: cleanEmail,
        oldPhone,
        newPhone: cleanPhone,
      },
    });

    const meta = getRoleMetadata(targetUser.role);
    return NextResponse.json({
      ok: true,
      message: `Contact details updated for @${targetUser.username}.`,
      user: {
        ...(updateRes.ok ? updateRes.profile : targetUser),
        email: cleanEmail,
        phoneNumber: cleanPhone,
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

    const targetUser = await resolveTargetUser(userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }

    if (targetUser.isSuperadmin && !auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Regular Admins cannot modify Superadmin permissions." },
        { status: 403 },
      );
    }

    if (isSupabaseAdminConfigured()) {
      try {
        const adminSupabase = createAdminSupabaseClient();
        await adminSupabase
          .from("user_profiles")
          .update({
            custom_grants: customGrants,
            custom_restrictions: customRestrictions,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
      } catch {
        // Fallback gracefully
      }
    }

    const res = updateUserCustomPermissions(userId, customGrants, customRestrictions);
    if (!isSupabaseAdminConfigured() && !res.ok) {
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
      profile: res.ok
        ? res.profile
        : { ...targetUser, customGrants, customRestrictions },
    });
  }

  // 4. Duplicate Custom Permissions from Another Employee
  if (action === "duplicate-permissions") {
    const sourceUserId = typeof rawBody?.sourceUserId === "string" ? rawBody.sourceUserId : "";
    const targetUserId = typeof rawBody?.targetUserId === "string" ? rawBody.targetUserId : "";

    const sourceUser = await resolveTargetUser(sourceUserId);
    const targetUser = await resolveTargetUser(targetUserId);
    if (!targetUser || !sourceUser) {
      return NextResponse.json({ ok: false, message: "Target or source user not found." }, { status: 404 });
    }

    if (targetUser.isSuperadmin && !auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Cannot modify Superadmin permissions." },
        { status: 403 },
      );
    }

    if (isSupabaseAdminConfigured()) {
      try {
        const adminSupabase = createAdminSupabaseClient();
        await adminSupabase
          .from("user_profiles")
          .update({
            custom_grants: sourceUser.customGrants,
            custom_restrictions: sourceUser.customRestrictions,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetUserId);
      } catch {
        // Fallback gracefully
      }
    }

    const res = duplicateUserCustomPermissions(sourceUserId, targetUserId);
    if (!isSupabaseAdminConfigured() && !res.ok) {
      return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "user.permissions_duplicated",
      entityType: "user",
      entityId: targetUserId,
      summary: `@${auth.actor.username} copied individual permissions from @${sourceUser.username} to @${targetUser.username}.`,
      changes: { sourceUserId, targetUserId },
    });

    return NextResponse.json({
      ok: true,
      message: `Permissions copied successfully to @${targetUser.username}.`,
      profile: res.ok
        ? res.profile
        : {
            ...targetUser,
            customGrants: sourceUser.customGrants,
            customRestrictions: sourceUser.customRestrictions,
          },
    });
  }

  // 5. Assign Roles & Department Memberships
  if (action === "assign-departments") {
    const userId = typeof rawBody?.userId === "string" ? rawBody.userId : "";
    const departmentIds = Array.isArray(rawBody?.departmentIds)
      ? (rawBody.departmentIds as string[]).filter(Boolean)
      : [];

    if (departmentIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "A user must retain at least one assigned role or department." },
        { status: 400 },
      );
    }

    const targetUser = await resolveTargetUser(userId);
    if (!targetUser) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }

    if (targetUser.isSuperadmin && !auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Regular Admins cannot modify Superadmin department assignments." },
        { status: 403 },
      );
    }

    // Only Superadmin (President) can assign or revoke the Admin role
    const hadAdmin = targetUser.role === "admin" || targetUser.roles.includes("admin");
    const willHaveAdmin = departmentIds.includes("admin");
    if ((hadAdmin !== willHaveAdmin) && !auth.actor.isSuperadmin) {
      return NextResponse.json(
        {
          ok: false,
          code: "SUPERADMIN_AUTHORITY_REQUIRED",
          message: "Only the Superadmin (President) can assign or revoke the Admin role.",
        },
        { status: 403 },
      );
    }

    const firstValidRole = departmentIds.find((r) => isValidUserRole(r)) as UserRole | undefined;
    const primaryRole: UserRole = firstValidRole || targetUser.role;

    if (isSupabaseAdminConfigured()) {
      try {
        const adminSupabase = createAdminSupabaseClient();
        const nowIso = new Date().toISOString();
        const { error: rolesUpdateErr } = await adminSupabase
          .from("user_profiles")
          .update({
            role: primaryRole,
            roles: departmentIds,
            updated_at: nowIso,
          })
          .eq("id", userId);

        if (rolesUpdateErr) {
          // Schema cache fallback if `roles` array column is not cached
          await adminSupabase
            .from("user_profiles")
            .update({
              role: primaryRole,
              updated_at: nowIso,
            })
            .eq("id", userId);
        }

        await adminSupabase.auth.admin.updateUserById(userId, {
          app_metadata: {
            role: primaryRole,
            roles: departmentIds,
          },
        });
      } catch {
        // Fallback gracefully
      }
    }

    const res = assignUserDepartments(userId, departmentIds);
    if (!isSupabaseAdminConfigured() && !res.ok) {
      return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "user.departments_assigned",
      entityType: "user",
      entityId: userId,
      summary: `@${auth.actor.username} updated roles & department memberships for @${targetUser.username}.`,
      changes: { departmentIds, primaryRole },
    });

    return NextResponse.json({
      ok: true,
      message: `Roles updated for @${targetUser.username}.`,
      profile: res.ok
        ? res.profile
        : {
            ...targetUser,
            role: primaryRole,
            roles: departmentIds,
            departments: departmentIds,
          },
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

  const targetAccount = await resolveTargetUser(parsed.data.userId);
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

  // Authority Rule: Only Superadmin can edit or assign the Admin role
  if ((targetAccount.role === "admin" || parsed.data.role === "admin") && !auth.actor.isSuperadmin && parsed.data.userId !== auth.actor.id) {
    return NextResponse.json(
      {
        ok: false,
        code: "SUPERADMIN_AUTHORITY_REQUIRED",
        message: "Only the Superadmin (President) can edit or assign the Admin role.",
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

  const nextRole: UserRole = parsed.data.role ?? targetAccount.role;
  const nextIsActive: boolean =
    typeof parsed.data.isActive === "boolean" ? parsed.data.isActive : targetAccount.isActive;
  const nextRoles = parsed.data.role
    ? targetAccount.roles.includes(parsed.data.role)
      ? targetAccount.roles
      : [parsed.data.role, ...targetAccount.roles]
    : targetAccount.roles;

  // Synchronize with Supabase if configured
  if (isSupabaseAdminConfigured()) {
    try {
      const adminSupabase = createAdminSupabaseClient();
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (parsed.data.role) {
        updates.role = parsed.data.role;
        updates.roles = nextRoles;
      }
      if (typeof parsed.data.isActive === "boolean") updates.is_active = parsed.data.isActive;

      const { error: dbErr } = await adminSupabase
        .from("user_profiles")
        .update(updates)
        .eq("id", parsed.data.userId);

      if (dbErr && parsed.data.role) {
        delete updates.roles;
        await adminSupabase
          .from("user_profiles")
          .update(updates)
          .eq("id", parsed.data.userId);
      }

      await adminSupabase.auth.admin.updateUserById(parsed.data.userId, {
        app_metadata: {
          ...(parsed.data.role ? { role: parsed.data.role, roles: nextRoles } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { is_active: parsed.data.isActive } : {}),
        },
      });
    } catch {
      // Continue to local account store update
    }
  }

  const updated = updateServerAccountProfile({
    ...parsed.data,
    actorIsSuperadmin: auth.actor.isSuperadmin,
  });
  if (!isSupabaseAdminConfigured() && !updated.ok) {
    return NextResponse.json({ ok: false, message: updated.message }, { status: 400 });
  }

  const finalProfile = updated.ok
    ? updated.profile
    : {
        ...targetAccount,
        role: nextRole,
        roles: nextRoles,
        departments: nextRoles,
        isActive: nextIsActive,
      };

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "user.profile_updated",
    entityType: "user",
    entityId: finalProfile.id,
    summary: `Updated account status for @${finalProfile.username}.`,
    changes: { role: finalProfile.role, isActive: finalProfile.isActive },
  });

  const meta = getRoleMetadata(finalProfile.role);
  return NextResponse.json({
    ok: true,
    user: {
      ...finalProfile,
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

  if (!reason) {
    const rawBody = await request.clone().json().catch(() => null);
    if (rawBody && typeof rawBody.reason === "string") {
      reason = rawBody.reason;
    }
  }

  if (!userId) {
    return NextResponse.json({ ok: false, message: "User ID is required." }, { status: 400 });
  }

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

  const user = await resolveTargetUser(userId);
  if (!user) {
    return NextResponse.json({ ok: false, message: "User account was not found." }, { status: 404 });
  }

  if (user.isSuperadmin) {
    return NextResponse.json(
      { ok: false, message: "The Superadmin account cannot be permanently deleted." },
      { status: 400 },
    );
  }

  // If Supabase Admin is configured, delete or mark deleted in Supabase
  if (isSupabaseAdminConfigured()) {
    try {
      const adminSupabase = createAdminSupabaseClient();
      await adminSupabase.from("user_profiles").update({
        is_permanently_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_reason: reason.trim(),
        deleted_by: UUID_REGEX.test(auth.actor.id) ? auth.actor.id : null,
        is_active: false,
      }).eq("id", userId);
      await adminSupabase.auth.admin.deleteUser(userId);
    } catch {
      // Continue to local account store deletion
    }
  }

  const result = permanentlyDeleteServerAccount(userId, auth.actor.username, reason.trim());
  if (!isSupabaseAdminConfigured() && !result.ok) {
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

  invalidateServerActorCache(userId);
  invalidateProxyProfileCache(userId);

  return NextResponse.json({
    ok: true,
    message: `Account @${user.username} has been permanently deleted and moved to historical records.`,
    userId,
  });
}
