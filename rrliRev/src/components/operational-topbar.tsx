"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GlobalDateRangePicker } from "@/components/global-date-range-picker";

export function OperationalTopbar({
  contextLabel: _contextLabel,
  showDateFilter = true,
  alert,
}: {
  contextLabel?: string;
  showDateFilter?: boolean;
  alert?: {
    count: number;
    href: string;
    label: string;
  };
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
        {alert && alert.count > 0 ? (
          <details className="topbar-alert-menu">
            <summary
              className="topbar-alert"
              aria-label={`Open alerts: ${alert.label}`}
              title="Open alerts"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
              <span className="topbar-alert-badge">
                {alert.count > 99 ? "99+" : alert.count}
              </span>
            </summary>
            <div className="topbar-alert-dropdown">
              <div className="topbar-alert-heading">
                <span aria-hidden="true" />
                <div>
                  <strong>Attention needed</strong>
                  <p>{alert.label}</p>
                </div>
              </div>
              <Link className="topbar-alert-item" href={alert.href}>
                <div>
                  <strong>Proof of delivery</strong>
                  <span>
                    {alert.count === 1
                      ? "One completed delivery needs review."
                      : `${alert.count} completed deliveries need review.`}
                  </span>
                </div>
                <b aria-hidden="true">→</b>
              </Link>
            </div>
          </details>
        ) : null}
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

