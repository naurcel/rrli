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
}: {
  dropoffs: readonly DeliveryStoreDropoff[];
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

        return (
          <div
            key={stop.id || `${stop.storeName}-${index}`}
            className={`drawer-dropoff-item ${isLast ? "is-last" : ""}`}
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

              <div className="drawer-dropoff-footer">
                <span className="drawer-dropoff-fee-label">Entry fee:</span>
                <span className="drawer-dropoff-fee-val">
                  {entryFee}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

