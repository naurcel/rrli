import assert from "node:assert/strict";
import test from "node:test";

import {
  getLoginRedirectUrl,
  isPublicRoute,
  sanitizeReturnPath,
} from "./route-policy.ts";

test("only the login route is public", () => {
  assert.equal(isPublicRoute("/login"), true);
  assert.equal(isPublicRoute("/"), false);
  assert.equal(isPublicRoute("/fleet"), false);
});

test("login redirect preserves an internal return path", () => {
  const redirect = getLoginRedirectUrl(
    "https://routex.example/fleet?status=active",
  );

  assert.equal(
    redirect.toString(),
    "https://routex.example/login?next=%2Ffleet%3Fstatus%3Dactive",
  );
});

test("return paths reject external, protocol-relative, and login destinations", () => {
  assert.equal(sanitizeReturnPath("/reports?period=month"), "/reports?period=month");
  assert.equal(sanitizeReturnPath("/deliveries"), "/deliveries");
  assert.equal(sanitizeReturnPath("/"), "/dashboard");
  assert.equal(sanitizeReturnPath("https://attacker.example"), "/dashboard");
  assert.equal(sanitizeReturnPath("//attacker.example"), "/dashboard");
  assert.equal(sanitizeReturnPath("/login"), "/dashboard");
});
