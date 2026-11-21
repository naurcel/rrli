"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuthenticatedActor } from "@/components/auth-context";
import { OperationalTopbar } from "@/components/operational-topbar";
import { DepartmentManagementSection } from "@/features/users/DepartmentManagementSection";
import { DiscordPermissionsManager } from "@/features/permissions/DiscordPermissionsManager";
import { RolePermissionsMatrix } from "@/features/permissions/RolePermissionsMatrix";
import type { UserRole } from "@/lib/auth/rbac";

type PermissionsTab = "roles-and-staff" | "departments" | "matrix";

export default function PermissionsPage() {
  const actor = useAuthenticatedActor();
  const searchParams = useSearchParams();

  const initialUser = searchParams.get("userId") || undefined;
  const initialRoleParam = searchParams.get("role") as UserRole | null;
  const initialRole = initialRoleParam || undefined;

  const [activeTab, setActiveTab] = useState<PermissionsTab>("roles-and-staff");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "").toLowerCase();
      if (hash === "departments" || hash === "depts") {
        setActiveTab("departments");
      } else if (hash === "matrix" || hash === "reference") {
        setActiveTab("matrix");
      } else if (hash === "roles" || hash === "staff" || hash === "roles-and-staff") {
        setActiveTab("roles-and-staff");
      }
    }
  }, []);

  function handleSelectTab(tab: PermissionsTab) {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${tab}`);
    }
  }

  return (
    <div className="workspace-page">
      <OperationalTopbar contextLabel="Roles & Permissions" showDateFilter={false} />

      <div className="content-wrap settings-page-wrap is-permissions-page">
        <div className="settings-layout-grid is-permissions-grid">
          {/* Left Navigation: Clean text tabs matching Settings layout */}
          <aside className="settings-tabs-sidebar" aria-label="Permissions categories">
            <div className="settings-tabs-list" role="tablist">
              <button
                type="button"
                role="tab"
                id="tab-roles-and-staff"
                aria-selected={activeTab === "roles-and-staff"}
                aria-controls="panel-roles-and-staff"
                className={`settings-tab-btn${activeTab === "roles-and-staff" ? " active" : ""}`}
                onClick={() => handleSelectTab("roles-and-staff")}
              >
                Roles & Staff
              </button>

              <button
                type="button"
                role="tab"
                id="tab-departments"
                aria-selected={activeTab === "departments"}
                aria-controls="panel-departments"
                className={`settings-tab-btn${activeTab === "departments" ? " active" : ""}`}
                onClick={() => handleSelectTab("departments")}
              >
                Departments
              </button>

              <button
                type="button"
                role="tab"
                id="tab-matrix"
                aria-selected={activeTab === "matrix"}
                aria-controls="panel-matrix"
                className={`settings-tab-btn${activeTab === "matrix" ? " active" : ""}`}
                onClick={() => handleSelectTab("matrix")}
              >
                Access Matrix
              </button>
            </div>
          </aside>

          {/* Right Main Content Area */}
          <div className="settings-tab-content-area is-expanded">
            {activeTab === "roles-and-staff" && (
              <div
                id="panel-roles-and-staff"
                role="tabpanel"
                aria-labelledby="tab-roles-and-staff"
                className="settings-tab-panel"
              >
                <DiscordPermissionsManager
                  initialSelectedUserId={initialUser}
                  initialSelectedRole={initialRole}
                />
              </div>
            )}

            {activeTab === "departments" && (
              <div
                id="panel-departments"
                role="tabpanel"
                aria-labelledby="tab-departments"
                className="settings-tab-panel"
              >
                <section className="records-card" style={{ padding: "24px" }}>
                  <DepartmentManagementSection />
                </section>
              </div>
            )}

            {activeTab === "matrix" && (
              <div
                id="panel-matrix"
                role="tabpanel"
                aria-labelledby="tab-matrix"
                className="settings-tab-panel"
              >
                <RolePermissionsMatrix />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
