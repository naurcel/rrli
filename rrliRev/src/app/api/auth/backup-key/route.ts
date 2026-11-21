import { NextResponse } from "next/server";

import { generateBackupKeySchema } from "@/lib/auth/auth-schemas";
import { generateServerAccountBackupKey } from "@/lib/auth/server-account-store";
import { getAuthenticatedActor } from "@/lib/auth/server-session";

export async function POST(request: Request) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHENTICATED", message: "You must be logged in to generate a backup key." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = generateBackupKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Current password is required." },
      { status: 400 },
    );
  }

  const result = generateServerAccountBackupKey(actor.username, parsed.data.currentPassword);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    backupKey: result.backupKey,
    generatedAt: result.generatedAt,
    message: "Emergency backup key generated. Save this key in a secure location. It will not be shown again.",
  });
}
