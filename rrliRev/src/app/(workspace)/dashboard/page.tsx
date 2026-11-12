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
  calculateNiceYRange,
  calculateTopClient,
  buildFinancialTimeSeries,
  type FinancialTimeSeriesPoint,
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

function getTimeOfDayGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
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

type FinancialChartMetric = "revenue" | "expenses" | "profit" | "comparison";
type FinancialChartView = "line" | "bar";

const METRIC_CONFIG = {
  revenue: {
    label: "Revenue",
    title: "Revenue over time",
    subtitleSuffix: "completed delivery revenue",
    color: "var(--color-accent-highlight, #f59e0b)",
    dotClass: "legend-dot-revenue",
    gradientId: "chart-fill-revenue",
    emptyMsg: "No revenue in this range",
  },
  expenses: {
    label: "Expenses",
    title: "Expenses over time",
    subtitleSuffix: "trip & company operating expenses",
    color: "#f43f5e",
    dotClass: "legend-dot-expenses",
    gradientId: "chart-fill-expenses",
    emptyMsg: "No expenses in this range",
  },
  profit: {
    label: "Profit",
    title: "Net profit over time",
    subtitleSuffix: "net profit after all expenses",
    color: "#10b981",
    dotClass: "legend-dot-profit",
    gradientId: "chart-fill-profit",
    emptyMsg: "No net profit activity in this range",
  },
  comparison: {
    label: "All",
    title: "Financial overview over time",
    subtitleSuffix: "all daily revenue, expenses, and net profit",
    color: "var(--color-accent-highlight, #f59e0b)",
    dotClass: "legend-dot-revenue",
    gradientId: "chart-fill-revenue",
    emptyMsg: "No financial activity in this range",
  },
} as const;

function DashboardFinancialChart({
  series,
  periodLabel,
  initialMetric = "revenue",
}: {
  series: FinancialTimeSeriesPoint[];
  periodLabel: string;
  initialMetric?: FinancialChartMetric;
}) {
  const [metric, setMetric] = useState<FinancialChartMetric>(initialMetric);
  const [viewMode, setViewMode] = useState<FinancialChartView>("line");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartBoundsRef = useRef<DOMRect | null>(null);

  const width = 720;
  const height = 232;
  const padding = { top: 22, right: 22, bottom: 40, left: 68 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const totals = useMemo(() => {
    let rev = 0;
    let delivExp = 0;
    let compExp = 0;
    let exp = 0;
    let prof = 0;
    let trips = 0;

    series.forEach((p) => {
      rev += p.revenue;
      delivExp += p.deliveryExpenses;
      compExp += p.companyExpenses;
      exp += p.expenses;
      prof += p.profit;
      trips += p.tripCount;
    });

    const count = Math.max(1, series.length);
    return {
      revenue: rev,
      deliveryExpenses: delivExp,
      companyExpenses: compExp,
      expenses: exp,
      profit: prof,
      trips,
      avgRevenue: Math.round(rev / count),
      avgExpenses: Math.round(exp / count),
      avgProfit: Math.round(prof / count),
      peakRevenue: series.length ? Math.max(...series.map((p) => p.revenue)) : 0,
      peakExpenses: series.length ? Math.max(...series.map((p) => p.expenses)) : 0,
      peakProfit: series.length ? Math.max(...series.map((p) => p.profit)) : 0,
      profitMargin: rev > 0 ? ((prof / rev) * 100) : null,
    };
  }, [series]);

  const metricValues = useMemo(() => {
    if (metric === "revenue") return series.map((p) => p.revenue);
    if (metric === "expenses") return series.map((p) => p.expenses);
    if (metric === "profit") return series.map((p) => p.profit);
    return series.flatMap((p) => [p.revenue, p.expenses, p.profit]);
  }, [series, metric]);

  const minVal = metricValues.length ? Math.min(...metricValues, 0) : 0;
  const maxVal = metricValues.length ? Math.max(...metricValues, 0) : 0;
  const { floor, ceiling, ticks: gridValues } = calculateNiceYRange(minVal, maxVal);

  const rangeSpan = Math.max(1, ceiling - floor);
  const yFor = (val: number) =>
    padding.top + innerHeight - ((val - floor) / rangeSpan) * innerHeight;
  const zeroY = yFor(0);

  const xFor = (index: number) => {
    if (series.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (index / (series.length - 1)) * innerWidth;
  };
  const barSlotWidth = innerWidth / Math.max(1, series.length);
  const xForBar = (index: number) => {
    return padding.left + (index + 0.5) * barSlotWidth;
  };

  const hasData = series.length > 0 && metricValues.some((v) => Math.abs(v) > 0);

  const singleCoordinates = useMemo(() => {
    return series.map((point, index) => {
      const val =
        metric === "revenue"
          ? point.revenue
          : metric === "expenses"
            ? point.expenses
            : point.profit;
      return {
        ...point,
        value: val,
        x: xFor(index),
        y: yFor(val),
      };
    });
  }, [series, metric, ceiling, floor]);

  const singleLine = useMemo(() => {
    if (metric === "comparison" || singleCoordinates.length === 0) return "";
    return buildSmoothPath(singleCoordinates, {
      minY: padding.top,
      maxY: padding.top + innerHeight,
    });
  }, [singleCoordinates, metric]);

  const singleArea = useMemo(() => {
    if (metric === "comparison" || singleCoordinates.length === 0) return "";
    return `${singleLine} L ${singleCoordinates.at(-1)?.x ?? padding.left},${zeroY} L ${singleCoordinates[0]?.x ?? padding.left},${zeroY} Z`;
  }, [singleLine, singleCoordinates, zeroY]);

  const compRevenueCoords = useMemo(() => {
    if (metric !== "comparison") return [];
    return series.map((p, i) => ({ x: xFor(i), y: yFor(p.revenue) }));
  }, [series, metric, ceiling, floor]);

  const compExpensesCoords = useMemo(() => {
    if (metric !== "comparison") return [];
    return series.map((p, i) => ({ x: xFor(i), y: yFor(p.expenses) }));
  }, [series, metric, ceiling, floor]);

  const compProfitCoords = useMemo(() => {
    if (metric !== "comparison") return [];
    return series.map((p, i) => ({ x: xFor(i), y: yFor(p.profit) }));
  }, [series, metric, ceiling, floor]);

  const lineRevenue = useMemo(
    () => buildSmoothPath(compRevenueCoords, { minY: padding.top, maxY: padding.top + innerHeight }),
    [compRevenueCoords],
  );
  const lineExpenses = useMemo(
    () => buildSmoothPath(compExpensesCoords, { minY: padding.top, maxY: padding.top + innerHeight }),
    [compExpensesCoords],
  );
  const lineProfit = useMemo(
    () => buildSmoothPath(compProfitCoords, { minY: padding.top, maxY: padding.top + innerHeight }),
    [compProfitCoords],
  );

  const tickIndexes = series.length <= 12
    ? series.map((_, index) => index)
    : Array.from(
        new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]),
      ).filter((index) => index >= 0 && index < series.length);

  const selectedPoint = activeIndex !== null && activeIndex >= 0 && activeIndex < series.length
    ? series[activeIndex]
    : null;
  const selectedCoord = activeIndex !== null && singleCoordinates[activeIndex]
    ? singleCoordinates[activeIndex]
    : null;

  const tooltipWidth = metric === "comparison" ? 180 : 160;
  const tooltipHeight = metric === "comparison" ? 82 : 56;
  const activePointX = activeIndex !== null
    ? viewMode === "bar"
      ? xForBar(activeIndex)
      : xFor(activeIndex)
    : 0;
  const tooltipX = selectedPoint && activeIndex !== null
    ? Math.min(
        Math.max(activePointX - tooltipWidth / 2, padding.left),
        width - padding.right - tooltipWidth,
      )
    : 0;
  const tooltipY = selectedCoord
    ? Math.max(8, Math.min(selectedCoord.y - tooltipHeight - 12, height - padding.bottom - tooltipHeight))
    : 8;

  const selectClosestPoint = (clientX: number, chartBounds: DOMRect) => {
    const x = ((clientX - chartBounds.left) / chartBounds.width) * width;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    series.forEach((_, index) => {
      const targetX = viewMode === "bar" ? xForBar(index) : xFor(index);
      const distance = Math.abs(targetX - x);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    setActiveIndex((current) => (current === closestIndex ? current : closestIndex));
  };

  const activeConfig = METRIC_CONFIG[metric];
  const chartUnit = series[0]?.granularity ?? "day";

  const subtitleText = useMemo(() => {
    if (!hasData) return "No financial activity recorded in this period";
    if (metric === "revenue") {
      return `Avg: ${formatPeso(totals.avgRevenue)}/${chartUnit} · Peak: ${formatPeso(totals.peakRevenue)}`;
    }
    if (metric === "expenses") {
      return `Avg: ${formatPeso(totals.avgExpenses)}/${chartUnit} · Peak: ${formatPeso(totals.peakExpenses)}`;
    }
    if (metric === "profit") {
      const marginPart = totals.profitMargin !== null ? ` · ${formatPercent(totals.profitMargin)} margin` : "";
      return `Avg: ${formatPeso(totals.avgProfit)}/${chartUnit}${marginPart}`;
    }
    return "All daily revenue, expenses, and net profit for the selected period";
  }, [chartUnit, hasData, metric, totals]);

  return (
    <section className="records-card revenue-chart-card" aria-labelledby="revenue-over-time-heading">
      <div className="records-heading revenue-chart-heading" style={{ position: "relative", zIndex: 50 }}>
        <div>
          <h2 id="revenue-over-time-heading">{activeConfig.title}</h2>
          <p>{subtitleText}</p>
        </div>
        <div className="revenue-chart-controls">
          <GlobalDateRangePicker />
        </div>
      </div>

      <div className="chart-toolbar">
        <div className="metric-tabs chart-metric-tabs" role="tablist" aria-label="Financial metric">
          <button
            type="button"
            role="tab"
            aria-selected={metric === "revenue"}
            className={metric === "revenue" ? "active" : ""}
            onClick={() => {
              setActiveIndex(null);
              setMetric("revenue");
            }}
          >
            Revenue
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={metric === "expenses"}
            className={metric === "expenses" ? "active" : ""}
            onClick={() => {
              setActiveIndex(null);
              setMetric("expenses");
            }}
          >
            Expenses
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={metric === "profit"}
            className={metric === "profit" ? "active" : ""}
            onClick={() => {
              setActiveIndex(null);
              setMetric("profit");
            }}
          >
            Profit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={metric === "comparison"}
            className={metric === "comparison" ? "active" : ""}
            onClick={() => {
              setActiveIndex(null);
              setMetric("comparison");
            }}
          >
            All
          </button>
        </div>

        <div className="chart-toolbar-actions">
          {metric === "comparison" && (
            <div className="chart-comparison-key" aria-label="Chart series legend">
              <span className="chart-key-item"><i className="legend-dot-revenue" /> Revenue</span>
              <span className="chart-key-item"><i className="legend-dot-expenses" /> Expenses</span>
              <span className="chart-key-item"><i className="legend-dot-profit" /> Net profit</span>
            </div>
          )}

          <div className="chart-view-mode-toggle" role="group" aria-label="Chart view mode">
            <button
              type="button"
              className={`ui-tooltip ${viewMode === "line" ? "active" : ""}`}
              onClick={() => setViewMode("line")}
              data-tooltip="Line chart"
              aria-label="Line chart"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </button>
            <button
              type="button"
              className={`ui-tooltip ${viewMode === "bar" ? "active" : ""}`}
              onClick={() => setViewMode("bar")}
              data-tooltip="Bar chart"
              aria-label="Bar chart"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {hasData ? (
        <div className="revenue-chart-scroll">
          <svg
            className="revenue-chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${activeConfig.title} for ${periodLabel}`}
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
              <linearGradient id="chart-fill-revenue" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity=".32" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="chart-fill-expenses" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity=".30" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="chart-fill-profit" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity=".32" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>

              {/* Bar Gradients */}
              <linearGradient id="revenue-bar-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <linearGradient id="expenses-bar-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>
              <linearGradient id="profit-bar-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>

              {/* Ambient Fluid Glows */}
              <radialGradient id="chart-fluid-warm-revenue">
                <stop offset="0%" stopColor="var(--color-focus)" stopOpacity=".72" />
                <stop offset="44%" stopColor="#f59e0b" stopOpacity=".34" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="chart-fluid-deep-revenue">
                <stop offset="0%" stopColor="#d97706" stopOpacity=".58" />
                <stop offset="52%" stopColor="#f59e0b" stopOpacity=".2" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="chart-fluid-warm-expenses">
                <stop offset="0%" stopColor="#fb7185" stopOpacity=".65" />
                <stop offset="44%" stopColor="#f43f5e" stopOpacity=".30" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="chart-fluid-deep-expenses">
                <stop offset="0%" stopColor="#e11d48" stopOpacity=".55" />
                <stop offset="52%" stopColor="#f43f5e" stopOpacity=".2" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="chart-fluid-warm-profit">
                <stop offset="0%" stopColor="#34d399" stopOpacity=".68" />
                <stop offset="44%" stopColor="#10b981" stopOpacity=".32" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="chart-fluid-deep-profit">
                <stop offset="0%" stopColor="#059669" stopOpacity=".56" />
                <stop offset="52%" stopColor="#10b981" stopOpacity=".2" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>

              <clipPath id="financial-chart-area-clip">
                <path d={singleArea} />
              </clipPath>
            </defs>

            {/* Grid Lines & Labels */}
            {gridValues.map((value) => {
              const y = yFor(value);
              const isZero = value === 0 && floor < 0;
              return (
                <g key={value}>
                  <line
                    className={`chart-grid-line${isZero ? " chart-zero-line" : ""}`}
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

            {/* View Mode 1: Line / Smooth Area */}
            {viewMode === "line" ? (
              <>
                {metric !== "comparison" ? (
                  <>
                    <path
                      className="chart-area"
                      d={singleArea}
                      fill={`url(#${activeConfig.gradientId})`}
                    />
                    <g clipPath="url(#financial-chart-area-clip)" aria-hidden="true">
                      <ellipse
                        className="chart-area-fluid chart-area-fluid-warm"
                        cx="130"
                        cy="92"
                        rx="245"
                        ry="122"
                        fill={`url(#chart-fluid-warm-${metric})`}
                      />
                      <ellipse
                        className="chart-area-fluid chart-area-fluid-deep"
                        cx="570"
                        cy="148"
                        rx="270"
                        ry="138"
                        fill={`url(#chart-fluid-deep-${metric})`}
                      />
                    </g>
                    <path
                      className="chart-line"
                      d={singleLine}
                      style={{
                        stroke: activeConfig.color,
                        filter: `drop-shadow(0 4px 4px color-mix(in srgb, ${activeConfig.color} 30%, transparent))`,
                      }}
                    />
                    {singleCoordinates.map((point, index) => {
                      const isActive = activeIndex === index;
                      return (
                        <g
                          className={`chart-point${isActive ? " active" : ""}`}
                          key={point.date}
                          tabIndex={0}
                          aria-label={`${formatDashboardDate(point.date)}: ${formatPeso(point.value)}`}
                          onFocus={() => setActiveIndex(index)}
                          onBlur={() => setActiveIndex(null)}
                        >
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r="4"
                            style={{ stroke: activeConfig.color }}
                          />
                          <circle
                            className="chart-point-core"
                            cx={point.x}
                            cy={point.y}
                            r="1.75"
                            style={{ fill: activeConfig.color }}
                          />
                        </g>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {/* Comparison Multi-Line Mode */}
                    <path className="chart-line-revenue" d={lineRevenue} />
                    <path className="chart-line-expenses" d={lineExpenses} />
                    <path className="chart-line-profit" d={lineProfit} />
                    {series.map((point, index) => {
                      const isActive = activeIndex === index;
                      const x = xFor(index);
                      return (
                        <g key={point.date} className={`chart-point-group${isActive ? " active" : ""}`}>
                          <line
                            x1={x}
                            y1={padding.top}
                            x2={x}
                            y2={padding.top + innerHeight}
                            stroke={isActive ? "var(--color-accent)" : "transparent"}
                            strokeWidth="1.5"
                            strokeDasharray="2 3"
                            opacity={isActive ? 0.75 : 0}
                          />
                          <circle cx={x} cy={yFor(point.revenue)} r={isActive ? 4 : 2.5} fill="#f59e0b" />
                          <circle cx={x} cy={yFor(point.expenses)} r={isActive ? 4 : 2.5} fill="#f43f5e" />
                          <circle cx={x} cy={yFor(point.profit)} r={isActive ? 4 : 2.5} fill="#10b981" />
                        </g>
                      );
                    })}
                  </>
                )}
              </>
            ) : (
              /* View Mode 2: Daily Bar Chart */
              <g className="chart-bars-group">
                {series.map((point, index) => {
                  const isActive = activeIndex === index;
                  const x = xForBar(index);

                  if (metric === "comparison") {
                    const clusterWidth = Math.max(3, Math.min(76, barSlotWidth * 0.76));
                    const barGap = barSlotWidth > 15 ? Math.max(1, Math.min(3, clusterWidth * 0.04)) : 0.5;
                    const barW = Math.max(0.8, (clusterWidth - barGap * 2) / 3);
                    const startX = x - clusterWidth / 2;

                    const revY = yFor(point.revenue);
                    const revH = Math.max(2, Math.abs(revY - zeroY));

                    const expY = yFor(point.expenses);
                    const expH = Math.max(2, Math.abs(expY - zeroY));

                    const profVal = point.profit;
                    const profY = yFor(profVal);
                    const profH = Math.max(2, Math.abs(profY - zeroY));
                    const profTop = Math.min(profY, zeroY);

                    return (
                      <g
                        key={point.date}
                        className={`chart-bar-cluster${isActive ? " active" : ""}`}
                        opacity={activeIndex !== null && !isActive ? 0.55 : 1}
                      >
                        {/* Revenue Bar */}
                        <rect
                          className="chart-bar-rect"
                          x={startX}
                          y={Math.min(revY, zeroY)}
                          width={barW}
                          height={revH}
                          rx={Math.min(3.5, barW / 3)}
                          fill="url(#revenue-bar-fill)"
                        />
                        {/* Expenses Bar */}
                        <rect
                          className="chart-bar-rect"
                          x={startX + barW + barGap}
                          y={Math.min(expY, zeroY)}
                          width={barW}
                          height={expH}
                          rx={Math.min(3.5, barW / 3)}
                          fill="url(#expenses-bar-fill)"
                        />
                        {/* Profit Bar */}
                        <rect
                          className="chart-bar-rect"
                          x={startX + (barW + barGap) * 2}
                          y={profTop}
                          width={barW}
                          height={profH}
                          rx={Math.min(3.5, barW / 3)}
                          fill={profVal >= 0 ? "url(#profit-bar-fill)" : "#ef4444"}
                        />
                      </g>
                    );
                  }

                  const val =
                    metric === "revenue"
                      ? point.revenue
                      : metric === "expenses"
                        ? point.expenses
                        : point.profit;
                  const barW = Math.max(1.5, Math.min(48, barSlotWidth * 0.68));
                  const barX = x - barW / 2;
                  const yVal = yFor(val);
                  const barY = Math.min(yVal, zeroY);
                  const barH = Math.max(3, Math.abs(yVal - zeroY));
                  const fill =
                    metric === "revenue"
                      ? "url(#revenue-bar-fill)"
                      : metric === "expenses"
                        ? "url(#expenses-bar-fill)"
                        : val >= 0
                          ? "url(#profit-bar-fill)"
                          : "#ef4444";

                  return (
                    <rect
                      key={point.date}
                      className={`chart-bar-rect${isActive ? " active" : ""}`}
                      x={barX}
                      y={barY}
                      width={barW}
                      height={barH}
                      rx={Math.min(4.5, barW / 4)}
                      fill={fill}
                      opacity={activeIndex !== null && !isActive ? 0.45 : 1}
                    />
                  );
                })}
              </g>
            )}

            {/* Interactive Tooltip */}
            {selectedPoint && activeIndex !== null && (
              <g
                className="chart-point-tooltip"
                pointerEvents="none"
                style={{ transform: `translate(${tooltipX}px, ${tooltipY}px)` }}
              >
                <rect width={tooltipWidth} height={tooltipHeight} rx="8" />
                <text className="chart-tooltip-label" x="11" y="16">
                  {selectedPoint.label ?? formatDashboardDate(selectedPoint.date)}
                </text>
                {metric === "comparison" ? (
                  <>
                    <text className="chart-tooltip-value" x="11" y="32" fill="#f59e0b" fontSize="10">
                      Revenue: {formatPeso(selectedPoint.revenue)}
                    </text>
                    <text className="chart-tooltip-value" x="11" y="48" fill="#f43f5e" fontSize="10">
                      Expenses: {formatPeso(selectedPoint.expenses)}
                    </text>
                    <text
                      className="chart-tooltip-value"
                      x="11"
                      y="64"
                      fill={selectedPoint.profit >= 0 ? "#10b981" : "#ef4444"}
                      fontSize="10"
                    >
                      Net profit: {formatPeso(selectedPoint.profit)}
                    </text>
                  </>
                ) : (
                  <>
                    <text className="chart-tooltip-value" x="11" y="32">
                      {activeConfig.label}: {formatPeso(singleCoordinates[activeIndex]?.value ?? 0)}
                    </text>
                    <text
                      className="chart-tooltip-label"
                      x="11"
                      y="46"
                      style={{ fontSize: "8.5px", fill: "var(--color-text-muted)" }}
                    >
                      {metric === "revenue"
                        ? `${selectedPoint.tripCount} completed ${selectedPoint.tripCount === 1 ? "trip" : "trips"}`
                        : metric === "expenses"
                          ? `${formatPeso(selectedPoint.deliveryExpenses)} delivery · ${formatPeso(selectedPoint.companyExpenses)} company`
                          : `${selectedPoint.profit >= 0 ? "Net Profit" : "Net Loss"} · ${selectedPoint.revenue > 0 ? formatPercent((selectedPoint.profit / selectedPoint.revenue) * 100) + " margin" : "0 revenue"}`}
                    </text>
                  </>
                )}
              </g>
            )}

            {/* X-Axis Dates */}
            {tickIndexes.map((index) => {
              const point = series[index];
              const tickX = viewMode === "bar" ? xForBar(index) : xFor(index);
              return (
                <text
                  className="chart-axis-label"
                  key={point.date}
                  x={tickX}
                  y={height - 13}
                  textAnchor="middle"
                >
                  {(point.label ?? formatDashboardDate(point.date)).replace(/, \d{4}$/, "")}
                </text>
              );
            })}
          </svg>
        </div>
      ) : (
        <div
          className="empty-state chart-empty-state"
          title={`No ${activeConfig.label.toLowerCase()} recorded within the selected date range`}
        >
          <strong>{activeConfig.emptyMsg}</strong>
          <span>Choose a wider date range to view the trend.</span>
        </div>
      )}
    </section>
  );
}

const RevenueChart = DashboardFinancialChart;

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
  const [greeting, setGreeting] = useState<string>(() => getTimeOfDayGreeting());

  useEffect(() => {
    setGreeting(getTimeOfDayGreeting());
  }, []);

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

  const financialSeries = useMemo(
    () => buildFinancialTimeSeries(filteredDeliveries, filteredCompanyExpenses, range),
    [filteredDeliveries, filteredCompanyExpenses, range],
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
            <h1 suppressHydrationWarning>{greeting}, {actor.fullName ? actor.fullName.split(" ")[0] : (actor.username ?? "there")}</h1>
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
          <DashboardFinancialChart
            series={financialSeries}
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
            {(() => {
              const clientNameLen = topClientData.name.length;
              const clientSizeClass =
                clientNameLen <= 11
                  ? "stat-client-name--short"
                  : clientNameLen <= 24
                    ? "stat-client-name--medium"
                    : "stat-client-name--long";
              return (
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
                >
                  <span className="stat-label">TOP CLIENT</span>
                  <strong className={`stat-client-name ${clientSizeClass}`} title={topClientData.name}>
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
              );
            })()}
          </section>
        </section>

        <div className={`dashboard-columns${loading ? " is-page-loading" : ""}`}>
          <section className="records-card dashboard-recent-deliveries" aria-label="Recent completed deliveries">
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
                  <li className="top-truck-empty" title="Rankings require confirmed expenses">
                    No finalized truck records in this range.
                  </li>
                ) : null}
                {truckRankings.map((truck, idx) => (
                  <li className={idx === 0 ? "is-top-truck" : undefined} key={truck.plate_number}>
                    <Link
                      className="top-truck-link"
                      href={`/truck-profitability/${truck.plate_number}`}
                      title={`View ${truck.plate_number} details`}
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
                              <span>{issues.length} {issues.length === 1 ? "missing detail" : "missing details"}</span>
                              <span className={`attention-chevron${isExpanded ? " open" : ""}`} aria-hidden="true">▾</span>
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
                            </div>
                          </div>
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

