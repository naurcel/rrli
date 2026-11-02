"use client";

import { useEffect, useState } from "react";

import { GlobalDateRangePicker } from "@/components/global-date-range-picker";

export function OperationalTopbar({
  contextLabel: _contextLabel,
  showDateFilter = true,
}: {
  contextLabel?: string;
  showDateFilter?: boolean;
}) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const current =
        document.documentElement.dataset.theme ??
        window.localStorage.getItem("routex-theme");
      setIsDark(current === "dark");
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      const nextTheme = next ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      try {
        window.localStorage.setItem("routex-theme", nextTheme);
      } catch {
        // Ignore storage restrictions
      }
      return next;
    });
  }

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
        <button
          className="theme-toggle"
          type="button"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {isDark ? "☀" : "◐"}
        </button>
      </div>
    </header>
  );
}

