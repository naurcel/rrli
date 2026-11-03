"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  isDateInRange,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import {
  derivePodVerificationStatus,
} from "@/features/deliveries/delivery-domain";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import { canVerifyPodDocuments } from "@/lib/auth/rbac";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function PodDocumentsPage() {
  const actor = useAuthenticatedActor();
  const { range } = useGlobalDateRange();
  const canVerify = canVerifyPodDocuments(actor.role);

  const [deliveries, setDeliveries] = useState<readonly DeliveryLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("All Drop-off Statuses");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [updatingStopId, setUpdatingStopId] = useState<string | null>(null);

  // Modal review state
  const [inspectingStop, setInspectingStop] = useState<{
    tripId: string;
    waybillNumber: string;
    deliveryDate: string;
    clientName: string;
    plateNumber: string;
    version: number;
    stop: DeliveryLedgerItem["dropoffs"][number];
    isComplete: boolean;
  } | null>(null);

  const [docDetail, setDocDetail] = useState<{
    id?: string;
    filename?: string;
    status?: string;
    notes?: string | null;
    downloadUrl?: string | null;
    isMock?: boolean;
  } | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docActionError, setDocActionError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [docSubmitting, setDocSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);

    const params = new URLSearchParams({ page: "1", pageSize: "100" });
    if (range.startDate) params.set("dateFrom", toDateKey(range.startDate));
    if (range.endDate) params.set("dateTo", toDateKey(range.endDate));

    fetch(`/api/deliveries?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          ok?: boolean;
          items?: DeliveryLedgerItem[];
          message?: string;
        };
        if (!response.ok || !data.ok) {
          throw new Error(data.message ?? "Unable to load POD records.");
        }
        setDeliveries(data.items ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Unable to load POD records.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [range]);

  const dateFilteredDeliveries = useMemo(
    () => deliveries.filter((trip) => isDateInRange(trip.deliveryDate, range)),
    [deliveries, range],
  );

  const flattenedStops = useMemo(() => {
    return dateFilteredDeliveries.flatMap((trip) =>
      trip.dropoffs.map((stop) => ({
        tripId: trip.id,
        waybillNumber: trip.waybillNumber,
        deliveryDate: trip.deliveryDate,
        clientName: trip.clientName,
        plateNumber: trip.plateNumber,
        version: trip.version,
        stop,
        isComplete: stop.podSubmitted && stop.supportingDocsComplete,
      })),
    );
  }, [dateFilteredDeliveries]);

  const filteredStops = useMemo(() => {
    if (filterStatus === "Verified Only") {
      return flattenedStops.filter((item) => item.isComplete);
    }
    if (filterStatus === "Needs Follow-up") {
      return flattenedStops.filter((item) => !item.isComplete);
    }
    return flattenedStops;
  }, [flattenedStops, filterStatus]);

  const counts = useMemo(() => {
    const verified = flattenedStops.filter((item) => item.isComplete).length;
    const pending = flattenedStops.length - verified;
    return { total: flattenedStops.length, verified, pending };
  }, [flattenedStops]);

  async function openDocModal(item: (typeof flattenedStops)[number]) {
    setInspectingStop(item);
    setDocDetail(null);
    setDocActionError(null);
    setUploadFile(null);
    setReviewNotes("");
    setDocLoading(true);

    try {
      const res = await fetch(`/api/deliveries/documents?deliveryId=${item.tripId}&dropoffId=${item.stop.id}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setDocDetail(data.document);
        setReviewNotes(data.document.notes || "");
      }
    } catch {
      // Ignored if document record doesn't exist yet
    } finally {
      setDocLoading(false);
    }
  }

  async function handleDocAction(action: "upload" | "verify" | "reject") {
    if (!inspectingStop || docSubmitting) return;

    if (action === "reject" && reviewNotes.trim().length < 5) {
      setDocActionError("A rejection note with at least 5 characters is required.");
      return;
    }

    setDocSubmitting(true);
    setDocActionError(null);

    const formData = new FormData();
    formData.append("deliveryId", inspectingStop.tripId);
    formData.append("dropoffId", inspectingStop.stop.id);
    formData.append("action", action);
    formData.append("notes", reviewNotes.trim());
    if (uploadFile) {
      formData.append("file", uploadFile);
    }

    try {
      const res = await fetch("/api/deliveries/documents", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Failed to perform document action.");
      }

      const isVerified = action === "verify";
      const isRejected = action === "reject";
      const nextSubmitted = !isRejected;
      const nextComplete = isVerified;
      const docRef = uploadFile
        ? uploadFile.name
        : (data.document?.filename ?? inspectingStop.stop.documentRef);

      setDeliveries((current) =>
        current.map((trip) =>
          trip.id === inspectingStop.tripId
            ? (() => {
                const nextDropoffs = trip.dropoffs.map((stop) =>
                  stop.id === inspectingStop.stop.id
                    ? {
                        ...stop,
                        podSubmitted: nextSubmitted,
                        supportingDocsComplete: nextComplete,
                        documentRef: docRef,
                      }
                    : stop,
                );
                return {
                  ...trip,
                  version: trip.version + 1,
                  dropoffs: nextDropoffs,
                  podStatus: derivePodVerificationStatus(nextDropoffs),
                };
              })()
            : trip,
        ),
      );

      setFeedback({
        tone: "success",
        text: `Successfully performed "${action}" for ${inspectingStop.stop.storeName} (${inspectingStop.waybillNumber}).`,
      });
      setInspectingStop(null);
    } catch (err) {
      setDocActionError(err instanceof Error ? err.message : "Error performing document action.");
    } finally {
      setDocSubmitting(false);
    }
  }

  async function toggleStopVerification(
    item: (typeof flattenedStops)[number],
  ): Promise<boolean> {
    if (!canVerify || updatingStopId) {
      return false;
    }

    setUpdatingStopId(item.stop.id);
    setFeedback(null);
    const nextState = !item.isComplete;

    try {
      const response = await fetch("/api/deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_pod",
          deliveryId: item.tripId,
          dropoffId: item.stop.id,
          expectedVersion: item.version,
          podSubmitted: nextState,
          supportingDocsComplete: nextState,
          documentRef: nextState
            ? `POD-${item.waybillNumber}-S${item.stop.sequence}.pdf`
            : "Awaiting verification",
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        deliveryId?: string;
        podStatus?: string;
        result?: { version?: number };
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setFeedback({
          tone: "error",
          text: payload?.message ?? "Could not update POD verification status.",
        });
        return false;
      }

      setDeliveries((current) =>
        current.map((trip) =>
          trip.id === item.tripId
            ? (() => {
                const nextDropoffs = trip.dropoffs.map((stop) =>
                  stop.id === item.stop.id
                    ? {
                        ...stop,
                        podSubmitted: nextState,
                        supportingDocsComplete: nextState,
                        documentRef: nextState
                          ? `POD-${item.waybillNumber}-S${item.stop.sequence}.pdf`
                          : "Awaiting verification",
                      }
                    : stop,
                );
                return {
                  ...trip,
                  version: payload?.result?.version ?? trip.version + 1,
                  dropoffs: nextDropoffs,
                  podStatus: derivePodVerificationStatus(nextDropoffs),
                };
              })()
            : trip,
        ),
      );
      setFeedback({
        tone: "success",
        text: `Updated POD & supporting document status for ${item.stop.storeName} (${item.waybillNumber}).`,
      });
      return true;
    } catch {
      setFeedback({
        tone: "error",
        text: "Network error while updating POD verification status.",
      });
      return false;
    } finally {
      setUpdatingStopId(null);
    }
  }

  return (
    <>
      <OperationalTopbar contextLabel="POD & Supporting Document Verification" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <h1>POD & Supporting Documents</h1>
            <p className="subtitle">
              Verify store-by-store Proof of Delivery (POD) slips and supporting documents across
              every completed trip.
            </p>
          </div>
          {canVerify ? (
            <span className="access-pill operations">
              Verification Enabled ({actor.roleLabel})
            </span>
          ) : (
            <span className="settings-readonly-pill">
              View-Only Mode ({actor.roleLabel})
            </span>
          )}
        </header>

        {feedback ? (
          <section className="notice" role={feedback.tone === "error" ? "alert" : "status"}>
            <span className="notice-icon" aria-hidden="true">
              {feedback.tone === "error" ? "!" : "i"}
            </span>
            <div>
              <strong>
                {feedback.tone === "error" ? "Action Blocked:" : "Verification Updated:"}
              </strong>
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setFeedback(null)}
            >
              ×
            </button>
          </section>
        ) : null}

        <section className="stat-grid" aria-label="POD verification totals">
          <article className="stat-card">
            <span className="stat-label">TOTAL STORE DROP-OFFS</span>
            <strong>{counts.total}</strong>
            <span className="stat-meta">Across {deliveries.length} completed deliveries</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">VERIFIED POD & DOCS</span>
            <strong>{counts.verified}</strong>
            <span className="stat-meta positive">Complete receiving slip & waybill</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">NEEDS FOLLOW-UP</span>
            <strong>{counts.pending}</strong>
            <span className={`stat-meta ${counts.pending > 0 ? "warning" : "positive"}`}>
              {counts.pending > 0
                ? "Missing POD or incomplete supporting document"
                : "All store documents verified"}
            </span>
          </article>
        </section>

        <section className={`records-card${loading ? " is-loading" : ""}`} aria-label="Store POD verification checklist">
          <div className="records-heading">
            <div>
              <h2>Store-Level Document Verification Queue</h2>
              <p>
                Each store drop-off within a delivery is checked for both POD submission and
                supporting document completeness.
              </p>
            </div>
            <RoundedSelect
              value={filterStatus}
              options={["All Drop-off Statuses", "Needs Follow-up", "Verified Only"]}
              onChange={setFilterStatus}
              ariaLabel="Filter drop-offs by document status"
            />
          </div>

          {loadError ? (
            <div className="empty-state" role="alert">
              <strong>POD records are unavailable</strong>
              <span>{loadError}</span>
            </div>
          ) : loading ? (
            <div className="empty-state" role="status">
              <strong>Loading document queue…</strong>
              <span>Retrieving completed deliveries and store-level document states.</span>
            </div>
          ) : filteredStops.length === 0 ? (
            <div className="empty-state">
              <strong>No drop-offs match this view</strong>
              <span>Change the document filter or selected date range.</span>
            </div>
          ) : <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waybill & Date</th>
                  <th>Client</th>
                  <th>Truck</th>
                  <th>Stop # & Store Name</th>
                  <th>POD Submitted</th>
                  <th>Supporting Docs</th>
                  <th>Document Reference</th>
                </tr>
              </thead>
              <tbody>
                {filteredStops.map((item) => (
                  <tr
                    key={item.stop.id}
                    className="record-row"
                    tabIndex={0}
                    aria-label={`Review POD for ${item.stop.storeName}, ${item.waybillNumber}`}
                    onClick={() => void openDocModal(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void openDocModal(item);
                      }
                    }}
                  >
                    <td>
                      <strong>{item.waybillNumber}</strong>
                      <br />
                      <small>{item.deliveryDate}</small>
                    </td>
                    <td>{item.clientName}</td>
                    <td className="truck-code">{item.plateNumber}</td>
                    <td>
                      <strong>
                        Stop #{item.stop.sequence}: {item.stop.storeName}
                      </strong>
                      <br />
                      <small>{item.stop.destinationArea}</small>
                    </td>
                    <td>
                      <span
                        className={`pod-status ${
                          item.stop.podSubmitted ? "attached" : "missing"
                        }`}
                      >
                        <i aria-hidden="true" />
                        {item.stop.podSubmitted ? "Submitted" : "Missing"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`pod-status ${
                          item.stop.supportingDocsComplete ? "attached" : "missing"
                        }`}
                      >
                        <i aria-hidden="true" />
                        {item.stop.supportingDocsComplete ? "Complete" : "Incomplete"}
                      </span>
                    </td>
                    <td>{item.stop.documentRef}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </section>
      </div>

      {inspectingStop ? (
        <div className="routex-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="doc-dialog-title">
          <div className="routex-dialog-backdrop" onClick={() => !docSubmitting && setInspectingStop(null)} />
          <div className="routex-dialog">
            <header className="routex-dialog-header">
              <div>
                <h2 id="doc-dialog-title">Proof of Delivery Review</h2>
                <p>
                  Stop #{inspectingStop.stop.sequence} · {inspectingStop.stop.storeName} ({inspectingStop.waybillNumber})
                </p>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                onClick={() => !docSubmitting && setInspectingStop(null)}
                aria-label="Close document dialog"
              >
                ×
              </button>
            </header>

            <div className="routex-dialog-body">
              {docActionError ? (
                <div className="delivery-form-alert" role="alert">
                  {docActionError}
                </div>
              ) : null}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "var(--glass-surface)", padding: "14px", borderRadius: "12px", fontSize: "12px" }}>
                <div><strong>Client:</strong> {inspectingStop.clientName}</div>
                <div><strong>Truck:</strong> {inspectingStop.plateNumber}</div>
                <div><strong>Delivery Date:</strong> {inspectingStop.deliveryDate}</div>
                <div><strong>Destination Area:</strong> {inspectingStop.stop.destinationArea}</div>
                <div>
                  <strong>POD Status:</strong>{" "}
                  <span className={`pod-status ${inspectingStop.stop.podSubmitted ? "attached" : "missing"}`}>
                    {inspectingStop.stop.podSubmitted ? "Submitted" : "Missing"}
                  </span>
                </div>
                <div>
                  <strong>Supporting Docs:</strong>{" "}
                  <span className={`pod-status ${inspectingStop.stop.supportingDocsComplete ? "attached" : "missing"}`}>
                    {inspectingStop.stop.supportingDocsComplete ? "Complete" : "Incomplete"}
                  </span>
                </div>
              </div>

              {docLoading ? (
                <div style={{ textAlign: "center", padding: "16px", color: "var(--color-text-muted)" }}>
                  Loading document information…
                </div>
              ) : (
                <div className="routex-dialog-field">
                  <label>Document Reference & Storage</label>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid var(--line)", borderRadius: "10px" }}>
                    <div>
                      <strong>{docDetail?.filename || inspectingStop.stop.documentRef || "No file attached"}</strong>
                      {docDetail?.notes ? (
                        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--color-text-muted)" }}>
                          Note: {docDetail.notes}
                        </p>
                      ) : null}
                    </div>
                    {docDetail?.downloadUrl ? (
                      <a
                        href={docDetail.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="secondary-button"
                        style={{ padding: "6px 12px", fontSize: "12px" }}
                      >
                        Download Document
                      </a>
                    ) : inspectingStop.stop.podSubmitted ? (
                      <span className="detail-status success">Stored Private</span>
                    ) : (
                      <span className="detail-status warning">Awaiting Upload</span>
                    )}
                  </div>
                </div>
              )}

              {canVerify ? (
                <>
                  <div className="routex-dialog-field">
                    <label htmlFor="pod-upload-input">Upload / Replace POD Document (PDF, PNG, JPG up to 10MB)</label>
                    <input
                      id="pod-upload-input"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files[0]) setUploadFile(files[0]);
                      }}
                    />
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="pod-review-notes">Review Notes / Rejection Reason</label>
                    <textarea
                      id="pod-review-notes"
                      rows={2}
                      placeholder="Add verification notes or rejection explanation (required if rejecting)"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: 0 }}>
                  You are viewing this record in view-only mode ({actor.roleLabel}). Document modifications require Operations or Admin privileges.
                </p>
              )}
            </div>

            <footer className="routex-dialog-footer">
              <button
                type="button"
                className="secondary-button"
                disabled={docSubmitting}
                onClick={() => setInspectingStop(null)}
              >
                Close
              </button>

              {canVerify ? (
                <>
                  {!inspectingStop.isComplete ? (
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ color: "var(--color-status-warning)" }}
                    disabled={docSubmitting || reviewNotes.trim().length < 5}
                    onClick={() => handleDocAction("reject")}
                    title={reviewNotes.trim().length < 5 ? "Rejection requires at least 5 characters of notes" : "Reject document"}
                  >
                    Reject
                  </button>
                  ) : null}
                  {uploadFile ? (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={docSubmitting}
                      onClick={() => handleDocAction("upload")}
                      title="Upload or replace the proof of delivery document"
                    >
                      {docSubmitting ? "Uploading…" : "Upload"}
                    </button>
                  ) : null}
                  {inspectingStop.isComplete ? (
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ color: "#b91c1c" }}
                      disabled={docSubmitting || updatingStopId === inspectingStop.stop.id}
                      onClick={async () => {
                        const updated = await toggleStopVerification(inspectingStop);
                        if (updated) setInspectingStop(null);
                      }}
                      title="Mark this POD and its supporting documents as unverified"
                    >
                      {updatingStopId === inspectingStop.stop.id ? "Updating…" : "Unverify POD"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-action-button"
                      disabled={docSubmitting}
                      onClick={() => handleDocAction("verify")}
                      title="Verify the POD and approve its supporting documents as complete"
                    >
                      {docSubmitting ? "Verifying…" : "Approve POD"}
                    </button>
                  )}
                </>
              ) : null}
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

