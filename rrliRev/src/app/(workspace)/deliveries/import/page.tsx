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
      <OperationalTopbar contextLabel="Excel Import & Post-Import Review" />

      <div className="content-wrap">
        <Link className="back-link" href="/deliveries">
          ← Back to Deliveries
        </Link>

        <header className="page-intro">
          <div>
            <h1>Excel Import & Review Staging</h1>
            <p className="subtitle">
              Authorized for {actor.roleLabel}. Imported Daily Trip Report spreadsheets are staged
              for row-by-row inspection, inline editing, and validation before any delivery record
              is committed.
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

