import Link from "next/link";
import { redirect } from "next/navigation";

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
            <p className="eyebrow">DAILY TRIP REPORT IMPORT WORKFLOW</p>
            <h1>Excel Import & Review Staging</h1>
            <p className="subtitle">
              Authorized for {actor.roleLabel}. Imported Daily Trip Report spreadsheets are staged
              for row-by-row inspection, inline editing, and validation before any delivery record
              is committed.
            </p>
          </div>
        </header>

        <section className="notice" role="status">
          <span className="notice-icon" aria-hidden="true">
            i
          </span>
          <div>
            <strong>Mandatory Review Before Save:</strong>
            <span>
              Per RouteX governance, uploaded Excel files are never saved directly into the
              completed delivery ledger. Every import batch preserves the original file reference
              and stages rows for client, truck, store drop-off, and expense validation first.
            </span>
          </div>
        </section>

        <section
          className="records-card"
          style={{ marginTop: "22px" }}
          aria-label="Import workflow structure"
        >
          <div className="records-heading">
            <div>
              <h2>Staged Review Pipeline Foundation</h2>
              <p>
                Ready for Daily Trip Report (.xlsx) parser connection in the next implementation
                stage
              </p>
            </div>
            <span className="access-pill operations">
              Authorized: {actor.roleLabel}
            </span>
          </div>

          <div className="settings-grid">
            <article className="settings-card">
              <div className="settings-card-icon">1</div>
              <div className="settings-card-content">
                <span className="settings-category">STAGE 1 · FILE CAPTURE</span>
                <h3>Original Spreadsheet Preservation</h3>
                <strong>Traceable Import Batch Header</strong>
                <p>
                  Captures the original Daily Trip Report Excel file and records the importing
                  operator ({actor.fullName}) and timestamp in <code>excel_import_batches</code>.
                </p>
              </div>
              <span className="settings-card-state">Schema Ready</span>
            </article>

            <article className="settings-card">
              <div className="settings-card-icon">2</div>
              <div className="settings-card-content">
                <span className="settings-category">STAGE 2 · STAGED TABLE EDITING</span>
                <h3>Post-Import Review & Correction</h3>
                <strong>Inline Cell Editing & Drop-off Grouping</strong>
                <p>
                  Allows Operations and Admin users to inspect parsed client names, waybill
                  numbers, truck plates, multi-store drop-offs, toll breakdowns, and crew rates,
                  and fix missing or invalid cells before saving.
                </p>
              </div>
              <span className="settings-card-state">Next Stage</span>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}

