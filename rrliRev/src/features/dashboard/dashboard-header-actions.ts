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
): { primary: DashboardRoleAction; secondary: DashboardRoleAction } {
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

  // 2. Admin / President: system oversight & user onboarding
  if (normRole === "admin" || isSuperadmin) {
    return {
      secondary: {
        label: "Record delivery",
        href: withReturnContext("/deliveries/new", currentDashboardUrl, "Dashboard"),
        variant: "secondary",
        ariaLabel: "Record a completed delivery and its trip details",
      },
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

  // 4. HR: crew allowances, driver records, operational reports
  if (normRole === "hr") {
    return {
      secondary: {
        label: "View reports",
        href: withReturnContext("/reports", currentDashboardUrl, "Dashboard"),
        variant: "secondary",
        ariaLabel: "View company and operational reports",
      },
      primary: {
        label: "Drivers & crew",
        href: withReturnContext("/drivers", currentDashboardUrl, "Dashboard"),
        variant: "primary",
        ariaLabel: "Manage and review drivers and crew members",
      },
    };
  }

  // 5. Secretary: document compliance, POD verification, manifests
  if (normRole === "secretary") {
    return {
      secondary: {
        label: "View deliveries",
        href: withReturnContext("/deliveries", currentDashboardUrl, "Dashboard"),
        variant: "secondary",
        ariaLabel: "View delivery records",
      },
      primary: {
        label: "Verify PODs",
        href: withReturnContext("/pod-documents", currentDashboardUrl, "Dashboard"),
        variant: "primary",
        ariaLabel: "Review and verify proof of delivery documents",
      },
    };
  }

  // 6. Customer Representative: shipment inquiry, waybills, client tracking
  if (normRole === "customer_representative") {
    return {
      secondary: {
        label: "Track PODs",
        href: withReturnContext("/pod-documents", currentDashboardUrl, "Dashboard"),
        variant: "secondary",
        ariaLabel: "Review proof of delivery files",
      },
      primary: {
        label: "Search deliveries",
        href: withReturnContext("/deliveries", currentDashboardUrl, "Dashboard"),
        variant: "primary",
        ariaLabel: "Search client deliveries and waybills",
      },
    };
  }

  // 7. General Custom Roles or Generic Write vs View-Only Fallback
  if (canWriteDeliveries) {
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

  return {
    secondary: {
      label: "View reports",
      href: withReturnContext("/reports", currentDashboardUrl, "Dashboard"),
      variant: "secondary",
      ariaLabel: "View operational reports",
    },
    primary: {
      label: "View deliveries",
      href: withReturnContext("/deliveries", currentDashboardUrl, "Dashboard"),
      variant: "primary",
      ariaLabel: "Browse delivery records",
    },
  };
}
