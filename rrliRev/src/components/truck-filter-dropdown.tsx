"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  TRUCK_CLASSIFICATION_FILTER_OPTIONS,
  TRUCK_PERFORMANCE_FILTER_OPTIONS,
  type TruckClassificationFilterKey,
  type TruckPerformanceFilterKey,
} from "@/features/deliveries/truck-registry";

export type OwnedTruckSort =
  | "netProfit"
  | "revenue"
  | "margin"
  | "deliveries"
  | "expenses"
  | "plate";

export const OWNED_TRUCK_SORT_OPTIONS = [
  { value: "netProfit", label: "Highest Net Profit" },
  { value: "revenue", label: "Highest Delivery Revenue" },
  { value: "margin", label: "Highest Profit Margin" },
  { value: "deliveries", label: "Most Deliveries" },
  { value: "expenses", label: "Highest Trip Expenses" },
  { value: "plate", label: "Plate A–Z" },
] as const;

export type TruckFilterDropdownProps = {
  classification: TruckClassificationFilterKey;
  performance: TruckPerformanceFilterKey;
  sort: OwnedTruckSort;
  onClassificationChange: (value: TruckClassificationFilterKey) => void;
  onPerformanceChange: (value: TruckPerformanceFilterKey) => void;
  onSortChange: (value: OwnedTruckSort) => void;
  onClearAll: () => void;
  className?: string;
};

export function TruckFilterDropdown({
  classification,
  performance,
  sort,
  onClassificationChange,
  onPerformanceChange,
  onSortChange,
  onClearAll,
  className = "",
}: TruckFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();

  const activeCount =
    (classification !== "all" ? 1 : 0) +
    (performance !== "all" ? 1 : 0) +
    (sort !== "netProfit" ? 1 : 0);

  // Close on outside click or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`delivery-filter-dropdown-container${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className={`delivery-filter-trigger ui-tooltip${activeCount > 0 ? " has-active-filters" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dropdownId}
        aria-label={activeCount > 0 ? `Filter trucks (${activeCount} active)` : "Filter trucks"}
        data-tooltip={activeCount > 0 ? `Filter trucks (${activeCount} active)` : "Filter trucks"}
        title={activeCount > 0 ? `Filter trucks (${activeCount} active)` : "Filter trucks"}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="filter-trigger-icon" aria-hidden="true">
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1.5 2.5h13l-5.2 6.1v4.7l-2.6-1.5V8.6L1.5 2.5Z" />
          </svg>
        </span>
        {activeCount > 0 && (
          <span className="filter-active-badge" aria-hidden="true">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={dropdownId}
          className="delivery-filter-popover"
          role="dialog"
          aria-label="Truck filters"
        >
          <header className="filter-popover-header">
            <div className="filter-popover-title-row">
              <span className="filter-popover-title">Filter & Sort Trucks</span>
              {activeCount > 0 && (
                <button
                  type="button"
                  className="filter-popover-clear"
                  onClick={() => {
                    onClearAll();
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </header>

          <div className="filter-popover-body">
            {/* Classification & Capability */}
            <section className="filter-popover-section">
              <div className="filter-section-header">
                <span className="filter-section-title">Classification</span>
                {classification !== "all" && (
                  <span className="filter-section-count">Active</span>
                )}
              </div>
              <div className="filter-options-list">
                {TRUCK_CLASSIFICATION_FILTER_OPTIONS.map((opt) => {
                  const isChecked = classification === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`filter-option-row${isChecked ? " is-checked" : ""}`}
                    >
                      <input
                        type="radio"
                        name="truck-classification"
                        checked={isChecked}
                        onChange={() => onClassificationChange(opt.value as TruckClassificationFilterKey)}
                      />
                      <span className="filter-checkbox-box" aria-hidden="true">
                        {isChecked && (
                          <svg
                            viewBox="0 0 12 12"
                            width="10"
                            height="10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
                          </svg>
                        )}
                      </span>
                      <span className="filter-option-label">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Performance Tier */}
            <section className="filter-popover-section">
              <div className="filter-section-header">
                <span className="filter-section-title">Performance Tier</span>
                {performance !== "all" && (
                  <span className="filter-section-count">Active</span>
                )}
              </div>
              <div className="filter-options-list">
                {TRUCK_PERFORMANCE_FILTER_OPTIONS.map((opt) => {
                  const isChecked = performance === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`filter-option-row${isChecked ? " is-checked" : ""}`}
                    >
                      <input
                        type="radio"
                        name="truck-performance"
                        checked={isChecked}
                        onChange={() => onPerformanceChange(opt.value as TruckPerformanceFilterKey)}
                      />
                      <span className="filter-checkbox-box" aria-hidden="true">
                        {isChecked && (
                          <svg
                            viewBox="0 0 12 12"
                            width="10"
                            height="10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
                          </svg>
                        )}
                      </span>
                      <span className="filter-option-label">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Sort & Ranking */}
            <section className="filter-popover-section">
              <div className="filter-section-header">
                <span className="filter-section-title">Sort & Ranking</span>
                {sort !== "netProfit" && (
                  <span className="filter-section-count">Custom</span>
                )}
              </div>
              <div className="filter-options-list">
                {OWNED_TRUCK_SORT_OPTIONS.map((opt) => {
                  const isChecked = sort === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`filter-option-row${isChecked ? " is-checked" : ""}`}
                    >
                      <input
                        type="radio"
                        name="truck-sort"
                        checked={isChecked}
                        onChange={() => onSortChange(opt.value)}
                      />
                      <span className="filter-checkbox-box" aria-hidden="true">
                        {isChecked && (
                          <svg
                            viewBox="0 0 12 12"
                            width="10"
                            height="10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
                          </svg>
                        )}
                      </span>
                      <span className="filter-option-label">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

