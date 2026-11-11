"use client";

import { useEffect, useRef } from "react";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";

export type DeliveryNavigatorProps = {
  currentDeliveryId: string;
  deliveries: readonly DeliveryLedgerItem[];
  onNavigate: (deliveryId: string) => void;
};

export function DeliveryNavigator({
  currentDeliveryId,
  deliveries,
  onNavigate,
}: DeliveryNavigatorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  const currentIndex = deliveries.findIndex(
    (d) => d.id === currentDeliveryId || d.waybillNumber === currentDeliveryId,
  );

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < deliveries.length - 1;

  // Auto-scroll the active item into view within the navigator strip
  useEffect(() => {
    if (activeBtnRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeBtnRef.current;
      const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left, behavior: "smooth" });
    }
  }, [currentDeliveryId]);

  if (deliveries.length === 0) {
    return null;
  }

  return (
    <div className="delivery-navigator-bar" aria-label="Delivery Record Navigator">
      <div className="delivery-navigator-controls">
        <button
          type="button"
          className="delivery-nav-arrow-btn"
          disabled={!hasPrev}
          onClick={() => hasPrev && onNavigate(deliveries[currentIndex - 1].id)}
          aria-label="Previous delivery"
          title={hasPrev ? `Previous: #${deliveries[currentIndex - 1].waybillNumber}` : "No previous delivery in list"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="delivery-nav-btn-text">Previous</span>
        </button>

        <span className="delivery-navigator-counter">
          {currentIndex >= 0 ? (
            <>
              <strong>{currentIndex + 1}</strong> of <strong>{deliveries.length}</strong>
            </>
          ) : (
            <span>{deliveries.length} total</span>
          )}
        </span>

        <button
          type="button"
          className="delivery-nav-arrow-btn"
          disabled={!hasNext}
          onClick={() => hasNext && onNavigate(deliveries[currentIndex + 1].id)}
          aria-label="Next delivery"
          title={hasNext ? `Next: #${deliveries[currentIndex + 1].waybillNumber}` : "No next delivery in list"}
        >
          <span className="delivery-nav-btn-text">Next</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Scrollable strip of nearby deliveries */}
      <div className="delivery-navigator-strip-container" ref={scrollRef}>
        <div className="delivery-navigator-strip" role="tablist" aria-label="Nearby deliveries list">
          {deliveries.map((trip, idx) => {
            const isSelected = trip.id === currentDeliveryId || trip.waybillNumber === currentDeliveryId;
            return (
              <button
                key={trip.id}
                ref={isSelected ? activeBtnRef : undefined}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`delivery-nav-pill ${isSelected ? "is-selected" : ""}`}
                onClick={() => onNavigate(trip.id)}
                title={`#${trip.waybillNumber} · ${trip.clientName} · ${trip.deliveryDate}`}
              >
                <span className="delivery-nav-pill-waybill">#{trip.waybillNumber}</span>
                <span className="delivery-nav-pill-client">{trip.clientName}</span>
                <span className="delivery-nav-pill-date">{trip.deliveryDate}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
