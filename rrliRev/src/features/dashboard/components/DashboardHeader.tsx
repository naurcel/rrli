"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { withReturnContext } from "@/lib/navigation/return-context";

export type DashboardHeaderProps = {
  greeting: string;
  actorName: string;
  roleLabel: string;
  canWrite: boolean;
  currentDashboardUrl: string;
  error?: string | null;
  loading?: boolean;
  accessLevel?: string;
  accessNoticeDismissed?: boolean;
  onDismissAccessNotice?: () => void;
};

export function DashboardHeader({
  greeting,
  actorName,
  roleLabel,
  canWrite,
  currentDashboardUrl,
  error,
  loading,
  accessLevel,
  accessNoticeDismissed,
  onDismissAccessNotice,
}: DashboardHeaderProps) {
  return (
    <>
      <header className="page-intro dashboard-welcome">
        <div>
          <h1 suppressHydrationWarning>
            {greeting}, {actorName}
          </h1>
          <p className="subtitle">
            Overview of delivery operations and profitability.
          </p>
        </div>
        {canWrite ? (
          <div className="fleet-intro-actions">
            <Button
              variant="secondary"
              href={withReturnContext("/deliveries/import", currentDashboardUrl, "Dashboard")}
              aria-label="Import an Excel trip report"
              className="page-intro-action"
            >
              Import
            </Button>
            <Button
              variant="primary"
              href={withReturnContext("/deliveries/new", currentDashboardUrl, "Dashboard")}
              aria-label="Record a completed delivery and its trip details"
              className="page-intro-action"
            >
              Record delivery
            </Button>
          </div>
        ) : (
          <span className="settings-readonly-pill">
            View-Only ({roleLabel})
          </span>
        )}
      </header>

      {error ? (
        <section className="notice" role="alert">
          <span className="notice-icon" aria-hidden="true">
            !
          </span>
          <div>
            <strong>Delivery data unavailable:</strong>
            <span>{error}</span>
          </div>
        </section>
      ) : loading ? (
        <section className="notice loading-notice" role="status">
          <span className="notice-icon loading-spin" aria-hidden="true">
            ◌
          </span>
          <div>
            <strong>Loading deliveries…</strong>
          </div>
        </section>
      ) : null}

      {!accessNoticeDismissed && accessLevel === "view_only" ? (
        <section className="notice" role="status">
          <span className="notice-icon" aria-hidden="true">
            i
          </span>
          <div>
            <strong>View-Only ({roleLabel})</strong>
          </div>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={onDismissAccessNotice}
          >
            ×
          </button>
        </section>
      ) : null}
    </>
  );
}
