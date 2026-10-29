import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getAuthenticationMode } from "@/features/auth/auth-model";
import {
  getLoginRedirectUrl,
  isPublicRoute,
} from "@/lib/auth/route-policy";
import {
  getPublicEnvironment,
  isSupabaseConfigured,
} from "@/lib/config/env";

export async function proxy(request: NextRequest) {
  const authenticationMode = getAuthenticationMode({
    isSupabaseConfigured: isSupabaseConfigured(),
    nodeEnvironment: process.env.NODE_ENV,
  });

  if (authenticationMode === "preview") {
    return NextResponse.next({ request });
  }

  if (authenticationMode === "unavailable") {
    if (isPublicRoute(request.nextUrl.pathname)) {
      return NextResponse.next({ request });
    }

    const loginUrl = getLoginRedirectUrl(request.url);
    loginUrl.searchParams.set("configuration", "missing");
    return NextResponse.redirect(loginUrl);
  }

  const { supabaseUrl, supabasePublishableKey } = getPublicEnvironment();
  let applySessionUpdates = (response: NextResponse) => response;

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        const applyPreviousUpdates = applySessionUpdates;
        applySessionUpdates = (response) => {
          applyPreviousUpdates(response);
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
          return response;
        };
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && typeof data?.claims.sub === "string";
  const pathname = request.nextUrl.pathname;

  if (!isAuthenticated && !isPublicRoute(pathname)) {
    return applySessionUpdates(
      NextResponse.redirect(getLoginRedirectUrl(request.url)),
    );
  }

  if (isAuthenticated && isPublicRoute(pathname)) {
    return applySessionUpdates(
      NextResponse.redirect(new URL("/dashboard", request.url)),
    );
  }

  return applySessionUpdates(NextResponse.next({ request }));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
