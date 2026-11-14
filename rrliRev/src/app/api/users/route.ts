import { NextResponse } from "next/server";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import {
  adminUpdateContactSchema,
  adminUpdateUsernameSchema,
  authorizeResetSchema,
  createUserAccountSchema,
  updateUserRoleSchema,
} from "@/lib/auth/auth-schemas";
import { getRoleMetadata, isValidUserRole, type UserRole } from "@/lib/auth/rbac";
import {
  authorizeServerAccountReset,
  createServerAccountProfile,
  deleteServerAccount,
  findServerAccountById,
  listServerAccountProfiles,
  updateServerAccountContact,
  updateServerAccountProfile,
  updateServerAccountUsername,
} from "@/lib/auth/server-account-store";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, username, full_name, role, is_active, must_change_password, security_question, recovery_authorized_at, recovery_expires_at, created_at, updated_at")
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const users = (data ?? [])
        .filter((row) => isValidUserRole(row.role))
        .map((row) => {
          const meta = getRoleMetadata(row.role);
          const username = row.username || row.email.split("@")[0];
          return {
            id: row.id,
            username,
            email: row.email,
            fullName: row.full_name,
            role: row.role,
            roleLabel: meta.label,
            accessLevel: meta.accessLevel,
            accessLevelLabel: meta.accessLevelLabel,
            isActive: row.is_active,
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

  const users = listServerAccountProfiles().map((profile) => {
    const meta = getRoleMetadata(profile.role);
    return {
      ...profile,
      roleLabel: meta.label,
      accessLevel: meta.accessLevel,
      accessLevelLabel: meta.accessLevelLabel,
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

  // 3. Update role or active status
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

  if (parsed.data.userId === auth.actor.id) {
    if (parsed.data.isActive === false || (parsed.data.role && parsed.data.role !== "admin")) {
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

  // Deletion decisions strictly restricted to Admin
  if (auth.actor.role !== "admin") {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        message: "Only System Administrators are authorized to make user deletion decisions.",
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || searchParams.get("id");
  if (!userId) {
    return NextResponse.json({ ok: false, message: "User ID is required." }, { status: 400 });
  }

  if (userId === auth.actor.id) {
    return NextResponse.json(
      { ok: false, message: "You cannot delete your own active Admin account." },
      { status: 400 },
    );
  }

  const user = findServerAccountById(userId);
  if (!user) {
    return NextResponse.json({ ok: false, message: "User account was not found." }, { status: 404 });
  }

  const result = deleteServerAccount(userId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "user.deleted",
    entityType: "user",
    entityId: userId,
    summary: `Deleted user @${user.username} (${user.fullName}).`,
  });

  return NextResponse.json({
    ok: true,
    message: `User @${user.username} has been deleted.`,
    userId,
  });
}
