import Link from "next/link";
import { redirect } from "next/navigation";

import { DeliveryExcelImportClient } from "@/components/delivery-import-client";
import { OperationalTopbar } from "@/components/operational-topbar";
import { canImportAndReviewExcel } from "@/lib/auth/rbac";
import { requireAuthenticatedActor } from "@/lib/auth/server-session";
import { resolveReturnTarget } from "@/lib/navigation/return-context";

export default async function DeliveryExcelImportPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; returnLabel?: string }>;
}) {
  const actor = await requireAuthenticatedActor();

  // Server-side RBAC enforcement: View-only personnel cannot access Excel import
  if (!canImportAndReviewExcel(actor.role)) {
    redirect("/deliveries?access=restricted");
  }

  const params = await searchParams;
  const backTarget = resolveReturnTarget({
    returnTo: params.returnTo,
    returnLabel: params.returnLabel,
    fallbackHref: "/deliveries",
    fallbackLabel: "Back to deliveries",
  });

  return (
    <>
      <OperationalTopbar contextLabel="Excel Import & Post-Import Review" showDateFilter={false} />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <Link className="back-link" href={backTarget.href}>
              ← {backTarget.label}
            </Link>
            <h1>Import deliveries</h1>
            <p className="subtitle">
              Batch import and validate completed delivery trips from Excel or CSV spreadsheets.
            </p>
          </div>
        </header>

        <DeliveryExcelImportClient
          actorRoleLabel={actor.roleLabel}
          actorFullName={actor.fullName}
          returnHref={backTarget.href}
        />
      </div>
    </>
  );
}

