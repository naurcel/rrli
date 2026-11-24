import { NextResponse } from "next/server";

import { hashWithArgon2id } from "@/lib/auth/argon2id";
import { generateBackupKeySchema } from "@/lib/auth/auth-schemas";
import { normalizeBackupKey } from "@/lib/auth/password-policy";
import { generateServerAccountBackupKey } from "@/lib/auth/server-account-store";
import { getAuthenticatedActor } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const result = generateServerAccountBackupKey(actor.username || actor.email, parsed.data.currentPassword);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const backupKeyHash = hashWithArgon2id(normalizeBackupKey(result.backupKey));
      await supabase
        .from("user_profiles")
        .update({
          backup_key_hash: backupKeyHash,
          backup_key_generated_at: result.generatedAt,
        })
        .eq("id", actor.id);
    } catch {
      // Fallback gracefully if Supabase table is unavailable
    }
  }

  return NextResponse.json({
    ok: true,
    backupKey: result.backupKey,
    generatedAt: result.generatedAt,
    message: "Emergency backup key generated. Save this key in a secure location. It will not be shown again.",
  });
}
