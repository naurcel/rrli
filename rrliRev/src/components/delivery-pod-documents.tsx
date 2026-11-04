"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { derivePodVerificationStatus, type DeliveryStoreDropoff, type DeliveryTripRecord } from "@/features/deliveries/delivery-domain";
import { BROWSER_PREVIEW_DELIVERIES_CHANGED } from "@/features/deliveries/browser-preview-deliveries";
import { isImageDocument, openDocumentInNewTab, triggerDocumentDownload } from "@/features/deliveries/pod-utils";

type DocumentDetail = { filename?: string; downloadUrl?: string | null };

export function DeliveryPodDocuments({ trip, canVerify: canManage, roleLabel, onTripChange }: {
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
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  async function openDocument(stop: DeliveryStoreDropoff) {
    setSelectedStop(stop);
    setDocumentDetail(null);
    setUploadFile(null);
    setError(null);
    setSuccessNote(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/deliveries/documents?deliveryId=${trip.id}&dropoffId=${stop.id}`);
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; document?: DocumentDetail } | null;
      if (response.ok && payload?.ok && payload.document) setDocumentDetail(payload.document);
      if (response.ok && payload?.ok && payload.document) {
        setDocumentDetail(payload.document);
      }
    } catch {
      // Stop-level metadata remains usable when private storage is unavailable.
    } finally {
      setLoading(false);
    }
  }

  function updateStop(stopId: string, changes: Partial<DeliveryStoreDropoff>) {
    const nextDropoffs = trip.dropoffs.map((stop) => stop.id === stopId ? { ...stop, ...changes } : stop);
    onTripChange({ ...trip, version: trip.version + 1, dropoffs: nextDropoffs, podStatus: derivePodVerificationStatus(nextDropoffs) });
    window.dispatchEvent(new Event(BROWSER_PREVIEW_DELIVERIES_CHANGED));
  }

  async function uploadDocument() {
    if (!selectedStop || !uploadFile || submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccessNote(null);
    const formData = new FormData();
    formData.append("deliveryId", trip.id);
    formData.append("dropoffId", selectedStop.id);
    formData.append("action", "upload");
    formData.append("file", uploadFile);
    try {
      const response = await fetch("/api/deliveries/documents", { method: "POST", body: formData });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        document?: { filename?: string; downloadUrl?: string | null };
        dropoff?: Partial<DeliveryStoreDropoff>;
      } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "Unable to upload the POD document.");
      
      const newFilename = payload.dropoff?.documentRef ?? payload.document?.filename ?? uploadFile.name;
      const updatedStop: DeliveryStoreDropoff = {
        ...selectedStop,
        podSubmitted: true,
        supportingDocsComplete: payload.dropoff?.supportingDocsComplete ?? selectedStop.supportingDocsComplete,
        documentRef: newFilename,
      };

      updateStop(selectedStop.id, {
        podSubmitted: true,
        supportingDocsComplete: updatedStop.supportingDocsComplete,
        documentRef: newFilename,
      });

      setSelectedStop(updatedStop);
      setSuccessNote(`Document successfully uploaded and saved for ${selectedStop.storeName}.`);
      setUploadFile(null);

      if (payload.document?.downloadUrl) {
        setDocumentDetail({
          filename: newFilename,
          downloadUrl: payload.document.downloadUrl,
        });
      } else {
        // Refresh document details
        const getRes = await fetch(`/api/deliveries/documents?deliveryId=${trip.id}&dropoffId=${selectedStop.id}`);
        const getData = (await getRes.json().catch(() => null)) as { ok?: boolean; document?: DocumentDetail } | null;
        if (getRes.ok && getData?.ok && getData.document) {
          setDocumentDetail(getData.document);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload the POD document.");
    } finally {
      setSubmitting(false);
    }
  }

  const activeFilename = documentDetail?.filename || selectedStop?.documentRef || "No file attached";
  const hasPreview = Boolean(!loading && documentDetail?.downloadUrl);
  const isImage = isImageDocument(documentDetail?.downloadUrl, activeFilename);

  const dialog = selectedStop && typeof document !== "undefined" ? createPortal(
    <div className="routex-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="delivery-pod-dialog-title">
      <div className="routex-dialog-backdrop" onClick={() => !submitting && setSelectedStop(null)} />
      <div className="routex-dialog delivery-pod-dialog">
        <header className="routex-dialog-header">
          <div>
            <h2 id="delivery-pod-dialog-title">POD &amp; Supporting Documents</h2>
            <p>Stop #{selectedStop.sequence} · {selectedStop.storeName} · {trip.waybillNumber}</p>
          </div>
          <button type="button" className="routex-dialog-close" disabled={submitting} onClick={() => setSelectedStop(null)} aria-label="Close document details">&times;</button>
        </header>

        <div className="routex-dialog-body">
          {error ? <div className="delivery-form-alert" role="alert">{error}</div> : null}
          {successNote ? <div className="notice" role="status" style={{ padding: "10px 14px", marginBottom: "12px" }}>{successNote}</div> : null}
          
          <div className="delivery-pod-summary">
            <div><span>Client</span><strong>{trip.clientName}</strong></div>
            <div><span>Truck</span><strong>{trip.plateNumber}</strong></div>
            <div><span>Destination</span><strong>{selectedStop.destinationArea}</strong></div>
            <div><span>POD</span><strong>{selectedStop.podSubmitted ? "Attached" : "Missing"}</strong></div>
            <div>
              <span>POD Status</span>
              <span className={`pod-status ${selectedStop.podSubmitted ? "attached" : "missing"}`} style={{ display: "inline-flex", width: "fit-content" }}>
                <i aria-hidden="true" />
                {selectedStop.podSubmitted ? "Attached" : "Missing"}
              </span>
            </div>
          </div>

          <section className="delivery-document-viewer" aria-label="Proof of delivery document view">
            <div className="delivery-document-viewer-header">
              <div>
                <span>Proof of delivery document</span>
                <strong>{activeFilename}</strong>
              </div>
              {selectedStop.podSubmitted ? (
                <span className="detail-status success">Attached</span>
              ) : (
                <span className="detail-status warning">Missing</span>
              )}
            </div>

            {loading ? (
              <div className="pod-preview-loading" role="status">
                <span className="detail-status warning">Loading document preview…</span>
              </div>
            ) : null}

            {!loading && !selectedStop.podSubmitted ? (
              <div className="pod-empty-display" role="status">
                <div className="pod-empty-icon" aria-hidden="true">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <div className="pod-empty-content">
                  <h4>No Proof of Delivery Attached</h4>
                  <p>No document has been uploaded for stop #{selectedStop.sequence} ({selectedStop.storeName}).</p>
                  {canManage ? (
                    <span className="pod-empty-hint">Use the form below to upload a scanned receipt or signed document.</span>
                  ) : (
                    <span className="pod-empty-hint">Awaiting document upload by Operations or Admin staff.</span>
                  )}
                </div>
              </div>
            ) : null}

            {!loading && selectedStop.podSubmitted && hasPreview ? (
              <div className="pod-preview-viewport">
                {isImage ? (
                  <img
                    src={documentDetail!.downloadUrl!}
                    alt={`POD for ${selectedStop.storeName}`}
                    className="pod-preview-image"
                  />
                ) : (
                  <iframe
                    title={`POD for ${selectedStop.storeName}`}
                    src={documentDetail!.downloadUrl!}
                    className="pod-preview-iframe"
                  />
                )}
                <div className="pod-action-toolbar">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void openDocumentInNewTab(documentDetail!.downloadUrl!, activeFilename)}
                  >
                    <span aria-hidden="true">↗</span> Open in New Tab
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void triggerDocumentDownload(documentDetail!.downloadUrl!, activeFilename)}
                  >
                    <span aria-hidden="true">⤓</span> Download File
                  </button>
                </div>
              </div>
            ) : null}

            {!loading && selectedStop.podSubmitted && !hasPreview ? (
              <div className="pod-preview-fallback">
                <p>The document is marked as attached (<strong>{activeFilename}</strong>), but storage preview is currently unreachable.</p>
              </div>
            ) : null}
          </section>

          <details className="delivery-supporting-documents">
            <summary>Additional supporting documents</summary>
            <p>No separate supporting files are attached to this stop.</p>
          </details>

          {canManage ? <div className="routex-dialog-field">
            <label htmlFor={`pod-upload-${selectedStop.id}`}>Upload or replace POD</label>
            <input id={`pod-upload-${selectedStop.id}`} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            <small>PDF, PNG, or JPG up to 10 MB.</small>
          </div> : <p className="delivery-pod-view-only">{roleLabel} access can view and download documents.</p>}
          {canManage ? (
            <div className="routex-dialog-field">
              <label htmlFor={`pod-upload-${selectedStop.id}`}>
                {selectedStop.podSubmitted ? "Replace POD document" : "Upload POD document"}
              </label>
              <input
                id={`pod-upload-${selectedStop.id}`}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              />
              <small>PDF, PNG, or JPG up to 10 MB.</small>
              {uploadFile ? (
                <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--color-brand)" }}>
                  Selected file: <strong>{uploadFile.name}</strong> ({(uploadFile.size / 1024).toFixed(1)} KB)
                </div>
              ) : null}
            </div>
          ) : (
            <p className="delivery-pod-view-only">{roleLabel} access can view and download documents.</p>
          )}
        </div>

        <footer className="routex-dialog-footer">
          <button type="button" className="secondary-button" disabled={submitting} onClick={() => setSelectedStop(null)}>Close</button>
          {canManage && uploadFile ? (
            <button
              type="button"
              className="primary-action-button"
              disabled={submitting}
              onClick={() => void uploadDocument()}
            >
              {submitting ? "Uploading…" : selectedStop.podSubmitted ? "Replace POD" : "Upload POD"}
            </button>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className="delivery-pod-list">
        {trip.dropoffs.map((stop) => (
          <button type="button" className="delivery-pod-item" key={stop.id} onClick={() => void openDocument(stop)}>
            <span className={`delivery-pod-state ${stop.podSubmitted ? "complete" : "attention"}`} aria-hidden="true" />
            <span className="delivery-pod-copy">
              <strong>Stop #{stop.sequence} · {stop.storeName}</strong>
              <small>{stop.documentRef || "No document attached"}</small>
            </span>
            <span className={`detail-status ${stop.podSubmitted ? "success" : "warning"}`}>
              {stop.podSubmitted ? "Attached" : "Missing"}
            </span>
            <b aria-hidden="true">›</b>
          </button>
        ))}
      </div>
      {dialog}
    </>
  );
}
