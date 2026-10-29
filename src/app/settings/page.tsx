"use client";

import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { Icon } from "@/components/route-x-ui";

const settings = [
  {
    category: "Workspace",
    title: "Workspace profile",
    value: "RouteX Operations",
    description: "Preview workspace name and operating identity.",
    icon: "▤",
  },
  {
    category: "Regional",
    title: "Currency and locale",
    value: "Not configured",
    description: "Currency, timezone, date boundaries, and rounding still require approval.",
    icon: "₱",
  },
  {
    category: "Preferences",
    title: "Notification preferences",
    value: "Not configured",
    description: "Alerts, reminders, and delivery updates are not connected yet.",
    icon: "◎",
  },
  {
    category: "Connections",
    title: "Data and integrations",
    value: "Not connected",
    description: "No approved external data source or production backend is connected.",
    icon: "▥",
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="app-shell">
      <OperationalSidebar />
      <main className="main-content">
        <OperationalTopbar showDateFilter={false} />
        <div className="content-wrap">
          <section className="page-intro">
            <div>
              <p className="eyebrow">MANAGE / CONFIGURATION</p>
              <h1>Settings</h1>
              <p className="subtitle">Review workspace preferences and operational configuration.</p>
            </div>
            <button className="secondary-button" type="button" disabled title="Settings persistence and permissions are not approved">
              <Icon>✓</Icon> Save changes <span className="lock">◌</span>
            </button>
          </section>

          <div className="notice" role="status">
            <span className="notice-icon">i</span>
            <div>
              <strong>Read-only preview</strong>
              <span>Settings remain unavailable until persistence, permitted editors, and authorization rules are approved.</span>
            </div>
          </div>

          <section className="records-card settings-list" aria-labelledby="workspace-settings-heading">
            <div className="records-heading">
              <div>
                <h2 id="workspace-settings-heading">Workspace settings</h2>
                <p>Configuration readiness and current preview values</p>
              </div>
              <span className="settings-readonly-pill">Read only</span>
            </div>

            <div className="settings-grid">
              {settings.map((setting) => (
                <article className="settings-card" key={setting.title}>
                  <span className="settings-card-icon"><Icon>{setting.icon}</Icon></span>
                  <div className="settings-card-content">
                    <span className="settings-category">{setting.category}</span>
                    <h3>{setting.title}</h3>
                    <strong>{setting.value}</strong>
                    <p>{setting.description}</p>
                  </div>
                  <span className="settings-card-state" aria-label={`${setting.title} is unavailable`}>Unavailable</span>
                </article>
              ))}
            </div>
          </section>

          <p className="scope-note"><span>●</span> Configuration preview only · No settings are persisted or sent to a backend.</p>
        </div>
      </main>
    </div>
  );
}
