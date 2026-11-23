"use client";

import Link from "next/link";
import React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { TabList, TabTrigger } from "@/components/ui/tabs";
import type { PersistedTruckSummary } from "@/features/deliveries/use-delivery-profitability-summary";
import { formatPercent, formatPeso } from "@/lib/format";
import { withReturnContext } from "@/lib/navigation/return-context";

export type TruckRankingMetric = "revenue" | "netIncome" | "expenses" | "profitMargin";

export const truckRankingLabels: Record<TruckRankingMetric, string> = {
  revenue: "Revenue",
  netIncome: "Net profit",
  expenses: "Expenses",
  profitMargin: "Profit margin",
};

export function formatTruckRankingValue(
  truck: PersistedTruckSummary,
  metric: TruckRankingMetric,
): string {
  if (metric === "profitMargin") return formatPercent(truck.profit_margin);
  if (metric === "expenses") return formatPeso(truck.expenses);
  return formatPeso(metric === "revenue" ? truck.revenue : truck.net_income);
}

export type DashboardTopTrucksProps = {
  truckRankings: PersistedTruckSummary[];
  truckRankingMetric: TruckRankingMetric;
  onMetricChange: (metric: TruckRankingMetric) => void;
  currentDashboardUrl: string;
};

export function DashboardTopTrucks({
  truckRankings,
  truckRankingMetric,
  onMetricChange,
  currentDashboardUrl,
}: DashboardTopTrucksProps) {
  return (
    <Card className="top-trucks-card" aria-label="Truck profitability rankings">
      <CardHeader title="Top Trucks" />

      <TabList
        role="group"
        aria-label="Rank trucks by"
        className="truck-ranking-tabs"
      >
        {(Object.keys(truckRankingLabels) as TruckRankingMetric[]).map((metric) => (
          <TabTrigger
            key={metric}
            value={metric}
            active={truckRankingMetric === metric}
            onClick={() => onMetricChange(metric)}
          >
            {truckRankingLabels[metric]}
          </TabTrigger>
        ))}
      </TabList>

      <ol className="top-truck-list">
        {truckRankings.length === 0 ? (
          <li className="top-truck-empty">
            No finalized truck records in this range.
          </li>
        ) : null}
        {truckRankings.map((truck, idx) => (
          <li className={idx === 0 ? "is-top-truck" : undefined} key={truck.plate_number}>
            <Link
              className="top-truck-link"
              href={withReturnContext(
                `/truck-profitability/${encodeURIComponent(truck.plate_number)}?from=dashboard`,
                currentDashboardUrl,
                "Dashboard",
              )}
              title={`View ${truck.plate_number}`}
            >
              <span className="truck-rank">{idx + 1}</span>
              <div>
                <strong>{truck.plate_number}</strong>
                <span>
                  {truck.deliveries} finalized trip{truck.deliveries === 1 ? "" : "s"}
                  {truckRankingMetric === "profitMargin" || truckRankingMetric === "expenses"
                    ? ` · ${formatPeso(truck.net_income)} net profit`
                    : ` · ${formatPercent(truck.profit_margin)} margin`}
                </span>
              </div>
              <b>{formatTruckRankingValue(truck, truckRankingMetric)}</b>
            </Link>
          </li>
        ))}
      </ol>
      <Link className="dashboard-card-link" href="/truck-profitability">
        <span>View all</span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </Link>
    </Card>
  );
}
