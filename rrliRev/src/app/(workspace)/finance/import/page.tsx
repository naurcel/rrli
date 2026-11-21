import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyExpenseImportClient } from "@/components/company-expense-import-client";
import { OperationalTopbar } from "@/components/operational-topbar";
import { canManageCompanyExpenses } from "@/lib/auth/rbac";
import { requireAuthenticatedActor } from "@/lib/auth/server-session";
import { resolveReturnTarget } from "@/lib/navigation/return-context";

export default async function CompanyExpenseImportPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; returnLabel?: string }>;
}) {
  const actor = await requireAuthenticatedActor();

  // Server-side RBAC enforcement: View-only personnel cannot import company expenses
  if (!canManageCompanyExpenses(actor.role)) {
    redirect("/finance?access=restricted");
  }

  const params = await searchParams;
  const backTarget = resolveReturnTarget({
    returnTo: params.returnTo,
    returnLabel: params.returnLabel,
    fallbackHref: "/finance",
    fallbackLabel: "Back to finance",
  });

  return (
    <>
      <OperationalTopbar contextLabel="Finance Expense Import" showDateFilter={false} />

      <div className="content-wrap delivery-entry-page">
        <header className="page-intro">
          <div>
            <Link className="back-link" href={backTarget.href}>
              ← {backTarget.label}
            </Link>
            <h1>Import company expenses</h1>
            <p className="subtitle">
              Batch import company operating expenses from Excel or CSV spreadsheets.
            </p>
          </div>
        </header>

        <CompanyExpenseImportClient
          actorRoleLabel={actor.roleLabel}
          actorFullName={actor.fullName}
          returnHref={backTarget.href}
        />
      </div>
    </>
  );
}
