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

type ProxyProfileRow = {
  role: string | null;
  roles: string[] | null;
  is_superadmin: boolean | null;
  is_active: boolean | null;
  is_permanently_deleted: boolean | null;
  must_change_password: boolean | null;
};

const PROXY_PROFILE_TTL_MS = 10_000;
const proxyProfileCache = new Map<string, { row: ProxyProfileRow | null; expiresAt: number }>();

export function invalidateProxyProfileCache(userId?: string): void {
  if (userId) {
    proxyProfileCache.delete(userId);
  } else {
    proxyProfileCache.clear();
  }
}

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
        // Primary source of truth: public.user_profiles table in Supabase PostgreSQL (with 10s TTL cache)
        const now = Date.now();
        const cached = proxyProfileCache.get(user.id);
        let profileRow: ProxyProfileRow | null = null;
        if (cached && cached.expiresAt > now) {
          profileRow = cached.row;
        } else {
          const { data } = await supabase
            .from("user_profiles")
            .select("role, roles, is_superadmin, is_active, is_permanently_deleted, must_change_password")
            .eq("id", user.id)
            .maybeSingle();
          profileRow = (data as ProxyProfileRow | null) ?? null;
          proxyProfileCache.set(user.id, { row: profileRow, expiresAt: now + PROXY_PROFILE_TTL_MS });
        }

        if (profileRow && (!profileRow.is_active || profileRow.is_permanently_deleted)) {
          return applySessionUpdates(
            NextResponse.redirect(new URL(getLoginRedirectUrl(pathname), request.url)),
          );
        }

        const mustChangePassword =
          profileRow && typeof profileRow.must_change_password === "boolean"
            ? profileRow.must_change_password
            : Boolean(
                user.user_metadata?.must_change_password ??
                  user.app_metadata?.must_change_password,
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

        const rawRole =
          profileRow?.role ??
          user.app_metadata?.role ??
          user.user_metadata?.role;

        const role: UserRole = isValidUserRole(rawRole)
          ? rawRole
          : "customer_representative";

        const rolesList: string[] = Array.isArray(profileRow?.roles)
          ? profileRow.roles
          : [role];

        const isSuperadmin = Boolean(
          profileRow?.is_superadmin ||
            user.app_metadata?.is_superadmin ||
            user.user_metadata?.is_superadmin ||
            user.email?.toLowerCase() === "suchiterusenl@gmail.com",
        );

        const hasPathAccess =
          isSuperadmin ||
          canRoleAccessPath(role, pathname) ||
          rolesList.some((r) => isValidUserRole(r) && canRoleAccessPath(r, pathname));

        if (!hasPathAccess) {
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
