import { NextResponse } from "next/server";

import { forgotPasswordSchema } from "@/lib/auth/auth-schemas";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const rawBody = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;

  const parsed = forgotPasswordSchema.safeParse({
    email: rawBody?.email ?? "",
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: firstIssue?.message ?? "Enter a valid email address.",
      },
      { status: 400 },
    );
  }

  const { email } = parsed.data;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createRouteHandlerSupabaseClient();
      const origin = new URL(request.url).origin;
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/login`,
      });
    } catch {
      // Avoid account enumeration while ensuring graceful response
    }
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an active RouteX account matches that email address, password reset instructions have been sent. If you need immediate access, contact a RouteX Admin.",
  });
}

