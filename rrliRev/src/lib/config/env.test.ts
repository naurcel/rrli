import assert from "node:assert/strict";
import test from "node:test";

import {
  isServiceRoleKey,
  isSupabaseConfigured,
  parsePublicEnvironment,
} from "./env.ts";

test("accepts valid public Supabase URL and publishable key", () => {
  const env = parsePublicEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: "https://exampleproject.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_1234567890",
  });

  assert.equal(env.supabaseUrl, "https://exampleproject.supabase.co");
  assert.equal(env.supabasePublishableKey, "sb_publishable_1234567890");
});

test("rejects placeholder values as unconfigured", () => {
  assert.equal(
    isSupabaseConfigured({
      NEXT_PUBLIC_SUPABASE_URL: "https://your-project-ref.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "your-publishable-key",
    }),
    false,
  );
});

test("detects and blocks service_role keys from being exposed in public environment variables", () => {
  assert.equal(isServiceRoleKey("sb_secret_abcdef12345"), true);

  // Construct a synthetic JWT with role: "service_role"
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  const fakeServiceRoleJwt = `${header}.${payload}.signature`;

  assert.equal(isServiceRoleKey(fakeServiceRoleJwt), true);
  assert.throws(
    () =>
      parsePublicEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://exampleproject.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fakeServiceRoleJwt,
      }),
    /SECURITY_VIOLATION/,
  );
});

