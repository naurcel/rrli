import Link from "next/link";
import { redirect } from "next/navigation";

import { DeliveryExcelImportClient } from "@/components/delivery-import-client";
import { OperationalTopbar } from "@/components/operational-topbar";
import { canImportAndReviewExcel } from "@/lib/auth/rbac";
import { requireAuthenticatedActor } from "@/lib/auth/server-session";

export default async function DeliveryExcelImportPage() {
  const actor = await requireAuthenticatedActor();

  // Server-side RBAC enforcement: View-only personnel cannot access Excel import
  if (!canImportAndReviewExcel(actor.role)) {
    redirect("/deliveries?access=restricted");
  }

  return (
    <>
      <OperationalTopbar contextLabel="Excel Import & Post-Import Review" showDateFilter={false} />

      <div className="content-wrap delivery-entry-page">
        <header className="page-intro">
          <div>
            <Link className="back-link" href="/deliveries">
              ← Back to deliveries
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
        />
      </div>
    </>
  );
}

