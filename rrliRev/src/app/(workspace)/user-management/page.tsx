"use client";

import { type FormEvent, useEffect, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import {
  ROLE_METADATA,
  USER_ROLES,
  type AccessLevel,
  type UserRole,
} from "@/lib/auth/rbac";

type ManagedUserRecord = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  roleLabel: string;
  accessLevel: AccessLevel;
  accessLevelLabel: string;
  isActive: boolean;
  createdAt: string;
};

const ROLE_OPTIONS = USER_ROLES.map((role) => ({
  value: role,
  label: `${ROLE_METADATA[role].label} (${ROLE_METADATA[role].accessLevelLabel})`,
}));

export default function UserManagementPage() {
  const actor = useAuthenticatedActor();
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("operations");
  const [isCreating, setIsCreating] = useState(false);
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

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
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
      setEmail("");
      setPassword("");
      setFeedback({
        tone: "success",
        text: `Provisioned ${payload.user.fullName} (${payload.user.email}) with role ${payload.user.roleLabel}.`,
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
        current.map((item) => (item.id === userId ? payload.user! : item)),
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
        current.map((item) => (item.id === user.id ? payload.user! : item)),
      );
      setFeedback({
        tone: "success",
        text: `${payload.user.fullName} is now ${payload.user.isActive ? "Active" : "Deactivated"}.`,
      });
    } catch {
      setFeedback({
        tone: "error",
        text: "Could not update account status.",
      });
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
              Provision staff accounts and assign roles across Admin, Operations, and View-Only
              personnel (Finance, HR, Secretary, Customer Representative). Public self-registration
              is disabled.
            </p>
          </div>
          <span className="access-pill admin">Admin Only ({actor.fullName})</span>
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
              onClick={() => setFeedback(null)}
            >
              ×
            </button>
          </section>
        ) : null}

        <section
          className="records-card"
          style={{ marginTop: "22px", marginBottom: "22px" }}
          aria-label="Provision new staff account"
        >
          <div className="records-heading">
            <div>
              <h2>Provision Staff Account</h2>
              <p>Create an authorized RouteX user account with an explicit server-enforced role</p>
            </div>
          </div>

          <form
            onSubmit={handleCreateUser}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
              padding: "0 23px 22px",
              alignItems: "end",
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
              Email Address
              <input
                type="email"
                placeholder="staff@routex.local"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
              Initial Password
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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

            <div style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
              <span>Assigned Role</span>
              <RoundedSelect
                value={newRole}
                options={ROLE_OPTIONS}
                onChange={(val) => setNewRole(val as UserRole)}
                ariaLabel="Select role for new user"
              />
            </div>

            <button
              type="submit"
              className="primary-action-button"
              disabled={isCreating}
              style={{ minHeight: "42px" }}
            >
              {isCreating ? "Creating…" : "+ Create Account"}
            </button>
          </form>
        </section>

        <section className="records-card" aria-label="Registered RouteX users">
          <div className="records-heading">
            <div>
              <h2>Authorized Personnel & Role Assignments</h2>
              <p>
                Role changes take effect immediately on server-side route and API permission checks
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Email Address</th>
                  <th>Access Level</th>
                  <th>Assigned Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.fullName}</strong>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`access-pill ${user.accessLevel}`}>
                        {user.accessLevelLabel}
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
                      <span
                        className={`pod-status ${user.isActive ? "attached" : "missing"}`}
                      >
                        <i aria-hidden="true" />
                        {user.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="filter-button"
                        disabled={user.id === actor.id}
                        onClick={() => handleToggleActive(user)}
                        title={
                          user.id === actor.id
                            ? "Cannot deactivate your own active Admin account"
                            : undefined
                        }
                      >
                        {user.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

