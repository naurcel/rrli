import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  getAccessLevelForRole,
  getRoleMetadata,
  isValidUserRole,
  type AccessLevel,
  type Permission,
  type UserRole,
} from "./rbac";
import { resolveEffectivePermissions } from "./permission-engine";
import {
  findServerAccountById,
} from "./server-account-store";
import {
  VERIFIED_SESSION_COOKIE,
  verifySignedSessionToken,
} from "./session-token";

export type AuthProviderMode = "supabase" | "server-local";

export type AuthenticatedActor = {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string;
  fullName: string;
  role: UserRole;
  roleLabel: string;
  accessLevel: AccessLevel;
  accessLevelLabel: string;
  permissions: readonly Permission[];
  providerMode: AuthProviderMode;
  mustChangePassword?: boolean;
  hasSecurityQuestion?: boolean;
  avatarUrl?: string | null;
  isSuperadmin?: boolean;
  designation?: string;
  departments?: readonly string[];
  customGrants?: readonly Permission[];
  customRestrictions?: readonly Permission[];
};

export function getAuthProviderMode(): AuthProviderMode {
  return isSupabaseConfigured() ? "supabase" : "server-local";
}

function buildAuthenticatedActor(params: {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string;
  fullName: string;
  role: UserRole;
  providerMode: AuthProviderMode;
  mustChangePassword?: boolean;
  hasSecurityQuestion?: boolean;
  avatarUrl?: string | null;
  isSuperadmin?: boolean;
  designation?: string;
  departments?: readonly string[];
  customGrants?: readonly Permission[];
  customRestrictions?: readonly Permission[];
}): AuthenticatedActor {
  const meta = getRoleMetadata(params.role);
  const effectivePermissions = resolveEffectivePermissions({
    role: params.role,
    isSuperadmin: params.isSuperadmin,
    departments: params.departments,
    customGrants: params.customGrants,
    customRestrictions: params.customRestrictions,
  });

  return {
    id: params.id,
    username: params.username,
    email: params.email,
    phoneNumber: params.phoneNumber,
    fullName: params.fullName,
    role: params.role,
    roleLabel: params.isSuperadmin ? "Superadmin" : meta.label,
    accessLevel: params.isSuperadmin ? "admin" : getAccessLevelForRole(params.role),
    accessLevelLabel: params.isSuperadmin ? "Full Access" : meta.accessLevelLabel,
    permissions: effectivePermissions,
    providerMode: params.providerMode,
    mustChangePassword: Boolean(params.mustChangePassword),
    hasSecurityQuestion: Boolean(params.hasSecurityQuestion),
    avatarUrl: params.avatarUrl ?? null,
    isSuperadmin: Boolean(params.isSuperadmin),
    designation: params.designation || (params.isSuperadmin ? "Superadmin" : undefined),
    departments: params.departments ?? (params.role ? [params.role] : []),
    customGrants: params.customGrants ?? [],
    customRestrictions: params.customRestrictions ?? [],
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
        .select("id, email, username, full_name, role, is_active, must_change_password, security_question, security_answer_hash, is_superadmin, designation, is_permanently_deleted, custom_grants, custom_restrictions")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileError && profileRow) {
        if (!profileRow.is_active || profileRow.is_permanently_deleted || !isValidUserRole(profileRow.role)) {
          return null;
        }

        const username = profileRow.username || user.email.split("@")[0];

        return buildAuthenticatedActor({
          id: profileRow.id,
          username,
          email: profileRow.email || user.email,
          fullName: profileRow.full_name || username,
          role: profileRow.role,
          providerMode: "supabase",
          mustChangePassword: Boolean(profileRow.must_change_password),
          hasSecurityQuestion: Boolean(profileRow.security_answer_hash),
          avatarUrl: (profileRow as { avatar_url?: string | null }).avatar_url || null,
          isSuperadmin: Boolean(profileRow.is_superadmin),
          designation: profileRow.designation || (profileRow.is_superadmin ? "President" : undefined),
          customGrants: profileRow.custom_grants,
          customRestrictions: profileRow.custom_restrictions,
        });
      }

      // 2. Trusted admin-only app_metadata fallback (if user_profiles table is being initialized)
      const adminAssignedRole = user.app_metadata?.role;
      const adminAssignedActive = user.app_metadata?.is_active ?? true;
      if (adminAssignedActive !== false && isValidUserRole(adminAssignedRole)) {
        const username = user.app_metadata?.username || user.email.split("@")[0];
        const displayName =
          typeof user.app_metadata?.full_name === "string"
            ? user.app_metadata.full_name
            : username;

        return buildAuthenticatedActor({
          id: user.id,
          username,
          email: user.email,
          fullName: displayName,
          role: adminAssignedRole,
          providerMode: "supabase",
          mustChangePassword: Boolean(user.app_metadata?.must_change_password),
          hasSecurityQuestion: Boolean(user.app_metadata?.has_security_question),
          isSuperadmin: Boolean(user.app_metadata?.is_superadmin),
          designation: user.app_metadata?.designation,
        });
      }
    } catch {
      // Supabase lookup error; fallback to session token below
    }
  }

  // Server-verified signed HttpOnly session token (fallback for seed/demo sessions or unconfigured Supabase)
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(VERIFIED_SESSION_COOKIE)?.value;
  const verifiedPayload = verifySignedSessionToken(rawToken);

  if (!verifiedPayload) {
    return null;
  }

  const account = findServerAccountById(verifiedPayload.sub);
  if (!account || !account.isActive || account.isPermanentlyDeleted) {
    return null;
  }

  return buildAuthenticatedActor({
    id: account.id,
    username: account.username,
    email: account.email,
    phoneNumber: account.phoneNumber,
    fullName: account.fullName,
    role: account.role,
    providerMode: "server-local",
    mustChangePassword: account.mustChangePassword,
    hasSecurityQuestion: account.hasSecurityQuestion,
    avatarUrl: account.avatarUrl ?? null,
    isSuperadmin: account.isSuperadmin,
    designation: account.designation,
    departments: account.departments,
    customGrants: account.customGrants,
    customRestrictions: account.customRestrictions,
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
 * Superadmin (President) bypasses all permission checks with unrestricted authority.
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

  // Superadmin has absolute system authority across all modules
  if (actor.isSuperadmin) {
    return { ok: true, actor };
  }

  if (!actor.permissions.includes(requiredPermission)) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: `Access denied: your role (${actor.roleLabel} — ${actor.accessLevelLabel}) is not permitted to perform '${requiredPermission}'.`,
    };
  }

  return { ok: true, actor };
}

/**
 * Enforces executive Superadmin (President) authority strictly.
 * Regular Admins and all other roles are rejected with 403 FORBIDDEN.
 */
export async function verifySuperadminOnly(): Promise<
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

  if (!actor.isSuperadmin) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "Access denied: This executive action strictly requires Superadmin (President) authority.",
    };
  }

  return { ok: true, actor };
}
