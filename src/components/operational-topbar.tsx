"use client";

import { GlobalDateRangePicker } from "@/components/global-date-range-picker";

export function OperationalTopbar({ showDateFilter = true }: { showDateFilter?: boolean }) {
  return (
    <header className="topbar">
      <div className="topbar-primary">
        {showDateFilter && <div className="topbar-filter-slot"><GlobalDateRangePicker /></div>}
      </div>
      <div className="topbar-actions">
        <span className="preview-pill">
          <i aria-hidden="true" /> Preview workspace
        </span>
        <button
          className="help-button"
          type="button"
          aria-label="Help"
          title="Help is not connected yet"
          disabled
        >
          ?
        </button>
      </div>
    </header>
  );
}
