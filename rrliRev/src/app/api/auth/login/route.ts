import { NextResponse } from "next/server";

import { signInSchema } from "@/lib/auth/auth-schemas";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limiter";
import { getRoleMetadata, isValidUserRole, type UserRole } from "@/lib/auth/rbac";
import { sanitizeReturnPath } from "@/lib/auth/route-policy";
import { getAuthenticatedActor } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const rawBody = (await request.json().catch(() => null)) as {
    email?: unknown;
    username?: unknown;
    password?: unknown;
    rememberMe?: unknown;
    next?: unknown;
  } | null;

  // Accept email as primary identifier. If legacy username is passed, ensure it is treated cleanly.
  const emailInput =
    typeof rawBody?.email === "string"
      ? rawBody.email.trim()
      : typeof rawBody?.username === "string"
        ? rawBody.username.trim()
        : "";

  const parsed = signInSchema.safeParse({
    email: emailInput,
    password: rawBody?.password ?? "",
    rememberMe: Boolean(rawBody?.rememberMe),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: firstIssue?.message ?? "Enter a valid email address and password.",
      },
      { status: 400 },
    );
  }

  const { email, password, rememberMe } = parsed.data;
  const requestedNext = typeof rawBody?.next === "string" ? rawBody.next : null;
  const normalizedKey = `login:${email.toLowerCase()}`;

  // Rate Limiting: 5 attempts per 5 minutes to prevent brute-force attacks
  const rateLimit = checkRateLimit(normalizedKey, 5, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: `Too many failed login attempts. Please try again in ${rateLimit.retryAfterSec ?? 300} seconds.`,
      },
      { status: 429 },
    );
  }

  // Supabase Auth is the SOLE authentication provider. Fail securely if not configured.
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: "AUTH_SERVICE_UNAVAILABLE",
        message: "RouteX authentication service is currently unavailable. Please contact the system administrator.",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = await createRouteHandlerSupabaseClient({ rememberMe });

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_CREDENTIALS",
          message: "The email or password you entered is incorrect.",
        },
        { status: 401 },
      );
    }

    // Verify account active status and profile in RouteX user_profiles table
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, email, username, full_name, role, roles, is_active, must_change_password, security_question, security_answer_hash, is_superadmin, designation, is_permanently_deleted")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      // Check admin app_metadata fallback if profile table query fails
      const appMeta = authData.user.app_metadata;
      if (appMeta?.is_active === false) {
        await supabase.auth.signOut();
        return NextResponse.json(
          {
            ok: false,
            code: "ACCOUNT_INACTIVE",
            message: "This RouteX account has been deactivated. Contact an Administrator for assistance.",
          },
          { status: 403 },
        );
      }
    } else {
      if (!profile.is_active || profile.is_permanently_deleted) {
        await supabase.auth.signOut();
        return NextResponse.json(
          {
            ok: false,
            code: "ACCOUNT_INACTIVE",
            message: "This RouteX account has been deactivated. Contact an Administrator for assistance.",
          },
          { status: 403 },
        );
      }
    }

    resetRateLimit(normalizedKey);

    const actor = await getAuthenticatedActor();
    if (!actor) {
      return NextResponse.json(
        {
          ok: false,
          code: "SESSION_RESOLUTION_FAILED",
          message: "Failed to establish a valid RouteX session.",
        },
        { status: 500 },
      );
    }

    const defaultRole = actor.role || "customer_representative";
    const redirectTo = actor.mustChangePassword
      ? "/initial-setup"
      : sanitizeReturnPath(requestedNext, defaultRole);

    return NextResponse.json({
      ok: true,
      actor: {
        id: actor.id,
        username: actor.username,
        email: actor.email,
        fullName: actor.fullName,
        role: actor.role,
        roles: actor.roles,
        roleLabel: actor.roleLabel,
        accessLevel: actor.accessLevel,
        accessLevelLabel: actor.accessLevelLabel,
        mustChangePassword: actor.mustChangePassword,
        hasSecurityQuestion: actor.hasSecurityQuestion,
      },
      redirectTo,
    });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Internal authentication error";
    return NextResponse.json(
      {
        ok: false,
        code: "AUTH_ERROR",
        message: errMessage,
      },
      { status: 500 },
    );
  }
}
