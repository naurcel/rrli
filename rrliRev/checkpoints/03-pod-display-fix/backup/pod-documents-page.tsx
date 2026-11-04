"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  isDateInRange,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import { canManageDocuments } from "@/lib/auth/rbac";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function PodDocumentsPage() {
  const actor = useAuthenticatedActor();
  const { range } = useGlobalDateRange();
  const canManage = canManageDocuments(actor.role);

  const [deliveries, setDeliveries] = useState<readonly DeliveryLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("All Drop-offs");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  // Modal inspection state
  const [inspectingStop, setInspectingStop] = useState<{
    tripId: string;
    waybillNumber: string;
    deliveryDate: string;
    clientName: string;
    plateNumber: string;
    version: number;
    stop: DeliveryLedgerItem["dropoffs"][number];
    hasPod: boolean;
  } | null>(null);

  const [docDetail, setDocDetail] = useState<{
    id?: string;
    filename?: string;
    status?: string;
    downloadUrl?: string | null;
    isMock?: boolean;
  } | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docActionError, setDocActionError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
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
        hasPod: Boolean(stop.podSubmitted && stop.documentRef && stop.documentRef !== "Pending upload"),
      })),
    );
  }, [dateFilteredDeliveries]);

  const filteredStops = useMemo(() => {
    if (filterStatus === "POD Attached") {
      return flattenedStops.filter((item) => item.hasPod);
    }
    if (filterStatus === "Missing POD") {
      return flattenedStops.filter((item) => !item.hasPod);
    }
    return flattenedStops;
  }, [flattenedStops, filterStatus]);

  const counts = useMemo(() => {
    const attached = flattenedStops.filter((item) => item.hasPod).length;
    const missing = flattenedStops.length - attached;
    return { total: flattenedStops.length, attached, missing };
  }, [flattenedStops]);

  async function openDocModal(item: (typeof flattenedStops)[number]) {
    setInspectingStop(item);
    setDocDetail(null);
    setDocActionError(null);
    setUploadFile(null);
    setDocLoading(true);

    try {
      const res = await fetch(`/api/deliveries/documents?deliveryId=${item.tripId}&dropoffId=${item.stop.id}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setDocDetail(data.document);
      }
    } catch {
      // Ignored if document record doesn't exist yet
    } finally {
      setDocLoading(false);
    }
  }

  async function handleUploadDocument() {
    if (!inspectingStop || !uploadFile || docSubmitting) return;

    setDocSubmitting(true);
    setDocActionError(null);

    const formData = new FormData();
    formData.append("deliveryId", inspectingStop.tripId);
    formData.append("dropoffId", inspectingStop.stop.id);
    formData.append("action", "upload");
    formData.append("file", uploadFile);

    try {
      const res = await fetch("/api/deliveries/documents", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Failed to upload document.");
      }

      const docRef = uploadFile.name;

      setDeliveries((current) =>
        current.map((trip) =>
          trip.id === inspectingStop.tripId
            ? (() => {
                const nextDropoffs = trip.dropoffs.map((stop) =>
                  stop.id === inspectingStop.stop.id
                    ? {
                        ...stop,
                        podSubmitted: true,
                        supportingDocsComplete: true,
                        documentRef: docRef,
                      }
                    : stop,
                );
                return {
                  ...trip,
                  version: trip.version + 1,
                  dropoffs: nextDropoffs,
                };
              })()
            : trip,
        ),
      );

      setFeedback({
        tone: "success",
        text: `Uploaded POD document for ${inspectingStop.stop.storeName} (${inspectingStop.waybillNumber}).`,
      });
      setInspectingStop(null);
    } catch (err) {
      setDocActionError(err instanceof Error ? err.message : "Error uploading document.");
    } finally {
      setDocSubmitting(false);
    }
  }

  return (
    <>
      <OperationalTopbar contextLabel="POD & Supporting Documents" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <h1>POD & Supporting Documents</h1>
            <p className="subtitle">
              View and manage proof of delivery documents by store drop-off.
            </p>
          </div>
          {canManage ? (
            <span className="access-pill operations">
              Document Management ({actor.roleLabel})
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
                {feedback.tone === "error" ? "Error:" : "Document Saved:"}
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

        <section className="stat-grid" aria-label="POD document totals">
          <article className="stat-card">
            <span className="stat-label">TOTAL STORE DROP-OFFS</span>
            <strong>{counts.total}</strong>
            <span className="stat-meta">Across {deliveries.length} completed deliveries</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">POD ATTACHED</span>
            <strong>{counts.attached}</strong>
            <span className="stat-meta positive">Document stored &amp; accessible</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">MISSING POD</span>
            <strong>{counts.missing}</strong>
            <span className={`stat-meta ${counts.missing > 0 ? "warning" : "positive"}`}>
              {counts.missing > 0
                ? "Awaiting document upload"
                : "All drop-offs have documents attached"}
            </span>
          </article>
        </section>

        <section className={`records-card${loading ? " is-loading" : ""}`} aria-label="Store POD document repository">
          <div className="records-heading">
            <div>
              <h2>Store-Level Document Repository</h2>
              <p>Select any store drop-off to view, download, or upload documents.</p>
            </div>
            <RoundedSelect
              value={filterStatus}
              options={["All Drop-offs", "POD Attached", "Missing POD"]}
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
              <strong>Loading documents…</strong>
              <span>Retrieving completed deliveries and store-level document attachments.</span>
            </div>
          ) : filteredStops.length === 0 ? (
            <div className="empty-state">
              <strong>No drop-offs match this view</strong>
              <span>Change the document filter or selected date range.</span>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waybill & Date</th>
                    <th>Client</th>
                    <th>Truck</th>
                    <th>Stop # & Store Name</th>
                    <th>POD Status</th>
                    <th>Document Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStops.map((item) => (
                    <tr
                      key={item.stop.id}
                      className="record-row"
                      tabIndex={0}
                      aria-label={`View POD for ${item.stop.storeName}, ${item.waybillNumber}`}
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
                            item.hasPod ? "attached" : "missing"
                          }`}
                        >
                          <i aria-hidden="true" />
                          {item.hasPod ? "Attached" : "Missing"}
                        </span>
                      </td>
                      <td>{item.stop.documentRef || "Pending upload"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {inspectingStop ? (
        <div className="routex-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="doc-dialog-title">
          <div className="routex-dialog-backdrop" onClick={() => !docSubmitting && setInspectingStop(null)} />
          <div className="routex-dialog">
            <header className="routex-dialog-header">
              <div>
                <h2 id="doc-dialog-title">Proof of Delivery Document</h2>
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
                <div style={{ gridColumn: "1 / -1" }}>
                  <strong>POD Status:</strong>{" "}
                  <span className={`pod-status ${inspectingStop.hasPod ? "attached" : "missing"}`}>
                    <i aria-hidden="true" />
                    {inspectingStop.hasPod ? "Attached" : "Missing"}
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
                    ) : inspectingStop.hasPod ? (
                      <span className="detail-status success">Stored Private</span>
                    ) : (
                      <span className="detail-status warning">Awaiting Upload</span>
                    )}
                  </div>
                </div>
              )}

              {canManage ? (
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
              ) : (
                <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: 0 }}>
                  You are viewing this record in view-only mode ({actor.roleLabel}). Document uploads require Operations or Admin privileges.
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

              {canManage && uploadFile ? (
                <button
                  type="button"
                  className="primary-action-button"
                  disabled={docSubmitting}
                  onClick={handleUploadDocument}
                  title="Upload or replace the proof of delivery document"
                >
                  {docSubmitting ? "Uploading…" : "Upload Document"}
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
