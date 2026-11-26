import { NextResponse } from "next/server";

import { clearAuditEntriesAsync, listAuditEntriesAsync } from "@/lib/audit/server-audit-store";
import { verifyServerPermission } from "@/lib/auth/server-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  let entries = await listAuditEntriesAsync();

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

  return NextResponse.json(
    { ok: true, entries },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}

export async function DELETE() {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  if (!auth.actor.isSuperadmin) {
    return NextResponse.json(
      { ok: false, code: "SUPERADMIN_AUTHORITY_REQUIRED", message: "Only the Superadmin (President) can purge audit logs." },
      { status: 403 },
    );
  }

  await clearAuditEntriesAsync();

  return NextResponse.json(
    { ok: true, message: "Audit log purged successfully." },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
