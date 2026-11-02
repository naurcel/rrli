import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

import { getPublicEnvironment } from "@/lib/config/env";

export const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Request-scoped server Supabase client for Server Components and read verification.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = getPublicEnvironment();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot mutate cookies directly during render;
          // proxy.ts and route handlers refresh and persist cookies.
        }
      },
    },
  });
}

/**
 * Response-aware server Supabase client for Route Handlers (/api/auth/*)
 * that need to write or clear session cookies with an explicit Remember-Me policy.
 */
export async function createRouteHandlerSupabaseClient(options?: {
  rememberMe?: boolean;
}) {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = getPublicEnvironment();
  const rememberMe = options?.rememberMe ?? true;

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
          const adjustedOptions = {
            ...cookieOptions,
            httpOnly: cookieOptions?.httpOnly ?? true,
            sameSite: cookieOptions?.sameSite ?? ("lax" as const),
            secure: process.env.NODE_ENV === "production",
            path: cookieOptions?.path ?? "/",
          };

          if (!rememberMe && value) {
            delete adjustedOptions.maxAge;
            delete adjustedOptions.expires;
          } else if (rememberMe && value && !adjustedOptions.maxAge) {
            adjustedOptions.maxAge = REMEMBER_ME_MAX_AGE_SECONDS;
          }

          cookieStore.set(name, value, adjustedOptions);
        });
      },
    },
  });
}

/**
 * Proxy-scoped Supabase client that refreshes session tokens and forwards updated cookies.
 */
export function createProxySupabaseClient(
  request: NextRequest,
  onResponseUpdate: (updater: (response: NextResponse) => NextResponse) => void,
) {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnvironment();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        onResponseUpdate((response) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
          return response;
        });
      },
    },
  });
}

