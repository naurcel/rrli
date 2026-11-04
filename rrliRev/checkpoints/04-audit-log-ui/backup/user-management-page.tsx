"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { OperationalTopbar } from "@/components/operational-topbar";
import { PasswordCriteriaList } from "@/components/password-criteria-list";
import { RoundedSelect } from "@/components/rounded-select";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
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
  label: `${ROLE_METADATA[role].label} (${ROLE_METADATA[role].accessLevelLabel})`,
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

  async function loadAuditEntries() {
    setAuditLoading(true);
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
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "audit") {
      void loadAuditEntries();
    }
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
    } catch {
      setEditUsernameError("Network or server error while updating username.");
    } finally {
      setIsUpdatingUsername(false);
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
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((user) => {
                      const isRecoveryActive = Boolean(
                        user.recoveryExpiresAt && new Date(user.recoveryExpiresAt) > new Date(),
                      );
                      const isSelf = user.id === actor.id;

                      return (
                        <tr key={user.id}>
                          <td>
                            <strong>{user.fullName}</strong>
                            <br />
                            <small style={{ color: "var(--color-text-muted)", fontSize: "11px" }}>
                              {user.email}
                            </small>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  fontWeight: 600,
                                  color: "var(--color-text-primary)",
                                }}
                              >
                                @{user.username}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(user);
                                  setNewUsernameInput(user.username);
                                  setEditUsernameError(null);
                                }}
                                title={`Edit username for ${user.fullName}`}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "2px 4px",
                                  fontSize: "11px",
                                  color: "var(--color-accent-deep)",
                                  textDecoration: "underline",
                                }}
                              >
                                Edit
                              </button>
                            </div>
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
                            <span className={`access-pill ${user.accessLevel}`}>
                              {user.accessLevelLabel}
                            </span>
                          </td>
                          <td>
                            {isRecoveryActive ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "3px 8px",
                                  borderRadius: "999px",
                                  background: "rgba(217, 119, 6, 0.15)",
                                  color: "#b45309",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                                title={`Reset authorized until ${new Date(user.recoveryExpiresAt!).toLocaleTimeString()}`}
                              >
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: "#d97706",
                                  }}
                                />
                                Reset Authorized (24h)
                              </span>
                            ) : user.mustChangePassword ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "3px 8px",
                                  borderRadius: "999px",
                                  background: "rgba(59, 130, 246, 0.12)",
                                  color: "#2563eb",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: "#3b82f6",
                                  }}
                                />
                                Initial Setup Pending
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "3px 8px",
                                  borderRadius: "999px",
                                  background: "rgba(16, 185, 129, 0.12)",
                                  color: "#059669",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: "#10b981",
                                  }}
                                />
                                Setup Complete
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`pod-status ${user.isActive ? "attached" : "missing"}`}
                            >
                              <i aria-hidden="true" />
                              {user.isActive ? "Active" : "Deactivated"}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <button
                                type="button"
                                className="filter-button"
                                disabled={isSelf}
                                onClick={() => {
                                  setAuthorizingUser(user);
                                  setAuthorizeError(null);
                                }}
                                title={
                                  isSelf
                                    ? "Admins cannot authorize reset for their own account"
                                    : "Authorize 24h password reset via Forgot Password without security question"
                                }
                                style={{ fontSize: "11px", whiteSpace: "nowrap" }}
                              >
                                Authorize Reset
                              </button>

                              <button
                                type="button"
                                className="filter-button"
                                disabled={isSelf}
                                onClick={() => handleToggleActive(user)}
                                title={
                                  isSelf
                                    ? "Cannot deactivate your own active Admin account"
                                    : undefined
                                }
                                style={{ fontSize: "11px" }}
                              >
                                {user.isActive ? "Deactivate" : "Reactivate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                        <th>Date &amp; Time</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Entity</th>
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
                              padding: "32px",
                              color: "var(--color-text-muted)",
                            }}
                          >
                            No audit events match your search criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredAuditEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td>
                              <strong>{new Date(entry.occurredAt).toLocaleDateString()}</strong>
                              <br />
                              <small style={{ color: "var(--color-text-muted)" }}>
                                {new Date(entry.occurredAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </small>
                            </td>
                            <td>
                              <strong>{entry.actorEmail}</strong>
                            </td>
                            <td>
                              <span className={`pod-status ${actionBadgeClass(entry.action)}`}>
                                <i aria-hidden="true" />
                                {entry.action.replaceAll(".", " ")}
                              </span>
                            </td>
                            <td>
                              <span style={{ textTransform: "capitalize", fontWeight: 600 }}>
                                {entry.entityType}
                              </span>
                              <br />
                              <small className="truck-code">{entry.entityId}</small>
                            </td>
                            <td>
                              <details style={{ cursor: "pointer" }}>
                                <summary style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                                  {entry.summary}
                                </summary>
                                {entry.changes ? (
                                  <pre
                                    style={{
                                      margin: "8px 0 0",
                                      padding: "10px",
                                      background: "var(--glass-surface-strong)",
                                      border: "1px solid var(--color-border)",
                                      borderRadius: "8px",
                                      fontSize: "11px",
                                      maxHeight: "160px",
                                      overflow: "auto",
                                    }}
                                  >
                                    {JSON.stringify(entry.changes, null, 2)}
                                  </pre>
                                ) : null}
                              </details>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="table-footer">
                <span>
                  Showing {filteredAuditEntries.length} of {auditEntries.length} recorded audit events
                </span>
              </div>
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
    </>
  );
}
