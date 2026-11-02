import type { ReactNode } from "react";

import { AuthActorProvider } from "@/components/auth-context";
import { GlobalDateRangeProvider } from "@/components/global-date-range-picker";
import { OperationalSidebar } from "@/components/operational-sidebar";
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
            <div className="main-content">{children}</div>
          </div>
        </SidebarStateProvider>
      </GlobalDateRangeProvider>
    </AuthActorProvider>
  );
}

