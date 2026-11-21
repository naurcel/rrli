import { PERMISSIONS, type Permission } from "./rbac.ts";

export type CustomRoleRecord = {
  id: string;
  name: string;
  description: string;
  permissions: readonly Permission[];
  isEnabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// Initial built-in custom roles (if any)
const INITIAL_CUSTOM_ROLES: readonly CustomRoleRecord[] = [
  {
    id: "role-fleet-supervisor",
    name: "Fleet Supervisor",
    description: "Oversees truck registrations, dispatch schedules, and driver assignments.",
    permissions: [
      "dashboard:view",
      "deliveries:view",
      "deliveries:create",
      "deliveries:edit",
      "dropoffs:manage",
      "pod:view",
      "profitability:view",
      "profitability:manage",
      "reports:view",
      "reports:export",
    ],
    isEnabled: true,
    createdBy: "Shinryu",
    createdAt: "2026-11-20T00:00:00.000Z",
    updatedAt: "2026-11-20T00:00:00.000Z",
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __ROUTEX_CUSTOM_ROLES_STORE__: Map<string, CustomRoleRecord> | undefined;
}

function getStore(): Map<string, CustomRoleRecord> {
  if (!globalThis.__ROUTEX_CUSTOM_ROLES_STORE__) {
    const map = new Map<string, CustomRoleRecord>();
    for (const role of INITIAL_CUSTOM_ROLES) {
      map.set(role.id, { ...role });
    }
    globalThis.__ROUTEX_CUSTOM_ROLES_STORE__ = map;
  }
  return globalThis.__ROUTEX_CUSTOM_ROLES_STORE__;
}

/**
 * Lists all custom roles.
 */
export function listCustomRoles(includeDisabled = true): CustomRoleRecord[] {
  const store = getStore();
  const all = Array.from(store.values());
  if (includeDisabled) return all;
  return all.filter((r) => r.isEnabled);
}

/**
 * Finds a custom role by ID or Name.
 */
export function findCustomRoleById(id: string): CustomRoleRecord | null {
  const store = getStore();
  const direct = store.get(id);
  if (direct) return { ...direct };

  const normalized = id.trim().toLowerCase();
  for (const role of store.values()) {
    if (role.name.toLowerCase() === normalized) {
      return { ...role };
    }
  }
  return null;
}

/**
 * Creates a new custom role.
 */
export function createCustomRole(input: {
  name: string;
  description?: string;
  permissions?: readonly Permission[];
  createdBy?: string;
}): { ok: true; role: CustomRoleRecord } | { ok: false; message: string } {
  const nameClean = input.name.trim();
  if (!nameClean) {
    return { ok: false, message: "Role name is required." };
  }

  const store = getStore();
  for (const r of store.values()) {
    if (r.name.toLowerCase() === nameClean.toLowerCase()) {
      return { ok: false, message: `A custom role named "${nameClean}" already exists.` };
    }
  }

  const id = `role-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const validPermissions = (input.permissions ?? []).filter((p) => PERMISSIONS.includes(p));

  const role: CustomRoleRecord = {
    id,
    name: nameClean,
    description: (input.description ?? "").trim(),
    permissions: validPermissions,
    isEnabled: true,
    createdBy: input.createdBy || "Admin",
    createdAt: now,
    updatedAt: now,
  };

  store.set(id, role);
  return { ok: true, role: { ...role } };
}

/**
 * Updates a custom role's details, permissions, or enabled state.
 */
export function updateCustomRole(
  id: string,
  input: {
    name?: string;
    description?: string;
    permissions?: readonly Permission[];
    isEnabled?: boolean;
  },
): { ok: true; role: CustomRoleRecord } | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(id);
  if (!existing) {
    return { ok: false, message: "Custom role not found." };
  }

  if (input.name !== undefined) {
    const nameClean = input.name.trim();
    if (!nameClean) return { ok: false, message: "Role name cannot be blank." };
    existing.name = nameClean;
  }
  if (input.description !== undefined) {
    existing.description = input.description.trim();
  }
  if (input.permissions !== undefined) {
    existing.permissions = input.permissions.filter((p) => PERMISSIONS.includes(p));
  }
  if (input.isEnabled !== undefined) {
    existing.isEnabled = input.isEnabled;
  }
  existing.updatedAt = new Date().toISOString();

  return { ok: true, role: { ...existing } };
}

/**
 * Deletes a custom role.
 * Enforces rule: Cannot delete if assigned to any active user.
 */
export function deleteCustomRole(
  id: string,
  assignedUserCount = 0,
): { ok: true } | { ok: false; message: string } {
  if (assignedUserCount > 0) {
    return {
      ok: false,
      message: `Cannot delete role while it is assigned to ${assignedUserCount} staff ${
        assignedUserCount === 1 ? "member" : "members"
      }. Reassign or unassign them first.`,
    };
  }

  const store = getStore();
  if (!store.has(id)) {
    return { ok: false, message: "Custom role not found." };
  }

  store.delete(id);
  return { ok: true };
}

export function resetCustomRoleStoreForTesting(): void {
  const map = new Map<string, CustomRoleRecord>();
  for (const role of INITIAL_CUSTOM_ROLES) {
    map.set(role.id, { ...role });
  }
  globalThis.__ROUTEX_CUSTOM_ROLES_STORE__ = map;
}
