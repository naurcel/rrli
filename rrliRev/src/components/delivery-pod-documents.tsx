"use client";

import { useState } from "react";

import {
  derivePodVerificationStatus,
  type DeliveryStoreDropoff,
  type DeliveryTripRecord,
} from "@/features/deliveries/delivery-domain";
import { BROWSER_PREVIEW_DELIVERIES_CHANGED } from "@/features/deliveries/browser-preview-deliveries";

type DocumentDetail = {
  filename?: string;
  status?: string;
  notes?: string | null;
  downloadUrl?: string | null;
};

export function DeliveryPodDocuments({
  trip,
  canVerify,
  roleLabel,
  onTripChange,
}: {
  trip: DeliveryTripRecord;
  canVerify: boolean;
  roleLabel: string;
  onTripChange: (trip: DeliveryTripRecord) => void;
}) {
  const [selectedStop, setSelectedStop] = useState<DeliveryStoreDropoff | null>(null);
  const [documentDetail, setDocumentDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  async function openDocument(stop: DeliveryStoreDropoff) {
    setSelectedStop(stop);
    setDocumentDetail(null);
    setUploadFile(null);
    setReviewNotes("");
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/deliveries/documents?deliveryId=${trip.id}&dropoffId=${stop.id}`,
      );
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        document?: DocumentDetail;
      } | null;
      if (response.ok && payload?.ok && payload.document) {
        setDocumentDetail(payload.document);
        setReviewNotes(payload.document.notes ?? "");
      }
    } catch {
      // The stop-level record still provides a useful fallback when no document row exists.
    } finally {
      setLoading(false);
    }
  }

  function updateStop(
    stopId: string,
    changes: Partial<DeliveryStoreDropoff>,
    version = trip.version + 1,
  ) {
    const nextDropoffs = trip.dropoffs.map((stop) =>
      stop.id === stopId ? { ...stop, ...changes } : stop,
    );
    onTripChange({
      ...trip,
      version,
      dropoffs: nextDropoffs,
      podStatus: derivePodVerificationStatus(nextDropoffs),
    });
    window.dispatchEvent(new Event(BROWSER_PREVIEW_DELIVERIES_CHANGED));
  }

  async function submitDocumentAction(action: "upload" | "verify" | "reject") {
    if (!selectedStop || submitting) return;
    if (action === "reject" && reviewNotes.trim().length < 5) {
      setError("Add a rejection reason of at least 5 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.append("deliveryId", trip.id);
    formData.append("dropoffId", selectedStop.id);
    formData.append("action", action);
    formData.append("notes", reviewNotes.trim());
    if (uploadFile) formData.append("file", uploadFile);

    try {
      const response = await fetch("/api/deliveries/documents", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        document?: { filename?: string };
        dropoff?: {
          podSubmitted?: boolean;
          supportingDocsComplete?: boolean;
          documentRef?: string;
        };
      } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? "Unable to update the POD document.");
      }

      updateStop(selectedStop.id, {
        podSubmitted: payload.dropoff?.podSubmitted ?? action !== "reject",
        supportingDocsComplete: payload.dropoff?.supportingDocsComplete ?? action === "verify",
        documentRef:
          payload.dropoff?.documentRef ??
          uploadFile?.name ??
          payload.document?.filename ??
          selectedStop.documentRef,
      });
      setSelectedStop(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update the POD document.");
    } finally {
      setSubmitting(false);
    }
  }

  async function unverifyDocument() {
    if (!selectedStop || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/deliveries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update_pod",
          deliveryId: trip.id,
          dropoffId: selectedStop.id,
          expectedVersion: trip.version,
          podSubmitted: false,
          supportingDocsComplete: false,
          documentRef: selectedStop.documentRef,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        result?: { version?: number };
      } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? "Unable to unverify the POD document.");
      }
      updateStop(
        selectedStop.id,
        { podSubmitted: false, supportingDocsComplete: false },
        payload.result?.version ?? trip.version + 1,
      );
      setSelectedStop(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to unverify the POD document.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="delivery-pod-list">
        {trip.dropoffs.map((stop) => {
          const complete = stop.podSubmitted && stop.supportingDocsComplete;
          return (
            <button
              type="button"
              className="delivery-pod-item"
              key={stop.id}
              onClick={() => void openDocument(stop)}
            >
              <span className={`delivery-pod-state ${complete ? "complete" : "attention"}`} aria-hidden="true" />
              <span className="delivery-pod-copy">
                <strong>Stop #{stop.sequence} · {stop.storeName}</strong>
                <small>{stop.documentRef || "No document attached"}</small>
              </span>
              <span className={`detail-status ${complete ? "success" : "warning"}`}>
                {complete ? "Verified" : stop.podSubmitted ? "Needs review" : "Missing"}
              </span>
              <b aria-hidden="true">›</b>
            </button>
          );
        })}
      </div>

      {selectedStop ? (
        <div className="routex-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="delivery-pod-dialog-title">
          <div className="routex-dialog-backdrop" onClick={() => !submitting && setSelectedStop(null)} />
          <div className="routex-dialog delivery-pod-dialog">
            <header className="routex-dialog-header">
              <div>
                <h2 id="delivery-pod-dialog-title">POD &amp; Supporting Documents</h2>
                <p>Stop #{selectedStop.sequence} · {selectedStop.storeName} · {trip.waybillNumber}</p>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                disabled={submitting}
                onClick={() => setSelectedStop(null)}
                aria-label="Close document details"
              >
                &times;
              </button>
            </header>

            <div className="routex-dialog-body">
              {error ? <div className="delivery-form-alert" role="alert">{error}</div> : null}

              <div className="delivery-pod-summary">
                <div><span>Client</span><strong>{trip.clientName}</strong></div>
                <div><span>Truck</span><strong>{trip.plateNumber}</strong></div>
                <div><span>Destination</span><strong>{selectedStop.destinationArea}</strong></div>
                <div><span>Status</span><strong>{selectedStop.podSubmitted && selectedStop.supportingDocsComplete ? "Verified" : "Needs follow-up"}</strong></div>
              </div>

              <div className="routex-dialog-field">
                <label>Document reference</label>
                <div className="delivery-pod-reference">
                  <div>
                    <strong>{documentDetail?.filename || selectedStop.documentRef || "No file attached"}</strong>
                    {documentDetail?.notes ? <small>{documentDetail.notes}</small> : null}
                  </div>
                  {loading ? (
                    <span className="detail-status warning">Loading</span>
                  ) : documentDetail?.downloadUrl ? (
                    <a className="secondary-button" href={documentDetail.downloadUrl} target="_blank" rel="noreferrer">
                      View file
                    </a>
                  ) : (
                    <span className={`detail-status ${selectedStop.podSubmitted ? "success" : "warning"}`}>
                      {selectedStop.podSubmitted ? "Stored private" : "Awaiting upload"}
                    </span>
                  )}
                </div>
              </div>

              {canVerify ? (
                <>
                  <div className="routex-dialog-field">
                    <label htmlFor={`pod-upload-${selectedStop.id}`}>Upload or replace file</label>
                    <input
                      id={`pod-upload-${selectedStop.id}`}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                    />
                    <small>PDF, PNG, or JPG up to 10MB.</small>
                  </div>
                  <div className="routex-dialog-field">
                    <label htmlFor={`pod-notes-${selectedStop.id}`}>Review notes</label>
                    <textarea
                      id={`pod-notes-${selectedStop.id}`}
                      value={reviewNotes}
                      onChange={(event) => setReviewNotes(event.target.value)}
                      placeholder="Add verification notes or a rejection reason"
                    />
                  </div>
                </>
              ) : (
                <p className="delivery-pod-view-only">
                  View-only access for {roleLabel}. Operations or Admin permission is required to modify documents.
                </p>
              )}
            </div>

            <footer className="routex-dialog-footer">
              <button type="button" className="secondary-button" disabled={submitting} onClick={() => setSelectedStop(null)}>
                Close
              </button>
              {canVerify ? (
                <>
                  {selectedStop.podSubmitted && selectedStop.supportingDocsComplete ? (
                    <button type="button" className="secondary-button" disabled={submitting} onClick={() => void unverifyDocument()}>
                      {submitting ? "Updating…" : "Unverify"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={submitting || reviewNotes.trim().length < 5}
                      onClick={() => void submitDocumentAction("reject")}
                    >
                      Reject
                    </button>
                  )}
                  {uploadFile ? (
                    <button type="button" className="secondary-button" disabled={submitting} onClick={() => void submitDocumentAction("upload")}>
                      {submitting ? "Uploading…" : "Upload"}
                    </button>
                  ) : null}
                  {!(selectedStop.podSubmitted && selectedStop.supportingDocsComplete) ? (
                    <button type="button" className="primary-action-button" disabled={submitting} onClick={() => void submitDocumentAction("verify")}>
                      {submitting ? "Approving…" : "Approve POD"}
                    </button>
                  ) : null}
                </>
              ) : null}
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
