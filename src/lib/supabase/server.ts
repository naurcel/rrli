import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnvironment } from "@/lib/config/env";

/**
 * Creates a request-scoped, read/verification-oriented Supabase client.
 *
 * Cookie writes are intentionally not configured here. The response-aware
 * Next Proxy handles session refresh; authentication mutations that need to
 * set or clear cookies should use their own response-aware server boundary.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = getPublicEnvironment();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
    },
  });
}
