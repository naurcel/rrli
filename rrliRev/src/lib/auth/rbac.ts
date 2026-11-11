/**
 * RouteX Role-Based Access Control (RBAC) Model
 *
 * Revised Scope: Delivery Operations & Truck Profitability
 * Three Access Levels:
 *   1. "admin"      -> Full system & user account management access
 *   2. "operations" -> Delivery, multi-store drop-off, Excel import, POD & profitability access
 *   3. "view_only"  -> Read-only operational & reporting access (Finance, HR, Secretary, Customer Representative)
 */

export const USER_ROLES = [
  "admin",
  "operations",
  "finance",
  "hr",
  "secretary",
  "customer_representative",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ACCESS_LEVELS = ["admin", "operations", "view_only"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const PERMISSIONS = [
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
  "reports:manage_templates",
  "finance:view",
  "finance:manage",
  "users:view",
  "users:manage",
  "settings:view",
  "settings:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type RoleMetadata = {
  role: UserRole;
  label: string;
  accessLevel: AccessLevel;
  accessLevelLabel: string;
  badgeTone: "success" | "warning" | "neutral";
  summary: string;
};

const VIEW_ONLY_PERMISSIONS: readonly Permission[] = [
  "dashboard:view",
  "deliveries:view",
  "pod:view",
  "profitability:view",
  "finance:view",
  "reports:view",
  "settings:view",
] as const;

const OPERATIONS_PERMISSIONS: readonly Permission[] = [
  ...VIEW_ONLY_PERMISSIONS,
  "deliveries:create",
  "deliveries:edit",
  "deliveries:complete",
  "dropoffs:manage",
  "imports:upload",
  "imports:review_confirm",
  "profitability:manage",
  "finance:manage",
  "reports:export",
] as const;

const ADMIN_PERMISSIONS: readonly Permission[] = [
  ...OPERATIONS_PERMISSIONS,
  "reports:manage_templates",
  "users:view",
  "users:manage",
  "settings:manage",
] as const;

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  admin: ADMIN_PERMISSIONS,
  operations: OPERATIONS_PERMISSIONS,
  finance: VIEW_ONLY_PERMISSIONS,
  hr: VIEW_ONLY_PERMISSIONS,
  secretary: VIEW_ONLY_PERMISSIONS,
  customer_representative: VIEW_ONLY_PERMISSIONS,
};

export const ROLE_METADATA: Readonly<Record<UserRole, RoleMetadata>> = {
  admin: {
    role: "admin",
    label: "Admin",
    accessLevel: "admin",
    accessLevelLabel: "Full Access",
    badgeTone: "success",
    summary:
      "Full system access: manage user accounts and roles, import and review Excel trip reports, manage deliveries, multi-store drop-offs, PODs, and truck performance.",
  },
  operations: {
    role: "operations",
    label: "Operations",
    accessLevel: "operations",
    accessLevelLabel: "Operations Write Access",
    badgeTone: "success",
    summary:
      "Create and manage deliveries, manage multi-store drop-offs, import and review Excel trip reports before saving, manage PODs and supporting documents, and view truck performance.",
  },
  finance: {
    role: "finance",
    label: "Finance",
    accessLevel: "view_only",
    accessLevelLabel: "View-Only Access",
    badgeTone: "neutral",
    summary:
      "View-only access to completed deliveries, trip expenses, truck performance, POD verification status, and operational reports.",
  },
  hr: {
    role: "hr",
    label: "HR",
    accessLevel: "view_only",
    accessLevelLabel: "View-Only Access",
    badgeTone: "neutral",
    summary:
      "View-only access to delivery trip records, driver/helper trip allowances and daily rates, and operational summaries.",
  },
  secretary: {
    role: "secretary",
    label: "Secretary",
    accessLevel: "view_only",
    accessLevelLabel: "View-Only Access",
    badgeTone: "neutral",
    summary:
      "View-only access to delivery records, POD document completeness, truck performance summaries, and operational reports.",
  },
  customer_representative: {
    role: "customer_representative",
    label: "Customer Representative",
    accessLevel: "view_only",
    accessLevelLabel: "View-Only Access",
    badgeTone: "neutral",
    summary:
      "View-only access to client delivery records, store drop-offs, waybill statuses, POD verification, and delivery reports.",
  },
};

export function isValidUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function getAccessLevelForRole(role: UserRole): AccessLevel {
  return ROLE_METADATA[role].accessLevel;
}

export function getRoleMetadata(role: UserRole): RoleMetadata {
  return ROLE_METADATA[role];
}

export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canMutateDeliveryRecords(role: UserRole): boolean {
  return hasPermission(role, "deliveries:create") && hasPermission(role, "deliveries:edit");
}

export function canImportAndReviewExcel(role: UserRole): boolean {
  return hasPermission(role, "imports:upload") && hasPermission(role, "imports:review_confirm");
}

export function canManageDocuments(role: UserRole): boolean {
  return canMutateDeliveryRecords(role);
}

/**
 * @deprecated Verification workflow removed. Retained as permission check alias for document write access.
 */
export function canVerifyPodDocuments(role: UserRole): boolean {
  return canManageDocuments(role);
}

export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, "users:manage");
}

export function canManageTrucks(role: UserRole): boolean {
  return hasPermission(role, "profitability:manage");
}

export function canManageDrivers(role: UserRole): boolean {
  return canMutateDeliveryRecords(role);
}

export function canManageReportTemplates(role: UserRole): boolean {
  return hasPermission(role, "reports:manage_templates");
}

export function canManageCompanyExpenses(role: UserRole): boolean {
  return hasPermission(role, "finance:manage");
}

export type NavigationSection = "primary" | "management";

export type NavigationItem = {
  readonly label: string;
  readonly href: string;
  readonly symbol: string;
  readonly section: NavigationSection;
  readonly requiredPermission: Permission;
};

export const WORKSPACE_NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    symbol: "\u2302",
    section: "primary",
    requiredPermission: "dashboard:view",
  },
  {
    label: "Deliveries",
    href: "/deliveries",
    symbol: "\u25a4",
    section: "primary",
    requiredPermission: "deliveries:view",
  },
  {
    label: "Trucks",
    href: "/truck-profitability",
    symbol: "\u25b1",
    section: "primary",
    requiredPermission: "profitability:view",
  },
  {
    label: "Finance",
    href: "/finance",
    symbol: "\u25c8",
    section: "primary",
    requiredPermission: "finance:view",
  },
  {
    label: "Reports",
    href: "/reports",
    symbol: "\u25a5",
    section: "primary",
    requiredPermission: "reports:view",
  },
  {
    label: "User Management",
    href: "/user-management",
    symbol: "\u25ce",
    section: "management",
    requiredPermission: "users:view",
  },
] as const;

export function getAuthorizedNavigationForRole(role: UserRole): {
  primary: readonly NavigationItem[];
  management: readonly NavigationItem[];
} {
  const allowed = WORKSPACE_NAVIGATION_ITEMS.filter((item) =>
    hasPermission(role, item.requiredPermission),
  );

  return {
    primary: allowed.filter((item) => item.section === "primary"),
    management: allowed.filter((item) => item.section === "management"),
  };
}

