"use client";

import type { DeliveryStoreDropoff } from "@/features/deliveries/delivery-domain";

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
  activeStopId,
  onHoverStop,
  onSelectStop,
}: {
  dropoffs: readonly DeliveryStoreDropoff[];
  activeStopId?: string | null;
  onHoverStop?: (stopId: string | null) => void;
  onSelectStop?: (stop: DeliveryStoreDropoff) => void;
}) {
  if (!dropoffs || dropoffs.length === 0) {
    return <p className="drawer-dropoff-empty">No drop-offs recorded for this delivery.</p>;
  }

  return (
    <div className="drawer-dropoff-timeline" aria-label="Drop-off stops sequence">
      {dropoffs.map((stop, index) => {
        const isLast = index === dropoffs.length - 1;
        const stopNumber = stop.sequence || index + 1;
        const entryFee = formatEntryFee(stop.entryFee, stop.entryFeeStatus);
        const isHighlighted = Boolean(activeStopId && activeStopId === stop.id);
        const hasAttachedFile =
          stop.podSubmitted &&
          Boolean(stop.documentRef) &&
          stop.documentRef !== "Pending upload";

        return (
          <div
            key={stop.id || `${stop.storeName}-${index}`}
            id={`dropoff-stop-${stop.id}`}
            className={`drawer-dropoff-item ${isLast ? "is-last" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
            onMouseEnter={() => onHoverStop?.(stop.id)}
            onMouseLeave={() => onHoverStop?.(null)}
            onClick={() => onSelectStop?.(stop)}
            style={{ cursor: onSelectStop ? "pointer" : undefined }}
          >
            <div className="drawer-dropoff-node" aria-hidden="true">
              <span className="drawer-dropoff-number">{stopNumber}</span>
            </div>

            <div className="drawer-dropoff-card">
              <div className="drawer-dropoff-card-header">
                <span className="drawer-dropoff-stop-tag">Stop #{stopNumber}</span>
                {stop.podSubmitted ? (
                  <span className="drawer-dropoff-doc-pill has-doc" title="POD attached" aria-label="POD attached">
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
                    <span>POD</span>
                  </span>
                ) : (
                  <span className="drawer-dropoff-doc-pill no-doc" title="Missing POD" aria-label="Missing POD">
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
              </div>

              <div className="drawer-dropoff-body">
                <strong className="drawer-dropoff-store">{stop.storeName}</strong>
                {stop.destinationArea ? (
                  <span className="drawer-dropoff-destination">{stop.destinationArea}</span>
                ) : null}
              </div>

              <div className="drawer-dropoff-footer" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span className="drawer-dropoff-fee-label">Entry fee:</span>
                  <span className="drawer-dropoff-fee-val">
                    {entryFee}
                  </span>
                </div>
                {hasAttachedFile ? (
                  <span className="drawer-dropoff-linked-doc" title={`Linked POD: ${stop.documentRef}`}>
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
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

