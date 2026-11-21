import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSecurityAnswer, validateUsernameFormat } from "./password-policy.ts";
import { checkRateLimit, resetRateLimit } from "./rate-limiter.ts";
import {
  findServerAccountByUsername,
  updateServerAccountProfile,
  verifyServerAccountCredentials,
  verifyServerAccountSecurityAnswer,
} from "./server-account-store.ts";

test("Security Adversarial: Rate limiter enforces 5-attempt threshold and locks out caller on 6th attempt", () => {
  const testKey = `test-adversarial-${Date.now()}`;
  resetRateLimit(testKey);

  // First 5 attempts: allowed
  for (let i = 1; i <= 5; i++) {
    const res = checkRateLimit(testKey, 5, 60000, 60000);
    assert.equal(res.allowed, true, `Attempt ${i} should be allowed`);
  }

  // 6th attempt: exceeds maxAttempts (5) and triggers lockout
  const sixth = checkRateLimit(testKey, 5, 60000, 60000);
  assert.equal(sixth.allowed, false, "6th attempt beyond threshold must be rejected");
  assert.ok(sixth.retryAfterSec && sixth.retryAfterSec > 0, "Must return retryAfterSec lockout duration");

  // Subsequent attempt while locked out: strictly rejected
  const seventh = checkRateLimit(testKey, 5, 60000, 60000);
  assert.equal(seventh.allowed, false, "Subsequent attempt while locked out must be blocked");
  assert.equal(seventh.remaining, 0);

  resetRateLimit(testKey);
});

test("Security Adversarial: Deactivated user accounts are rejected upon credential verification", () => {
  const testUser = findServerAccountByUsername("operations");
  assert.ok(testUser, "operations must exist");

  // Deactivate account
  const deactRes = updateServerAccountProfile({
    userId: testUser.id,
    isActive: false,
  });
  assert.ok(deactRes.ok);

  // Credential verification must fail with deactivation error
  const credCheck = verifyServerAccountCredentials("operations", "Operations@2026!");
  assert.equal(credCheck.ok, false);
  if (!credCheck.ok) {
    assert.equal(credCheck.reason, "inactive_account");
  }

  // Restore account active status
  updateServerAccountProfile({
    userId: testUser.id,
    isActive: true,
  });
});

test("Security Adversarial: Case normalization prevents spoofing and enumeration across usernames and security answers", () => {
  // Username normalization
  const u1 = validateUsernameFormat("  pReSiDeNt  ");
  assert.equal(u1.isValid, true);
  assert.equal(u1.normalized, "president");

  // Security answer normalization: trims leading/trailing whitespace and lowercases
  const a1 = normalizeSecurityAnswer("  First Dog Spot  ");
  const a2 = normalizeSecurityAnswer("first dog spot");
  assert.equal(a1, a2, "Security answer normalization must trim and lowercase");

  // Security answer mismatch
  const verifyWrong = verifyServerAccountSecurityAnswer("president", "Wrong Answer That Does Not Match");
  assert.equal(verifyWrong.ok, false);
});
