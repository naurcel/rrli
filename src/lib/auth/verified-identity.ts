import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type VerifiedIdentity = {
  userId: string;
  email?: string;
};

export async function getVerifiedIdentity(): Promise<VerifiedIdentity | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || typeof data?.claims.sub !== "string") {
    return null;
  }

  const email = data.claims.email;

  return {
    userId: data.claims.sub,
    ...(typeof email === "string" ? { email } : {}),
  };
}

export async function requireVerifiedIdentity(): Promise<VerifiedIdentity> {
  const identity = await getVerifiedIdentity();

  if (!identity) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "You must sign in to continue.",
      401,
    );
  }

  return identity;
}
