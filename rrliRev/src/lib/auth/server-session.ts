import "server-only";

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

export type AuthProviderMode = "supabase";

export type AuthenticatedActor = {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string;
  fullName: string;
  role: UserRole;
  roles: readonly string[];
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
  return "supabase";
}

function buildAuthenticatedActor(params: {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string;
  fullName: string;
  role: UserRole;
  roles?: readonly string[];
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
  const userRoles = params.roles && params.roles.length > 0 ? params.roles : [params.role];
  const effectivePermissions = resolveEffectivePermissions({
    role: params.role,
    roles: userRoles,
    isSuperadmin: params.isSuperadmin,
    departments: params.departments ?? userRoles,
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
    roles: userRoles,
    roleLabel: params.isSuperadmin
      ? "Superadmin"
      : userRoles.length > 1
        ? userRoles.map((r) => (isValidUserRole(r) ? getRoleMetadata(r).label : r)).join(" + ")
        : meta.label,
    accessLevel: params.isSuperadmin ? "admin" : getAccessLevelForRole(params.role),
    accessLevelLabel: params.isSuperadmin ? "Full Access" : meta.accessLevelLabel,
    permissions: effectivePermissions,
    providerMode: "supabase",
    mustChangePassword: Boolean(params.mustChangePassword),
    hasSecurityQuestion: Boolean(params.hasSecurityQuestion),
    avatarUrl: params.avatarUrl ?? null,
    isSuperadmin: Boolean(params.isSuperadmin),
    designation: params.designation || (params.isSuperadmin ? "President" : undefined),
    departments: params.departments ?? userRoles,
    customGrants: params.customGrants ?? [],
    customRestrictions: params.customRestrictions ?? [],
  };
}

/**
 * Resolves the current authenticated user and their database-assigned role on the server.
 * Supabase Auth is the sole authentication provider. Fails securely if unavailable.
 * Never trusts client-supplied role parameters or user-editable metadata.
 */
export async function getAuthenticatedActor(): Promise<AuthenticatedActor | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

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
      .select("id, email, username, full_name, role, roles, is_active, must_change_password, security_question, security_answer_hash, is_superadmin, designation, is_permanently_deleted, custom_grants, custom_restrictions, phone_number, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileError && profileRow) {
      if (!profileRow.is_active || profileRow.is_permanently_deleted) {
        return null;
      }

      const assignedRole = isValidUserRole(profileRow.role)
        ? (profileRow.role as UserRole)
        : "customer_representative";

      const rolesArray: string[] = Array.isArray(profileRow.roles) && profileRow.roles.length > 0
        ? profileRow.roles
        : [assignedRole];

      const username = profileRow.username || user.email.split("@")[0];

      return buildAuthenticatedActor({
        id: profileRow.id,
        username,
        email: profileRow.email || user.email,
        phoneNumber: profileRow.phone_number || undefined,
        fullName: profileRow.full_name || username,
        role: assignedRole,
        roles: rolesArray,
        mustChangePassword: Boolean(profileRow.must_change_password),
        hasSecurityQuestion: Boolean(profileRow.security_answer_hash),
        avatarUrl: profileRow.avatar_url || null,
        isSuperadmin: Boolean(profileRow.is_superadmin),
        designation: profileRow.designation || (profileRow.is_superadmin ? "President" : undefined),
        customGrants: profileRow.custom_grants,
        customRestrictions: profileRow.custom_restrictions,
      });
    }

    // 2. Protected admin-assigned app_metadata fallback (for users before profile trigger runs)
    const adminAssignedRole = user.app_metadata?.role;
    const adminAssignedActive = user.app_metadata?.is_active ?? true;
    if (adminAssignedActive !== false && isValidUserRole(adminAssignedRole)) {
      const username = user.app_metadata?.username || user.email.split("@")[0];
      const displayName =
        typeof user.app_metadata?.full_name === "string"
          ? user.app_metadata.full_name
          : username;

      const rolesFromMeta: string[] = Array.isArray(user.app_metadata?.roles)
        ? user.app_metadata.roles
        : [adminAssignedRole];

      return buildAuthenticatedActor({
        id: user.id,
        username,
        email: user.email,
        fullName: displayName,
        role: adminAssignedRole,
        roles: rolesFromMeta,
        mustChangePassword: Boolean(user.app_metadata?.must_change_password),
        hasSecurityQuestion: Boolean(user.app_metadata?.has_security_question),
        isSuperadmin: Boolean(user.app_metadata?.is_superadmin),
        designation: user.app_metadata?.designation,
      });
    }

    return null;
  } catch {
    // Fail securely if Supabase Auth is unavailable
    return null;
  }
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
      message: "You must be logged in to perform this operation.",
    };
  }

  // Superadmin has unrestricted authority
  if (actor.isSuperadmin) {
    return { ok: true, actor };
  }

  if (!actor.permissions.includes(requiredPermission)) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: `Your assigned roles do not grant permission: '${requiredPermission}'.`,
    };
  }

  return { ok: true, actor };
}

/**
 * Enforces Superadmin (President) authority strictly for high-privilege operations.
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
      message: "You must be logged in to perform this operation.",
    };
  }

  if (!actor.isSuperadmin) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "This operation strictly requires Superadmin (President) authority.",
    };
  }

  return { ok: true, actor };
}
