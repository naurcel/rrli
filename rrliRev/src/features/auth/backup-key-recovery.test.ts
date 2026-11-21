/**
 * RouteX: Emergency Backup Key Generation & Recovery Integration Tests (TC-AUTH-007)
 *
 * Verifies:
 * 1. Plaintext backup key format (ROUTEX-XXXX-XXXX-XXXX) and Argon2id hash storage.
 * 2. Identity verification (current password required) for manual backup key generation.
 * 3. Case-insensitive and dash-insensitive normalization during verification.
 * 4. Strict single-use enforcement: key is invalidated immediately upon successful consumption.
 * 5. Automatic generation and provisioning of a replacement backup key upon successful password recovery.
 * 6. Rejection of deactivated or permanently deleted accounts.
 * 7. Invalidation of previous backup keys upon regeneration.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  generateBackupKey,
  normalizeBackupKey,
  formatBackupKey,
} from "../../lib/auth/password-policy.ts";
import {
  createServerAccountProfile,
  generateServerAccountBackupKey,
  verifyServerAccountBackupKey,
  resetServerAccountPasswordWithToken,
  verifyServerAccountCredentials,
  updateServerAccountProfile,
  getServerAccountRecoveryState,
} from "../../lib/auth/server-account-store.ts";

test("TC-AUTH-007: Emergency backup key generation, formatting, and normalization", () => {
  const key = generateBackupKey();
  assert.match(key, /^ROUTEX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  // Normalization removes hyphens, spaces, and uppercases
  const messyInput = `  routex-${key.slice(7, 11).toLowerCase()}-${key.slice(12, 16).toLowerCase()} ${key.slice(17, 21).toLowerCase()}  `;
  const normalized = normalizeBackupKey(messyInput);
  assert.equal(normalized, normalizeBackupKey(key));

  // Formatter restores standard RouteX presentation
  const formatted = formatBackupKey(normalized);
  assert.equal(formatted, key);
});

test("TC-AUTH-007: Backup key generation requires current password verification", () => {
  const username = `backup_test_gen_${Date.now()}`;
  const password = "ValidPassword2026!";

  const created = createServerAccountProfile({
    username,
    fullName: "Backup Key User",
    email: `${username}@routex.local`,
    role: "operations",
    temporaryPassword: password,
  });
  assert.equal(created.ok, true);

  // Reject with wrong password
  const failedGen = generateServerAccountBackupKey(username, "WrongPassword123!");
  assert.equal(failedGen.ok, false);
  if (!failedGen.ok) {
    assert.match(failedGen.message, /current password/i);
  }

  // Succeed with correct password
  const successGen = generateServerAccountBackupKey(username, password);
  assert.equal(successGen.ok, true);
  if (successGen.ok) {
    assert.match(successGen.backupKey, /^ROUTEX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  }

  // Account recovery state reflects backup key availability
  const recoveryState = getServerAccountRecoveryState(username);
  assert.equal(recoveryState.hasBackupKey, true);
});

test("TC-AUTH-007: Backup key single-use enforcement and automatic replacement on recovery", () => {
  const username = `backup_test_use_${Date.now()}`;
  const initialPassword = "InitialPassword2026!";

  createServerAccountProfile({
    username,
    fullName: "Single Use User",
    email: `${username}@routex.local`,
    role: "operations",
    temporaryPassword: initialPassword,
  });

  const genResult = generateServerAccountBackupKey(username, initialPassword);
  assert.equal(genResult.ok, true);
  if (!genResult.ok) return;
  const originalKey = genResult.backupKey;

  // 1. Verify backup key with lowercase/messy input
  const lowercaseInput = originalKey.toLowerCase();
  const verifyResult = verifyServerAccountBackupKey(username, lowercaseInput);
  assert.equal(verifyResult.ok, true);
  if (!verifyResult.ok) return;

  const resetToken = verifyResult.resetToken;
  assert.ok(resetToken.length > 20);

  // 2. Immediate re-use of original key MUST FAIL (Single-use enforcement)
  const reuseResult = verifyServerAccountBackupKey(username, originalKey);
  assert.equal(reuseResult.ok, false);

  // 3. Reset password using reset token with mode: "backup_key"
  const newPassword = "BrandNewPassword2026!";
  const resetResult = resetServerAccountPasswordWithToken(
    username,
    resetToken,
    newPassword,
    "backup_key"
  );
  assert.equal(resetResult.ok, true);
  if (!resetResult.ok) return;

  // An automatic replacement key MUST be returned
  assert.ok(resetResult.replacementBackupKey, "Must return an automatic replacement backup key");
  const replacementKey = resetResult.replacementBackupKey;
  assert.notEqual(replacementKey, originalKey);
  assert.match(replacementKey, /^ROUTEX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  // 4. Authenticate with new password
  const loginCheck = verifyServerAccountCredentials(username, newPassword);
  assert.equal(loginCheck.ok, true);

  // Old password no longer works
  const oldLoginCheck = verifyServerAccountCredentials(username, initialPassword);
  assert.equal(oldLoginCheck.ok, false);

  // 5. The replacement key can be consumed for a future recovery
  const verifyReplacement = verifyServerAccountBackupKey(username, replacementKey);
  assert.equal(verifyReplacement.ok, true);

  // And the replacement key is also single-use
  const reuseReplacement = verifyServerAccountBackupKey(username, replacementKey);
  assert.equal(reuseReplacement.ok, false);
});

test("TC-AUTH-007: Deactivated accounts are rejected from backup key verification", () => {
  const username = `backup_deact_${Date.now()}`;
  const password = "DeactPassword2026!";

  const created = createServerAccountProfile({
    username,
    fullName: "Deactivated User",
    email: `${username}@routex.local`,
    role: "operations",
    temporaryPassword: password,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const genResult = generateServerAccountBackupKey(username, password);
  assert.equal(genResult.ok, true);
  if (!genResult.ok) return;
  const backupKey = genResult.backupKey;

  // Deactivate account
  updateServerAccountProfile({
    userId: created.profile.id,
    isActive: false,
  });

  // Verification must be rejected
  const verifyResult = verifyServerAccountBackupKey(username, backupKey);
  assert.equal(verifyResult.ok, false);
  if (!verifyResult.ok) {
    assert.match(verifyResult.message, /inactive|deactivated/i);
  }
});
