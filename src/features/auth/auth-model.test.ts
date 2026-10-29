import assert from "node:assert/strict";
import test from "node:test";

import { getAuthenticationMode, signInSchema } from "./auth-model.ts";

test("signInSchema accepts a valid email and non-empty password", () => {
  const result = signInSchema.safeParse({
    email: "staff@example.com",
    password: "not-validated-as-a-business-rule",
  });

  assert.equal(result.success, true);
});

test("signInSchema rejects malformed or empty credentials", () => {
  assert.equal(
    signInSchema.safeParse({ email: "not-an-email", password: "" }).success,
    false,
  );
});

test("authentication mode is explicit and fails closed outside development", () => {
  assert.equal(
    getAuthenticationMode({
      isSupabaseConfigured: true,
      nodeEnvironment: "production",
    }),
    "supabase",
  );
  assert.equal(
    getAuthenticationMode({
      isSupabaseConfigured: false,
      nodeEnvironment: "development",
    }),
    "preview",
  );
  assert.equal(
    getAuthenticationMode({
      isSupabaseConfigured: false,
      nodeEnvironment: "production",
    }),
    "unavailable",
  );
});
