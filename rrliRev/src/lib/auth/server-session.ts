import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  getAccessLevelForRole,
  getPermissionsForRole,
  getRoleMetadata,
  hasPermission,
  isValidUserRole,
  type AccessLevel,
  type Permission,
  type UserRole,
} from "./rbac";
import {
  findServerAccountByEmail,
  findServerAccountById,
} from "./server-account-store";
import {
  VERIFIED_SESSION_COOKIE,
  verifySignedSessionToken,
} from "./session-token";

export type AuthProviderMode = "supabase" | "server-local";

export type AuthenticatedActor = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  roleLabel: string;
  accessLevel: AccessLevel;
  accessLevelLabel: string;
  permissions: readonly Permission[];
  providerMode: AuthProviderMode;
};

export function getAuthProviderMode(): AuthProviderMode {
  return isSupabaseConfigured() ? "supabase" : "server-local";
}

function buildAuthenticatedActor(params: {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  providerMode: AuthProviderMode;
}): AuthenticatedActor {
  const meta = getRoleMetadata(params.role);

  return {
    id: params.id,
    email: params.email,
    fullName: params.fullName,
    role: params.role,
    roleLabel: meta.label,
    accessLevel: getAccessLevelForRole(params.role),
    accessLevelLabel: meta.accessLevelLabel,
    permissions: getPermissionsForRole(params.role),
    providerMode: params.providerMode,
  };
}

/**
 * Resolves the current authenticated user and their database-assigned role on the server.
 * Never trusts client-supplied role parameters or user_metadata.
 */
export async function getAuthenticatedActor(): Promise<AuthenticatedActor | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || !user.email) {
        return null;
      }

      // 1. Primary source of truth: public.user_profiles table in Supabase PostgreSQL
      const { data: profileRow, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileError && profileRow) {
        if (!profileRow.is_active || !isValidUserRole(profileRow.role)) {
          return null;
        }

        return buildAuthenticatedActor({
          id: profileRow.id,
          email: profileRow.email || user.email,
          fullName: profileRow.full_name || user.email.split("@")[0],
          role: profileRow.role,
          providerMode: "supabase",
        });
      }

      // 2. Trusted admin-only app_metadata fallback (if user_profiles table is being initialized)
      const adminAssignedRole = user.app_metadata?.role;
      const adminAssignedActive = user.app_metadata?.is_active ?? true;
      if (adminAssignedActive !== false && isValidUserRole(adminAssignedRole)) {
        const displayName =
          typeof user.app_metadata?.full_name === "string"
            ? user.app_metadata.full_name
            : user.email.split("@")[0];

        return buildAuthenticatedActor({
          id: user.id,
          email: user.email,
          fullName: displayName,
          role: adminAssignedRole,
          providerMode: "supabase",
        });
      }

      // 3. Fallback email match in server account registry if migrating initial accounts
      const matchedSeed = findServerAccountByEmail(user.email);
      if (matchedSeed && matchedSeed.isActive) {
        return buildAuthenticatedActor({
          id: user.id,
          email: user.email,
          fullName: matchedSeed.fullName,
          role: matchedSeed.role,
          providerMode: "supabase",
        });
      }

      return null;
    } catch {
      return null;
    }
  }

  // Server-verified signed HttpOnly session token (when Supabase env vars are not yet configured)
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(VERIFIED_SESSION_COOKIE)?.value;
  const verifiedPayload = verifySignedSessionToken(rawToken);

  if (!verifiedPayload) {
    return null;
  }

  const account = findServerAccountById(verifiedPayload.sub);
  if (!account || !account.isActive) {
    return null;
  }

  return buildAuthenticatedActor({
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    role: account.role,
    providerMode: "server-local",
  });
}

/**
 * Enforces authentication in Server Components / Layouts.
 * Redirects unauthenticated or deactivated sessions to /login.
 */
export async function requireAuthenticatedActor(): Promise<AuthenticatedActor> {
  const actor = await getAuthenticatedActor();

  if (!actor) {
    redirect("/login");
  }

  return actor;
}

/**
 * Enforces a specific RBAC permission on the server for API Route Handlers and Server Actions.
 * Returns a structured result with HTTP status code 401 (Unauthenticated) or 403 (Forbidden).
 */
export async function verifyServerPermission(
  requiredPermission: Permission,
): Promise<
  | { ok: true; actor: AuthenticatedActor }
  | { ok: false; status: 401 | 403; code: "UNAUTHENTICATED" | "FORBIDDEN"; message: string }
> {
  const actor = await getAuthenticatedActor();

  if (!actor) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: "You must log in with an active RouteX account to perform this action.",
    };
  }

  if (!hasPermission(actor.role, requiredPermission)) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: `Access denied: your role (${actor.roleLabel} — ${actor.accessLevelLabel}) is not permitted to perform '${requiredPermission}'.`,
    };
  }

  return { ok: true, actor };
}

