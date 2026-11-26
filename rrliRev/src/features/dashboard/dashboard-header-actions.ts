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
  canWriteDeliveries: boolean,
  currentDashboardUrl: string,
): { primary: DashboardRoleAction | null; secondary: DashboardRoleAction | null } {
  const normRole = (role || "").toLowerCase().trim();

  // 1. Finance: manages expenses & income transactions
  if (normRole === "finance") {
    return {
      secondary: {
        label: "Import",
        href: withReturnContext("/finance/import", currentDashboardUrl, "Dashboard"),
        variant: "secondary",
        ariaLabel: "Import company expenses spreadsheet",
      },
      primary: {
        label: "Record expense / income",
        href: withReturnContext("/finance?record=1", currentDashboardUrl, "Dashboard"),
        variant: "primary",
        ariaLabel: "Record a company expense or income transaction",
      },
    };
  }

  // 2. Admin / Superadmin: system oversight & user onboarding (no record delivery quick action)
  if (normRole === "admin" || isSuperadmin) {
    return {
      secondary: null,
      primary: {
        label: "Add user",
        href: withReturnContext("/user-management#add-user", currentDashboardUrl, "Dashboard"),
        variant: "primary",
        ariaLabel: "Add and provision a new staff user account",
      },
    };
  }

  // 3. Operations: fleet dispatch & trip manifests
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

  // 4. View-only and primarily review roles: HR, Secretary, Customer Rep have no dashboard quick actions
  if (
    normRole === "hr" ||
    normRole === "secretary" ||
    normRole === "customer_representative" ||
    !canWriteDeliveries
  ) {
    return {
      secondary: null,
      primary: null,
    };
  }

  // 5. Custom roles with write permissions
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
