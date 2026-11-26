import { NextResponse } from "next/server";

import { hashWithArgon2id } from "@/lib/auth/argon2id";
import { generateBackupKeySchema } from "@/lib/auth/auth-schemas";
import { generateBackupKey, normalizeBackupKey } from "@/lib/auth/password-policy";
import {
  generateServerAccountBackupKey,
  verifyServerAccountCurrentPassword,
} from "@/lib/auth/server-account-store";
import { getAuthenticatedActor } from "@/lib/auth/server-session";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/config/env";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

async function getDatabaseClient() {
  if (isSupabaseAdminConfigured()) {
    return createAdminSupabaseClient();
  }
  return createServerSupabaseClient();
}

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

  // First try in-memory account store
  const result = generateServerAccountBackupKey(actor.username || actor.email, parsed.data.currentPassword);

  if (result.ok) {
    if (isSupabaseConfigured()) {
      try {
        const db = await getDatabaseClient();
        const backupKeyHash = hashWithArgon2id(normalizeBackupKey(result.backupKey));
        await db
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

  // If user is only in Supabase Auth (not in memory store), verify via Supabase Auth
  if (isSupabaseConfigured() && actor.email) {
    try {
      const supabase = await createServerSupabaseClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: actor.email,
        password: parsed.data.currentPassword,
      });

      if (signInErr) {
        return NextResponse.json(
          { ok: false, message: "Current password verification failed." },
          { status: 403 },
        );
      }

      const rawKey = generateBackupKey();
      const generatedAt = new Date().toISOString();
      const backupKeyHash = hashWithArgon2id(normalizeBackupKey(rawKey));

      const db = await getDatabaseClient();
      await db
        .from("user_profiles")
        .update({
          backup_key_hash: backupKeyHash,
          backup_key_generated_at: generatedAt,
        })
        .eq("id", actor.id);

      return NextResponse.json({
        ok: true,
        backupKey: rawKey,
        generatedAt,
        message: "Emergency backup key generated. Save this key in a secure location. It will not be shown again.",
      });
    } catch {
      return NextResponse.json(
        { ok: false, message: "Unable to generate emergency backup key." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { ok: false, message: verifyServerAccountCurrentPassword(actor.id, parsed.data.currentPassword) ? result.message : "Current password verification failed." },
    { status: 400 },
  );
}
