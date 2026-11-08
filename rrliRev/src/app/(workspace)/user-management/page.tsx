"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { OperationalTopbar } from "@/components/operational-topbar";
import { PasswordCriteriaList } from "@/components/password-criteria-list";
import { RoundedSelect } from "@/components/rounded-select";
import { TablePagination } from "@/components/table-pagination";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import { AuditStateChanges } from "@/components/audit-state-changes";
import { getActionVisuals } from "@/features/audit/audit-formatters";
import {
  evaluatePasswordCriteria,
  validateUsernameFormat,
} from "@/lib/auth/password-policy";
import {
  ROLE_METADATA,
  USER_ROLES,
  type AccessLevel,
  type UserRole,
} from "@/lib/auth/rbac";

type ManagedUserRecord = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  roleLabel: string;
  accessLevel: AccessLevel;
  accessLevelLabel: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  hasSecurityQuestion?: boolean;
  recoveryAuthorizedAt?: string | null;
  recoveryExpiresAt?: string | null;
  createdAt: string;
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

const ROLE_OPTIONS = USER_ROLES.map((role) => ({
  value: role,
  label: ROLE_METADATA[role].label,
}));

export default function UserManagementPage() {
  const actor = useAuthenticatedActor();
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [confirmTemporaryPassword, setConfirmTemporaryPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("operations");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");

  // Admin-assisted recovery dialog state
  const [authorizingUser, setAuthorizingUser] = useState<ManagedUserRecord | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authorizeError, setAuthorizeError] = useState<string | null>(null);

  // Edit username dialog state
  const [editingUser, setEditingUser] = useState<ManagedUserRecord | null>(null);
  const [newUsernameInput, setNewUsernameInput] = useState("");
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [editUsernameError, setEditUsernameError] = useState<string | null>(null);

  // Delete user confirmation dialog state
  const [userToDelete, setUserToDelete] = useState<ManagedUserRecord | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All Actions");
  const [entityFilter, setEntityFilter] = useState("All Entities");
  const [userSort, setUserSort] = useState<{ key: string; direction: TableSortDirection }>({
    key: "name",
    direction: "asc",
  });
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [openActionMenuUserId, setOpenActionMenuUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!openActionMenuUserId) return;
    function handleGlobalClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".table-row-actions")) {
        setOpenActionMenuUserId(null);
      }
    }
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenActionMenuUserId(null);
      }
    }
    document.addEventListener("mousedown", handleGlobalClick);
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [openActionMenuUserId]);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data: { ok?: boolean; users?: ManagedUserRecord[] }) => {
        if (data?.ok && Array.isArray(data.users)) {
          setUsers(data.users);
        }
      })
      .catch(() => {
        // Ignore fetch error
      });
  }, []);

  async function loadAuditEntries(silent = false) {
    if (!silent) setAuditLoading(true);
    setAuditError(null);
    try {
      const response = await fetch("/api/audit");
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

  const filteredAuditEntries = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditEntries.filter((entry) => {
      if (actionFilter !== "All Actions") {
        if (!entry.action.toLowerCase().includes(actionFilter.toLowerCase().replace(/\s+/g, "_"))) {
          return false;
        }
      }
      if (entityFilter !== "All Entities") {
        if (entry.entityType.toLowerCase() !== entityFilter.toLowerCase().replace(/\s+/g, "_")) {
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
      ].some((val) => val.toLowerCase().includes(q));
    });
  }, [auditEntries, auditSearch, actionFilter, entityFilter]);

  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PAGE_SIZE = 10;
  const auditPageCount = Math.max(1, Math.ceil(filteredAuditEntries.length / AUDIT_PAGE_SIZE));

  useEffect(() => {
    setAuditPage(1);
  }, [auditSearch, actionFilter, entityFilter]);

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

  function actionBadgeClass(action: string) {
    if (action.includes("created") || action.includes("bootstrap")) return "attached";
    if (action.includes("finalized")) return "attached";
    if (action.includes("corrected") || action.includes("changed") || action.includes("status")) return "missing";
    if (action.includes("uploaded")) return "attached";
    return "attached";
    return getActionVisuals(action).className;
  }

  const sortedUsers = useMemo(() => {
    const multiplier = userSort.direction === "asc" ? 1 : -1;
    return [...users].sort((left, right) => {
      const values: Record<string, [string | number, string | number]> = {
        name: [left.fullName, right.fullName],
        username: [left.username ?? "", right.username ?? ""],
        email: [left.email, right.email],
        access: [left.accessLevelLabel, right.accessLevelLabel],
        role: [left.roleLabel, right.roleLabel],
        status: [Number(left.isActive), Number(right.isActive)],
      };
      const [leftValue, rightValue] = values[userSort.key] ?? values.name;
      const compared = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
      return compared * multiplier || left.id.localeCompare(right.id);
    });
  }, [userSort, users]);

  const [userPage, setUserPage] = useState(1);
  const USER_PAGE_SIZE = 10;
  const userPageCount = Math.max(1, Math.ceil(sortedUsers.length / USER_PAGE_SIZE));

  useEffect(() => {
    setUserPage(1);
  }, [userSort]);

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

    const passwordValidation = evaluatePasswordCriteria(temporaryPassword);
    if (!passwordValidation.isValid) {
      setFeedback({
        tone: "error",
        text: passwordValidation.errors[0] ?? "Temporary password does not meet security criteria.",
      });
      setIsCreating(false);
      return;
    }

    if (temporaryPassword !== confirmTemporaryPassword) {
      setFeedback({
        tone: "error",
        text: "Temporary password confirmation does not match.",
      });
      setIsCreating(false);
      return;
    }

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: cleanUsername,
          temporaryPassword,
          confirmTemporaryPassword,
          email: email.trim() || undefined,
          role: newRole,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        user?: ManagedUserRecord;
        message?: string;
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
      setTemporaryPassword("");
      setConfirmTemporaryPassword("");
      setFeedback({
        tone: "success",
        text: `Provisioned @${payload.user.username} (${payload.user.fullName}) with role ${payload.user.roleLabel}. The user will be required to change their temporary password upon first login.`,
      });
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
        text: `Updated ${payload.user.fullName}'s role to ${payload.user.roleLabel} (${payload.user.accessLevelLabel}).`,
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
      <OperationalTopbar contextLabel="Admin User Account & Role Management" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <h1>User Management</h1>
            <p className="subtitle">
              Manage staff accounts, credentials, and access permissions.
            </p>
          </div>
          <span className="access-pill admin">Admin Only ({actor.fullName})</span>
        </header>

        <div className="user-management-tabs" role="tablist" aria-label="User management sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "users"}
            className={activeTab === "users" ? "active" : ""}
            onClick={() => setActiveTab("users")}
          >
            Staff Accounts
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "audit"}
            className={activeTab === "audit" ? "active" : ""}
            onClick={() => setActiveTab("audit")}
          >
            Audit Log
          </button>
        </div>

        {activeTab === "users" ? (
          <>
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
                  onClick={() => setFeedback(null)}
                >
                  ×
                </button>
              </section>
            ) : null}

            {/* Provision Account Form */}
            <section
              className="records-card"
              style={{ marginTop: "22px", marginBottom: "22px" }}
              aria-label="Provision new staff account"
            >
              <div className="records-heading">
                <div>
                  <h2>Provision Staff Account</h2>
                  <p>
                    Create a RouteX account with a temporary password. Users will be required to change
                    their password and configure security recovery upon their first login.
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleCreateUser}
                style={{
                  display: "grid",
                  gap: "16px",
                  padding: "0 23px 22px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                    alignItems: "start",
                  }}
                >
                  <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                    Full Name
                    <input
                      type="text"
                      placeholder="e.g. Carlo Mendoza"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      style={{
                        minHeight: "42px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border)",
                        background: "var(--glass-surface-strong)",
                      }}
                      required
                    />
                  </label>

                  <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                    Username
                    <input
                      type="text"
                      placeholder="e.g. cmendoza"
                      value={username}
                      onChange={(event) => setUsername(event.target.value.toLowerCase())}
                      style={{
                        minHeight: "42px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border)",
                        background: "var(--glass-surface-strong)",
                      }}
                      required
                    />
                    <small style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                      3-30 letters, numbers, hyphens, dots, underscores (case-insensitive)
                    </small>
                  </label>

                  <div style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                    <span>Assigned Role</span>
                    <RoundedSelect
                      value={newRole}
                      options={ROLE_OPTIONS}
                      onChange={(val) => setNewRole(val as UserRole)}
                      ariaLabel="Select role for new user"
                    />
                  </div>

                  <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                    Email Address (Optional)
                    <input
                      type="email"
                      placeholder="Defaults to @username@routex.local"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      style={{
                        minHeight: "42px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border)",
                        background: "var(--glass-surface-strong)",
                      }}
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                    alignItems: "start",
                  }}
                >
                  <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                    Temporary Password
                    <input
                      type="password"
                      placeholder="Enter temporary password"
                      value={temporaryPassword}
                      onChange={(event) => setTemporaryPassword(event.target.value)}
                      style={{
                        minHeight: "42px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border)",
                        background: "var(--glass-surface-strong)",
                      }}
                      required
                    />
                  </label>

                  <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                    Confirm Temporary Password
                    <input
                      type="password"
                      placeholder="Re-enter temporary password"
                      value={confirmTemporaryPassword}
                      onChange={(event) => setConfirmTemporaryPassword(event.target.value)}
                      style={{
                        minHeight: "42px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border)",
                        background: "var(--glass-surface-strong)",
                      }}
                      required
                    />
                  </label>
                </div>

                {temporaryPassword ? (
                  <div style={{ maxWidth: "480px" }}>
                    <PasswordCriteriaList password={temporaryPassword} />
                  </div>
                ) : null}

                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "rgba(217, 119, 6, 0.08)",
                    border: "1px solid rgba(217, 119, 6, 0.2)",
                    fontSize: "11px",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Admin Privacy &amp; Security Policy:</strong> Provide this temporary password
                  to the user via an authorized secure channel. Once saved, RouteX securely hashes it with
                  Argon2id. The system never displays passwords again, and Admins can never view or choose
                  users&apos; permanent passwords.
                </div>

                <div>
                  <button
                    type="submit"
                    className="primary-action-button"
                    disabled={isCreating}
                    style={{ minHeight: "42px", minWidth: "160px" }}
                  >
                    {isCreating ? "Provisioning…" : "+ Provision Account"}
                  </button>
                </div>
              </form>
            </section>

            {/* Registered Users Table */}
            <section className="records-card" aria-label="Registered RouteX users">
              <div className="records-heading">
                <div>
                  <h2>Authorized Personnel &amp; Role Assignments</h2>
                  <p>
                    Manage staff usernames, access levels, setup statuses, and authorize password recovery.
                  </p>
                </div>
              </div>

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
                        label="Assigned Role"
                        sortKey="role"
                        activeSortKey={userSort.key}
                        direction={userSort.direction}
                        onSort={(key, direction) => setUserSort({ key, direction })}
                      />
                      <SortableTableHeader
                        label="Access Level"
                        sortKey="access"
                        activeSortKey={userSort.key}
                        direction={userSort.direction}
                        onSort={(key, direction) => setUserSort({ key, direction })}
                      />
                      <th>Setup &amp; Recovery Status</th>
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
                    {paginatedUsers.map((user) => {
                      const isRecoveryActive = Boolean(
                        user.recoveryExpiresAt && new Date(user.recoveryExpiresAt) > new Date(),
                      );
                      const isSelf = user.id === actor.id;

                      return (
                        <tr
                          key={user.id}
                          style={{
                            position: "relative",
                            zIndex: openActionMenuUserId === user.id ? 25 : undefined,
                          }}
                        >
                          <td>
                            <strong>{user.fullName}</strong>
                            <br />
                            <small style={{ color: "var(--color-text-muted)", fontSize: "11px" }}>
                              {user.email}
                            </small>
                          </td>
                          <td>
                            <span
                              style={{
                                fontFamily: "monospace",
                                fontWeight: 600,
                                color: "var(--color-text-primary)",
                              }}
                            >
                              @{user.username}
                            </span>
                          </td>
                          <td>
                            <RoundedSelect
                              value={user.role}
                              options={ROLE_OPTIONS}
                              onChange={(nextRole) =>
                                handleRoleChange(user.id, nextRole as UserRole)
                              }
                              ariaLabel={`Change role for ${user.fullName}`}
                            />
                          </td>
                          <td>
                            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
                              {user.accessLevelLabel}
                            </span>
                          </td>
                          <td>
                            {isRecoveryActive ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  fontSize: "12px",
                                  color: "#b45309",
                                  fontWeight: 500,
                                }}
                                title={`Reset authorized until ${new Date(user.recoveryExpiresAt!).toLocaleTimeString()}`}
                              >
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: "#d97706",
                                    flexShrink: 0,
                                  }}
                                />
                                Reset Authorized (24h)
                              </span>
                            ) : user.mustChangePassword ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  fontSize: "12px",
                                  color: "#2563eb",
                                  fontWeight: 500,
                                }}
                              >
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: "#3b82f6",
                                    flexShrink: 0,
                                  }}
                                />
                                Initial Setup Pending
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  fontSize: "12px",
                                  color: "#059669",
                                  fontWeight: 500,
                                }}
                              >
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: "#10b981",
                                    flexShrink: 0,
                                  }}
                                />
                                Setup Complete
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "12px",
                                color: user.isActive ? "#059669" : "var(--color-text-muted)",
                                fontWeight: 500,
                              }}
                            >
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: user.isActive ? "#10b981" : "#9ca3af",
                                  flexShrink: 0,
                                }}
                              />
                              {user.isActive ? "Active" : "Deactivated"}
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
                                  setOpenActionMenuUserId((curr) => (curr === user.id ? null : user.id));
                                }}
                                title="Show more actions"
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                  <circle cx="8" cy="3" r="1.5" />
                                  <circle cx="8" cy="8" r="1.5" />
                                  <circle cx="8" cy="13" r="1.5" />
                                </svg>
                              </button>

                              {openActionMenuUserId === user.id && (
                                <div
                                  className="row-action-menu"
                                  role="menu"
                                  aria-label={`Actions for ${user.fullName}`}
                                >
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
                                    disabled={isSelf}
                                    onClick={() => {
                                      setOpenActionMenuUserId(null);
                                      setAuthorizingUser(user);
                                      setAuthorizeError(null);
                                    }}
                                    title={
                                      isSelf
                                        ? "Admins cannot authorize reset for their own account"
                                        : undefined
                                    }
                                  >
                                    Authorize Password Reset
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={isSelf}
                                    onClick={() => {
                                      setOpenActionMenuUserId(null);
                                      handleToggleActive(user);
                                    }}
                                    title={
                                      isSelf
                                        ? "Cannot deactivate your own active Admin account"
                                        : undefined
                                    }
                                  >
                                    {user.isActive ? "Deactivate User" : "Reactivate User"}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={isSelf}
                                    style={{ color: isSelf ? undefined : "var(--color-danger, #dc2626)" }}
                                    onClick={() => {
                                      setOpenActionMenuUserId(null);
                                      setUserToDelete(user);
                                    }}
                                    title={
                                      isSelf
                                        ? "Cannot delete your own active Admin account"
                                        : undefined
                                    }
                                  >
                                    Delete User
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

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
          </>
        ) : (
          <>
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
              <div className="records-heading" style={{ flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h2>Operational &amp; System Event Trail</h2>
                  <p>
                    Review administrative actions, timestamped deliveries, financial changes, and account
                    activity.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <input
                    className="audit-log-search"
                    type="search"
                    value={auditSearch}
                    onChange={(event) => setAuditSearch(event.target.value)}
                    placeholder="Search user, action, waybill, or details…"
                    style={{
                      minHeight: "40px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--color-border)",
                      background: "var(--glass-surface-strong)",
                      minWidth: "240px",
                      fontSize: "12px",
                    }}
                  />
                  <RoundedSelect
                    value={actionFilter}
                    options={[
                      "All Actions",
                      "delivery.created",
                      "delivery.financials_finalized",
                      "delivery.financials_corrected",
                      "delivery.batch_imported",
                      "document.uploaded",
                      "truck.created",
                      "user.created",
                      "user.status_changed",
                      "user.role_changed",
                      "user.username_changed",
                      "user.username_changed_by_admin",
                      "user.password_changed",
                      "user.password_recovered",
                      "user.recovery_authorized",
                    ]}
                    onChange={setActionFilter}
                    ariaLabel="Filter by action"
                  />
                  <RoundedSelect
                    value={entityFilter}
                    options={[
                      "All Entities",
                      "delivery",
                      "truck",
                      "user",
                      "import_batch",
                      "system",
                    ]}
                    onChange={setEntityFilter}
                    ariaLabel="Filter by entity"
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void loadAuditEntries()}
                    title="Refresh audit log"
                    style={{ minHeight: "40px", fontSize: "12px" }}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {auditError ? (
                <div className="empty-state" role="alert">
                  <strong>Audit log unavailable</strong>
                  <span>{auditError}</span>
                </div>
              ) : auditLoading && auditEntries.length === 0 ? (
                <div className="empty-state" role="status">
                  <strong>Loading audit records…</strong>
                  <span>Retrieving event activity and historical changes.</span>
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
                        <th>Details &amp; State Changes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAuditEntries.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              textAlign: "center",
                              padding: "36px",
                              color: "var(--color-text-muted)",
                            }}
                          >
                            <div style={{ display: "grid", gap: "6px", placeItems: "center" }}>
                              <strong>No audit events match your search criteria.</strong>
                              <span>Try modifying your search query or reset action and entity filters.</span>
                              {(auditSearch || actionFilter !== "All Actions" || entityFilter !== "All Entities") ? (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  style={{ marginTop: "8px", fontSize: "11px", padding: "4px 10px" }}
                                  onClick={() => {
                                    setAuditSearch("");
                                    setActionFilter("All Actions");
                                    setEntityFilter("All Entities");
                                  }}
                                >
                                  Reset Filters
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedAuditEntries.map((entry) => (
                          <tr key={entry.id}>
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
                                <strong>{entry.actorEmail}</strong>
                              </div>
                            </td>
                            <td>
                              <span className={`pod-status ${actionBadgeClass(entry.action)}`}>
                                <i aria-hidden="true" />
                                {entry.action.replaceAll(".", " ")}
                              </span>
                            </td>
                            <td>
                              <div className="audit-entity-cell">
                                <span className="audit-entity-type">{entry.entityType}</span>
                                <span className="audit-entity-id" title={entry.entityId}>
                                  {entry.entityId}
                                </span>
                              </div>
                            </td>
                            <td>
                              <AuditStateChanges summary={entry.summary} changes={entry.changes} />
                            </td>
                          </tr>
                        ))
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
          </>
        )}
      </div>

      {/* Authorize Reset Modal */}
      {authorizingUser ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 21, 0.72)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="authorize-dialog-title"
        >
          <div
            className="records-card"
            style={{
              width: "min(100%, 500px)",
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
                padding: "14px",
                borderRadius: "10px",
                background: "rgba(217, 119, 6, 0.08)",
                border: "1px solid rgba(217, 119, 6, 0.25)",
                fontSize: "11px",
                lineHeight: 1.6,
                color: "var(--color-text-primary)",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "6px", color: "#b45309" }}>
                What happens when you authorize recovery:
              </div>
              <ul style={{ margin: 0, paddingLeft: "16px" }}>
                <li>Generates a secure, single-use 24-hour reset window for @{authorizingUser.username}.</li>
                <li>The user can visit the Forgot Password page and set a new password directly without answering their security question.</li>
                <li><strong>Admin Privacy Guarantee:</strong> You will NOT be shown or asked to provide the user&apos;s new password.</li>
                <li>Once the user updates their password (or 24 hours pass), this recovery window expires.</li>
                <li>This authorization is permanently recorded in the Audit Log.</li>
              </ul>
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
        </div>
      ) : null}

      {/* Admin Edit Username Modal */}
      {editingUser ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 21, 0.72)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-username-dialog-title"
        >
          <form
            onSubmit={handleConfirmUpdateUsername}
            className="records-card"
            style={{
              width: "min(100%, 460px)",
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
                  type="text"
                  disabled
                  value={`@${editingUser.username}`}
                  style={{
                    minHeight: "40px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-subtle)",
                    color: "var(--color-text-muted)",
                    fontWeight: 600,
                  }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                New Username
                <input
                  type="text"
                  value={newUsernameInput}
                  onChange={(e) => setNewUsernameInput(e.target.value.toLowerCase())}
                  placeholder="e.g. cmendoza_ops"
                  style={{
                    minHeight: "40px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--glass-surface-strong)",
                  }}
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
        </div>
      ) : null}

      {/* Delete User Confirmation Screen */}
      {userToDelete ? (
        <div className="routex-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="delete-user-dialog-title">
          <div className="routex-dialog-backdrop" onClick={() => !isDeletingUser && setUserToDelete(null)} />
          <div className="routex-dialog" style={{ maxWidth: "460px" }}>
            <header className="routex-dialog-header" style={{ flexShrink: 0 }}>
              <div>
                <h2 id="delete-user-dialog-title" style={{ fontSize: "17px", color: "var(--color-danger, #dc2626)" }}>
                  Confirm User Deletion
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "11px" }}>
                  This deletion decision requires explicit confirmation and will be logged.
                </p>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                aria-label="Close confirmation dialog"
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
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0 18px",
                  minHeight: "38px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isDeletingUser ? "not-allowed" : "pointer",
                }}
              >
                {isDeletingUser ? "Deleting Account…" : "Confirm Delete"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
