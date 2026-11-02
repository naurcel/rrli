import type { UserRole } from "./rbac.ts";

export type ServerUserProfileRecord = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ServerAccountEntry = ServerUserProfileRecord & {
  passwordHash: string;
};

/**
 * Default server-side accounts representing all 3 access levels and 6 canonical roles.
 * Used for local server-verified authentication when an external Supabase instance
 * is not yet connected via `.env.local`, while enforcing identical server-side RBAC rules.
 */
const INITIAL_SERVER_ACCOUNTS: readonly ServerAccountEntry[] = [
  {
    id: "usr-admin-001",
    email: "admin@routex.local",
    fullName: "Shinryu (System Admin)",
    role: "admin",
    isActive: true,
    passwordHash: "admin",
    createdAt: "2026-10-15T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "usr-ops-002",
    email: "operations@routex.local",
    fullName: "Marc Rancel (Delivery Operations)",
    role: "operations",
    isActive: true,
    passwordHash: "operations",
    createdAt: "2026-10-16T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "usr-fin-003",
    email: "finance@routex.local",
    fullName: "Louiza Joy (Finance)",
    role: "finance",
    isActive: true,
    passwordHash: "finance",
    createdAt: "2026-10-17T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "usr-hr-004",
    email: "hr@routex.local",
    fullName: "Jelene Punongbayan (HR)",
    role: "hr",
    isActive: true,
    passwordHash: "humanresources",
    createdAt: "2026-10-18T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "usr-sec-005",
    email: "secretary@routex.local",
    fullName: "Zean Kurt (Secretary)",
    role: "secretary",
    isActive: true,
    passwordHash: "secretary",
    createdAt: "2026-10-19T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "usr-csr-006",
    email: "csrep@routex.local",
    fullName: "Rain Ibasco (Customer Representative)",
    role: "customer_representative",
    isActive: true,
    passwordHash: "customerrep",
    createdAt: "2026-10-20T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
  },
] as const;

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
      // Always sync code-level baseline credentials/names on hot reload
      existing.email = account.email;
      existing.fullName = account.fullName;
      existing.passwordHash = account.passwordHash;
    }
  }

  return map;
}

function stripPassword(entry: ServerAccountEntry): ServerUserProfileRecord {
  return {
    id: entry.id,
    email: entry.email,
    fullName: entry.fullName,
    role: entry.role,
    isActive: entry.isActive,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function verifyServerAccountCredentials(
  email: string,
  password: string,
):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; reason: "invalid_credentials" | "inactive_account" } {
  const normalizedEmail = email.trim().toLowerCase();
  const store = getStore();

  for (const entry of store.values()) {
    if (entry.email.toLowerCase() === normalizedEmail) {
      if (entry.passwordHash !== password) {
        return { ok: false, reason: "invalid_credentials" };
      }
      if (!entry.isActive) {
        return { ok: false, reason: "inactive_account" };
      }
      return { ok: true, profile: stripPassword(entry) };
    }
  }

  return { ok: false, reason: "invalid_credentials" };
}

export function findServerAccountById(userId: string): ServerUserProfileRecord | null {
  const entry = getStore().get(userId);
  return entry ? stripPassword(entry) : null;
}

export function findServerAccountByEmail(email: string): ServerUserProfileRecord | null {
  const normalizedEmail = email.trim().toLowerCase();
  for (const entry of getStore().values()) {
    if (entry.email.toLowerCase() === normalizedEmail) {
      return stripPassword(entry);
    }
  }
  return null;
}

export function listServerAccountProfiles(): ServerUserProfileRecord[] {
  return Array.from(getStore().values()).map(stripPassword);
}

export function createServerAccountProfile(input: {
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
}):
  | { ok: true; profile: ServerUserProfileRecord }
  | { ok: false; message: string } {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (findServerAccountByEmail(normalizedEmail)) {
    return { ok: false, message: "An account with this email address already exists." };
  }

  const nowIso = new Date().toISOString();
  const id = `usr-${input.role.slice(0, 3)}-${Date.now().toString(36)}`;
  const entry: ServerAccountEntry = {
    id,
    email: normalizedEmail,
    fullName: input.fullName.trim(),
    role: input.role,
    isActive: true,
    passwordHash: input.password,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  getStore().set(id, entry);
  return { ok: true, profile: stripPassword(entry) };
}

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

  const updated: ServerAccountEntry = {
    ...existing,
    role: input.role ?? existing.role,
    isActive: typeof input.isActive === "boolean" ? input.isActive : existing.isActive,
    updatedAt: new Date().toISOString(),
  };

  store.set(input.userId, updated);
  return { ok: true, profile: stripPassword(updated) };
}

