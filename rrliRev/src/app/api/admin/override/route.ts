import { NextResponse } from "next/server";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import { verifySuperadminOnly } from "@/lib/auth/server-session";

export async function POST(request: Request) {
  const auth = await verifySuperadminOnly();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const targetType = typeof rawBody?.targetType === "string" ? rawBody.targetType : "";
  const targetId = typeof rawBody?.targetId === "string" ? rawBody.targetId : "";
  const reason = typeof rawBody?.reason === "string" ? rawBody.reason.trim() : "";
  const overrideAction = typeof rawBody?.overrideAction === "string" ? rawBody.overrideAction : "status_override";
  const overrideData = typeof rawBody?.overrideData === "object" ? rawBody.overrideData : {};

  if (!targetType || !targetId) {
    return NextResponse.json(
      { ok: false, message: "Target entity type and entity ID are required." },
      { status: 400 },
    );
  }

  if (!reason || reason.length < 5) {
    return NextResponse.json(
      { ok: false, message: "A documented justification of at least 5 characters is required for executive overrides." },
      { status: 400 },
    );
  }

  const timestamp = new Date().toISOString();

  // Record immutable audit entry
  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: `executive.override.${overrideAction}`,
    entityType: targetType,
    entityId: targetId,
    summary: `[EXECUTIVE OVERRIDE] Superadmin @${auth.actor.username} executed ${overrideAction} on ${targetType} ${targetId}. Reason: ${reason}`,
    changes: {
      overrideAction,
      reason,
      executedBy: auth.actor.username,
      executedByRole: "superadmin",
      timestamp,
      overrideData,
      isAdministrativelyOverridden: true,
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Administrative override executed successfully for ${targetType} ${targetId}.`,
    overrideRecord: {
      targetType,
      targetId,
      overrideAction,
      reason,
      timestamp,
      executedBy: auth.actor.username,
      isAdministrativelyOverridden: true,
    },
  });
}
