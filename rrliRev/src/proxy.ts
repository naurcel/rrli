import { NextResponse, type NextRequest } from "next/server";

import { findServerAccountById } from "@/lib/auth/server-account-store";
import {
  canRoleAccessPath,
  getLoginRedirectUrl,
  isPublicRoute,
} from "@/lib/auth/route-policy";
import {
  VERIFIED_SESSION_COOKIE,
  verifySignedSessionToken,
} from "@/lib/auth/session-token";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createProxySupabaseClient } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isSupabaseConfigured()) {
    let applySessionUpdates = (response: NextResponse) => response;

    const supabase = createProxySupabaseClient(request, (updater) => {
      const previous = applySessionUpdates;
      applySessionUpdates = (response) => updater(previous(response));
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    const isAuthenticated = !error && Boolean(user?.id);

    if (!isAuthenticated && !isPublicRoute(pathname)) {
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

      return applySessionUpdates(
        NextResponse.redirect(getLoginRedirectUrl(request.url)),
      );
    }

    if (isAuthenticated && pathname === "/login") {
      return applySessionUpdates(
        NextResponse.redirect(new URL("/dashboard", request.url)),
      );
    }

    return applySessionUpdates(NextResponse.next({ request }));
  }

  // Server-verified signed HttpOnly cookie verification
  const rawToken = request.cookies.get(VERIFIED_SESSION_COOKIE)?.value;
  const payload = verifySignedSessionToken(rawToken);
  const account = payload ? findServerAccountById(payload.sub) : null;
  const isAuthenticated = Boolean(account && account.isActive);

  if (!isAuthenticated && !isPublicRoute(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          ok: false,
          code: "UNAUTHENTICATED",
          message: "You must log in to access this resource.",
        },
        { status: 401 },
      );
    }

    const redirectResponse = NextResponse.redirect(getLoginRedirectUrl(request.url));
    if (rawToken) {
      redirectResponse.cookies.delete(VERIFIED_SESSION_COOKIE);
    }
    return redirectResponse;
  }

  if (isAuthenticated && account) {
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!canRoleAccessPath(account.role, pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            ok: false,
            code: "FORBIDDEN",
            message: `Access denied for role '${account.role}'.`,
          },
          { status: 403 },
        );
      }

      const deniedUrl = new URL("/dashboard", request.url);
      deniedUrl.searchParams.set("access", "restricted");
      return NextResponse.redirect(deniedUrl);
    }
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

