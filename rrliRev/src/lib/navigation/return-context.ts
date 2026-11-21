/**
 * Shared Back & Return Navigation Context Utility for RouteX.
 *
 * Ensures that whenever a user opens a record, detail view, or form from any
 * workspace entry point (Dashboard, Deliveries, Trucks, Crew, POD Documents,
 * Finance, etc.), the Back button returns them to the exact originating URL
 * and state (search, filters, sorting, date range, pagination, and active tab).
 */

export function isValidInternalReturnPath(
  candidate: string | null | undefined,
): candidate is string {
  if (!candidate || typeof candidate !== "string") return false;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false;
  return true;
}

export function deriveReturnLabel(
  returnTo: string | null | undefined,
  explicitLabel?: string | null,
  fallbackLabel = "Back to Deliveries",
): string {
  if (explicitLabel && explicitLabel.trim()) {
    const clean = explicitLabel.trim();
    if (/^(←\s*)?back\b/i.test(clean)) {
      return clean.replace(/^←\s*/, "");
    }
    return `Back to ${clean}`;
  }

  if (!isValidInternalReturnPath(returnTo)) {
    return fallbackLabel;
  }

  const [pathname, query = ""] = returnTo.split("?");
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "Back to Dashboard";
  }
  if (pathname.startsWith("/truck-profitability/")) {
    const segment = pathname.slice("/truck-profitability/".length).split("/")[0];
    if (segment) {
      try {
        return `Back to ${decodeURIComponent(segment).toUpperCase()}`;
      } catch {
        return `Back to ${segment.toUpperCase()}`;
      }
    }
    return "Back to Trucks";
  }
  if (pathname === "/truck-profitability") {
    const searchParams = new URLSearchParams(query);
    if (searchParams.get("view") === "crew" || searchParams.has("crewQ") || searchParams.has("crewRole")) {
      return "Back to Crew";
    }
    return "Back to Trucks";
  }
  if (pathname.startsWith("/deliveries/")) {
    return "Back to Delivery";
  }
  if (pathname === "/deliveries") {
    return "Back to Deliveries";
  }
  if (pathname === "/finance" || pathname.startsWith("/finance/")) {
    return "Back to Finance";
  }
  if (pathname === "/pod-documents" || pathname.startsWith("/pod-documents/")) {
    return "Back to POD Documents";
  }
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return "Back to Reports";
  }
  if (pathname === "/user-management" || pathname.startsWith("/user-management/")) {
    return "Back to User Management";
  }
  if (pathname === "/permissions" || pathname.startsWith("/permissions/")) {
    return "Back to Permissions";
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "Back to Settings";
  }

  return fallbackLabel;
}

export function resolveReturnTarget(options: {
  returnTo?: string | null;
  returnLabel?: string | null;
  fallbackHref: string;
  fallbackLabel: string;
}): { href: string; label: string } {
  const { returnTo, returnLabel, fallbackHref, fallbackLabel } = options;
  if (isValidInternalReturnPath(returnTo)) {
    return {
      href: returnTo.trim(),
      label: deriveReturnLabel(returnTo, returnLabel, fallbackLabel),
    };
  }
  return {
    href: fallbackHref,
    label: fallbackLabel,
  };
}

export function withReturnContext(
  targetPath: string,
  returnTo?: string | null,
  returnLabel?: string | null,
): string {
  if (!isValidInternalReturnPath(returnTo)) {
    return targetPath;
  }
  const [basePath, existingQuery = ""] = targetPath.split("?");
  const params = new URLSearchParams(existingQuery);
  params.set("returnTo", returnTo);
  if (returnLabel && returnLabel.trim()) {
    params.set("returnLabel", returnLabel.trim());
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function appendQueryParam(
  url: string,
  key: string,
  value: string,
): string {
  const [basePath, existingQuery = ""] = url.split("?");
  const params = new URLSearchParams(existingQuery);
  params.set(key, value);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
