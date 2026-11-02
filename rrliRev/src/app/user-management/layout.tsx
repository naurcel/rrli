import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { WorkspaceShellLayout } from "@/components/workspace-shell";
import { canManageUsers } from "@/lib/auth/rbac";
import { requireAuthenticatedActor } from "@/lib/auth/server-session";

export default async function UserManagementLayout({
  children,
}: {
  children: ReactNode;
}) {
  const actor = await requireAuthenticatedActor();

  if (!canManageUsers(actor.role)) {
    redirect("/dashboard?access=restricted");
  }

  return <WorkspaceShellLayout>{children}</WorkspaceShellLayout>;
}