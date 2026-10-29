import * as z from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.")
    .refine((value) => value.startsWith("https://") || value.startsWith("http://"), {
      message: "NEXT_PUBLIC_SUPABASE_URL must use HTTP or HTTPS.",
    }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required."),
});

export type PublicEnvironment = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export type PublicEnvironmentSource = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
};

function runtimePublicEnvironment(): PublicEnvironmentSource {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function parsePublicEnvironment(
  source: PublicEnvironmentSource,
): PublicEnvironment {
  const parsed = publicEnvironmentSchema.safeParse(source);

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
  return publicEnvironmentSchema.safeParse(source).success;
}
