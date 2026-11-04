import assert from "node:assert/strict";
import test from "node:test";

import { hashWithArgon2id, verifyWithArgon2id } from "./argon2id.ts";
import {
  evaluatePasswordCriteria,
  PREDEFINED_SECURITY_QUESTIONS,
  validateUsernameFormat,
} from "./password-policy.ts";
import {
  authorizeServerAccountReset,
  completeInitialServerAccountSetup,
  createServerAccountProfile,
  findServerAccountById,
  findServerAccountByUsername,
  getServerAccountRecoveryState,
  resetServerAccountPasswordWithToken,
  updateServerAccountPassword,
  updateServerAccountUsername,
  verifyServerAccountCredentials,
  verifyServerAccountCurrentPassword,
  verifyServerAccountSecurityAnswer,
} from "./server-account-store.ts";

test("RFC 9106 Argon2id password and answer hashing", async () => {
  const secret = "SafePassword2026!";
  const hash = hashWithArgon2id(secret);

  assert.ok(hash.startsWith("$argon2id$v=19$m="), "Hash must adhere to RFC 9106 Argon2id string format");

  const validMatch = verifyWithArgon2id(secret, hash);
  assert.equal(validMatch, true, "Valid secret must verify against Argon2id hash");

  const invalidMatch = verifyWithArgon2id("WrongPassword2026!", hash);
  assert.equal(invalidMatch, false, "Invalid secret must fail verification");

  const caseSensitiveMatch = verifyWithArgon2id("safepassword2026!", hash);
  assert.equal(caseSensitiveMatch, false, "Passwords are strictly case-sensitive");
});

test("RouteX password criteria validation", () => {
  // 1. Min 8 characters
  const short = evaluatePasswordCriteria("Abc1");
  assert.equal(short.isValid, false);
  assert.equal(short.checks.minLength, false);

  // 2. Requires at least one letter
  const noLetter = evaluatePasswordCriteria("1234567890");
  assert.equal(noLetter.isValid, false);
  assert.equal(noLetter.checks.hasLetter, false);

  // 3. Requires at least one number
  const noNumber = evaluatePasswordCriteria("OnlyLettersHere");
  assert.equal(noNumber.isValid, false);
  assert.equal(noNumber.checks.hasNumber, false);

  // 4. Whitespace only rejected
  const allWhitespace = evaluatePasswordCriteria("        ");
  assert.equal(allWhitespace.isValid, false);
  assert.equal(allWhitespace.checks.notWhitespaceOnly, false);

  // 5. Common passwords rejected
  const common = evaluatePasswordCriteria("password123");
  assert.equal(common.isValid, false);
  assert.equal(common.checks.notCommon, false);

  // 6. Valid password with only letters and numbers (no special char required)
  const validSimple = evaluatePasswordCriteria("simplePass1");
  assert.equal(validSimple.isValid, true);
  assert.equal(validSimple.checks.minLength, true);
  assert.equal(validSimple.checks.hasLetter, true);
  assert.equal(validSimple.checks.hasNumber, true);
  assert.equal(validSimple.checks.notCommon, true);
  assert.equal(validSimple.checks.notWhitespaceOnly, true);

  // 7. Valid password with special characters
  const validWithSpecial = evaluatePasswordCriteria("SecurePass2026!#$");
  assert.equal(validWithSpecial.isValid, true);
});

test("Username format and case-insensitive normalization", () => {
  assert.equal(validateUsernameFormat("admin").isValid, true);
  assert.equal(validateUsernameFormat("john.doe").isValid, true);
  assert.equal(validateUsernameFormat("ops-lead_01").isValid, true);

  // Invalid: too short (< 3 chars)
  assert.equal(validateUsernameFormat("ab").isValid, false);

  // Invalid: too long (> 30 chars)
  assert.equal(validateUsernameFormat("a".repeat(31)).isValid, false);

  // Invalid characters
  assert.equal(validateUsernameFormat("user@domain").isValid, false);
  assert.equal(validateUsernameFormat("user name").isValid, false);
  assert.equal(validateUsernameFormat("user$pass").isValid, false);

  // Must start with alphanumeric
  assert.equal(validateUsernameFormat(".invalid").isValid, false);
  assert.equal(validateUsernameFormat("-invalid").isValid, false);
});

test("Case-insensitive username authentication with case-sensitive passwords", async () => {
  // Match with exact username
  const exact = await verifyServerAccountCredentials("admin", "Admin2026!");
  assert.equal(exact.ok, true, "Exact username matches");
  if (exact.ok) {
    assert.equal(exact.profile.username, "admin");
  }

  // Match with uppercase username
  const upper = await verifyServerAccountCredentials("ADMIN", "Admin2026!");
  assert.equal(upper.ok, true, "Uppercase username matches case-insensitively");
  if (upper.ok && exact.ok) {
    assert.equal(upper.profile.id, exact.profile.id);
  }

  // Match with surrounding whitespace trimmed
  const trimmed = await verifyServerAccountCredentials("  admin  ", "Admin2026!");
  assert.equal(trimmed.ok, true, "Whitespace is trimmed on username");

  // Wrong password rejected
  const wrongPassword = await verifyServerAccountCredentials("admin", "admin2026!");
  assert.equal(wrongPassword.ok, false, "Password is strictly case-sensitive");

  // Non-existent username rejected
  const nonExistent = await verifyServerAccountCredentials("ghost_user", "Admin2026!");
  assert.equal(nonExistent.ok, false, "Non-existent user rejected");
});

test("Provisioning account with temporary password requires first-login setup", async () => {
  const provisionUsername = `temp_${Date.now()}`;
  const temporaryPassword = "TempPassword2026!";

  const created = createServerAccountProfile({
    username: provisionUsername,
    fullName: "Temporary Test Staff",
    role: "operations",
    temporaryPassword,
  });

  assert.equal(created.ok, true);
  if (!created.ok) return;

  assert.equal(created.profile.mustChangePassword, true, "Account must require password change upon creation");
  assert.equal(created.profile.hasSecurityQuestion, false, "Security question not yet configured");

  // User logs in with temporary password
  const verified = await verifyServerAccountCredentials(provisionUsername, temporaryPassword);
  assert.equal(verified.ok, true, "Temporary password allows authentication");
  if (verified.ok) {
    assert.equal(verified.profile.mustChangePassword, true);
  }

  // User completes initial setup (changes password + sets security question)
  const newPermanentPassword = "PermanentPassword2026!";
  const securityAnswer = "St. Jude Academy";

  const setupRes = completeInitialServerAccountSetup(
    created.profile.id,
    newPermanentPassword,
    PREDEFINED_SECURITY_QUESTIONS[0],
    securityAnswer,
  );

  assert.equal(setupRes.ok, true);

  // Verify updated status
  const updatedAccount = findServerAccountById(created.profile.id);
  assert.ok(updatedAccount);
  assert.equal(updatedAccount?.mustChangePassword, false, "mustChangePassword cleared after initial setup");
  assert.equal(updatedAccount?.hasSecurityQuestion, true, "hasSecurityQuestion confirmed");

  // Old temporary password no longer works
  const oldLogin = await verifyServerAccountCredentials(provisionUsername, temporaryPassword);
  assert.equal(oldLogin.ok, false, "Old temporary password rejected after setup");

  // New permanent password works
  const newLogin = await verifyServerAccountCredentials(provisionUsername, newPermanentPassword);
  assert.equal(newLogin.ok, true, "New permanent password logs in successfully");
});

test("Normal password recovery using security question and answer", async () => {
  const recoveryUsername = `recover_${Date.now()}`;
  const initialPassword = "InitialPassword2026!";

  const created = createServerAccountProfile({
    username: recoveryUsername,
    fullName: "Recovery Test User",
    role: "secretary",
    temporaryPassword: initialPassword,
  });
  assert.ok(created.ok);
  if (!created.ok) return;

  // Complete setup with security question
  const question = "What was the name of your first pet?";
  const answer = "Bantay The Brave Dog";
  completeInitialServerAccountSetup(
    created.profile.id,
    "SecurePetPassword2026!",
    question,
    answer,
  );

  // Step 1: User queries forgot-password by username
  const userRecoveryState = getServerAccountRecoveryState(recoveryUsername);
  assert.equal(userRecoveryState.status, "security_question");
  assert.equal(userRecoveryState.question, question);

  // Step 2: Answer verification (case-sensitive)
  const wrongCaseAnswer = verifyServerAccountSecurityAnswer(recoveryUsername, "bantay the brave dog");
  assert.equal(wrongCaseAnswer.ok, false, "Security answer is case-sensitive");

  // Accidental leading and trailing whitespace is trimmed
  const correctTrimmedAnswer = verifyServerAccountSecurityAnswer(recoveryUsername, "  Bantay The Brave Dog  ");
  assert.equal(correctTrimmedAnswer.ok, true, "Leading/trailing whitespace trimmed consistently");
  assert.ok(correctTrimmedAnswer.resetToken, "Returns single-use reset token");

  // Step 3: Reset password with token
  const brandNewPassword = "RecoveredBrandNew2026!";
  const resetRes = resetServerAccountPasswordWithToken(
    recoveryUsername,
    correctTrimmedAnswer.resetToken!,
    brandNewPassword,
    "security_question",
  );
  assert.equal(resetRes.ok, true);

  // Token consumed: cannot reuse
  const reuseRes = resetServerAccountPasswordWithToken(
    recoveryUsername,
    correctTrimmedAnswer.resetToken!,
    "AnotherPassword2026!",
    "security_question",
  );
  assert.equal(reuseRes.ok, false, "Reset token is single-use and cannot be reused");

  // User can now log in with brand new password
  const brandNewLogin = await verifyServerAccountCredentials(recoveryUsername, brandNewPassword);
  assert.equal(brandNewLogin.ok, true, "User logs in with recovered password");
});

test("Admin-assisted password recovery workflow", async () => {
  const adminAssistedUsername = `admin_assist_${Date.now()}`;
  const initialPassword = "AdminAssistInitial2026!";

  const created = createServerAccountProfile({
    username: adminAssistedUsername,
    fullName: "Assisted User",
    role: "finance",
    temporaryPassword: initialPassword,
  });
  assert.ok(created.ok);
  if (!created.ok) return;

  // Admin authorizes password recovery
  const authRes = authorizeServerAccountReset(created.profile.id, "admin");
  assert.equal(authRes.ok, true);

  // Check user recovery state: detects Admin-authorized recovery
  const recoveryState = getServerAccountRecoveryState(adminAssistedUsername);
  assert.equal(recoveryState.status, "admin_authorized");
  assert.ok(recoveryState.recoveryToken, "Generates recovery token without asking security question");

  // User resets password directly without security question
  const freshPassword = "FreshAssistedPassword2026!";
  const resetRes = resetServerAccountPasswordWithToken(
    adminAssistedUsername,
    recoveryState.recoveryToken!,
    freshPassword,
    "admin",
  );
  assert.equal(resetRes.ok, true);

  // Authorization token is consumed
  const postResetState = getServerAccountRecoveryState(adminAssistedUsername);
  assert.notEqual(postResetState.status, "admin_authorized", "Recovery authorization consumed after reset");

  // User can log in with new password
  const loginRes = await verifyServerAccountCredentials(adminAssistedUsername, freshPassword);
  assert.equal(loginRes.ok, true, "User successfully logs in after Admin-authorized reset");
});

test("Username self-management under Account Settings", async () => {
  const user = findServerAccountByUsername("hr");
  assert.ok(user);
  if (!user) return;

  const currentPassword = "Hr2026!";

  // 1. Valid username change
  const newUsername = `hr_updated_${Date.now()}`;
  const updateRes = updateServerAccountUsername(user.id, newUsername);
  assert.equal(updateRes.ok, true);

  // Verify username updated
  const updatedUser = findServerAccountById(user.id);
  assert.equal(updatedUser?.username, newUsername);
  assert.equal(updatedUser?.role, "hr", "Role must be preserved");

  // Verify login with new username
  const loginNew = await verifyServerAccountCredentials(newUsername, currentPassword);
  assert.equal(loginNew.ok, true, "Can log in with updated username");

  // 2. Reject duplicate username
  const duplicateRes = updateServerAccountUsername(user.id, "admin");
  assert.equal(duplicateRes.ok, false);
  assert.ok(duplicateRes.message.includes("already taken"));

  // Restore username back to hr
  updateServerAccountUsername(user.id, "hr");
});

test("Password self-management under Account Settings", async () => {
  const user = findServerAccountByUsername("secretary");
  assert.ok(user);
  if (!user) return;

  const currentPassword = "Secretary2026!";
  const newPassword = "UpdatedSecPassword2026!";

  // Verify current password check
  assert.equal(verifyServerAccountCurrentPassword(user.id, "WrongPassword123!"), false);
  assert.equal(verifyServerAccountCurrentPassword(user.id, currentPassword), true);

  // Reject invalid new password (no numbers)
  const invalidRes = updateServerAccountPassword(user.id, "NoNumbersHere");
  assert.equal(invalidRes.ok, false);

  // Successful password change
  const successRes = updateServerAccountPassword(user.id, newPassword);
  assert.equal(successRes.ok, true);

  // Verify new password logs in
  const newLogin = await verifyServerAccountCredentials("secretary", newPassword);
  assert.equal(newLogin.ok, true);

  // Restore password
  updateServerAccountPassword(user.id, currentPassword);
});
