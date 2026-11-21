"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PERMISSIONS, type Permission } from "@/lib/auth/rbac";

export type DepartmentRecord = {
  id: string;
  name: string;
  description: string;
  defaultPermissions: Permission[];
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function DepartmentManagementSection() {
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create / Edit modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Permission[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Duplicate modal state
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateDesc, setDuplicateDesc] = useState("");

  // Restore with permission review modal
  const [restoringDept, setRestoringDept] = useState<DepartmentRecord | null>(null);
  const [restorePerms, setRestorePerms] = useState<Permission[]>([]);

  async function loadDepartments() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/departments?includeArchived=true`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Failed to load departments.");
        return;
      }
      setDepartments(data.departments ?? []);
    } catch {
      setError("Network error loading departments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDepartments();
  }, []);

  function handleOpenCreate() {
    setEditingDeptId(null);
    setNameInput("");
    setDescInput("");
    setSelectedPerms(["deliveries:view"]);
    setIsEditing(true);
  }

  function handleOpenEdit(dept: DepartmentRecord) {
    setEditingDeptId(dept.id);
    setNameInput(dept.name);
    setDescInput(dept.description);
    setSelectedPerms([...dept.defaultPermissions]);
    setIsEditing(true);
  }

  function handleTogglePerm(perm: Permission) {
    setSelectedPerms((curr) =>
      curr.includes(perm) ? curr.filter((p) => p !== perm) : [...curr, perm],
    );
  }

  async function handleSaveDepartment() {
    if (!nameInput.trim()) {
      toast.error("Department name is required.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingDeptId) {
        // Update
        const res = await fetch("/api/departments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departmentId: editingDeptId,
            name: nameInput.trim(),
            description: descInput.trim(),
            defaultPermissions: selectedPerms,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          toast.error(data.message ?? "Failed to update department.");
          return;
        }
        toast.success(`Department '${data.department.name}' updated!`);
      } else {
        // Create
        const res = await fetch("/api/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nameInput.trim(),
            description: descInput.trim(),
            defaultPermissions: selectedPerms,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          toast.error(data.message ?? "Failed to create department.");
          return;
        }
        toast.success(`Department '${data.department.name}' created!`);
      }

      setIsEditing(false);
      void loadDepartments();
    } catch {
      toast.error("Network error while saving department.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDuplicate() {
    if (!duplicateSourceId || !duplicateName.trim()) {
      toast.error("Department name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "duplicate",
          sourceDepartmentId: duplicateSourceId,
          name: duplicateName.trim(),
          description: duplicateDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.message ?? "Failed to duplicate department.");
        return;
      }
      toast.success(`Department duplicated as '${data.department.name}'!`);
      setDuplicateSourceId(null);
      void loadDepartments();
    } catch {
      toast.error("Network error while duplicating department.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive(dept: DepartmentRecord) {
    if (!confirm(`Are you sure you want to archive '${dept.name}'? Existing members will immediately lose permissions inherited from this department.`)) {
      return;
    }

    try {
      const res = await fetch("/api/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "archive",
          departmentId: dept.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.message ?? "Failed to archive department.");
        return;
      }
      toast.success(`Department '${dept.name}' archived.`);
      void loadDepartments();
    } catch {
      toast.error("Network error while archiving department.");
    }
  }

  async function handleConfirmRestore() {
    if (!restoringDept) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          departmentId: restoringDept.id,
          defaultPermissions: restorePerms,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.message ?? "Failed to restore department.");
        return;
      }
      toast.success(`Department '${restoringDept.name}' restored!`);
      setRestoringDept(null);
      void loadDepartments();
    } catch {
      toast.error("Network error while restoring department.");
    } finally {
      setIsSaving(false);
    }
  }

  const visibleDepartments = departments.filter((d) => (showArchived ? true : !d.isArchived));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Enterprise Departments</h2>
          <p style={{ fontSize: "12px", color: "var(--color-text-secondary, #64748b)", margin: "4px 0 0 0" }}>
            Configure default department permissions and manage departmental lifecycle.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show Archived
          </label>
          <button
            type="button"
            className="primary-button"
            onClick={handleOpenCreate}
            style={{ fontSize: "12.5px", padding: "6px 14px" }}
          >
            + Create Department
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.1)", color: "#dc2626", borderRadius: "8px", fontSize: "12px" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
          Loading departments...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {visibleDepartments.map((dept) => (
            <div
              key={dept.id}
              style={{
                borderRadius: "12px",
                border: "1px solid var(--color-border, #e2e8f0)",
                background: dept.isArchived ? "var(--color-surface-subtle, #f8fafc)" : "var(--color-surface, #ffffff)",
                opacity: dept.isArchived ? 0.75 : 1,
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                    {dept.name}
                    {dept.isArchived && (
                      <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.1)", color: "#dc2626", fontWeight: 650 }}>
                        Archived
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--color-text-secondary, #64748b)", marginTop: "2px" }}>
                    {dept.description || "No description provided."}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 650, color: "var(--color-text-muted, #94a3b8)", marginBottom: "4px" }}>
                  DEFAULT PERMISSIONS ({dept.defaultPermissions.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxHeight: "80px", overflowY: "auto" }}>
                  {dept.defaultPermissions.map((p) => (
                    <span
                      key={p}
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "rgba(14, 165, 233, 0.08)",
                        color: "var(--color-accent-deep, #0284c7)",
                        fontWeight: 600,
                      }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "auto", paddingTop: "8px", borderTop: "1px solid var(--color-border, #e2e8f0)" }}>
                {!dept.isArchived ? (
                  <>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setDuplicateSourceId(dept.id);
                        setDuplicateName(`${dept.name} (Copy)`);
                        setDuplicateDesc(dept.description);
                      }}
                      style={{ fontSize: "11.5px", padding: "4px 10px" }}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleOpenEdit(dept)}
                      style={{ fontSize: "11.5px", padding: "4px 10px" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchive(dept)}
                      style={{
                        fontSize: "11.5px",
                        padding: "4px 10px",
                        background: "none",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#dc2626",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      Archive
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setRestoringDept(dept);
                      setRestorePerms([...dept.defaultPermissions]);
                    }}
                    style={{ fontSize: "11.5px", padding: "4px 12px" }}
                  >
                    Restore Department...
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isEditing && (
        <div
          className="routex-dialog-backdrop"
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
            style={{
              background: "var(--color-surface, #ffffff)",
              border: "1px solid var(--color-border, #e2e8f0)",
              borderRadius: "16px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <header style={{ padding: "18px 24px", borderBottom: "1px solid var(--color-border, #e2e8f0)", display: "flex", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
                {editingDeptId ? "Edit Department Configuration" : "Create New Department"}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
              >
                ×
              </button>
            </header>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 650, marginBottom: "4px" }}>
                  Department Name *
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="E.g., Customs Compliance"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--color-border)", fontSize: "13px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 650, marginBottom: "4px" }}>
                  Description
                </label>
                <input
                  type="text"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  placeholder="Responsibilities and operational focus..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--color-border)", fontSize: "13px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 650, marginBottom: "6px" }}>
                  Default Permissions ({selectedPerms.length} assigned)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "6px", maxHeight: "200px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "8px" }}>
                  {PERMISSIONS.map((p: Permission) => (
                    <label key={p} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedPerms.includes(p)}
                        onChange={() => handleTogglePerm(p)}
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <footer style={{ padding: "14px 24px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" className="secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleSaveDepartment} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Department"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {duplicateSourceId && (
        <div
          className="routex-dialog-backdrop"
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
            style={{
              background: "var(--color-surface, #ffffff)",
              border: "1px solid var(--color-border, #e2e8f0)",
              borderRadius: "16px",
              maxWidth: "480px",
              width: "100%",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Duplicate Department</h3>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 650, marginBottom: "4px" }}>
                New Department Name *
              </label>
              <input
                type="text"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--color-border)", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 650, marginBottom: "4px" }}>
                Description
              </label>
              <input
                type="text"
                value={duplicateDesc}
                onChange={(e) => setDuplicateDesc(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--color-border)", fontSize: "13px" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button type="button" className="secondary-button" onClick={() => setDuplicateSourceId(null)} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleConfirmDuplicate} disabled={isSaving}>
                {isSaving ? "Duplicating..." : "Create Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Department with Permission Review Modal */}
      {restoringDept && (
        <div
          className="routex-dialog-backdrop"
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
            style={{
              background: "var(--color-surface, #ffffff)",
              border: "1px solid var(--color-border, #e2e8f0)",
              borderRadius: "16px",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <header style={{ padding: "18px 24px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Restore '{restoringDept.name}'</h3>
                <span style={{ fontSize: "11.5px", color: "var(--color-text-secondary)" }}>
                  Review and configure default permissions before activating. Previous members will not be automatically reassigned.
                </span>
              </div>
              <button type="button" onClick={() => setRestoringDept(null)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}>
                ×
              </button>
            </header>
            <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
              <label style={{ fontSize: "12px", fontWeight: 650 }}>
                Default Permissions on Restoration ({restorePerms.length})
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "6px", maxHeight: "200px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "8px" }}>
                {PERMISSIONS.map((p: Permission) => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={restorePerms.includes(p)}
                      onChange={() => {
                        setRestorePerms((curr) =>
                          curr.includes(p) ? curr.filter((x) => x !== p) : [...curr, p],
                        );
                      }}
                    />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <footer style={{ padding: "14px 24px", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" className="secondary-button" onClick={() => setRestoringDept(null)} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleConfirmRestore} disabled={isSaving}>
                {isSaving ? "Restoring..." : "Confirm & Restore"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
