import type { Permission } from "@/lib/auth/rbac";

export type PermissionCategory =
  | "deliveries"
  | "trucks"
  | "finance"
  | "reports"
  | "users"
  | "settings";

export type FriendlyPermissionDefinition = {
  key: Permission;
  title: string;
  description: string;
  category: PermissionCategory;
  categoryLabel: string;
};

export const PERMISSION_CATEGORIES: {
  id: PermissionCategory;
  label: string;
}[] = [
  {
    id: "deliveries",
    label: "Deliveries & Dispatch",
  },
  {
    id: "trucks",
    label: "Fleet & Trucks",
  },
  {
    id: "finance",
    label: "Company Finance",
  },
  {
    id: "reports",
    label: "Reports & Exports",
  },
  {
    id: "users",
    label: "User Management & Audit",
  },
];

export const FRIENDLY_PERMISSIONS: readonly FriendlyPermissionDefinition[] = [
  // 1. Deliveries & Dispatch (Merged Deliveries, Drop-offs, Imports, POD)
  {
    key: "deliveries:view",
    title: "View Deliveries Ledger",
    description: "Browse all delivery trip records, waybill details, client accounts, and schedules.",
    category: "deliveries",
    categoryLabel: "Deliveries & Dispatch",
  },
  {
    key: "deliveries:create",
    title: "Create Delivery Trips (Add)",
    description: "Record new delivery trips, designate clients, assign available trucks, and enter trip dates.",
    category: "deliveries",
    categoryLabel: "Deliveries & Dispatch",
  },
  {
    key: "deliveries:edit",
    title: "Edit Delivery Records (Edit)",
    description: "Modify active delivery records, trip dates, crew assignments, and operational notes.",
    category: "deliveries",
    categoryLabel: "Deliveries & Dispatch",
  },
  {
    key: "deliveries:delete",
    title: "Delete Delivery Records (Delete)",
    description: "Permanently delete delivery trip entries with documented reason in compliance audit history.",
    category: "deliveries",
    categoryLabel: "Deliveries & Dispatch",
  },
  {
    key: "dropoffs:manage",
    title: "Manage Store Drop-offs",
    description: "Add, modify, and sequence multi-stop store drop-off locations and delivery quantities per trip.",
    category: "deliveries",
    categoryLabel: "Deliveries & Dispatch",
  },
  {
    key: "imports:upload",
    title: "Upload Delivery Spreadsheets",
    description: "Upload Excel workbook files (.xlsx, .csv) containing batch delivery schedules for processing.",
    category: "deliveries",
    categoryLabel: "Deliveries & Dispatch",
  },
  {
    key: "imports:review_confirm",
    title: "Review & Commit Imports",
    description: "Review staging data, inspect validation flags, resolve unknown trucks, and commit trips into the ledger.",
    category: "deliveries",
    categoryLabel: "Deliveries & Dispatch",
  },
  {
    key: "pod:view",
    title: "View & Manage Proof of Delivery (POD)",
    description: "Inspect uploaded digital POD documents, customer delivery signatures, and supporting files.",
    category: "deliveries",
    categoryLabel: "Deliveries & Dispatch",
  },

  // 2. Fleet & Trucks
  {
    key: "profitability:view",
    title: "View Fleet & Trucks",
    description: "Analyze financial yield, fuel usage, toll expenses, crew costs, and net margins per fleet truck.",
    category: "trucks",
    categoryLabel: "Fleet & Trucks",
  },
  {
    key: "profitability:manage",
    title: "Add & Edit Trucks (Add / Edit)",
    description: "Register new fleet trucks, maintain ownership classifications (Owned vs Subcontracted), and edit plate records.",
    category: "trucks",
    categoryLabel: "Fleet & Trucks",
  },
  {
    key: "profitability:delete",
    title: "Delete Trucks (Delete)",
    description: "Remove fleet vehicles and assets from the active registry with compliance audit logging.",
    category: "trucks",
    categoryLabel: "Fleet & Trucks",
  },

  // 3. Company Finance
  {
    key: "finance:view",
    title: "View Company Finance",
    description: "View corporate incoming capital, company operating expense ledgers, and financial health summaries.",
    category: "finance",
    categoryLabel: "Company Finance",
  },
  {
    key: "finance:manage",
    title: "Record & Edit Operating Expenses (Add / Edit)",
    description: "Create, edit, and categorize company-level incoming funds and corporate operating overhead.",
    category: "finance",
    categoryLabel: "Company Finance",
  },
  {
    key: "finance:delete",
    title: "Delete Financial Records (Delete)",
    description: "Delete erroneous or voided corporate financial transactions with an audited ledger justification.",
    category: "finance",
    categoryLabel: "Company Finance",
  },

  // 4. Reports & Exports
  {
    key: "reports:view",
    title: "View Operational Reports",
    description: "Generate standard performance reports including revenue breakdown, expense summaries, and daily trips.",
    category: "reports",
    categoryLabel: "Reports & Exports",
  },
  {
    key: "reports:export",
    title: "Export Report Data",
    description: "Download formatted Excel spreadsheets and CSV data tables for external reporting and auditing.",
    category: "reports",
    categoryLabel: "Reports & Exports",
  },

  // 5. User Management & Audit
  {
    key: "users:view",
    title: "View Staff & Audit History",
    description: "Access the employee roster, active personnel accounts, and view the immutable compliance audit trail.",
    category: "users",
    categoryLabel: "User Management & Audit",
  },
  {
    key: "users:manage",
    title: "Add & Edit Users (Add / Edit)",
    description: "Provision staff credentials, manage account lifecycles, and configure role-based access permissions.",
    category: "users",
    categoryLabel: "User Management & Audit",
  },
  {
    key: "users:delete",
    title: "Delete User Accounts (Delete)",
    description: "Deactivate and remove staff accounts permanently with compliance audit logging.",
    category: "users",
    categoryLabel: "User Management & Audit",
  },
];

export const PERMISSION_DEFINITION_MAP = new Map<Permission, FriendlyPermissionDefinition>(
  FRIENDLY_PERMISSIONS.map((def) => [def.key, def]),
);

export function getFriendlyPermission(key: Permission): FriendlyPermissionDefinition {
  const found = PERMISSION_DEFINITION_MAP.get(key);
  if (found) return found;
  return {
    key,
    title: key.replace(/[:_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: "Manage permissions for this operational feature.",
    category: "users",
    categoryLabel: "User Management & Audit",
  };
}
