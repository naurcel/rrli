import { NextResponse } from "next/server";

import { signInSchema } from "@/lib/auth/auth-schemas";
import { getRoleMetadata } from "@/lib/auth/rbac";
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
    password?: unknown;
    rememberMe?: unknown;
    next?: unknown;
  } | null;

  const parsed = signInSchema.safeParse({
    email: rawBody?.email ?? "",
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

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createRouteHandlerSupabaseClient({ rememberMe });
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            code: "INVALID_CREDENTIALS",
            message: "The email address or password you entered is incorrect.",
          },
          { status: 401 },
        );
      }

      const actor = await getAuthenticatedActor();
      if (!actor) {
        await supabase.auth.signOut();
        return NextResponse.json(
          {
            ok: false,
            code: "PROFILE_UNAUTHORIZED",
            message:
              "Your account does not have an active RouteX role profile assigned. Please contact an Administrator.",
          },
          { status: 403 },
        );
      }

      const redirectTo = sanitizeReturnPath(requestedNext, actor.role);

      return NextResponse.json({
        ok: true,
        actor: {
          id: actor.id,
          email: actor.email,
          fullName: actor.fullName,
          role: actor.role,
          roleLabel: actor.roleLabel,
          accessLevel: actor.accessLevel,
          accessLevelLabel: actor.accessLevelLabel,
        },
        redirectTo,
      });
    } catch {
      return NextResponse.json(
        {
          ok: false,
          code: "AUTH_SERVICE_ERROR",
          message: "Authentication could not be completed. Please try again.",
        },
        { status: 500 },
      );
    }
  }

  if (process.env.NODE_ENV === "production" && !isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: "PRODUCTION_AUTH_UNCONFIGURED",
        message:
          "Production authentication service is not configured. External Supabase connection is required.",
      },
      { status: 503 },
    );
  }

  // Server-verified authentication against server-side account registry (development/testing only)
  const verification = verifyServerAccountCredentials(email, password);

  if (!verification.ok) {
    if (verification.reason === "inactive_account") {
      return NextResponse.json(
        {
          ok: false,
          code: "ACCOUNT_INACTIVE",
          message:
            "This RouteX account has been deactivated. Contact an Administrator for assistance.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "The email address or password you entered is incorrect.",
      },
      { status: 401 },
    );
  }

  const { profile } = verification;
  const roleMeta = getRoleMetadata(profile.role);
  const redirectTo = sanitizeReturnPath(requestedNext, profile.role);
  const signedToken = createSignedSessionToken({
    userId: profile.id,
    rememberMe,
  });

  const response = NextResponse.json({
    ok: true,
    actor: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      roleLabel: roleMeta.label,
      accessLevel: roleMeta.accessLevel,
      accessLevelLabel: roleMeta.accessLevelLabel,
    },
    redirectTo,
  });

  response.cookies.set(
    VERIFIED_SESSION_COOKIE,
    signedToken,
    getSessionCookieOptions(rememberMe),
  );

  return response;
}

