import { hasPermission, type Permission, type UserRole } from "./rbac.ts";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/forgot-password",
]);

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/**
 * Maps a workspace pathname to the server-side permission required to access it.
 * Used both at the request proxy boundary and inside server-rendered pages/APIs.
 */
export function getRequiredPermissionForPath(pathname: string): Permission | null {
  if (isPublicRoute(pathname)) {
    return null;
  }

  if (pathname === "/user-management" || pathname.startsWith("/user-management/") || pathname.startsWith("/api/users")) {
    return "users:manage";
  }

  if (pathname.startsWith("/api/audit")) {
    return "users:manage";
  }

  if (pathname === "/deliveries/import" || pathname.startsWith("/deliveries/import/") || pathname.startsWith("/api/deliveries/import")) {
    return "imports:upload";
  }

  if (pathname === "/deliveries/new" || pathname.startsWith("/deliveries/new/")) {
    return "deliveries:create";
  }

  if (pathname === "/deliveries" || pathname.startsWith("/deliveries/")) {
    return "deliveries:view";
  }

  if (pathname === "/truck-profitability" || pathname.startsWith("/truck-profitability/")) {
    return "profitability:view";
  }

  if (pathname === "/pod-documents" || pathname.startsWith("/pod-documents/")) {
    return "pod:view";
  }

  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return "reports:view";
  }

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "settings:view";
  }

  return "dashboard:view";
}

export function canRoleAccessPath(role: UserRole, pathname: string): boolean {
  const requiredPermission = getRequiredPermissionForPath(pathname);
  if (!requiredPermission) {
    return true;
  }

  return hasPermission(role, requiredPermission);
}

export function getLoginRedirectUrl(requestUrl: string): URL {
  const requestedUrl = new URL(requestUrl);
  const loginUrl = new URL("/login", requestedUrl);
  const returnPath = `${requestedUrl.pathname}${requestedUrl.search}`;

  if (returnPath !== "/" && !isPublicRoute(requestedUrl.pathname)) {
    loginUrl.searchParams.set("next", returnPath);
  }

  return loginUrl;
}

export function sanitizeReturnPath(value: string | null | undefined, role?: UserRole): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  try {
    const parsed = new URL(value, "https://routex.local");

    if (
      parsed.origin !== "https://routex.local" ||
      parsed.pathname === "/" ||
      isPublicRoute(parsed.pathname)
    ) {
      return "/dashboard";
    }

    if (role && !canRoleAccessPath(role, parsed.pathname)) {
      return "/dashboard";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/dashboard";
  }
}

