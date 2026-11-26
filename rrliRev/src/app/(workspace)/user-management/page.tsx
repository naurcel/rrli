"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useAuthenticatedActor } from "@/components/auth-context";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import { TablePagination } from "@/components/table-pagination";
import { useSearchBuffer } from "@/components/search-buffer";
import { SimpleLoading } from "@/components/simple-loading";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import { AuditStateChanges } from "@/components/audit-state-changes";
import { resetAllScrollPositions } from "@/components/route-scroll-to-top";
import {
  formatAuditActor,
  formatAuditEntityLabel,
  getActionVisuals,
} from "@/features/audit/audit-formatters";
import { toast } from "sonner";
import {
  generateRandomTemporaryPassword,
  validateUsernameFormat,
} from "@/lib/auth/password-policy";
import { PermanentDeleteUserModal } from "@/features/users/PermanentDeleteUserModal";
import { DiscordPermissionsManager } from "@/features/permissions/DiscordPermissionsManager";
import {
  ROLE_METADATA,
  USER_ROLES,
  type AccessLevel,
  type Permission,
  type UserRole,
} from "@/lib/auth/rbac";
import { formatPhoneNumber } from "@/lib/format";

type ManagedUserRecord = {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string;
  fullName: string;
  role: UserRole;
  roles?: readonly string[];
  roleLabel: string;
  accessLevel: AccessLevel;
  accessLevelLabel: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  hasSecurityQuestion?: boolean;
  recoveryAuthorizedAt?: string | null;
  recoveryExpiresAt?: string | null;
  createdAt: string;
  isSuperadmin?: boolean;
  designation?: string;
  departments?: readonly string[];
  customGrants?: readonly Permission[];
  customRestrictions?: readonly Permission[];
  effectivePermissions?: readonly Permission[];
  isPermanentlyDeleted?: boolean;
  deletedAt?: string | null;
  deletedReason?: string | null;
  deletedBy?: string | null;
};

type AuditEntry = {
  id: string;
  occurredAt: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  changes?: Record<string, unknown>;
};

const AUDIT_ACTION_FILTER_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "delivery.created", label: "Delivery Recorded" },
  { value: "delivery.financials_finalized", label: "Financials Completed" },
  { value: "delivery.financials_corrected", label: "Financial Correction" },
  { value: "delivery.batch_imported", label: "Excel Batch Import" },
  { value: "document.uploaded", label: "Document Uploaded" },
  { value: "truck.created", label: "Truck Registered" },
  { value: "truck.updated", label: "Truck Updated" },
  { value: "user.created", label: "User Provisioned" },
  { value: "user.status_changed", label: "Status Updated" },
  { value: "user.role_changed", label: "Role Updated" },
  { value: "user.username_changed", label: "Username Changed" },
  { value: "user.username_changed_by_admin", label: "Username Changed (Admin)" },
  { value: "user.password_changed", label: "Password Changed" },
  { value: "user.password_recovered", label: "Password Recovered" },
  { value: "user.recovery_authorized", label: "Reset Window Authorized" },
];

const AUDIT_ENTITY_FILTER_OPTIONS = [
  { value: "all", label: "All Entities" },
  { value: "delivery", label: "Deliveries" },
  { value: "truck", label: "Fleet Trucks" },
  { value: "user", label: "Staff Accounts" },
  { value: "import_batch", label: "Import Batches" },
  { value: "system", label: "System Settings" },
];

const ROLE_OPTIONS = USER_ROLES.map((role) => ({
  value: role,
  label: ROLE_METADATA[role].label,
}));

export function normalizeManagedStaffRecord(u: ManagedUserRecord): ManagedUserRecord {
  const usernameMap: Record<string, string> = {
    admin: "mori_mochi",
    hr: "jxleners",
    finance: "azula",
    operations: "narcel",
    customerrep: "ravicci",
    secretary: "ze.ku",
    shinryu: "shinr6u",
  };

  const emailMap: Record<string, string> = {
    "admin@routex.local": "adrianmangampat@gmail.com",
    "hr@routex.local": "jelenepunongbayan@gmail.com",
    "finance@routex.local": "louizajoy@gmail.com",
    "operations@routex.local": "marcrancel@gmail.com",
    "csrep@routex.local": "rainibasco@gmail.com",
    "secretary@routex.local": "zeankurt@gmail.com",
  };

  const normalizedUsername = usernameMap[u.username.toLowerCase()] || u.username;
  let cleanName = u.fullName;
  if (cleanName === "System Administrator") {
    cleanName = "Adrian Mangampat";
  } else {
    cleanName = cleanName.replace(/\s*\([^)]*\)/g, "").trim();
  }

  let cleanEmail = u.email;
  if (emailMap[cleanEmail.toLowerCase()]) {
    cleanEmail = emailMap[cleanEmail.toLowerCase()];
  } else if (cleanEmail.toLowerCase().endsWith("@routex.local")) {
    cleanEmail = `${normalizedUsername.replace(/\./g, "")}@gmail.com`;
  }

  const cleanPhone = u.phoneNumber ? formatPhoneNumber(u.phoneNumber) : u.phoneNumber;
  const isSuperadmin = Boolean(u.isSuperadmin);

  return {
    ...u,
    fullName: cleanName,
    username: normalizedUsername,
    email: cleanEmail,
    phoneNumber: cleanPhone,
    isSuperadmin,
    roleLabel: isSuperadmin ? "President" : u.roleLabel === "Superadmin" ? "President" : u.roleLabel,
  };
}

export default function UserManagementPage() {
  const actor = useAuthenticatedActor();
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("operations");

  const availableRoleOptions = useMemo(() => {
    return actor.isSuperadmin
      ? ROLE_OPTIONS
      : ROLE_OPTIONS.filter((opt) => opt.value !== "admin");
  }, [actor.isSuperadmin]);
  const [isCreating, setIsCreating] = useState(false);
  type UserManagementTab = "users" | "permissions" | "audit";
  const [activeTab, setActiveTab] = useState<UserManagementTab>("users");
  const [permissionFocusUserId, setPermissionFocusUserId] = useState<string | undefined>(undefined);
  const [userStatusTab, setUserStatusTab] = useState<"active" | "deactivated" | "deleted">("active");
  const [deletedUsers, setDeletedUsers] = useState<ManagedUserRecord[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "").toLowerCase();
      if (hash === "permissions" || hash === "roles" || hash === "perms") {
        setActiveTab("permissions");
      } else if (hash === "audit" || hash === "trail" || hash === "logs") {
        setActiveTab("audit");
      } else if (hash === "users" || hash === "staff" || hash.startsWith("add-user")) {
        setActiveTab("users");
        if (hash.startsWith("add-user")) {
          window.setTimeout(() => {
            const input = document.getElementById("provision-full-name");
            input?.scrollIntoView({ behavior: "smooth", block: "center" });
            input?.focus();
          }, 80);
        }
      }
    }
  }, []);

  function handleSelectTab(tab: UserManagementTab) {
    setActiveTab(tab);
    if (tab === "audit") {
      void loadAuditEntries(true);
    }
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", '#' + tab);
    }
    resetAllScrollPositions("instant");
  }

  useEffect(() => {
    resetAllScrollPositions("instant");
    const frameId = requestAnimationFrame(() => resetAllScrollPositions("instant"));
    const timerId = setTimeout(() => resetAllScrollPositions("instant"), 30);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
    };
  }, [activeTab]);

  // Permanent delete modal state (Superadmin only)
  const [permanentDeleteModalUser, setPermanentDeleteModalUser] = useState<ManagedUserRecord | null>(null);

  // Admin-assisted recovery dialog state
  const [authorizingUser, setAuthorizingUser] = useState<ManagedUserRecord | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authorizeError, setAuthorizeError] = useState<string | null>(null);

  // Edit username dialog state
  const [editingUser, setEditingUser] = useState<ManagedUserRecord | null>(null);
  const [newUsernameInput, setNewUsernameInput] = useState("");
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [editUsernameError, setEditUsernameError] = useState<string | null>(null);

  // Edit contact dialog state
  const [editingContactUser, setEditingContactUser] = useState<ManagedUserRecord | null>(null);
  const [editEmailInput, setEditEmailInput] = useState("");
  const [editPhoneInput, setEditPhoneInput] = useState("");
  const [isUpdatingContact, setIsUpdatingContact] = useState(false);
  const [editContactError, setEditContactError] = useState<string | null>(null);

  // Delete user confirmation dialog state
  const [userToDelete, setUserToDelete] = useState<ManagedUserRecord | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Temporary password popup dialog state
  const [tempPasswordPopup, setTempPasswordPopup] = useState<{
    fullName: string;
    username: string;
    password: string;
    roleLabel?: string;
    isNewlyProvisioned: boolean;
  } | null>(null);
  const [tempPasswordCopied, setTempPasswordCopied] = useState(false);

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const {
    value: userSearch,
    setValue: setUserSearch,
    bufferedQuery: debouncedUserSearch,
    isBuffering: isUserSearchBuffering,
    clear: clearUserSearch,
  } = useSearchBuffer({ delay: 500 });
  const {
    value: auditSearch,
    setValue: setAuditSearch,
    bufferedQuery: debouncedAuditSearch,
    isBuffering: isAuditSearchBuffering,
    clear: clearAuditSearch,
  } = useSearchBuffer({ delay: 500 });
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [selectedAuditEntry, setSelectedAuditEntry] = useState<AuditEntry | null>(null);
  const [userSort, setUserSort] = useState<{ key: string; direction: TableSortDirection }>({
    key: "name",
    direction: "asc",
  });
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [openActionMenuUserId, setOpenActionMenuUserId] = useState<string | null>(null);
  const [actionMenuOpensAbove, setActionMenuOpensAbove] = useState(false);
  const [openRoleMenuUserId, setOpenRoleMenuUserId] = useState<string | null>(null);
  const [roleMenuOpensAbove, setRoleMenuOpensAbove] = useState(false);
  const [draftUserRoles, setDraftUserRoles] = useState<Record<string, string[]>>({});
  const [isSavingUserRole, setIsSavingUserRole] = useState(false);

  function handleOpenRoleMenu(user: ManagedUserRecord) {
    if (openRoleMenuUserId === user.id) {
      setOpenRoleMenuUserId(null);
    } else {
      setOpenRoleMenuUserId(user.id);
      setDraftUserRoles((prev) => ({
        ...prev,
        [user.id]: getUserAssignedRoles(user).filter((r) => r !== "superadmin"),
      }));
    }
  }

  function handleToggleDraftRole(userId: string, roleKey: string) {
    setDraftUserRoles((prev) => {
      const current = prev[userId] || [];
      if (current.includes(roleKey)) {
        if (current.length === 1) {
          toast.error("A user must retain at least one assigned role.");
          return prev;
        }
        return { ...prev, [userId]: current.filter((r) => r !== roleKey) };
      } else {
        return { ...prev, [userId]: [...current, roleKey] };
      }
    });
  }

  async function handleSaveUserRoles(user: ManagedUserRecord) {
    const nextRoles = draftUserRoles[user.id] ?? getUserAssignedRoles(user).filter((r) => r !== "superadmin");
    if (nextRoles.length === 0 && !user.isSuperadmin) {
      toast.error("A user must retain at least one assigned role.");
      return;
    }
    setIsSavingUserRole(true);
    const firstValidRole = nextRoles.find((r) => USER_ROLES.includes(r as UserRole)) as UserRole | undefined;
    const primaryRole = firstValidRole || user.role;
    const updatedLabel = nextRoles.map((r) => getRoleOrDeptName(r)).join(" + ");

    const previousUsers = users;
    setUsers((current) =>
      current.map((item) =>
        item.id === user.id
          ? {
              ...item,
              role: primaryRole,
              roles: nextRoles,
              departments: nextRoles,
              roleLabel: updatedLabel,
            }
          : item,
      ),
    );

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign-departments",
          userId: user.id,
          departmentIds: nextRoles,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setUsers(previousUsers);
        const errMsg = payload?.message ?? "Could not update user roles.";
        toast.error(errMsg);
        setFeedback({ tone: "error", text: errMsg });
      } else {
        toast.success(`Roles updated for ${user.fullName}`);
        setFeedback({ tone: "success", text: `Roles updated for ${user.fullName}` });
        setOpenRoleMenuUserId(null);
      }
    } catch {
      setUsers(previousUsers);
      toast.error("Network error while updating user roles.");
    } finally {
      setIsSavingUserRole(false);
    }
  }

  type DeptSimpleRecord = {
    id: string;
    code: string;
    name: string;
    isArchived: boolean;
  };
  const [departmentsList, setDepartmentsList] = useState<DeptSimpleRecord[]>([]);

  useEffect(() => {
    fetch("/api/departments")
      .then((res) => res.json())
      .then((data: { ok?: boolean; departments?: DeptSimpleRecord[] }) => {
        if (data?.ok && Array.isArray(data.departments)) {
          setDepartmentsList(data.departments);
        }
      })
      .catch(() => {});
  }, []);

  function getUserAssignedRoles(user: ManagedUserRecord): string[] {
    const roles = Array.isArray(user.roles) && user.roles.length > 0
      ? [...user.roles]
      : Array.isArray(user.departments) && user.departments.length > 0
      ? [...user.departments]
      : [user.role];
    return roles.filter(Boolean);
  }

  function getRoleOrDeptName(key: string): string {
    const roleMeta = ROLE_METADATA[key as UserRole];
    if (roleMeta) return roleMeta.label;
    const dept = departmentsList.find((d) => d.id === key || d.code === key);
    if (dept) return dept.name;
    if (key === "superadmin") return "President";
    return key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function getRoleDotColor(key: string): string {
    const k = key.toLowerCase();
    if (k === "superadmin") return "#f59e0b"; // Gold / Amber
    if (k === "admin" || k === "dept-admin") return "#8b5cf6"; // Purple
    if (k === "operations" || k === "dept-ops") return "#10b981"; // Emerald Green
    if (k === "finance" || k === "dept-fin") return "#0284c7"; // Blue
    if (k === "hr" || k === "dept-hr") return "#f59e0b"; // Amber / Orange
    if (k === "customer_representative" || k === "customer representative" || k === "dept-cs") return "#ec4899"; // Pink
    if (k === "secretary" || k === "dept-sec") return "#6366f1"; // Indigo
    const colors = ["#8b5cf6", "#0284c7", "#10b981", "#ec4899", "#f59e0b", "#06b6d4", "#6366f1"];
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  const assignableRoles = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    for (const r of USER_ROLES) {
      if (r === "admin" && !actor.isSuperadmin) continue;
      list.push({ value: r, label: ROLE_METADATA[r].label });
    }
    for (const d of departmentsList) {
      if (!d.isArchived && !USER_ROLES.includes(d.code as UserRole) && !list.some((item) => item.value === d.id || item.value === d.code)) {
        list.push({ value: d.id, label: d.name });
      }
    }
    return list;
  }, [actor.isSuperadmin, departmentsList]);

  async function handleToggleUserRole(user: ManagedUserRecord, toggledRole: string) {
    const currentRoles = getUserAssignedRoles(user).filter((r) => r !== "superadmin");
    let nextRoles: string[];
    if (currentRoles.includes(toggledRole)) {
      if (currentRoles.length === 1 && !user.isSuperadmin) {
        toast.error("A user must retain at least one assigned role.");
        setFeedback({
          tone: "error",
          text: "A user must retain at least one assigned role.",
        });
        return;
      }
      nextRoles = currentRoles.filter((r) => r !== toggledRole);
    } else {
      nextRoles = [...currentRoles, toggledRole];
    }

    const firstValidRole = nextRoles.find((r) => USER_ROLES.includes(r as UserRole)) as UserRole | undefined;
    const primaryRole = firstValidRole || user.role;
    const updatedLabel = nextRoles.map((r) => getRoleOrDeptName(r)).join(" + ");

    // Optimistically update the UI immediately so checkboxes respond in 0ms
    const previousUsers = users;
    setUsers((current) =>
      current.map((item) =>
        item.id === user.id
          ? {
              ...item,
              role: primaryRole,
              roles: nextRoles,
              departments: nextRoles,
              roleLabel: updatedLabel,
            }
          : item,
      ),
    );

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign-departments",
          userId: user.id,
          departmentIds: nextRoles,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setUsers(previousUsers);
        const errMsg = payload?.message ?? "Could not update user roles.";
        toast.error(errMsg);
        setFeedback({
          tone: "error",
          text: errMsg,
        });
        return;
      }

      toast.success(`Updated roles for ${user.fullName}: ${updatedLabel}`);
      setFeedback({
        tone: "success",
        text: `Updated roles for ${user.fullName}: ${updatedLabel}.`,
      });
      void loadAuditEntries(true);
    } catch {
      setUsers(previousUsers);
      toast.error("Could not update user roles.");
      setFeedback({
        tone: "error",
        text: "Could not update user roles.",
      });
    }
  }

  useEffect(() => {
    if (!openActionMenuUserId && !openRoleMenuUserId) return;
    function handleGlobalClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".table-row-actions")) {
        setOpenActionMenuUserId(null);
      }
      if (!target.closest(".role-selection-cell")) {
        setOpenRoleMenuUserId(null);
      }
    }
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenActionMenuUserId(null);
        setOpenRoleMenuUserId(null);
      }
    }
    document.addEventListener("mousedown", handleGlobalClick);
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [openActionMenuUserId, openRoleMenuUserId]);

  useEffect(() => {
    if (!userToDelete) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isDeletingUser) {
        setUserToDelete(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [userToDelete, isDeletingUser]);

  useEffect(() => {
    if (!userToDelete) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [userToDelete]);

  useEffect(() => {
    if (!tempPasswordPopup) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setTempPasswordPopup(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tempPasswordPopup]);

  useEffect(() => {
    if (!tempPasswordPopup) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [tempPasswordPopup]);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data: { ok?: boolean; users?: ManagedUserRecord[] }) => {
        if (data?.ok && Array.isArray(data.users)) {
          setUsers(data.users.map(normalizeManagedStaffRecord));
        }
      })
      .catch(() => {
        // Ignore fetch error
      });
  }, []);

  useEffect(() => {
    if (userStatusTab === "deleted" && actor.isSuperadmin) {
      fetch("/api/users?tab=deleted")
        .then((res) => res.json())
        .then((data: { ok?: boolean; users?: ManagedUserRecord[] }) => {
          if (data?.ok && Array.isArray(data.users)) {
            setDeletedUsers(data.users.filter((u) => u.isPermanentlyDeleted).map(normalizeManagedStaffRecord));
          }
        })
        .catch(() => {});
    }
  }, [userStatusTab, actor.isSuperadmin]);

  async function loadAuditEntries(silent = false) {
    if (!silent) setAuditLoading(true);
    setAuditError(null);
    try {
      const response = await fetch(`/api/audit?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        entries?: AuditEntry[];
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? "Unable to load audit log.");
      }

      setAuditEntries(payload.entries ?? []);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Error loading audit records.");
      if (!silent) {
        setAuditError(err instanceof Error ? err.message : "Error loading audit records.");
      }
    } finally {
      setAuditLoading(false);
      if (!silent) setAuditLoading(false);
    }
  }

  async function handlePurgeAuditLog() {
    if (!window.confirm("Are you sure you want to clear all audit records? This action is permanent.")) {
      return;
    }
    setAuditLoading(true);
    try {
      const response = await fetch("/api/audit", {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? "Failed to clear audit trail.");
      }
      setAuditEntries([]);
      toast.success("Audit trail cleared successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error clearing audit records.");
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "audit") return;

    // Initial fetch when switching to audit tab
    void loadAuditEntries();

    // Auto-revalidate periodically (every 20 seconds) while on audit tab
    const intervalId = setInterval(() => {
      void loadAuditEntries(true);
    }, 20000);

    // Auto-revalidate on window focus or visibility change
    function handleVisibilityOrFocus() {
      if (document.visibilityState === "visible") {
        void loadAuditEntries(true);
      }
    }

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [activeTab]);

  useEffect(() => {
    if (!selectedAuditEntry && !authorizingUser && !editingUser && !editingContactUser) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedAuditEntry) setSelectedAuditEntry(null);
        if (authorizingUser && !isAuthorizing) setAuthorizingUser(null);
        if (editingUser && !isUpdatingUsername) setEditingUser(null);
        if (editingContactUser && !isUpdatingContact) setEditingContactUser(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedAuditEntry,
    authorizingUser,
    isAuthorizing,
    editingUser,
    isUpdatingUsername,
    editingContactUser,
    isUpdatingContact,
  ]);

  const filteredAuditEntries = useMemo(() => {
    const q = debouncedAuditSearch.trim().toLowerCase();
    return auditEntries.filter((entry) => {
      if (actionFilter && actionFilter !== "all" && actionFilter !== "All Actions") {
        const normalizedAction = actionFilter.toLowerCase().replace(/\s+/g, "_");
        if (!entry.action.toLowerCase().includes(normalizedAction)) {
          return false;
        }
      }
      if (entityFilter && entityFilter !== "all" && entityFilter !== "All Entities") {
        const normalizedEntity = entityFilter.toLowerCase().replace(/\s+/g, "_");
        if (
          entry.entityType.toLowerCase() !== normalizedEntity &&
          !entry.entityType.toLowerCase().includes(normalizedEntity)
        ) {
          return false;
        }
      }
      if (!q) return true;
      return [
        entry.actorEmail,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.summary,
        entry.changes ? JSON.stringify(entry.changes) : "",
      ].some((val) => (val ?? "").toLowerCase().includes(q));
    });
  }, [auditEntries, debouncedAuditSearch, actionFilter, entityFilter]);

  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PAGE_SIZE = 10;
  const auditPageCount = Math.max(1, Math.ceil(filteredAuditEntries.length / AUDIT_PAGE_SIZE));

  useEffect(() => {
    setAuditPage(1);
  }, [debouncedAuditSearch, actionFilter, entityFilter]);

  const paginatedAuditEntries = useMemo(() => {
    const start = (auditPage - 1) * AUDIT_PAGE_SIZE;
    return filteredAuditEntries.slice(start, start + AUDIT_PAGE_SIZE);
  }, [filteredAuditEntries, auditPage]);

  const auditStats = useMemo(() => {
    const total = auditEntries.length;
    const deliveryAndFinance = auditEntries.filter(
      (e) => e.entityType === "delivery" || e.entityType === "import_batch",
    ).length;
    const fleetAndSecurity = auditEntries.filter(
      (e) => e.entityType === "truck" || e.entityType === "user" || e.entityType === "system",
    ).length;
    return { total, deliveryAndFinance, fleetAndSecurity };
  }, [auditEntries]);

  const activeUsers = useMemo(() => users.filter((u) => u.isActive && !u.isPermanentlyDeleted), [users]);
  const deactivatedUsers = useMemo(() => users.filter((u) => !u.isActive && !u.isPermanentlyDeleted), [users]);

  const filteredUsers = useMemo(() => {
    const list =
      userStatusTab === "active"
        ? activeUsers
        : userStatusTab === "deactivated"
        ? deactivatedUsers
        : deletedUsers;
    const q = debouncedUserSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) =>
      u.fullName.toLowerCase().includes(q) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      u.email.toLowerCase().includes(q) ||
      (u.phoneNumber && u.phoneNumber.toLowerCase().includes(q)) ||
      u.roleLabel.toLowerCase().includes(q) ||
      u.accessLevelLabel.toLowerCase().includes(q) ||
      (u.deletedReason && u.deletedReason.toLowerCase().includes(q)) ||
      (u.deletedBy && u.deletedBy.toLowerCase().includes(q))
    );
  }, [userStatusTab, activeUsers, deactivatedUsers, deletedUsers, debouncedUserSearch]);

  const sortedUsers = useMemo(() => {
    const multiplier = userSort.direction === "asc" ? 1 : -1;
    return [...filteredUsers].sort((left, right) => {
      // Superadmin is pinned strictly at the top
      if (left.isSuperadmin && !right.isSuperadmin) return -1;
      if (!left.isSuperadmin && right.isSuperadmin) return 1;

      const values: Record<string, [string | number, string | number]> = {
        name: [left.fullName, right.fullName],
        username: [left.username ?? "", right.username ?? ""],
        email: [left.email, right.email],
        role: [left.roleLabel, right.roleLabel],
        status: [Number(left.isActive), Number(right.isActive)],
      };
      const [leftValue, rightValue] = values[userSort.key] ?? values.name;
      const compared = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
      return compared * multiplier || left.id.localeCompare(right.id);
    });
  }, [userSort, filteredUsers]);

  const [userPage, setUserPage] = useState(1);
  const USER_PAGE_SIZE = 10;
  const userPageCount = Math.max(1, Math.ceil(sortedUsers.length / USER_PAGE_SIZE));

  useEffect(() => {
    setUserPage(1);
  }, [userSort, userStatusTab, debouncedUserSearch]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * USER_PAGE_SIZE;
    return sortedUsers.slice(start, start + USER_PAGE_SIZE);
  }, [sortedUsers, userPage]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setFeedback(null);

    const cleanUsername = username.trim().toLowerCase();
    const usernameValidation = validateUsernameFormat(cleanUsername);
    if (!usernameValidation.isValid) {
      setFeedback({
        tone: "error",
        text: usernameValidation.message ?? "Invalid username format.",
      });
      setIsCreating(false);
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setFeedback({
        tone: "error",
        text: "A valid email address is required.",
      });
      setIsCreating(false);
      return;
    }

    const cleanPhone = formatPhoneNumber(phoneNumber);
    if (!cleanPhone || cleanPhone.length < 7) {
      setFeedback({
        tone: "error",
        text: "A valid phone number is required (at least 7 digits).",
      });
      setIsCreating(false);
      return;
    }

    const assignedTempPassword = generateRandomTemporaryPassword();

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: cleanUsername,
          temporaryPassword: assignedTempPassword,
          confirmTemporaryPassword: assignedTempPassword,
          email: cleanEmail,
          phoneNumber: cleanPhone,
          role: newRole,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        user?: ManagedUserRecord;
        message?: string;
        temporaryPassword?: string;
      } | null;

      if (!response.ok || !payload?.ok || !payload.user) {
        setFeedback({
          tone: "error",
          text: payload?.message ?? "Could not create user account.",
        });
        return;
      }

      setUsers((current) => [...current, payload.user!]);
      setFullName("");
      setUsername("");
      setEmail("");
      setPhoneNumber("");
      setFeedback({
        tone: "success",
        text: `Provisioned @${payload.user.username} (${payload.user.fullName}) with role ${payload.user.roleLabel}.`,
      });
      setTempPasswordPopup({
        fullName: payload.user.fullName,
        username: payload.user.username,
        roleLabel: payload.user.roleLabel,
        password: payload.temporaryPassword || assignedTempPassword,
        isNewlyProvisioned: true,
      });
      setTempPasswordCopied(false);
      toast.success(`Account @${payload.user.username} provisioned!`);
      void loadAuditEntries(true);
    } catch {
      setFeedback({
        tone: "error",
        text: "Failed to create user account. Please try again.",
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRoleChange(userId: string, updatedRole: UserRole) {
    setFeedback(null);

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: updatedRole }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        user?: ManagedUserRecord;
        message?: string;
        temporaryPassword?: string;
      } | null;

      if (!response.ok || !payload?.ok || !payload.user) {
        setFeedback({
          tone: "error",
          text: payload?.message ?? "Could not update user role.",
        });
        return;
      }

      setUsers((current) =>
        current.map((item) => (item.id === userId ? { ...item, ...payload.user } : item)),
      );
      setFeedback({
        tone: "success",
        text: `Updated ${payload.user.fullName}'s role to ${payload.user.roleLabel}.`,
      });
      void loadAuditEntries(true);
    } catch {
      setFeedback({
        tone: "error",
        text: "Could not update user role.",
      });
    }
  }

  async function handleToggleActive(user: ManagedUserRecord) {
    setFeedback(null);

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, isActive: !user.isActive }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        user?: ManagedUserRecord;
        message?: string;
        temporaryPassword?: string;
      } | null;

      if (!response.ok || !payload?.ok || !payload.user) {
        setFeedback({
          tone: "error",
          text: payload?.message ?? "Could not update account status.",
        });
        return;
      }

      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, ...payload.user } : item)),
      );
      setFeedback({
        tone: "success",
        text: `${payload.user.fullName} (@${payload.user.username}) is now ${payload.user.isActive ? "Active" : "Deactivated"}.`,
      });
      void loadAuditEntries(true);
    } catch {
      setFeedback({
        tone: "error",
        text: "Could not update account status.",
      });
    }
  }

  async function handleConfirmAuthorizeReset() {
    if (!authorizingUser) return;
    setIsAuthorizing(true);
    setAuthorizeError(null);

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "authorize-reset",
          userId: authorizingUser.id,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        expiresAt?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setAuthorizeError(payload?.message ?? "Failed to authorize password recovery.");
        return;
      }

      setUsers((current) =>
        current.map((u) =>
          u.id === authorizingUser.id
            ? {
                ...u,
                recoveryAuthorizedAt: new Date().toISOString(),
                recoveryExpiresAt: payload.expiresAt ?? new Date(Date.now() + 86400000).toISOString(),
              }
            : u,
        ),
      );

      setFeedback({
        tone: "success",
        text: payload.message ?? `Authorized single-use password recovery for @${authorizingUser.username}.`,
      });
      setAuthorizingUser(null);
      void loadAuditEntries(true);
    } catch {
      setAuthorizeError("Network or server error while authorizing password recovery.");
    } finally {
      setIsAuthorizing(false);
    }
  }

  async function handleConfirmUpdateUsername(event: FormEvent) {
    event.preventDefault();
    if (!editingUser) return;
    setIsUpdatingUsername(true);
    setEditUsernameError(null);

    const cleanUsername = newUsernameInput.trim().toLowerCase();
    const validation = validateUsernameFormat(cleanUsername);
    if (!validation.isValid) {
      setEditUsernameError(validation.message ?? "Invalid username format.");
      setIsUpdatingUsername(false);
      return;
    }

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-username",
          userId: editingUser.id,
          newUsername: cleanUsername,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        user?: { id: string; username: string };
      } | null;

      if (!response.ok || !payload?.ok) {
        setEditUsernameError(payload?.message ?? "Could not update username.");
        return;
      }

      setUsers((current) =>
        current.map((u) =>
          u.id === editingUser.id
            ? { ...u, username: payload.user?.username ?? cleanUsername }
            : u,
        ),
      );

      setFeedback({
        tone: "success",
        text: `Successfully updated username for ${editingUser.fullName} to @${payload.user?.username ?? cleanUsername}.`,
      });
      setEditingUser(null);
      void loadAuditEntries(true);
    } catch {
      setEditUsernameError("Network or server error while updating username.");
    } finally {
      setIsUpdatingUsername(false);
    }
  }

  async function handleConfirmUpdateContact(event: FormEvent) {
    event.preventDefault();
    if (!editingContactUser) return;
    setIsUpdatingContact(true);
    setEditContactError(null);

    const cleanEmail = editEmailInput.trim().toLowerCase();
    const cleanPhone = formatPhoneNumber(editPhoneInput);

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setEditContactError("Please enter a valid email address.");
      setIsUpdatingContact(false);
      return;
    }

    if (!cleanPhone || cleanPhone.length < 7) {
      setEditContactError("Please enter a valid phone number (min 7 digits).");
      setIsUpdatingContact(false);
      return;
    }

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-contact",
          userId: editingContactUser.id,
          email: cleanEmail,
          phoneNumber: cleanPhone,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        user?: ManagedUserRecord;
      } | null;

      if (!response.ok || !payload?.ok || !payload.user) {
        setEditContactError(payload?.message ?? "Could not update contact details.");
        return;
      }

      setUsers((current) =>
        current.map((u) => (u.id === editingContactUser.id ? { ...u, ...payload.user } : u)),
      );

      setFeedback({
        tone: "success",
        text: `Successfully updated contact details for ${editingContactUser.fullName} (@${editingContactUser.username}).`,
      });
      setEditingContactUser(null);
      void loadAuditEntries(true);
    } catch {
      setEditContactError("Network or server error while updating contact details.");
    } finally {
      setIsUpdatingContact(false);
    }
  }

  async function handleConfirmDeleteUser() {
    if (!userToDelete || isDeletingUser) return;
    setIsDeletingUser(true);

    try {
      const response = await fetch(`/api/users?userId=${userToDelete.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setFeedback({
          tone: "error",
          text: data.message ?? "Could not delete user account.",
        });
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setFeedback({
        tone: "success",
        text: `User account @${userToDelete.username} (${userToDelete.fullName}) was deleted.`,
      });
      setUserToDelete(null);
      void loadAuditEntries(true);
    } catch {
      setFeedback({
        tone: "error",
        text: "Network error while deleting user account.",
      });
    } finally {
      setIsDeletingUser(false);
    }
  }

  return (
    <>
      <OperationalTopbar
        contextLabel="Admin User Account & Role Management"
        showDateFilter={false}
      />

      <div className="content-wrap settings-page-wrap user-management-page-wrap">
        <div className="settings-layout-grid">
          {/* Left Navigation: Clean text tabs matching Settings layout */}
          <aside className="settings-tabs-sidebar" aria-label="User management categories">
            <nav className="settings-tabs-list" role="tablist">
              <button
                type="button"
                role="tab"
                id="tab-users"
                aria-selected={activeTab === "users"}
                aria-controls="panel-users"
                className={`settings-tab-btn${activeTab === "users" ? " active" : ""}`}
                onClick={() => handleSelectTab("users")}
              >
                Staff Accounts
              </button>

              <button
                type="button"
                role="tab"
                id="tab-permissions"
                aria-selected={activeTab === "permissions"}
                aria-controls="panel-permissions"
                className={`settings-tab-btn${activeTab === "permissions" ? " active" : ""}`}
                onClick={() => {
                  setPermissionFocusUserId(undefined);
                  handleSelectTab("permissions");
                }}
              >
                Permissions
              </button>

              <button
                type="button"
                role="tab"
                id="tab-audit"
                aria-selected={activeTab === "audit"}
                aria-controls="panel-audit"
                className={`settings-tab-btn${activeTab === "audit" ? " active" : ""}`}
                onClick={() => handleSelectTab("audit")}
              >
                Audit Trail
              </button>
            </nav>
          </aside>

          {/* Right Main Content Area */}
          <div className="settings-tab-content-area">
            {activeTab === "users" && (
              <div id="panel-users" role="tabpanel" aria-labelledby="tab-users" className="settings-tab-panel">
                <header className="page-intro" style={{ marginBottom: "16px" }}>
                  <div>
                    <h1>User Management</h1>
                    <p className="subtitle">
                      Manage staff accounts and credentials.
                    </p>
                  </div>
                </header>
            {feedback ? (
              <section className="notice" role={feedback.tone === "error" ? "alert" : "status"}>
                <span className="notice-icon" aria-hidden="true">
                  {feedback.tone === "error" ? "!" : "i"}
                </span>
                <div>
                  <strong>
                    {feedback.tone === "error" ? "Update Error:" : "Account Updated:"}
                  </strong>
                  <span>{feedback.text}</span>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notice"
                  title="Dismiss"
                  onClick={() => setFeedback(null)}
                >
                  ×
                </button>
              </section>
            ) : null}

            {/* Provision Account Form */}
            <section
              id="add-user"
              className="records-card user-provision-card"
              aria-label="Provision new staff account"
            >
              <div className="records-heading">
                <div>
                  <h2>Add User</h2>
                  <p>Provision new staff account credentials and role assignments.</p>
                </div>
              </div>

              <form onSubmit={handleCreateUser} className="user-provision-form">
                {/* Group 1: Staff Profile & Role */}
                <div className="user-provision-group">
                  <div className="user-provision-group-header">
                    <h3 className="user-provision-group-title">Staff Profile &amp; Role</h3>
                  </div>
                  <div className="user-provision-group-body">
                    <div className="user-provision-grid-3">
                      <div className="user-form-field">
                        <label htmlFor="provision-full-name" className="user-form-label">
                          Full Name
                        </label>
                        <input
                          id="provision-full-name"
                          className="user-management-input"
                          type="text"
                          placeholder="e.g. Carlo Mendoza"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          required
                        />
                      </div>

                      <div className="user-form-field">
                        <label htmlFor="provision-username" className="user-form-label">
                          Username
                        </label>
                        <input
                          id="provision-username"
                          className="user-management-input"
                          type="text"
                          placeholder="e.g. cmendoza"
                          value={username}
                          onChange={(event) => setUsername(event.target.value.toLowerCase())}
                          required
                        />
                        {username.trim().length > 0 ? (() => {
                          const check = validateUsernameFormat(username);
                          return (
                            <span
                              className="user-form-hint"
                              style={{
                                color: check.isValid
                                  ? "var(--color-status-success, #0f8a4f)"
                                  : "var(--color-danger, #dc2626)",
                                fontWeight: 500,
                              }}
                            >
                              {check.isValid ? "✓ Valid username (3–30 chars)" : check.message}
                            </span>
                          );
                        })() : (
                          <span className="user-form-hint">
                            3-30 chars (a-z, 0-9, -, _, .)
                          </span>
                        )}
                      </div>

                      <div className="user-form-field">
                        <span className="user-form-label">Assigned Role</span>
                        <RoundedSelect
                          value={newRole}
                          options={availableRoleOptions}
                          onChange={(val) => setNewRole(val as UserRole)}
                          ariaLabel="Select role for new user"
                          className="is-form-select"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group 2: Contact Information */}
                <div className="user-provision-group">
                  <div className="user-provision-group-header">
                    <h3 className="user-provision-group-title">Contact Information</h3>
                  </div>
                  <div className="user-provision-group-body">
                    <div className="user-provision-grid-2">
                      <div className="user-form-field">
                        <label htmlFor="provision-email" className="user-form-label">
                          Email Address
                        </label>
                        <input
                          id="provision-email"
                          className="user-management-input"
                          type="email"
                          placeholder="e.g. carlo.mendoza@routex.local"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                        />
                        {email.trim().length > 0 ? (() => {
                          const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
                          return (
                            <span
                              className="user-form-hint"
                              style={{
                                color: validEmail
                                  ? "var(--color-status-success, #0f8a4f)"
                                  : "var(--color-danger, #dc2626)",
                                fontWeight: 500,
                              }}
                            >
                              {validEmail ? "✓ Valid email address" : "Enter a valid email address (e.g. name@domain.com)"}
                            </span>
                          );
                        })() : null}
                      </div>

                      <div className="user-form-field">
                        <label htmlFor="provision-phone" className="user-form-label">
                          Phone Number
                        </label>
                        <input
                          id="provision-phone"
                          className="user-management-input"
                          type="tel"
                          placeholder="e.g. 09171234567"
                          value={phoneNumber}
                          onChange={(event) => setPhoneNumber(event.target.value)}
                          required
                        />
                        {phoneNumber.trim().length > 0 ? (() => {
                          const digits = phoneNumber.replace(/\D/g, "");
                          const validPhone = digits.length >= 10 && digits.length <= 13;
                          return (
                            <span
                              className="user-form-hint"
                              style={{
                                color: validPhone
                                  ? "var(--color-status-success, #0f8a4f)"
                                  : "var(--color-danger, #dc2626)",
                                fontWeight: 500,
                              }}
                            >
                              {validPhone ? "✓ Valid contact number" : "Enter a valid 11-digit mobile number (e.g. 09171234567)"}
                            </span>
                          );
                        })() : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group 3: Credentials & Access */}
                <div className="user-provision-group">
                  <div className="user-provision-group-header">
                    <h3 className="user-provision-group-title">Temporary Credentials</h3>
                  </div>
                  <div className="user-provision-group-body">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "14px",
                        padding: "14px 18px",
                        borderRadius: "10px",
                        background: "var(--color-surface-subtle)",
                        border: "1px solid var(--color-border)",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 650, color: "var(--color-text-primary)" }}>
                          One-Time Access Password
                        </span>
                        <span style={{ fontSize: "11.5px", color: "var(--color-text-secondary)" }}>
                          A cryptographically random temporary password is generated and displayed once upon successful account provisioning.
                        </span>
                      </div>
                      <span
                        className="status-badge neutral"
                        style={{
                          fontSize: "11.5px",
                          padding: "6px 12px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        Issued on Account Creation
                      </span>
                    </div>

                    <div className="user-provision-note" style={{ marginTop: "10px" }}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0, marginTop: "2px", color: "var(--color-accent-deep)" }}
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <div>
                        <strong>Auto-Generated:</strong> Share this temporary password securely with the user. They will be prompted to set their permanent password and security question upon first login.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="user-provision-actions">
                  <button
                    type="submit"
                    className="primary-action-button"
                    disabled={isCreating}
                    style={{ minHeight: "40px", minWidth: "165px" }}
                  >
                    {isCreating ? "Provisioning…" : "+ Provision Account"}
                  </button>
                </div>
              </form>
            </section>

            {/* Registered Users Table */}
            <section className="records-card" aria-label="Registered RouteX users">
              <div
                className="records-heading"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <h2>Staff Accounts</h2>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    {userStatusTab === "active"
                      ? `Active operational staff (${activeUsers.length})`
                      : userStatusTab === "deactivated"
                      ? `Deactivated ex-employee archive (${deactivatedUsers.length})`
                      : `Historical deleted accounts archive (${deletedUsers.length})`}
                  </p>
                </div>
                <div
                  className="user-management-tabs"
                  role="tablist"
                  aria-label="Staff account status filter"
                  style={{ margin: 0 }}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={userStatusTab === "active"}
                    className={userStatusTab === "active" ? "active" : ""}
                    onClick={() => setUserStatusTab("active")}
                  >
                    Active Staff ({activeUsers.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={userStatusTab === "deactivated"}
                    className={userStatusTab === "deactivated" ? "active" : ""}
                    onClick={() => setUserStatusTab("deactivated")}
                  >
                    Deactivated Archive ({deactivatedUsers.length})
                  </button>
                  {actor.isSuperadmin && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={userStatusTab === "deleted"}
                      className={userStatusTab === "deleted" ? "active" : ""}
                      onClick={() => setUserStatusTab("deleted")}
                    >
                      Historical / Deleted ({deletedUsers.length})
                    </button>
                  )}
                </div>
              </div>

              <div className="filters" style={{ borderBottom: "1px solid var(--line)", padding: "0 23px 17px" }}>
                <label className={`search-box${isUserSearchBuffering ? " is-buffering" : ""}`} style={{ maxWidth: "420px", flex: 1 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search staff by name, @username, email, role..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    aria-label="Search staff accounts"
                  />
                  {userSearch ? (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={clearUserSearch}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  ) : null}
                </label>
              </div>

              {userStatusTab === "deleted" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    margin: "12px 0 16px",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, color: "var(--color-danger, #dc2626)" }}
                    aria-hidden="true"
                  >
                    <path d="M8 2h8a2 2 0 0 1 2 2v14a4 4 0 0 1-4 4H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <path d="M18 18a2 2 0 0 1-2 2H6" />
                  </svg>
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
                    <strong>Historical Retention Record (Executive Superadmin View):</strong> Accounts listed here have been permanently deleted and cannot be reactivated or used to log in. In accordance with enterprise audit standards, all past deliveries, transactions, approvals, and actions retain full attribution to the original employee identity.
                  </span>
                </div>
              )}

              {userStatusTab === "deactivated" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "rgba(100, 116, 139, 0.08)",
                    border: "1px solid rgba(100, 116, 139, 0.2)",
                    margin: "12px 0 16px",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, color: "var(--color-text-secondary)" }}
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
                    <strong>Ex-Employee Archive:</strong> Deactivated staff accounts are prevented from logging in. All historical delivery assignments, expense entries, and audit trail records remain intact. You can reactivate an account at any time via the action menu.
                  </span>
                </div>
              )}

              {userStatusTab === "deleted" ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Historical Staff Member</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Deletion Details</th>
                        <th>Documented Reason</th>
                        <th>Attribution Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="table-empty-cell">
                            <div className="empty-state minimal">
                              <strong className="empty-state-title">
                                {debouncedUserSearch.trim()
                                  ? `No deleted employee records match "${userSearch.trim()}"`
                                  : "No permanently deleted employee records"}
                              </strong>
                              <span className="empty-state-desc">
                                {debouncedUserSearch.trim()
                                  ? "Try searching with a different term or clear the search input."
                                  : "Historical accounts will appear here after permanent executive deletion."}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        sortedUsers.map((delUser) => (
                          <tr key={delUser.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <strong>{delUser.fullName}</strong>
                                <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.1)", color: "#dc2626", fontWeight: 700 }}>
                                  Permanently Deleted
                                </span>
                              </div>
                              <small style={{ color: "var(--color-text-muted)", fontSize: "11px" }}>
                                {delUser.email}
                              </small>
                            </td>
                            <td>
                              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                                @{delUser.username}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: "12px", fontWeight: 500 }}>
                                {delUser.roleLabel}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: "12px" }}>
                                {delUser.deletedAt ? new Date(delUser.deletedAt).toLocaleDateString() : "Historical"}
                              </span>
                              <br />
                              <small style={{ color: "var(--color-text-muted)", fontSize: "11px" }}>
                                Authorizer: @{delUser.deletedBy || "superadmin"}
                              </small>
                            </td>
                            <td style={{ maxWidth: "260px" }}>
                              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                                {delUser.deletedReason || "Corporate personnel record retention."}
                              </span>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: "11px",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  background: "rgba(16, 185, 129, 0.1)",
                                  color: "#059669",
                                  fontWeight: 650,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <svg
                                  width="11"
                                  height="11"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Preserved in Audit &amp; Transactions
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <SortableTableHeader
                          label="Staff Member"
                          sortKey="name"
                          activeSortKey={userSort.key}
                          direction={userSort.direction}
                          onSort={(key, direction) => setUserSort({ key, direction })}
                        />
                        <SortableTableHeader
                          label="Username"
                          sortKey="username"
                          activeSortKey={userSort.key}
                          direction={userSort.direction}
                          onSort={(key, direction) => setUserSort({ key, direction })}
                        />
                        <SortableTableHeader
                          label="Roles & Departments"
                          sortKey="role"
                          activeSortKey={userSort.key}
                          direction={userSort.direction}
                          onSort={(key, direction) => setUserSort({ key, direction })}
                          className="col-role-dept"
                        />
                        <SortableTableHeader
                          label="Status"
                          sortKey="status"
                          activeSortKey={userSort.key}
                          direction={userSort.direction}
                          defaultDirection="desc"
                          onSort={(key, direction) => setUserSort({ key, direction })}
                        />
                        <th><span className="sr-only">More actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="table-empty-cell">
                            <div className="empty-state minimal">
                              <strong className="empty-state-title">
                                {debouncedUserSearch.trim()
                                  ? `No staff accounts match "${userSearch.trim()}"`
                                  : userStatusTab === "active"
                                  ? "No active staff accounts found"
                                  : "No deactivated accounts in archive"}
                              </strong>
                              <span className="empty-state-desc">
                                {debouncedUserSearch.trim()
                                  ? "Try searching for a different name, username, email, or role."
                                  : userStatusTab === "active"
                                  ? "No registered staff users match the active view."
                                  : "When former employees depart, deactivating their accounts archives them here."}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.map((user, userIndex) => {
                        const isRecoveryActive = Boolean(
                          user.recoveryExpiresAt && new Date(user.recoveryExpiresAt) > new Date(),
                        );
                        const isSelf = user.id === actor.id;

                        return (
                          <tr
                            key={user.id}
                            style={{
                              position: "relative",
                              zIndex: openActionMenuUserId === user.id ? 150 : undefined,
                            }}
                          >
                            <td>
                              <div>
                                <strong>{user.fullName}</strong>
                              </div>
                              <small style={{ color: "var(--color-text-muted)", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span>{user.email}</span>
                                {user.phoneNumber ? (
                                  <>
                                    <span aria-hidden="true" style={{ opacity: 0.5 }}>·</span>
                                    <span>{formatPhoneNumber(user.phoneNumber)}</span>
                                  </>
                                ) : null}
                              </small>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  fontWeight: 600,
                                  color: "var(--color-text-primary)",
                                  fontSize: "12px",
                                }}
                              >
                                @{user.username}
                              </span>
                            </td>
                            <td
                              className="role-selection-cell"
                              style={{
                                verticalAlign: "middle",
                                padding: "10px 14px",
                                width: "230px",
                                maxWidth: "260px",
                              }}
                            >
                                <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
                                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px" }}>
                                    {user.isSuperadmin && (
                                      <span
                                        className="discord-role-pill is-superadmin"
                                        title="Permanent Executive: Unrestricted system authority across all modules"
                                      >
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                        </svg>
                                        <span className="discord-role-text">President</span>
                                      </span>
                                    )}

                                    {getUserAssignedRoles(user)
                                      .filter((roleKey) => roleKey !== "superadmin" && (!user.isSuperadmin || roleKey !== "admin"))
                                      .map((roleKey) => {
                                        const isProtectedAdmin = roleKey === "admin" && !actor.isSuperadmin;
                                        const dotColor = getRoleDotColor(roleKey);
                                        return (
                                          <span
                                            key={roleKey}
                                            className="discord-role-pill"
                                            title={isProtectedAdmin ? "Protected role: Only the President can modify Admin accounts" : getRoleOrDeptName(roleKey)}
                                          >
                                            <span
                                              className="discord-role-dot"
                                              style={{ backgroundColor: dotColor }}
                                              aria-hidden="true"
                                            />
                                            <span className="discord-role-text">
                                              {getRoleOrDeptName(roleKey)}
                                            </span>
                                          </span>
                                        );
                                      })}

                                    {(Boolean(user.customGrants?.length) || Boolean(user.customRestrictions?.length)) && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPermissionFocusUserId(user.id);
                                          handleSelectTab("permissions");
                                        }}
                                        className="discord-role-pill"
                                        style={{
                                          cursor: "pointer",
                                          borderStyle: "dashed",
                                        }}
                                        title="Custom permission overrides active in Matrix. Click to inspect."
                                      >
                                        <span className="discord-role-dot" style={{ backgroundColor: "#0284c7" }} aria-hidden="true" />
                                        <span className="discord-role-text">
                                          Matrix ({(user.customGrants?.length ?? 0) > 0 ? `+${user.customGrants?.length}` : ""}{(user.customRestrictions?.length ?? 0) > 0 ? ` -${user.customRestrictions?.length}` : ""})
                                        </span>
                                      </button>
                                    )}

                                    {(actor.isSuperadmin || (!user.isSuperadmin && user.role !== "admin")) && (
                                      <button
                                        type="button"
                                        className="discord-role-add-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const spaceBelow = window.innerHeight - rect.bottom;
                                          setRoleMenuOpensAbove(spaceBelow < 220 || userIndex >= paginatedUsers.length - 2);
                                          handleOpenRoleMenu(user);
                                        }}
                                        title={`Assign or change roles/departments for ${user.fullName}`}
                                        aria-label={`Assign or change roles for ${user.fullName}`}
                                      >
                                        +
                                      </button>
                                    )}
                                  </div>

                                  {openRoleMenuUserId === user.id && (
                                    <div
                                      className="role-selection-popover"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        position: "absolute",
                                        ...(roleMenuOpensAbove ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
                                        left: 0,
                                        zIndex: 1000,
                                        background: "var(--color-surface, #ffffff)",
                                        border: "1px solid var(--color-border)",
                                        borderRadius: "8px",
                                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
                                        padding: "10px",
                                        width: "252px",
                                        minWidth: "252px",
                                        maxWidth: "252px",
                                        boxSizing: "border-box",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "6px",
                                      }}
                                    >
                                      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span>Assign Roles &amp; Departments</span>
                                        <button
                                          type="button"
                                          onClick={() => setOpenRoleMenuUserId(null)}
                                          style={{ background: "none", border: "none", fontSize: "14px", cursor: "pointer", color: "var(--color-text-muted)", padding: 0 }}
                                        >
                                          ×
                                        </button>
                                      </div>

                                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "180px", overflowY: "auto" }}>
                                        {assignableRoles.map((roleOpt) => {
                                          const currentRoles = draftUserRoles[user.id] ?? getUserAssignedRoles(user);
                                          const isChecked = currentRoles.includes(roleOpt.value);
                                          const dotColor = getRoleDotColor(roleOpt.value);
                                          return (
                                            <label
                                              key={roleOpt.value}
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                                fontSize: "12px",
                                                cursor: "pointer",
                                                padding: "4px 8px",
                                                borderRadius: "6px",
                                                background: isChecked ? "var(--color-surface-subtle, rgba(0, 0, 0, 0.04))" : "transparent",
                                              }}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleToggleDraftRole(user.id, roleOpt.value)}
                                                style={{ accentColor: "var(--color-primary, #0284c7)" }}
                                              />
                                              <span
                                                style={{
                                                  width: "7px",
                                                  height: "7px",
                                                  borderRadius: "50%",
                                                  backgroundColor: dotColor,
                                                  flexShrink: 0,
                                                }}
                                                aria-hidden="true"
                                              />
                                              <span style={{ fontWeight: isChecked ? 600 : 400, color: "var(--color-text-primary)" }}>{roleOpt.label}</span>
                                            </label>
                                          );
                                        })}
                                      </div>

                                      <div style={{ display: "flex", gap: "6px", marginTop: "4px", paddingTop: "6px", borderTop: "1px solid var(--color-border)" }}>
                                         <button
                                           type="button"
                                           className="routex-btn variant-primary size-xs"
                                           style={{ flex: 1, minHeight: "26px", fontSize: "11px", justifyContent: "center" }}
                                           onClick={() => handleSaveUserRoles(user)}
                                           disabled={isSavingUserRole}
                                         >
                                           {isSavingUserRole ? "Saving..." : "Save Roles"}
                                         </button>
                                         <button
                                           type="button"
                                           className="routex-btn variant-secondary size-xs"
                                           style={{ minHeight: "26px", fontSize: "11px", padding: "0 8px" }}
                                           onClick={() => setOpenRoleMenuUserId(null)}
                                         >
                                           Cancel
                                         </button>
                                       </div>

                                       <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "6px", marginTop: "2px" }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenRoleMenuUserId(null);
                                            setPermissionFocusUserId(user.id);
                                            handleSelectTab("permissions");
                                          }}
                                          style={{
                                            background: "none",
                                            border: "none",
                                            padding: 0,
                                            fontSize: "11px",
                                            color: "var(--color-accent, #0284c7)",
                                            cursor: "pointer",
                                            textAlign: "left",
                                            textDecoration: "underline",
                                            fontWeight: 500,
                                          }}
                                        >
                                          Configure in Permission Matrix →
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: user.isActive ? "#059669" : "var(--color-text-muted)",
                                  fontWeight: 500,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <span
                                  aria-hidden="true"
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: user.isActive ? "#10b981" : "var(--color-text-muted)",
                                    flexShrink: 0,
                                  }}
                                />
                                {user.isActive ? "Active" : "Deactivated"}
                                {isRecoveryActive ? (
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "#d97706",
                                      fontWeight: 500,
                                      marginLeft: "4px",
                                    }}
                                    title={`Reset authorized until ${new Date(user.recoveryExpiresAt!).toLocaleTimeString()}`}
                                  >
                                    (Reset active)
                                  </span>
                                ) : null}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div className="table-row-actions" style={{ position: "relative", display: "inline-block" }}>
                                <button
                                  type="button"
                                  className="row-action-more-btn"
                                  aria-label={`Actions for ${user.fullName}`}
                                  aria-haspopup="menu"
                                  aria-expanded={openActionMenuUserId === user.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    const isNearBottom = spaceBelow < 220 || userIndex >= paginatedUsers.length - 2;
                                    setActionMenuOpensAbove(isNearBottom);
                                    setOpenActionMenuUserId((curr) => (curr === user.id ? null : user.id));
                                  }}
                                  title="More actions"
                                >
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                    <circle cx="8" cy="3" r="1.5" />
                                    <circle cx="8" cy="8" r="1.5" />
                                    <circle cx="8" cy="13" r="1.5" />
                                  </svg>
                                </button>

                                {openActionMenuUserId === user.id && (
                                  <div
                                    className={`row-action-menu${actionMenuOpensAbove ? " opens-above" : ""}`}
                                    role="menu"
                                    aria-label={`Actions for ${user.fullName}`}
                                  >
                                    {user.isSuperadmin && !actor.isSuperadmin ? (
                                      <div style={{ padding: "8px 12px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.4, display: "flex", alignItems: "flex-start", gap: "6px" }}>
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          style={{ flexShrink: 0, marginTop: "2px", color: "var(--color-accent-deep)" }}
                                          aria-hidden="true"
                                        >
                                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                        <span><strong>Executive Account:</strong> Regular Admins cannot modify, deactivate, or delete the President account.</span>
                                      </div>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => {
                                            setOpenActionMenuUserId(null);
                                            setEditingUser(user);
                                            setNewUsernameInput(user.username);
                                            setEditUsernameError(null);
                                          }}
                                        >
                                          Edit Username
                                        </button>
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => {
                                            setOpenActionMenuUserId(null);
                                            setEditingContactUser(user);
                                            setEditEmailInput(user.email);
                                            setEditPhoneInput(user.phoneNumber || "");
                                            setEditContactError(null);
                                          }}
                                        >
                                          Edit Contact Info
                                        </button>
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => {
                                            setOpenActionMenuUserId(null);
                                            setPermissionFocusUserId(user.id);
                                            handleSelectTab("permissions");
                                          }}
                                        >
                                          Configure Permissions
                                        </button>
                                        <button
                                          type="button"
                                          role="menuitem"
                                          disabled={isSelf || user.isSuperadmin}
                                          onClick={() => {
                                            setOpenActionMenuUserId(null);
                                            setAuthorizingUser(user);
                                            setAuthorizeError(null);
                                          }}
                                          title={
                                            isSelf
                                              ? "Admins cannot authorize reset for their own account"
                                              : user.isSuperadmin
                                              ? "Superadmin cannot be reset via this action"
                                              : undefined
                                          }
                                        >
                                          Authorize Password Reset
                                        </button>
                                        <button
                                          type="button"
                                          role="menuitem"
                                          disabled={isSelf || user.isSuperadmin || (user.role === "admin" && !actor.isSuperadmin)}
                                          onClick={() => {
                                            setOpenActionMenuUserId(null);
                                            handleToggleActive(user);
                                          }}
                                          title={
                                            isSelf
                                              ? "Cannot deactivate your own active Admin account"
                                              : user.isSuperadmin
                                              ? "President account cannot be deactivated"
                                              : user.role === "admin" && !actor.isSuperadmin
                                              ? "Only the President can deactivate Admin accounts"
                                              : undefined
                                          }
                                        >
                                          {user.isActive ? "Deactivate User" : "Reactivate User"}
                                        </button>
                                        <div className="row-action-menu-divider" role="separator" />
                                        {actor.isSuperadmin ? (
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="row-action-menu-danger"
                                            disabled={isSelf || user.isSuperadmin}
                                            onClick={() => {
                                              setOpenActionMenuUserId(null);
                                              setPermanentDeleteModalUser(user);
                                            }}
                                            title={
                                              isSelf
                                                ? "Cannot delete your own active President account"
                                                : user.isSuperadmin
                                                ? "President account cannot be permanently deleted"
                                                : undefined
                                            }
                                          >
                                            Permanently Delete
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="row-action-menu-danger"
                                            disabled
                                            title="Permanent deletion strictly requires President authority"
                                            style={{ opacity: 0.5, cursor: "not-allowed" }}
                                          >
                                            Permanently Delete
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              )}

              {sortedUsers.length > 0 ? (
                <TablePagination
                  page={userPage}
                  pageCount={userPageCount}
                  totalItems={sortedUsers.length}
                  pageSize={USER_PAGE_SIZE}
                  onPageChange={setUserPage}
                  itemLabel="users"
                  itemCountInPage={paginatedUsers.length}
                />
              ) : null}
            </section>
              </div>
            )}

            {activeTab === "permissions" && (
              <div id="panel-permissions" role="tabpanel" aria-labelledby="tab-permissions" className="settings-tab-panel">
                <DiscordPermissionsManager
                  initialSelectedUserId={permissionFocusUserId}
                  onUserSaved={(updated) => {
                    setUsers((curr) =>
                      curr.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
                    );
                    void loadAuditEntries(true);
                  }}
                  onPermissionsSaved={() => {
                    void loadAuditEntries(true);
                  }}
                />
              </div>
            )}

            {activeTab === "audit" && (
              <div id="panel-audit" role="tabpanel" aria-labelledby="tab-audit" className="settings-tab-panel">
                <section className="stat-grid" aria-label="Audit log totals">
              <article className="stat-card">
                <span className="stat-label">TOTAL AUDIT EVENTS</span>
                <strong>{auditStats.total}</strong>
                <span className="stat-meta">Recorded across all workspaces</span>
              </article>
              <article className="stat-card">
                <span className="stat-label">DELIVERIES &amp; FINANCIALS</span>
                <strong>{auditStats.deliveryAndFinance}</strong>
                <span className="stat-meta positive">Creations, finalizations &amp; corrections</span>
              </article>
              <article className="stat-card">
                <span className="stat-label">FLEET &amp; USER ACCESS</span>
                <strong>{auditStats.fleetAndSecurity}</strong>
                <span className="stat-meta positive">Trucks, credentials &amp; accounts</span>
              </article>
            </section>

            <section
              className={`records-card audit-log-card${auditLoading ? " is-loading" : ""}`}
              aria-label="RouteX audit log"
            >
              <div className="records-heading">
                <div>
                  <h2>Audit Trail</h2>
                  <p>Detailed event log of data changes, staff actions, and security operations.</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => void loadAuditEntries()}
                    disabled={auditLoading}
                    className="secondary-button"
                    style={{
                      padding: "5px 12px",
                      fontSize: "12px",
                      borderRadius: "8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      height: "32px",
                    }}
                    title="Reload audit records from server"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        width: "14px",
                        height: "14px",
                        animation: auditLoading ? "spin 1s linear infinite" : "none",
                      }}
                      aria-hidden="true"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Refresh
                  </button>

                  {actor.isSuperadmin && auditEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void handlePurgeAuditLog()}
                      disabled={auditLoading}
                      className="secondary-button"
                      style={{
                        padding: "5px 12px",
                        fontSize: "12px",
                        borderRadius: "8px",
                        color: "#ef4444",
                        borderColor: "rgba(239, 68, 68, 0.3)",
                        height: "32px",
                      }}
                      title="Clear all audit log history (President only)"
                    >
                      Clear Log
                    </button>
                  )}

                  <span
                    className="ledger-total-badge"
                    style={{
                      background: "transparent",
                      border: "none",
                      boxShadow: "none",
                      padding: 0,
                      fontSize: "12px",
                      color: "var(--color-text-secondary)",
                      fontWeight: 500,
                    }}
                  >
                    {filteredAuditEntries.length} of {auditEntries.length} events
                  </span>
                </div>
              </div>

              <div className="filters" aria-label="Filter audit records">
                <label className={`search-box${isAuditSearchBuffering ? " is-buffering" : ""}`}>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    type="search"
                    aria-label="Search audit trail"
                    placeholder="Search user, action, waybill, or details…"
                    value={auditSearch}
                    onChange={(event) => setAuditSearch(event.target.value)}
                  />
                  {isAuditSearchBuffering && (
                    <span className="search-buffer-indicator" title="Buffering search…" aria-label="Buffering search…" />
                  )}
                  {auditSearch ? (
                    <button
                      type="button"
                      className="search-clear-btn"
                      aria-label="Clear search query"
                      title="Clear search"
                      onClick={() => clearAuditSearch()}
                    >
                      ×
                    </button>
                  ) : null}
                </label>

                <RoundedSelect
                  value={actionFilter}
                  options={AUDIT_ACTION_FILTER_OPTIONS}
                  onChange={setActionFilter}
                  ariaLabel="Filter by action"
                />

                <RoundedSelect
                  value={entityFilter}
                  options={AUDIT_ENTITY_FILTER_OPTIONS}
                  onChange={setEntityFilter}
                  ariaLabel="Filter by entity"
                />

                {(auditSearch.trim() || actionFilter !== "all" || entityFilter !== "all") ? (
                  <button
                    type="button"
                    className="secondary-button filter-clear-action-btn"
                    onClick={() => {
                      setAuditSearch("");
                      setActionFilter("all");
                      setEntityFilter("all");
                    }}
                  >
                    Clear Filters
                  </button>
                ) : null}
              </div>

              {auditError ? (
                <div className="empty-state" role="alert">
                  <strong>Audit log unavailable</strong>
                  <span>{auditError}</span>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: "150px" }}>Date &amp; Time</th>
                        <th style={{ width: "180px" }}>User</th>
                        <th style={{ width: "170px" }}>Action</th>
                        <th style={{ width: "140px" }}>Entity</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(auditLoading || isAuditSearchBuffering) ? (
                        <tr>
                          <td colSpan={5} className="table-loading-cell">
                            <SimpleLoading message={isAuditSearchBuffering ? "Searching audit records…" : "Loading audit records…"} />
                          </td>
                        </tr>
                      ) : filteredAuditEntries.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="table-empty-cell">
                            <div className="empty-state minimal">
                              <strong className="empty-state-title">No audit log events found</strong>
                              <span className="empty-state-desc">
                                {auditSearch || actionFilter !== "all" || entityFilter !== "all"
                                  ? "No audit events match your search query or active action/entity filters."
                                  : "No system events or configuration changes recorded yet."}
                              </span>
                              {(auditSearch || actionFilter !== "all" || entityFilter !== "all") ? (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  style={{ marginTop: "8px", fontSize: "11px", padding: "4px 10px" }}
                                  onClick={() => {
                                    setAuditSearch("");
                                    setActionFilter("all");
                                    setEntityFilter("all");
                                  }}
                                >
                                  Reset Filters
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedAuditEntries.map((entry) => {
                          const visuals = getActionVisuals(entry.action);
                          const actorUsername = formatAuditActor(entry.actorEmail);
                          const entityLabel = formatAuditEntityLabel(entry.entityType);

                          return (
                            <tr
                              key={entry.id}
                              className="record-row audit-record-row"
                              onClick={() => setSelectedAuditEntry(entry)}
                              tabIndex={0}
                              role="button"
                              aria-label={`View audit event: ${visuals.badgeLabel} by ${actorUsername}`}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedAuditEntry(entry);
                                }
                              }}
                            >
                              <td>
                                <div className="audit-timestamp">
                                  <strong>
                                    {new Date(entry.occurredAt).toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </strong>
                                  <small>
                                    {new Date(entry.occurredAt).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </small>
                                </div>
                              </td>
                              <td>
                                <div className="audit-user-cell">
                                  <strong className="audit-username">{actorUsername}</strong>
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`audit-action-indicator ${visuals.className}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    background: "transparent",
                                    border: "none",
                                    borderRadius: 0,
                                    boxShadow: "none",
                                    padding: 0,
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    lineHeight: 1.4,
                                    textTransform: "none",
                                    letterSpacing: "normal",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <i
                                    aria-hidden="true"
                                    style={{
                                      display: "inline-block",
                                      width: "6px",
                                      height: "6px",
                                      borderRadius: "50%",
                                      flexShrink: 0,
                                      background: "currentColor",
                                    }}
                                  />
                                  {visuals.badgeLabel}
                                </span>
                              </td>
                              <td>
                                <div className="audit-entity-cell">
                                  <span className="audit-entity-type">{entityLabel}</span>
                                  <span className="audit-entity-id">
                                    {entry.entityId}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <div className="audit-simple-detail-cell">
                                  <span className="audit-simple-summary">
                                    {entry.summary}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredAuditEntries.length > 0 ? (
                <TablePagination
                  page={auditPage}
                  pageCount={auditPageCount}
                  totalItems={filteredAuditEntries.length}
                  pageSize={AUDIT_PAGE_SIZE}
                  onPageChange={setAuditPage}
                  itemLabel="events"
                  itemCountInPage={paginatedAuditEntries.length}
                />
              ) : null}
            </section>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Event Details Popup Modal */}
      {selectedAuditEntry && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="audit-detail-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div
                className="routex-dialog-backdrop"
                onClick={() => setSelectedAuditEntry(null)}
              />
              <div
                className="routex-dialog records-card"
                style={{
                  width: "min(100%, 640px)",
                  maxWidth: "640px",
                  maxHeight: "85vh",
                  display: "flex",
                  flexDirection: "column",
                  background: "var(--color-surface)",
                  boxShadow: "0 24px 64px rgba(15, 23, 21, 0.35)",
                  borderRadius: "16px",
                  overflow: "hidden",
                  padding: 0,
                }}
              >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "20px 24px 16px",
                borderBottom: "1px solid var(--line)",
                background: "var(--color-surface)",
              }}
            >
              <div>
                <h2 id="audit-detail-dialog-title" style={{ margin: 0, fontSize: "17px", letterSpacing: "-0.3px" }}>
                  Audit Event Details
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--color-text-muted)" }}>
                  {new Date(selectedAuditEntry.occurredAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  •{" "}
                  {new Date(selectedAuditEntry.occurredAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditEntry(null)}
                aria-label="Close dialog"
                title="Close (Esc)"
                style={{
                  border: 0,
                  background: "transparent",
                  fontSize: "22px",
                  lineHeight: 1,
                  cursor: "pointer",
                  color: "var(--color-text-muted)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: "20px 24px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {/* Event Metadata Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "10px",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "var(--color-surface-subtle, rgba(0, 0, 0, 0.02))",
                  border: "1px solid var(--line)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "var(--color-text-muted)",
                      letterSpacing: "0.05em",
                      marginBottom: "4px",
                    }}
                  >
                    Action
                  </div>
                  <span
                    className={`audit-action-indicator ${getActionVisuals(selectedAuditEntry.action).className}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "transparent",
                      border: "none",
                      borderRadius: 0,
                      boxShadow: "none",
                      padding: 0,
                      fontSize: "12px",
                      fontWeight: 500,
                      lineHeight: 1.4,
                      textTransform: "none",
                      letterSpacing: "normal",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <i
                      aria-hidden="true"
                      style={{
                        display: "inline-block",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: "currentColor",
                      }}
                    />
                    {getActionVisuals(selectedAuditEntry.action).badgeLabel}
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "var(--color-text-muted)",
                      letterSpacing: "0.05em",
                      marginBottom: "4px",
                    }}
                  >
                    User / Actor
                  </div>
                  <strong style={{ fontSize: "12px", color: "var(--color-text-primary)", wordBreak: "break-all" }}>
                    {formatAuditActor(selectedAuditEntry.actorEmail)}
                  </strong>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "var(--color-text-muted)",
                      letterSpacing: "0.05em",
                      marginBottom: "4px",
                    }}
                  >
                    Target Entity
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-primary)" }}>
                    <span style={{ fontWeight: 600 }}>{formatAuditEntityLabel(selectedAuditEntry.entityType)}</span>
                    <span style={{ color: "var(--color-text-muted)", margin: "0 4px" }}>:</span>
                    <code style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                      {selectedAuditEntry.entityId}
                    </code>
                  </div>
                </div>
              </div>

              {/* Event Summary */}
              <div>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--color-text-muted)",
                    letterSpacing: "0.05em",
                    marginBottom: "6px",
                  }}
                >
                  Summary
                </div>
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "var(--color-page, #f8fafc)",
                    border: "1px solid var(--line)",
                    fontSize: "12.5px",
                    lineHeight: 1.5,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {selectedAuditEntry.summary}
                </div>
              </div>

              {/* State Changes & Transitions */}
              <div>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--color-text-muted)",
                    letterSpacing: "0.05em",
                    marginBottom: "6px",
                  }}
                >
                  Detailed State Changes &amp; Data
                </div>
                <AuditStateChanges changes={selectedAuditEntry.changes} />
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "12px 24px",
                borderTop: "1px solid var(--line)",
                background: "var(--color-surface)",
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedAuditEntry(null)}
                style={{ minHeight: "36px", minWidth: "90px", fontSize: "12px" }}
              >
                Close
              </button>
            </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Authorize Reset Modal */}
      {authorizingUser && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="authorize-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div
                className="routex-dialog-backdrop"
                onClick={() => !isAuthorizing && setAuthorizingUser(null)}
              />
              <div
                className="routex-dialog records-card"
                style={{
                  width: "min(100%, 500px)",
                  maxWidth: "500px",
                  padding: "26px",
                  background: "var(--color-surface)",
                  boxShadow: "0 24px 64px rgba(15, 23, 21, 0.3)",
                  borderRadius: "16px",
                }}
              >
            <h2 id="authorize-dialog-title" style={{ margin: "0 0 10px", fontSize: "18px" }}>
              Authorize Password Reset
            </h2>
            <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: "0 0 16px" }}>
              Authorizing reset for <strong>{authorizingUser.fullName}</strong> (@{authorizingUser.username}).
            </p>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(217, 119, 6, 0.08)",
                border: "1px solid rgba(217, 119, 6, 0.25)",
                fontSize: "11px",
                lineHeight: 1.5,
                color: "var(--color-text-primary)",
                marginBottom: "16px",
              }}
            >
              Opens a single-use 24-hour password reset window for @{authorizingUser.username}. Action is audited.
            </div>

            {authorizeError ? (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#dc2626",
                  fontSize: "12px",
                  marginBottom: "16px",
                }}
              >
                {authorizeError}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setAuthorizingUser(null)}
                disabled={isAuthorizing}
                style={{ minHeight: "38px", padding: "0 16px", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-action-button"
                onClick={handleConfirmAuthorizeReset}
                disabled={isAuthorizing}
                style={{ minHeight: "38px", padding: "0 18px", fontSize: "12px" }}
              >
                {isAuthorizing ? "Authorizing…" : "Confirm Authorization"}
              </button>
            </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Admin Edit Username Modal */}
      {editingUser && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-username-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div
                className="routex-dialog-backdrop"
                onClick={() => !isUpdatingUsername && setEditingUser(null)}
              />
              <form
                onSubmit={handleConfirmUpdateUsername}
                className="routex-dialog records-card"
                style={{
                  width: "min(100%, 460px)",
                  maxWidth: "460px",
                  padding: "26px",
                  background: "var(--color-surface)",
                  boxShadow: "0 24px 64px rgba(15, 23, 21, 0.3)",
                  borderRadius: "16px",
                }}
              >
            <h2 id="edit-username-dialog-title" style={{ margin: "0 0 8px", fontSize: "18px" }}>
              Edit Username
            </h2>
            <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: "0 0 16px" }}>
              Update login handle for <strong>{editingUser.fullName}</strong>.
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                Current Username
                <input
                  className="user-management-input"
                  type="text"
                  disabled
                  value={`@${editingUser.username}`}
                  style={{
                    fontWeight: 600,
                  }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                New Username
                <input
                  className="user-management-input"
                  type="text"
                  value={newUsernameInput}
                  onChange={(e) => setNewUsernameInput(e.target.value.toLowerCase())}
                  placeholder="e.g. cmendoza_ops"
                  required
                />
                <small style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                  3-30 letters, numbers, hyphens, dots, underscores. Internal ID, role, and historical deliveries remain preserved.
                </small>
              </label>
            </div>

            {editUsernameError ? (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#dc2626",
                  fontSize: "12px",
                  marginBottom: "16px",
                }}
              >
                {editUsernameError}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditingUser(null)}
                disabled={isUpdatingUsername}
                style={{ minHeight: "38px", padding: "0 16px", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-action-button"
                disabled={isUpdatingUsername}
                style={{ minHeight: "38px", padding: "0 18px", fontSize: "12px" }}
              >
                {isUpdatingUsername ? "Updating…" : "Save Username"}
              </button>
            </div>
              </form>
            </div>,
            document.body,
          )
        : null}

      {/* Edit Contact Info Modal */}
      {editingContactUser && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-contact-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div
                className="routex-dialog-backdrop"
                onClick={() => !isUpdatingContact && setEditingContactUser(null)}
              />
              <form
                onSubmit={handleConfirmUpdateContact}
                className="routex-dialog records-card"
                style={{
                  width: "min(100%, 460px)",
                  maxWidth: "460px",
                  padding: "26px",
                  background: "var(--color-surface)",
                  boxShadow: "0 24px 64px rgba(15, 23, 21, 0.3)",
                  borderRadius: "16px",
                }}
              >
            <h2 id="edit-contact-dialog-title" style={{ margin: "0 0 8px", fontSize: "18px" }}>
              Edit Contact Details
            </h2>
            <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: "0 0 16px" }}>
              Update contact info for <strong>{editingContactUser.fullName}</strong> (@{editingContactUser.username}).
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                Email Address
                <input
                  className="user-management-input"
                  type="email"
                  value={editEmailInput}
                  onChange={(e) => setEditEmailInput(e.target.value)}
                  placeholder="e.g. user@routex.local"
                  required
                />
              </label>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                Phone Number
                <input
                  className="user-management-input"
                  type="tel"
                  value={editPhoneInput}
                  onChange={(e) => setEditPhoneInput(e.target.value)}
                  placeholder="e.g. 09171234567"
                  required
                />
                <small style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                  Primary mobile or office contact number for account recovery and operational alerts.
                </small>
              </label>
            </div>

            {editContactError ? (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#dc2626",
                  fontSize: "12px",
                  marginBottom: "16px",
                }}
              >
                {editContactError}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditingContactUser(null)}
                disabled={isUpdatingContact}
                style={{ minHeight: "38px", padding: "0 16px", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-action-button"
                disabled={isUpdatingContact}
                style={{ minHeight: "38px", padding: "0 18px", fontSize: "12px" }}
              >
                {isUpdatingContact ? "Updating…" : "Save Contact Info"}
              </button>
            </div>
              </form>
            </div>,
            document.body,
          )
        : null}

      {/* Delete User Confirmation Screen */}
      {userToDelete && typeof document !== "undefined"
        ? createPortal(
            <div className="routex-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="delete-user-dialog-title" style={{ zIndex: 1000 }}>
              <div className="routex-dialog-backdrop" onClick={() => !isDeletingUser && setUserToDelete(null)} />
              <div className="routex-dialog" style={{ maxWidth: "460px" }}>
                <header className="routex-dialog-header" style={{ flexShrink: 0 }}>
                  <div>
                    <h2 id="delete-user-dialog-title" style={{ fontSize: "17px", color: "var(--color-danger, #dc2626)" }}>
                      Delete User
                    </h2>
                    <p style={{ margin: "2px 0 0", fontSize: "11px" }}>
                      Action is audited and logged.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="routex-dialog-close"
                    aria-label="Close confirmation dialog"
                    title="Close confirmation dialog (Esc)"
                    disabled={isDeletingUser}
                    onClick={() => setUserToDelete(null)}
                  >
                    ×
                  </button>
                </header>

                <div className="routex-dialog-body" style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--color-text-primary)" }}>
                    Are you sure you want to delete the user account for <strong>{userToDelete.fullName}</strong> (<code>@{userToDelete.username}</code>)?
                  </p>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      background: "var(--color-surface-subtle)",
                      border: "1px solid var(--color-border)",
                      fontSize: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Assigned Role: </span>
                      <strong>{userToDelete.roleLabel}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Email: </span>
                      <span>{userToDelete.email}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Account Status: </span>
                      <span>{userToDelete.isActive ? "Active" : "Deactivated"}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      color: "#dc2626",
                      fontSize: "11px",
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>Warning:</strong> Deleting this account will permanently remove their login access.
                  </div>
                </div>

                <footer className="routex-dialog-footer" style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isDeletingUser}
                    onClick={() => setUserToDelete(null)}
                    style={{ minHeight: "38px", padding: "0 16px", fontSize: "13px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="danger-confirm-button"
                    disabled={isDeletingUser}
                    onClick={handleConfirmDeleteUser}
                  >
                    {isDeletingUser ? "Deleting Account…" : "Confirm Delete"}
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Temporary Password Popup Modal */}
      {tempPasswordPopup && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="temp-password-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div
                className="routex-dialog-backdrop"
                onClick={() => setTempPasswordPopup(null)}
              />
              <div
                className="routex-dialog"
                style={{
                  maxWidth: "480px",
                  borderRadius: "16px",
                  overflow: "hidden",
                  boxShadow: "0 24px 64px rgba(15, 23, 21, 0.32)",
                }}
              >
                <header
                  className="routex-dialog-header"
                  style={{
                    padding: "18px 22px",
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: tempPasswordPopup.isNewlyProvisioned
                          ? "rgba(16, 185, 129, 0.12)"
                          : "rgba(245, 158, 11, 0.12)",
                        color: tempPasswordPopup.isNewlyProvisioned
                          ? "var(--color-primary, #059669)"
                          : "var(--color-accent, #b45309)",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <div>
                      <h2
                        id="temp-password-dialog-title"
                        style={{
                          margin: 0,
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {tempPasswordPopup.isNewlyProvisioned
                          ? "Account Provisioned"
                          : "Temporary Password"}
                      </h2>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: "11.5px",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {tempPasswordPopup.isNewlyProvisioned
                          ? "User onboarding credentials ready to share."
                          : "Randomly generated temporary access credential."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="routex-dialog-close"
                    aria-label="Close dialog"
                    onClick={() => setTempPasswordPopup(null)}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: "20px",
                      cursor: "pointer",
                      color: "var(--color-text-muted)",
                      padding: "4px",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </header>

                <div
                  className="routex-dialog-body"
                  style={{
                    padding: "20px 22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {/* Account Summary */}
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "var(--color-surface-subtle)",
                      border: "1px solid var(--color-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--color-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          fontWeight: 600,
                        }}
                      >
                        Target Account
                      </span>
                      <strong style={{ fontSize: "13.5px", color: "var(--color-text-primary)" }}>
                        {tempPasswordPopup.fullName}
                      </strong>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--color-text-secondary)",
                          fontFamily: "monospace",
                        }}
                      >
                        @{tempPasswordPopup.username}
                      </span>
                    </div>
                    {tempPasswordPopup.roleLabel ? (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "var(--color-surface)",
                          border: "1px solid var(--line)",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {tempPasswordPopup.roleLabel}
                      </span>
                    ) : null}
                  </div>

                  {/* Password Card */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      padding: "16px",
                      borderRadius: "12px",
                      background: "var(--color-surface-subtle)",
                      border: "1.5px dashed var(--color-accent, #b45309)",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontWeight: 700,
                        color: "var(--color-accent-deep)",
                      }}
                    >
                      One-Time Temporary Password
                    </span>
                    <div
                      style={{
                        padding: "10px 16px",
                        borderRadius: "8px",
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: "18px",
                        fontWeight: 750,
                        letterSpacing: "0.12em",
                        color: "var(--color-accent-deep)",
                        userSelect: "all",
                        wordBreak: "break-all",
                      }}
                    >
                      {tempPasswordPopup.password}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "8px",
                        marginTop: "4px",
                      }}
                    >
                      <button
                        type="button"
                        className={tempPasswordCopied ? "primary-button" : "secondary-button"}
                        style={{
                          fontSize: "12px",
                          fontWeight: 650,
                          padding: "7px 16px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                        onClick={() => {
                          void navigator.clipboard.writeText(tempPasswordPopup.password);
                          setTempPasswordCopied(true);
                          toast.success("Password copied to clipboard!");
                          setTimeout(() => setTempPasswordCopied(false), 2500);
                        }}
                      >
                        {tempPasswordCopied ? (
                          <>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                            Copy Password
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "rgba(245, 158, 11, 0.08)",
                      border: "1px solid rgba(245, 158, 11, 0.25)",
                      fontSize: "11.5px",
                      lineHeight: 1.45,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ flexShrink: 0, marginTop: "2px", color: "var(--color-accent)" }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>
                      The user will be required to change this temporary password upon first
                      signing in. Provide this password via a secure communication channel.
                    </span>
                  </div>
                </div>

                <footer
                  className="routex-dialog-footer"
                  style={{
                    padding: "14px 22px",
                    borderTop: "1px solid var(--color-border)",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    className="primary-button"
                    style={{ minHeight: "36px", padding: "0 20px", fontSize: "12.5px" }}
                    onClick={() => setTempPasswordPopup(null)}
                  >
                    Done
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}

      {permanentDeleteModalUser && (
        <PermanentDeleteUserModal
          user={permanentDeleteModalUser}
          onClose={() => setPermanentDeleteModalUser(null)}
          onSuccess={(deletedId, msg) => {
            setUsers((curr) => curr.filter((u) => u.id !== deletedId));
            toast.success(msg);
            void loadAuditEntries(true);
          }}
        />
      )}
    </>
  );
}
