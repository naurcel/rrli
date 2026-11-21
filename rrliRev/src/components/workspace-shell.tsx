import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AuthActorProvider } from "@/components/auth-context";
import { GlobalDateRangeProvider } from "@/components/global-date-range-picker";
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

  if (actor.mustChangePassword || !actor.hasSecurityQuestion) {
    redirect("/initial-setup");
  }

  return (
    <AuthActorProvider actor={actor}>
      <GlobalDateRangeProvider>
        <SidebarStateProvider>
          <div className="app-shell">
            <OperationalSidebar />
            <div className="main-content">
              {children}
              <RouteXFooter />
            </div>
          </div>
        </SidebarStateProvider>
      </GlobalDateRangeProvider>
    </AuthActorProvider>
  );
}
