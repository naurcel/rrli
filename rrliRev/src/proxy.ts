import { NextResponse, type NextRequest } from "next/server";

import { isValidUserRole, type UserRole } from "@/lib/auth/rbac";
import {
  canRoleAccessPath,
  getLoginRedirectUrl,
  isPublicRoute,
} from "@/lib/auth/route-policy";
import { findServerAccountById } from "@/lib/auth/server-account-store";
import {
  VERIFIED_SESSION_COOKIE,
  verifySignedSessionToken,
} from "@/lib/auth/session-token";
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

  let applySessionUpdates = (response: NextResponse) => response;

  // 1. If Supabase Auth is configured, check Supabase session
  if (isSupabaseConfigured()) {
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

      if (isAuthenticated && user) {
        const mustChangePassword = Boolean(
          user.user_metadata?.must_change_password ?? user.app_metadata?.must_change_password,
        );

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
      }
    } catch {
      // Supabase verification failed, fall through to check local signed cookie
    }
  }

  // 2. Check local signed HMAC session cookie
  const rawToken = request.cookies.get(VERIFIED_SESSION_COOKIE)?.value;
  const payload = verifySignedSessionToken(rawToken);
  const account = payload ? findServerAccountById(payload.sub) : null;
  const isLocallyAuthenticated = Boolean(account && account.isActive && !account.isPermanentlyDeleted);

  if (isLocallyAuthenticated && account) {
    if (account.mustChangePassword && pathname !== "/initial-setup" && !pathname.startsWith("/api/auth/")) {
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
      return applySessionUpdates(NextResponse.redirect(new URL("/initial-setup", request.url)));
    }

    if (pathname === "/login") {
      if (account.mustChangePassword) {
        return applySessionUpdates(NextResponse.redirect(new URL("/initial-setup", request.url)));
      }
      return applySessionUpdates(NextResponse.redirect(new URL("/dashboard", request.url)));
    }

    if (!account.isSuperadmin && !canRoleAccessPath(account.role, pathname)) {
      if (pathname.startsWith("/api/")) {
        return applySessionUpdates(
          NextResponse.json(
            {
              ok: false,
              code: "FORBIDDEN",
              message: `Access denied for role '${account.role}'.`,
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
  }

  // 3. User is unauthenticated:
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

  const redirectResponse = NextResponse.redirect(getLoginRedirectUrl(request.url));
  if (rawToken) {
    redirectResponse.cookies.delete(VERIFIED_SESSION_COOKIE);
  }
  return applySessionUpdates(redirectResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
