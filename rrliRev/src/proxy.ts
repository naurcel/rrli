import { NextResponse, type NextRequest } from "next/server";

import { isValidUserRole, type UserRole } from "@/lib/auth/rbac";
import {
  canRoleAccessPath,
  getLoginRedirectUrl,
  isPublicRoute,
} from "@/lib/auth/route-policy";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createProxySupabaseClient } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Static assets and internal next requests pass through directly
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg")
  ) {
    return NextResponse.next();
  }

  // Supabase Auth is the SOLE authentication provider. Fail securely if unconfigured.
  if (!isSupabaseConfigured()) {
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          ok: false,
          code: "AUTH_SERVICE_UNAVAILABLE",
          message: "RouteX authentication service is unavailable.",
        },
        { status: 503 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let applySessionUpdates = (response: NextResponse) => response;

  const supabase = createProxySupabaseClient(request, (updater) => {
    const previous = applySessionUpdates;
    applySessionUpdates = (response) => updater(previous(response));
  });

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    const isAuthenticated = !error && Boolean(user?.id);

    // If unauthenticated:
    if (!isAuthenticated || !user) {
      if (isPublicRoute(pathname)) {
        return applySessionUpdates(NextResponse.next({ request }));
      }

      if (pathname.startsWith("/api/")) {
        return applySessionUpdates(
          NextResponse.json(
            {
              ok: false,
              code: "UNAUTHENTICATED",
              message: "You must log in to access this resource.",
            },
            { status: 401 },
          ),
        );
      }

      return applySessionUpdates(NextResponse.redirect(getLoginRedirectUrl(request.url)));
    }

    // Authenticated user:
    // Determine mandatory password change status
    const mustChangePassword = Boolean(
      user.user_metadata?.must_change_password ?? user.app_metadata?.must_change_password,
    );

    // If user must change password, enforce redirect to /initial-setup
    if (
      mustChangePassword &&
      pathname !== "/initial-setup" &&
      !pathname.startsWith("/api/auth/")
    ) {
      if (pathname.startsWith("/api/")) {
        return applySessionUpdates(
          NextResponse.json(
            {
              ok: false,
              code: "PASSWORD_CHANGE_REQUIRED",
              message: "You must change your temporary password before accessing RouteX.",
            },
            { status: 403 },
          ),
        );
      }
      return applySessionUpdates(
        NextResponse.redirect(new URL("/initial-setup", request.url)),
      );
    }

    // If already on /login while authenticated, redirect to /dashboard
    if (pathname === "/login") {
      if (mustChangePassword) {
        return applySessionUpdates(
          NextResponse.redirect(new URL("/initial-setup", request.url)),
        );
      }
      return applySessionUpdates(
        NextResponse.redirect(new URL("/dashboard", request.url)),
      );
    }

    // Role-based route authorization
    const role: UserRole = isValidUserRole(user.app_metadata?.role)
      ? user.app_metadata.role
      : "customer_representative";

    const isSuperadmin = Boolean(user.app_metadata?.is_superadmin);

    if (!isSuperadmin && !canRoleAccessPath(role, pathname)) {
      if (pathname.startsWith("/api/")) {
        return applySessionUpdates(
          NextResponse.json(
            {
              ok: false,
              code: "FORBIDDEN",
              message: `Access denied for role '${role}'.`,
            },
            { status: 403 },
          ),
        );
      }

      const deniedUrl = new URL("/dashboard", request.url);
      deniedUrl.searchParams.set("access", "restricted");
      return applySessionUpdates(NextResponse.redirect(deniedUrl));
    }

    return applySessionUpdates(NextResponse.next({ request }));
  } catch {
    // Fail securely if Supabase check throws an exception
    if (isPublicRoute(pathname)) {
      return applySessionUpdates(NextResponse.next({ request }));
    }
    if (pathname.startsWith("/api/")) {
      return applySessionUpdates(
        NextResponse.json(
          {
            ok: false,
            code: "UNAUTHENTICATED",
            message: "Authentication verification failed.",
          },
          { status: 401 },
        ),
      );
    }
    return applySessionUpdates(NextResponse.redirect(getLoginRedirectUrl(request.url)));
  }
}
