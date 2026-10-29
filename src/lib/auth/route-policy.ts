const publicRoutes = new Set(["/login"]);

export function isPublicRoute(pathname: string): boolean {
  return publicRoutes.has(pathname);
}

export function getLoginRedirectUrl(requestUrl: string): URL {
  const requestedUrl = new URL(requestUrl);
  const loginUrl = new URL("/login", requestedUrl);
  const returnPath = `${requestedUrl.pathname}${requestedUrl.search}`;

  if (returnPath !== "/") {
    loginUrl.searchParams.set("next", returnPath);
  }

  return loginUrl;
}

export function sanitizeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  try {
    const parsed = new URL(value, "https://routex.local");

    if (
      parsed.origin !== "https://routex.local"
      || parsed.pathname === "/"
      || isPublicRoute(parsed.pathname)
    ) {
      return "/dashboard";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/dashboard";
  }
}
