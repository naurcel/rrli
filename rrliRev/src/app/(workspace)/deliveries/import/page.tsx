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

      <div className="content-wrap">
        <Link className="back-link" href="/deliveries">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Deliveries
        </Link>

        <header className="page-intro">
          <div>
            <h1>Import Deliveries</h1>
            <p className="subtitle">
              Batch import and validate completed delivery trips from Excel or CSV spreadsheets.
            </p>
          </div>
          <span className="access-pill operations">
            Authorized: {actor.roleLabel}
          </span>
        </header>

        <DeliveryExcelImportClient
          actorRoleLabel={actor.roleLabel}
          actorFullName={actor.fullName}
        />
      </div>
    </>
  );
}

