import type { Permission } from "@/lib/auth/rbac";

export type PermissionCategory =
  | "dashboard"
  | "deliveries"
  | "dropoffs"
  | "imports"
  | "pod"
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
    id: "dashboard",
    label: "Dashboard",
  },
  {
    id: "deliveries",
    label: "Deliveries",
  },
  {
    id: "dropoffs",
    label: "Store Drop-offs",
  },
  {
    id: "imports",
    label: "Delivery Import",
  },
  {
    id: "pod",
    label: "Proof of Delivery & Documents",
  },
  {
    id: "trucks",
    label: "Trucks & Profitability",
  },
  {
    id: "finance",
    label: "Company Finance",
  },
  {
    id: "reports",
    label: "Reports",
  },
  {
    id: "users",
    label: "User Management & Audit",
  },
  {
    id: "settings",
    label: "Profile Settings & System",
  },
];

export const FRIENDLY_PERMISSIONS: readonly FriendlyPermissionDefinition[] = [
  // 1. Dashboard
  {
    key: "dashboard:view",
    title: "View Operational Dashboard",
    description: "Access high-level operations summaries, active deliveries, and real-time KPI overview.",
    category: "dashboard",
    categoryLabel: "Dashboard",
  },

  // 2. Deliveries
  {
    key: "deliveries:view",
    title: "View Deliveries Ledger",
    description: "Browse all delivery trip records, waybill details, client accounts, and schedules.",
    category: "deliveries",
    categoryLabel: "Deliveries",
  },
  {
    key: "deliveries:create",
    title: "Create Delivery Trips",
    description: "Record new delivery trips, designate clients, assign available trucks, and enter trip dates.",
    category: "deliveries",
    categoryLabel: "Deliveries",
  },
  {
    key: "deliveries:edit",
    title: "Edit Delivery Records",
    description: "Modify active delivery records, trip dates, crew assignments, and operational notes.",
    category: "deliveries",
    categoryLabel: "Deliveries",
  },
  {
    key: "deliveries:complete",
    title: "Finalize Deliveries",
    description: "Lock and finalize verified delivery trips, confirming trip completion and expense reconciliations.",
    category: "deliveries",
    categoryLabel: "Deliveries",
  },

  // 3. Store Drop-offs
  {
    key: "dropoffs:manage",
    title: "Manage Store Drop-offs",
    description: "Add, modify, and sequence multi-stop store drop-off locations and delivery quantities per trip.",
    category: "dropoffs",
    categoryLabel: "Store Drop-offs",
  },

  // 4. Delivery Import
  {
    key: "imports:upload",
    title: "Upload Delivery Spreadsheets",
    description: "Upload Excel workbook files (.xlsx, .csv) containing batch delivery schedules for processing.",
    category: "imports",
    categoryLabel: "Delivery Import",
  },
  {
    key: "imports:review_confirm",
    title: "Review & Commit Imports",
    description: "Review staging data, inspect validation flags, resolve unknown trucks, and commit trips into the ledger.",
    category: "imports",
    categoryLabel: "Delivery Import",
  },

  // 5. POD and Documents
  {
    key: "pod:view",
    title: "View & Manage Proof of Delivery (POD)",
    description: "Inspect uploaded digital POD documents, customer delivery signatures, and timestamped receipts.",
    category: "pod",
    categoryLabel: "Proof of Delivery & Documents",
  },

  // 6. Trucks and Profitability
  {
    key: "profitability:view",
    title: "View Truck Profitability",
    description: "Analyze financial yield, fuel usage, toll expenses, crew costs, and net margins per fleet truck.",
    category: "trucks",
    categoryLabel: "Trucks & Profitability",
  },
  {
    key: "profitability:manage",
    title: "Manage Fleet & Trucks",
    description: "Register new trucks, maintain ownership classifications (Owned vs Subcontracted), and edit plate records.",
    category: "trucks",
    categoryLabel: "Trucks & Profitability",
  },

  // 7. Company Finance (Strictly Company-level: Income, Expenses)
  {
    key: "finance:view",
    title: "View Company Finance",
    description: "View corporate incoming capital, company operating expense ledgers, and financial health summaries.",
    category: "finance",
    categoryLabel: "Company Finance",
  },
  {
    key: "finance:manage",
    title: "Record & Manage Company Expenses",
    description: "Create, edit, and categorize company-level incoming funds and corporate operating overhead.",
    category: "finance",
    categoryLabel: "Company Finance",
  },

  // 8. Reports (No Report Templates)
  {
    key: "reports:view",
    title: "View Operational Reports",
    description: "Generate standard performance reports including revenue breakdown, expense summaries, and daily trips.",
    category: "reports",
    categoryLabel: "Reports",
  },
  {
    key: "reports:export",
    title: "Export Report Data",
    description: "Download formatted Excel spreadsheets and CSV data tables for external reporting and auditing.",
    category: "reports",
    categoryLabel: "Reports",
  },

  // 9. User Management & Audit History
  {
    key: "users:view",
    title: "View Staff & Audit History",
    description: "Access the employee roster, active personnel accounts, and view the immutable compliance audit trail.",
    category: "users",
    categoryLabel: "User Management & Audit",
  },
  {
    key: "users:manage",
    title: "Manage Users & Role Permissions",
    description: "Provision staff credentials, manage account lifecycles, and configure role-based access permissions.",
    category: "users",
    categoryLabel: "User Management & Audit",
  },

  // 10. Profile Settings & System
  {
    key: "settings:view",
    title: "View Profile & Security Settings",
    description: "Access user profile configuration, avatar management, and security question settings.",
    category: "settings",
    categoryLabel: "Profile Settings & System",
  },
  {
    key: "settings:manage",
    title: "Manage Workspace Configuration",
    description: "Configure workspace design preferences, appearance themes, and generate emergency backup keys.",
    category: "settings",
    categoryLabel: "Profile Settings & System",
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
    category: "settings",
    categoryLabel: "Profile Settings & System",
  };
}
