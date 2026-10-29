import * as z from "zod";

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type SignInFields = z.infer<typeof signInSchema>;
export type AuthenticationMode = "supabase" | "preview" | "unavailable";

export function getAuthenticationMode(options: {
  isSupabaseConfigured: boolean;
  nodeEnvironment: string | undefined;
}): AuthenticationMode {
  if (options.isSupabaseConfigured) {
    return "supabase";
  }

  return options.nodeEnvironment === "development" ? "preview" : "unavailable";
}
