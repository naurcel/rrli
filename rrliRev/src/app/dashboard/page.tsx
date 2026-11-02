"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  formatDateRange,
  useGlobalDateRange,
  type DateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import {
  RecordDetailDrawer,
  type DetailSection,
} from "@/components/record-detail-drawer";
import { Icon } from "@/components/route-x-ui";
import type { DeliveryTripRecord } from "@/features/deliveries/delivery-domain";
import { useDeliveryProfitabilitySummary } from "@/features/deliveries/use-delivery-profitability-summary";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import {
  canImportAndReviewExcel,
  canMutateDeliveryRecords,
  canVerifyPodDocuments,
} from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";

function parseDateParts(dateString: string): Date | null {
  const parts = dateString.split("-").map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return null;
}

function formatDashboardDate(dateValue: string): string {
  const d = parseDateParts(dateValue);
  if (d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return dateValue;
}

function buildRevenueSeries(
  deliveries: readonly DeliveryTripRecord[],
  range: DateRange,
): Array<{ date: string; revenue: number }> {
  const amounts = new Map<string, number>();
  deliveries.forEach((trip) => {
    if (trip.deliveryRate && (trip.financialState === "finalized" || !trip.financialState)) {
      amounts.set(trip.deliveryDate, (amounts.get(trip.deliveryDate) ?? 0) + trip.deliveryRate);
    }
  });

  if (range.startDate && range.endDate) {
    const days: Array<{ date: string; revenue: number }> = [];
    const cursor = new Date(range.startDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(range.endDate);
    end.setHours(0, 0, 0, 0);

    let step = 0;
    while (cursor <= end && step < 62) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      const key = `${year}-${month}-${day}`;
      days.push({ date: key, revenue: amounts.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
      step++;
    }
    return days;
  }

  return [...amounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
}

function RevenueChart({
  series,
  periodLabel,
}: {
  series: Array<{ date: string; revenue: number }>;
  periodLabel: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartBoundsRef = useRef<DOMRect | null>(null);
  const width = 720;
  const height = 232;
  const padding = { top: 22, right: 22, bottom: 40, left: 54 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const peak = Math.max(...series.map((point) => point.revenue), 1);
  const ceiling = Math.ceil(peak / 10_000) * 10_000;
  const gridValues = [0, 0.5, 1].map((step) => ceiling * step);
  const coordinates = series.map((point, index) => ({
    ...point,
    x: padding.left + (series.length <= 1 ? innerWidth / 2 : (index / (series.length - 1)) * innerWidth),
    y: padding.top + innerHeight - (point.revenue / ceiling) * innerHeight,
  }));
  const line = coordinates.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = coordinates.length
    ? `${line} L ${coordinates.at(-1)?.x ?? padding.left},${padding.top + innerHeight} L ${coordinates[0]?.x ?? padding.left},${padding.top + innerHeight} Z`
    : "";
  const tickIndexes = Array.from(new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])).filter((index) => index >= 0);
  const selectedPoint = activeIndex === null ? null : coordinates[activeIndex];
  const tooltipWidth = 146;
  const tooltipHeight = 42;
  const tooltipX = selectedPoint
    ? Math.min(Math.max(selectedPoint.x - tooltipWidth / 2, padding.left), width - padding.right - tooltipWidth)
    : 0;
  const tooltipY = selectedPoint ? Math.max(7, selectedPoint.y - tooltipHeight - 12) : 0;

  const selectClosestPoint = (clientX: number, chartBounds: DOMRect) => {
    const x = ((clientX - chartBounds.left) / chartBounds.width) * width;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    coordinates.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    setActiveIndex((currentIndex) => currentIndex === closestIndex ? currentIndex : closestIndex);
  };

  return (
    <section className="records-card revenue-chart-card" aria-labelledby="revenue-over-time-heading">
      <div className="records-heading">
        <div>
          <h2 id="revenue-over-time-heading">Revenue over time</h2>
          <p>{periodLabel} · completed delivery revenue</p>
        </div>
        <div className="chart-legend" aria-label="Chart legend">
          <span><i /> Revenue</span>
          <strong>{formatPeso(series.reduce((total, point) => total + point.revenue, 0))}</strong>
        </div>
      </div>
      {series.length ? (
        <div className="revenue-chart-scroll">
          <svg
            className="revenue-chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Revenue over time for ${periodLabel}`}
            onPointerEnter={(event) => {
              chartBoundsRef.current = event.currentTarget.getBoundingClientRect();
              selectClosestPoint(event.clientX, chartBoundsRef.current);
            }}
            onPointerMove={(event) => {
              const chartBounds = chartBoundsRef.current ?? event.currentTarget.getBoundingClientRect();
              chartBoundsRef.current = chartBounds;
              selectClosestPoint(event.clientX, chartBounds);
            }}
            onPointerLeave={() => {
              chartBoundsRef.current = null;
              setActiveIndex(null);
            }}
          >
            <defs>
              <linearGradient id="revenue-chart-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent-highlight)" stopOpacity=".32" />
                <stop offset="100%" stopColor="var(--color-accent-highlight)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {gridValues.map((value) => {
              const y = padding.top + innerHeight - (value / ceiling) * innerHeight;
              return (
                <g key={value}>
                  <line
                    className="chart-grid-line"
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                  />
                  <text className="chart-axis-label" x={padding.left - 10} y={y + 4} textAnchor="end">
                    {formatPeso(value)}
                  </text>
                </g>
              );
            })}
            <path className="chart-area" d={area} />
            <path className="chart-line" d={line} />
            {coordinates.map((point, index) => {
              const isActive = activeIndex === index;
              return (
                <g
                  className={`chart-point${isActive ? " active" : ""}`}
                  key={point.date}
                  tabIndex={0}
                  aria-label={`${formatDashboardDate(point.date)}: ${formatPeso(point.revenue)}`}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                >
                  <circle cx={point.x} cy={point.y} r="4" />
                  <circle className="chart-point-core" cx={point.x} cy={point.y} r="1.75" />
                </g>
              );
            })}
            {selectedPoint && (
              <g
                className="chart-point-tooltip"
                pointerEvents="none"
                style={{ transform: `translate(${tooltipX}px, ${tooltipY}px)` }}
              >
                <rect width={tooltipWidth} height={tooltipHeight} rx="8" />
                <text className="chart-tooltip-label" x="11" y="16">
                  {formatDashboardDate(selectedPoint.date)}
                </text>
                <text className="chart-tooltip-value" x="11" y="31">
                  {formatPeso(selectedPoint.revenue)}
                </text>
              </g>
            )}
            {tickIndexes.map((index) => {
              const point = coordinates[index];
              return (
                <text
                  className="chart-axis-label"
                  key={point.date}
                  x={point.x}
                  y={height - 13}
                  textAnchor="middle"
                >
                  {formatDashboardDate(point.date).replace(/, \d{4}$/, "")}
                </text>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="empty-state chart-empty-state">
          <strong>No revenue in this range</strong>
          <span>Choose a wider date range to view the trend.</span>
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const actor = useAuthenticatedActor();
  const { range } = useGlobalDateRange();
  const { deliveries, loading, error } = usePersistedDeliveries(range);
  const { summary: persistedSummary } = useDeliveryProfitabilitySummary(range);
  const [selectedTrip, setSelectedTrip] = useState<DeliveryTripRecord | null>(null);
  const [accessNoticeDismissed, setAccessNoticeDismissed] = useState(false);

  const filteredDeliveries = deliveries;

  const rangeKey = `${range.startDate?.getTime() ?? "all"}-${range.endDate?.getTime() ?? "all"}`;

  const totals = useMemo(() => {
    const finalized = filteredDeliveries.filter((item) => item.financialState === "finalized");
    const fallbackEarnings = finalized.reduce((sum, item) => sum + (item.deliveryRate ?? 0), 0);
    const fallbackExpenses = finalized.reduce((sum, item) => sum + (item.totalExpenses ?? 0), 0);
    const earnings = persistedSummary?.revenue ?? fallbackEarnings;
    const expenses = persistedSummary?.expenses ?? fallbackExpenses;
    const netIncome = persistedSummary?.netIncome ?? earnings - expenses;
    const margin = persistedSummary?.profitMargin ?? (earnings > 0 ? ((netIncome / earnings) * 100) : null);
    const totalStops = filteredDeliveries.reduce((sum, item) => sum + item.dropoffs.length, 0);
    const unverifiedTrips = filteredDeliveries.filter((item) => item.podStatus !== "Verified").length;
    const finalizedCount = persistedSummary?.deliveries ?? finalized.length;

    return {
      earnings,
      expenses,
      netIncome,
      margin,
      totalStops,
      unverifiedTrips,
      finalizedCount,
      totalTrips: filteredDeliveries.length,
    };
  }, [filteredDeliveries, persistedSummary]);

  const revenueSeries = useMemo(
    () => buildRevenueSeries(filteredDeliveries, range),
    [filteredDeliveries, range],
  );

  const truckRankings = persistedSummary?.trucks ?? [];

  const canWrite = canMutateDeliveryRecords(actor.role);
  const canImport = canImportAndReviewExcel(actor.role);
  const canVerifyPod = canVerifyPodDocuments(actor.role);

  const drawerSections: DetailSection[] = useMemo(() => {
    if (!selectedTrip) {
      return [];
    }

    return [
      {
        title: "Delivery & Truck Context",
        rows: [
          { label: "Waybill Number", value: selectedTrip.waybillNumber },
          { label: "Delivery Date", value: selectedTrip.deliveryDate },
          { label: "Client", value: selectedTrip.clientName },
          {
            label: "Truck & Type",
            value: `${selectedTrip.plateNumber} (${selectedTrip.truckType})`,
          },
          { label: "Temperature", value: selectedTrip.truckTemperature },
          { label: "Origin", value: selectedTrip.origin },
          {
            label: "Distance & Fuel Rate",
            value: `${selectedTrip.distanceKm} km @ ₱${selectedTrip.fuelRate.toFixed(2)}/L`,
          },
        ],
      },
      {
        title: `Store Drop-offs (${selectedTrip.dropoffs.length} stops)`,
        rows: selectedTrip.dropoffs.map((stop) => ({
          label: `Stop #${stop.sequence}: ${stop.storeName} (${stop.destinationArea})`,
          value: `${stop.podSubmitted && stop.supportingDocsComplete ? "POD Verified" : "Follow-up"} · Entry ${formatPeso(stop.entryFee)}`,
          tone:
            stop.podSubmitted && stop.supportingDocsComplete
              ? ("success" as const)
              : ("warning" as const),
        })),
      },
      {
        title: "Daily Trip Report Financials",
        rows: [
          { label: "Delivery Rate (Earnings)", value: formatPeso(selectedTrip.deliveryRate), tone: "success" },
          { label: "Diesel Expenses", value: formatPeso(selectedTrip.expenses.dieselExpenses) },
          {
            label: "Toll Gate Expenses",
            value: `${formatPeso(selectedTrip.expenses.tollGateExpenses)} (${selectedTrip.expenses.tollGateBreakdown || "Standard"})`,
          },
          { label: "Store Entry Fees", value: formatPeso(selectedTrip.expenses.entryFees) },
          {
            label: "Driver Daily Rate + Allowance",
            value: `${formatPeso(selectedTrip.expenses.driverDailyRate)} + ${formatPeso(selectedTrip.expenses.driverAllowance)}`,
          },
          {
            label: "Helper Daily Rate + Allowance",
            value: `${formatPeso(selectedTrip.expenses.helperDailyRate)} + ${formatPeso(selectedTrip.expenses.helperAllowance)}`,
          },
          { label: "Other Expenses", value: formatPeso(selectedTrip.expenses.otherExpenses) },
          { label: "Total Trip Expenses", value: formatPeso(selectedTrip.totalExpenses) },
          {
            label: "Net Truck Income",
            value: `${formatPeso(selectedTrip.netIncome)} (${formatPercent(selectedTrip.marginPercent)})`,
            tone: selectedTrip.netIncome !== null && selectedTrip.netIncome >= 0 ? "success" : "warning",
          },
        ],
      },
    ];
  }, [selectedTrip]);

  return (
    <>
      <OperationalTopbar contextLabel="Delivery Operations & Truck Profitability" />

      <div key={rangeKey} className="content-wrap dashboard-range-refresh">
        <header className="page-intro dashboard-welcome">
          <div>
            <p className="eyebrow">DELIVERY OPERATIONS & TRUCK PROFITABILITY</p>
            <h1>Welcome back, {actor.fullName.split(" ")[0]}</h1>
            <p className="subtitle">
              Track completed client deliveries, multi-store drop-offs, itemized trip expenses,
              POD verification, and per-truck net profitability.
            </p>
          </div>
          {canWrite ? (
            <div className="fleet-intro-actions">
              <Link className="secondary-button" href="/deliveries/import">
                Import Excel Trip Report
              </Link>
              <Link className="primary-action-button" href="/deliveries">
                + Record Delivery
              </Link>
            </div>
          ) : (
            <span className="settings-readonly-pill">
              View-Only Mode ({actor.roleLabel})
            </span>
          )}
        </header>

        {error ? (
          <section className="notice" role="alert">
            <span className="notice-icon" aria-hidden="true">!</span>
            <div><strong>Delivery data unavailable:</strong><span>{error}</span></div>
          </section>
        ) : loading ? (
          <section className="notice loading-notice" role="status">
            <span className="notice-icon loading-spin" aria-hidden="true">◌</span>
            <div><strong>Loading completed deliveries:</strong><span>Refreshing the selected reporting range.</span></div>
          </section>
        ) : null}

        {!accessNoticeDismissed && actor.accessLevel === "view_only" ? (
          <section className="notice" role="status">
            <span className="notice-icon" aria-hidden="true">
              i
            </span>
            <div>
              <strong>View-Only Access ({actor.roleLabel}):</strong>
              <span>
                You can inspect all delivery records, store drop-offs, POD verification statuses,
                truck profitability metrics, and reports. Creating, editing, or importing records
                is restricted to Operations and Admin personnel.
              </span>
            </div>
            <button
              type="button"
              aria-label="Dismiss notice"
              onClick={() => setAccessNoticeDismissed(true)}
            >
              ×
            </button>
          </section>
        ) : null}

        <section
          className={`dashboard-overview-grid${loading ? " is-page-loading" : ""}`}
          aria-label="Performance and profitability overview"
        >
          <RevenueChart
            series={revenueSeries}
            periodLabel={formatDateRange(range)}
          />

          <section
            className="dashboard-kpi-grid"
            aria-label="Delivery profitability summary"
          >
            <Link
              className="stat-card stat-card-link"
              href="/deliveries"
              title="View completed delivery earnings & records breakdown"
            >
              <span className="stat-label">TOTAL DELIVERY EARNINGS</span>
              <strong>{formatPeso(totals.earnings)}</strong>
              <span
                className={`stat-meta ${totals.finalizedCount > 0 ? "positive" : ""}`}
              >
                {totals.finalizedCount > 0
                  ? `${totals.finalizedCount} ${totals.finalizedCount === 1 ? "trip" : "trips"} · ${totals.totalStops} store drop-offs`
                  : "0 trips recorded in selected range"}
              </span>
            </Link>

            <Link
              className="stat-card stat-card-link"
              href="/reports?tab=truck-profitability"
              title="View itemized operational & trip expense reports breakdown"
            >
              <span className="stat-label">TOTAL TRIP EXPENSES</span>
              <strong>{formatPeso(totals.expenses)}</strong>
              <span className="stat-meta">
                Diesel, toll gates, entry fees & crew costs
              </span>
            </Link>

            <Link
              className="stat-card stat-card-link"
              href="/truck-profitability"
              title="View truck profitability & net income showcase"
            >
              <span className="stat-label">NET TRUCK INCOME</span>
              <strong>{formatPeso(totals.netIncome)}</strong>
              <span
                className={`stat-meta ${
                  totals.earnings > 0 && totals.netIncome > 0
                    ? "positive"
                    : totals.netIncome < 0
                      ? "warning"
                      : ""
                }`}
              >
                {totals.earnings > 0 && totals.margin !== null
                  ? `${formatPercent(totals.margin)} overall truck profit margin`
                  : totals.netIncome < 0 && totals.margin !== null
                    ? `${formatPercent(totals.margin)} net loss margin`
                    : "Net profitability after trip costs"}
              </span>
            </Link>

            <Link
              className="stat-card stat-card-link"
              href="/pod-documents"
              title="View store drop-offs & POD document verification showcase"
            >
              <span className="stat-label">STORE DROP-OFFS & PODS</span>
              <strong>{totals.totalStops} stores</strong>
              <span
                className={`stat-meta ${
                  totals.totalTrips === 0
                    ? ""
                    : totals.unverifiedTrips > 0
                      ? "warning"
                      : "positive"
                }`}
              >
                {totals.totalTrips === 0
                  ? "Across 0 completed deliveries"
                  : totals.unverifiedTrips > 0
                    ? `${totals.unverifiedTrips} ${totals.unverifiedTrips === 1 ? "trip" : "trips"} pending POD check`
                    : "All store documents verified"}
              </span>
            </Link>
          </section>
        </section>

        {totals.unverifiedTrips > 0 ? (
          <section
            className="records-card dashboard-attention"
            aria-label="Attention needed"
          >
            <div className="records-heading">
              <div>
                <h2>Attention Needed</h2>
                <p>Document verification and trip profitability follow-ups</p>
              </div>
            </div>
            <div className="attention-grid">
              <Link
                href="/pod-documents"
                className="attention-item attention-link"
              >
                <strong>
                  {totals.unverifiedTrips} deliveries with incomplete POD or supporting docs
                </strong>
                <span>
                  Verify stamped store receiving slips and waybill attachments in POD / Documents
                </span>
              </Link>
              <Link
                href="/deliveries"
                className="attention-item attention-link"
              >
                <strong>Multi-store client trip review</strong>
                <span>
                  Organize completed deliveries by client, waybill, and store drop-off sequence
                </span>
              </Link>
              <Link
                href="/truck-profitability"
                className="attention-item attention-link"
              >
                <strong>
                  {truckRankings.length} trucks tracked for net profitability
                </strong>
                <span>
                  Compare delivery rate earnings against diesel, toll gate, and crew expenses
                </span>
              </Link>
            </div>
          </section>
        ) : null}

        <div className={`dashboard-columns${loading ? " is-page-loading" : ""}`}>
          <section className="records-card" aria-label="Recent completed deliveries">
            <div className="records-heading">
              <div>
                <h2>Recent Completed Deliveries</h2>
                <p>Click any trip row to inspect its multi-store drop-offs and expense breakdown</p>
              </div>
              <Link className="secondary-button" href="/deliveries">
                View all deliveries
              </Link>
            </div>

            <div className="table-wrap">
              <table style={{ minWidth: "860px" }}>
                <thead>
                  <tr>
                    <th>Waybill & Date</th>
                    <th>Client</th>
                    <th>Truck</th>
                    <th>Store Drop-offs</th>
                    <th>Delivery Rate</th>
                    <th>Expenses</th>
                    <th>Net Income</th>
                    <th>POD Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.map((trip) => (
                    <tr
                      key={trip.id}
                      className="record-row"
                      tabIndex={0}
                      onClick={() => setSelectedTrip(trip)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedTrip(trip);
                        }
                      }}
                    >
                      <td>
                        <strong>{trip.waybillNumber}</strong>
                        <br />
                        <small>{trip.deliveryDate}</small>
                      </td>
                      <td>{trip.clientName}</td>
                      <td className="truck-code">
                        <strong>{trip.plateNumber}</strong>
                        <br />
                        <small>{trip.truckType}</small>
                      </td>
                      <td>
                        <span className="dropoff-count-badge">
                          {trip.dropoffs.length} stores
                        </span>
                      </td>
                      <td className="money">{formatPeso(trip.deliveryRate)}</td>
                      <td>{formatPeso(trip.totalExpenses)}</td>
                      <td className="money">{formatPeso(trip.netIncome)}</td>
                      <td>
                        <span
                          className={`pod-status ${
                            trip.podStatus === "Verified" ? "attached" : "missing"
                          }`}
                        >
                          <i aria-hidden="true" />
                          {trip.podStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="dashboard-actions" style={{ display: "grid", gap: "16px", alignContent: "start" }}>
            <section className="records-card top-trucks-card" aria-label="Truck profitability rankings">
              <div className="records-heading">
                <div>
                  <h2>Truck Profitability</h2>
                  <p>Ranked by net income after trip expenses</p>
                </div>
              </div>
              <ol className="top-truck-list">
                {truckRankings.map((truck, idx) => (
                  <li key={truck.plate_number}>
                    <span className="truck-rank">{idx + 1}</span>
                    <div>
                      <strong>
                        {truck.plate_number}
                      </strong>
                      <span>
                        {truck.deliveries} finalized trips · {formatPercent(truck.profit_margin)} margin
                      </span>
                    </div>
                    <b>{formatPeso(truck.net_income)}</b>
                  </li>
                ))}
              </ol>
              <Link className="dashboard-card-link" href="/truck-profitability">
                Open Truck Profitability breakdown →
              </Link>
            </section>

            <section className="records-card" aria-label="Operational workflows">
              <div className="records-heading">
                <div>
                  <h2>Operational Workflows</h2>
                  <p>Role-authorized actions for {actor.roleLabel}</p>
                </div>
              </div>
              <div className="quick-action-list">
                <Link className="quick-action" href="/deliveries">
                  <Icon>{"\u25a4"}</Icon>
                  <span>
                    <strong>Client Delivery Records</strong>
                    <small>
                      {canWrite
                        ? "Create, edit, and sort deliveries by client & waybill"
                        : "Browse deliveries by client, waybill, and store drop-offs"}
                    </small>
                  </span>
                  <b>›</b>
                </Link>

                {canImport ? (
                  <Link className="quick-action" href="/deliveries/import">
                    <Icon>{"\u25a5"}</Icon>
                    <span>
                      <strong>Excel Daily Trip Report Import</strong>
                      <small>Stage, inspect, and edit imported rows before saving</small>
                    </span>
                    <b>›</b>
                  </Link>
                ) : null}

                <Link className="quick-action" href="/pod-documents">
                  <Icon>{"\u2713"}</Icon>
                  <span>
                    <strong>POD & Supporting Documents</strong>
                    <small>
                      {canVerifyPod
                        ? "Verify store receiving slips and supporting documents"
                        : "Inspect POD verification status across store drop-offs"}
                    </small>
                  </span>
                  <b>›</b>
                </Link>
              </div>
            </section>
          </div>
        </div>

        <p className="scope-note">
          <span aria-hidden="true">●</span>
          RouteX is focused exclusively on Delivery Operations, Multi-Store Drop-offs, POD
          Verification, and Truck Profitability.
        </p>
      </div>

      <RecordDetailDrawer
        open={Boolean(selectedTrip)}
        eyebrow={selectedTrip ? `WAYBILL ${selectedTrip.waybillNumber}` : ""}
        title={selectedTrip ? selectedTrip.clientName : ""}
        statusLabel={selectedTrip?.podStatus}
        statusTone={selectedTrip?.podStatus === "Verified" ? "success" : "warning"}
        sections={drawerSections}
        onClose={() => setSelectedTrip(null)}
      />
    </>
  );
}

