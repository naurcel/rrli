import { withReturnContext } from "../../lib/navigation/return-context.ts";

export type DashboardRoleAction = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
  ariaLabel: string;
};

export function getRoleDashboardActions(
  role: string | undefined,
  isSuperadmin: boolean | undefined,
  _canWriteDeliveries: boolean,
  currentDashboardUrl: string,
): { primary: DashboardRoleAction | null; secondary: DashboardRoleAction | null } {
  const normRole = (role || "").toLowerCase().trim();

  // 1. Superadmin & Admin: [Manage permissions] [Add user]
  if (isSuperadmin || normRole === "superadmin" || normRole === "admin") {
    return {
      secondary: {
        label: "Manage permissions",
        href: withReturnContext("/user-management#permissions", currentDashboardUrl, "Dashboard"),
        variant: "secondary",
        ariaLabel: "Manage role and user permissions",
      },
      primary: {
        label: "Add user",
        href: withReturnContext("/user-management#add-user", currentDashboardUrl, "Dashboard"),
        variant: "primary",
        ariaLabel: "Add and provision a new staff user account",
      },
    };
  }

  // 2. Operations: [Import] [Record delivery] (stay the same)
  if (normRole === "operations") {
    return {
      secondary: {
        label: "Import",
        href: withReturnContext("/deliveries/import", currentDashboardUrl, "Dashboard"),
        variant: "secondary",
        ariaLabel: "Import an Excel trip report",
      },
      primary: {
        label: "Record delivery",
        href: withReturnContext("/deliveries/new", currentDashboardUrl, "Dashboard"),
        variant: "primary",
        ariaLabel: "Record a completed delivery and its trip details",
      },
    };
  }

  // 3. Finance: [Import transactions] [Record transaction]
  if (normRole === "finance") {
    return {
      secondary: {
        label: "Import transactions",
        href: withReturnContext("/finance/import", currentDashboardUrl, "Dashboard"),
        variant: "secondary",
        ariaLabel: "Import company finance transactions spreadsheet",
      },
      primary: {
        label: "Record transaction",
        href: withReturnContext("/finance?record=1", currentDashboardUrl, "Dashboard"),
        variant: "primary",
        ariaLabel: "Record a company expense or income transaction",
      },
    };
  }

  // 4. All other roles (HR, Secretary, Customer Rep, and any other roles) have no dashboard quick action buttons
  return {
    secondary: null,
    primary: null,
  };
}
