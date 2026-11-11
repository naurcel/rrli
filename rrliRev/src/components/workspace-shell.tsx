import type { ReactNode } from "react";

import { AuthActorProvider } from "@/components/auth-context";
import { GlobalDateRangeProvider } from "@/components/global-date-range-picker";
import { InitialSetupModal } from "@/components/initial-setup-modal";
import { OperationalSidebar } from "@/components/operational-sidebar";
import { RouteXFooter } from "@/components/routex-footer";
import { SidebarStateProvider } from "@/components/sidebar-state";
import { requireAuthenticatedActor } from "@/lib/auth/server-session";

export async function WorkspaceShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const actor = await requireAuthenticatedActor();

  return (
    <AuthActorProvider actor={actor}>
      <GlobalDateRangeProvider>
        <SidebarStateProvider>
          <div className="app-shell">
            <OperationalSidebar />
            <div className="main-content">
              {children}
              <RouteXFooter />
              {actor.mustChangePassword || !actor.hasSecurityQuestion ? (
                <InitialSetupModal username={actor.username} />
              ) : null}
            </div>
          </div>
        </SidebarStateProvider>
      </GlobalDateRangeProvider>
    </AuthActorProvider>
  );
}
