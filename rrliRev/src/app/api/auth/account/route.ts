import { NextResponse } from "next/server";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/config/env";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  changePasswordSchema,
  changeSecurityQuestionSchema,
  changeUsernameSchema,
  initialSetupSchema,
  updateContactInfoSchema,
} from "@/lib/auth/auth-schemas";
import { hashWithArgon2id } from "@/lib/auth/argon2id";
import {
  generateBackupKey,
  normalizeBackupKey,
  normalizeSecurityAnswer,
  validateUsernameFormat,
} from "@/lib/auth/password-policy";
import { formatPhoneNumber } from "@/lib/format";
import {
  completeInitialServerAccountSetup,
  generateServerAccountBackupKey,
  updateServerAccountAvatar,
  updateServerAccountContact,
  updateServerAccountPassword,
  updateServerAccountSecurityQuestion,
  updateServerAccountUsername,
  verifyServerAccountCurrentPassword,
} from "@/lib/auth/server-account-store";
import { getAuthenticatedActor, invalidateServerActorCache, type AuthenticatedActor } from "@/lib/auth/server-session";
import { invalidateProxyProfileCache } from "@/proxy";

async function getDatabaseClient() {
  if (isSupabaseAdminConfigured()) {
    return createAdminSupabaseClient();
  }
  return createServerSupabaseClient();
}

async function verifyCurrentPassword(
  actor: AuthenticatedActor,
  currentPassword: string,
): Promise<boolean> {
  // First attempt fast in-memory store verification (supports local test runs and seed accounts)
  if (verifyServerAccountCurrentPassword(actor.id, currentPassword)) {
    return true;
  }

  // Next, if Supabase Auth is configured, attempt password verification via Supabase Auth
  if (isSupabaseConfigured() && actor.email) {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: actor.email,
        password: currentPassword,
      });
      return !error;
    } catch {
      return false;
    }
  }

  return false;
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "You must be logged in to update account settings." },
      { status: 401 },
    );
  }

  invalidateServerActorCache(actor.id);
  invalidateProxyProfileCache(actor.id);

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  // 1. Change Username
  if (action === "change-username") {
    const parsed = changeUsernameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid username data." },
        { status: 400 },
      );
    }

    const { newUsername, currentPassword } = parsed.data;

    // Verify current password
    const isCurrentValid = await verifyCurrentPassword(actor, currentPassword);
    if (!isCurrentValid) {
      return NextResponse.json(
        { ok: false, message: "The current password you entered is incorrect." },
        { status: 403 },
      );
    }

    const oldUsername = actor.username;

    if (isSupabaseConfigured()) {
      try {
        const usernameCheck = validateUsernameFormat(newUsername);
        if (!usernameCheck.isValid) {
          return NextResponse.json(
            { ok: false, message: usernameCheck.message || "Invalid username format." },
            { status: 400 },
          );
        }

        const db = await getDatabaseClient();
        const { data: updatedProfile, error: updateErr } = await db
          .from("user_profiles")
          .update({ username: newUsername.trim() })
          .eq("id", actor.id)
          .select()
          .maybeSingle();

        if (updateErr) {
          return NextResponse.json({ ok: false, message: updateErr.message }, { status: 400 });
        }

        try {
          updateServerAccountUsername(actor.id, newUsername);
        } catch {
          // Fallback gracefully if not present in memory store
        }

        recordAuditEntry({
          actorId: actor.id,
          actorEmail: actor.email,
          action: "user.username_changed",
          entityType: "user",
          entityId: actor.id,
          summary: `User '${oldUsername}' changed their username to '${newUsername.trim()}'.`,
          changes: {
            oldUsername,
            newUsername: newUsername.trim(),
            userId: actor.id,
          },
        });

        return NextResponse.json({
          ok: true,
          message: `Username updated to '${newUsername.trim()}'.`,
          profile: updatedProfile || {
            ...actor,
            username: newUsername.trim(),
          },
        });
      } catch (err) {
        return NextResponse.json(
          { ok: false, message: err instanceof Error ? err.message : "Failed to update username." },
          { status: 500 },
        );
      }
    }

    const result = updateServerAccountUsername(actor.id, newUsername);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "user.username_changed",
      entityType: "user",
      entityId: actor.id,
      summary: `User '${oldUsername}' changed their username to '${result.profile.username}'.`,
      changes: {
        oldUsername,
        newUsername: result.profile.username,
        userId: actor.id,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Username updated to '${result.profile.username}'.`,
      profile: result.profile,
    });
  }

  // 1b. Update Contact Info (Email & Phone Number)
  if (action === "update-contact") {
    const parsed = updateContactInfoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid contact information." },
        { status: 400 },
      );
    }

    const { email, phoneNumber, currentPassword } = parsed.data;

    // Verify current password
    const isCurrentValid = await verifyCurrentPassword(actor, currentPassword);
    if (!isCurrentValid) {
      return NextResponse.json(
        { ok: false, message: "The current password you entered is incorrect." },
        { status: 403 },
      );
    }

    const oldEmail = actor.email;
    const oldPhone = actor.phoneNumber || "None";

    if (isSupabaseConfigured()) {
      try {
        const db = await getDatabaseClient();
        const formattedPhone = formatPhoneNumber(phoneNumber);
        const { data: updatedProfile, error: updateErr } = await db
          .from("user_profiles")
          .update({
            email: email.trim().toLowerCase(),
            phone_number: formattedPhone,
          })
          .eq("id", actor.id)
          .select()
          .maybeSingle();

        if (updateErr) {
          return NextResponse.json({ ok: false, message: updateErr.message }, { status: 400 });
        }

        try {
          updateServerAccountContact(actor.id, email, phoneNumber);
        } catch {
          // Fallback gracefully if not present in memory store
        }

        recordAuditEntry({
          actorId: actor.id,
          actorEmail: email.trim().toLowerCase(),
          action: "user.contact_updated",
          entityType: "user",
          entityId: actor.id,
          summary: `User '@${actor.username}' updated contact details (email: ${email.trim().toLowerCase()}, phone: ${formattedPhone}).`,
          changes: {
            oldEmail,
            newEmail: email.trim().toLowerCase(),
            oldPhone,
            newPhone: formattedPhone,
            userId: actor.id,
          },
        });

        return NextResponse.json({
          ok: true,
          message: "Contact information updated successfully.",
          profile: updatedProfile || {
            ...actor,
            email: email.trim().toLowerCase(),
            phoneNumber: formattedPhone,
          },
        });
      } catch (err) {
        return NextResponse.json(
          { ok: false, message: err instanceof Error ? err.message : "Failed to update contact info." },
          { status: 500 },
        );
      }
    }

    const result = updateServerAccountContact(actor.id, email, phoneNumber);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: actor.id,
      actorEmail: result.profile.email,
      action: "user.contact_updated",
      entityType: "user",
      entityId: actor.id,
      summary: `User '@${actor.username}' updated contact details (email: ${result.profile.email}, phone: ${result.profile.phoneNumber}).`,
      changes: {
        oldEmail,
        newEmail: result.profile.email,
        oldPhone,
        newPhone: result.profile.phoneNumber,
        userId: actor.id,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Contact information updated successfully.",
      profile: result.profile,
    });
  }

  // 2. Change Password
  if (action === "change-password") {
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid password data." },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword, confirmPassword } = parsed.data;

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "New passwords do not match." },
        { status: 400 },
      );
    }

    const isCurrentValid = await verifyCurrentPassword(actor, currentPassword);
    if (!isCurrentValid) {
      return NextResponse.json(
        { ok: false, message: "The current password you entered is incorrect." },
        { status: 403 },
      );
    }

    // Supabase Auth password update
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createServerSupabaseClient();
        const { error: authError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (authError) {
          return NextResponse.json(
            { ok: false, message: authError.message || "Failed to update password with authentication service." },
            { status: 400 },
          );
        }

        const db = await getDatabaseClient();
        await db
          .from("user_profiles")
          .update({
            password_changed_at: new Date().toISOString(),
          })
          .eq("id", actor.id);

        try {
          updateServerAccountPassword(actor.id, newPassword);
        } catch {
          // Fallback gracefully
        }

        recordAuditEntry({
          actorId: actor.id,
          actorEmail: actor.email,
          action: "user.password_changed",
          entityType: "user",
          entityId: actor.id,
          summary: `User '${actor.username}' updated their account password.`,
          changes: {
            username: actor.username,
            userId: actor.id,
            passwordChangedAt: new Date().toISOString(),
          },
        });

        return NextResponse.json({
          ok: true,
          message: "Password successfully updated.",
        });
      } catch (err) {
        return NextResponse.json(
          { ok: false, message: err instanceof Error ? err.message : "Failed to update password." },
          { status: 500 },
        );
      }
    }

    const result = updateServerAccountPassword(actor.id, newPassword);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "user.password_changed",
      entityType: "user",
      entityId: actor.id,
      summary: `User '${actor.username}' updated their account password.`,
      changes: {
        username: actor.username,
        userId: actor.id,
        passwordChangedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Password successfully updated.",
    });
  }

  // 3. Change Security Question
  if (action === "change-security-question") {
    const parsed = changeSecurityQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid security question data." },
        { status: 400 },
      );
    }

    const { question, answer, confirmAnswer, currentPassword } = parsed.data;

    if (normalizeSecurityAnswer(answer) !== normalizeSecurityAnswer(confirmAnswer)) {
      return NextResponse.json(
        { ok: false, message: "Security answers do not match." },
        { status: 400 },
      );
    }

    const isCurrentValid = await verifyCurrentPassword(actor, currentPassword);
    if (!isCurrentValid) {
      return NextResponse.json(
        { ok: false, message: "The current password you entered is incorrect." },
        { status: 403 },
      );
    }

    if (isSupabaseConfigured()) {
      try {
        const db = await getDatabaseClient();
        const answerHash = hashWithArgon2id(normalizeSecurityAnswer(answer));
        await db
          .from("user_profiles")
          .update({
            security_question: question.trim(),
            security_answer_hash: answerHash,
          })
          .eq("id", actor.id);

        try {
          updateServerAccountSecurityQuestion(actor.id, question, answer);
        } catch {
          // Fallback gracefully
        }

        recordAuditEntry({
          actorId: actor.id,
          actorEmail: actor.email,
          action: "user.security_question_changed",
          entityType: "user",
          entityId: actor.id,
          summary: `User '${actor.username}' updated their security question.`,
          changes: {
            username: actor.username,
            question,
            updatedAt: new Date().toISOString(),
          },
        });

        return NextResponse.json({
          ok: true,
          message: "Security question and answer successfully configured.",
        });
      } catch (err) {
        return NextResponse.json(
          { ok: false, message: err instanceof Error ? err.message : "Failed to update security question." },
          { status: 500 },
        );
      }
    }

    const result = updateServerAccountSecurityQuestion(actor.id, question, answer);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "user.security_question_changed",
      entityType: "user",
      entityId: actor.id,
      summary: `User '${actor.username}' updated their security question.`,
      changes: {
        username: actor.username,
        question,
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Security question and answer successfully configured.",
    });
  }

  // 4. Initial Account Setup (Temporary password change & Security Question setup)
  if (action === "initial-setup") {
    const parsed = initialSetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid initial setup data." },
        { status: 400 },
      );
    }

    const { newPassword, confirmPassword, question, answer, confirmAnswer, avatarUrl } = parsed.data;
    const clientProvidedKey =
      typeof body?.backupKey === "string" && normalizeBackupKey(body.backupKey).length >= 8
        ? body.backupKey.trim().toUpperCase()
        : null;

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "New passwords do not match." },
        { status: 400 },
      );
    }

    if (normalizeSecurityAnswer(answer) !== normalizeSecurityAnswer(confirmAnswer)) {
      return NextResponse.json(
        { ok: false, message: "Security answers do not match." },
        { status: 400 },
      );
    }

    // Supabase Auth: update user password and clear must_change_password requirement
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createServerSupabaseClient();
        const { error: authError } = await supabase.auth.updateUser({
          password: newPassword,
          data: {
            must_change_password: false,
          },
        });

        if (authError) {
          return NextResponse.json(
            { ok: false, message: authError.message || "Failed to update password with authentication service." },
            { status: 400 },
          );
        }

        const db = await getDatabaseClient();
        const nowIso = new Date().toISOString();
        const rawBackupKey = clientProvidedKey || generateBackupKey();
        const backupKeyHash = hashWithArgon2id(normalizeBackupKey(rawBackupKey));
        const answerHash = hashWithArgon2id(normalizeSecurityAnswer(answer));

        const { data: updatedProfile, error: profileError } = await db
          .from("user_profiles")
          .update({
            must_change_password: false,
            security_question: question.trim(),
            security_answer_hash: answerHash,
            password_changed_at: nowIso,
            avatar_url: avatarUrl || undefined,
          })
          .eq("id", actor.id)
          .select()
          .maybeSingle();

        if (profileError) {
          return NextResponse.json(
            { ok: false, message: profileError.message || "Failed to update user profile in database." },
            { status: 400 },
          );
        }

        // Persist emergency backup key hash (non-blocking if schema cache hasn't refreshed column)
        try {
          await db
            .from("user_profiles")
            .update({
              backup_key_hash: backupKeyHash,
              backup_key_generated_at: nowIso,
            })
            .eq("id", actor.id);
        } catch {
          // Non-fatal if column is unavailable in older schema cache
        }

        // Also update memory store if account exists there (for hybrid/tests)
        let activeBackupKey = rawBackupKey;
        try {
          completeInitialServerAccountSetup(
            actor.id,
            newPassword,
            question,
            answer,
          );
          if (avatarUrl) {
            updateServerAccountAvatar(actor.id, avatarUrl);
          }
          const memKeyRes = generateServerAccountBackupKey(
            actor.username || actor.email,
            undefined,
            rawBackupKey,
          );
          if (memKeyRes.ok) {
            activeBackupKey = memKeyRes.backupKey;
          }
        } catch {
          // Ignore if not present in memory store
        }

        recordAuditEntry({
          actorId: actor.id,
          actorEmail: actor.email,
          action: "user.initial_setup_completed",
          entityType: "user",
          entityId: actor.id,
          summary: `User '${actor.username}' completed first-login permanent password and security question setup.`,
          changes: {
            username: actor.username,
            userId: actor.id,
            completedAt: nowIso,
          },
        });

        return NextResponse.json({
          ok: true,
          message: "Initial account setup completed successfully.",
          backupKey: activeBackupKey,
          profile: updatedProfile || {
            id: actor.id,
            username: actor.username,
            email: actor.email,
            fullName: actor.fullName,
            role: actor.role,
            mustChangePassword: false,
            hasSecurityQuestion: true,
            hasBackupKey: true,
            avatarUrl: avatarUrl || actor.avatarUrl || null,
          },
        });
      } catch (err) {
        return NextResponse.json(
          { ok: false, message: err instanceof Error ? err.message : "Failed to save initial setup." },
          { status: 500 },
        );
      }
    }

    // Fallback for non-Supabase environments (e.g. unit tests and local dev)
    const result = completeInitialServerAccountSetup(
      actor.id,
      newPassword,
      question,
      answer,
    );

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    if (avatarUrl) {
      updateServerAccountAvatar(actor.id, avatarUrl);
    }

    const backupKeyRes = generateServerAccountBackupKey(
      actor.username || actor.email,
      undefined,
      clientProvidedKey || undefined,
    );
    const issuedBackupKey = backupKeyRes.ok
      ? backupKeyRes.backupKey
      : clientProvidedKey || generateBackupKey();

    recordAuditEntry({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "user.initial_setup_completed",
      entityType: "user",
      entityId: actor.id,
      summary: `User '${actor.username}' completed first-login permanent password and security question setup.`,
      changes: {
        username: actor.username,
        userId: actor.id,
        completedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Initial account setup completed successfully.",
      backupKey: issuedBackupKey,
      profile: result.profile,
    });
  }

  // 5. Update Profile Photo
  if (action === "update-profile-photo") {
    const rawAvatar = body?.avatarUrl;
    let avatarUrl: string | null = null;

    if (rawAvatar !== null && rawAvatar !== undefined) {
      if (typeof rawAvatar !== "string") {
        return NextResponse.json(
          { ok: false, message: "Invalid profile photo format." },
          { status: 400 },
        );
      }
      const trimmed = rawAvatar.trim();
      if (
        !trimmed.startsWith("data:image/") &&
        !trimmed.startsWith("/profiles/") &&
        !trimmed.startsWith("https://") &&
        !trimmed.startsWith("http://")
      ) {
        return NextResponse.json(
          { ok: false, message: "Invalid image format. Supported formats are JPG, PNG, and WebP." },
          { status: 400 },
        );
      }
      // Safety size constraint (3MB)
      if (trimmed.length > 3 * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, message: "Profile photo is too large. Maximum size is 3MB." },
          { status: 400 },
        );
      }
      avatarUrl = trimmed;
    }

    if (isSupabaseConfigured()) {
      try {
        const db = await getDatabaseClient();
        const { data: updatedProfile, error: profileErr } = await db
          .from("user_profiles")
          .update({ avatar_url: avatarUrl })
          .eq("id", actor.id)
          .select()
          .maybeSingle();

        if (profileErr) {
          return NextResponse.json({ ok: false, message: profileErr.message }, { status: 400 });
        }

        try {
          updateServerAccountAvatar(actor.id, avatarUrl);
        } catch {
          // Ignore if not in memory store
        }

        recordAuditEntry({
          actorId: actor.id,
          actorEmail: actor.email,
          action: "user.profile_photo_updated",
          entityType: "user",
          entityId: actor.id,
          summary: avatarUrl
            ? `User '${actor.username}' updated their profile picture.`
            : `User '${actor.username}' removed their profile picture.`,
          changes: {
            username: actor.username,
            userId: actor.id,
            hasAvatar: Boolean(avatarUrl),
            updatedAt: new Date().toISOString(),
          },
        });

        return NextResponse.json({
          ok: true,
          message: avatarUrl ? "Profile picture updated successfully." : "Profile picture removed.",
          avatarUrl,
          profile: updatedProfile || {
            ...actor,
            avatarUrl,
          },
        });
      } catch (err) {
        return NextResponse.json(
          { ok: false, message: err instanceof Error ? err.message : "Failed to update profile picture." },
          { status: 500 },
        );
      }
    }

    const result = updateServerAccountAvatar(actor.id, avatarUrl);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "user.profile_photo_updated",
      entityType: "user",
      entityId: actor.id,
      summary: avatarUrl
        ? `User '${actor.username}' updated their profile picture.`
        : `User '${actor.username}' removed their profile picture.`,
      changes: {
        username: actor.username,
        userId: actor.id,
        hasAvatar: Boolean(avatarUrl),
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: avatarUrl ? "Profile picture updated successfully." : "Profile picture removed.",
      avatarUrl,
      profile: result.profile,
    });
  }

  return NextResponse.json({ ok: false, message: "Unsupported action." }, { status: 400 });
}
