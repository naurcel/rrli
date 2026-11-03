"use client";

import { useAuthenticatedActor } from "@/components/auth-context";
import { OperationalTopbar } from "@/components/operational-topbar";
import { ROLE_METADATA, USER_ROLES } from "@/lib/auth/rbac";

export default function SettingsPage() {
  const actor = useAuthenticatedActor();

  return (
    <>
      <OperationalTopbar contextLabel="Workspace Settings & Access Matrix" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <h1>Settings</h1>
            <p className="subtitle">
              Review system scope and access settings.
            </p>
          </div>
          <span className={`access-pill ${actor.accessLevel}`}>
            {actor.roleLabel} · {actor.accessLevelLabel}
          </span>
        </header>

        <section
          className="records-card settings-list"
          aria-label="System posture and scope settings"
        >
          <div className="records-heading">
            <div>
              <h2>Revised RouteX System Posture</h2>
              <p>Delivery operations and trucks.</p>
            </div>
          </div>

          <div className="settings-grid">
            <article className="settings-card">
              <div className="settings-card-icon">✓</div>
              <div className="settings-card-content">
                <span className="settings-category">CORE SCOPE</span>
                <h3>Delivery Operations & Trucks</h3>
                <strong>Completed Trips, Multi-Store Drop-offs & PODs</strong>
                <p>
                  Tracks client deliveries, store drop-offs per trip, itemized trip expenses
                  (diesel, tolls, entry fees, driver/helper rates & allowances), Excel import
                  review, and truck performance.
                </p>
              </div>
              <span className="settings-card-state">Active</span>
            </article>

            <article className="settings-card">
              <div className="settings-card-icon">🔒</div>
              <div className="settings-card-content">
                <span className="settings-category">AUTHENTICATION & RBAC</span>
                <h3>Server-Side Role Enforcement</h3>
                <strong>
                  Signed in as {actor.fullName} ({actor.roleLabel})
                </strong>
                <p>
                  Roles are resolved exclusively on the server from trusted profile records. Direct
                  requests from View-Only accounts are blocked with HTTP 403 Forbidden.
                </p>
              </div>
              <span className="settings-card-state">{actor.providerMode}</span>
            </article>
          </div>
        </section>

        <section
          className="records-card"
          style={{ marginTop: "22px" }}
          aria-label="Role and permission matrix"
        >
          <div className="records-heading">
            <div>
              <h2>Role & Access Level Reference</h2>
              <p>Access for six company roles.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Access Level</th>
                  <th>Deliveries & Drop-offs</th>
                  <th>Excel Import & Review</th>
                  <th>POD Verification</th>
                  <th>User Management</th>
                </tr>
              </thead>
              <tbody>
                {USER_ROLES.map((roleKey) => {
                  const meta = ROLE_METADATA[roleKey];
                  const canWrite = meta.accessLevel !== "view_only";
                  const isAdmin = meta.accessLevel === "admin";
                  return (
                    <tr key={roleKey}>
                      <td>
                        <strong>{meta.label}</strong>
                      </td>
                      <td>
                        <span className={`access-pill ${meta.accessLevel}`}>
                          {meta.accessLevelLabel}
                        </span>
                      </td>
                      <td>{canWrite ? "Create, Edit & View" : "View-Only"}</td>
                      <td>{canWrite ? "Upload, Review & Confirm" : "No Access"}</td>
                      <td>{canWrite ? "Verify & Update" : "View-Only"}</td>
                      <td>{isAdmin ? "Full Admin Control" : "Restricted"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

