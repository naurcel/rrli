import { NextResponse } from "next/server";

import {
  getSessionCookieOptions,
  VERIFIED_SESSION_COOKIE,
} from "@/lib/auth/session-token";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createRouteHandlerSupabaseClient();
      await supabase.auth.signOut();
    } catch {
      // Proceed to clear local session cookie regardless
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(VERIFIED_SESSION_COOKIE, "", {
    ...getSessionCookieOptions(false),
    maxAge: 0,
  });

  return response;
}

