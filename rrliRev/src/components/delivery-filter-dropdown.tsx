"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DeliveryFilterOption } from "@/features/deliveries/server/delivery-repository";

export type DeliveryFilterDropdownProps = {
  clients: readonly DeliveryFilterOption[];
  trucks: readonly DeliveryFilterOption[];
  selectedClients: readonly string[];
  selectedTrucks: readonly string[];
  onClientsChange: (clientIds: string[]) => void;
  onTrucksChange: (truckIds: string[]) => void;
  onClearAll?: () => void;
  className?: string;
};

export function DeliveryFilterDropdown({
  clients,
  trucks,
  selectedClients,
  selectedTrucks,
  onClientsChange,
  onTrucksChange,
  onClearAll,
  className = "",
}: DeliveryFilterDropdownProps) {
  const [clientOpen, setClientOpen] = useState(false);
  const [truckOpen, setTruckOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [truckSearch, setTruckSearch] = useState("");

  const clientContainerRef = useRef<HTMLDivElement>(null);
  const truckContainerRef = useRef<HTMLDivElement>(null);

  const clientDropdownId = useId();
  const truckDropdownId = useId();

  const totalActive = selectedClients.length + selectedTrucks.length;

  // Split trucks into owned and subcontracted
  const ownedTrucks = useMemo(
    () => trucks.filter((t) => t.ownershipType !== "Subcontracted"),
    [trucks],
  );
  const subcontractedTrucks = useMemo(
    () => trucks.filter((t) => t.ownershipType === "Subcontracted"),
    [trucks],
  );

  // Search filtering
  const clientSearchNormalized = clientSearch.trim().toLowerCase();
  const visibleClients = useMemo(
    () =>
      clientSearchNormalized
        ? clients.filter((c) => c.label.toLowerCase().includes(clientSearchNormalized))
        : clients,
    [clients, clientSearchNormalized],
  );

  const truckSearchNormalized = truckSearch.trim().toLowerCase();
  const truckSearchClean = truckSearchNormalized.replace(/\s+/g, "");

  const visibleOwnedTrucks = useMemo(
    () =>
      truckSearchNormalized
        ? ownedTrucks.filter((t) => {
            const labelNorm = t.label.toLowerCase();
            const labelClean = labelNorm.replace(/\s+/g, "");
            return (
              labelNorm.includes(truckSearchNormalized) ||
              (truckSearchClean.length > 0 && labelClean.includes(truckSearchClean))
            );
          })
        : ownedTrucks,
    [ownedTrucks, truckSearchClean, truckSearchNormalized],
  );

  const visibleSubcontractedTrucks = useMemo(
    () =>
      truckSearchNormalized
        ? subcontractedTrucks.filter((t) => {
            const labelNorm = t.label.toLowerCase();
            const labelClean = labelNorm.replace(/\s+/g, "");
            return (
              labelNorm.includes(truckSearchNormalized) ||
              (truckSearchClean.length > 0 && labelClean.includes(truckSearchClean))
            );
          })
        : subcontractedTrucks,
    [subcontractedTrucks, truckSearchClean, truckSearchNormalized],
  );

  // Custom typed plates that may not be in registered trucks list
  const customSelectedPlates = useMemo(() => {
    const knownTruckIdsAndPlates = new Set([
      ...trucks.map((t) => t.id),
      ...trucks.map((t) => t.label.toUpperCase()),
      ...trucks.map((t) => t.label.replace(/\s+/g, "").toUpperCase()),
    ]);
    return selectedTrucks.filter(
      (idOrPlate) =>
        !knownTruckIdsAndPlates.has(idOrPlate) &&
        !knownTruckIdsAndPlates.has(idOrPlate.toUpperCase()) &&
        !knownTruckIdsAndPlates.has(idOrPlate.replace(/\s+/g, "").toUpperCase()),
    );
  }, [selectedTrucks, trucks]);

  // Labels for the dropdown buttons
  const clientTriggerLabel = useMemo(() => {
    if (selectedClients.length === 0) return "All Clients";
    if (selectedClients.length === 1) {
      const match = clients.find((c) => c.id === selectedClients[0]);
      return match?.label ?? selectedClients[0];
    }
    return `Clients (${selectedClients.length})`;
  }, [clients, selectedClients]);

  const truckTriggerLabel = useMemo(() => {
    if (selectedTrucks.length === 0) return "All Trucks";
    if (selectedTrucks.length === 1) {
      const match = trucks.find(
        (t) =>
          t.id === selectedTrucks[0] ||
          t.label.toUpperCase() === selectedTrucks[0].toUpperCase(),
      );
      return match?.label ?? selectedTrucks[0];
    }
    return `Trucks (${selectedTrucks.length})`;
  }, [trucks, selectedTrucks]);

  // Close on outside click or Escape
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        clientOpen &&
        clientContainerRef.current &&
        !clientContainerRef.current.contains(event.target as Node)
      ) {
        setClientOpen(false);
      }
      if (
        truckOpen &&
        truckContainerRef.current &&
        !truckContainerRef.current.contains(event.target as Node)
      ) {
        setTruckOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setClientOpen(false);
        setTruckOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [clientOpen, truckOpen]);

  function toggleClient(clientId: string) {
    if (selectedClients.includes(clientId)) {
      onClientsChange(selectedClients.filter((id) => id !== clientId));
    } else {
      onClientsChange([...selectedClients, clientId]);
    }
  }

  function toggleTruck(truckId: string) {
    if (selectedTrucks.includes(truckId)) {
      onTrucksChange(selectedTrucks.filter((id) => id !== truckId));
    } else {
      onTrucksChange([...selectedTrucks, truckId]);
    }
  }

  function handleClearAll() {
    onClientsChange([]);
    onTrucksChange([]);
    if (onClearAll) onClearAll();
  }

  return (
    <div className={`delivery-filter-group${className ? ` ${className}` : ""}`}>
      {/* Client Dropdown */}
      <div
        ref={clientContainerRef}
        className={`delivery-filter-dropdown-container${clientOpen ? " is-open" : ""}`}
      >
        <button
          type="button"
          className={`filter-dropdown-btn${selectedClients.length > 0 ? " has-active" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={clientOpen}
          aria-controls={clientDropdownId}
          aria-label={
            selectedClients.length > 0
              ? `Filter by client: ${clientTriggerLabel}`
              : "Filter by client"
          }
          onClick={() => {
            setClientOpen((prev) => !prev);
            setTruckOpen(false);
          }}
        >
          <span className="filter-dropdown-label">{clientTriggerLabel}</span>
          {selectedClients.length > 1 && (
            <span className="filter-dropdown-badge">{selectedClients.length}</span>
          )}
          <span className="filter-dropdown-arrow" aria-hidden="true">▾</span>
        </button>

        {clientOpen && (
          <div
            id={clientDropdownId}
            className="delivery-filter-popover"
            role="dialog"
            aria-label="Filter by client"
          >
            <header className="filter-popover-header">
              <div className="filter-popover-title-row">
                <span className="filter-popover-title">Filter by Client</span>
                {selectedClients.length > 0 && (
                  <button
                    type="button"
                    className="filter-popover-clear"
                    onClick={() => onClientsChange([])}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="filter-popover-search">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="search-icon"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  placeholder="Search clients…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (visibleClients.length > 0) {
                        toggleClient(visibleClients[0].id);
                      }
                    }
                  }}
                  autoFocus
                />
                {clientSearch && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setClientSearch("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </header>

            <div className="filter-popover-body">
              <section className="filter-popover-section">
                {visibleClients.length === 0 ? (
                  <div className="filter-section-empty">No clients match “{clientSearch}”</div>
                ) : (
                  <div className="filter-options-list">
                    {visibleClients.map((client) => {
                      const isChecked = selectedClients.includes(client.id);
                      return (
                        <label
                          key={client.id}
                          className={`filter-option-row${isChecked ? " is-checked" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleClient(client.id)}
                          />
                          <span className="filter-checkbox-box" aria-hidden="true">
                            {isChecked && (
                              <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
                              </svg>
                            )}
                          </span>
                          <span className="filter-option-label">{client.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <footer className="filter-popover-footer">
              <span className="filter-footer-summary">
                {selectedClients.length === 0
                  ? "All clients shown"
                  : `${selectedClients.length} client${selectedClients.length === 1 ? "" : "s"} selected`}
              </span>
              <button
                type="button"
                className="filter-footer-done"
                onClick={() => setClientOpen(false)}
              >
                Done
              </button>
            </footer>
          </div>
        )}
      </div>

      {/* Truck Dropdown */}
      <div
        ref={truckContainerRef}
        className={`delivery-filter-dropdown-container${truckOpen ? " is-open" : ""}`}
      >
        <button
          type="button"
          className={`filter-dropdown-btn${selectedTrucks.length > 0 ? " has-active" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={truckOpen}
          aria-controls={truckDropdownId}
          aria-label={
            selectedTrucks.length > 0
              ? `Filter by truck: ${truckTriggerLabel}`
              : "Filter by truck"
          }
          onClick={() => {
            setTruckOpen((prev) => !prev);
            setClientOpen(false);
          }}
        >
          <span className="filter-dropdown-label">{truckTriggerLabel}</span>
          {selectedTrucks.length > 1 && (
            <span className="filter-dropdown-badge">{selectedTrucks.length}</span>
          )}
          <span className="filter-dropdown-arrow" aria-hidden="true">▾</span>
        </button>

        {truckOpen && (
          <div
            id={truckDropdownId}
            className="delivery-filter-popover"
            role="dialog"
            aria-label="Filter by truck"
          >
            <header className="filter-popover-header">
              <div className="filter-popover-title-row">
                <span className="filter-popover-title">Filter by Truck</span>
                {selectedTrucks.length > 0 && (
                  <button
                    type="button"
                    className="filter-popover-clear"
                    onClick={() => onTrucksChange([])}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="filter-popover-search">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="search-icon"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  placeholder="Type plate number…"
                  value={truckSearch}
                  onChange={(e) => setTruckSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (visibleOwnedTrucks.length > 0) {
                        toggleTruck(visibleOwnedTrucks[0].id);
                      } else if (visibleSubcontractedTrucks.length > 0) {
                        toggleTruck(visibleSubcontractedTrucks[0].id);
                      } else if (truckSearch.trim().length >= 2) {
                        const plate = truckSearch.trim().toUpperCase();
                        if (!selectedTrucks.includes(plate)) {
                          onTrucksChange([...selectedTrucks, plate]);
                        }
                        setTruckSearch("");
                      }
                    }
                  }}
                  autoFocus
                />
                {truckSearch && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setTruckSearch("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              {truckSearch.trim().length >= 2 &&
                !visibleOwnedTrucks.some(
                  (t) => t.label.toUpperCase() === truckSearch.trim().toUpperCase(),
                ) &&
                !visibleSubcontractedTrucks.some(
                  (t) => t.label.toUpperCase() === truckSearch.trim().toUpperCase(),
                ) && (
                  <div className="filter-type-plate-action">
                    <button
                      type="button"
                      className="filter-type-plate-btn"
                      onClick={() => {
                        const plate = truckSearch.trim().toUpperCase();
                        if (!selectedTrucks.includes(plate)) {
                          onTrucksChange([...selectedTrucks, plate]);
                        }
                        setTruckSearch("");
                      }}
                    >
                      + Filter by typed plate: <strong>{truckSearch.trim().toUpperCase()}</strong>
                    </button>
                  </div>
                )}
            </header>

            <div className="filter-popover-body">
              <section className="filter-popover-section">
                {/* Owned Trucks */}
                {visibleOwnedTrucks.length > 0 && (
                  <div className="filter-subsection">
                    <span className="filter-subsection-label">Owned Fleet</span>
                    <div className="filter-options-list">
                      {visibleOwnedTrucks.map((truck) => {
                        const isChecked = selectedTrucks.includes(truck.id);
                        return (
                          <label
                            key={truck.id}
                            className={`filter-option-row${isChecked ? " is-checked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTruck(truck.id)}
                            />
                            <span className="filter-checkbox-box" aria-hidden="true">
                              {isChecked && (
                                <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
                                </svg>
                              )}
                            </span>
                            <span className="filter-option-label">{truck.label}</span>
                            <span className="filter-option-tag owned">Owned</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Subcontracted Trucks */}
                {visibleSubcontractedTrucks.length > 0 && (
                  <div className="filter-subsection">
                    <span className="filter-subsection-label">Subcontracted</span>
                    <div className="filter-options-list">
                      {visibleSubcontractedTrucks.map((truck) => {
                        const isChecked = selectedTrucks.includes(truck.id);
                        return (
                          <label
                            key={truck.id}
                            className={`filter-option-row${isChecked ? " is-checked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTruck(truck.id)}
                            />
                            <span className="filter-checkbox-box" aria-hidden="true">
                              {isChecked && (
                                <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
                                </svg>
                              )}
                            </span>
                            <span className="filter-option-label">{truck.label}</span>
                            <span className="filter-option-tag subcontracted">Subcon</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Typed Plates */}
                {customSelectedPlates.length > 0 && (
                  <div className="filter-subsection">
                    <span className="filter-subsection-label">Custom Typed Plates</span>
                    <div className="filter-options-list">
                      {customSelectedPlates.map((plate) => (
                        <label key={plate} className="filter-option-row is-checked">
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() =>
                              onTrucksChange(selectedTrucks.filter((p) => p !== plate))
                            }
                          />
                          <span className="filter-checkbox-box" aria-hidden="true">
                            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
                            </svg>
                          </span>
                          <span className="filter-option-label">{plate}</span>
                          <span className="filter-option-tag custom">Typed</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {visibleOwnedTrucks.length === 0 && visibleSubcontractedTrucks.length === 0 && (
                  <div className="filter-section-empty">No trucks match “{truckSearch}”</div>
                )}
              </section>
            </div>

            <footer className="filter-popover-footer">
              <span className="filter-footer-summary">
                {selectedTrucks.length === 0
                  ? "All trucks shown"
                  : `${selectedTrucks.length} truck${selectedTrucks.length === 1 ? "" : "s"} selected`}
              </span>
              <button
                type="button"
                className="filter-footer-done"
                onClick={() => setTruckOpen(false)}
              >
                Done
              </button>
            </footer>
          </div>
        )}
      </div>

      {/* Clear all active filters */}
      {totalActive > 0 && (
        <button
          type="button"
          className="filter-clear-action-btn"
          onClick={handleClearAll}
          title="Clear all active filters"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
