import { NextResponse } from "next/server";

import { listAuditEntries } from "@/lib/audit/server-audit-store";
import { verifyServerPermission } from "@/lib/auth/server-session";

export async function GET(request: Request) {
  const auth = await verifyServerPermission("users:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const action = searchParams.get("action");
  const search = searchParams.get("q")?.toLowerCase();

  let entries = listAuditEntries();

  if (entityType && entityType !== "all") {
    entries = entries.filter((e) => e.entityType.toLowerCase() === entityType.toLowerCase());
  }
  if (entityId) {
    entries = entries.filter((e) => e.entityId.toLowerCase() === entityId.toLowerCase());
  }
  if (action && action !== "all") {
    entries = entries.filter((e) => e.action.toLowerCase() === action.toLowerCase());
  }
  if (search) {
    entries = entries.filter((e) =>
      [e.actorEmail, e.action, e.entityType, e.entityId, e.summary].some((v) =>
        v.toLowerCase().includes(search),
      ),
    );
  }

  return NextResponse.json({ ok: true, entries });
}
