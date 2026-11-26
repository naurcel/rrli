"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  getRoleDashboardActions,
  type DashboardRoleAction,
} from "../dashboard-header-actions";

export type { DashboardRoleAction };

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
  role?: string;
  isSuperadmin?: boolean;
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
  role,
  isSuperadmin,
}: DashboardHeaderProps) {
  const actions = getRoleDashboardActions(
    role,
    isSuperadmin,
    canWrite,
    currentDashboardUrl,
  );

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
        {(actions.secondary || actions.primary) && (
          <div className="fleet-intro-actions">
            {actions.secondary && (
              <Button
                variant={actions.secondary.variant}
                href={actions.secondary.href}
                aria-label={actions.secondary.ariaLabel}
                className="page-intro-action"
              >
                {actions.secondary.label}
              </Button>
            )}
            {actions.primary && (
              <Button
                variant={actions.primary.variant}
                href={actions.primary.href}
                aria-label={actions.primary.ariaLabel}
                className="page-intro-action"
              >
                {actions.primary.label}
              </Button>
            )}
          </div>
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

      {!accessNoticeDismissed && accessLevel === "view_only" && role !== "finance" ? (
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
