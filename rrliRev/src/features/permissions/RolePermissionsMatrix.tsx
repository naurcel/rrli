"use client";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  canImportAndReviewExcel,
  canManageCompanyExpenses,
  canManageDocuments,
  canManageTrucks,
  canManageUsers,
  canMutateDeliveryRecords,
  hasPermission,
  ROLE_METADATA,
  USER_ROLES,
  type UserRole,
} from "@/lib/auth/rbac";

const ROLE_CONCISE_SUMMARY: Record<UserRole, string> = {
  admin: "Unrestricted authority across deliveries, financials, fleet, Excel batch operations, and system administration.",
  operations: "Create and update delivery records, manage multi-store drops, upload/review Excel reports, manage POD files, and register trucks.",
  finance: "Full management of company expenses, fuel disbursements, and financial ledgers; view-only operational access.",
  hr: "View-only visibility across operational and analytical modules.",
  secretary: "View-only visibility across operational and analytical modules.",
  customer_representative: "View-only visibility across operational and analytical modules.",
};

export function RolePermissionsMatrix() {
  const actor = useAuthenticatedActor();

  function renderDeliveriesCell(role: UserRole) {
    if (canMutateDeliveryRecords(role)) {
      return (
        <span className="permission-badge granted" title="Create, edit, and complete deliveries">
          Full Edit
        </span>
      );
    }
    return (
      <span className="permission-badge view-only" title="View-only access">
        View
      </span>
    );
  }

  function renderFinanceCell(role: UserRole) {
    if (canManageCompanyExpenses(role)) {
      return (
        <span className="permission-badge granted" title="Manage company transactions and expenses">
          Manage
        </span>
      );
    }
    return (
      <span className="permission-badge view-only" title="View-only access">
        View
      </span>
    );
  }

  function renderImportCell(role: UserRole) {
    if (canImportAndReviewExcel(role)) {
      return (
        <span className="permission-badge granted" title="Upload and commit Excel spreadsheets">
          Import & Commit
        </span>
      );
    }
    return (
      <span className="permission-badge denied" title="No import access">
        None
      </span>
    );
  }

  function renderTrucksCell(role: UserRole) {
    if (canManageTrucks(role)) {
      return (
        <span className="permission-badge granted" title="Register fleet trucks and license plates">
          Manage
        </span>
      );
    }
    return (
      <span className="permission-badge view-only" title="View-only access">
        View
      </span>
    );
  }

  function renderPodCell(role: UserRole) {
    if (canManageDocuments(role)) {
      return (
        <span className="permission-badge granted" title="Upload and replace POD receipts">
          Upload & Edit
        </span>
      );
    }
    return (
      <span className="permission-badge view-only" title="View-only access">
        View
      </span>
    );
  }

  function renderReportsCell(role: UserRole) {
    const canExport = hasPermission(role, "reports:export");
    const canTemplates = hasPermission(role, "reports:manage_templates");
    if (canTemplates) {
      return (
        <span className="permission-badge granted" title="Export reports and manage templates">
          Templates & Export
        </span>
      );
    }
    if (canExport) {
      return (
        <span className="permission-badge granted" title="Export reports to Excel">
          Export
        </span>
      );
    }
    return (
      <span className="permission-badge view-only" title="View reports">
        View
      </span>
    );
  }

  function renderUsersCell(role: UserRole) {
    if (canManageUsers(role)) {
      return (
        <span className="permission-badge granted" title="Manage staff accounts and permissions">
          Manage
        </span>
      );
    }
    return (
      <span className="permission-badge denied" title="No user management access">
        None
      </span>
    );
  }

  return (
    <section className="records-card settings-card-section" aria-label="Role Permissions Matrix">
      <div className="settings-section-header">
        <h2>Role Permissions Matrix</h2>
        <p>System privileges and operational access baseline across the 6 RouteX roles.</p>
      </div>

      <div
        className="settings-role-current-summary"
        style={{
          margin: "12px 0 16px",
          padding: "10px 14px",
          borderRadius: "8px",
          background: "var(--color-surface-subtle, rgba(241, 245, 249, 0.6))",
          border: "1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.2))",
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px 12px",
        }}
      >
        <span className={`access-pill ${ROLE_METADATA[actor.role].accessLevel}`} style={{ margin: 0 }}>
          {ROLE_METADATA[actor.role].label}
        </span>
        <span style={{ color: "var(--color-text-secondary)" }}>
          {ROLE_CONCISE_SUMMARY[actor.role]}
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Level</th>
              <th>Deliveries</th>
              <th>Finance</th>
              <th>Import</th>
              <th>Fleet</th>
              <th>POD</th>
              <th>Reports</th>
              <th>Users</th>
            </tr>
          </thead>
          <tbody>
            {USER_ROLES.map((roleKey) => {
              const meta = ROLE_METADATA[roleKey];
              const isCurrentRole = actor.role === roleKey;
              return (
                <tr key={roleKey} className={isCurrentRole ? "settings-current-role-row" : undefined}>
                  <td>
                    <strong>{meta.label}</strong>
                    {isCurrentRole ? <span className="settings-current-role-tag">(You)</span> : null}
                  </td>
                  <td>
                    <span className={`access-pill ${meta.accessLevel}`}>
                      {meta.accessLevelLabel}
                    </span>
                  </td>
                  <td>{renderDeliveriesCell(roleKey)}</td>
                  <td>{renderFinanceCell(roleKey)}</td>
                  <td>{renderImportCell(roleKey)}</td>
                  <td>{renderTrucksCell(roleKey)}</td>
                  <td>{renderPodCell(roleKey)}</td>
                  <td>{renderReportsCell(roleKey)}</td>
                  <td>{renderUsersCell(roleKey)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
