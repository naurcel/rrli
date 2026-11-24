"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { useAuthenticatedActor } from "@/components/auth-context";
import { getUserInitials } from "@/components/profile-photo";
import { RoundedSelect } from "@/components/rounded-select";
import { resolveEffectivePermissions } from "@/lib/auth/permission-engine";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  USER_ROLES,
  type AccessLevel,
  type Permission,
  type UserRole,
} from "@/lib/auth/rbac";
import { type CustomRoleRecord } from "@/lib/auth/custom-role-store";
import {
  FRIENDLY_PERMISSIONS,
  PERMISSION_CATEGORIES,
  type FriendlyPermissionDefinition,
  type PermissionCategory,
} from "./permission-ui-model";

export type BuiltInRoleKey = "superadmin" | UserRole;

export const BUILT_IN_ROLES: readonly BuiltInRoleKey[] = [
  "superadmin",
  "admin",
  "operations",
  "finance",
  "hr",
  "secretary",
  "customer_representative",
];

const BUILT_IN_ROLE_CONFIG: Record<
  BuiltInRoleKey,
  { label: string; description: string; defaultPermissions: readonly Permission[] }
> = {
  superadmin: {
    label: "Superadmin",
    description: "President and executive leadership. Holds permanent, unrestricted system permissions across all modules.",
    defaultPermissions: PERMISSIONS,
  },
  admin: {
    label: "Admin",
    description: "System Administrator. Manages operational, financial, user account, and lower-tier role workflows.",
    defaultPermissions: ROLE_PERMISSIONS.admin,
  },
  operations: {
    label: "Operations",
    description: "Daily logistics dispatch coordinator managing deliveries, drop-offs, imports, POD files, and fleet trucks.",
    defaultPermissions: ROLE_PERMISSIONS.operations,
  },
  finance: {
    label: "Finance",
    description: "Manages company income, operating expenses, and financial summaries; view-only in operational modules.",
    defaultPermissions: ROLE_PERMISSIONS.finance,
  },
  hr: {
    label: "HR",
    description: "Human Resources. View-only access to employee records, trip logs, and operational summaries.",
    defaultPermissions: ROLE_PERMISSIONS.hr,
  },
  secretary: {
    label: "Secretary",
    description: "Corporate Secretary. View-only access to delivery records, POD completeness, and operational reports.",
    defaultPermissions: ROLE_PERMISSIONS.secretary,
  },
  customer_representative: {
    label: "Customer Representative",
    description: "Customer Representative. View-only access to client delivery records and waybill tracking.",
    defaultPermissions: ROLE_PERMISSIONS.customer_representative,
  },
};

export type ManagedUserSummary = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  roleLabel: string;
  accessLevel: AccessLevel;
  accessLevelLabel: string;
  isActive: boolean;
  isSuperadmin?: boolean;
  designation?: string;
  departments?: readonly string[];
  customGrants?: readonly Permission[];
  customRestrictions?: readonly Permission[];
  effectivePermissions?: readonly Permission[];
};

type DepartmentRecord = {
  id: string;
  code?: string;
  name: string;
  description: string;
  defaultPermissions: Permission[];
  isArchived: boolean;
};

type SelectedEntity =
  | { kind: "role"; roleKey: BuiltInRoleKey }
  | { kind: "custom_role"; customRoleId: string }
  | { kind: "user"; userId: string };

type Props = {
  initialSelectedUserId?: string;
  initialSelectedRole?: UserRole;
  onUserSaved?: (updatedUser: Partial<ManagedUserSummary>) => void;
};

export function DiscordPermissionsManager({
  initialSelectedUserId,
  initialSelectedRole,
  onUserSaved,
}: Props) {
  const actor = useAuthenticatedActor();

  // Master Data
  const [users, setUsers] = useState<ManagedUserSummary[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selected Entity (Role, Custom Role, or Staff Member)
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(() => {
    if (initialSelectedUserId) {
      return { kind: "user", userId: initialSelectedUserId };
    }
    if (initialSelectedRole) {
      return { kind: "role", roleKey: initialSelectedRole };
    }
    return { kind: "role", roleKey: "operations" };
  });

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [permSearchQuery, setPermSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PermissionCategory | "all">("all");

  // Collapsed module categories
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  function toggleCategoryCollapse(catId: string) {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }

  // In-Memory Edits (Staging before save)
  const [stagedUserGrants, setStagedUserGrants] = useState<Record<string, Permission[]>>({});
  const [stagedUserRestrictions, setStagedUserRestrictions] = useState<Record<string, Permission[]>>({});
  const [stagedUserDepts, setStagedUserDepts] = useState<Record<string, string[]>>({});
  const [stagedCustomRolePerms, setStagedCustomRolePerms] = useState<Record<string, Permission[]>>({});

  const [stagedRolePerms, setStagedRolePerms] = useState<Record<UserRole, Permission[]>>(() => {
    const baseline: Partial<Record<UserRole, Permission[]>> = {};
    for (const r of USER_ROLES) {
      baseline[r] = [...(ROLE_PERMISSIONS[r] || [])];
    }
    return baseline as Record<UserRole, Permission[]>;
  });

  // Create Custom Role Modal state
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  const [duplicateSourceId, setDuplicateSourceId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load users, departments & custom roles
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      fetch("/api/users").then((res) => res.json()),
      fetch("/api/departments").then((res) => res.json()),
      fetch("/api/roles").then((res) => res.json()),
    ])
      .then(([userData, deptData, roleData]) => {
        if (!isMounted) return;

        if (userData?.ok && Array.isArray(userData.users)) {
          setUsers(userData.users);
        } else {
          setLoadError(userData?.message || "Failed to load staff accounts.");
        }

        if (deptData?.ok && Array.isArray(deptData.departments)) {
          setDepartments(deptData.departments);
          // Sync staged baseline role permissions from saved departments
          setStagedRolePerms((prev) => {
            const next = { ...prev };
            for (const d of deptData.departments) {
              const roleMatch = USER_ROLES.includes(d.code as UserRole)
                ? (d.code as UserRole)
                : USER_ROLES.includes(d.id as UserRole)
                  ? (d.id as UserRole)
                  : null;
              if (roleMatch && Array.isArray(d.defaultPermissions)) {
                next[roleMatch] = [...d.defaultPermissions];
              }
            }
            return next;
          });
        }

        if (roleData?.ok && Array.isArray(roleData.customRoles)) {
          setCustomRoles(roleData.customRoles);
        }

        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err?.message || "Network error loading permissions data.");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update selected entity if props change
  useEffect(() => {
    if (initialSelectedUserId) {
      setSelectedEntity({ kind: "user", userId: initialSelectedUserId });
    } else if (initialSelectedRole) {
      setSelectedEntity({ kind: "role", roleKey: initialSelectedRole });
    }
  }, [initialSelectedUserId, initialSelectedRole]);

  // Selected User Object
  const selectedUser = useMemo(() => {
    if (selectedEntity.kind !== "user") return null;
    return users.find((u) => u.id === selectedEntity.userId) || null;
  }, [selectedEntity, users]);

  // Active grants and restrictions for selected user
  const currentUserGrants = useMemo(() => {
    if (!selectedUser) return [];
    if (stagedUserGrants[selectedUser.id] !== undefined) {
      return stagedUserGrants[selectedUser.id];
    }
    return selectedUser.customGrants ? [...selectedUser.customGrants] : [];
  }, [selectedUser, stagedUserGrants]);

  const currentUserRestrictions = useMemo(() => {
    if (!selectedUser) return [];
    if (stagedUserRestrictions[selectedUser.id] !== undefined) {
      return stagedUserRestrictions[selectedUser.id];
    }
    return selectedUser.customRestrictions ? [...selectedUser.customRestrictions] : [];
  }, [selectedUser, stagedUserRestrictions]);

  const currentUserDepts = useMemo(() => {
    if (!selectedUser) return [];
    if (stagedUserDepts[selectedUser.id] !== undefined) {
      return stagedUserDepts[selectedUser.id];
    }
    return selectedUser.departments ? [...selectedUser.departments] : [selectedUser.role];
  }, [selectedUser, stagedUserDepts]);

  // Effective permissions for selected user
  const effectiveUserPerms = useMemo(() => {
    if (!selectedUser) return new Set<Permission>();
    const resolved = resolveEffectivePermissions({
      role: selectedUser.role,
      isSuperadmin: selectedUser.isSuperadmin,
      departments: currentUserDepts,
      customGrants: currentUserGrants,
      customRestrictions: currentUserRestrictions,
    });
    return new Set<Permission>(resolved);
  }, [selectedUser, currentUserDepts, currentUserGrants, currentUserRestrictions]);

  // Selected Custom Role Object
  const selectedCustomRole = useMemo(() => {
    if (selectedEntity.kind !== "custom_role") return null;
    return customRoles.find((r) => r.id === selectedEntity.customRoleId) || null;
  }, [selectedEntity, customRoles]);

  // Active permissions for selected role or custom role
  const currentRolePerms = useMemo(() => {
    if (selectedEntity.kind === "role") {
      if (selectedEntity.roleKey === "superadmin") {
        return [...PERMISSIONS];
      }
      return stagedRolePerms[selectedEntity.roleKey] ?? ROLE_PERMISSIONS[selectedEntity.roleKey] ?? [];
    }
    if (selectedEntity.kind === "custom_role" && selectedCustomRole) {
      return stagedCustomRolePerms[selectedCustomRole.id] ?? selectedCustomRole.permissions ?? [];
    }
    return [];
  }, [selectedEntity, stagedRolePerms, selectedCustomRole, stagedCustomRolePerms]);

  // Authority check for modifying selected entity
  const canModifySelected = useMemo(() => {
    if (selectedEntity.kind === "role") {
      if (selectedEntity.roleKey === "superadmin") return false; // Superadmin is permanent and unchangeable
      if (selectedEntity.roleKey === "admin") return Boolean(actor.isSuperadmin); // Only Superadmin can edit Admin
      return actor.role === "admin" || Boolean(actor.isSuperadmin); // Admin & Superadmin can edit lower roles
    }
    if (selectedEntity.kind === "custom_role") {
      return actor.role === "admin" || Boolean(actor.isSuperadmin);
    }
    if (selectedEntity.kind === "user") {
      if (selectedUser?.isSuperadmin) return false; // Sole Superadmin protected
      return actor.role === "admin" || Boolean(actor.isSuperadmin);
    }
    return false;
  }, [selectedEntity, actor, selectedUser]);

  // Unsaved changes check
  const hasUnsavedChanges = useMemo(() => {
    if (selectedEntity.kind === "user") {
      if (!selectedUser) return false;
      const originalGrants = selectedUser.customGrants || [];
      const originalRestrictions = selectedUser.customRestrictions || [];
      const originalDepts = selectedUser.departments || [selectedUser.role];

      const grantsChanged =
        stagedUserGrants[selectedUser.id] !== undefined &&
        (currentUserGrants.length !== originalGrants.length ||
          currentUserGrants.some((g) => !originalGrants.includes(g)));

      const restrictionsChanged =
        stagedUserRestrictions[selectedUser.id] !== undefined &&
        (currentUserRestrictions.length !== originalRestrictions.length ||
          currentUserRestrictions.some((r) => !originalRestrictions.includes(r)));

      const deptsChanged =
        stagedUserDepts[selectedUser.id] !== undefined &&
        (currentUserDepts.length !== originalDepts.length ||
          currentUserDepts.some((d) => !originalDepts.includes(d)));

      return grantsChanged || restrictionsChanged || deptsChanged;
    }

    if (selectedEntity.kind === "role") {
      if (selectedEntity.roleKey === "superadmin") return false;
      const orig = ROLE_PERMISSIONS[selectedEntity.roleKey] || [];
      const current = stagedRolePerms[selectedEntity.roleKey] || [];
      return orig.length !== current.length || orig.some((p) => !current.includes(p));
    }

    if (selectedEntity.kind === "custom_role" && selectedCustomRole) {
      const orig = selectedCustomRole.permissions || [];
      const current = stagedCustomRolePerms[selectedCustomRole.id] || orig;
      return orig.length !== current.length || orig.some((p) => !current.includes(p));
    }

    return false;
  }, [
    selectedEntity,
    selectedUser,
    selectedCustomRole,
    stagedUserGrants,
    stagedUserRestrictions,
    stagedUserDepts,
    stagedCustomRolePerms,
    currentUserGrants,
    currentUserRestrictions,
    currentUserDepts,
    stagedRolePerms,
  ]);

  // Filtered Custom Roles
  const filteredCustomRoles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customRoles;
    return customRoles.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q),
    );
  }, [searchQuery, customRoles]);

  // Filtered Built-in Roles
  const filteredBuiltInRoles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return BUILT_IN_ROLES;
    return BUILT_IN_ROLES.filter((r) => {
      const cfg = BUILT_IN_ROLE_CONFIG[r];
      return cfg.label.toLowerCase().includes(q) || cfg.description.toLowerCase().includes(q);
    });
  }, [searchQuery]);

  // Filtered & Pinned Users (Superadmin pinned strictly at the top)
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const matched = users.filter((u) => {
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.roleLabel.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });

    // Pinned sorting: Superadmin is ALWAYS at index 0
    return [...matched].sort((a, b) => {
      if (a.isSuperadmin && !b.isSuperadmin) return -1;
      if (!a.isSuperadmin && b.isSuperadmin) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [searchQuery, users]);

  // Filtered Permissions for right pane
  const visiblePermissions = useMemo(() => {
    const q = permSearchQuery.toLowerCase().trim();
    return FRIENDLY_PERMISSIONS.filter((def) => {
      if (selectedCategory !== "all" && def.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        def.title.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q) ||
        def.key.toLowerCase().includes(q)
      );
    });
  }, [permSearchQuery, selectedCategory]);

  // Permissions grouped by category
  const permissionsByCategory = useMemo(() => {
    const map = new Map<PermissionCategory, FriendlyPermissionDefinition[]>();
    for (const cat of PERMISSION_CATEGORIES) {
      map.set(cat.id, []);
    }
    for (const def of visiblePermissions) {
      const list = map.get(def.category);
      if (list) {
        list.push(def);
      }
    }
    return map;
  }, [visiblePermissions]);

  // Toggle user permission
  function handleToggleUserPermission(perm: Permission) {
    if (!selectedUser || selectedUser.isSuperadmin || !canModifySelected) return;

    // Check authority: Admin cannot grant permissions beyond own authority
    if (!actor.isSuperadmin && !actor.permissions.includes(perm)) {
      toast.error(`You do not have authority to grant '${perm}'.`);
      return;
    }

    const hasCurrently = effectiveUserPerms.has(perm);
    let nextGrants = [...currentUserGrants];
    let nextRestrictions = [...currentUserRestrictions];

    if (hasCurrently) {
      nextGrants = nextGrants.filter((p) => p !== perm);
      if (!nextRestrictions.includes(perm)) {
        nextRestrictions.push(perm);
      }
    } else {
      nextRestrictions = nextRestrictions.filter((p) => p !== perm);
      if (!nextGrants.includes(perm)) {
        nextGrants.push(perm);
      }
    }

    setStagedUserGrants((prev) => ({ ...prev, [selectedUser.id]: nextGrants }));
    setStagedUserRestrictions((prev) => ({ ...prev, [selectedUser.id]: nextRestrictions }));
  }

  // Reset user permission to role default
  function handleResetUserPermission(perm: Permission) {
    if (!selectedUser || selectedUser.isSuperadmin || !canModifySelected) return;
    const nextGrants = currentUserGrants.filter((p) => p !== perm);
    const nextRestrictions = currentUserRestrictions.filter((p) => p !== perm);

    setStagedUserGrants((prev) => ({ ...prev, [selectedUser.id]: nextGrants }));
    setStagedUserRestrictions((prev) => ({ ...prev, [selectedUser.id]: nextRestrictions }));
  }

  // Toggle role or custom role permission
  function handleToggleRolePermission(perm: Permission) {
    if (!canModifySelected) return;

    // Cannot grant users:manage to custom roles
    if (selectedEntity.kind === "custom_role" && perm === "users:manage") {
      toast.error("Custom roles cannot be granted protected role-management authority (users:manage).");
      return;
    }

    // Admin cannot grant permissions beyond own authority
    if (!actor.isSuperadmin && !actor.permissions.includes(perm)) {
      toast.error(`You cannot grant permissions beyond your own authority: ${perm}`);
      return;
    }

    if (selectedEntity.kind === "role") {
      if (selectedEntity.roleKey === "superadmin") return;
      const roleKey = selectedEntity.roleKey as UserRole;
      const current = currentRolePerms;
      const hasIt = current.includes(perm);

      const next = hasIt ? current.filter((p) => p !== perm) : [...current, perm];
      setStagedRolePerms((prev) => ({ ...prev, [roleKey]: next }));
    } else if (selectedEntity.kind === "custom_role" && selectedCustomRole) {
      const roleId = selectedCustomRole.id;
      const current = currentRolePerms;
      const hasIt = current.includes(perm);

      const next = hasIt ? current.filter((p) => p !== perm) : [...current, perm];
      setStagedCustomRolePerms((prev) => ({ ...prev, [roleId]: next }));
    }
  }

  // Toggle custom role enabled status
  async function handleToggleCustomRoleEnabled(roleId: string, currentEnabled: boolean) {
    try {
      const nextState = !currentEnabled;
      const res = await fetch("/api/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, isEnabled: nextState }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to update role status.");
      }
      setCustomRoles((prev) =>
        prev.map((r) => (r.id === roleId ? { ...r, isEnabled: nextState } : r)),
      );
      toast.success(`Role ${nextState ? "enabled" : "disabled"}.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error toggling role status.");
    }
  }

  // Delete custom role (enforces: cannot delete if assigned to members)
  async function handleDeleteCustomRole(roleId: string) {
    const assignedCount = users.filter((u) => u.departments?.includes(roleId)).length;
    if (assignedCount > 0) {
      toast.error(
        `Cannot delete role while it is assigned to ${assignedCount} staff ${
          assignedCount === 1 ? "member" : "members"
        }. Reassign or unassign them first.`,
      );
      return;
    }

    try {
      const res = await fetch("/api/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, assignedUserCount: 0 }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to delete custom role.");
      }
      setCustomRoles((prev) => prev.filter((r) => r.id !== roleId));
      setSelectedEntity({ kind: "role", roleKey: "operations" });
      toast.success("Custom role deleted.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error deleting role.");
    }
  }

  // Create custom role
  async function handleCreateCustomRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) {
      toast.error("Please enter a role name.");
      return;
    }

    setIsCreatingRole(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDesc.trim(),
          permissions: [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to create custom role.");
      }

      setCustomRoles((prev) => [...prev, data.role]);
      setSelectedEntity({ kind: "custom_role", customRoleId: data.role.id });
      setIsCreateRoleModalOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      toast.success(`Custom role "${data.role.name}" created.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error creating role.");
    } finally {
      setIsCreatingRole(false);
    }
  }

  // Toggle department / role assignment
  function handleToggleDept(deptId: string) {
    if (!selectedUser || selectedUser.isSuperadmin || !canModifySelected) return;
    const current = currentUserDepts;
    const next = current.includes(deptId)
      ? current.filter((d) => d !== deptId)
      : [...current, deptId];

    setStagedUserDepts((prev) => ({ ...prev, [selectedUser.id]: next }));
  }

  // Copy permissions from another employee
  async function handleDuplicatePermissions() {
    if (!selectedUser || !duplicateSourceId || !canModifySelected) return;
    const source = users.find((u) => u.id === duplicateSourceId);
    if (!source) return;

    setStagedUserGrants((prev) => ({
      ...prev,
      [selectedUser.id]: source.customGrants ? [...source.customGrants] : [],
    }));
    setStagedUserRestrictions((prev) => ({
      ...prev,
      [selectedUser.id]: source.customRestrictions ? [...source.customRestrictions] : [],
    }));

    toast.info(`Permissions copied from @${source.username}.`);
  }

  // Discard staged changes
  function handleDiscardChanges() {
    if (selectedEntity.kind === "user" && selectedUser) {
      setStagedUserGrants((prev) => {
        const next = { ...prev };
        delete next[selectedUser.id];
        return next;
      });
      setStagedUserRestrictions((prev) => {
        const next = { ...prev };
        delete next[selectedUser.id];
        return next;
      });
      setStagedUserDepts((prev) => {
        const next = { ...prev };
        delete next[selectedUser.id];
        return next;
      });
      toast.info("Changes discarded.");
    } else if (selectedEntity.kind === "role" && selectedEntity.roleKey !== "superadmin") {
      const rKey = selectedEntity.roleKey as UserRole;
      setStagedRolePerms((prev) => ({
        ...prev,
        [rKey]: [...(ROLE_PERMISSIONS[rKey] || [])],
      }));
      toast.info("Role permissions reset.");
    } else if (selectedEntity.kind === "custom_role" && selectedCustomRole) {
      setStagedCustomRolePerms((prev) => {
        const next = { ...prev };
        delete next[selectedCustomRole.id];
        return next;
      });
      toast.info("Custom role permissions reset.");
    }
  }

  // Save changes
  async function handleSaveChanges() {
    setIsSaving(true);

    try {
      if (selectedEntity.kind === "user" && selectedUser) {
        if (stagedUserDepts[selectedUser.id] !== undefined) {
          const deptRes = await fetch("/api/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "assign-departments",
              userId: selectedUser.id,
              departmentIds: currentUserDepts,
            }),
          });
          const deptPayload = await deptRes.json();
          if (!deptRes.ok || !deptPayload.ok) {
            throw new Error(deptPayload.message || "Failed to update departments.");
          }
        }

        const permRes = await fetch("/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update-permissions",
            userId: selectedUser.id,
            customGrants: currentUserGrants,
            customRestrictions: currentUserRestrictions,
          }),
        });
        const permPayload = await permRes.json();
        if (!permRes.ok || !permPayload.ok) {
          throw new Error(permPayload.message || "Failed to update permissions.");
        }

        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === selectedUser.id) {
              const updated = {
                ...u,
                departments: currentUserDepts,
                customGrants: currentUserGrants,
                customRestrictions: currentUserRestrictions,
                effectivePermissions: Array.from(effectiveUserPerms),
              };
              if (onUserSaved) onUserSaved(updated);
              return updated;
            }
            return u;
          }),
        );

        toast.success(`Permissions saved for @${selectedUser.username}.`);
      } else if (selectedEntity.kind === "role") {
        if (selectedEntity.roleKey === "superadmin") {
          toast.info("Superadmin permissions are unconditional and permanently set.");
          return;
        }

        const roleKey = selectedEntity.roleKey as UserRole;
        const matchingDept = departments.find((d) => d.code === roleKey || d.id === roleKey);

        if (matchingDept) {
          const deptRes = await fetch("/api/departments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update",
              departmentId: matchingDept.id,
              defaultPermissions: currentRolePerms,
            }),
          });
          const deptPayload = await deptRes.json();
          if (!deptRes.ok || !deptPayload.ok) {
            throw new Error(deptPayload.message || "Failed to update role permissions.");
          }
          setDepartments((prev) =>
            prev.map((d) =>
              d.id === matchingDept.id ? { ...d, defaultPermissions: currentRolePerms } : d,
            ),
          );
        }

        toast.success(`Permissions saved for ${BUILT_IN_ROLE_CONFIG[roleKey].label}.`);
      } else if (selectedEntity.kind === "custom_role" && selectedCustomRole) {
        const roleId = selectedCustomRole.id;
        const permsToSave = stagedCustomRolePerms[roleId] ?? selectedCustomRole.permissions;
        const res = await fetch("/api/roles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleId,
            permissions: permsToSave,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.message || "Failed to update custom role.");
        }
        setCustomRoles((prev) =>
          prev.map((r) => (r.id === roleId ? { ...r, permissions: permsToSave } : r)),
        );
        toast.success(`Permissions saved for ${selectedCustomRole.name}.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error saving permissions.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  // Module Selection Control: Select All in Module
  function handleSelectAllInCategory(catId: PermissionCategory) {
    if (!canModifySelected) return;

    let catPerms = FRIENDLY_PERMISSIONS.filter((p) => p.category === catId).map((p) => p.key);

    // Filter out users:manage if custom role
    if (selectedEntity.kind === "custom_role") {
      catPerms = catPerms.filter((p) => p !== "users:manage");
    }

    // Filter out permissions beyond actor authority if not Superadmin
    if (!actor.isSuperadmin) {
      catPerms = catPerms.filter((p) => actor.permissions.includes(p));
    }

    if (selectedEntity.kind === "user" && selectedUser && !selectedUser.isSuperadmin) {
      const nextGrants = Array.from(new Set([...currentUserGrants, ...catPerms]));
      const nextRestrictions = currentUserRestrictions.filter((p) => !catPerms.includes(p));
      setStagedUserGrants((prev) => ({ ...prev, [selectedUser.id]: nextGrants }));
      setStagedUserRestrictions((prev) => ({ ...prev, [selectedUser.id]: nextRestrictions }));
    } else if (selectedEntity.kind === "role" && selectedEntity.roleKey !== "superadmin") {
      const roleKey = selectedEntity.roleKey as UserRole;
      const combined = Array.from(new Set([...currentRolePerms, ...catPerms]));
      setStagedRolePerms((prev) => ({ ...prev, [roleKey]: combined }));
    } else if (selectedEntity.kind === "custom_role" && selectedCustomRole) {
      const roleId = selectedCustomRole.id;
      const combined = Array.from(new Set([...currentRolePerms, ...catPerms]));
      setStagedCustomRolePerms((prev) => ({ ...prev, [roleId]: combined }));
    }
  }

  // Module Selection Control: Clear All in Module
  function handleClearAllInCategory(catId: PermissionCategory) {
    if (!canModifySelected) return;

    const catPerms = FRIENDLY_PERMISSIONS.filter((p) => p.category === catId).map((p) => p.key);

    if (selectedEntity.kind === "user" && selectedUser && !selectedUser.isSuperadmin) {
      const nextGrants = currentUserGrants.filter((p) => !catPerms.includes(p));
      const nextRestrictions = Array.from(new Set([...currentUserRestrictions, ...catPerms]));
      setStagedUserGrants((prev) => ({ ...prev, [selectedUser.id]: nextGrants }));
      setStagedUserRestrictions((prev) => ({ ...prev, [selectedUser.id]: nextRestrictions }));
    } else if (selectedEntity.kind === "role" && selectedEntity.roleKey !== "superadmin") {
      const roleKey = selectedEntity.roleKey as UserRole;
      const next = currentRolePerms.filter((p) => !catPerms.includes(p));
      setStagedRolePerms((prev) => ({ ...prev, [roleKey]: next }));
    } else if (selectedEntity.kind === "custom_role" && selectedCustomRole) {
      const roleId = selectedCustomRole.id;
      const next = currentRolePerms.filter((p) => !catPerms.includes(p));
      setStagedCustomRolePerms((prev) => ({ ...prev, [roleId]: next }));
    }
  }

  // Current entity title & description
  const entityTitle = useMemo(() => {
    if (selectedEntity.kind === "role") {
      return BUILT_IN_ROLE_CONFIG[selectedEntity.roleKey].label;
    }
    if (selectedEntity.kind === "custom_role") {
      return selectedCustomRole?.name || "Custom Role";
    }
    return selectedUser?.fullName || selectedUser?.username || "Staff Member";
  }, [selectedEntity, selectedCustomRole, selectedUser]);

  const entityDescription = useMemo(() => {
    if (selectedEntity.kind === "role") {
      return BUILT_IN_ROLE_CONFIG[selectedEntity.roleKey].description;
    }
    if (selectedEntity.kind === "custom_role") {
      return selectedCustomRole?.description || "Custom operational role. Permissions apply additively to all assigned staff members.";
    }
    if (selectedUser?.isSuperadmin) {
      return "Superadmin account holds full, unconditional system permissions.";
    }
    return `Role: ${selectedUser?.roleLabel}. Configured permissions combine additively with assigned roles.`;
  }, [selectedEntity, selectedCustomRole, selectedUser]);

  return (
    <div className="discord-permissions-container">
      <div className="discord-permissions-grid">
        {/* ========================================================= */}
        {/* LEFT COLUMN: ROLES & EMPLOYEES ROSTER                     */}
        {/* ========================================================= */}
        <aside className="discord-roster-sidebar" aria-label="Roles and Employees list">
          <div className="discord-roster-search-wrap">
            <input
              type="text"
              placeholder="Filter roles or staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="discord-roster-search-input"
              aria-label="Filter roles or staff"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="discord-search-clear-btn"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="discord-roster-scroll-area">
            {/* SECTION 1: BUILT-IN ROLES */}
            <div className="discord-roster-group">
              <div className="discord-roster-group-title">
                <span>Roles</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="discord-roster-count">{filteredBuiltInRoles.length + filteredCustomRoles.length}</span>
                  {(actor.role === "admin" || actor.isSuperadmin) && (
                    <button
                      type="button"
                      className="discord-add-role-btn"
                      onClick={() => setIsCreateRoleModalOpen(true)}
                      title="Create custom role"
                    >
                      + New
                    </button>
                  )}
                </div>
              </div>

              <div className="discord-roster-list" role="list">
                {filteredBuiltInRoles.map((roleKey) => {
                  const cfg = BUILT_IN_ROLE_CONFIG[roleKey];
                  const isSelected =
                    selectedEntity.kind === "role" && selectedEntity.roleKey === roleKey;
                  const memberCount =
                    roleKey === "superadmin"
                      ? users.filter((u) => u.isSuperadmin).length
                      : users.filter(
                          (u) =>
                            !u.isSuperadmin &&
                            (u.role === roleKey ||
                              u.departments?.includes(roleKey) ||
                              departments.some(
                                (d) =>
                                  (d.code === roleKey || d.id === roleKey) &&
                                  u.departments?.includes(d.id),
                              )),
                        ).length;

                  return (
                    <button
                      key={roleKey}
                      type="button"
                      className={`discord-roster-item${isSelected ? " active" : ""}`}
                      onClick={() => setSelectedEntity({ kind: "role", roleKey })}
                      aria-selected={isSelected}
                    >
                      <div className="discord-roster-item-info">
                        <div className="discord-roster-item-name">{cfg.label}</div>
                        <div className="discord-roster-item-sub">
                          {memberCount} {memberCount === 1 ? "member" : "members"}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {filteredCustomRoles.length > 0 && (
                  <div className="discord-roster-subheading">Custom Roles</div>
                )}
                {filteredCustomRoles.map((role) => {
                  const isSelected =
                    selectedEntity.kind === "custom_role" && selectedEntity.customRoleId === role.id;
                  const memberCount = users.filter((u) => u.departments?.includes(role.id)).length;

                  return (
                    <button
                      key={role.id}
                      type="button"
                      className={`discord-roster-item${isSelected ? " active" : ""}${!role.isEnabled ? " is-disabled-role" : ""}`}
                      onClick={() => setSelectedEntity({ kind: "custom_role", customRoleId: role.id })}
                      aria-selected={isSelected}
                    >
                      <div className="discord-roster-item-info">
                        <div className="discord-roster-item-name">{role.name}</div>
                        <div className="discord-roster-item-sub">
                          {role.isEnabled
                            ? `${memberCount} ${memberCount === 1 ? "member" : "members"}`
                            : "Disabled"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: STAFF MEMBERS (SUPERADMIN PINNED ON TOP) */}
            <div className="discord-roster-group">
              <div className="discord-roster-group-title">
                <span>Staff</span>
                <span className="discord-roster-count">{filteredUsers.length}</span>
              </div>

              <div className="discord-roster-list" role="list">
                {filteredUsers.map((user) => {
                  const isSelected =
                    selectedEntity.kind === "user" && selectedEntity.userId === user.id;
                  const isMe = actor.id === user.id;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      className={`discord-roster-item${isSelected ? " active" : ""}${
                        user.isSuperadmin ? " is-superadmin-pinned" : ""
                      }`}
                      onClick={() => setSelectedEntity({ kind: "user", userId: user.id })}
                      aria-selected={isSelected}
                    >
                      <div className="discord-member-avatar-circle">
                        <span>{getUserInitials(user.fullName || user.username)}</span>
                      </div>
                      <div className="discord-roster-item-info">
                        <div className="discord-roster-item-name">
                          {user.fullName || user.username}
                          {isMe && <span className="discord-you-tag">(You)</span>}
                        </div>
                        <div className="discord-roster-item-sub">
                          @{user.username} · {user.isSuperadmin ? "Superadmin" : user.roleLabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: PERMISSIONS CONFIGURATION CANVAS            */}
        {/* ========================================================= */}
        <main className="discord-perms-main" aria-label="Permissions Configuration Panel">
          {isLoading ? (
            <div className="discord-loading-state">
              <span>Loading permissions...</span>
            </div>
          ) : loadError ? (
            <div className="discord-error-state">
              <p>{loadError}</p>
            </div>
          ) : (
            <div className="discord-perms-body">
              {/* Entity Header Banner */}
              <div className="discord-entity-banner">
                <div className="discord-entity-banner-left">
                  <div className="discord-banner-user-avatar">
                    {selectedEntity.kind === "role"
                      ? entityTitle.charAt(0)
                      : selectedEntity.kind === "custom_role"
                      ? selectedCustomRole?.name.charAt(0) || "C"
                      : getUserInitials(selectedUser?.fullName || selectedUser?.username || "U")}
                  </div>

                  <div className="discord-banner-details">
                    <div className="discord-banner-title-row">
                      <h2 className="discord-banner-title">{entityTitle}</h2>
                      {selectedEntity.kind === "user" && selectedUser && (
                        <span className="discord-banner-username">@{selectedUser.username}</span>
                      )}
                      {selectedEntity.kind === "custom_role" && (
                        <span className="discord-banner-custom-tag">Custom Role</span>
                      )}
                    </div>
                    {selectedEntity.kind !== "role" && entityDescription ? (
                      <p className="discord-banner-desc-text">{entityDescription}</p>
                    ) : null}
                  </div>
                </div>

                {/* Custom Role Actions (Enable/Disable & Delete) */}
                {selectedEntity.kind === "custom_role" && selectedCustomRole && (actor.role === "admin" || actor.isSuperadmin) && (
                  <div className="discord-banner-actions">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className={`secondary-button${selectedCustomRole.isEnabled ? "" : " is-disabled"}`}
                        style={{
                          fontSize: "11px",
                          minHeight: "28px",
                          color: selectedCustomRole.isEnabled ? "var(--color-status-success, #059669)" : "var(--color-text-muted)",
                        }}
                        onClick={() => handleToggleCustomRoleEnabled(selectedCustomRole.id, selectedCustomRole.isEnabled)}
                      >
                        {selectedCustomRole.isEnabled ? "Role Enabled" : "Role Disabled"}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        style={{
                          color: "var(--color-danger, #dc2626)",
                          borderColor: "rgba(220, 38, 38, 0.25)",
                          fontSize: "11px",
                          minHeight: "28px",
                        }}
                        onClick={() => handleDeleteCustomRole(selectedCustomRole.id)}
                      >
                        Delete Role
                      </button>
                    </div>
                  </div>
                )}

                {/* Member Clone Tool */}
                {selectedEntity.kind === "user" && selectedUser && !selectedUser.isSuperadmin && canModifySelected && (
                  <div className="discord-banner-actions">
                    <div className="discord-copy-tool">
                      <span className="discord-copy-label">Copy from:</span>
                      <div style={{ minWidth: "210px" }}>
                        <RoundedSelect
                          value={duplicateSourceId}
                          onChange={(val) => setDuplicateSourceId(val)}
                          ariaLabel="Select source employee to copy from"
                          options={[
                            { value: "", label: "Select staff..." },
                            ...users
                              .filter((u) => u.id !== selectedUser.id)
                              .map((u) => ({
                                value: u.id,
                                label: `${u.fullName || u.username} (@${u.username})`,
                              })),
                          ]}
                        />
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={handleDuplicatePermissions}
                        disabled={!duplicateSourceId || isSaving}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Authority Notice Banners */}
              {selectedEntity.kind === "role" && selectedEntity.roleKey === "superadmin" && (
                <div className="discord-authority-notice info" role="status">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>The Superadmin (President) holds unconditional full system authority. Permissions are permanent.</span>
                </div>
              )}

              {selectedEntity.kind === "role" && selectedEntity.roleKey === "admin" && !actor.isSuperadmin && (
                <div className="discord-authority-notice warning" role="status">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Protected Role: Only the Superadmin (President) has authority to modify the Admin role.</span>
                </div>
              )}

              {/* Assigned Roles & Memberships for Member */}
              {selectedEntity.kind === "user" && selectedUser && !selectedUser.isSuperadmin && (
                <div className="discord-dept-section">
                  <div className="discord-dept-header">
                    <h3 className="discord-dept-title">Assigned Roles</h3>
                    <p className="discord-dept-desc">
                      Members inherit permissions additively from all enabled assigned roles.
                    </p>
                  </div>

                  <div className="discord-dept-tags">
                    {/* Built-in departments / roles */}
                    {departments.map((dept) => {
                      const isAssigned = currentUserDepts.includes(dept.id);
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          className={`discord-dept-chip${isAssigned ? " assigned" : ""}${
                            dept.isArchived ? " archived" : ""
                          }`}
                          onClick={() => handleToggleDept(dept.id)}
                          disabled={dept.isArchived || !canModifySelected}
                          title={dept.isArchived ? "Archived" : dept.description}
                        >
                          <span>{dept.name}</span>
                          {dept.isArchived && <span className="discord-dept-archived-tag">(Archived)</span>}
                        </button>
                      );
                    })}

                    {/* Custom roles */}
                    {customRoles.map((cr) => {
                      const isAssigned = currentUserDepts.includes(cr.id);
                      return (
                        <button
                          key={cr.id}
                          type="button"
                          className={`discord-dept-chip${isAssigned ? " assigned" : ""}${
                            !cr.isEnabled ? " archived" : ""
                          }`}
                          onClick={() => handleToggleDept(cr.id)}
                          disabled={!canModifySelected}
                          title={!cr.isEnabled ? "Role is disabled (no permissions contributed)" : cr.description}
                        >
                          <span>{cr.name}</span>
                          {!cr.isEnabled && <span className="discord-dept-archived-tag">(Disabled)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Permissions Search & Category Filter Bar */}
              <div className="discord-filter-bar">
                <div className="discord-filter-search-wrap">
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    value={permSearchQuery}
                    onChange={(e) => setPermSearchQuery(e.target.value)}
                    className="discord-filter-search-input"
                    aria-label="Search permissions"
                  />
                  {permSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPermSearchQuery("")}
                      className="discord-search-clear-btn"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="discord-category-pills">
                  <button
                    type="button"
                    className={`discord-cat-pill${selectedCategory === "all" ? " active" : ""}`}
                    onClick={() => setSelectedCategory("all")}
                  >
                    All
                  </button>
                  {PERMISSION_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`discord-cat-pill${selectedCategory === cat.id ? " active" : ""}`}
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clean separator between search/filters and permission sections */}
              <div className="discord-section-divider" aria-hidden="true" />

              {/* PERMISSION CATEGORIES (MODULE-BASED) */}
              <div className="discord-categories-container">
                {PERMISSION_CATEGORIES.map((cat) => {
                  const perms = permissionsByCategory.get(cat.id) || [];
                  if (perms.length === 0) return null;

                  const isCollapsed = Boolean(collapsedCategories[cat.id]);

                  // Count enabled permissions in this module
                  const enabledCount = perms.filter((def) => {
                    if (selectedEntity.kind === "role") {
                      return currentRolePerms.includes(def.key);
                    }
                    if (selectedEntity.kind === "custom_role") {
                      return currentRolePerms.includes(def.key);
                    }
                    return effectiveUserPerms.has(def.key);
                  }).length;

                  return (
                    <section key={cat.id} className="discord-category-card" aria-labelledby={`cat-${cat.id}`}>
                      {/* Module Category Header */}
                      <div className="discord-category-header">
                        <div
                          className="discord-category-title-wrap"
                          onClick={() => toggleCategoryCollapse(cat.id)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={!isCollapsed}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleCategoryCollapse(cat.id);
                            }
                          }}
                        >
                          <button
                            type="button"
                            className={`discord-collapse-btn${isCollapsed ? " is-collapsed" : ""}`}
                            aria-label={isCollapsed ? `Expand ${cat.label}` : `Collapse ${cat.label}`}
                          >
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path
                                fillRule="evenodd"
                                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          <h3 id={`cat-${cat.id}`} className="discord-category-title">
                            {cat.label}
                          </h3>
                          <span className="discord-cat-count-chip">
                            {enabledCount} / {perms.length}
                          </span>
                        </div>

                        {/* Module-level Selection Controls: Select All / Clear All */}
                        {canModifySelected && (
                          <div className="discord-category-quick-actions">
                            <button
                              type="button"
                              className="discord-quick-btn"
                              onClick={() => handleSelectAllInCategory(cat.id)}
                              title={`Select all permissions in ${cat.label}`}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              className="discord-quick-btn reset"
                              onClick={() => handleClearAllInCategory(cat.id)}
                              title={`Clear all permissions in ${cat.label}`}
                            >
                              Clear All
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Permission Rows (Collapsible) */}
                      {!isCollapsed && (
                        <div className="discord-permissions-list">
                          {perms.map((def) => {
                            const isRole = selectedEntity.kind === "role" || selectedEntity.kind === "custom_role";
                            const isSuperRole = selectedEntity.kind === "role" && selectedEntity.roleKey === "superadmin";
                            const isSuperUser = selectedEntity.kind === "user" && selectedUser?.isSuperadmin;
                            const isLocked = isSuperRole || isSuperUser || !canModifySelected;

                            // Active state
                            const roleAllowed = currentRolePerms.includes(def.key);
                            const userAllowed = effectiveUserPerms.has(def.key);
                            const isSwitchOn = isSuperRole || isSuperUser ? true : isRole ? roleAllowed : userAllowed;

                            // Overrides
                            const isCustomGrant = currentUserGrants.includes(def.key);
                            const isCustomRestricted = currentUserRestrictions.includes(def.key);
                            const isOverridden = isCustomGrant || isCustomRestricted;

                            return (
                              <div
                                key={def.key}
                                className={`discord-perm-row${isSwitchOn ? " enabled" : ""}`}
                              >
                                <div className="discord-perm-info">
                                  <div className="discord-perm-title">{def.title}</div>
                                  <p className="discord-perm-description">{def.description}</p>
                                </div>

                                <div className="discord-perm-actions">
                                  {!isRole && !isLocked && isOverridden && (
                                    <button
                                      type="button"
                                      className="discord-perm-reset-link"
                                      onClick={() => handleResetUserPermission(def.key)}
                                      title="Reset to role default"
                                    >
                                      Reset
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isSwitchOn}
                                    aria-label={`Toggle ${def.title}`}
                                    disabled={isLocked}
                                    className={`discord-switch${isSwitchOn ? " active" : ""}`}
                                    onClick={() => {
                                      if (isRole) {
                                        handleToggleRolePermission(def.key);
                                      } else {
                                        handleToggleUserPermission(def.key);
                                      }
                                    }}
                                  >
                                    <span className="discord-switch-knob" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sticky Unsaved Changes Bar */}
          {hasUnsavedChanges && (
            <div className="discord-unsaved-bar" role="alert">
              <span className="discord-unsaved-message">
                You have unsaved changes
              </span>
              <div className="discord-unsaved-actions">
                <button
                  type="button"
                  className="secondary-button discord-discard-btn"
                  onClick={handleDiscardChanges}
                  disabled={isSaving}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className="primary-button discord-save-btn"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create Custom Role Modal */}
      {isCreateRoleModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-role-modal-title"
              style={{ zIndex: 1000 }}
            >
              <div
                className="routex-dialog-backdrop"
                onClick={() => !isCreatingRole && setIsCreateRoleModalOpen(false)}
              />
              <div
                className="routex-dialog"
                style={{ maxWidth: "440px", width: "92vw" }}
                onClick={(e) => e.stopPropagation()}
              >
                <header className="routex-dialog-header">
                  <h3 id="create-role-modal-title" className="routex-dialog-title">
                    Create Custom Role
                  </h3>
                  <button
                    type="button"
                    className="routex-dialog-close"
                    aria-label="Close create role modal"
                    title="Close (Esc)"
                    disabled={isCreatingRole}
                    onClick={() => setIsCreateRoleModalOpen(false)}
                  >
                    ×
                  </button>
                </header>

                <form onSubmit={handleCreateCustomRole}>
                  <div
                    className="routex-dialog-body"
                    style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: "14px" }}
                  >
                    <div className="routex-dialog-field">
                      <label htmlFor="create-role-name">
                        Role Name <span className="required-asterisk" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="create-role-name"
                        type="text"
                        placeholder="e.g. Fleet Supervisor, Logistics Dispatcher"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        disabled={isCreatingRole}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="routex-dialog-field">
                      <label htmlFor="create-role-desc">
                        Description <span className="field-required-tag">(Optional)</span>
                      </label>
                      <input
                        id="create-role-desc"
                        type="text"
                        placeholder="e.g. Oversees truck maintenance and driver dispatch"
                        value={newRoleDesc}
                        onChange={(e) => setNewRoleDesc(e.target.value)}
                        disabled={isCreatingRole}
                      />
                    </div>
                  </div>

                  <footer className="routex-dialog-footer">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isCreatingRole}
                      onClick={() => setIsCreateRoleModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary-action-button"
                      disabled={isCreatingRole}
                    >
                      {isCreatingRole ? "Creating…" : "Create Role"}
                    </button>
                  </footer>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
