"use client";

import { useRef } from "react";
import {
  type DeliveryStoreDropoff,
  normalizeSupportingDocument,
  type SupportingDocumentItem,
} from "@/features/deliveries/delivery-domain";

function formatEntryFee(amount: number | null, status?: string | null): string {
  if (status === "not_applicable") return "None";
  if (status === "unknown") return "Pending";
  if (amount == null || amount === 0) return "None";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function DeliveryDropoffTimeline({
  dropoffs,
  supportingDocuments,
  activeStopId,
  onHoverStop,
  onSelectStop,
  onViewPod,
  onAttachPod,
  canManage,
}: {
  dropoffs: readonly DeliveryStoreDropoff[];
  supportingDocuments?: readonly SupportingDocumentItem[];
  activeStopId?: string | null;
  onHoverStop?: (stopId: string | null) => void;
  onSelectStop?: (stop: DeliveryStoreDropoff) => void;
  onViewPod?: (stop: DeliveryStoreDropoff) => void;
  onAttachPod?: (stopId: string, file: File) => void;
  canManage?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetStopIdRef = useRef<string | null>(null);

  function triggerAttach(stopId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!canManage) return;
    targetStopIdRef.current = stopId;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const stopId = targetStopIdRef.current;
    if (!file || !stopId) return;
    onAttachPod?.(stopId, file);
    targetStopIdRef.current = null;
  }

  if (!dropoffs || dropoffs.length === 0) {
    return <p className="drawer-dropoff-empty">No drop-offs recorded for this delivery.</p>;
  }

  return (
    <div className="drawer-dropoff-timeline" aria-label="Drop-off stops sequence">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        style={{ display: "none" }}
        onChange={handleFileSelected}
        aria-hidden="true"
      />

      {dropoffs.map((stop, index) => {
        const isLast = index === dropoffs.length - 1;
        const stopNumber = stop.sequence || index + 1;
        const entryFee = formatEntryFee(stop.entryFee, stop.entryFeeStatus);
        const isHighlighted = Boolean(activeStopId && activeStopId === stop.id);
        const hasAttachedFile =
          stop.podSubmitted &&
          Boolean(stop.documentRef) &&
          stop.documentRef !== "Pending upload";
        const linkedDocs = (supportingDocuments ?? [])
          .map((doc, idx) => normalizeSupportingDocument(doc, idx))
          .filter((doc) => doc.dropoffId === stop.id);

        return (
          <div
            key={stop.id || `${stop.storeName}-${index}`}
            id={`dropoff-stop-${stop.id}`}
            className={`drawer-dropoff-item ${isLast ? "is-last" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
            onMouseEnter={() => onHoverStop?.(stop.id)}
            onMouseLeave={() => onHoverStop?.(null)}
            onClick={() => {
              onSelectStop?.(stop);
              if (stop.podSubmitted) {
                onViewPod?.(stop);
              }
            }}
            style={{ cursor: stop.podSubmitted || onSelectStop ? "pointer" : undefined }}
            title={stop.podSubmitted ? `Click to view POD for ${stop.storeName}` : undefined}
          >
            <div className="drawer-dropoff-node" aria-hidden="true">
              <span className="drawer-dropoff-number">{stopNumber}</span>
            </div>

            <div className="drawer-dropoff-card">
              <div className="drawer-dropoff-card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>Stop #{stopNumber}</strong>
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    · {stop.dropoffCount ?? 1} {(stop.dropoffCount ?? 1) === 1 ? "drop-off" : "drop-offs"}
                  </span>
                  {linkedDocs.length > 0 ? (
                    <span
                      style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "inline-flex", alignItems: "center", gap: "3px" }}
                      title={`Linked supporting documents: ${linkedDocs.map((d) => d.name).join(", ")}`}
                    >
                      · <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l7.9-7.9" />
                      </svg>
                      {linkedDocs.length} {linkedDocs.length === 1 ? "doc" : "docs"}
                    </span>
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {stop.podSubmitted ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        color: "var(--color-status-success, #059669)",
                      }}
                      title="Proof of delivery attached (click stop to preview)"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>POD Attached</span>
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        color: "var(--color-accent-deep, #b45309)",
                      }}
                      title="Proof of delivery document missing"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>Missing POD</span>
                    </span>
                  )}

                  {canManage ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={(e) => triggerAttach(stop.id, e)}
                      title={stop.podSubmitted ? "Replace POD document" : "Attach POD document"}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        padding: "2px 8px",
                        lineHeight: 1.4,
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      <span>{stop.podSubmitted ? "Replace" : "Attach"}</span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="drawer-dropoff-body">
                <strong className="drawer-dropoff-store">{stop.storeName}</strong>
                {stop.destinationArea ? (
                  <span className="drawer-dropoff-destination">{stop.destinationArea}</span>
                ) : null}
                {stop.notes ? (
                  <p className="drawer-dropoff-notes-text" title="Drop-off remarks">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span>{stop.notes}</span>
                  </p>
                ) : null}
              </div>

              <div className="drawer-dropoff-footer" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span className="drawer-dropoff-fee-label">Entry fee:</span>
                  <span className="drawer-dropoff-fee-val">
                    {entryFee}
                  </span>
                </div>
                {hasAttachedFile ? (
                  <button
                    type="button"
                    className="drawer-dropoff-linked-doc"
                    title={`Click to view POD: ${stop.documentRef}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewPod?.(stop);
                    }}
                    style={{ border: "none", cursor: "pointer", background: "none", padding: 0 }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>{stop.documentRef}</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

