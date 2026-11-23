import { isValidUserRole, PERMISSIONS, ROLE_PERMISSIONS, type Permission, type UserRole } from "./rbac.ts";
import { findDepartmentById } from "./department-store.ts";
import { findCustomRoleById } from "./custom-role-store.ts";

export type PermissionEvaluationInput = {
  isSuperadmin?: boolean;
  role?: UserRole;
  roles?: readonly string[];
  departmentIds?: readonly string[];
  departments?: readonly string[];
  customGrants?: readonly Permission[];
  customRestrictions?: readonly Permission[];
};

export type PermissionBreakdown = {
  isSuperadmin: boolean;
  inheritedFromDepartments: readonly Permission[];
  customGrants: readonly Permission[];
  customRestrictions: readonly Permission[];
  effectivePermissions: readonly Permission[];
};

/**
 * Resolves effective permissions following RouteX authority hierarchy:
 * 1. Superadmin has ALL permissions unconditionally.
 * 2. Active department permissions are additive.
 * 3. Individual grants provide additional permissions.
 * 4. Individual restrictions override inherited grants.
 * 5. Archived departments do NOT grant permissions.
 */
export function resolveEffectivePermissions(
  input: PermissionEvaluationInput,
): readonly Permission[] {
  // 1. Superadmin has unrestricted system authority
  if (input.isSuperadmin) {
    return PERMISSIONS;
  }

  const inheritedSet = new Set<Permission>();
  const roleList = input.roles ?? (input.role ? [input.role] : []);
  const deptList = input.departmentIds ?? input.departments ?? [];
  const combinedIdentifers = Array.from(new Set([...roleList, ...deptList]));

  // 2. Additive permissions across all assigned roles (built-in presets and custom roles) & departments
  if (combinedIdentifers.length > 0) {
    for (const id of combinedIdentifers) {
      // Built-in role preset
      if (isValidUserRole(id)) {
        const baseRolePerms = ROLE_PERMISSIONS[id as UserRole] ?? [];
        for (const p of baseRolePerms) {
          inheritedSet.add(p);
        }
      }

      // Custom role preset
      const customRole = findCustomRoleById(id);
      if (customRole && customRole.isEnabled) {
        for (const p of customRole.permissions) {
          inheritedSet.add(p);
        }
      }

      // Department baseline
      const dept = findDepartmentById(id);
      if (dept && !dept.isArchived) {
        for (const p of dept.defaultPermissions) {
          inheritedSet.add(p);
        }
      }
    }
  } else if (input.role) {
    // Fallback to role-based baseline for legacy accounts with no explicit departments
    const baseRolePerms = ROLE_PERMISSIONS[input.role] ?? [];
    for (const p of baseRolePerms) {
      inheritedSet.add(p);
    }
  }

  // 3. Additive individual grants
  if (input.customGrants && input.customGrants.length > 0) {
    for (const p of input.customGrants) {
      if (PERMISSIONS.includes(p)) {
        inheritedSet.add(p);
      }
    }
  }

  // 4. Individual restrictions OVERRIDE inherited grants
  if (input.customRestrictions && input.customRestrictions.length > 0) {
    for (const p of input.customRestrictions) {
      inheritedSet.delete(p);
    }
  }

  return PERMISSIONS.filter((p) => inheritedSet.has(p));
}

/**
 * Provides an exhaustive breakdown of permission origin for auditing and UI review.
 */
export function evaluatePermissionBreakdown(
  input: PermissionEvaluationInput,
): PermissionBreakdown {
  if (input.isSuperadmin) {
    return {
      isSuperadmin: true,
      inheritedFromDepartments: PERMISSIONS,
      customGrants: [],
      customRestrictions: [],
      effectivePermissions: PERMISSIONS,
    };
  }

  const inheritedSet = new Set<Permission>();
  const roleList = input.roles ?? (input.role ? [input.role] : []);
  const deptList = input.departmentIds ?? input.departments ?? [];
  const combinedIdentifers = Array.from(new Set([...roleList, ...deptList]));

  if (combinedIdentifers.length > 0) {
    for (const id of combinedIdentifers) {
      if (isValidUserRole(id)) {
        const base = ROLE_PERMISSIONS[id as UserRole] ?? [];
        for (const p of base) inheritedSet.add(p);
      }
      const customRole = findCustomRoleById(id);
      if (customRole && customRole.isEnabled) {
        for (const p of customRole.permissions) {
          inheritedSet.add(p);
        }
      }
      const dept = findDepartmentById(id);
      if (dept && !dept.isArchived) {
        for (const p of dept.defaultPermissions) {
          inheritedSet.add(p);
        }
      }
    }
  } else if (input.role) {
    const base = ROLE_PERMISSIONS[input.role] ?? [];
    for (const p of base) inheritedSet.add(p);
  }

  const inherited = PERMISSIONS.filter((p) => inheritedSet.has(p));
  const grants = (input.customGrants ?? []).filter((p) => PERMISSIONS.includes(p));
  const restrictions = (input.customRestrictions ?? []).filter((p) => PERMISSIONS.includes(p));
  const effective = resolveEffectivePermissions(input);

  return {
    isSuperadmin: false,
    inheritedFromDepartments: inherited,
    customGrants: grants,
    customRestrictions: restrictions,
    effectivePermissions: effective,
  };
}

/**
 * Checks whether an actor has a specific permission.
 * Superadmin always returns true.
 */
export function actorHasPermission(
  actor: { isSuperadmin?: boolean; permissions?: readonly Permission[] } | null | undefined,
  required: Permission,
): boolean {
  if (!actor) return false;
  if (actor.isSuperadmin) return true;
  return actor.permissions ? actor.permissions.includes(required) : false;
}
