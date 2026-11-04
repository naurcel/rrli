"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { derivePodVerificationStatus, type DeliveryStoreDropoff, type DeliveryTripRecord } from "@/features/deliveries/delivery-domain";
import { BROWSER_PREVIEW_DELIVERIES_CHANGED } from "@/features/deliveries/browser-preview-deliveries";

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
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  async function openDocument(stop: DeliveryStoreDropoff) {
    setSelectedStop(stop);
    setDocumentDetail(null);
    setUploadFile(null);
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/deliveries/documents?deliveryId=${trip.id}&dropoffId=${stop.id}`);
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; document?: DocumentDetail } | null;
      if (response.ok && payload?.ok && payload.document) setDocumentDetail(payload.document);
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
        document?: { filename?: string };
        dropoff?: Partial<DeliveryStoreDropoff>;
      } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "Unable to upload the POD document.");
      updateStop(selectedStop.id, {
        podSubmitted: true,
        supportingDocsComplete: payload.dropoff?.supportingDocsComplete ?? selectedStop.supportingDocsComplete,
        documentRef: payload.dropoff?.documentRef ?? payload.document?.filename ?? uploadFile.name,
      });
      setSelectedStop(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload the POD document.");
    } finally {
      setSubmitting(false);
    }
  }

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
          <div className="delivery-pod-summary">
            <div><span>Client</span><strong>{trip.clientName}</strong></div>
            <div><span>Truck</span><strong>{trip.plateNumber}</strong></div>
            <div><span>Destination</span><strong>{selectedStop.destinationArea}</strong></div>
            <div><span>POD</span><strong>{selectedStop.podSubmitted ? "Attached" : "Missing"}</strong></div>
          </div>

          <section className="delivery-document-viewer">
            <div><span>Proof of delivery</span><strong>{documentDetail?.filename || selectedStop.documentRef || "No file attached"}</strong></div>
            {loading ? <span className="detail-status warning">Loading</span> : null}
            {!loading && documentDetail?.downloadUrl ? (/\.(png|jpe?g)$/i.test(documentDetail.filename ?? "")
              ? <img src={documentDetail.downloadUrl} alt={`POD for ${selectedStop.storeName}`} />
              : <iframe title={`POD for ${selectedStop.storeName}`} src={documentDetail.downloadUrl} />) : null}
            {!loading && !documentDetail?.downloadUrl ? <p>Private file preview is unavailable in local mode.</p> : null}
            {documentDetail?.downloadUrl ? <a className="secondary-button" href={documentDetail.downloadUrl} target="_blank" rel="noreferrer">Open file</a> : null}
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
        </div>

        <footer className="routex-dialog-footer">
          <button type="button" className="secondary-button" disabled={submitting} onClick={() => setSelectedStop(null)}>Close</button>
          {canManage ? <button type="button" className="primary-action-button" disabled={submitting || !uploadFile} onClick={() => void uploadDocument()}>{submitting ? "Uploading…" : selectedStop.podSubmitted ? "Replace POD" : "Upload POD"}</button> : null}
        </footer>
      </div>
    </div>, document.body) : null;

  return <>
    <div className="delivery-pod-list">
      {trip.dropoffs.map((stop) => <button type="button" className="delivery-pod-item" key={stop.id} onClick={() => void openDocument(stop)}>
        <span className={`delivery-pod-state ${stop.podSubmitted ? "complete" : "attention"}`} aria-hidden="true" />
        <span className="delivery-pod-copy"><strong>Stop #{stop.sequence} · {stop.storeName}</strong><small>{stop.documentRef || "No document attached"}</small></span>
        <span className={`detail-status ${stop.podSubmitted ? "success" : "warning"}`}>{stop.podSubmitted ? "Attached" : "Missing"}</span>
        <b aria-hidden="true">›</b>
      </button>)}
    </div>
    {dialog}
  </>;
}
