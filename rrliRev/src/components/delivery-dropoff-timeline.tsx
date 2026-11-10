"use client";

import type { DeliveryStoreDropoff } from "@/features/deliveries/delivery-domain";

function formatEntryFee(amount: number | null, status: string): string {
  if (status === "not_applicable") return "None (N/A)";
  if (status === "unknown") return "Unknown";
  if (amount == null || amount === 0) return "None (₱0)";
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
    return <p className="drawer-dropoff-empty" title="This delivery has no store drop-off destinations recorded">No drop-offs recorded for this delivery.</p>;
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
                <span className="drawer-dropoff-stop-tag">Store Drop-off #{stopNumber}</span>
                {stop.podSubmitted ? (
                  <span className="drawer-dropoff-doc-pill has-doc" title="Proof of delivery document attached">
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
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    POD attached
                  </span>
                ) : (
                  <span className="drawer-dropoff-doc-pill no-doc" title="Missing POD: Receiving document with store stamp has not been uploaded yet">
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
                    Missing POD
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
                <span
                  className="drawer-dropoff-fee-val"
                  title={
                    stop.entryFeeStatus === "not_applicable"
                      ? "Not applicable: No entry fee charged for this store location"
                      : stop.entryFeeStatus === "unknown"
                      ? "Pending confirmation: Entry fee amount requires confirmation"
                      : stop.entryFee === 0 || stop.entryFee == null
                      ? "No entry fee incurred at this store"
                      : `Confirmed entry fee: ₱${Number(stop.entryFee).toLocaleString("en-PH")}`
                  }
                >
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

