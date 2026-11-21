"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { resolveEffectivePermissions } from "@/lib/auth/permission-engine";
import { PERMISSIONS, type Permission, type UserRole } from "@/lib/auth/rbac";

type ManagedUserRecord = {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  roleLabel: string;
  departments?: readonly string[];
  customGrants?: readonly Permission[];
  customRestrictions?: readonly Permission[];
  isSuperadmin?: boolean;
};

type DepartmentRecord = {
  id: string;
  name: string;
  description: string;
  defaultPermissions: Permission[];
  isArchived: boolean;
};

type Props = {
  user: ManagedUserRecord | null;
  allUsers: ManagedUserRecord[];
  onClose: () => void;
  onSuccess: (updatedUser: Partial<ManagedUserRecord>, message: string) => void;
};

export function UserDepartmentPermissionsModal({
  user,
  allUsers,
  onClose,
  onSuccess,
}: Props) {
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [grants, setGrants] = useState<Permission[]>([]);
  const [restrictions, setRestrictions] = useState<Permission[]>([]);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setSelectedDepts(user.departments ? [...user.departments] : [user.role]);
    setGrants(user.customGrants ? [...user.customGrants] : []);
    setRestrictions(user.customRestrictions ? [...user.customRestrictions] : []);
    setError(null);
    setIsSaving(false);

    fetch("/api/departments")
      .then((res) => res.json())
      .then((data: { ok?: boolean; departments?: DepartmentRecord[] }) => {
        if (data?.ok && Array.isArray(data.departments)) {
          setDepartments(data.departments);
        }
      })
      .catch(() => {});

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSaving) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user, onClose, isSaving]);

  // Compute effective permissions in real time
  const effectivePermissions = useMemo(() => {
    if (!user) return [];
    return resolveEffectivePermissions({
      role: user.role,
      isSuperadmin: user.isSuperadmin,
      departments: selectedDepts,
      customGrants: grants,
      customRestrictions: restrictions,
    });
  }, [user, selectedDepts, grants, restrictions]);

  if (!user) return null;

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    try {
      // 1. Update departments
      const deptRes = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign-departments",
          userId: user!.id,
          departmentIds: selectedDepts,
        }),
      });
      const deptPayload = await deptRes.json();
      if (!deptRes.ok || !deptPayload.ok) {
        setError(deptPayload.message ?? "Failed to update department memberships.");
        setIsSaving(false);
        return;
      }

      // 2. Update custom grants and restrictions
      const permRes = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-permissions",
          userId: user!.id,
          customGrants: grants,
          customRestrictions: restrictions,
        }),
      });
      const permPayload = await permRes.json();
      if (!permRes.ok || !permPayload.ok) {
        setError(permPayload.message ?? "Failed to update individual permissions.");
        setIsSaving(false);
        return;
      }

      onSuccess(
        {
          id: user!.id,
          departments: selectedDepts,
          customGrants: grants,
          customRestrictions: restrictions,
        },
        `Permissions and departments saved for @${user!.username}.`,
      );
      onClose();
    } catch {
      setError("Network error while saving permissions.");
      setIsSaving(false);
    }
  }

  async function handleDuplicateFromSource() {
    if (!duplicateSourceId) return;
    const sourceUser = allUsers.find((u) => u.id === duplicateSourceId);
    if (!sourceUser) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "duplicate-permissions",
          sourceUserId: duplicateSourceId,
          targetUserId: user!.id,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setError(payload.message ?? "Failed to duplicate permissions.");
        setIsSaving(false);
        return;
      }

      setGrants(sourceUser.customGrants ? [...sourceUser.customGrants] : []);
      setRestrictions(sourceUser.customRestrictions ? [...sourceUser.customRestrictions] : []);
      setIsSaving(false);
    } catch {
      setError("Network error while duplicating permissions.");
      setIsSaving(false);
    }
  }

  function toggleDept(deptId: string) {
    setSelectedDepts((curr) =>
      curr.includes(deptId) ? curr.filter((d) => d !== deptId) : [...curr, deptId],
    );
  }

  function toggleGrant(perm: Permission) {
    setGrants((curr) =>
      curr.includes(perm) ? curr.filter((p) => p !== perm) : [...curr, perm],
    );
    // If we grant it, remove from restrictions
    setRestrictions((curr) => curr.filter((p) => p !== perm));
  }

  function toggleRestriction(perm: Permission) {
    setRestrictions((curr) =>
      curr.includes(perm) ? curr.filter((p) => p !== perm) : [...curr, perm],
    );
    // If we restrict it, remove from grants
    setGrants((curr) => curr.filter((p) => p !== perm));
  }

  return createPortal(
    <div
      className="routex-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-perm-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        className="routex-dialog-panel"
        style={{
          background: "var(--color-surface, #ffffff)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: "16px",
          boxShadow: "0 20px 45px -10px rgba(0, 0, 0, 0.3)",
          maxWidth: "760px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--color-border, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              id="user-perm-title"
              style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--color-text, #0f172a)" }}
            >
              Configure Permissions & Departments
            </h2>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary, #64748b)" }}>
              {user.fullName} (@{user.username}) — Role: {user.roleLabel}
              {user.isSuperadmin && (
                <span style={{ marginLeft: "6px", fontWeight: 600, color: "var(--color-accent-deep)" }}>
                  (Superadmin)
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "var(--color-text-muted, #94a3b8)",
            }}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>

        <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#dc2626",
                fontSize: "12.5px",
              }}
            >
              {error}
            </div>
          )}

          {user.isSuperadmin && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "var(--color-surface-subtle, #f8fafc)",
                border: "1px solid var(--color-border, #e2e8f0)",
                fontSize: "12px",
                color: "var(--color-text-secondary, #64748b)",
              }}
            >
              Superadmin account holds full system permissions.
            </div>
          )}

          {/* Duplicate Permissions Tool */}
          <div
            style={{
              padding: "12px 16px",
              background: "var(--color-surface-subtle, #f8fafc)",
              borderRadius: "10px",
              border: "1px solid var(--color-border, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: "12.5px", fontWeight: 650 }}>Copy Individual Customizations</div>
              <div style={{ fontSize: "11px", color: "var(--color-text-muted, #94a3b8)" }}>
                Import custom grants & restrictions from another employee without modifying department memberships.
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                value={duplicateSourceId}
                onChange={(e) => setDuplicateSourceId(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  fontSize: "12px",
                  background: "var(--color-surface, #ffffff)",
                }}
              >
                <option value="">Select an employee...</option>
                {allUsers
                  .filter((u) => u.id !== user.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} (@{u.username})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="secondary-button"
                onClick={handleDuplicateFromSource}
                disabled={!duplicateSourceId || isSaving}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                Copy
              </button>
            </div>
          </div>

          {/* 1. Department Memberships */}
          <div>
            <h3 style={{ fontSize: "13.5px", fontWeight: 700, margin: "0 0 6px 0" }}>
              1. Department Memberships (Additive)
            </h3>
            <p style={{ fontSize: "11.5px", color: "var(--color-text-secondary, #64748b)", margin: "0 0 10px 0" }}>
              Users inherit the combined permissions of all active assigned departments.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
              {departments.map((dept) => (
                <label
                  key={dept.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border, #e2e8f0)",
                    background: selectedDepts.includes(dept.id)
                      ? "rgba(14, 165, 233, 0.08)"
                      : "var(--color-surface, #ffffff)",
                    cursor: "pointer",
                    fontSize: "12.5px",
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDepts.includes(dept.id)}
                    onChange={() => toggleDept(dept.id)}
                    disabled={isSaving}
                  />
                  <span>{dept.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 2. Permission Matrix: Custom Grants and Restrictions */}
          <div>
            <h3 style={{ fontSize: "13.5px", fontWeight: 700, margin: "0 0 6px 0" }}>
              2. Individual Permission Overrides
            </h3>
            <p style={{ fontSize: "11.5px", color: "var(--color-text-secondary, #64748b)", margin: "0 0 10px 0" }}>
              Individual grants add permissions. Individual restrictions override department permissions.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "8px",
                maxHeight: "220px",
                overflowY: "auto",
                border: "1px solid var(--color-border, #e2e8f0)",
                borderRadius: "8px",
                padding: "10px",
              }}
            >
              {PERMISSIONS.map((perm: Permission) => {
                const isGranted = grants.includes(perm);
                const isRestricted = restrictions.includes(perm);

                return (
                  <div
                    key={perm}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: isRestricted
                        ? "rgba(239, 68, 68, 0.08)"
                        : isGranted
                        ? "rgba(16, 185, 129, 0.08)"
                        : "var(--color-surface-subtle, #f8fafc)",
                      border: "1px solid var(--color-border, #e2e8f0)",
                      fontSize: "11.5px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <span style={{ fontWeight: 600, wordBreak: "break-all" }}>{perm}</span>
                    <div style={{ display: "flex", gap: "10px", fontSize: "11px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", color: "#059669" }}>
                        <input
                          type="checkbox"
                          checked={isGranted}
                          onChange={() => toggleGrant(perm)}
                          disabled={isSaving}
                        />
                        Grant
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", color: "#dc2626" }}>
                        <input
                          type="checkbox"
                          checked={isRestricted}
                          onChange={() => toggleRestriction(perm)}
                          disabled={isSaving}
                        />
                        Restrict
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Effective Permissions Preview */}
          <div>
            <h3 style={{ fontSize: "13.5px", fontWeight: 700, margin: "0 0 6px 0" }}>
              3. Effective Permissions ({effectivePermissions.length} total)
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {effectivePermissions.map((perm) => (
                <span
                  key={perm}
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "rgba(14, 165, 233, 0.12)",
                    color: "var(--color-accent-deep, #0284c7)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>
        </div>

        <footer
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--color-border, #e2e8f0)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            background: "var(--color-surface-subtle, #f8fafc)",
          }}
        >
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={isSaving}
            style={{ minHeight: "36px", padding: "0 16px", fontSize: "12.5px" }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={isSaving}
            style={{ minHeight: "36px", padding: "0 20px", fontSize: "12.5px" }}
          >
            {isSaving ? "Saving..." : "Save Configuration"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
