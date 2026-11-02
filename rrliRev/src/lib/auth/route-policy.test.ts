import assert from "node:assert/strict";
import test from "node:test";

import {
  canRoleAccessPath,
  getLoginRedirectUrl,
  isPublicRoute,
  sanitizeReturnPath,
} from "./route-policy.ts";

test("identifies public vs protected routes", () => {
  assert.equal(isPublicRoute("/login"), true);
  assert.equal(isPublicRoute("/api/auth/login"), true);
  assert.equal(isPublicRoute("/dashboard"), false);
  assert.equal(isPublicRoute("/deliveries"), false);
  assert.equal(isPublicRoute("/user-management"), false);
});

test("enforces role-based path access across Admin, Operations, and View-Only roles", () => {
  // User Management is Admin only
  assert.equal(canRoleAccessPath("admin", "/user-management"), true);
  assert.equal(canRoleAccessPath("operations", "/user-management"), false);
  assert.equal(canRoleAccessPath("finance", "/user-management"), false);

  // Excel import is Admin and Operations only
  assert.equal(canRoleAccessPath("admin", "/deliveries/import"), true);
  assert.equal(canRoleAccessPath("operations", "/deliveries/import"), true);
  assert.equal(canRoleAccessPath("finance", "/deliveries/import"), false);
  assert.equal(canRoleAccessPath("hr", "/deliveries/import"), false);
  assert.equal(canRoleAccessPath("secretary", "/deliveries/import"), false);
  assert.equal(canRoleAccessPath("customer_representative", "/deliveries/import"), false);

  // Read-only operational views are accessible to all authenticated roles
  assert.equal(canRoleAccessPath("finance", "/deliveries"), true);
  assert.equal(canRoleAccessPath("hr", "/truck-profitability"), true);
  assert.equal(canRoleAccessPath("secretary", "/pod-documents"), true);
  assert.equal(canRoleAccessPath("customer_representative", "/reports"), true);
});

test("sanitizes return paths and prevents open redirects or unauthorized route redirects", () => {
  assert.equal(sanitizeReturnPath("https://malicious.example.com/phish"), "/dashboard");
  assert.equal(sanitizeReturnPath("//malicious.example.com"), "/dashboard");
  assert.equal(sanitizeReturnPath("/login"), "/dashboard");
  assert.equal(sanitizeReturnPath("/deliveries?client=Puregold"), "/deliveries?client=Puregold");

  // Role-aware return path sanitization
  assert.equal(sanitizeReturnPath("/user-management", "admin"), "/user-management");
  assert.equal(sanitizeReturnPath("/user-management", "operations"), "/dashboard");
  assert.equal(sanitizeReturnPath("/deliveries/import", "finance"), "/dashboard");
});

test("builds login redirect URL with preserved next path", () => {
  const redirectUrl = getLoginRedirectUrl("http://localhost:3000/truck-profitability?plate=NGS");
  assert.equal(redirectUrl.pathname, "/login");
  assert.equal(redirectUrl.searchParams.get("next"), "/truck-profitability?plate=NGS");
});

