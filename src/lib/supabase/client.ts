"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnvironment } from "@/lib/config/env";

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnvironment();

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
