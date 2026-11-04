/**
 * Temporary access gate for the public UI preview. This is intentionally not
 * a substitute for provider-backed authentication or authorization.
 */
export const PREVIEW_SESSION_COOKIE = "routex-preview-session";

const PREVIEW_USERNAME = "admin";
const PREVIEW_PASSWORD = "admin";
const PREVIEW_SESSION_VALUE = "routex-preview-ui-v1";

export function hasValidPreviewCredentials(username: unknown, password: unknown): boolean {
  if (typeof username !== "string" || typeof password !== "string") {
    return false;
  }

  const u = username.trim().toLowerCase();
  const valid =
    (u === "admin" || u === "admin@routex.local") && (password === "admin" || password === "Admin2026!") ||
    (u === "operations" || u === "operations@routex.local") && (password === "operations" || password === "Ops2026!") ||
    (u === "finance" || u === "finance@routex.local") && (password === "finance" || password === "Finance2026!") ||
    (u === "hr" || u === "hr@routex.local") && (password === "humanresources" || password === "Hr2026!") ||
    (u === "secretary" || u === "secretary@routex.local") && (password === "secretary" || password === "Secretary2026!") ||
    (u === "customerrep" || u === "customerrep@routex.local") && (password === "customerrep" || password === "Csr2026!");

  return valid || (username === PREVIEW_USERNAME && password === PREVIEW_PASSWORD);
}

export function isPreviewSession(value: string | undefined): boolean {
  return value === PREVIEW_SESSION_VALUE;
}

export function getPreviewSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function getPreviewSessionValue(): string {
  return PREVIEW_SESSION_VALUE;
}
