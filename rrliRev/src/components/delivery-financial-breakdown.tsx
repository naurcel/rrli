"use client";

import { useId, useMemo, useState } from "react";
import type {
  DeliveryTripRecord,
  ExpenseResolutionStatus,
} from "@/features/deliveries/delivery-domain";
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
 */
export function ExpenseDonutPieChart({
  slices,
  totalExpenses,
  isComplete,
  unknownItems = [],
  title = "Trip Expenses Breakdown",
}: {
  slices: readonly ExpenseCategorySlice[];
  totalExpenses: number | null;
  isComplete: boolean;
  unknownItems?: readonly string[];
  title?: string;
}) {
  const chartId = useId();
  const [hoveredSliceId, setHoveredSliceId] = useState<string | null>(null);

  const arcs = useMemo(() => {
    if (!isComplete || totalExpenses == null || totalExpenses <= 0) {
      return [];
    }
    return computeDonutArcs(slices, totalExpenses);
  }, [slices, totalExpenses, isComplete]);

  const activeHovered = useMemo(() => {
    if (!hoveredSliceId) return null;
    return arcs.find((a) => a.slice.id === hoveredSliceId) ?? null;
  }, [arcs, hoveredSliceId]);

  return (
    <div className="breakdown-chart-wrapper">
      <div className="breakdown-donut-container">
        <svg
          className="breakdown-donut-svg"
          viewBox="0 0 200 200"
          role="img"
          aria-labelledby={`${chartId}-title ${chartId}-desc`}
        >
          <title id={`${chartId}-title`}>{title}</title>
          <desc id={`${chartId}-desc`}>
            {isComplete && totalExpenses != null
              ? `Interactive donut chart displaying expense categories totaling ${formatPeso(totalExpenses)}.`
              : "Expense visualization deferred due to unconfirmed expenses."}
          </desc>

          {/* Background circle / empty track */}
          <circle
            cx="100"
            cy="100"
            r="64"
            fill="none"
            stroke="var(--color-border, rgba(148, 163, 184, 0.2))"
            strokeWidth="28"
          />

          {!isComplete ? (
            /* Incomplete / Unconfirmed state */
            <g className="donut-incomplete-group">
              <circle
                cx="100"
                cy="100"
                r="64"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="28"
                strokeDasharray="8 6"
                opacity="0.85"
              />
              <text
                x="100"
                y="94"
                textAnchor="middle"
                className="donut-center-hero-warn"
              >
                ⚠️
              </text>
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
              <text
                x="100"
                y="95"
                textAnchor="middle"
                className="donut-center-hero-val"
              >
                ₱0.00
              </text>
              <text
                x="100"
                y="114"
                textAnchor="middle"
                className="donut-center-sub"
              >
                Zero Expenses
              </text>
            </g>
          ) : (
            /* Confirmed expense arcs */
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
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    tabIndex={0}
                    role="graphics-symbol"
                    aria-label={`${arc.slice.label}: ${formatPeso(arc.slice.amount)} (${arc.percentage.toFixed(1)}%)`}
                    onMouseEnter={() => setHoveredSliceId(arc.slice.id)}
                    onMouseLeave={() => setHoveredSliceId(null)}
                    onFocus={() => setHoveredSliceId(arc.slice.id)}
                    onBlur={() => setHoveredSliceId(null)}
                  />
                );
              })}

              {/* Center Readout */}
              {activeHovered ? (
                <g className="donut-center-active">
                  <text
                    x="100"
                    y="93"
                    textAnchor="middle"
                    className="donut-center-hero-val"
                  >
                    {formatPeso(activeHovered.slice.amount)}
                  </text>
                  <text
                    x="100"
                    y="112"
                    textAnchor="middle"
                    className="donut-center-sub"
                  >
                    {activeHovered.percentage.toFixed(1)}% · {activeHovered.slice.label}
                  </text>
                </g>
              ) : (
                <g className="donut-center-default">
                  <text
                    x="100"
                    y="93"
                    textAnchor="middle"
                    className="donut-center-hero-val"
                  >
                    {formatPeso(totalExpenses)}
                  </text>
                  <text
                    x="100"
                    y="112"
                    textAnchor="middle"
                    className="donut-center-sub"
                  >
                    Total Expenses
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Legend & Breakdown Items */}
      <div className="breakdown-legend-container">
        {!isComplete ? (
          <div className="breakdown-incomplete-notice">
            <span className="notice-icon">⚠️</span>
            <div>
              <p className="notice-title">Expense distribution deferred</p>
              <p className="notice-body">
                This record contains {unknownItems.length} unconfirmed expense item{unknownItems.length === 1 ? "" : "s"} ({unknownItems.join(", ")}). Percentages cannot be calculated until all expenses are confirmed to avoid misrepresenting cost distribution.
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
                  <span className="legend-item-name">{slice.label}</span>
                </div>

                <div className="legend-item-metrics">
                  <span className={`legend-item-amount ${res.isUnknown ? "warn-pill" : ""}`}>
                    {res.text}
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
 * Main Delivery Financial Breakdown Component
 * Organizes financials into logical groups, increases monetary visibility,
 * removes excessive whitespace, provides an interactive expense pie chart,
 * and handles unknown/incomplete values without treating them as zero.
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

  return (
    <div className="delivery-breakdown-wrapper">
      {/* 1. Incomplete Alert Banner if any unknown expense exists */}
      {!model.isFinanciallyComplete ? (
        <div className="breakdown-alert-incomplete" role="alert">
          <span className="alert-icon">⚠️</span>
          <div className="alert-text">
            <strong>Incomplete Financial Record</strong>
            <p>
              Trip contains unconfirmed expenses ({model.unknownList.join(", ")}). Operational totals and expense distributions cannot be finalized until all expenses are confirmed.
            </p>
          </div>
        </div>
      ) : null}

      {/* 2. Hero Summary Metrics Bar (Prominent Monetary Figures) */}
      <div className="breakdown-hero-metrics">
        {/* Gross Revenue */}
        <div className="hero-metric-card revenue-card">
          <span className="hero-metric-eyebrow">GROSS REVENUE</span>
          <div className="hero-metric-amount revenue-text">
            {model.grossRevenue != null ? formatPeso(model.grossRevenue) : "₱0.00"}
          </div>
          <span className="hero-metric-sub">
            {trip.rateBasis ? `${trip.rateBasis} · ` : ""}Delivery Rate
          </span>
        </div>

        {/* Total Expenses */}
        <div className="hero-metric-card expenses-card">
          <span className="hero-metric-eyebrow">TOTAL EXPENSES</span>
          <div className={`hero-metric-amount ${model.isFinanciallyComplete ? "expenses-text" : "warn-text"}`}>
            {model.isFinanciallyComplete && model.totalExpenses != null
              ? formatPeso(model.totalExpenses)
              : "Unconfirmed"}
          </div>
          <span className="hero-metric-sub">
            {model.isFinanciallyComplete ? "Verified trip disbursements" : "Pending expense entries"}
          </span>
        </div>

        {/* Net Operating Contribution */}
        <div className="hero-metric-card profit-card">
          <span className="hero-metric-eyebrow">NET CONTRIBUTION</span>
          <div
            className={`hero-metric-amount ${
              model.isFinanciallyComplete && model.netIncome != null && model.netIncome >= 0
                ? "profit-positive"
                : model.isFinanciallyComplete
                ? "profit-negative"
                : "warn-text"
            }`}
          >
            {model.isFinanciallyComplete && model.netIncome != null
              ? formatPeso(model.netIncome)
              : "Pending Finalization"}
          </div>
          <div className="hero-metric-badges">
            {model.isFinanciallyComplete && model.marginPercent != null ? (
              <span
                className={`margin-pill ${
                  model.marginPercent >= 15 ? "pill-success" : model.marginPercent >= 0 ? "pill-neutral" : "pill-warn"
                }`}
              >
                {formatPercent(model.marginPercent)} Margin
              </span>
            ) : (
              <span className="margin-pill pill-warn">Pending Margin</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Expense Distribution Pie Chart Section */}
      <section className="breakdown-chart-section" aria-label="Expense Distribution Visualization">
        <div className="section-head-compact">
          <h4 className="section-title">Expense Distribution</h4>
          <span className="section-tag">
            {model.isFinanciallyComplete ? "Verified Distribution" : "Pending Verification"}
          </span>
        </div>
        <ExpenseDonutPieChart
          slices={model.expenseSlices}
          totalExpenses={model.totalExpenses}
          isComplete={model.isFinanciallyComplete}
          unknownItems={model.unknownList}
          title={`Expense Breakdown for Waybill ${trip.waybillNumber}`}
        />
      </section>

      {/* 4. Organized Financial Groups (Itemized Cards) */}
      <div className="breakdown-groups-grid">
        {/* GROUP A: Direct Transit & Facility Expenses */}
        <div className="breakdown-group-card">
          <div className="group-card-header">
            <div>
              <span className="group-eyebrow">DIRECT TRANSIT</span>
              <h4 className="group-title">Transit & Facility Expenses</h4>
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
                  <span className="item-name">Diesel Fuel Expenses</span>
                  <span className="item-detail">
                    {trip.fuelRate ? `Fuel rate: ₱${trip.fuelRate.toFixed(2)}/L` : "Trip fuel consumption"}
                  </span>
                </div>
              </div>
              <div className="item-value-box">
                {trip.expenseStates.dieselExpenses === "unknown" ? (
                  <span className="badge-warn">Unconfirmed</span>
                ) : trip.expenseStates.dieselExpenses === "not_applicable" ? (
                  <span className="badge-neutral">Not applicable</span>
                ) : (
                  <span className="item-val-bold">{formatPeso(trip.expenses.dieselExpenses)}</span>
                )}
              </div>
            </div>

            {/* Toll Gate Charges */}
            <div className="breakdown-item-row">
              <div className="item-meta">
                <span className="item-color-indicator" style={{ backgroundColor: "#6366f1" }} />
                <div>
                  <span className="item-name">Highway Toll Gate Fees</span>
                  <span className="item-detail">
                    {trip.expenses.tollGateBreakdown || "Expressways & pass gates"}
                  </span>
                </div>
              </div>
              <div className="item-value-box">
                {trip.expenseStates.tollGateExpenses === "unknown" ? (
                  <span className="badge-warn">Unconfirmed</span>
                ) : trip.expenseStates.tollGateExpenses === "not_applicable" ? (
                  <span className="badge-neutral">Not applicable</span>
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
                  <span className="badge-warn">Unconfirmed</span>
                ) : trip.expenseStates.entryFees === "not_applicable" ? (
                  <span className="badge-neutral">Not applicable</span>
                ) : (
                  <span className="item-val-bold">{formatPeso(trip.expenses.entryFees)}</span>
                )}
              </div>
            </div>

            {/* Other Trip Expenses */}
            <div className="breakdown-item-row">
              <div className="item-meta">
                <span className="item-color-indicator" style={{ backgroundColor: "#8b5cf6" }} />
                <div>
                  <span className="item-name">Other Trip Expenses</span>
                  <span className="item-detail">Incidentals, permits, parking</span>
                </div>
              </div>
              <div className="item-value-box">
                {trip.expenseStates.otherExpenses === "unknown" ? (
                  <span className="badge-warn">Unconfirmed</span>
                ) : trip.expenseStates.otherExpenses === "not_applicable" ? (
                  <span className="badge-neutral">Not applicable</span>
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
              <span className="group-eyebrow">CREW PAYROLL</span>
              <h4 className="group-title">Crew Compensation & Allowances</h4>
            </div>
            {model.isCrewComplete && model.crewSubtotal != null ? (
              <span className="group-subtotal">{formatPeso(model.crewSubtotal)}</span>
            ) : (
              <span className="badge-warn">Incomplete</span>
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
                    <span className="badge-warn">Unconfirmed</span>
                  ) : model.driverTotal === 0 && trip.expenseStates.driverDailyRate === "not_applicable" ? (
                    <span className="badge-neutral">Not applicable</span>
                  ) : (
                    <span className="item-val-bold">{formatPeso(model.driverTotal)}</span>
                  )}
                </div>
              </div>

              {/* Sub-breakdown: Daily Rate + Allowance */}
              <div className="crew-sub-pills">
                <div className="crew-sub-pill">
                  <span className="sub-label">Daily Wage:</span>
                  <span className="sub-val">
                    {trip.expenseStates.driverDailyRate === "unknown"
                      ? "Unconfirmed"
                      : trip.expenseStates.driverDailyRate === "not_applicable"
                      ? "N/A"
                      : formatPeso(trip.expenses.driverDailyRate)}
                  </span>
                </div>
                <div className="crew-sub-pill">
                  <span className="sub-label">Trip Allowance:</span>
                  <span className="sub-val">
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
                    {trip.helperName ? <span className="item-detail">{trip.helperName}</span> : null}
                  </div>
                </div>
                <div className="item-value-box">
                  {!model.isHelperComplete ? (
                    <span className="badge-warn">Unconfirmed</span>
                  ) : model.helperTotal === 0 && trip.expenseStates.helperDailyRate === "not_applicable" ? (
                    <span className="badge-neutral">Not applicable</span>
                  ) : (
                    <span className="item-val-bold">{formatPeso(model.helperTotal)}</span>
                  )}
                </div>
              </div>

              {/* Sub-breakdown: Daily Rate + Allowance */}
              <div className="crew-sub-pills">
                <div className="crew-sub-pill">
                  <span className="sub-label">Daily Wage:</span>
                  <span className="sub-val">
                    {trip.expenseStates.helperDailyRate === "unknown"
                      ? "Unconfirmed"
                      : trip.expenseStates.helperDailyRate === "not_applicable"
                      ? "N/A"
                      : formatPeso(trip.expenses.helperDailyRate)}
                  </span>
                </div>
                <div className="crew-sub-pill">
                  <span className="sub-label">Trip Allowance:</span>
                  <span className="sub-val">
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
        title="Overall Operating Expense Distribution"
      />
    </div>
  );
}
