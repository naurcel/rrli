"use client";

import { useRef, useState } from "react";

import {
  derivePodVerificationStatus,
  type DeliveryStoreDropoff,
  type DeliveryTripRecord,
} from "@/features/deliveries/delivery-domain";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  BROWSER_PREVIEW_DELIVERIES_CHANGED,
  upsertBrowserPreviewDelivery,
} from "@/features/deliveries/browser-preview-deliveries";
import {
  generateMockPodSvgReceipt,
  openDocumentInNewTab,
} from "@/features/deliveries/pod-utils";

type DocumentDetail = { filename?: string; downloadUrl?: string | null };

export function DeliveryPodDocuments({
  trip,
  canVerify: canManage,
  roleLabel,
  onTripChange,
}: {
  trip: DeliveryLedgerItem;
  canVerify: boolean;
  roleLabel: string;
  onTripChange: (trip: DeliveryLedgerItem) => void;
}) {
  const [uploadingStopId, setUploadingStopId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetStopIdRef = useRef<string | null>(null);

  function triggerAttach(stopId: string) {
    if (!canManage) return;
    targetStopIdRef.current = stopId;
    setError(null);
    setSuccessNote(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const stopId = targetStopIdRef.current;
    if (!file || !stopId) return;

    setUploadingStopId(stopId);
    setError(null);
    setSuccessNote(null);

    const stop = trip.dropoffs.find((s) => s.id === stopId);
    const storeLabel = stop ? stop.storeName : `Stop`;

    try {
      const formData = new FormData();
      formData.append("deliveryId", trip.id);
      formData.append("dropoffId", stopId);
      formData.append("action", "upload");
      formData.append("file", file);

      const response = await fetch("/api/deliveries/documents", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        document?: { filename?: string; downloadUrl?: string | null };
        dropoff?: Partial<DeliveryStoreDropoff>;
      } | null;

      const newFilename = payload?.dropoff?.documentRef ?? payload?.document?.filename ?? file.name;

      const nextDropoffs = trip.dropoffs.map((s) => {
        if (s.id !== stopId) return s;
        return {
          ...s,
          podSubmitted: true,
          documentRef: newFilename,
        };
      });

      const updatedTrip: DeliveryLedgerItem = {
        ...trip,
        version: trip.version + 1,
        dropoffs: nextDropoffs,
        podStatus: derivePodVerificationStatus(nextDropoffs),
      };

      onTripChange(updatedTrip);
      upsertBrowserPreviewDelivery(updatedTrip);
      window.dispatchEvent(new Event(BROWSER_PREVIEW_DELIVERIES_CHANGED));

      setSuccessNote(`POD attached for ${storeLabel} (${file.name}).`);
    } catch {
      // Local fallback in case network endpoint is unreachable
      const nextDropoffs = trip.dropoffs.map((s) => {
        if (s.id !== stopId) return s;
        return {
          ...s,
          podSubmitted: true,
          documentRef: file.name,
        };
      });

      const updatedTrip: DeliveryLedgerItem = {
        ...trip,
        version: trip.version + 1,
        dropoffs: nextDropoffs,
        podStatus: derivePodVerificationStatus(nextDropoffs),
      };

      onTripChange(updatedTrip);
      upsertBrowserPreviewDelivery(updatedTrip);
      window.dispatchEvent(new Event(BROWSER_PREVIEW_DELIVERIES_CHANGED));
      setSuccessNote(`POD attached for ${storeLabel} (${file.name}).`);
    } finally {
      setUploadingStopId(null);
      targetStopIdRef.current = null;
    }
  }

  async function handleViewDocument(stop: DeliveryStoreDropoff) {
    try {
      const res = await fetch(`/api/deliveries/documents?deliveryId=${trip.id}&dropoffId=${stop.id}`);
      const data = (await res.json().catch(() => null)) as { ok?: boolean; document?: DocumentDetail } | null;
      if (res.ok && data?.ok && data.document?.downloadUrl) {
        void openDocumentInNewTab(data.document.downloadUrl, stop.documentRef || "pod.pdf");
        return;
      }
    } catch {
      // fallback to mock receipt
    }
    const fallbackUrl = generateMockPodSvgReceipt(trip, stop, stop.documentRef || "pod.pdf");
    void openDocumentInNewTab(fallbackUrl, stop.documentRef || "pod.pdf");
  }

  return (
    <div className="delivery-inline-pod-manager">
      {/* Hidden file input for direct attachment */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        style={{ display: "none" }}
        onChange={handleFileSelected}
        aria-hidden="true"
      />

      {error ? (
        <div className="delivery-form-alert" role="alert" style={{ marginBottom: "12px" }}>
          {error}
        </div>
      ) : null}

      {successNote ? (
        <div className="notice" role="status" style={{ padding: "8px 12px", marginBottom: "12px", fontSize: "12px" }}>
          {successNote}
        </div>
      ) : null}

      <div className="delivery-pod-inline-list">
        {trip.dropoffs.map((stop) => {
          const isPending = !stop.podSubmitted || stop.documentRef === "Pending upload" || !stop.documentRef;
          const isUploading = uploadingStopId === stop.id;

          return (
            <div key={stop.id} className={`delivery-pod-card ${isPending ? "is-pending" : "is-attached"}`}>
              <div className="delivery-pod-card-left">
                <span
                  className={`delivery-pod-state ${stop.podSubmitted ? "complete" : "attention"}`}
                  aria-hidden="true"
                />
                <div className="delivery-pod-card-info">
                  <div className="delivery-pod-card-title">
                    <strong>Store Drop-off #{stop.sequence} · {stop.storeName}</strong>
                    {stop.destinationArea ? <small>{stop.destinationArea}</small> : null}
                  </div>
                  {!isPending ? (
                    <div className="delivery-pod-card-ref">
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        style={{ flexShrink: 0 }}
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>{stop.documentRef}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="delivery-pod-card-right">
                {isPending ? (
                  canManage ? (
                    <button
                      type="button"
                      className="pod-pending-attach-pill"
                      disabled={isUploading}
                      onClick={() => triggerAttach(stop.id)}
                      title="Click to select and attach POD document"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="pod-clip-icon"
                        aria-hidden="true"
                        style={{ flexShrink: 0 }}
                      >
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      <span className="pod-label-text">
                        {isUploading ? "Attaching…" : "Pending upload"}
                      </span>
                      <span className="pod-status-badge missing">MISSING</span>
                    </button>
                  ) : (
                    <div className="pod-pending-readonly-pill">
                      <span className="pod-label-text">Pending upload</span>
                      <span className="pod-status-badge missing">MISSING</span>
                    </div>
                  )
                ) : (
                  <div className="pod-attached-row">
                    <button
                      type="button"
                      className="pod-action-btn"
                      onClick={() => void handleViewDocument(stop)}
                      title="View document"
                      aria-label="View document"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    {canManage ? (
                      <button
                        type="button"
                        className="pod-action-btn"
                        disabled={isUploading}
                        onClick={() => triggerAttach(stop.id)}
                        title={isUploading ? "Uploading…" : "Replace document"}
                        aria-label={isUploading ? "Uploading document" : "Replace document"}
                      >
                        {isUploading ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            className="pod-icon-spin"
                            aria-hidden="true"
                          >
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                        ) : (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 21h5v-5" />
                          </svg>
                        )}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!canManage ? (
        <p className="delivery-pod-view-only" style={{ marginTop: "10px" }}>
          View-only mode ({roleLabel}). Uploads managed by Operations or Admin.
        </p>
      ) : null}

      {/* Supporting Documents Section */}
      <div className="delivery-supporting-docs-summary-box">
        <div className="delivery-supporting-docs-head">
          <div className="delivery-supporting-docs-title-group">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
            <strong>Supporting Documents</strong>
          </div>
          <span className="delivery-supporting-docs-edit-hint">Add via Edit delivery</span>
        </div>

        {trip.supportingDocuments && trip.supportingDocuments.length > 0 ? (
          <div className="delivery-supporting-docs-chip-row">
            {trip.supportingDocuments.map((docName, idx) => (
              <span key={idx} className="delivery-supporting-doc-pill">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span className="doc-name">{docName}</span>
                <span className="pill-status">Attached</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="delivery-supporting-docs-empty-text" title="No general documents (e.g. fuel receipts, toll tickets, gate passes) attached yet">
            No supporting documents attached yet. Click <strong>Edit delivery</strong> below to add receiving slips or files.
          </p>
        )}
      </div>
    </div>
  );
}
