import { createHmac, timingSafeEqual } from "node:crypto";

export const VERIFIED_SESSION_COOKIE = "routex_verified_session";
export const DEFAULT_SESSION_DURATION_MS = 1000 * 60 * 60 * 12; // 12 hours
export const REMEMBER_ME_SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type SignedSessionPayload = {
  sub: string;
  iat: number;
  exp: number;
  rem: boolean;
};

function getSigningSecret(overrideSecret?: string): string {
  const secret = overrideSecret ?? process.env.ROUTEX_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SECURITY_VIOLATION: ROUTEX_SESSION_SECRET environment variable is required in production.",
      );
    }
    return "routex-server-only-hmac-secret-2026-delivery-profitability";
  }
  return secret;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function computeSignature(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createSignedSessionToken(
  options: {
    userId: string;
    rememberMe?: boolean;
    nowMs?: number;
    durationMs?: number;
  },
  secretOverride?: string,
): string {
  const nowMs = options.nowMs ?? Date.now();
  const rememberMe = Boolean(options.rememberMe);
  const durationMs =
    options.durationMs ??
    (rememberMe ? REMEMBER_ME_SESSION_DURATION_MS : DEFAULT_SESSION_DURATION_MS);

  const payload: SignedSessionPayload = {
    sub: options.userId,
    iat: nowMs,
    exp: nowMs + durationMs,
    rem: rememberMe,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = computeSignature(encodedPayload, getSigningSecret(secretOverride));

  return `${encodedPayload}.${signature}`;
}

export function verifySignedSessionToken(
  token: string | undefined | null,
  options?: {
    nowMs?: number;
    secretOverride?: string;
  },
): SignedSessionPayload | null {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, providedSignature] = parts;
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = computeSignature(
    encodedPayload,
    getSigningSecret(options?.secretOverride),
  );

  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<SignedSessionPayload>;

    if (
      typeof parsed.sub !== "string" ||
      !parsed.sub.trim() ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.rem !== "boolean"
    ) {
      return null;
    }

    const nowMs = options?.nowMs ?? Date.now();
    if (nowMs >= parsed.exp) {
      return null;
    }

    return {
      sub: parsed.sub,
      iat: parsed.iat,
      exp: parsed.exp,
      rem: parsed.rem,
    };
  } catch {
    return null;
  }
}

export function getSessionCookieOptions(rememberMe: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(rememberMe
      ? { maxAge: Math.floor(REMEMBER_ME_SESSION_DURATION_MS / 1000) }
      : {}),
  };
}

