import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupabaseConfigured,
  parsePublicEnvironment,
} from "./env.ts";

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
};

test("parsePublicEnvironment maps a valid public configuration", () => {
  assert.deepEqual(parsePublicEnvironment(validEnvironment), {
    supabaseUrl: validEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      validEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
});

test("parsePublicEnvironment rejects incomplete configuration without echoing values", () => {
  assert.throws(
    () =>
      parsePublicEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_URL/);
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
      assert.doesNotMatch(error.message, /not-a-url/);
      return true;
    },
  );
});

test("isSupabaseConfigured reports configuration readiness", () => {
  assert.equal(isSupabaseConfigured(validEnvironment), true);
  assert.equal(isSupabaseConfigured({}), false);
});
