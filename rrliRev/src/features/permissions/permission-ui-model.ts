import type { Permission } from "@/lib/auth/rbac";

export type PermissionCategory =
  | "deliveries"
  | "imports"
  | "pod"
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
  description: string;
}[] = [
  {
    id: "deliveries",
    label: "Deliveries",
    description: "Daily trips, drop-offs, assignments, and waybill records.",
  },
  {
    id: "imports",
    label: "Imports",
    description: "Spreadsheet uploads, review, and data imports.",
  },
  {
    id: "pod",
    label: "Proof of Delivery",
    description: "Delivery receipts, signed waybills, and attachments.",
  },
  {
    id: "finance",
    label: "Finance",
    description: "Company expenses, cashflow ledgers, and trip pricing.",
  },
  {
    id: "reports",
    label: "Reports",
    description: "Operational performance metrics and data exports.",
  },
  {
    id: "users",
    label: "Users",
    description: "Staff accounts, security, and role permissions.",
  },
  {
    id: "settings",
    label: "Settings",
    description: "System parameters and organization preferences.",
  },
];

export const FRIENDLY_PERMISSIONS: readonly FriendlyPermissionDefinition[] = [
  // 1. Deliveries
  {
    key: "deliveries:view",
    title: "View Deliveries",
    description: "Browse the delivery list, filter trips, and view trip details.",
    category: "deliveries",
    categoryLabel: "Deliveries",
  },
  {
    key: "deliveries:create",
    title: "Create Deliveries",
    description: "Record new delivery trips and assign trucks, drivers, and helpers.",
    category: "deliveries",
    categoryLabel: "Deliveries",
  },
  {
    key: "deliveries:edit",
    title: "Edit Deliveries",
    description: "Update client details, truck assignments, crew members, and delivery notes.",
    category: "deliveries",
    categoryLabel: "Deliveries",
  },
  {
    key: "deliveries:complete",
    title: "Finalize Deliveries",
    description: "Lock delivery billing amounts and mark trips completed.",
    category: "deliveries",
    categoryLabel: "Deliveries",
  },
  {
    key: "dropoffs:manage",
    title: "Manage Delivery Locations & Drop-offs",
    description: "Add and update delivery locations and stop counts within a trip.",
    category: "deliveries",
    categoryLabel: "Deliveries",
  },

  // 2. Imports
  {
    key: "imports:upload",
    title: "Upload Spreadsheets",
    description: "Upload Excel daily trip files to the staging review area.",
    category: "imports",
    categoryLabel: "Imports",
  },
  {
    key: "imports:review_confirm",
    title: "Review & Commit Imports",
    description: "Validate staged records and commit imported deliveries.",
    category: "imports",
    categoryLabel: "Imports",
  },

  // 3. Proof of Delivery
  {
    key: "pod:view",
    title: "View Proof of Delivery",
    description: "View customer-signed receipts, invoices, and waybill images.",
    category: "pod",
    categoryLabel: "Proof of Delivery",
  },

  // 4. Finance
  {
    key: "finance:view",
    title: "View Finance Ledgers",
    description: "View incoming and outgoing transactions and expense ledgers.",
    category: "finance",
    categoryLabel: "Finance",
  },
  {
    key: "finance:manage",
    title: "Manage Transactions",
    description: "Add, edit, or delete company expenses and cash movements.",
    category: "finance",
    categoryLabel: "Finance",
  },
  {
    key: "profitability:view",
    title: "View Profitability",
    description: "View revenue, operational costs, and trip profit margins.",
    category: "finance",
    categoryLabel: "Finance",
  },
  {
    key: "profitability:manage",
    title: "Manage Rates & Pricing",
    description: "Update client rates, drop-off charges, and fee deductions.",
    category: "finance",
    categoryLabel: "Finance",
  },

  // 5. Reports
  {
    key: "reports:view",
    title: "View Reports",
    description: "View monthly summaries, trip volume charts, and analytics.",
    category: "reports",
    categoryLabel: "Reports",
  },
  {
    key: "reports:export",
    title: "Export Data",
    description: "Download Excel reports for deliveries and financial logs.",
    category: "reports",
    categoryLabel: "Reports",
  },
  {
    key: "reports:manage_templates",
    title: "Manage Templates",
    description: "Configure report templates and export column presets.",
    category: "reports",
    categoryLabel: "Reports",
  },

  // 6. Users
  {
    key: "users:view",
    title: "View Staff Accounts",
    description: "View employee profiles, departments, and assigned roles.",
    category: "users",
    categoryLabel: "Users",
  },
  {
    key: "users:manage",
    title: "Manage Staff & Permissions",
    description: "Create accounts, authorize password resets, and adjust permissions.",
    category: "users",
    categoryLabel: "Users",
  },

  // 7. Settings
  {
    key: "settings:view",
    title: "View Settings",
    description: "View organization preferences and profile settings.",
    category: "settings",
    categoryLabel: "Settings",
  },
  {
    key: "settings:manage",
    title: "Manage Configuration",
    description: "Update system configuration and organization parameters.",
    category: "settings",
    categoryLabel: "Settings",
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
    description: `Allows system access to ${key}.`,
    category: "settings",
    categoryLabel: "Settings",
  };
}
