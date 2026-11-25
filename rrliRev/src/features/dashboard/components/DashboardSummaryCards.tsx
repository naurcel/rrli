"use client";

import Link from "next/link";
import React from "react";
import { CompactMoney } from "@/components/compact-money";
import { StatCard } from "@/components/ui/card";
import { formatPercent, formatPeso } from "@/lib/format";

export type DashboardSummaryTotals = {
  earnings: number;
  deliveryRevenue?: number;
  companyRevenue?: number;
  totalRevenue?: number;
  deliveryExpenses: number;
  companyExpenses: number;
  companyNetProfit: number;
  companyProfitMargin: number | null;
  totalStops: number;
  finalizedCount: number;
};

export type DashboardTopClientData = {
  name: string;
  revenue: number;
  tripCount: number;
  isTied: boolean;
};

export type DashboardSummaryCardsProps = {
  totals: DashboardSummaryTotals;
  topClientData: DashboardTopClientData;
};

export function DashboardSummaryCards({
  totals,
  topClientData,
}: DashboardSummaryCardsProps) {
  const rawName = topClientData.name.trim() || "None";
  const clientNameLen = rawName.length;
  const longestWordLen = Math.max(
    ...rawName.split(/\s+/).map((w) => w.length),
    1,
  );
  const effectiveLen = Math.max(clientNameLen, longestWordLen * 1.6);
  const clientSizeClass =
    effectiveLen <= 9
      ? "stat-client-name--xs"
      : effectiveLen <= 15
        ? "stat-client-name--short"
        : effectiveLen <= 23
          ? "stat-client-name--medium"
          : effectiveLen <= 35
            ? "stat-client-name--long"
            : "stat-client-name--xl";

  const deliveryRevenue = totals.deliveryRevenue ?? totals.earnings;
  const companyRevenue = totals.companyRevenue ?? 0;
  const totalRevenue = totals.totalRevenue ?? (deliveryRevenue + companyRevenue);

  const revenueMeta =
    companyRevenue > 0
      ? `${formatPeso(deliveryRevenue)} delivery · ${formatPeso(companyRevenue)} company`
      : deliveryRevenue > 0
        ? `${formatPeso(deliveryRevenue)} delivery · ${formatPeso(0)} company`
        : "—";

  const expensesMeta =
    totals.companyExpenses > 0
      ? `${formatPeso(totals.deliveryExpenses)} delivery · ${formatPeso(totals.companyExpenses)} company`
      : totals.deliveryExpenses > 0
        ? `${formatPeso(totals.deliveryExpenses)} delivery · ${formatPeso(0)} company`
        : "—";

  const profitMeta =
    totalRevenue > 0 && totals.companyProfitMargin !== null
      ? `${formatPercent(totals.companyProfitMargin)} margin`
      : totals.companyNetProfit < 0 && totals.companyProfitMargin !== null
        ? `${formatPercent(totals.companyProfitMargin)} loss`
        : "—";

  const topClientMeta =
    topClientData.revenue > 0
      ? topClientData.isTied
        ? `Tied at ${formatPeso(topClientData.revenue)} each`
        : `${formatPeso(topClientData.revenue)} revenue · ${topClientData.tripCount} ${topClientData.tripCount === 1 ? "trip" : "trips"}`
      : "No revenue in selected range";

  return (
    <section
      className="dashboard-kpi-grid"
      aria-label="Company performance and profitability summary"
    >
      {/* 1. Revenue */}
      <StatCard
        label="REVENUE"
        className="stat-card-revenue"
        value={<CompactMoney value={totalRevenue} />}
        meta={revenueMeta}
        metaTone={totalRevenue > 0 ? "positive" : "neutral"}
        href="/deliveries"
      />

      {/* 2. Expenses */}
      <StatCard
        label="EXPENSES"
        className="stat-card-expenses"
        value={<CompactMoney value={totals.deliveryExpenses + totals.companyExpenses} />}
        meta={expensesMeta}
        href="/finance"
      />

      {/* 3. Profit */}
      <StatCard
        label="PROFIT"
        className="stat-card-profit"
        value={<CompactMoney value={totals.companyNetProfit} />}
        valueTone={totals.companyNetProfit >= 0 ? "default" : "warning"}
        meta={profitMeta}
        metaTone={totals.companyNetProfit >= 0 ? "positive" : "warning"}
        href="/finance"
      />

      {/* 4. Top Client */}
      <Link
        className="stat-card stat-card-link stat-card-top-client"
        href={
          topClientData.name && topClientData.name.trim() !== "None"
            ? `/deliveries?client=${encodeURIComponent(topClientData.name.trim())}`
            : "/deliveries"
        }
      >
        <span className="stat-label">TOP CLIENT</span>
        <div className="stat-client-body">
          <strong className={`stat-client-name ${clientSizeClass}`}>
            {topClientData.name}
          </strong>
        </div>
        <span className={`stat-meta ${topClientData.revenue > 0 ? "positive" : ""}`}>
          {topClientMeta}
        </span>
      </Link>
    </section>
  );
}
