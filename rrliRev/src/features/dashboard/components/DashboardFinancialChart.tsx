"use client";

import React, { useMemo, useRef, useState } from "react";
import { GlobalDateRangePicker } from "@/components/global-date-range-picker";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/button";
import { TabList, TabTrigger } from "@/components/ui/tabs";
import {
  calculateNiceYRange,
  type FinancialTimeSeriesPoint,
} from "@/features/dashboard/dashboard-kpi";
import { formatPercent, formatPeso } from "@/lib/format";

export type FinancialChartMetric = "revenue" | "expenses" | "profit" | "comparison";
export type FinancialChartView = "line" | "bar";

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

  const n = points.length;
  const dxs: number[] = [];
  const dys: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    dxs.push(dx);
    dys.push(dy);
    slopes.push(dx === 0 ? 0 : dy / dx);
  }

  // Monotone cubic Hermite spline tangents (Fritsch-Carlson algorithm)
  const tangents: number[] = new Array(n).fill(0);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    const m0 = slopes[i - 1];
    const m1 = slopes[i];
    if (m0 * m1 <= 0) {
      tangents[i] = 0;
    } else {
      const dx0 = dxs[i - 1];
      const dx1 = dxs[i];
      tangents[i] = (3 * (dx0 + dx1)) / ((2 * dx1 + dx0) / m0 + (dx1 + 2 * dx0) / m1);
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const slope = slopes[i];
    if (Math.abs(slope) < 1e-7) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const alpha = tangents[i] / slope;
      const beta = tangents[i + 1] / slope;
      const dist = alpha * alpha + beta * beta;
      if (dist > 9) {
        const tau = 3 / Math.sqrt(dist);
        tangents[i] = tau * alpha * slope;
        tangents[i + 1] = tau * beta * slope;
      }
    }
  }

  let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = dxs[i] / 3;

    const cp1x = p0.x + dx;
    const cp1y = clampY(p0.y + tangents[i] * dx);

    const cp2x = p1.x - dx;
    const cp2y = clampY(p1.y - tangents[i + 1] * dx);

    path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
  }

  return path;
}

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

export type DashboardFinancialChartProps = {
  series: FinancialTimeSeriesPoint[];
  periodLabel: string;
  initialMetric?: FinancialChartMetric;
};

export function DashboardFinancialChart({
  series,
  periodLabel,
  initialMetric = "revenue",
}: DashboardFinancialChartProps) {
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
      profitMargin: rev > 0 ? (prof / rev) * 100 : null,
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

  const areaRevenue = useMemo(() => {
    if (metric !== "comparison" || compRevenueCoords.length === 0) return "";
    return `${lineRevenue} L ${compRevenueCoords.at(-1)?.x ?? padding.left},${zeroY} L ${compRevenueCoords[0]?.x ?? padding.left},${zeroY} Z`;
  }, [lineRevenue, compRevenueCoords, zeroY, metric]);

  const areaExpenses = useMemo(() => {
    if (metric !== "comparison" || compExpensesCoords.length === 0) return "";
    return `${lineExpenses} L ${compExpensesCoords.at(-1)?.x ?? padding.left},${zeroY} L ${compExpensesCoords[0]?.x ?? padding.left},${zeroY} Z`;
  }, [lineExpenses, compExpensesCoords, zeroY, metric]);

  const areaProfit = useMemo(() => {
    if (metric !== "comparison" || compProfitCoords.length === 0) return "";
    return `${lineProfit} L ${compProfitCoords.at(-1)?.x ?? padding.left},${zeroY} L ${compProfitCoords[0]?.x ?? padding.left},${zeroY} Z`;
  }, [lineProfit, compProfitCoords, zeroY, metric]);

  const tickIndexes =
    series.length <= 12
      ? series.map((_, index) => index)
      : Array.from(
          new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]),
        ).filter((index) => index >= 0 && index < series.length);

  const selectedPoint =
    activeIndex !== null && activeIndex >= 0 && activeIndex < series.length
      ? series[activeIndex]
      : null;
  const selectedCoord =
    activeIndex !== null && singleCoordinates[activeIndex]
      ? singleCoordinates[activeIndex]
      : null;

  const tooltipWidth = metric === "comparison" ? 180 : 160;
  const tooltipHeight = metric === "comparison" ? 82 : 56;
  const activePointX =
    activeIndex !== null
      ? viewMode === "bar"
        ? xForBar(activeIndex)
        : xFor(activeIndex)
      : 0;
  const tooltipX =
    selectedPoint && activeIndex !== null
      ? Math.min(
          Math.max(activePointX - tooltipWidth / 2, padding.left),
          width - padding.right - tooltipWidth,
        )
      : 0;
  const compCoordY =
    activeIndex !== null && metric === "comparison"
      ? Math.min(
          yFor(series[activeIndex]?.revenue ?? 0),
          yFor(series[activeIndex]?.expenses ?? 0),
          yFor(series[activeIndex]?.profit ?? 0),
        )
      : null;
  const targetPointY = selectedCoord?.y ?? compCoordY ?? 60;
  const tooltipY = Math.max(
    6,
    Math.min(targetPointY - tooltipHeight - 10, height - padding.bottom - tooltipHeight),
  );

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
      const marginPart =
        totals.profitMargin !== null ? ` · ${formatPercent(totals.profitMargin)} margin` : "";
      return `Avg: ${formatPeso(totals.avgProfit)}/${chartUnit}${marginPart}`;
    }
    return "All daily revenue, expenses, and net profit for the selected period";
  }, [chartUnit, hasData, metric, totals]);

  return (
    <Card className="revenue-chart-card" aria-labelledby="revenue-over-time-heading">
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
        <TabList
          role="tablist"
          aria-label="Financial metric"
          className="chart-metric-tabs"
        >
          <TabTrigger
            value="revenue"
            active={metric === "revenue"}
            onClick={() => {
              setActiveIndex(null);
              setMetric("revenue");
            }}
          >
            Revenue
          </TabTrigger>
          <TabTrigger
            value="expenses"
            active={metric === "expenses"}
            onClick={() => {
              setActiveIndex(null);
              setMetric("expenses");
            }}
          >
            Expenses
          </TabTrigger>
          <TabTrigger
            value="profit"
            active={metric === "profit"}
            onClick={() => {
              setActiveIndex(null);
              setMetric("profit");
            }}
          >
            Profit
          </TabTrigger>
          <TabTrigger
            value="comparison"
            active={metric === "comparison"}
            onClick={() => {
              setActiveIndex(null);
              setMetric("comparison");
            }}
          >
            All
          </TabTrigger>
        </TabList>

        <div className="chart-toolbar-actions">
          {metric === "comparison" && (
            <div className="chart-comparison-key" aria-label="Chart series legend">
              <span className="chart-key-item">
                <i className="legend-dot-revenue" /> Revenue
              </span>
              <span className="chart-key-item">
                <i className="legend-dot-expenses" /> Expenses
              </span>
              <span className="chart-key-item">
                <i className="legend-dot-profit" /> Net profit
              </span>
            </div>
          )}

          <div className="chart-view-mode-toggle" role="group" aria-label="Chart view mode">
            <IconButton
              variant="ghost"
              size="xs"
              active={viewMode === "line"}
              onClick={() => setViewMode("line")}
              tooltip="Line chart"
              aria-label="Line chart"
            >
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
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </IconButton>
            <IconButton
              variant="ghost"
              size="xs"
              active={viewMode === "bar"}
              onClick={() => setViewMode("bar")}
              tooltip="Bar chart"
              aria-label="Bar chart"
            >
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
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </IconButton>
          </div>
        </div>
      </div>

      <div className="revenue-chart-scroll">
        <svg
          className="revenue-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${activeConfig.title} for ${periodLabel}`}
          onPointerEnter={(event) => {
            if (!hasData) return;
            chartBoundsRef.current = event.currentTarget.getBoundingClientRect();
            selectClosestPoint(event.clientX, chartBoundsRef.current);
          }}
          onPointerMove={(event) => {
            if (!hasData) return;
            const chartBounds =
              chartBoundsRef.current ?? event.currentTarget.getBoundingClientRect();
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
                <text
                  className="chart-axis-label"
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                >
                  {formatPeso(value)}
                </text>
              </g>
            );
          })}

          {/* Data Layer: Lines or Bars if hasData, otherwise clean minimal overlay */}
          {hasData ? (
            viewMode === "line" ? (
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
                      const showPoint = isActive || singleCoordinates.length <= 16;
                      if (!showPoint) return null;
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
                    <path className="chart-area-comp-revenue" d={areaRevenue} />
                    <path className="chart-area-comp-expenses" d={areaExpenses} />
                    <path className="chart-area-comp-profit" d={areaProfit} />
                    <path className="chart-line-revenue" d={lineRevenue} />
                    <path className="chart-line-expenses" d={lineExpenses} />
                    <path className="chart-line-profit" d={lineProfit} />
                    {series.map((point, index) => {
                      const isActive = activeIndex === index;
                      const x = xFor(index);
                      return (
                        <g
                          key={point.date}
                          className={`chart-point-group${isActive ? " active" : ""}`}
                        >
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
                          <circle
                            cx={x}
                            cy={yFor(point.revenue)}
                            r={isActive ? 4 : 2.5}
                            fill="#f59e0b"
                          />
                          <circle
                            cx={x}
                            cy={yFor(point.expenses)}
                            r={isActive ? 4 : 2.5}
                            fill="#f43f5e"
                          />
                          <circle
                            cx={x}
                            cy={yFor(point.profit)}
                            r={isActive ? 4 : 2.5}
                            fill="#10b981"
                          />
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
                    const barGap =
                      barSlotWidth > 15
                        ? Math.max(1, Math.min(3, clusterWidth * 0.04))
                        : 0.5;
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
                        <rect
                          className="chart-bar-rect"
                          x={startX}
                          y={Math.min(revY, zeroY)}
                          width={barW}
                          height={revH}
                          rx={Math.min(3.5, barW / 3)}
                          fill="url(#revenue-bar-fill)"
                        />
                        <rect
                          className="chart-bar-rect"
                          x={startX + barW + barGap}
                          y={Math.min(expY, zeroY)}
                          width={barW}
                          height={expH}
                          rx={Math.min(3.5, barW / 3)}
                          fill="url(#expenses-bar-fill)"
                        />
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
            )
          ) : (
            <g className="chart-empty-state-group" pointerEvents="none">
              <text
                x={padding.left + innerWidth / 2}
                y={padding.top + innerHeight / 2 - 4}
                textAnchor="middle"
                className="chart-empty-text-title"
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  fill: "var(--color-text-secondary)",
                  letterSpacing: "-0.01em",
                }}
              >
                No records found
              </text>
              <text
                x={padding.left + innerWidth / 2}
                y={padding.top + innerHeight / 2 + 15}
                textAnchor="middle"
                className="chart-empty-text-desc"
                style={{
                  fontSize: "11px",
                  fill: "var(--color-text-muted)",
                }}
              >
                No {activeConfig.label.toLowerCase()} recorded in this date range
              </text>
            </g>
          )}

          {/* Interactive Tooltip */}
          {hasData && selectedPoint && activeIndex !== null && (
            <g
              className="chart-point-tooltip"
              pointerEvents="none"
              style={{ transform: `translate(${tooltipX}px, ${tooltipY}px)` }}
            >
              <rect width={tooltipWidth} height={tooltipHeight} rx="10" />
              <text className="chart-tooltip-label" x="11" y="16">
                {selectedPoint.label ?? formatDashboardDate(selectedPoint.date)}
              </text>
              {metric === "comparison" ? (
                <>
                  <text
                    className="chart-tooltip-value"
                    x="11"
                    y="32"
                    fill="#f59e0b"
                    fontSize="10"
                  >
                    Revenue: {formatPeso(selectedPoint.revenue)}
                  </text>
                  <text
                    className="chart-tooltip-value"
                    x="11"
                    y="48"
                    fill="#f43f5e"
                    fontSize="10"
                  >
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
    </Card>
  );
}
