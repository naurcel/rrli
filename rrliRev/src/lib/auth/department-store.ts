import { PERMISSIONS, type Permission } from "./rbac.ts";

export type DepartmentRecord = {
  id: string;
  code: string;
  name: string;
  description: string;
  defaultPermissions: readonly Permission[];
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

// Initial baseline departments representing the core organizational functions
const INITIAL_DEPARTMENTS: readonly DepartmentRecord[] = [
  {
    id: "dept-admin",
    code: "admin",
    name: "Executive & Administration",
    description: "System administration, user account governance, and overall company management.",
    defaultPermissions: PERMISSIONS,
    isArchived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "dept-ops",
    code: "operations",
    name: "Delivery Operations",
    description: "Dispatch, delivery logging, Excel imports, multi-store drop-offs, and truck monitoring.",
    defaultPermissions: [
      "dashboard:view",
      "deliveries:view",
      "deliveries:create",
      "deliveries:edit",
      "deliveries:complete",
      "dropoffs:manage",
      "imports:upload",
      "imports:review_confirm",
      "pod:view",
      "profitability:view",
      "profitability:manage",
      "reports:view",
      "reports:export",
      "settings:view",
    ],
    isArchived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "dept-fin",
    code: "finance",
    name: "Finance & Accounting",
    description: "Company expense ledger, financial summaries, and profitability auditing.",
    defaultPermissions: [
      "dashboard:view",
      "deliveries:view",
      "pod:view",
      "profitability:view",
      "reports:view",
      "reports:export",
      "finance:view",
      "finance:manage",
      "settings:view",
    ],
    isArchived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "dept-hr",
    code: "hr",
    name: "Human Resources",
    description: "Driver and helper crew assignments, compensation monitoring, and HR analytics.",
    defaultPermissions: [
      "dashboard:view",
      "deliveries:view",
      "pod:view",
      "profitability:view",
      "finance:view",
      "reports:view",
      "settings:view",
    ],
    isArchived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "dept-sec",
    code: "secretary",
    name: "Corporate Secretary",
    description: "Official delivery documentation, POD verification status, and regulatory reports.",
    defaultPermissions: [
      "dashboard:view",
      "deliveries:view",
      "pod:view",
      "profitability:view",
      "finance:view",
      "reports:view",
      "settings:view",
    ],
    isArchived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "dept-csr",
    code: "customer_representative",
    name: "Customer Relations",
    description: "Client waybill tracking, drop-off verification, and customer delivery support.",
    defaultPermissions: [
      "dashboard:view",
      "deliveries:view",
      "pod:view",
      "profitability:view",
      "finance:view",
      "reports:view",
      "settings:view",
    ],
    isArchived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __ROUTEX_DEPARTMENT_STORE__: Map<string, DepartmentRecord> | undefined;
}

function getStore(): Map<string, DepartmentRecord> {
  if (!globalThis.__ROUTEX_DEPARTMENT_STORE__) {
    const map = new Map<string, DepartmentRecord>();
    for (const dept of INITIAL_DEPARTMENTS) {
      map.set(dept.id, { ...dept });
    }
    globalThis.__ROUTEX_DEPARTMENT_STORE__ = map;
  }
  return globalThis.__ROUTEX_DEPARTMENT_STORE__;
}

/**
 * Lists departments, optionally filtering out archived departments.
 */
export function listDepartments(includeArchived = false): DepartmentRecord[] {
  const store = getStore();
  const all = Array.from(store.values());
  if (includeArchived) return all;
  return all.filter((d) => !d.isArchived);
}

/**
 * Finds a department by ID or code.
 */
export function findDepartmentById(idOrCode: string): DepartmentRecord | null {
  const store = getStore();
  const direct = store.get(idOrCode);
  if (direct) return { ...direct };

  const normalized = idOrCode.trim().toLowerCase();
  for (const dept of store.values()) {
    if (dept.code.toLowerCase() === normalized || dept.id === idOrCode) {
      return { ...dept };
    }
  }
  return null;
}

/**
 * Creates a new department.
 */
export function createDepartment(input: {
  code?: string;
  name: string;
  description?: string;
  defaultPermissions: readonly Permission[];
}): { ok: true; department: DepartmentRecord } | { ok: false; message: string } {
  const codeClean = (input.code ?? input.name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  if (!codeClean) {
    return { ok: false, message: "Department code or name is required." };
  }
  const nameClean = input.name.trim();
  if (!nameClean) {
    return { ok: false, message: "Department name is required." };
  }

  const store = getStore();
  // Check code uniqueness among active departments
  for (const d of store.values()) {
    if (!d.isArchived && d.code.toLowerCase() === codeClean) {
      return { ok: false, message: `An active department with code "${codeClean}" already exists.` };
    }
  }

  const id = `dept-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const record: DepartmentRecord = {
    id,
    code: codeClean,
    name: nameClean,
    description: (input.description ?? "").trim(),
    defaultPermissions: [...input.defaultPermissions],
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  store.set(id, record);
  return { ok: true, department: { ...record } };
}

/**
 * Modifies an existing department's details or default permissions.
 */
export function updateDepartment(
  id: string,
  input: {
    name?: string;
    description?: string;
    defaultPermissions?: readonly Permission[];
  },
): { ok: true; department: DepartmentRecord } | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(id);
  if (!existing) {
    return { ok: false, message: "Department not found." };
  }

  if (existing.isArchived) {
    return { ok: false, message: "Cannot modify an archived department. Restore it first." };
  }

  if (input.name !== undefined) {
    const nameClean = input.name.trim();
    if (!nameClean) return { ok: false, message: "Department name cannot be blank." };
    existing.name = nameClean;
  }
  if (input.description !== undefined) {
    existing.description = input.description.trim();
  }
  if (input.defaultPermissions !== undefined) {
    existing.defaultPermissions = [...input.defaultPermissions];
  }
  existing.updatedAt = new Date().toISOString();

  return { ok: true, department: { ...existing } };
}

/**
 * Duplicates a department's permission configuration into a new department.
 */
export function duplicateDepartment(
  sourceId: string,
  newCode: string,
  newName: string,
  newDescription?: string,
): { ok: true; department: DepartmentRecord } | { ok: false; message: string } {
  const source = findDepartmentById(sourceId);
  if (!source) {
    return { ok: false, message: "Source department to duplicate was not found." };
  }

  return createDepartment({
    code: newCode,
    name: newName,
    description: newDescription ?? `Duplicated from ${source.name}`,
    defaultPermissions: source.defaultPermissions,
  });
}

/**
 * Archives a department. Members lose active membership and inherited permissions upon archival.
 * Historical membership, department identity, permission config, and audit history remain preserved.
 */
export function archiveDepartment(id: string): { ok: true; department: DepartmentRecord } | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(id);
  if (!existing) {
    return { ok: false, message: "Department not found." };
  }

  if (existing.isArchived) {
    return { ok: false, message: "Department is already archived." };
  }

  existing.isArchived = true;
  existing.archivedAt = new Date().toISOString();
  existing.updatedAt = new Date().toISOString();

  return { ok: true, department: { ...existing } };
}

/**
 * Restores an archived department.
 * Review and configure permissions before restoring an archived department.
 * Previous members are not automatically reassigned when restored.
 */
export function restoreDepartment(
  id: string,
  updatedPermissions?: readonly Permission[],
): { ok: true; department: DepartmentRecord } | { ok: false; message: string } {
  const store = getStore();
  const existing = store.get(id);
  if (!existing) {
    return { ok: false, message: "Department not found." };
  }

  if (!existing.isArchived) {
    return { ok: false, message: "Department is not archived." };
  }

  existing.isArchived = false;
  existing.archivedAt = null;
  if (updatedPermissions) {
    existing.defaultPermissions = [...updatedPermissions];
  }
  existing.updatedAt = new Date().toISOString();

  return { ok: true, department: { ...existing } };
}

/**
 * Reset store for tests.
 */
export function resetDepartmentStoreForTesting(): void {
  const map = new Map<string, DepartmentRecord>();
  for (const dept of INITIAL_DEPARTMENTS) {
    map.set(dept.id, { ...dept });
  }
  globalThis.__ROUTEX_DEPARTMENT_STORE__ = map;
}
