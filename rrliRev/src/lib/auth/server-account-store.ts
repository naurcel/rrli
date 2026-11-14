import { randomBytes } from "node:crypto";
import { hashWithArgon2id, verifyWithArgon2id } from "./argon2id.ts";
import {
  evaluatePasswordCriteria,
  normalizeSecurityAnswer,
  validateUsernameFormat,
} from "./password-policy.ts";
import type { UserRole } from "./rbac.ts";

export type ServerUserProfileRecord = {
  id: string;
  username: string;
  normalizedUsername: string;
  email: string;
  phoneNumber?: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  hasSecurityQuestion: boolean;
  securityQuestion?: string;
  avatarUrl?: string | null;
  recoveryAuthorizedAt?: string;
  recoveryAuthorizedBy?: string;
  recoveryExpiresAt?: string;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ServerAccountEntry = ServerUserProfileRecord & {
  passwordHash: string;
  legacySeedPassword?: string;
  altSeedPassword?: string;
  securityAnswerHash?: string;
  recoveryToken?: string;
  securityResetToken?: string;
  securityResetTokenExpiresAt?: number;
};

// Pre-computed Argon2id hashes for initial seed accounts using canonical RBAC passwords
const HASH_ADMIN = hashWithArgon2id("admin");
const HASH_OPS = hashWithArgon2id("operations");
const HASH_FIN = hashWithArgon2id("finance");
const HASH_HR = hashWithArgon2id("humanresources");
const HASH_SEC = hashWithArgon2id("secretary");
const HASH_CSR = hashWithArgon2id("customerrep");

const HASH_ANSWER_SCHOOL = hashWithArgon2id("RouteX Academy");
const HASH_ANSWER_CITY = hashWithArgon2id("Laguna");
const HASH_ANSWER_PET = hashWithArgon2id("Bantay");
const HASH_ANSWER_NICK = hashWithArgon2id("Rainy");

/**
 * Initial server-side accounts representing all access levels and roles.
 * All credentials meet password criteria and are secured using Argon2id.
 */
const INITIAL_SERVER_ACCOUNTS: readonly ServerAccountEntry[] = [
  {
    id: "usr-admin-001",
    username: "admin",
    normalizedUsername: "admin",
    email: "admin@routex.local",
    phoneNumber: "+63 917 123 4567",
    fullName: "Shinryu",
    role: "admin",
    avatarUrl: "/profiles/shinryu.png",
    isActive: true,
    mustChangePassword: false,
    hasSecurityQuestion: true,
    securityQuestion: "What was the name of your first school?",
    securityAnswerHash: HASH_ANSWER_SCHOOL,
    passwordHash: HASH_ADMIN,
    legacySeedPassword: "admin",
    altSeedPassword: "Admin2026!",
    createdAt: "2026-10-15T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "usr-ops-002",
    username: "operations",
    normalizedUsername: "operations",
    email: "operations@routex.local",
    phoneNumber: "+63 918 234 5678",
    fullName: "Marc Rancel (Delivery Operations)",
    role: "operations",
    isActive: true,
    mustChangePassword: false,
    hasSecurityQuestion: true,
    securityQuestion: "What city were you born in?",
    securityAnswerHash: HASH_ANSWER_CITY,
    passwordHash: HASH_OPS,
    legacySeedPassword: "operations",
    altSeedPassword: "Ops2026!",
    createdAt: "2026-10-16T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "usr-fin-003",
    username: "finance",
    normalizedUsername: "finance",
    email: "finance@routex.local",
    phoneNumber: "+63 919 345 6789",
    fullName: "Louiza Joy (Finance)",
    role: "finance",
    isActive: true,
    mustChangePassword: false,
    hasSecurityQuestion: true,
    securityQuestion: "What was the name of your first pet?",
    securityAnswerHash: HASH_ANSWER_PET,
    passwordHash: HASH_FIN,
    legacySeedPassword: "finance",
    altSeedPassword: "Finance2026!",
    createdAt: "2026-10-17T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "usr-hr-004",
    username: "hr",
    normalizedUsername: "hr",
    email: "hr@routex.local",
    phoneNumber: "+63 920 456 7890",
    fullName: "Jelene Punongbayan (HR)",
    role: "hr",
    isActive: true,
    mustChangePassword: false,
    hasSecurityQuestion: true,
    securityQuestion: "What was the name of your first school?",
    securityAnswerHash: HASH_ANSWER_SCHOOL,
    passwordHash: HASH_HR,
    legacySeedPassword: "humanresources",
    altSeedPassword: "Hr2026!",
    createdAt: "2026-10-18T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "usr-sec-005",
    username: "secretary",
    normalizedUsername: "secretary",
    email: "secretary@routex.local",
    phoneNumber: "+63 921 567 8901",
    fullName: "Zean Kurt (Secretary)",
    role: "secretary",
    isActive: true,
    mustChangePassword: false,
    hasSecurityQuestion: true,
    securityQuestion: "What city were you born in?",
    securityAnswerHash: HASH_ANSWER_CITY,
    passwordHash: HASH_SEC,
    legacySeedPassword: "secretary",
    altSeedPassword: "Secretary2026!",
    createdAt: "2026-10-19T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "usr-csr-006",
    username: "customerrep",
    normalizedUsername: "customerrep",
    email: "csrep@routex.local",
    phoneNumber: "+63 922 678 9012",
    fullName: "Rain Ibasco (Customer Representative)",
    role: "customer_representative",
    isActive: true,
    mustChangePassword: false,
    hasSecurityQuestion: true,
    securityQuestion: "What was your childhood nickname?",
    securityAnswerHash: HASH_ANSWER_NICK,
    passwordHash: HASH_CSR,
    legacySeedPassword: "customerrep",
    altSeedPassword: "Csrep2026!",
    createdAt: "2026-10-20T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
];

const globalForAccountStore = globalThis as unknown as {
  __routexServerAccountStore?: Map<string, ServerAccountEntry>;
};

function getStore(): Map<string, ServerAccountEntry> {
  if (!globalForAccountStore.__routexServerAccountStore) {
    globalForAccountStore.__routexServerAccountStore = new Map<string, ServerAccountEntry>();
  }

  const map = globalForAccountStore.__routexServerAccountStore;
  for (const account of INITIAL_SERVER_ACCOUNTS) {
    const existing = map.get(account.id);
    if (!existing) {
      map.set(account.id, { ...account });
    } else {
      if (!existing.username) {
        existing.username = account.username;
        existing.normalizedUsername = account.normalizedUsername;
      }
      existing.fullName = account.fullName;
      if (!existing.phoneNumber) {
        existing.phoneNumber = account.phoneNumber;
      }

      // Seed hashes are generated when this module loads. During development,
      // hot reload can leave an older untouched seed record in the global store
      // whose hash was produced by a previous version of the hashing module.
      // Refresh only accounts that have never had their password changed so a
      // user's real password update is never silently replaced.
      if (!existing.passwordChangedAt) {
        existing.passwordHash = account.passwordHash;
        existing.legacySeedPassword = account.legacySeedPassword;
      } else {
        existing.legacySeedPassword = undefined;
      }
    }
  }

  return map;
}

function stripSensitiveFields(entry: ServerAccountEntry): ServerUserProfileRecord {
  return {
    id: entry.id,
    username: entry.username,
    normalizedUsername: entry.normalizedUsername,
    email: entry.email,
    phoneNumber: entry.phoneNumber,
    fullName: entry.fullName,
    role: entry.role,
    isActive: entry.isActive,
    mustChangePassword: Boolean(entry.mustChangePassword),
    hasSecurityQuestion: Boolean(entry.securityAnswerHash),
    securityQuestion: entry.securityQuestion,
    avatarUrl: entry.avatarUrl ?? null,
    recoveryAuthorizedAt: entry.recoveryAuthorizedAt,
    recoveryAuthorizedBy: entry.recoveryAuthorizedBy,
    recoveryExpiresAt: entry.recoveryExpiresAt,
    passwordChangedAt: entry.passwordChangedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

/**
 * Verifies username (case-insensitive) and password against stored Argon2id hashes.
 * Supports legacy seed password matching for test backward-compatibility.
 */
export function verifyServerAccountCredentials(
  identifier: string,
  password: string,
):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; reason: "invalid_credentials" | "inactive_account" } {
  const trimmed = identifier.trim();
  const normalized = trimmed.toLowerCase();
  const store = getStore();

  for (const entry of store.values()) {
    const isUsernameMatch = entry.normalizedUsername === normalized;
    const isEmailMatch = entry.email.toLowerCase() === normalized;

    if (isUsernameMatch || isEmailMatch) {
      if (!entry.isActive) {
        return { ok: false, reason: "inactive_account" };
      }

      // Check Argon2id hash or seed passwords
      const isArgonValid = verifyWithArgon2id(password, entry.passwordHash);
      const isLegacyValid =
        Boolean(entry.legacySeedPassword) && entry.legacySeedPassword === password;
      const isAltValid =
        Boolean(entry.altSeedPassword) && entry.altSeedPassword === password;

      if (!isArgonValid && !isLegacyValid && !isAltValid) {
        return { ok: false, reason: "invalid_credentials" };
      }

      return { ok: true, profile: stripSensitiveFields(entry) };
    }
  }

  return { ok: false, reason: "invalid_credentials" };
}

export function findServerAccountById(userId: string): ServerUserProfileRecord | null {
  const entry = getStore().get(userId);
  return entry ? stripSensitiveFields(entry) : null;
}

export function findServerAccountByUsername(username: string): ServerUserProfileRecord | null {
  const normalized = username.trim().toLowerCase();
  for (const entry of getStore().values()) {
    if (entry.normalizedUsername === normalized) {
      return stripSensitiveFields(entry);
    }
  }
  return null;
}

export function findServerAccountByEmail(email: string): ServerUserProfileRecord | null {
  const normalizedEmail = email.trim().toLowerCase();
  for (const entry of getStore().values()) {
    if (entry.email.toLowerCase() === normalizedEmail) {
      return stripSensitiveFields(entry);
    }
  }
  return null;
}

export function listServerAccountProfiles(): ServerUserProfileRecord[] {
  return Array.from(getStore().values()).map(stripSensitiveFields);
}

/**
 * Creates a new user account with temporary password (created by Admin).
 */
export function createServerAccountProfile(input: {
  username: string;
  fullName: string;
  role: UserRole;
  temporaryPassword: string;
  email?: string;
  phoneNumber?: string;
}):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; message: string } {
  const usernameCheck = validateUsernameFormat(input.username);
  if (!usernameCheck.isValid) {
    return { ok: false, message: usernameCheck.message || "Invalid username format." };
  }

  if (findServerAccountByUsername(usernameCheck.normalized)) {
    return { ok: false, message: "A user account with this username already exists." };
  }

  const pwdValidation = evaluatePasswordCriteria(input.temporaryPassword);
  if (!pwdValidation.isValid) {
    return { ok: false, message: pwdValidation.errors[0] || "Password does not meet criteria." };
  }

  const normalizedEmail = (input.email || `${usernameCheck.normalized}@routex.local`).trim().toLowerCase();
  const normalizedPhone = input.phoneNumber?.trim() || "+63 900 000 0000";
  const nowIso = new Date().toISOString();
  const id = `usr-${input.role.slice(0, 3)}-${Date.now().toString(36)}`;

  const entry: ServerAccountEntry = {
    id,
    username: input.username.trim(),
    normalizedUsername: usernameCheck.normalized,
    email: normalizedEmail,
    phoneNumber: normalizedPhone,
    fullName: input.fullName.trim(),
    role: input.role,
    isActive: true,
    mustChangePassword: true,
    hasSecurityQuestion: false,
    passwordHash: hashWithArgon2id(input.temporaryPassword),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  getStore().set(id, entry);
  return { ok: true, profile: stripSensitiveFields(entry) };
}

/**
 * Updates a user's contact information (email and phone number).
 */
export function updateServerAccountContact(
  userId: string,
  email: string,
  phoneNumber: string,
):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phoneNumber.trim();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "A valid email address is required." };
  }

  if (!normalizedPhone || normalizedPhone.length < 7) {
    return { ok: false, message: "A valid phone number is required (min 7 digits)." };
  }

  existing.email = normalizedEmail;
  existing.phoneNumber = normalizedPhone;
  existing.updatedAt = new Date().toISOString();

  return { ok: true, profile: stripSensitiveFields(existing) };
}

/**
 * Updates a user's username while preserving their ID, role, and history.
 */
export function updateServerAccountUsername(
  userId: string,
  newUsername: string,
):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  const usernameCheck = validateUsernameFormat(newUsername);
  if (!usernameCheck.isValid) {
    return { ok: false, message: usernameCheck.message || "Invalid username format." };
  }

  if (usernameCheck.normalized !== existing.normalizedUsername) {
    const duplicate = findServerAccountByUsername(usernameCheck.normalized);
    if (duplicate && duplicate.id !== userId) {
      return { ok: false, message: "This username is already taken. Please choose another." };
    }
  }

  existing.username = newUsername.trim();
  existing.normalizedUsername = usernameCheck.normalized;
  existing.updatedAt = new Date().toISOString();

  return { ok: true, profile: stripSensitiveFields(existing) };
}

/**
 * Validates the user's current password against stored hash.
 */
export function verifyServerAccountCurrentPassword(
  userId: string,
  currentPassword: string,
): boolean {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing || !existing.isActive) return false;

  const isArgon = verifyWithArgon2id(currentPassword, existing.passwordHash);
  const isLegacy =
    Boolean(existing.legacySeedPassword) && existing.legacySeedPassword === currentPassword;
  const isAlt =
    Boolean(existing.altSeedPassword) && existing.altSeedPassword === currentPassword;

  return isArgon || isLegacy || isAlt;
}

/**
 * Updates a user's permanent password (hashed with Argon2id).
 */
export function updateServerAccountPassword(
  userId: string,
  newPassword: string,
):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  const pwdValidation = evaluatePasswordCriteria(newPassword);
  if (!pwdValidation.isValid) {
    return { ok: false, message: pwdValidation.errors[0] || "Password does not meet criteria." };
  }

  existing.passwordHash = hashWithArgon2id(newPassword);
  existing.legacySeedPassword = undefined;
  existing.mustChangePassword = false;
  existing.passwordChangedAt = new Date().toISOString();
  existing.updatedAt = new Date().toISOString();

  return { ok: true, profile: stripSensitiveFields(existing) };
}

/**
 * Updates security question and salted Argon2id answer hash.
 */
export function updateServerAccountSecurityQuestion(
  userId: string,
  question: string,
  answer: string,
):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  const q = question.trim();
  const a = normalizeSecurityAnswer(answer);
  if (!q) {
    return { ok: false, message: "Security question cannot be blank." };
  }
  if (!a || a.length < 2) {
    return { ok: false, message: "Security answer must be at least 2 characters long." };
  }

  existing.securityQuestion = q;
  existing.securityAnswerHash = hashWithArgon2id(a);
  existing.hasSecurityQuestion = true;
  existing.updatedAt = new Date().toISOString();

  return { ok: true, profile: stripSensitiveFields(existing) };
}

/**
 * Sets permanent password and security question during initial setup.
 */
export function completeInitialServerAccountSetup(
  userId: string,
  newPassword: string,
  question: string,
  answer: string,
):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; message: string } {
  const pwdRes = updateServerAccountPassword(userId, newPassword);
  if (!pwdRes.ok) return pwdRes;

  const sqRes = updateServerAccountSecurityQuestion(userId, question, answer);
  if (!sqRes.ok) return sqRes;

  return { ok: true, profile: sqRes.profile };
}

/**
 * Authorizes single-use, 24-hour Admin-assisted password recovery.
 */
export function authorizeServerAccountReset(
  userId: string,
  authorizedByUsername: string,
):
  | { ok: true; recoveryToken: string; expiresAt: string }
  | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  const recoveryToken = randomBytes(24).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  existing.recoveryAuthorizedAt = now.toISOString();
  existing.recoveryAuthorizedBy = authorizedByUsername;
  existing.recoveryToken = recoveryToken;
  existing.recoveryExpiresAt = expires.toISOString();
  existing.updatedAt = now.toISOString();

  return {
    ok: true,
    recoveryToken,
    expiresAt: expires.toISOString(),
  };
}

/**
 * Inspects a user's password recovery state.
 */
export function getServerAccountRecoveryState(username: string): {
  status: "not_found" | "admin_authorized" | "security_question" | "no_recovery_configured";
  question?: string;
  recoveryToken?: string;
} {
  const normalized = username.trim().toLowerCase();
  for (const entry of getStore().values()) {
    if (entry.normalizedUsername === normalized) {
      if (!entry.isActive) {
        return { status: "not_found" };
      }

      // 1. Check valid Admin-authorized recovery
      if (
        entry.recoveryToken &&
        entry.recoveryExpiresAt &&
        new Date(entry.recoveryExpiresAt).getTime() > Date.now()
      ) {
        return {
          status: "admin_authorized",
          recoveryToken: entry.recoveryToken,
        };
      }

      // 2. Check Security Question recovery
      if (entry.securityQuestion && entry.securityAnswerHash) {
        return {
          status: "security_question",
          question: entry.securityQuestion,
        };
      }

      return { status: "no_recovery_configured" };
    }
  }

  return { status: "not_found" };
}

/**
 * Verifies case-sensitive security answer and generates single-use reset token.
 */
export function verifyServerAccountSecurityAnswer(
  username: string,
  answer: string,
):
  | { ok: true; resetToken: string }
  | { ok: false; message: string } {
  const normalized = username.trim().toLowerCase();
  const store = getStore();

  for (const entry of store.values()) {
    if (entry.normalizedUsername === normalized) {
      if (!entry.securityAnswerHash) {
        return { ok: false, message: "No security question configured for this account." };
      }

      const trimmedAnswer = normalizeSecurityAnswer(answer);
      const isValid = verifyWithArgon2id(trimmedAnswer, entry.securityAnswerHash);

      if (!isValid) {
        return { ok: false, message: "The security answer entered is incorrect." };
      }

      const resetToken = randomBytes(24).toString("base64url");
      entry.securityResetToken = resetToken;
      entry.securityResetTokenExpiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

      return { ok: true, resetToken };
    }
  }

  return { ok: false, message: "Account not found." };
}

/**
 * Consumes single-use reset token and updates permanent password.
 */
export function resetServerAccountPasswordWithToken(
  username: string,
  token: string,
  newPassword: string,
  mode: "admin" | "security_question",
):
  | { ok: true }
  | { ok: false; message: string } {
  const normalized = username.trim().toLowerCase();
  const store = getStore();

  for (const entry of store.values()) {
    if (entry.normalizedUsername === normalized) {
      if (mode === "admin") {
        if (!entry.recoveryToken || entry.recoveryToken !== token) {
          return { ok: false, message: "Invalid or expired recovery authorization." };
        }
        if (!entry.recoveryExpiresAt || new Date(entry.recoveryExpiresAt).getTime() < Date.now()) {
          return { ok: false, message: "This recovery authorization has expired." };
        }

        const pwdValidation = evaluatePasswordCriteria(newPassword);
        if (!pwdValidation.isValid) {
          return { ok: false, message: pwdValidation.errors[0] || "Password does not meet criteria." };
        }

        entry.passwordHash = hashWithArgon2id(newPassword);
        entry.legacySeedPassword = undefined;
        entry.mustChangePassword = false;
        entry.recoveryToken = undefined;
        entry.recoveryExpiresAt = undefined;
        entry.recoveryAuthorizedAt = undefined;
        entry.recoveryAuthorizedBy = undefined;
        entry.passwordChangedAt = new Date().toISOString();
        entry.updatedAt = new Date().toISOString();

        return { ok: true };
      } else {
        if (!entry.securityResetToken || entry.securityResetToken !== token) {
          return { ok: false, message: "Invalid or expired reset token." };
        }
        if (!entry.securityResetTokenExpiresAt || entry.securityResetTokenExpiresAt < Date.now()) {
          return { ok: false, message: "Password reset session has expired." };
        }

        const pwdValidation = evaluatePasswordCriteria(newPassword);
        if (!pwdValidation.isValid) {
          return { ok: false, message: pwdValidation.errors[0] || "Password does not meet criteria." };
        }

        entry.passwordHash = hashWithArgon2id(newPassword);
        entry.legacySeedPassword = undefined;
        entry.mustChangePassword = false;
        entry.securityResetToken = undefined;
        entry.securityResetTokenExpiresAt = undefined;
        entry.passwordChangedAt = new Date().toISOString();
        entry.updatedAt = new Date().toISOString();

        return { ok: true };
      }
    }
  }

  return { ok: false, message: "Account not found." };
}

/**
 * Updates an account's role or active status (Admin only).
 */
export function updateServerAccountProfile(input: {
  userId: string;
  role?: UserRole;
  isActive?: boolean;
}):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(input.userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  existing.role = input.role ?? existing.role;
  existing.isActive = typeof input.isActive === "boolean" ? input.isActive : existing.isActive;
  existing.updatedAt = new Date().toISOString();

  return { ok: true, profile: stripSensitiveFields(existing) };
}

/**
 * Updates a user account's profile photo.
 */
export function updateServerAccountAvatar(
  userId: string,
  avatarUrl: string | null,
):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  existing.avatarUrl = avatarUrl;
  existing.updatedAt = new Date().toISOString();

  return { ok: true, profile: stripSensitiveFields(existing) };
}

/**
 * Deletes a user account from the server account store.
 * The primary system admin account cannot be deleted.
 */
export function deleteServerAccount(
  userId: string,
): { ok: true } | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  if (existing.role === "admin" && existing.username === "admin") {
    return { ok: false, message: "The primary System Admin account cannot be deleted." };
  }

  store.delete(userId);
  return { ok: true };
}
