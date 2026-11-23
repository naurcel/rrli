import { NextResponse } from "next/server";

import { signInSchema } from "@/lib/auth/auth-schemas";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limiter";
import { getRoleMetadata, isValidUserRole, type UserRole } from "@/lib/auth/rbac";
import { sanitizeReturnPath } from "@/lib/auth/route-policy";
import { verifyServerAccountCredentials } from "@/lib/auth/server-account-store";
import { getAuthenticatedActor } from "@/lib/auth/server-session";
import {
  createSignedSessionToken,
  getSessionCookieOptions,
  VERIFIED_SESSION_COOKIE,
} from "@/lib/auth/session-token";
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

  // Accept email or username
  const identifierInput =
    typeof rawBody?.email === "string" && rawBody.email.trim()
      ? rawBody.email.trim()
      : typeof rawBody?.username === "string"
        ? rawBody.username.trim()
        : "";

  const parsed = signInSchema.safeParse({
    email: identifierInput,
    username: identifierInput,
    password: rawBody?.password ?? "",
    rememberMe: Boolean(rawBody?.rememberMe),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: firstIssue?.message ?? "Enter a valid email address or username and password.",
      },
      { status: 400 },
    );
  }

  const { email, password, rememberMe } = parsed.data;
  const identifier = email || parsed.data.username || identifierInput;
  const requestedNext = typeof rawBody?.next === "string" ? rawBody.next : null;
  const normalizedKey = `login:${identifier.toLowerCase()}`;

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

  // 1. If Supabase is configured, authenticate through Supabase Auth
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createRouteHandlerSupabaseClient({ rememberMe });

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      });

      if (!authError && authData.user) {
        // Verify account active status and profile in RouteX user_profiles table
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("id, email, username, full_name, role, roles, is_active, must_change_password, security_question, security_answer_hash, is_superadmin, designation, is_permanently_deleted")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (profileError || !profile) {
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
        if (actor) {
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
        }
      }
    } catch {
      // Supabase call failed, fall through to local credentials
    }
  }

  // 2. Local account store verification (for local development or offline test accounts)
  const credCheck = verifyServerAccountCredentials(identifier, password);
  if (!credCheck.ok) {
    if (credCheck.reason === "inactive_account") {
      return NextResponse.json(
        {
          ok: false,
          code: "ACCOUNT_INACTIVE",
          message: "This RouteX account has been deactivated. Contact an Administrator for assistance.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "The email/username or password you entered is incorrect.",
      },
      { status: 401 },
    );
  }

  resetRateLimit(normalizedKey);

  const token = createSignedSessionToken({
    userId: credCheck.profile.id,
    rememberMe,
  });

  const defaultRole = credCheck.profile.role || "customer_representative";
  const redirectTo = credCheck.profile.mustChangePassword
    ? "/initial-setup"
    : sanitizeReturnPath(requestedNext, defaultRole);

  const meta = getRoleMetadata(credCheck.profile.role);
  const userRoles =
    credCheck.profile.departments && credCheck.profile.departments.length > 0
      ? credCheck.profile.departments
      : [credCheck.profile.role];

  const response = NextResponse.json({
    ok: true,
    actor: {
      id: credCheck.profile.id,
      username: credCheck.profile.username,
      email: credCheck.profile.email,
      fullName: credCheck.profile.fullName,
      role: credCheck.profile.role,
      roles: userRoles,
      roleLabel: credCheck.profile.isSuperadmin ? "Superadmin" : meta.label,
      accessLevel: credCheck.profile.isSuperadmin ? "admin" : meta.accessLevel,
      accessLevelLabel: credCheck.profile.isSuperadmin ? "Full Access" : meta.accessLevelLabel,
      mustChangePassword: credCheck.profile.mustChangePassword,
      hasSecurityQuestion: credCheck.profile.hasSecurityQuestion,
    },
    redirectTo,
  });

  response.cookies.set(VERIFIED_SESSION_COOKIE, token, getSessionCookieOptions(rememberMe));
  return response;
}
