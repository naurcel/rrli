"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import { isDeliveryFinanciallyComplete, isDeliveryIncomplete } from "@/features/deliveries/delivery-domain";

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
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  const currentIndex = deliveries.findIndex(
    (d) => d.id === currentDeliveryId || d.waybillNumber === currentDeliveryId,
  );

  const currentTrip = currentIndex >= 0 ? deliveries[currentIndex] : null;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < deliveries.length - 1;

  // Filter deliveries based on search query (waybill, client, date, plate)
  const filteredDeliveries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return deliveries;
    return deliveries.filter(
      (d) =>
        d.waybillNumber.toLowerCase().includes(q) ||
        d.clientName.toLowerCase().includes(q) ||
        (d.deliveryDate && d.deliveryDate.toLowerCase().includes(q)) ||
        (d.plateNumber && d.plateNumber.toLowerCase().includes(q)),
    );
  }, [deliveries, searchQuery]);

  // Focus search input when dropdown opens and scroll active item into view
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
        if (activeItemRef.current) {
          activeItemRef.current.scrollIntoView({ block: "nearest" });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global click outside and escape key listener
  useEffect(() => {
    if (!isOpen) return;

    function handleGlobalClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleGlobalClick);
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [isOpen]);

  if (deliveries.length === 0) {
    return null;
  }

  return (
    <div className="delivery-navigator-group" ref={dropdownRef} aria-label="Delivery Record Navigator">
      {/* Previous delivery button */}
      <button
        type="button"
        className="delivery-nav-arrow-btn"
        disabled={!hasPrev}
        onClick={() => hasPrev && onNavigate(deliveries[currentIndex - 1].id)}
        aria-label="Previous delivery"
        title={hasPrev ? `Previous: #${deliveries[currentIndex - 1].waybillNumber} (${deliveries[currentIndex - 1].clientName})` : "No previous delivery in list"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span className="delivery-nav-btn-text">Previous</span>
      </button>

      {/* Dropdown selector with search */}
      <div className="delivery-nav-dropdown-wrapper">
        <button
          type="button"
          className={`delivery-nav-dropdown-trigger ${isOpen ? "is-open" : ""}`}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          title="Jump to another delivery"
        >
          <span className="delivery-nav-trigger-waybill">
            #{currentTrip?.waybillNumber ?? "Deliveries"}
          </span>
          {currentTrip ? (
            <span className="delivery-nav-trigger-client">· {currentTrip.clientName}</span>
          ) : null}
          <span className="delivery-nav-trigger-counter">
            {currentIndex >= 0 ? `(${currentIndex + 1} of ${deliveries.length})` : `(${deliveries.length})`}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`delivery-nav-chevron ${isOpen ? "open" : ""}`}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isOpen && (
          <div className="delivery-nav-dropdown-menu" role="listbox" aria-label="Deliveries list">
            <div className="delivery-nav-search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="delivery-nav-search-input"
                placeholder="Search waybill, client, date…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="delivery-nav-search-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  ×
                </button>
              ) : null}
            </div>

            <div className="delivery-nav-dropdown-list">
              {filteredDeliveries.length === 0 ? (
                <div className="delivery-nav-empty">No deliveries found</div>
              ) : (
                filteredDeliveries.map((trip) => {
                  const isSelected = trip.id === currentDeliveryId || trip.waybillNumber === currentDeliveryId;
                  const isComplete = !isDeliveryIncomplete(trip) && isDeliveryFinanciallyComplete(trip);
                  return (
                    <button
                      key={trip.id}
                      ref={isSelected ? activeItemRef : undefined}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`delivery-nav-item ${isSelected ? "is-active" : ""}`}
                      onClick={() => {
                        setIsOpen(false);
                        onNavigate(trip.id);
                      }}
                    >
                      <div className="delivery-nav-item-primary">
                        <strong className="delivery-nav-item-wb">#{trip.waybillNumber}</strong>
                        <span className="delivery-nav-item-client">{trip.clientName}</span>
                      </div>
                      <div className="delivery-nav-item-meta">
                        <span className="delivery-nav-item-date">{trip.deliveryDate}</span>
                        <span className="delivery-nav-item-sep">·</span>
                        <span className="delivery-nav-item-stops">
                          {trip.dropoffs.length} {trip.dropoffs.length === 1 ? "stop" : "stops"}
                        </span>
                        <span
                          className={`delivery-nav-item-dot ${isComplete ? "positive" : "warning"}`}
                          title={isComplete ? "Complete" : "Incomplete"}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Next delivery button */}
      <button
        type="button"
        className="delivery-nav-arrow-btn"
        disabled={!hasNext}
        onClick={() => hasNext && onNavigate(deliveries[currentIndex + 1].id)}
        aria-label="Next delivery"
        title={hasNext ? `Next: #${deliveries[currentIndex + 1].waybillNumber} (${deliveries[currentIndex + 1].clientName})` : "No next delivery in list"}
      >
        <span className="delivery-nav-btn-text">Next</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
