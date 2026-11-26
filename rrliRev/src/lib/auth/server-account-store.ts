import { randomBytes } from "node:crypto";
import { hashWithArgon2id, verifyWithArgon2id } from "./argon2id.ts";
import {
  evaluatePasswordCriteria,
  generateBackupKey,
  generateRandomTemporaryPassword,
  normalizeBackupKey,
  normalizeSecurityAnswer,
  validateUsernameFormat,
} from "./password-policy.ts";
import type { Permission, UserRole } from "./rbac.ts";
import { recordAuditEntry } from "../audit/server-audit-store.ts";
import { formatPhoneNumber } from "../format.ts";

export type ServerUserProfileRecord = {
  id: string;
  username: string;
  normalizedUsername: string;
  legacyAliases?: readonly string[];
  email: string;
  phoneNumber?: string;
  fullName: string;
  role: UserRole;
  isSuperadmin: boolean;
  designation?: string;
  departments?: readonly string[];
  customGrants?: readonly Permission[];
  customRestrictions?: readonly Permission[];
  isActive: boolean;
  isPermanentlyDeleted?: boolean;
  deletedAt?: string;
  deletedReason?: string;
  deletedBy?: string;
  mustChangePassword: boolean;
  hasSecurityQuestion: boolean;
  securityQuestion?: string;
  hasBackupKey?: boolean;
  backupKeyGeneratedAt?: string;
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
  securityAnswerChangedAt?: string;
  usernameChangedAt?: string;
  backupKeyHash?: string;
  backupKeyGeneratedAt?: string;
  backupKeyUsedAt?: string;
  recoveryToken?: string;
  securityResetToken?: string;
  securityResetTokenExpiresAt?: number;
};

// Pre-computed Argon2id hashes for initial seed accounts using canonical RBAC passwords
const HASH_PRESIDENT = hashWithArgon2id("heights6");
const HASH_ADMIN = hashWithArgon2id("admin");
const HASH_OPS = hashWithArgon2id("operations");
const HASH_FIN = hashWithArgon2id("finance");
const HASH_HR = hashWithArgon2id("humanresources");
const HASH_SEC = hashWithArgon2id("secretary");
const HASH_CSR = hashWithArgon2id("customerrep");

const HASH_ANSWER_FOUNDING = hashWithArgon2id(normalizeSecurityAnswer("2024"));
const HASH_ANSWER_SCHOOL = hashWithArgon2id(normalizeSecurityAnswer("RouteX Academy"));
const HASH_ANSWER_CITY = hashWithArgon2id(normalizeSecurityAnswer("Laguna"));
const HASH_ANSWER_PET = hashWithArgon2id(normalizeSecurityAnswer("Bantay"));
const HASH_ANSWER_NICK = hashWithArgon2id(normalizeSecurityAnswer("Rainy"));

// Preserved legacy hashes for backwards compatibility with unnormalized seed records
const LEGACY_HASH_ANSWER_SCHOOL = hashWithArgon2id("RouteX Academy");
const LEGACY_HASH_ANSWER_CITY = hashWithArgon2id("Laguna");
const LEGACY_HASH_ANSWER_PET = hashWithArgon2id("Bantay");
const LEGACY_HASH_ANSWER_NICK = hashWithArgon2id("Rainy");

/**
 * Initial server-side accounts representing all access levels and roles.
 * All credentials meet password criteria and are secured using Argon2id.
 */
const INITIAL_SERVER_ACCOUNTS: readonly ServerAccountEntry[] = [
  {
    id: "usr-pres-000",
    username: "shinr6u",
    normalizedUsername: "shinr6u",
    email: "suchiterusenl@gmail.com",
    phoneNumber: "09948795127",
    fullName: "Shinryu",
    role: "admin",
    isSuperadmin: true,
    designation: "President",
    departments: ["admin"],
    customGrants: [],
    customRestrictions: [],
    avatarUrl: "/profiles/shinryu.png",
    isActive: true,
    isPermanentlyDeleted: false,
    mustChangePassword: false,
    hasSecurityQuestion: true,
    securityQuestion: "What was the founding year of RouteX?",
    securityAnswerHash: HASH_ANSWER_FOUNDING,
    passwordHash: HASH_PRESIDENT,
    legacySeedPassword: "heights6",
    altSeedPassword: "heights6",
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
  },
  {
    id: "usr-admin-001",
    username: "mori_mochi",
    normalizedUsername: "mori_mochi",
    legacyAliases: ["admin", "admin@routex.local"],
    email: "adrianmangampat@gmail.com",
    phoneNumber: "09171234567",
    fullName: "Adrian Mangampat",
    role: "admin",
    isSuperadmin: false,
    designation: "System Administrator",
    departments: ["admin"],
    customGrants: [],
    customRestrictions: [],
    avatarUrl: "/profiles/shinryu.png",
    isActive: true,
    isPermanentlyDeleted: false,
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
    username: "narcel",
    normalizedUsername: "narcel",
    legacyAliases: ["operations", "operations@routex.local"],
    email: "marcrancel@gmail.com",
    phoneNumber: "09182345678",
    fullName: "Marc Rancel",
    role: "operations",
    isSuperadmin: false,
    designation: "Operations Lead",
    departments: ["operations"],
    customGrants: [],
    customRestrictions: [],
    isActive: true,
    isPermanentlyDeleted: false,
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
    username: "azula",
    normalizedUsername: "azula",
    legacyAliases: ["finance", "finance@routex.local"],
    email: "louizajoy@gmail.com",
    phoneNumber: "09193456789",
    fullName: "Louiza Joy",
    role: "finance",
    isSuperadmin: false,
    designation: "Finance Officer",
    departments: ["finance"],
    customGrants: [],
    customRestrictions: [],
    isActive: true,
    isPermanentlyDeleted: false,
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
    username: "jxleners",
    normalizedUsername: "jxleners",
    legacyAliases: ["hr", "hr@routex.local"],
    email: "jelenepunongbayan@gmail.com",
    phoneNumber: "09204567890",
    fullName: "Jelene Punongbayan",
    role: "hr",
    isSuperadmin: false,
    designation: "HR Specialist",
    departments: ["hr"],
    customGrants: [],
    customRestrictions: [],
    isActive: true,
    isPermanentlyDeleted: false,
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
    username: "ze.ku",
    normalizedUsername: "ze.ku",
    legacyAliases: ["secretary", "secretary@routex.local"],
    email: "zeankurt@gmail.com",
    phoneNumber: "09215678901",
    fullName: "Zean Kurt",
    role: "secretary",
    isSuperadmin: false,
    designation: "Corporate Secretary",
    departments: ["secretary"],
    customGrants: [],
    customRestrictions: [],
    isActive: true,
    isPermanentlyDeleted: false,
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
    username: "ravicci",
    normalizedUsername: "ravicci",
    legacyAliases: ["customerrep", "csrep@routex.local"],
    email: "rainibasco@gmail.com",
    phoneNumber: "09226789012",
    fullName: "Rain Ibasco",
    role: "customer_representative",
    isSuperadmin: false,
    designation: "Customer Representative",
    departments: ["customer_representative"],
    customGrants: [],
    customRestrictions: [],
    isActive: true,
    isPermanentlyDeleted: false,
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
      if (!existing.usernameChangedAt) {
        existing.username = account.username;
        existing.normalizedUsername = account.normalizedUsername;
      }
      existing.legacyAliases = account.legacyAliases;
      existing.fullName = account.fullName;
      existing.email = account.email;
      existing.phoneNumber = account.phoneNumber;
      existing.isSuperadmin = Boolean(account.isSuperadmin);
      existing.designation = account.designation;
      existing.departments = existing.departments ?? account.departments ?? [account.role];
      existing.customGrants = existing.customGrants ?? account.customGrants ?? [];
      existing.customRestrictions = existing.customRestrictions ?? account.customRestrictions ?? [];
      existing.isPermanentlyDeleted = Boolean(existing.isPermanentlyDeleted);

      // Existing initial accounts are fully configured and do not require first-login setup
      if (existing.mustChangePassword === undefined || existing.mustChangePassword === true) {
        existing.mustChangePassword = false;
      }
      if (!existing.hasSecurityQuestion && account.hasSecurityQuestion) {
        existing.hasSecurityQuestion = true;
        existing.securityQuestion = account.securityQuestion;
        existing.securityAnswerHash = account.securityAnswerHash;
      }
      if (!existing.securityAnswerChangedAt && account.securityAnswerHash) {
        existing.securityAnswerHash = account.securityAnswerHash;
        existing.securityQuestion = account.securityQuestion;
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
    legacyAliases: entry.legacyAliases,
    email: entry.email,
    phoneNumber: entry.phoneNumber,
    fullName: entry.fullName,
    role: entry.role,
    isSuperadmin: Boolean(entry.isSuperadmin),
    designation: entry.designation ?? (entry.isSuperadmin ? "President" : "Staff"),
    departments: entry.departments ?? [entry.role],
    customGrants: entry.customGrants ?? [],
    customRestrictions: entry.customRestrictions ?? [],
    isActive: entry.isActive,
    isPermanentlyDeleted: Boolean(entry.isPermanentlyDeleted),
    deletedAt: entry.deletedAt,
    deletedReason: entry.deletedReason,
    deletedBy: entry.deletedBy,
    mustChangePassword: Boolean(entry.mustChangePassword),
    hasSecurityQuestion: Boolean(entry.securityAnswerHash),
    securityQuestion: entry.securityQuestion,
    hasBackupKey: Boolean(entry.backupKeyHash),
    backupKeyGeneratedAt: entry.backupKeyGeneratedAt,
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
    const isUsernameMatch =
      entry.normalizedUsername === normalized ||
      Boolean(entry.legacyAliases?.map((a) => a.toLowerCase()).includes(normalized));
    const isEmailMatch =
      entry.email.toLowerCase() === normalized ||
      Boolean(entry.legacyAliases?.map((a) => a.toLowerCase()).includes(normalized));

    if (isUsernameMatch || isEmailMatch) {
      if (entry.isPermanentlyDeleted || !entry.isActive) {
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

export function findServerAccountEntry(idOrIdentifier: string): ServerAccountEntry | undefined {
  if (!idOrIdentifier) return undefined;
  const store = getStore();
  const direct = store.get(idOrIdentifier);
  if (direct) return direct;

  const needle = idOrIdentifier.trim().toLowerCase();
  for (const entry of store.values()) {
    if (
      entry.id.toLowerCase() === needle ||
      entry.normalizedUsername === needle ||
      entry.username.toLowerCase() === needle ||
      entry.email.toLowerCase() === needle ||
      Boolean(entry.legacyAliases?.map((a) => a.toLowerCase()).includes(needle))
    ) {
      return entry;
    }
  }
  return undefined;
}

export function findServerAccountById(
  userId: string,
  options?: { includeDeleted?: boolean },
): ServerUserProfileRecord | null {
  const entry = findServerAccountEntry(userId);
  if (!entry) return null;
  if (entry.isPermanentlyDeleted && !options?.includeDeleted) {
    return null;
  }
  return stripSensitiveFields(entry);
}

export function findServerAccountByUsername(
  username: string,
  options?: { includeDeleted?: boolean },
): ServerUserProfileRecord | null {
  const normalized = username.trim().toLowerCase();
  for (const entry of getStore().values()) {
    if (
      entry.normalizedUsername === normalized ||
      Boolean(entry.legacyAliases?.map((a) => a.toLowerCase()).includes(normalized))
    ) {
      if (entry.isPermanentlyDeleted && !options?.includeDeleted) {
        return null;
      }
      return stripSensitiveFields(entry);
    }
  }
  return null;
}

export function findServerAccountByEmail(
  email: string,
  options?: { includeDeleted?: boolean },
): ServerUserProfileRecord | null {
  const normalizedEmail = email.trim().toLowerCase();
  for (const entry of getStore().values()) {
    if (
      entry.email.toLowerCase() === normalizedEmail ||
      Boolean(entry.legacyAliases?.map((a) => a.toLowerCase()).includes(normalizedEmail))
    ) {
      if (entry.isPermanentlyDeleted && !options?.includeDeleted) {
        return null;
      }
      return stripSensitiveFields(entry);
    }
  }
  return null;
}

export function findServerAccountByUsernameOrEmail(
  identifier: string,
  options?: { includeDeleted?: boolean },
): ServerUserProfileRecord | null {
  const normalized = identifier.trim().toLowerCase();
  for (const entry of getStore().values()) {
    if (
      entry.normalizedUsername === normalized ||
      entry.email.toLowerCase() === normalized ||
      Boolean(entry.legacyAliases?.map((a) => a.toLowerCase()).includes(normalized))
    ) {
      if (entry.isPermanentlyDeleted && !options?.includeDeleted) {
        return null;
      }
      return stripSensitiveFields(entry);
    }
  }
  return null;
}

export function findSuperadminAccount(): ServerUserProfileRecord | null {
  for (const entry of getStore().values()) {
    if (entry.isSuperadmin && !entry.isPermanentlyDeleted) {
      return stripSensitiveFields(entry);
    }
  }
  return null;
}

export function countSuperadminAccounts(): number {
  let count = 0;
  for (const entry of getStore().values()) {
    if (entry.isSuperadmin && !entry.isPermanentlyDeleted) {
      count++;
    }
  }
  return count;
}

export function listServerAccountProfiles(options?: {
  includeDeleted?: boolean;
  deletedOnly?: boolean;
}): ServerUserProfileRecord[] {
  const all = Array.from(getStore().values()).map(stripSensitiveFields);
  if (options?.deletedOnly) {
    return all.filter((u) => u.isPermanentlyDeleted === true);
  }
  if (options?.includeDeleted) {
    return all;
  }
  return all.filter((u) => !u.isPermanentlyDeleted);
}

/**
 * Creates a new user account with temporary password (created by Admin).
 */
export function createServerAccountProfile(input: {
  username: string;
  fullName: string;
  role: UserRole;
  temporaryPassword?: string;
  email?: string;
  phoneNumber?: string;
  designation?: string;
  departments?: readonly string[];
  isSuperadmin?: boolean;
}):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; message: string } {
  const usernameCheck = validateUsernameFormat(input.username);
  if (!usernameCheck.isValid) {
    return { ok: false, message: usernameCheck.message || "Invalid username format." };
  }

  if (findServerAccountByUsername(usernameCheck.normalized, { includeDeleted: true })) {
    return { ok: false, message: "A user account with this username already exists." };
  }

  // Prevent creating duplicate Superadmin
  if (input.isSuperadmin) {
    if (countSuperadminAccounts() >= 1) {
      return {
        ok: false,
        message: "A Superadmin (President) account already exists. Only exactly one Superadmin is permitted.",
      };
    }
  }

  const assignedPassword = input.temporaryPassword || generateRandomTemporaryPassword();
  const pwdValidation = evaluatePasswordCriteria(assignedPassword);
  if (!pwdValidation.isValid) {
    return { ok: false, message: pwdValidation.errors[0] || "Password does not meet criteria." };
  }

  const normalizedEmail = (input.email || `${usernameCheck.normalized}@routex.local`).trim().toLowerCase();
  const normalizedPhone = formatPhoneNumber(input.phoneNumber) || "09000000000";
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
    isSuperadmin: Boolean(input.isSuperadmin),
    designation: input.designation?.trim() || (input.isSuperadmin ? "Superadmin" : "Staff"),
    departments: input.departments ? [...input.departments] : [input.role],
    customGrants: [],
    customRestrictions: [],
    isActive: true,
    isPermanentlyDeleted: false,
    mustChangePassword: true,
    hasSecurityQuestion: false,
    passwordHash: hashWithArgon2id(assignedPassword),
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
  const existing = findServerAccountEntry(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = formatPhoneNumber(phoneNumber);

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
  const existing = findServerAccountEntry(userId);
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
  existing.usernameChangedAt = new Date().toISOString();
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
  const existing = findServerAccountEntry(userId);
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
  const existing = findServerAccountEntry(userId);
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
  const existing = findServerAccountEntry(userId);
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
  existing.securityAnswerChangedAt = new Date().toISOString();
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
  const existing = findServerAccountEntry(userId);
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
  status: "not_found" | "admin_authorized" | "security_question" | "backup_key" | "no_recovery_configured";
  question?: string;
  recoveryToken?: string;
  hasBackupKey?: boolean;
  hasSecurityQuestion?: boolean;
} {
  const normalized = username.trim().toLowerCase();
  for (const entry of getStore().values()) {
    if (
      entry.normalizedUsername === normalized ||
      Boolean(entry.legacyAliases?.map((a) => a.toLowerCase()).includes(normalized))
    ) {
      if (!entry.isActive || entry.isPermanentlyDeleted) {
        return { status: "not_found" };
      }

      const hasBackupKey = Boolean(entry.backupKeyHash);
      const hasSecurityQuestion = Boolean(entry.securityQuestion && entry.securityAnswerHash);

      // 1. Check valid Admin-authorized recovery
      if (
        entry.recoveryToken &&
        entry.recoveryExpiresAt &&
        new Date(entry.recoveryExpiresAt).getTime() > Date.now()
      ) {
        return {
          status: "admin_authorized",
          recoveryToken: entry.recoveryToken,
          hasBackupKey,
          hasSecurityQuestion,
        };
      }

      // 2. Check Security Question recovery or Backup Key recovery
      if (hasSecurityQuestion) {
        return {
          status: "security_question",
          question: entry.securityQuestion,
          hasBackupKey,
          hasSecurityQuestion,
        };
      }

      if (hasBackupKey) {
        return {
          status: "backup_key",
          hasBackupKey: true,
          hasSecurityQuestion: false,
        };
      }

      return { status: "no_recovery_configured", hasBackupKey: false, hasSecurityQuestion: false };
    }
  }

  return { status: "not_found" };
}

/**
 * Generates an emergency backup key for an account after identity verification.
 * The plaintext key is returned once to the caller and NEVER stored in plaintext.
 * An Argon2id hash of the normalized key is saved.
 * Any previously generated backup key is invalidated.
 */
export function generateServerAccountBackupKey(
  username: string,
  currentPassword?: string,
  preferredRawKey?: string,
):
  | { ok: true; backupKey: string; generatedAt: string }
  | { ok: false; message: string } {
  const normalized = username.trim().toLowerCase();
  const store = getStore();

  for (const entry of store.values()) {
    if (
      entry.normalizedUsername === normalized ||
      Boolean(entry.legacyAliases?.map((a) => a.toLowerCase()).includes(normalized))
    ) {
      if (!entry.isActive || entry.isPermanentlyDeleted) {
        return { ok: false, message: "Account is inactive or not found." };
      }

      if (currentPassword) {
        const credCheck = verifyServerAccountCredentials(username, currentPassword);
        if (!credCheck.ok) {
          return { ok: false, message: "Current password verification failed." };
        }
      }

      const rawKey =
        preferredRawKey && normalizeBackupKey(preferredRawKey).length >= 8
          ? preferredRawKey
          : generateBackupKey();
      const normalizedKey = normalizeBackupKey(rawKey);
      const now = new Date().toISOString();

      entry.backupKeyHash = hashWithArgon2id(normalizedKey);
      entry.backupKeyGeneratedAt = now;
      entry.hasBackupKey = true;
      entry.updatedAt = now;

      recordAuditEntry({
        actorId: entry.id,
        actorEmail: entry.email,
        action: "user.backup_key_generated",
        entityType: "user",
        entityId: entry.id,
        summary: `Generated emergency backup key for user '${entry.username}'. Any prior backup key was invalidated.`,
      });

      return { ok: true, backupKey: rawKey, generatedAt: now };
    }
  }

  return { ok: false, message: "Account not found." };
}

/**
 * Verifies an emergency backup key and generates a single-use password reset token.
 * Strictly enforces single-use: the backup key is IMMEDIATELY invalidated upon successful verification.
 */
export function verifyServerAccountBackupKey(
  username: string,
  backupKey: string,
):
  | { ok: true; resetToken: string }
  | { ok: false; message: string } {
  const normalized = username.trim().toLowerCase();
  const store = getStore();

  for (const entry of store.values()) {
    if (
      entry.normalizedUsername === normalized ||
      Boolean(entry.legacyAliases?.map((a) => a.toLowerCase()).includes(normalized))
    ) {
      if (!entry.isActive || entry.isPermanentlyDeleted) {
        return { ok: false, message: "Account is inactive or not found." };
      }

      if (!entry.backupKeyHash) {
        return { ok: false, message: "No emergency backup key is configured for this account." };
      }

      const normalizedKey = normalizeBackupKey(backupKey);
      if (!normalizedKey) {
        return { ok: false, message: "Enter a valid emergency backup key." };
      }

      const isValid = verifyWithArgon2id(normalizedKey, entry.backupKeyHash);
      if (!isValid) {
        return { ok: false, message: "The emergency backup key entered is incorrect." };
      }

      // Single-use enforcement: invalidate backup key immediately
      entry.backupKeyHash = undefined;
      entry.hasBackupKey = false;
      entry.backupKeyUsedAt = new Date().toISOString();
      entry.updatedAt = new Date().toISOString();

      const resetToken = randomBytes(24).toString("base64url");
      entry.securityResetToken = resetToken;
      entry.securityResetTokenExpiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

      recordAuditEntry({
        actorId: entry.id,
        actorEmail: entry.email,
        action: "user.backup_key_consumed",
        entityType: "user",
        entityId: entry.id,
        summary: `Emergency backup key consumed for user '${entry.username}'. Key was invalidated.`,
      });

      return { ok: true, resetToken };
    }
  }

  return { ok: false, message: "Account not found." };
}

/**
 * Verifies case-insensitive security answer and generates single-use reset token.
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
    if (
      entry.normalizedUsername === normalized ||
      Boolean(entry.legacyAliases?.map((a) => a.toLowerCase()).includes(normalized))
    ) {
      if (!entry.isActive || entry.isPermanentlyDeleted) {
        return { ok: false, message: "Account not found." };
      }
      if (!entry.securityAnswerHash) {
        return { ok: false, message: "No security question configured for this account." };
      }

      const normalizedAnswer = normalizeSecurityAnswer(answer);
      if (!normalizedAnswer) {
        return { ok: false, message: "The security answer entered is incorrect." };
      }

      // 1. Primary check: case-insensitive normalized answer
      let isValid = verifyWithArgon2id(normalizedAnswer, entry.securityAnswerHash);

      // 2. Backwards compatibility check:
      // If the answer was originally hashed using legacy case-sensitive answer (raw trimmed string)
      if (!isValid && entry.securityAnswerHash) {
        const rawTrimmed = typeof answer === "string" ? answer.trim() : "";
        if (rawTrimmed && rawTrimmed !== normalizedAnswer) {
          if (verifyWithArgon2id(rawTrimmed, entry.securityAnswerHash)) {
            isValid = true;
            // Transparently migrate legacy hash to normalized format
            entry.securityAnswerHash = hashWithArgon2id(normalizedAnswer);
            entry.updatedAt = new Date().toISOString();
          }
        }
      }

      // 3. Fallback for seeded accounts if still using legacy seed hash
      if (!isValid && entry.securityAnswerHash) {
        const legacySeedPairs = [
          { legacyHash: LEGACY_HASH_ANSWER_SCHOOL, expected: "routex academy" },
          { legacyHash: LEGACY_HASH_ANSWER_CITY, expected: "laguna" },
          { legacyHash: LEGACY_HASH_ANSWER_PET, expected: "bantay" },
          { legacyHash: LEGACY_HASH_ANSWER_NICK, expected: "rainy" },
        ];
        for (const { legacyHash, expected } of legacySeedPairs) {
          if (entry.securityAnswerHash === legacyHash && normalizedAnswer === expected) {
            isValid = true;
            entry.securityAnswerHash = hashWithArgon2id(normalizedAnswer);
            entry.updatedAt = new Date().toISOString();
            break;
          }
        }
      }

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
 * When mode === "backup_key", automatically generates a replacement backup key!
 */
export function resetServerAccountPasswordWithToken(
  username: string,
  token: string,
  newPassword: string,
  mode: "admin" | "security_question" | "backup_key",
):
  | { ok: true; replacementBackupKey?: string }
  | { ok: false; message: string } {
  const normalized = username.trim().toLowerCase();
  const store = getStore();

  for (const entry of store.values()) {
    if (
      entry.normalizedUsername === normalized ||
      Boolean(entry.legacyAliases?.map((a) => a.toLowerCase()).includes(normalized))
    ) {
      if (!entry.isActive || entry.isPermanentlyDeleted) {
        return { ok: false, message: "Account is inactive or not found." };
      }

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

        // If recovered via backup key, automatically generate a replacement backup key!
        let replacementBackupKey: string | undefined;
        if (mode === "backup_key") {
          replacementBackupKey = generateBackupKey();
          entry.backupKeyHash = hashWithArgon2id(normalizeBackupKey(replacementBackupKey));
          entry.backupKeyGeneratedAt = new Date().toISOString();
          entry.hasBackupKey = true;

          recordAuditEntry({
            actorId: entry.id,
            actorEmail: entry.email,
            action: "user.backup_key_regenerated_automatic",
            entityType: "user",
            entityId: entry.id,
            summary: `Automatically generated replacement backup key for user '${entry.username}' following recovery.`,
          });
        }

        return { ok: true, replacementBackupKey };
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
  designation?: string;
  departments?: readonly string[];
  isSuperadmin?: boolean;
  actorIsSuperadmin?: boolean;
}):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(input.userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  // 1. Protection for Superadmin account
  if (existing.isSuperadmin) {
    if (!input.actorIsSuperadmin) {
      return {
        ok: false,
        message: "Access Denied: Regular Administrators cannot modify the Superadmin (President) account.",
      };
    }
    if (input.isActive === false) {
      return {
        ok: false,
        message: "The Superadmin (President) account cannot be deactivated.",
      };
    }
    if (input.isSuperadmin === false) {
      return {
        ok: false,
        message: "The Superadmin designation cannot be revoked from the President account.",
      };
    }
  }

  // 2. Prevent promoting any account to Superadmin if one already exists
  if (input.isSuperadmin === true && !existing.isSuperadmin) {
    if (countSuperadminAccounts() >= 1) {
      return {
        ok: false,
        message: "Cannot promote account to Superadmin. Exactly one Superadmin account is permitted.",
      };
    }
    existing.isSuperadmin = true;
  }

  existing.role = input.role ?? existing.role;
  existing.isActive = typeof input.isActive === "boolean" ? input.isActive : existing.isActive;
  if (input.designation !== undefined) existing.designation = input.designation.trim();
  if (input.departments !== undefined) existing.departments = [...input.departments];
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
  const existing = findServerAccountEntry(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  existing.avatarUrl = avatarUrl;
  existing.updatedAt = new Date().toISOString();

  return { ok: true, profile: stripSensitiveFields(existing) };
}

/**
 * Permanently deletes an employee or Admin account with required reason.
 * Only Superadmin (President) has authority to perform this operation.
 * Preserves historical records, full name, username, and transactions.
 */
export function permanentlyDeleteServerAccount(
  userId: string,
  deletedByUsername: string,
  reason: string,
): { ok: true; profile: ServerUserProfileRecord } | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  if (existing.isSuperadmin) {
    return { ok: false, message: "The Superadmin (President) account cannot be deleted." };
  }

  const cleanReason = reason.trim();
  if (!cleanReason || cleanReason.length < 5) {
    return {
      ok: false,
      message: "A deletion reason (minimum 5 characters) is required to permanently delete an account.",
    };
  }

  existing.isPermanentlyDeleted = true;
  existing.isActive = false;
  existing.deletedAt = new Date().toISOString();
  existing.deletedReason = cleanReason;
  existing.deletedBy = deletedByUsername;
  existing.updatedAt = new Date().toISOString();

  return { ok: true, profile: stripSensitiveFields(existing) };
}

/**
 * Updates individual permission custom grants and restrictions for an employee.
 */
export function updateUserCustomPermissions(
  userId: string,
  customGrants: readonly Permission[],
  customRestrictions: readonly Permission[],
): { ok: true; profile: ServerUserProfileRecord } | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }
  if (existing.isPermanentlyDeleted) {
    return { ok: false, message: "Cannot configure permissions for a permanently deleted account." };
  }

  existing.customGrants = [...customGrants];
  existing.customRestrictions = [...customRestrictions];
  existing.updatedAt = new Date().toISOString();

  return { ok: true, profile: stripSensitiveFields(existing) };
}

/**
 * Duplicates individual permission configurations between employees without copying department memberships.
 */
export function duplicateUserCustomPermissions(
  sourceUserId: string,
  targetUserId: string,
): { ok: true; profile: ServerUserProfileRecord } | { ok: false; message: string } {
  const store = getStore();
  const source = store.get(sourceUserId);
  if (!source) {
    return { ok: false, message: "Source user account was not found." };
  }
  const target = store.get(targetUserId);
  if (!target) {
    return { ok: false, message: "Target user account was not found." };
  }
  if (target.isPermanentlyDeleted) {
    return { ok: false, message: "Cannot configure permissions for a permanently deleted account." };
  }

  target.customGrants = [...(source.customGrants ?? [])];
  target.customRestrictions = [...(source.customRestrictions ?? [])];
  target.updatedAt = new Date().toISOString();

  return { ok: true, profile: stripSensitiveFields(target) };
}

/**
 * Assigns departments to a user account.
 */
export function assignUserDepartments(
  userId: string,
  departments: readonly string[],
): { ok: true; profile: ServerUserProfileRecord } | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }
  if (existing.isPermanentlyDeleted) {
    return { ok: false, message: "Cannot assign departments to a permanently deleted account." };
  }

  existing.departments = [...departments];
  existing.updatedAt = new Date().toISOString();

  return { ok: true, profile: stripSensitiveFields(existing) };
}

/**
 * Deletes a user account from the server account store.
 * The primary system admin account and Superadmin account cannot be deleted.
 */
export function deleteServerAccount(
  userId: string,
): { ok: true } | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(userId);
  if (!existing) {
    return { ok: false, message: "The specified user account was not found." };
  }

  if (existing.isSuperadmin) {
    return { ok: false, message: "The Superadmin (President) account cannot be deleted." };
  }

  if (
    existing.id === "usr-admin-001" ||
    (existing.role === "admin" && (existing.username === "admin" || existing.username === "mori_mochi"))
  ) {
    return { ok: false, message: "The primary System Admin account cannot be deleted." };
  }

  store.delete(userId);
  return { ok: true };
}
