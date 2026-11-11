"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  formatDateRange,
  GlobalDateRangePicker,
  toDateKey,
  useGlobalDateRange,
  type DateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import {
  type DeliveryTripRecord,
  getDeliveryIncompleteIssues,
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
} from "@/features/deliveries/delivery-domain";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  calculateNiceYAxis,
  calculateTopClient,
} from "@/features/dashboard/dashboard-kpi";
import {
  useDeliveryProfitabilitySummary,
  type PersistedTruckSummary,
} from "@/features/deliveries/use-delivery-profitability-summary";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { upsertBrowserPreviewDelivery } from "@/features/deliveries/browser-preview-deliveries";
import { deleteDeliveryRecord } from "@/features/deliveries/delivery-deletion-client";
import {
  readBrowserPreviewExpenses,
  ROUTEX_COMPANY_EXPENSES_CHANGED,
} from "@/features/finance/browser-preview-expenses";
import {
  filterExpensesByDateRange,
  type CompanyExpense,
} from "@/features/finance/company-expense-domain";
import {
  canManageDocuments,
  canMutateDeliveryRecords,
} from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";

type TruckRankingMetric = "revenue" | "netIncome" | "expenses" | "profitMargin";

const truckRankingLabels: Record<TruckRankingMetric, string> = {
  revenue: "Revenue",
  netIncome: "Net profit",
  expenses: "Expenses",
  profitMargin: "Profit margin",
};

function truckRankingValue(
  truck: PersistedTruckSummary,
  metric: TruckRankingMetric,
): number {
  if (metric === "revenue") return truck.revenue;
  if (metric === "expenses") return truck.expenses;
  if (metric === "profitMargin") {
    return truck.profit_margin ?? Number.NEGATIVE_INFINITY;
  }
  return truck.net_income;
}

function formatTruckRankingValue(
  truck: PersistedTruckSummary,
  metric: TruckRankingMetric,
): string {
  if (metric === "profitMargin") return formatPercent(truck.profit_margin);
  if (metric === "expenses") return formatPeso(truck.expenses);
  return formatPeso(metric === "revenue" ? truck.revenue : truck.net_income);
}

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

type MissingDetailIssue = {
  label: string;
  tooltip?: string;
};

function getDeliveryMissingDetails(delivery: DeliveryTripRecord): MissingDetailIssue[] {
  const issues: MissingDetailIssue[] = [];

  const unknownExpenseLabels: Record<string, string> = {
    dieselExpenses: "Diesel Fuel",
    tollGateExpenses: "Highway Tolls",
    entryFees: "Store Entry Fees",
    driverAllowance: "Driver allowance",
    driverDailyRate: "Driver rate",
    helperAllowance: "Helper allowance",
    helperDailyRate: "Helper rate",
    otherExpenses: "Other expenses",
  };
  const unknownExpenses = Object.entries(delivery.expenseStates)
    .filter(([_, status]) => status === "unknown")
    .map(([key]) => unknownExpenseLabels[key] ?? key);

  if (unknownExpenses.length > 0) {
    if (unknownExpenses.length === 1) {
      issues.push({
        label: `Unknown: ${unknownExpenses[0]}`,
        tooltip: `Expense needing confirmation: ${unknownExpenses[0]}`,
      });
    } else {
      issues.push({
        label: `Unknown expenses (${unknownExpenses.length})`,
        tooltip: `Expenses needing confirmation: ${unknownExpenses.join(", ")}`,
      });
    }
  }

  if (delivery.deliveryRate == null || delivery.deliveryRate <= 0) {
    issues.push({
      label: "Missing revenue",
      tooltip: "Agreed revenue has not been specified",
    });
  }

  const missingPods = delivery.dropoffs.filter((d) => !d.podSubmitted);
  if (missingPods.length > 0) {
    if (missingPods.length === 1) {
      const fullStoreName = missingPods[0].storeName.trim();
      const primaryStore = fullStoreName.split(/\s*[-–—@/(]\s*/)[0].trim();
      const conciseName = primaryStore.length > 0 && primaryStore.length <= 14 ? primaryStore : "";
      issues.push({
        label: conciseName ? `Missing POD: ${conciseName}` : "Missing POD",
        tooltip: `Missing POD: ${fullStoreName}`,
      });
    } else {
      issues.push({
        label: `Missing POD (${missingPods.length})`,
        tooltip: `Missing PODs for: ${missingPods.map((d) => d.storeName).join(", ")}`,
      });
    }
  }

  const unknownEntryFees = delivery.dropoffs.filter((d) => d.entryFeeStatus === "unknown");
  if (unknownEntryFees.length > 0) {
    issues.push({
      label: unknownEntryFees.length === 1 ? "Unresolved entry fee" : `Unresolved entry fees (${unknownEntryFees.length})`,
      tooltip: `Unresolved entry fees across ${unknownEntryFees.length} stop${unknownEntryFees.length > 1 ? "s" : ""}`,
    });
  }

  if (delivery.financialIntegrityIssues?.length > 0 && unknownExpenses.length === 0) {
    delivery.financialIntegrityIssues.forEach((issue) => {
      const cleanIssue = issue.length > 24 ? `${issue.slice(0, 22)}…` : issue;
      issues.push({ label: cleanIssue, tooltip: issue });
    });
  } else if (delivery.financialState === "incomplete" && issues.length === 0) {
    issues.push({
      label: "Incomplete financials",
      tooltip: "Trip financials are not fully finalized",
    });
  }

  return issues;
}

function buildRevenueSeries(
  deliveries: readonly DeliveryTripRecord[],
  range: DateRange,
): Array<{ date: string; revenue: number }> {
  const amounts = new Map<string, number>();
  deliveries.forEach((trip) => {
    if (isDeliveryFinanciallyComplete(trip) && trip.deliveryRate) {
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

function buildSmoothPath(
  points: Array<{ x: number; y: number }>,
  bounds?: { minY: number; maxY: number },
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)},${points[1].y.toFixed(2)}`;
  }

  const clampY = (val: number) => {
    if (!bounds) return val;
    return Math.min(Math.max(val, bounds.minY), bounds.maxY);
  };

  let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = clampY(p1.y + (p2.y - p0.y) / 6);

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = clampY(p2.y - (p3.y - p1.y) / 6);

    path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }

  return path;
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
  const padding = { top: 22, right: 22, bottom: 40, left: 68 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const peak = Math.max(...series.map((point) => point.revenue), 0);
  const { ceiling, ticks: gridValues } = calculateNiceYAxis(peak);
  const coordinates = series.map((point, index) => ({
    ...point,
    x: padding.left + (series.length <= 1 ? innerWidth / 2 : (index / (series.length - 1)) * innerWidth),
    y: padding.top + innerHeight - (ceiling > 0 ? (point.revenue / ceiling) * innerHeight : 0),
  }));
  const line = buildSmoothPath(coordinates, {
    minY: padding.top,
    maxY: padding.top + innerHeight,
  });
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
      <div className="records-heading revenue-chart-heading">
        <div>
          <h2 id="revenue-over-time-heading">Revenue over time</h2>
          <p>{periodLabel} · completed revenue</p>
        </div>
        <div className="revenue-chart-controls">
          <GlobalDateRangePicker />
          <div className="chart-legend" aria-label="Chart legend">
            <span><i /> Revenue</span>
            <strong>{formatPeso(series.reduce((total, point) => total + point.revenue, 0))}</strong>
          </div>
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
              <radialGradient id="revenue-chart-fluid-warm">
                <stop offset="0%" stopColor="var(--color-focus)" stopOpacity=".72" />
                <stop offset="44%" stopColor="var(--color-accent-highlight)" stopOpacity=".34" />
                <stop offset="100%" stopColor="var(--color-accent-highlight)" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="revenue-chart-fluid-deep">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity=".58" />
                <stop offset="52%" stopColor="var(--color-accent-highlight)" stopOpacity=".2" />
                <stop offset="100%" stopColor="var(--color-accent-highlight)" stopOpacity="0" />
              </radialGradient>
              <clipPath id="revenue-chart-area-clip">
                <path d={area} />
              </clipPath>
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
            <g clipPath="url(#revenue-chart-area-clip)" aria-hidden="true">
              <ellipse
                className="chart-area-fluid chart-area-fluid-warm"
                cx="130"
                cy="92"
                rx="245"
                ry="122"
                fill="url(#revenue-chart-fluid-warm)"
              />
              <ellipse
                className="chart-area-fluid chart-area-fluid-deep"
                cx="570"
                cy="148"
                rx="270"
                ry="138"
                fill="url(#revenue-chart-fluid-deep)"
              />
            </g>
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
        <div
          className="empty-state chart-empty-state"
          title="No revenue recorded within the selected date range"
        >
          <strong>No revenue in this range</strong>
          <span>Choose a wider date range to view the trend.</span>
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const actor = useAuthenticatedActor();
  const { range } = useGlobalDateRange();
  const { deliveries, loading, error } = usePersistedDeliveries(range);
  const { summary: persistedSummary } = useDeliveryProfitabilitySummary(range);
  const [accessNoticeDismissed, setAccessNoticeDismissed] = useState(false);
  const [truckRankingMetric, setTruckRankingMetric] =
    useState<TruckRankingMetric>("netIncome");
  const [deliverySort, setDeliverySort] = useState<{ key: string; direction: TableSortDirection }>({ key: "date", direction: "desc" });
  const [companyExpenses, setCompanyExpenses] = useState<CompanyExpense[]>([]);
  const [expandedAttentionIds, setExpandedAttentionIds] = useState<Set<string>>(new Set());

  const toggleAttentionItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedAttentionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    async function fetchExpenses() {
      try {
        const res = await fetch("/api/finance/expenses?pageSize=100");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.items)) {
            setCompanyExpenses(data.items);
            return;
          }
        }
      } catch {
        // Fallback
      }
      setCompanyExpenses(readBrowserPreviewExpenses());
    }

    fetchExpenses();

    const onExpensesChanged = () => {
      setCompanyExpenses(readBrowserPreviewExpenses());
    };
    window.addEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, onExpensesChanged);
    return () => {
      window.removeEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, onExpensesChanged);
    };
  }, []);

  const filteredDeliveries = deliveries;
  const deliveriesWithMissingDetails = useMemo(() => {
    return filteredDeliveries
      .map((delivery) => {
        const issues = getDeliveryIncompleteIssues(delivery);
        return {
          delivery,
          issues: issues.map((label) => ({ label, tooltip: label })),
        };
      })
      .filter((item) => item.issues.length > 0);
  }, [filteredDeliveries]);

  const topClientData = useMemo(
    () => calculateTopClient(filteredDeliveries),
    [filteredDeliveries],
  );

  const sortedDeliveries = useMemo(() => {
    const multiplier = deliverySort.direction === "asc" ? 1 : -1;
    return [...filteredDeliveries].sort((left, right) => {
      const values: Record<string, [string | number, string | number]> = {
        date: [left.deliveryDate, right.deliveryDate],
        client: [left.clientName, right.clientName],
        truck: [left.plateNumber, right.plateNumber],
        dropoffs: [left.dropoffs.length, right.dropoffs.length],
        revenue: [left.deliveryRate ?? 0, right.deliveryRate ?? 0],
        netIncome: [left.netIncome ?? Number.NEGATIVE_INFINITY, right.netIncome ?? Number.NEGATIVE_INFINITY],
      };
      const [leftValue, rightValue] = values[deliverySort.key] ?? values.date;
      const compared = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
      return compared * multiplier || left.id.localeCompare(right.id);
    });
  }, [deliverySort, filteredDeliveries]);

  const recentDeliveries = useMemo(() => {
    return sortedDeliveries.slice(0, 5);
  }, [sortedDeliveries]);

  const rangeKey = `${range.startDate?.getTime() ?? "all"}-${range.endDate?.getTime() ?? "all"}`;

  const filteredCompanyExpenses = useMemo(() => {
    return filterExpensesByDateRange(
      companyExpenses,
      range.startDate ? toDateKey(range.startDate) : null,
      range.endDate ? toDateKey(range.endDate) : null,
    );
  }, [companyExpenses, range.startDate, range.endDate]);

  const totals = useMemo(() => {
    const financiallyComplete = filteredDeliveries.filter(isDeliveryFinanciallyComplete);
    const fallbackEarnings = financiallyComplete.reduce((sum, item) => sum + (item.deliveryRate ?? 0), 0);
    const fallbackExpenses = financiallyComplete.reduce((sum, item) => sum + (item.totalExpenses ?? 0), 0);
    const earnings = persistedSummary?.revenue ?? fallbackEarnings;
    const deliveryExpenses = persistedSummary?.expenses ?? fallbackExpenses;
    const companyExpensesTotal = filteredCompanyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const companyNetProfit = earnings - deliveryExpenses - companyExpensesTotal;
    const companyProfitMargin = earnings > 0 ? ((companyNetProfit / earnings) * 100) : null;
    const totalStops = filteredDeliveries.reduce((sum, item) => sum + item.dropoffs.length, 0);
    const incompleteDeliveries = filteredDeliveries.filter(isDeliveryIncomplete);
    const incompleteCount = incompleteDeliveries.length;
    const completedCount = filteredDeliveries.length - incompleteCount;
    const finalizedCount = persistedSummary?.deliveries ?? financiallyComplete.length;

    return {
      earnings,
      deliveryExpenses,
      companyExpenses: companyExpensesTotal,
      companyNetProfit,
      companyProfitMargin,
      totalStops,
      incompleteCount,
      completedCount,
      finalizedCount,
      totalTrips: filteredDeliveries.length,
    };
  }, [filteredDeliveries, persistedSummary, filteredCompanyExpenses]);

  const revenueSeries = useMemo(
    () => buildRevenueSeries(filteredDeliveries, range),
    [filteredDeliveries, range],
  );

  const truckRankings = useMemo(
    () =>
      [...(persistedSummary?.trucks ?? [])]
        .sort((left, right) => {
          const leftValue = truckRankingValue(left, truckRankingMetric);
          const rightValue = truckRankingValue(right, truckRankingMetric);
          if (leftValue !== rightValue) return rightValue > leftValue ? 1 : -1;
          if (right.net_income !== left.net_income) {
            return right.net_income - left.net_income;
          }
          return left.plate_number.localeCompare(right.plate_number);
        })
        .slice(0, 3),
    [persistedSummary?.trucks, truckRankingMetric],
  );

  const canWrite = canMutateDeliveryRecords(actor.role);

  return (
    <>
      <OperationalTopbar contextLabel="Delivery Operations & Trucks" showDateFilter={false} />

      <div key={rangeKey} className="content-wrap dashboard-range-refresh">
        <header className="page-intro dashboard-welcome">
          <div>
            <h1>Welcome back, {actor.fullName.split(" ")[0]}</h1>
            <p className="subtitle">
              Overview of delivery operations and profitability.
            </p>
          </div>
          {canWrite ? (
            <div className="fleet-intro-actions">
              <Link
                className="secondary-button page-intro-action"
                href="/deliveries/import"
                aria-label="Import an Excel trip report"
                data-tooltip="Import an Excel trip report"
                title="Import an Excel trip report"
              >
                Import
              </Link>
              <Link
                className="primary-action-button page-intro-action"
                href="/deliveries/new"
                aria-label="Record a completed delivery and its trip details"
                data-tooltip="Record a completed delivery and its trip details"
                title="Record a completed delivery and its trip details"
              >
                Record delivery
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
                Read-only access to deliveries, drop-offs, PODs, trucks, and reports.
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
            aria-label="Company performance and profitability summary"
          >
            {/* 1. Revenue */}
            <Link
              className="stat-card stat-card-link ui-tooltip"
              href="/deliveries"
              data-tooltip="View revenue and delivery records"
              title="View revenue and delivery records"
            >
              <span className="stat-label">REVENUE</span>
              <strong>{formatPeso(totals.earnings)}</strong>
              <span
                className={`stat-meta ${totals.finalizedCount > 0 ? "positive" : ""}`}
              >
                {totals.finalizedCount > 0
                  ? `${totals.finalizedCount} completed ${totals.finalizedCount === 1 ? "trip" : "trips"} · ${totals.totalStops} drop-offs`
                  : "0 trips recorded in selected range"}
              </span>
            </Link>

            {/* 2. Expenses */}
            <Link
              className="stat-card stat-card-link ui-tooltip"
              href="/finance"
              data-tooltip="View itemized delivery and company expenses"
              title="View itemized delivery and company expenses"
            >
              <span className="stat-label">EXPENSES</span>
              <strong>{formatPeso(totals.deliveryExpenses + totals.companyExpenses)}</strong>
              <span className="stat-meta">
                {totals.companyExpenses > 0
                  ? `${formatPeso(totals.deliveryExpenses)} delivery · ${formatPeso(totals.companyExpenses)} company`
                  : totals.deliveryExpenses > 0
                    ? `${formatPeso(totals.deliveryExpenses)} delivery expenses`
                    : "No expenses in this range"}
              </span>
            </Link>

            {/* 3. Profit */}
            <Link
              className="stat-card stat-card-link ui-tooltip"
              href="/finance"
              data-tooltip="View profit and financial breakdowns"
              title="View profit and financial breakdowns"
            >
              <span className="stat-label">PROFIT</span>
              <strong className={totals.companyNetProfit >= 0 ? undefined : "warning"}>
                {formatPeso(totals.companyNetProfit)}
              </strong>
              <span
                className={`stat-meta ${
                  totals.companyNetProfit >= 0 ? "positive" : "warning"
                }`}
              >
                {totals.earnings > 0 && totals.companyProfitMargin !== null
                  ? `${formatPercent(totals.companyProfitMargin)} profit margin`
                  : totals.companyNetProfit < 0 && totals.companyProfitMargin !== null
                    ? `${formatPercent(totals.companyProfitMargin)} loss margin`
                    : "Net income after all expenses"}
              </span>
            </Link>

            {/* 4. Top Client */}
            <Link
              className="stat-card stat-card-link stat-card-top-client ui-tooltip"
              href="/reports"
              data-tooltip={
                topClientData.isTied
                  ? `Tied top clients: ${topClientData.allNames}`
                  : topClientData.name !== "None"
                    ? `Top client: ${topClientData.name} (${formatPeso(topClientData.revenue)})`
                    : "No client revenue recorded in selected range"
              }
              title={
                topClientData.isTied
                  ? `Tied top clients: ${topClientData.allNames}`
                  : topClientData.name !== "None"
                    ? `Top client: ${topClientData.name} (${formatPeso(topClientData.revenue)})`
                    : "No client revenue recorded in selected range"
              }
            >
              <span className="stat-label">TOP CLIENT</span>
              <strong
                className="stat-client-name"
                title={topClientData.isTied ? topClientData.allNames : topClientData.name}
              >
                {topClientData.name}
              </strong>
              <span className={`stat-meta ${topClientData.revenue > 0 ? "positive" : ""}`}>
                {topClientData.revenue > 0
                  ? topClientData.isTied
                    ? `Tied at ${formatPeso(topClientData.revenue)} each`
                    : `${formatPeso(topClientData.revenue)} revenue · ${topClientData.tripCount} ${topClientData.tripCount === 1 ? "trip" : "trips"}`
                  : "No revenue in selected range"}
              </span>
            </Link>
          </section>
        </section>

        <div className={`dashboard-columns${loading ? " is-page-loading" : ""}`}>
          <section className="records-card" aria-label="Recent completed deliveries">
            <div className="records-heading">
              <div>
                <h2>Recent Deliveries</h2>
                <p>Latest delivery trips.</p>
              </div>
              <Link className="secondary-button" href="/deliveries">
                View all
              </Link>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <SortableTableHeader label="Waybill & Date" sortKey="date" activeSortKey={deliverySort.key} direction={deliverySort.direction} defaultDirection="desc" onSort={(key, direction) => setDeliverySort({ key, direction })} />
                    <SortableTableHeader label="Client" sortKey="client" activeSortKey={deliverySort.key} direction={deliverySort.direction} onSort={(key, direction) => setDeliverySort({ key, direction })} />
                    <SortableTableHeader label="Truck" sortKey="truck" activeSortKey={deliverySort.key} direction={deliverySort.direction} onSort={(key, direction) => setDeliverySort({ key, direction })} />
                    <SortableTableHeader label="Drop-offs" sortKey="dropoffs" activeSortKey={deliverySort.key} direction={deliverySort.direction} defaultDirection="desc" onSort={(key, direction) => setDeliverySort({ key, direction })} />
                    <SortableTableHeader label="Revenue" sortKey="revenue" activeSortKey={deliverySort.key} direction={deliverySort.direction} defaultDirection="desc" onSort={(key, direction) => setDeliverySort({ key, direction })} />
                    <SortableTableHeader label="Net Profit" sortKey="netIncome" activeSortKey={deliverySort.key} direction={deliverySort.direction} defaultDirection="desc" onSort={(key, direction) => setDeliverySort({ key, direction })} />
                  </tr>
                </thead>
                <tbody>
                  {recentDeliveries.map((trip) => {
                    const isIncomplete = isDeliveryIncomplete(trip);
                    const isFinanciallyIncomplete = !isDeliveryFinanciallyComplete(trip);
                    return (
                      <tr
                        key={trip.id}
                        className={`record-row ${isIncomplete ? "is-incomplete" : ""}`}
                        tabIndex={0}
                        onClick={() => router.push(`/deliveries/${encodeURIComponent(trip.id)}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(`/deliveries/${encodeURIComponent(trip.id)}`);
                          }
                        }}
                      >
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong>{trip.waybillNumber}</strong>
                          </div>
                          <small>{formatDashboardDate(trip.deliveryDate)}</small>
                        </td>
                        <td>
                          <span className="recent-client-name" title={trip.clientName}>
                            {trip.clientName}
                          </span>
                        </td>
                        <td className="truck-code">
                          <strong>{trip.plateNumber}</strong>
                          <br />
                          <small>{trip.truckType}</small>
                        </td>
                        <td>
                          <span className="recent-dropoff-pill">
                            {trip.dropoffs.length} {trip.dropoffs.length === 1 ? "drop-off" : "drop-offs"}
                          </span>
                        </td>
                        <td className="money">
                          {trip.deliveryRate != null && trip.deliveryRate > 0 ? (
                            formatPeso(trip.deliveryRate)
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="money">
                          {isFinanciallyIncomplete || trip.netIncome == null ? (
                            <span
                              className="profit-amount warning"
                              title="Net profit computation deferred: Requires all trip expenses to be confirmed"
                            >
                              Incomplete
                            </span>
                          ) : (
                            formatPeso(trip.netIncome)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="dashboard-actions" style={{ display: "grid", gap: "16px", alignContent: "start" }}>
            <section className="records-card top-trucks-card" aria-label="Truck profitability rankings">
              <div className="records-heading">
                <div>
                  <h2>Top Trucks</h2>
                  <p>
                    Sorted by {truckRankingLabels[truckRankingMetric].toLowerCase()}
                  </p>
                </div>
              </div>
              <div className="metric-tabs truck-ranking-tabs" role="group" aria-label="Rank trucks by">
                {(Object.keys(truckRankingLabels) as TruckRankingMetric[]).map((metric) => (
                  <button
                    className={truckRankingMetric === metric ? "active" : ""}
                    type="button"
                    aria-pressed={truckRankingMetric === metric}
                    onClick={() => setTruckRankingMetric(metric)}
                    key={metric}
                  >
                    {truckRankingLabels[metric]}
                  </button>
                ))}
              </div>
              <ol className="top-truck-list">
                {truckRankings.length === 0 ? (
                  <li className="top-truck-empty" title="Rankings calculate exclusively from deliveries with confirmed expenses">
                    No finalized truck records in this range.
                  </li>
                ) : null}
                {truckRankings.map((truck, idx) => (
                  <li className={idx === 0 ? "is-top-truck" : undefined} key={truck.plate_number}>
                    <Link
                      className="top-truck-link"
                      href={`/truck-profitability/${truck.plate_number}`}
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
                Open trucks →
              </Link>
            </section>

            <section className="records-card dashboard-attention-card" aria-label="Attention needed">
              <div className="records-heading">
                <div>
                  <h2>Attention Needed</h2>
                  <p>
                    {deliveriesWithMissingDetails.length > 0
                      ? `${deliveriesWithMissingDetails.length} ${deliveriesWithMissingDetails.length === 1 ? "delivery needs" : "deliveries need"} attention.`
                      : "No pending items."}
                  </p>
                </div>
                {deliveriesWithMissingDetails.length > 0 && (
                  <button
                    type="button"
                    className="expand-all-text-button"
                    onClick={() => {
                      if (expandedAttentionIds.size === deliveriesWithMissingDetails.length) {
                        setExpandedAttentionIds(new Set());
                      } else {
                        setExpandedAttentionIds(new Set(deliveriesWithMissingDetails.map((d) => d.delivery.id)));
                      }
                    }}
                    title="Toggle expand all missing details"
                  >
                    {expandedAttentionIds.size === deliveriesWithMissingDetails.length ? "Collapse all" : "Expand all"}
                  </button>
                )}
              </div>
              {deliveriesWithMissingDetails.length > 0 ? (
                <div className="dashboard-attention-list" role="region" aria-label="Deliveries requiring attention">
                  {deliveriesWithMissingDetails.map(({ delivery, issues }) => {
                    const isExpanded = expandedAttentionIds.has(delivery.id);
                    return (
                      <div
                        key={delivery.id}
                        className={`dashboard-attention-item${isExpanded ? " is-expanded" : ""}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/deliveries/${encodeURIComponent(delivery.id)}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/deliveries/${encodeURIComponent(delivery.id)}`);
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
                              aria-label={`${isExpanded ? "Hide" : "Show"} missing details for ${delivery.waybillNumber}`}
                              onClick={(e) => toggleAttentionItem(delivery.id, e)}
                            >
                              <span>{issues.length} {issues.length === 1 ? "missing" : "missing"}</span>
                              <span className={`attention-chevron${isExpanded ? " open" : ""}`} aria-hidden="true">▾</span>
                            </button>
                          </div>

                          {isExpanded && (
                            <div
                              className="dashboard-attention-dropdown"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="dashboard-attention-tags">
                                {issues.map((issue, idx) => (
                                  <span
                                    key={idx}
                                    className="dashboard-attention-tag"
                                    title={issue.tooltip ?? issue.label}
                                  >
                                    {issue.label}
                                  </span>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="dashboard-attention-resolve-btn"
                                onClick={() => router.push(`/deliveries/${encodeURIComponent(delivery.id)}`)}
                              >
                                Review delivery details →
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="dashboard-attention-empty"
                  title="All delivery waybills have confirmed expenses and attached POD documents"
                >
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>All caught up</strong>
                    <small>No pending items in this range.</small>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

