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
          ← Back to Deliveries
        </Link>

        <header className="page-intro">
          <div>
            <h1>Import Deliveries</h1>
            <p className="subtitle">
              Import trips from Excel spreadsheet.
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

