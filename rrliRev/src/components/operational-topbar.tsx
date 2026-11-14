"use client";

import { AccountControl } from "@/components/account-control";
import { GlobalDateRangePicker } from "@/components/global-date-range-picker";

export function OperationalTopbar({
  contextLabel: _contextLabel,
  showDateFilter = false,
}: {
  contextLabel?: string;
  showDateFilter?: boolean;
}) {
  return (
    <header className="topbar">
      <div className="topbar-primary">
        {showDateFilter ? (
          <div className="topbar-filter-slot">
            <GlobalDateRangePicker />
          </div>
        ) : null}
      </div>
      <div className="topbar-actions">
        <AccountControl />
      </div>
    </header>
  );
}
