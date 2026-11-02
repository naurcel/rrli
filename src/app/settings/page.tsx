"use client";

import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";

export default function SettingsPage() {
  return (
    <div className="app-shell">
      <OperationalSidebar />
      <main className="main-content">
        <OperationalTopbar showDateFilter={false} />
        <div className="content-wrap settings-empty-page">
          <section className="page-intro">
            <div><h1>Settings</h1><p className="subtitle">I wonder what to put here?</p></div>
          </section>
          <section className="records-card settings-empty-card" aria-label="Settings work in progress">
            <p>Work in progress.</p>
            <span>Configuration will appear here once the workspace rules and permissions are defined.</span>
          </section>
        </div>
      </main>
    </div>
  );
}
