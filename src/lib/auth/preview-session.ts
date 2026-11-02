/**
 * Temporary access gate for the public UI preview. This is intentionally not
 * a substitute for provider-backed authentication or authorization.
 */
export const PREVIEW_SESSION_COOKIE = "routex-preview-session";

const PREVIEW_USERNAME = "admin";
const PREVIEW_PASSWORD = "admin";
const PREVIEW_SESSION_VALUE = "routex-preview-ui-v1";

export function hasValidPreviewCredentials(username: unknown, password: unknown): boolean {
  return username === PREVIEW_USERNAME && password === PREVIEW_PASSWORD;
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
