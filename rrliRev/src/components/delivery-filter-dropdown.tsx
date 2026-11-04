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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();

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

  // Search filtering with space-insensitive matching for plate numbers
  const searchNormalized = search.trim().toLowerCase();
  const searchClean = searchNormalized.replace(/\s+/g, "");

  const visibleClients = useMemo(
    () =>
      searchNormalized
        ? clients.filter((c) => c.label.toLowerCase().includes(searchNormalized))
        : clients,
    [clients, searchNormalized],
  );
  const visibleOwnedTrucks = useMemo(
    () =>
      searchNormalized
        ? ownedTrucks.filter((t) => {
            const labelNorm = t.label.toLowerCase();
            const labelClean = labelNorm.replace(/\s+/g, "");
            return (
              labelNorm.includes(searchNormalized) ||
              (searchClean.length > 0 && labelClean.includes(searchClean))
            );
          })
        : ownedTrucks,
    [ownedTrucks, searchClean, searchNormalized],
  );
  const visibleSubcontractedTrucks = useMemo(
    () =>
      searchNormalized
        ? subcontractedTrucks.filter((t) => {
            const labelNorm = t.label.toLowerCase();
            const labelClean = labelNorm.replace(/\s+/g, "");
            return (
              labelNorm.includes(searchNormalized) ||
              (searchClean.length > 0 && labelClean.includes(searchClean))
            );
          })
        : subcontractedTrucks,
    [subcontractedTrucks, searchClean, searchNormalized],
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

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
    <div
      ref={containerRef}
      className={`delivery-filter-dropdown-container${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className={`delivery-filter-trigger ui-tooltip${totalActive > 0 ? " has-active-filters" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dropdownId}
        aria-label={totalActive > 0 ? `Filter deliveries (${totalActive} active)` : "Filter deliveries"}
        data-tooltip={totalActive > 0 ? `Filter deliveries (${totalActive} active)` : "Filter deliveries"}
        title={totalActive > 0 ? `Filter deliveries (${totalActive} active)` : "Filter deliveries"}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="filter-trigger-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 2.5h13l-5.2 6.1v4.7l-2.6-1.5V8.6L1.5 2.5Z" />
          </svg>
        </span>
        {totalActive > 0 && (
          <span className="filter-active-badge" aria-hidden="true">
            {totalActive}
          </span>
        )}
      </button>

      {open && (
        <div
          id={dropdownId}
          className="delivery-filter-popover"
          role="dialog"
          aria-label="Delivery filters"
        >
          <header className="filter-popover-header">
            <div className="filter-popover-title-row">
              <span className="filter-popover-title">Filter by Client & Truck</span>
              {totalActive > 0 && (
                <button
                  type="button"
                  className="filter-popover-clear"
                  onClick={handleClearAll}
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="filter-popover-search">
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="Type plate number or client…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (visibleOwnedTrucks.length > 0) {
                      toggleTruck(visibleOwnedTrucks[0].id);
                    } else if (visibleSubcontractedTrucks.length > 0) {
                      toggleTruck(visibleSubcontractedTrucks[0].id);
                    } else if (visibleClients.length > 0) {
                      toggleClient(visibleClients[0].id);
                    } else if (search.trim().length >= 2) {
                      const plate = search.trim().toUpperCase();
                      if (!selectedTrucks.includes(plate)) {
                        onTrucksChange([...selectedTrucks, plate]);
                      }
                      setSearch("");
                    }
                  }
                }}
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            {search.trim().length >= 2 &&
              !visibleOwnedTrucks.some(
                (t) => t.label.toUpperCase() === search.trim().toUpperCase(),
              ) &&
              !visibleSubcontractedTrucks.some(
                (t) => t.label.toUpperCase() === search.trim().toUpperCase(),
              ) && (
                <div className="filter-type-plate-action">
                  <button
                    type="button"
                    className="filter-type-plate-btn"
                    onClick={() => {
                      const plate = search.trim().toUpperCase();
                      if (!selectedTrucks.includes(plate)) {
                        onTrucksChange([...selectedTrucks, plate]);
                      }
                      setSearch("");
                    }}
                  >
                    + Filter by typed plate: <strong>{search.trim().toUpperCase()}</strong>
                  </button>
                </div>
              )}
          </header>

          <div className="filter-popover-body">
            {/* Clients Section */}
            <section className="filter-popover-section">
              <div className="filter-section-header">
                <span className="filter-section-title">Clients</span>
                {selectedClients.length > 0 && (
                  <span className="filter-section-count">
                    {selectedClients.length} selected
                  </span>
                )}
              </div>
              {visibleClients.length === 0 ? (
                <div className="filter-section-empty">No clients match “{search}”</div>
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

            {/* Trucks Section */}
            <section className="filter-popover-section">
              <div className="filter-section-header">
                <span className="filter-section-title">Trucks</span>
                {selectedTrucks.length > 0 && (
                  <span className="filter-section-count">
                    {selectedTrucks.length} selected
                  </span>
                )}
              </div>

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
                <div className="filter-section-empty">No trucks match “{search}”</div>
              )}
            </section>
          </div>

          <footer className="filter-popover-footer">
            <span className="filter-footer-summary">
              {totalActive === 0
                ? "Showing all deliveries"
                : `${totalActive} filter${totalActive === 1 ? "" : "s"} active`}
            </span>
            <button
              type="button"
              className="filter-footer-done"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}

