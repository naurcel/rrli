"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";

export type AttentionIssue = {
  label: string;
  tooltip: string;
};

export type DeliveryAttentionItem = {
  delivery: DeliveryLedgerItem;
  issues: AttentionIssue[];
};

export type DashboardAttentionNeededProps = {
  items: DeliveryAttentionItem[];
  expandedIds: Set<string>;
  onToggleItem: (id: string, e?: React.MouseEvent) => void;
  onToggleAll: () => void;
  onSelectDelivery: (deliveryId: string) => void;
};

export function DashboardAttentionNeeded({
  items,
  expandedIds,
  onToggleItem,
  onToggleAll,
  onSelectDelivery,
}: DashboardAttentionNeededProps) {
  const allExpanded = items.length > 0 && expandedIds.size === items.length;

  return (
    <Card className="dashboard-attention-card" aria-label="Attention needed">
      <CardHeader
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h2>Attention Needed</h2>
            {items.length > 0 && (
              <Badge tone="warning" variant="counter" style={{ fontWeight: 700 }}>
                {items.length}
              </Badge>
            )}
          </div>
        }
        actions={
          items.length > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={onToggleAll}
              className="expand-all-text-button"
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </Button>
          ) : null
        }
      />

      {items.length > 0 ? (
        <div
          className="dashboard-attention-list"
          role="region"
          aria-label="Deliveries requiring attention"
        >
          {items.map(({ delivery, issues }) => {
            const isExpanded = expandedIds.has(delivery.id);
            return (
              <div
                key={delivery.id}
                className={`dashboard-attention-item${isExpanded ? " is-expanded" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDelivery(delivery.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDelivery(delivery.id);
                  }
                }}
                aria-label={`View delivery ${delivery.waybillNumber} for ${delivery.clientName}`}
              >
                <span className="dashboard-attention-indicator" aria-hidden="true" />
                <div className="dashboard-attention-body">
                  <div className="dashboard-attention-header">
                    <div className="dashboard-attention-title-group">
                      <span
                        className="dashboard-attention-waybill"
                        title={`${delivery.waybillNumber} · ${delivery.clientName}`}
                      >
                        {delivery.waybillNumber} · {delivery.clientName}
                      </span>
                      <span className="dashboard-attention-meta">
                        {delivery.plateNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="dashboard-attention-toggle"
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? "Hide" : "Show"} ${issues.length} missing item${issues.length === 1 ? "" : "s"} for ${delivery.waybillNumber}`}
                      onClick={(e) => onToggleItem(delivery.id, e)}
                    >
                      <span>{issues.length}</span>
                      <span
                        className={`attention-chevron${isExpanded ? " open" : ""}`}
                        aria-hidden="true"
                      >
                        ▾
                      </span>
                    </button>
                  </div>

                  <div
                    className={`dashboard-attention-dropdown-wrapper${isExpanded ? " is-open" : ""}`}
                    aria-hidden={!isExpanded}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="dashboard-attention-dropdown-inner">
                      <div className="dashboard-attention-dropdown">
                        <div className="dashboard-attention-tags">
                          {issues.map((issue, idx) => (
                            <Badge
                              key={idx}
                              tone="warning"
                              size="xs"
                              className="dashboard-attention-tag"
                              title={issue.tooltip ?? issue.label}
                            >
                              {issue.label}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="dashboard-attention-resolve-btn"
                          onClick={() => onSelectDelivery(delivery.id)}
                        >
                          Review delivery details →
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="dashboard-attention-empty">
          <span
            aria-hidden="true"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <div>
            <strong>All caught up</strong>
            <small>No pending items in this range.</small>
          </div>
        </div>
      )}
    </Card>
  );
}
