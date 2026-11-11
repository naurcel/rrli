"use client";

import { useId, useMemo, useState } from "react";
import type { DeliveryTripRecord } from "@/features/deliveries/delivery-domain";
import { formatPercent, formatPeso } from "@/lib/format";
import {
  computeDonutArcs,
  formatExpenseResolutionStatus,
  resolveTripFinancialGroups,
  type CalculatedDonutArc,
  type ExpenseCategorySlice,
  type TripFinancialResolution,
} from "@/features/deliveries/delivery-breakdown-model";

export {
  computeDonutArcs,
  formatExpenseResolutionStatus,
  resolveTripFinancialGroups,
  type CalculatedDonutArc,
  type ExpenseCategorySlice,
  type TripFinancialResolution,
};

/**
 * Reusable Donut Pie Chart visualizing expense distribution
 * Upgraded to high-visibility, large size with interactive center readout
 */
export function ExpenseDonutPieChart({
  slices,
  totalExpenses,
  isComplete,
  unknownItems = [],
  title = "Trip Expenses Distribution",
  centerLabel = "Total Expenses",
  valueFormatter = formatPeso,
  size = "large",
}: {
  slices: readonly ExpenseCategorySlice[];
  totalExpenses: number | null;
  isComplete: boolean;
  unknownItems?: readonly string[];
  title?: string;
  centerLabel?: string;
  valueFormatter?: (amount: number) => string;
  size?: "standard" | "large";
}) {
  const chartId = useId();
  const [hoveredSliceId, setHoveredSliceId] = useState<string | null>(null);

  const arcs = useMemo(() => {
    if (!isComplete || totalExpenses == null || totalExpenses <= 0) {
      return [];
    }
    return computeDonutArcs(slices, totalExpenses, {
      cx: 100,
      cy: 100,
      outerRadius: 82,
      innerRadius: 52,
    });
  }, [slices, totalExpenses, isComplete]);

  const activeHovered = useMemo(() => {
    if (!hoveredSliceId) return null;
    return arcs.find((a) => a.slice.id === hoveredSliceId) ?? null;
  }, [arcs, hoveredSliceId]);

  return (
    <div className={`breakdown-chart-wrapper ${size === "large" ? "is-large" : ""}`}>
      <div className="breakdown-chart-visual">
        <div className={`breakdown-donut-container ${size === "large" ? "is-large" : ""}`}>
          <svg
            className="breakdown-donut-svg"
            viewBox="0 0 200 200"
            role="img"
            aria-labelledby={`${chartId}-title ${chartId}-desc`}
          >
            <title id={`${chartId}-title`}>{title}</title>
            <desc id={`${chartId}-desc`}>
              {isComplete && totalExpenses != null
                ? `Interactive pie chart displaying categories totaling ${valueFormatter(totalExpenses)}.`
                : "Visualization deferred due to unconfirmed items."}
            </desc>

            {/* Background circle / empty track */}
            <circle
              cx="100"
              cy="100"
              r="82"
              fill="var(--color-surface-subtle, #f8fafc)"
              stroke="var(--color-border, rgba(148, 163, 184, 0.25))"
              strokeWidth="1"
            />

            {!isComplete ? (
              /* Incomplete / Unconfirmed state */
              <g className="donut-incomplete-group">
                <circle
                  cx="100"
                  cy="100"
                  r="82"
                  fill="rgba(245, 158, 11, 0.05)"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  opacity="0.85"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="50"
                  fill="var(--color-surface, #ffffff)"
                  stroke="var(--color-border, rgba(148, 163, 184, 0.25))"
                  strokeWidth="1"
                />
                <g transform="translate(90, 72)" aria-hidden="true">
                  <path
                    d="m10 2 9 16H1L10 2z"
                    fill="none"
                    stroke="#d97706"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line x1="10" y1="8" x2="10" y2="12" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="10" cy="15" r="1" fill="#d97706" />
                </g>
                <text
                  x="100"
                  y="114"
                  textAnchor="middle"
                  className="donut-center-sub-warn"
                >
                  Unconfirmed
                </text>
              </g>
            ) : totalExpenses === 0 ? (
              /* Zero expenses confirmed */
              <g className="donut-zero-group">
                <circle
                  cx="100"
                  cy="100"
                  r="50"
                  fill="var(--color-surface, #ffffff)"
                  stroke="var(--color-border, rgba(148, 163, 184, 0.25))"
                  strokeWidth="1"
                />
                <text
                  x="100"
                  y="96"
                  textAnchor="middle"
                  className="donut-center-hero-val"
                >
                  {valueFormatter(0)}
                </text>
                <text
                  x="100"
                  y="114"
                  textAnchor="middle"
                  className="donut-center-sub"
                >
                  Zero
                </text>
              </g>
            ) : (
              /* Confirmed expense pie slices */
              <>
                <g className="donut-arcs-group">
                  {arcs.map((arc) => {
                    const isHovered = hoveredSliceId === arc.slice.id;
                    return (
                      <path
                        key={arc.slice.id}
                        d={arc.pathD}
                        fill={arc.slice.color}
                        className={`donut-slice ${isHovered ? "is-hovered" : ""}`}
                        stroke="var(--color-surface, #ffffff)"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        tabIndex={0}
                        role="graphics-symbol"
                        aria-label={`${arc.slice.label}: ${valueFormatter(arc.slice.amount)} (${arc.percentage.toFixed(1)}%)`}
                        onMouseEnter={() => setHoveredSliceId(arc.slice.id)}
                        onMouseLeave={() => setHoveredSliceId(null)}
                        onFocus={() => setHoveredSliceId(arc.slice.id)}
                        onBlur={() => setHoveredSliceId(null)}
                      />
                    );
                  })}
                </g>

                {/* Inner hole with live interactive center readout */}
                <circle
                  cx="100"
                  cy="100"
                  r="50"
                  fill="var(--color-surface, #ffffff)"
                  stroke="var(--color-border, rgba(148, 163, 184, 0.3))"
                  strokeWidth="1.2"
                  className="donut-center-circle"
                />

                <g className="donut-center-live-text" aria-hidden="true" pointerEvents="none">
                  {activeHovered ? (
                    <>
                      <text
                        x="100"
                        y="93"
                        textAnchor="middle"
                        className="donut-center-hero-val"
                      >
                        {valueFormatter(activeHovered.slice.amount)}
                      </text>
                      <text
                        x="100"
                        y="108"
                        textAnchor="middle"
                        className="donut-center-sub-share"
                      >
                        {activeHovered.percentage.toFixed(1)}% of total
                      </text>
                      <text
                        x="100"
                        y="120"
                        textAnchor="middle"
                        className="donut-center-sub-name"
                      >
                        {activeHovered.slice.label}
                      </text>
                    </>
                  ) : (
                    <>
                      <text
                        x="100"
                        y="95"
                        textAnchor="middle"
                        className="donut-center-hero-val"
                      >
                        {totalExpenses != null ? valueFormatter(totalExpenses) : "—"}
                      </text>
                      <text
                        x="100"
                        y="112"
                        textAnchor="middle"
                        className="donut-center-sub"
                      >
                        {centerLabel}
                      </text>
                    </>
                  )}
                </g>
              </>
            )}
          </svg>
        </div>

        {/* Dedicated readout below the chart */}
        <div className="breakdown-pie-readout" aria-live="polite">
          <div className="breakdown-pie-amount">
            {activeHovered
              ? valueFormatter(activeHovered.slice.amount)
              : isComplete && totalExpenses != null
                ? valueFormatter(totalExpenses)
                : "—"}
          </div>
          <div
            className="breakdown-pie-label"
            title={
              activeHovered
                ? `${activeHovered.percentage.toFixed(1)}% · ${activeHovered.slice.label}`
                : isComplete && totalExpenses != null
                  ? `100.0% · ${centerLabel}`
                  : "Unconfirmed Expenses"
            }
          >
            {activeHovered ? (
              <>
                <span className="pie-share-pill">{activeHovered.percentage.toFixed(1)}%</span>
                <span className="pie-category-name">{activeHovered.slice.label}</span>
              </>
            ) : isComplete && totalExpenses != null ? (
              <>
                <span className="pie-share-pill">100%</span>
                <span className="pie-category-name">{centerLabel}</span>
              </>
            ) : (
              <>
                <span className="pie-share-pill warn-pill">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
                <span className="pie-category-name">Unconfirmed</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Legend & Breakdown Items */}
      <div className="breakdown-legend-container">
        {!isComplete ? (
          <div className="breakdown-incomplete-notice">
            <span className="notice-icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d97706"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <div>
              <p className="notice-title">Expense distribution deferred</p>
              <p className="notice-body">
                {unknownItems.length} unconfirmed expense{unknownItems.length === 1 ? "" : "s"} ({unknownItems.join(", ")}). Slices deferred until expenses are resolved.
              </p>
            </div>
          </div>
        ) : null}

        <ul className="breakdown-legend-list" role="list">
          {slices.map((slice) => {
            const arc = arcs.find((a) => a.slice.id === slice.id);
            const isHovered = hoveredSliceId === slice.id;
            const res = formatExpenseResolutionStatus(slice.amount, slice.status);

            return (
              <li
                key={slice.id}
                className={`breakdown-legend-item ${isHovered ? "is-hovered" : ""} ${res.isUnknown ? "is-unknown" : ""}`}
                onMouseEnter={() => setHoveredSliceId(slice.id)}
                onMouseLeave={() => setHoveredSliceId(null)}
              >
                <div className="legend-item-head">
                  <span
                    className="legend-color-dot"
                    style={{
                      backgroundColor: res.isUnknown ? "#f59e0b" : res.isNotApplicable ? "#94a3b8" : slice.color,
                    }}
                    aria-hidden="true"
                  />
                  <span
                    className="legend-item-name"
                    title={slice.label}
                    data-tooltip={slice.label}
                  >
                    {slice.label}
                  </span>
                </div>

                <div className="legend-item-metrics">
                  <span className={`legend-item-amount ${res.isUnknown ? "warn-pill" : ""}`}>
                    {res.isUnknown || res.isNotApplicable ? res.text : valueFormatter(slice.amount)}
                  </span>
                  {isComplete && totalExpenses != null && totalExpenses > 0 && !res.isNotApplicable && !res.isUnknown ? (
                    <span className="legend-item-share">
                      {arc ? `${arc.percentage.toFixed(1)}%` : "0.0%"}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Profitability Comparison Bar Chart
 * Displays Revenue vs Expenses vs Net Profit in high-visibility bars
 */
export function ProfitComparisonBarChart({
  grossRevenue,
  totalExpenses,
  netIncome,
  marginPercent,
  isComplete,
  unknownList = [],
  dropoffCount = 1,
}: {
  grossRevenue: number | null;
  totalExpenses: number | null;
  netIncome: number | null;
  marginPercent: number | null;
  isComplete: boolean;
  unknownList?: readonly string[];
  dropoffCount?: number;
}) {
  const rev = grossRevenue ?? 0;
  const exp = totalExpenses ?? 0;
  const net = netIncome ?? 0;

  const expensePct = rev > 0 && isComplete ? Math.min(100, (exp / rev) * 100) : 0;
  const profitPct = rev > 0 && isComplete ? Math.max(0, (net / rev) * 100) : 0;
  const avgRevPerDropoff = rev > 0 && dropoffCount > 0 ? rev / dropoffCount : 0;

  return (
    <div className="profit-comparison-chart-wrapper">
      <div className="comparison-bars-container">
        {/* Revenue Bar */}
        <div className="comparison-bar-row">
          <div className="comparison-bar-header">
            <span className="bar-label">
              <span className="bar-color-dot revenue-dot" />
              <strong>Revenue</strong>
            </span>
            <strong className="bar-amount revenue-amount">{formatPeso(rev)}</strong>
          </div>
          <div className="comparison-bar-track">
            <div
              className="comparison-bar-fill revenue-fill"
              style={{ width: "100%" }}
            />
          </div>
          <span className="bar-subtext">100% Agreed Customer Billing Baseline</span>
        </div>

        {/* Expenses Bar */}
        <div className="comparison-bar-row">
          <div className="comparison-bar-header">
            <span className="bar-label">
              <span className="bar-color-dot expenses-dot" />
              <strong>Trip Expenses</strong>
            </span>
            <strong className={`bar-amount ${isComplete ? "expenses-amount" : "warn-text"}`}>
              {isComplete ? formatPeso(exp) : "Incomplete"}
            </strong>
          </div>
          <div className="comparison-bar-track">
            {isComplete ? (
              <div
                className="comparison-bar-fill expenses-fill"
                style={{ width: `${expensePct}%` }}
              />
            ) : (
              <div className="comparison-bar-fill pending-fill" style={{ width: "60%" }} />
            )}
          </div>
          <span className="bar-subtext">
            {isComplete
              ? `${expensePct.toFixed(1)}% of Revenue Disbursed for Transit & Labor`
              : `Pending confirmation: ${unknownList.join(", ")}`}
          </span>
        </div>

        {/* Net Profit Bar */}
        <div className="comparison-bar-row">
          <div className="comparison-bar-header">
            <span className="bar-label">
              <span className="bar-color-dot profit-dot" />
              <strong>Net Profit</strong>
            </span>
            <strong className={`bar-amount ${isComplete && net >= 0 ? "profit-amount" : isComplete ? "profit-loss" : "warn-text"}`}>
              {isComplete ? formatPeso(net) : "Incomplete"}
            </strong>
          </div>
          <div className="comparison-bar-track">
            {isComplete && net >= 0 ? (
              <div
                className="comparison-bar-fill profit-fill"
                style={{ width: `${profitPct}%` }}
              />
            ) : isComplete ? (
              <div className="comparison-bar-fill loss-fill" style={{ width: "15%" }} />
            ) : (
              <div className="comparison-bar-fill pending-fill" style={{ width: "40%" }} />
            )}
          </div>
          <span className="bar-subtext">
            {isComplete && marginPercent != null
              ? `${marginPercent.toFixed(1)}% Operating Profit Margin Retained`
              : "Net profit computation deferred until all trip expenses are finalized"}
          </span>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="comparison-meta-grid">
        <div className="comparison-meta-card">
          <span className="meta-card-label">PROFIT MARGIN</span>
          <strong className={`meta-card-val ${isComplete && (marginPercent ?? 0) >= 0 ? "text-success" : isComplete ? "text-danger" : "text-warn"}`}>
            {isComplete && marginPercent != null ? formatPercent(marginPercent) : "Incomplete"}
          </strong>
          <span className="meta-card-sub">
            {isComplete && marginPercent != null
              ? marginPercent >= 20 ? "Strong Margins" : marginPercent >= 0 ? "Standard" : "Operating Loss"
              : "Pending Expenses"}
          </span>
        </div>

        <div className="comparison-meta-card">
          <span className="meta-card-label">AVG PER DROP-OFF</span>
          <strong className="meta-card-val">
            {formatPeso(avgRevPerDropoff)}
          </strong>
          <span className="meta-card-sub">
            {dropoffCount} {dropoffCount === 1 ? "Stop fulfilled" : "Stops fulfilled"}
          </span>
        </div>

        <div className="comparison-meta-card">
          <span className="meta-card-label">RETENTION RATE</span>
          <strong className="meta-card-val">
            {isComplete && marginPercent != null
              ? `₱${((marginPercent / 100) * 100).toFixed(1)} / ₱100`
              : "—"}
          </strong>
          <span className="meta-card-sub">Net kept per ₱100 revenue</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Delivery Financial Breakdown Component
 * Elevated into an executive, high-visibility analytics showcase
 */
export function DeliveryFinancialBreakdown({
  trip,
}: {
  trip: DeliveryTripRecord & {
    driverName?: string | null;
    helperName?: string | null;
  };
}) {
  const model = useMemo(() => resolveTripFinancialGroups(trip), [trip]);
  const [chartView, setChartView] = useState<"distribution" | "comparison">("distribution");

  return (
    <div className="delivery-breakdown-wrapper">
      {/* 1. Incomplete Alert Banner if any unknown expense exists */}
      {!model.isFinanciallyComplete ? (
        <div className="breakdown-alert-incomplete" role="alert">
          <span className="alert-icon" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d97706"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <div className="alert-text">
            <strong>Incomplete Financial Record</strong>
            <p>
              Unconfirmed expenses: {model.unknownList.join(", ")}. Totals require confirmed expenses.
            </p>
          </div>
        </div>
      ) : null}

      {/* 2. Hero Summary Metrics Bar (Prominent Monetary Figures Across Full Width) */}
      <div className="breakdown-hero-metrics">
        {/* Revenue */}
        <div className="hero-metric-card revenue-card">
          <span className="hero-metric-eyebrow">REVENUE</span>
          <div
            className="hero-metric-amount revenue-text"
            title={model.grossRevenue != null ? `Delivery revenue: ${formatPeso(model.grossRevenue)} agreed customer billing` : "Revenue pending specification"}
          >
            {model.grossRevenue != null ? formatPeso(model.grossRevenue) : "₱0.00"}
          </div>
          <span className="hero-metric-sub">
            Agreed billing rate per waybill
          </span>
        </div>

        {/* Expenses */}
        <div className="hero-metric-card expenses-card">
          <span className="hero-metric-eyebrow">EXPENSES</span>
          <div
            className={`hero-metric-amount ${model.isFinanciallyComplete ? "expenses-text" : "warn-text"}`}
            title={
              model.isFinanciallyComplete
                ? `Confirmed trip expenses: ${formatPeso(model.totalExpenses)}`
                : `Trip expenses incomplete: ${model.unknownList.join(", ")} pending confirmation`
            }
          >
            {model.isFinanciallyComplete && model.totalExpenses != null
              ? formatPeso(model.totalExpenses)
              : "Incomplete"}
          </div>
          <span className="hero-metric-sub">
            {model.isFinanciallyComplete ? "Verified trip disbursements" : "Pending expense resolution"}
          </span>
        </div>

        {/* Net Profit */}
        <div className="hero-metric-card profit-card">
          <span className="hero-metric-eyebrow">NET PROFIT</span>
          <div
            className={`hero-metric-amount ${
              model.isFinanciallyComplete && model.netIncome != null && model.netIncome >= 0
                ? "profit-positive"
                : model.isFinanciallyComplete
                ? "profit-negative"
                : "warn-text"
            }`}
            title={
              model.isFinanciallyComplete && model.netIncome != null
                ? `Net profit: ${formatPeso(model.netIncome)} (Delivery Revenue − Trip Expenses)`
                : "Net profit computation deferred until all trip expenses are confirmed"
            }
          >
            {model.isFinanciallyComplete && model.netIncome != null
              ? formatPeso(model.netIncome)
              : "Incomplete"}
          </div>
          <div className="hero-metric-badges">
            {model.isFinanciallyComplete && model.marginPercent != null ? (
              <span
                className={`margin-pill ${
                  model.marginPercent >= 15 ? "pill-success" : model.marginPercent >= 0 ? "pill-neutral" : "pill-warn"
                }`}
                title={`Profit margin: ${formatPercent(model.marginPercent)}`}
              >
                {formatPercent(model.marginPercent)} Profit Margin
              </span>
            ) : (
              <span className="margin-pill pill-warn" title="Profit margin deferred until expenses are resolved">
                Incomplete Profit Margin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Visual Revenue Realization / Flow Allocation Bar */}
      <div className="revenue-flow-bar-container">
        <div className="revenue-flow-header">
          <span className="flow-title">Revenue Realization &amp; Allocation</span>
          <span className="flow-badge">
            {model.isFinanciallyComplete && model.marginPercent != null
              ? `${model.marginPercent.toFixed(1)}% Retained Profit`
              : "Pending Resolution"}
          </span>
        </div>
        <div className="revenue-flow-track" role="progressbar" aria-label="Revenue allocation breakdown">
          {model.isFinanciallyComplete && model.grossRevenue && model.totalExpenses != null ? (
            <>
              <div
                className="flow-segment expenses-segment"
                style={{
                  width: `${Math.min(100, Math.max(0, (model.totalExpenses / model.grossRevenue) * 100))}%`,
                }}
                title={`Trip Expenses: ${formatPeso(model.totalExpenses)} (${((model.totalExpenses / model.grossRevenue) * 100).toFixed(1)}%)`}
              >
                <span className="flow-segment-text">
                  Expenses {((model.totalExpenses / model.grossRevenue) * 100).toFixed(1)}%
                </span>
              </div>
              <div
                className="flow-segment profit-segment"
                style={{
                  width: `${Math.min(100, Math.max(0, ((model.grossRevenue - model.totalExpenses) / model.grossRevenue) * 100))}%`,
                }}
                title={`Net Profit: ${formatPeso(model.netIncome ?? 0)} (${(model.marginPercent ?? 0).toFixed(1)}%)`}
              >
                <span className="flow-segment-text">
                  Profit {(model.marginPercent ?? 0).toFixed(1)}%
                </span>
              </div>
            </>
          ) : (
            <div className="flow-segment pending-segment" style={{ width: "100%" }}>
              <span className="flow-segment-text">Financial allocation deferred until unknown expenses are finalized</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Main Analytics Showcase: Large Interactive Chart on Left + Itemized Breakdown on Right */}
      <div className="breakdown-main-showcase">
        {/* Left: Large Chart Card */}
        <section className="breakdown-chart-showcase-card" aria-label="Financial Visualization">
          <div className="section-head-compact chart-head-toggle-wrap">
            <div className="chart-view-tabs" role="tablist" aria-label="Chart display mode">
              <button
                type="button"
                role="tab"
                aria-selected={chartView === "distribution"}
                className={`chart-tab-btn ${chartView === "distribution" ? "active" : ""}`}
                onClick={() => setChartView("distribution")}
              >
                Expense Distribution
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={chartView === "comparison"}
                className={`chart-tab-btn ${chartView === "comparison" ? "active" : ""}`}
                onClick={() => setChartView("comparison")}
              >
                Profitability Comparison
              </button>
            </div>
            <span className="section-tag">
              {model.isFinanciallyComplete ? "Verified Data" : "Pending Verification"}
            </span>
          </div>

          {chartView === "distribution" ? (
            <ExpenseDonutPieChart
              slices={model.expenseSlices}
              totalExpenses={model.totalExpenses}
              isComplete={model.isFinanciallyComplete}
              unknownItems={model.unknownList}
              title={`Expense Distribution for Waybill ${trip.waybillNumber}`}
              size="large"
            />
          ) : (
            <ProfitComparisonBarChart
              grossRevenue={model.grossRevenue}
              totalExpenses={model.totalExpenses}
              netIncome={model.netIncome}
              marginPercent={model.marginPercent}
              isComplete={model.isFinanciallyComplete}
              unknownList={model.unknownList}
              dropoffCount={trip.dropoffs.length}
            />
          )}
        </section>

        {/* Right: Itemized Financial Breakdown Groups */}
        <div className="breakdown-groups-column">
          {/* GROUP A: Direct Transit & Facility Expenses */}
          <div className="breakdown-group-card">
            <div className="group-card-header">
              <div>
                <span className="group-eyebrow">DIRECT TRANSIT</span>
                <h4 className="group-title">Transit &amp; Facility Expenses</h4>
              </div>
              {model.isTransitComplete && model.transitSubtotal != null ? (
                <span className="group-subtotal">{formatPeso(model.transitSubtotal)}</span>
              ) : (
                <span className="badge-warn">Incomplete</span>
              )}
            </div>

            <div className="group-items-list">
              {/* Diesel Fuel */}
              <div className="breakdown-item-row">
                <div className="item-meta">
                  <span className="item-color-indicator" style={{ backgroundColor: "#f59e0b" }} />
                  <div>
                    <span className="item-name">Diesel Fuel</span>
                    <span className="item-detail">
                      {trip.fuelRate ? `Fuel rate: ₱${trip.fuelRate.toFixed(2)}/L` : "Trip fuel consumption"}
                    </span>
                  </div>
                </div>
                <div className="item-value-box">
                  {trip.expenseStates.dieselExpenses === "unknown" ? (
                    <span className="badge-warn" title="Pending confirmation: Fuel receipt amount requires confirmation">Unconfirmed</span>
                  ) : trip.expenseStates.dieselExpenses === "not_applicable" ? (
                    <span className="badge-neutral" title="Not applicable: Fuel cost not charged for this trip">Not applicable</span>
                  ) : (
                    <span className="item-val-bold">{formatPeso(trip.expenses.dieselExpenses)}</span>
                  )}
                </div>
              </div>

              {/* Highway Tolls */}
              <div className="breakdown-item-row">
                <div className="item-meta">
                  <span className="item-color-indicator" style={{ backgroundColor: "#6366f1" }} />
                  <div>
                    <span className="item-name">Highway Tolls</span>
                    <span className="item-detail">
                      {trip.expenses.tollGateBreakdown || "Expressways & pass gates"}
                    </span>
                  </div>
                </div>
                <div className="item-value-box">
                  {trip.expenseStates.tollGateExpenses === "unknown" ? (
                    <span className="badge-warn" title="Pending confirmation: Toll gate expenses require confirmation">Unconfirmed</span>
                  ) : trip.expenseStates.tollGateExpenses === "not_applicable" ? (
                    <span className="badge-neutral" title="Not applicable: No highway toll routes used">Not applicable</span>
                  ) : (
                    <span className="item-val-bold">{formatPeso(trip.expenses.tollGateExpenses)}</span>
                  )}
                </div>
              </div>

              {/* Store Entry Fees */}
              <div className="breakdown-item-row">
                <div className="item-meta">
                  <span className="item-color-indicator" style={{ backgroundColor: "#10b981" }} />
                  <div>
                    <span className="item-name">Store Entry Fees</span>
                    <span className="item-detail">
                      {trip.dropoffs.length} store drop-off point{trip.dropoffs.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="item-value-box">
                  {trip.expenseStates.entryFees === "unknown" ? (
                    <span className="badge-warn" title="Pending confirmation: Store entry fees require confirmation">Unconfirmed</span>
                  ) : trip.expenseStates.entryFees === "not_applicable" ? (
                    <span className="badge-neutral" title="Not applicable: No store entry fees charged on this route">Not applicable</span>
                  ) : (
                    <span className="item-val-bold">{formatPeso(trip.expenses.entryFees)}</span>
                  )}
                </div>
              </div>

              {/* Other Expenses */}
              <div className="breakdown-item-row">
                <div className="item-meta">
                  <span className="item-color-indicator" style={{ backgroundColor: "#8b5cf6" }} />
                  <div>
                    <span className="item-name">Other Expenses</span>
                    <span className="item-detail">Incidentals, permits, parking</span>
                  </div>
                </div>
                <div className="item-value-box">
                  {trip.expenseStates.otherExpenses === "unknown" ? (
                    <span className="badge-warn" title="Pending confirmation: Incidentals and other expenses require confirmation">Unconfirmed</span>
                  ) : trip.expenseStates.otherExpenses === "not_applicable" ? (
                    <span className="badge-neutral" title="Not applicable: No other incidentals incurred">Not applicable</span>
                  ) : (
                    <span className="item-val-bold">{formatPeso(trip.expenses.otherExpenses)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* GROUP B: Crew Compensation & Labor Costs */}
          <div className="breakdown-group-card">
            <div className="group-card-header">
              <div>
                <span className="group-eyebrow">CREW COMPENSATION</span>
                <h4 className="group-title">Crew Compensation</h4>
              </div>
              {model.isCrewComplete && model.crewSubtotal != null ? (
                <span className="group-subtotal">{formatPeso(model.crewSubtotal)}</span>
              ) : (
                <span className="badge-warn" title="Crew compensation incomplete: Requires driver or helper cost confirmation">Incomplete</span>
              )}
            </div>

            <div className="group-items-list">
              {/* Driver Compensation */}
              <div className="breakdown-crew-card">
                <div className="crew-card-head">
                  <div className="item-meta">
                    <span className="item-color-indicator" style={{ backgroundColor: "#0284c7" }} />
                    <div>
                      <span className="item-name">Driver Compensation</span>
                      {trip.driverName ? <span className="item-detail">{trip.driverName}</span> : null}
                    </div>
                  </div>
                  <div className="item-value-box">
                    {!model.isDriverComplete ? (
                      <span className="badge-warn" title="Pending confirmation: Driver wage or allowance requires confirmation">Unconfirmed</span>
                    ) : model.driverTotal === 0 && trip.expenseStates.driverDailyRate === "not_applicable" ? (
                      <span className="badge-neutral" title="Not applicable: Driver compensation handled outside trip expenses">Not applicable</span>
                    ) : (
                      <span className="item-val-bold">{formatPeso(model.driverTotal)}</span>
                    )}
                  </div>
                </div>

                {/* Sub-breakdown: Daily Rate + Allowance */}
                <div className="crew-sub-pills">
                  <div className="crew-sub-pill">
                    <span className="sub-label">Daily Wage:</span>
                    <span
                      className="sub-val"
                      title={
                        trip.expenseStates.driverDailyRate === "unknown"
                          ? "Pending confirmation: Driver daily wage requires confirmation"
                          : trip.expenseStates.driverDailyRate === "not_applicable"
                          ? "Not applicable"
                          : undefined
                      }
                    >
                      {trip.expenseStates.driverDailyRate === "unknown"
                        ? "Unconfirmed"
                        : trip.expenseStates.driverDailyRate === "not_applicable"
                        ? "N/A"
                        : formatPeso(trip.expenses.driverDailyRate)}
                    </span>
                  </div>
                  <div className="crew-sub-pill">
                    <span className="sub-label">Trip Allowance:</span>
                    <span
                      className="sub-val"
                      title={
                        trip.expenseStates.driverAllowance === "unknown"
                          ? "Pending confirmation: Driver trip allowance requires confirmation"
                          : trip.expenseStates.driverAllowance === "not_applicable"
                          ? "Not applicable"
                          : undefined
                      }
                    >
                      {trip.expenseStates.driverAllowance === "unknown"
                        ? "Unconfirmed"
                        : trip.expenseStates.driverAllowance === "not_applicable"
                        ? "N/A"
                        : formatPeso(trip.expenses.driverAllowance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Helper Compensation */}
              <div className="breakdown-crew-card">
                <div className="crew-card-head">
                  <div className="item-meta">
                    <span className="item-color-indicator" style={{ backgroundColor: "#0d9488" }} />
                    <div>
                      <span className="item-name">Helper Compensation</span>
                      {trip.helperName ? <span className="item-detail">{trip.helperName}</span> : <span className="item-detail" title="Solo driver run — no helper assigned">None assigned</span>}
                    </div>
                  </div>
                  <div className="item-value-box">
                    {!model.isHelperComplete ? (
                      <span className="badge-warn" title="Pending confirmation: Helper wage or allowance requires confirmation">Unconfirmed</span>
                    ) : model.helperTotal === 0 && trip.expenseStates.helperDailyRate === "not_applicable" ? (
                      <span className="badge-neutral" title="Not applicable: No helper compensation for this delivery">Not applicable</span>
                    ) : (
                      <span className="item-val-bold">{formatPeso(model.helperTotal)}</span>
                    )}
                  </div>
                </div>

                {/* Sub-breakdown: Daily Rate + Allowance */}
                <div className="crew-sub-pills">
                  <div className="crew-sub-pill">
                    <span className="sub-label">Daily Wage:</span>
                    <span
                      className="sub-val"
                      title={
                        trip.expenseStates.helperDailyRate === "unknown"
                          ? "Pending confirmation: Helper daily wage requires confirmation"
                          : trip.expenseStates.helperDailyRate === "not_applicable"
                          ? "Not applicable"
                          : undefined
                      }
                    >
                      {trip.expenseStates.helperDailyRate === "unknown"
                        ? "Unconfirmed"
                        : trip.expenseStates.helperDailyRate === "not_applicable"
                        ? "N/A"
                        : formatPeso(trip.expenses.helperDailyRate)}
                    </span>
                  </div>
                  <div className="crew-sub-pill">
                    <span className="sub-label">Trip Allowance:</span>
                    <span
                      className="sub-val"
                      title={
                        trip.expenseStates.helperAllowance === "unknown"
                          ? "Pending confirmation: Helper trip allowance requires confirmation"
                          : trip.expenseStates.helperAllowance === "not_applicable"
                          ? "Not applicable"
                          : undefined
                      }
                    >
                      {trip.expenseStates.helperAllowance === "unknown"
                        ? "Unconfirmed"
                        : trip.expenseStates.helperAllowance === "not_applicable"
                        ? "N/A"
                        : formatPeso(trip.expenses.helperAllowance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable Component for Aggregate KPI Expense Drawer
 */
export function AggregateExpenseBreakdown({
  summary,
  kpiBreakdown,
}: {
  summary: { rateTotal: number; expenseTotal: number; netTotal: number };
  kpiBreakdown: {
    diesel: number;
    toll: number;
    entryFees: number;
    driverTotal: number;
    helperTotal: number;
    otherExpenses: number;
    finalizedCount: number;
    incompleteCount: number;
    avgExpensePerTrip: number;
    avgExpensePerStop: number;
  };
}) {
  const slices: ExpenseCategorySlice[] = [
    {
      id: "diesel",
      label: "Diesel Fuel",
      amount: kpiBreakdown.diesel,
      color: "#f59e0b",
      status: "confirmed",
    },
    {
      id: "tolls",
      label: "Highway Tolls",
      amount: kpiBreakdown.toll,
      color: "#6366f1",
      status: "confirmed",
    },
    {
      id: "entry_fees",
      label: "Store Entry Fees",
      amount: kpiBreakdown.entryFees,
      color: "#10b981",
      status: "confirmed",
    },
    {
      id: "driver",
      label: "Driver Crew",
      amount: kpiBreakdown.driverTotal,
      color: "#0284c7",
      status: "confirmed",
    },
    {
      id: "helper",
      label: "Helper Crew",
      amount: kpiBreakdown.helperTotal,
      color: "#0d9488",
      status: "confirmed",
    },
    {
      id: "other",
      label: "Other Expenses",
      amount: kpiBreakdown.otherExpenses,
      color: "#8b5cf6",
      status: "confirmed",
    },
  ];

  return (
    <div className="aggregate-expense-breakdown">
      <ExpenseDonutPieChart
        slices={slices}
        totalExpenses={summary.expenseTotal}
        isComplete={true}
        title="Overall Trip Expenses Distribution"
        size="standard"
      />
    </div>
  );
}
