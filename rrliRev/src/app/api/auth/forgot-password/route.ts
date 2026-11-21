import { NextResponse } from "next/server";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import {
  checkRecoveryUserSchema,
  resetPasswordWithTokenSchema,
  verifyBackupKeySchema,
  verifySecurityAnswerSchema,
} from "@/lib/auth/auth-schemas";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limiter";
import {
  findServerAccountByUsername,
  getServerAccountRecoveryState,
  resetServerAccountPasswordWithToken,
  verifyServerAccountBackupKey,
  verifyServerAccountSecurityAnswer,
} from "@/lib/auth/server-account-store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "check-user";

  // 1. Check recovery options for a username
  if (action === "check-user") {
    const parsed = checkRecoveryUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Enter your RouteX username." },
        { status: 400 },
      );
    }

    const { username } = parsed.data;
    const recoveryState = getServerAccountRecoveryState(username);

    if (recoveryState.status === "admin_authorized") {
      return NextResponse.json({
        ok: true,
        mode: "admin_authorized",
        recoveryToken: recoveryState.recoveryToken,
        hasBackupKey: recoveryState.hasBackupKey,
        hasSecurityQuestion: recoveryState.hasSecurityQuestion,
        message: "An Administrator has authorized direct password recovery for this account.",
      });
    }

    if (recoveryState.status === "security_question" || recoveryState.status === "backup_key") {
      return NextResponse.json({
        ok: true,
        mode: recoveryState.status,
        question: recoveryState.question,
        hasBackupKey: recoveryState.hasBackupKey,
        hasSecurityQuestion: recoveryState.hasSecurityQuestion,
      });
    }

    if (recoveryState.status === "no_recovery_configured") {
      return NextResponse.json({
        ok: false,
        code: "NO_SECURITY_QUESTION",
        message:
          "No security question or backup key has been configured for this account. Please contact an Administrator or President to authorize a password reset.",
      });
    }

    // Generic error to prevent username enumeration
    return NextResponse.json(
      {
        ok: false,
        code: "USER_NOT_FOUND",
        message:
          "If an active RouteX account matches that username, recovery options have been loaded. Otherwise, contact an Administrator.",
      },
      { status: 404 },
    );
  }

  // 2. Verify backup key
  if (action === "verify-backup-key") {
    const parsed = verifyBackupKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Username and emergency backup key are required." },
        { status: 400 },
      );
    }

    const { username, backupKey } = parsed.data;
    const rateLimitKey = `backup-key:${username.toLowerCase().trim()}`;

    // Rate limit: 3 attempts per 5 minutes
    const rateLimit = checkRateLimit(rateLimitKey, 3, 5 * 60 * 1000, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      recordAuditEntry({
        actorId: "system",
        actorEmail: `${username.toLowerCase().trim()}@routex.local`,
        action: "user.recovery_lockout",
        entityType: "user",
        entityId: username,
        summary: `Account password recovery locked due to multiple failed backup key attempts.`,
      });

      return NextResponse.json(
        {
          ok: false,
          code: "RATE_LIMITED",
          message: `Too many failed backup key attempts. Please wait ${rateLimit.retryAfterSec ?? 600} seconds or contact an Administrator.`,
        },
        { status: 429 },
      );
    }

    const verification = verifyServerAccountBackupKey(username, backupKey);
    if (!verification.ok) {
      recordAuditEntry({
        actorId: "system",
        actorEmail: `${username.toLowerCase().trim()}@routex.local`,
        action: "user.recovery_failed",
        entityType: "user",
        entityId: username,
        summary: `Failed backup key recovery attempt for username '${username}'.`,
      });

      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_BACKUP_KEY",
          message: verification.message,
        },
        { status: 401 },
      );
    }

    resetRateLimit(rateLimitKey);
    return NextResponse.json({
      ok: true,
      resetToken: verification.resetToken,
    });
  }

  // 2. Verify security answer
  if (action === "verify-answer") {
    const parsed = verifySecurityAnswerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Username and security answer are required." },
        { status: 400 },
      );
    }

    const { username, answer } = parsed.data;
    const rateLimitKey = `security-answer:${username.toLowerCase().trim()}`;

    // Rate limit: 3 attempts per 5 minutes
    const rateLimit = checkRateLimit(rateLimitKey, 3, 5 * 60 * 1000, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      recordAuditEntry({
        actorId: "system",
        actorEmail: `${username.toLowerCase().trim()}@routex.local`,
        action: "user.recovery_lockout",
        entityType: "user",
        entityId: username,
        summary: `Account password recovery locked due to multiple failed security answer attempts.`,
      });

      return NextResponse.json(
        {
          ok: false,
          code: "RATE_LIMITED",
          message: `Too many failed security answer attempts. Please wait ${rateLimit.retryAfterSec ?? 600} seconds or contact an Administrator.`,
        },
        { status: 429 },
      );
    }

    const verification = verifyServerAccountSecurityAnswer(username, answer);
    if (!verification.ok) {
      recordAuditEntry({
        actorId: "system",
        actorEmail: `${username.toLowerCase().trim()}@routex.local`,
        action: "user.recovery_failed",
        entityType: "user",
        entityId: username,
        summary: `Failed security question recovery attempt for username '${username}'.`,
      });

      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_ANSWER",
          message: "The security answer you entered is incorrect.",
        },
        { status: 401 },
      );
    }

    resetRateLimit(rateLimitKey);
    return NextResponse.json({
      ok: true,
      resetToken: verification.resetToken,
    });
  }

  // 3. Reset password using valid single-use token (Admin-authorized or verified Security Answer)
  if (action === "reset") {
    const parsed = resetPasswordWithTokenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? "Invalid password reset request.",
        },
        { status: 400 },
      );
    }

    const { username, token, newPassword, confirmPassword, mode } = parsed.data;

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "New passwords do not match." },
        { status: 400 },
      );
    }

    const resetResult = resetServerAccountPasswordWithToken(
      username,
      token,
      newPassword,
      mode,
    );

    if (!resetResult.ok) {
      return NextResponse.json(
        { ok: false, message: resetResult.message },
        { status: 400 },
      );
    }

    const targetUser = findServerAccountByUsername(username);

    recordAuditEntry({
      actorId: targetUser?.id || "unknown",
      actorEmail: targetUser?.email || `${username}@routex.local`,
      action:
        mode === "admin"
          ? "user.recovery_completed_admin"
          : mode === "backup_key"
          ? "user.recovery_completed_backup_key"
          : "user.password_recovered",
      entityType: "user",
      entityId: targetUser?.id || username,
      summary:
        mode === "admin"
          ? `User completed Admin-authorized password recovery for username '${username}'.`
          : mode === "backup_key"
          ? `User completed emergency backup-key password recovery for username '${username}'. Replacement key issued.`
          : `User completed self-service security question password recovery for username '${username}'.`,
      changes: {
        mode,
        username,
        recoveryCompletedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      replacementBackupKey: resetResult.replacementBackupKey,
      message: "Your password has been successfully reset. You can now log in with your new password.",
    });
  }

  return NextResponse.json({ ok: false, message: "Unsupported action." }, { status: 400 });
}
