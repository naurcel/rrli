import * as z from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.")
    .refine(
      (value) =>
        (value.startsWith("https://") || value.startsWith("http://")) &&
        !value.includes("your-project-ref.supabase.co"),
      {
        message: "NEXT_PUBLIC_SUPABASE_URL must be a configured HTTP or HTTPS Supabase URL.",
      },
    ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.")
    .refine((value) => value !== "your-publishable-key", {
      message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must not be the placeholder value.",
    }),
});

export type PublicEnvironment = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export type PublicEnvironmentSource = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

function decodeJwtPayloadRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded =
      typeof Buffer !== "undefined"
        ? Buffer.from(padded, "base64").toString("utf8")
        : atob(padded);
    const parsed = JSON.parse(decoded) as { role?: unknown };
    return typeof parsed.role === "string" ? parsed.role : null;
  } catch {
    return null;
  }
}

export function isServiceRoleKey(key: string): boolean {
  const trimmed = key.trim();
  if (trimmed.startsWith("sb_secret_")) {
    return true;
  }

  return decodeJwtPayloadRole(trimmed) === "service_role";
}

function runtimePublicEnvironment(): PublicEnvironmentSource {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function parsePublicEnvironment(
  source: PublicEnvironmentSource,
): PublicEnvironment {
  const resolvedKey =
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    source.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (typeof resolvedKey === "string" && isServiceRoleKey(resolvedKey)) {
    throw new Error(
      "SECURITY_VIOLATION: Never use a Supabase service_role or secret key in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  const parsed = publicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: resolvedKey,
  });

  if (!parsed.success) {
    const invalidVariables = Array.from(
      new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ).join(", ");

    throw new Error(
      `RouteX environment configuration is invalid: ${invalidVariables}. See .env.example.`,
    );
  }

  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function getPublicEnvironment(): PublicEnvironment {
  return parsePublicEnvironment(runtimePublicEnvironment());
}

export function isSupabaseConfigured(
  source: PublicEnvironmentSource = runtimePublicEnvironment(),
): boolean {
  const resolvedKey =
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    source.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (typeof resolvedKey === "string" && isServiceRoleKey(resolvedKey)) {
    return false;
  }

  return publicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: resolvedKey,
  }).success;
}

