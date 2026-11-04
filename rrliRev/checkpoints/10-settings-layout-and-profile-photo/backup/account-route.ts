import { NextResponse } from "next/server";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import {
  changePasswordSchema,
  changeSecurityQuestionSchema,
  changeUsernameSchema,
  initialSetupSchema,
} from "@/lib/auth/auth-schemas";
import {
  completeInitialServerAccountSetup,
  findServerAccountById,
  updateServerAccountPassword,
  updateServerAccountSecurityQuestion,
  updateServerAccountUsername,
  verifyServerAccountCurrentPassword,
} from "@/lib/auth/server-account-store";
import { getAuthenticatedActor } from "@/lib/auth/server-session";

export async function POST(request: Request) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "You must be logged in to update account settings." },
      { status: 401 },
    );
  }

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
    if (!verifyServerAccountCurrentPassword(actor.id, currentPassword)) {
      return NextResponse.json(
        { ok: false, message: "The current password you entered is incorrect." },
        { status: 403 },
      );
    }

    const oldUsername = actor.username;
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

    if (!verifyServerAccountCurrentPassword(actor.id, currentPassword)) {
      return NextResponse.json(
        { ok: false, message: "The current password you entered is incorrect." },
        { status: 403 },
      );
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

    if (answer.trim() !== confirmAnswer.trim()) {
      return NextResponse.json(
        { ok: false, message: "Security answers do not match." },
        { status: 400 },
      );
    }

    if (!verifyServerAccountCurrentPassword(actor.id, currentPassword)) {
      return NextResponse.json(
        { ok: false, message: "The current password you entered is incorrect." },
        { status: 403 },
      );
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

    const { newPassword, confirmPassword, question, answer, confirmAnswer } = parsed.data;

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "New passwords do not match." },
        { status: 400 },
      );
    }

    if (answer.trim() !== confirmAnswer.trim()) {
      return NextResponse.json(
        { ok: false, message: "Security answers do not match." },
        { status: 400 },
      );
    }

    const result = completeInitialServerAccountSetup(
      actor.id,
      newPassword,
      question,
      answer,
    );

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
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
        completedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Initial account setup completed successfully.",
      profile: result.profile,
    });
  }

  return NextResponse.json({ ok: false, message: "Unsupported action." }, { status: 400 });
}

