"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatDateRange, useGlobalDateRange } from "@/components/global-date-range-picker";
import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RecordDetailDrawer, type RecordDetailSection } from "@/components/record-detail-drawer";
import { Icon } from "@/components/route-x-ui";
import { getNextSortState, SortableTableHeader, type SortState } from "@/components/sortable-table-header";
import {
  dashboardQuickActions,
  filterDashboardDeliveries,
  formatDashboardDate,
  formatPeso,
  formatProfitMargin,
  getDashboardMetrics,
  getPreviousDateRange,
  getRevenueSeries,
  getTopTrucks,
  type DashboardDelivery,
  type DashboardMetric,
} from "@/features/dashboard/dashboard-preview-data";
import {
  DELIVERY_PREVIEW_UPDATED_EVENT,
  mergeWithDashboardDeliveries,
  readCreatedDeliveries,
  type CreatedDeliveryPreview,
} from "@/features/deliveries/delivery-local-preview";

const metricLabels: Record<DashboardMetric, { label: string; value: (value: number | null) => string }> = {
  revenue: { label: "Revenue", value: (value) => value === null ? "N/A" : formatPeso(value) },
  netIncome: { label: "Net income", value: (value) => value === null ? "N/A" : formatPeso(value) },
  profitMargin: { label: "Profit margin", value: formatProfitMargin },
};

type RecentDeliverySortKey = "id" | "client" | "truck" | "pod" | "revenue";

function compareRecentDeliveries(left: DashboardDelivery, right: DashboardDelivery, key: RecentDeliverySortKey) {
  if (key === "revenue") return left.revenue - right.revenue;
  return left[key].localeCompare(right[key], undefined, { numeric: true, sensitivity: "base" });
}

function changeLabel(currentValue: number, previousValue: number, fallback: string) {
  if (previousValue === 0) return { text: fallback, state: "neutral" };
  const change = ((currentValue - previousValue) / previousValue) * 100;
  const direction = change >= 0 ? "↑" : "↓";
  return { text: `${direction} ${Math.abs(change).toFixed(1)}% vs prior period`, state: change >= 0 ? "positive" : "warning" };
}

function getDashboardDeliverySections(delivery: DashboardDelivery): RecordDetailSection[] {
  const financials = getDashboardMetrics([delivery]);
  return [
    { title: "Delivery", fields: [{ label: "Client", value: delivery.client }, { label: "Truck", value: delivery.truck }, { label: "Completed", value: formatDashboardDate(delivery.completedOn) }] },
    { title: "Financial details", fields: [{ label: "Revenue", value: formatPeso(financials.revenue), tone: "success" }, { label: "Total expenses", value: formatPeso(financials.totalExpenses), tone: "warning" }, { label: "Net income", value: formatPeso(financials.netIncome), tone: financials.netIncome < 0 ? "warning" : "success" }, { label: "Profit margin", value: formatProfitMargin(financials.profitMargin), tone: financials.netIncome < 0 ? "warning" : "success" }] },
    { title: "Proof of delivery", fields: [{ label: "POD status", value: delivery.pod, tone: delivery.pod === "Missing" ? "warning" : "success" }], note: delivery.pod === "Missing" ? "Proof of delivery is still required for this completed record." : "Proof of delivery is marked as attached." },
  ];
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

function RevenueChart({ series, periodLabel }: { series: Array<{ date: string; revenue: number }>; periodLabel: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const tooltipPositionRef = useRef<{ x: number; y: number } | null>(null);
  const width = 720;
  const height = 232;
  const padding = { top: 22, right: 22, bottom: 40, left: 54 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const peak = Math.max(...series.map((point) => point.revenue), 1);
  const ceiling = Math.ceil(peak / 10_000) * 10_000;
  const gridValues = [0, .5, 1].map((step) => ceiling * step);
  const coordinates = series.map((point, index) => ({
    ...point,
    x: padding.left + (series.length <= 1 ? innerWidth / 2 : (index / (series.length - 1)) * innerWidth),
    y: padding.top + innerHeight - (point.revenue / ceiling) * innerHeight,
  }));
  const line = buildSmoothPath(coordinates, {
    minY: padding.top,
    maxY: padding.top + innerHeight,
  });
  const area = coordinates.length ? `${line} L ${coordinates.at(-1)?.x ?? padding.left},${padding.top + innerHeight} L ${coordinates[0]?.x ?? padding.left},${padding.top + innerHeight} Z` : "";
  const tickIndexes = Array.from(new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])).filter((index) => index >= 0);
  const selectedPoint = activeIndex === null ? null : coordinates[activeIndex];
  const tooltipWidth = 146;
  const tooltipHeight = 42;
  const tooltipX = selectedPoint ? Math.min(Math.max(selectedPoint.x - tooltipWidth / 2, padding.left), width - padding.right - tooltipWidth) : 0;
  const tooltipY = selectedPoint ? Math.max(7, selectedPoint.y - tooltipHeight - 12) : 0;

  useEffect(() => {
    if (activeIndex === null || !selectedPoint) {
      tooltipPositionRef.current = null;
      setTooltipPosition(null);
      return;
    }

    const target = { x: tooltipX, y: tooltipY };
    const start = tooltipPositionRef.current;
    if (!start) {
      tooltipPositionRef.current = target;
      setTooltipPosition(target);
      return;
    }

    const duration = 180;
    const startedAt = performance.now();
    let frameId = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const easedProgress = 1 - ((1 - progress) ** 3);
      const next = {
        x: start.x + ((target.x - start.x) * easedProgress),
        y: start.y + ((target.y - start.y) * easedProgress),
      };
      tooltipPositionRef.current = next;
      setTooltipPosition(next);
      if (progress < 1) frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [activeIndex, tooltipX, tooltipY]);

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
    setActiveIndex(closestIndex);
  };

  return (
    <section className="records-card revenue-chart-card" aria-labelledby="revenue-over-time-heading">
      <div className="records-heading">
        <div><h2 id="revenue-over-time-heading">Revenue over time</h2><p>{periodLabel} · completed delivery revenue</p></div>
        <div className="chart-legend" aria-label="Chart legend"><span><i /> Revenue</span><strong>{formatPeso(series.reduce((total, point) => total + point.revenue, 0))}</strong></div>
      </div>
      {series.length ? (
        <div className="revenue-chart-scroll">
          <svg className="revenue-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Revenue over time for ${periodLabel}`} onPointerMove={(event) => selectClosestPoint(event.clientX, event.currentTarget.getBoundingClientRect())} onPointerLeave={() => setActiveIndex(null)}>
            <defs><linearGradient id="revenue-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--color-accent-highlight)" stopOpacity=".32" /><stop offset="100%" stopColor="var(--color-accent-highlight)" stopOpacity="0" /></linearGradient></defs>
            {gridValues.map((value) => {
              const y = padding.top + innerHeight - (value / ceiling) * innerHeight;
              return <g key={value}><line className="chart-grid-line" x1={padding.left} y1={y} x2={width - padding.right} y2={y} /><text className="chart-axis-label" x={padding.left - 10} y={y + 4} textAnchor="end">{formatPeso(value)}</text></g>;
            })}
            <path className="chart-area" d={area} /><path className="chart-line" d={line} />
            {coordinates.map((point, index) => {
              const isActive = activeIndex === index;
              return <g
                className={`chart-point${isActive ? " active" : ""}`}
                key={point.date}
                tabIndex={0}
                aria-label={`${formatDashboardDate(point.date)}: ${formatPeso(point.revenue)}`}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              >
                <circle cx={point.x} cy={point.y} r="4" />
                <circle className="chart-point-core" cx={point.x} cy={point.y} r="1.75" />
              </g>;
            })}
            {selectedPoint && tooltipPosition && <g className="chart-point-tooltip" pointerEvents="none" transform={`translate(${tooltipPosition.x}, ${tooltipPosition.y})`}><rect width={tooltipWidth} height={tooltipHeight} rx="8" /><text className="chart-tooltip-label" x="11" y="16">{formatDashboardDate(selectedPoint.date)}</text><text className="chart-tooltip-value" x="11" y="31">{formatPeso(selectedPoint.revenue)}</text></g>}
            {tickIndexes.map((index) => {
              const point = coordinates[index];
              return <text className="chart-axis-label" key={point.date} x={point.x} y={height - 13} textAnchor="middle">{formatDashboardDate(point.date).replace(", 2026", "")}</text>;
            })}
          </svg>
        </div>
      ) : <div className="empty-state chart-empty-state"><strong>No revenue in this range</strong><span>Choose a wider date range to view the trend.</span></div>}
    </section>
  );
}

export default function DashboardPage() {
  const { range } = useGlobalDateRange();
  const [rankingMetric, setRankingMetric] = useState<DashboardMetric>("revenue");
  const [recentSort, setRecentSort] = useState<SortState<RecentDeliverySortKey>>({ key: null, direction: "desc" });
  const [selectedDelivery, setSelectedDelivery] = useState<DashboardDelivery | null>(null);
  const [createdDeliveries, setCreatedDeliveries] = useState<CreatedDeliveryPreview[]>([]);

  useEffect(() => {
    const syncCreatedDeliveries = () => setCreatedDeliveries(readCreatedDeliveries());
    syncCreatedDeliveries();
    window.addEventListener(DELIVERY_PREVIEW_UPDATED_EVENT, syncCreatedDeliveries);
    return () => window.removeEventListener(DELIVERY_PREVIEW_UPDATED_EVENT, syncCreatedDeliveries);
  }, []);

  const allDeliveries = useMemo(() => mergeWithDashboardDeliveries(createdDeliveries), [createdDeliveries]);
  const deliveries = useMemo(() => filterDashboardDeliveries(allDeliveries, range), [allDeliveries, range]);
  const previousDeliveries = useMemo(() => {
    const previousRange = getPreviousDateRange(range);
    return previousRange ? filterDashboardDeliveries(allDeliveries, previousRange) : [];
  }, [allDeliveries, range]);
  const metrics = useMemo(() => getDashboardMetrics(deliveries), [deliveries]);
  const previousMetrics = useMemo(() => getDashboardMetrics(previousDeliveries), [previousDeliveries]);
  const topTrucks = useMemo(() => getTopTrucks(deliveries, rankingMetric), [deliveries, rankingMetric]);
  const revenueSeries = useMemo(() => getRevenueSeries(allDeliveries, range), [allDeliveries, range]);
  const recentDeliveries = useMemo(() => {
    const recent = [...deliveries].slice(0, 5);
    if (!recentSort.key) return recent;
    return recent.sort((left, right) => compareRecentDeliveries(left, right, recentSort.key!) * (recentSort.direction === "asc" ? 1 : -1));
  }, [deliveries, recentSort]);
  const missingPods = deliveries.filter((delivery) => delivery.pod === "Missing").length;
  const revenueChange = changeLabel(metrics.revenue, previousMetrics.revenue, "Selected date range");
  const expenseChange = changeLabel(metrics.totalExpenses, previousMetrics.totalExpenses, "Selected date range");
  const deliveryChange = changeLabel(metrics.deliveries, previousMetrics.deliveries, "Selected date range");
  const rangeKey = formatDateRange(range);

  return <div className="app-shell">
    <OperationalSidebar />
    <main className="main-content"><OperationalTopbar />
      <div className="content-wrap"><div className="dashboard-range-refresh" key={rangeKey}>
        <section className="dashboard-welcome"><h1>Good morning, Shinryu!</h1><p className="subtitle">{formatDateRange(range)} · {metrics.deliveries} completed deliveries</p></section>

        <section className="stat-grid dashboard-stats" aria-label="Selected date range summary">
          <Link className="stat-card stat-card-link" href="/deliveries" title="View completed deliveries and revenue breakdown"><span className="stat-label">REVENUE</span><strong>{formatPeso(metrics.revenue)}</strong><span className={`stat-meta ${revenueChange.state}`}><em>{revenueChange.text}</em></span></Link>
          <Link className="stat-card stat-card-link" href="/reports?tab=truck-profitability" title="View itemized expense reports"><span className="stat-label">TOTAL EXPENSES</span><strong>{formatPeso(metrics.totalExpenses)}</strong><span className={`stat-meta ${expenseChange.state}`}><em>{expenseChange.text}</em></span></Link>
          <Link className="stat-card stat-card-link" href="/fleet" title="View fleet profitability and net income"><span className="stat-label">NET INCOME</span><strong>{formatPeso(metrics.netIncome)}</strong><span className={`stat-meta ${metrics.netIncome < 0 ? "warning" : "positive"}`}><em>{metrics.profitMargin === null ? "N/A profit margin" : `${metrics.profitMargin.toFixed(1)}% profit margin`}</em></span></Link>
          <Link className="stat-card stat-card-link" href="/deliveries" title="View delivered trips and drop-offs"><span className="stat-label">DELIVERED</span><strong>{metrics.deliveries}</strong><span className={`stat-meta ${deliveryChange.state}`}><em>{deliveryChange.text}</em></span></Link>
        </section>

        {missingPods > 0 && <section className="records-card dashboard-attention dashboard-attention-urgent" aria-labelledby="attention-heading"><div className="records-heading"><div><h2 id="attention-heading">Attention needed</h2><p>Action is required in the selected date range.</p></div></div><div className="attention-grid"><Link className="attention-item attention-link" href="/deliveries?pod=Missing" aria-label="Review deliveries with missing proof of delivery"><strong>{missingPods} missing POD{missingPods === 1 ? "" : "s"}</strong><span>{missingPods === 1 ? "One completed delivery still needs proof attached." : "Completed deliveries still need proof attached."}</span><b>Review missing PODs →</b></Link></div></section>}

        <section className="dashboard-insights" aria-label="Performance insights">
          <RevenueChart series={revenueSeries} periodLabel={formatDateRange(range)} />
          <section className="records-card top-trucks-card" aria-labelledby="top-trucks-heading">
            <div className="records-heading"><div><h2 id="top-trucks-heading">Top trucks</h2><p>Ranked by {metricLabels[rankingMetric].label.toLowerCase()} in the selected date range</p></div></div>
            <div className="metric-tabs" aria-label="Top truck ranking metric">{(Object.keys(metricLabels) as DashboardMetric[]).map((metric) => <button key={metric} type="button" className={rankingMetric === metric ? "active" : ""} aria-pressed={rankingMetric === metric} onClick={() => setRankingMetric(metric)}>{metricLabels[metric].label}</button>)}</div>
            <ol className="top-truck-list">{topTrucks.map((truck, index) => <li key={truck.truck}><Link className="top-truck-link" href={`/fleet/${encodeURIComponent(truck.truck)}`} aria-label={`Open the ${truck.truck} truck profile`}><span className="truck-rank">{index + 1}</span><strong>{truck.truck}</strong><b>{metricLabels[rankingMetric].value(truck[rankingMetric])}</b><span className="top-truck-preview" aria-hidden="true"><span>Truck profile</span><em>Open {truck.truck} →</em></span></Link></li>)}{topTrucks.length === 0 && <li className="top-truck-empty">No truck activity in this range.</li>}</ol>
            <Link className="dashboard-card-link" href="/fleet">View fleet</Link>
          </section>
        </section>

        <section className="dashboard-columns">
          <section className="records-card"><div className="records-heading"><div><h2>Recent deliveries</h2><p>Select a row to review details or a heading to sort this snapshot.</p></div><Link className="record-link" href="/deliveries">View all</Link></div><div className="table-wrap"><table><thead><tr><SortableTableHeader column="id" label="Delivery" sort={recentSort} onSort={(column) => setRecentSort((current) => getNextSortState(current, column))} /><SortableTableHeader column="client" label="Client" sort={recentSort} onSort={(column) => setRecentSort((current) => getNextSortState(current, column))} /><SortableTableHeader column="truck" label="Truck" sort={recentSort} onSort={(column) => setRecentSort((current) => getNextSortState(current, column))} /><SortableTableHeader column="pod" label="POD" sort={recentSort} onSort={(column) => setRecentSort((current) => getNextSortState(current, column))} /><SortableTableHeader column="revenue" label="Revenue" sort={recentSort} onSort={(column) => setRecentSort((current) => getNextSortState(current, column))} /></tr></thead><tbody>{recentDeliveries.map((delivery) => <tr className="record-row" tabIndex={0} role="button" aria-label={`View ${delivery.id} details`} key={delivery.id} onClick={() => setSelectedDelivery(delivery)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDelivery(delivery); } }}><td className="record-link">{delivery.id}</td><td>{delivery.client}</td><td className="truck-code">{delivery.truck}</td><td><span className={`pod-status ${delivery.pod === "Missing" ? "missing" : "attached"}`}><i />{delivery.pod}</span></td><td className="money">{formatPeso(delivery.revenue)}</td></tr>)}</tbody></table>{recentDeliveries.length === 0 && <div className="empty-state"><strong>No recent deliveries in this range</strong><span>Choose a wider date range to view records.</span></div>}</div></section>
          <section className="records-card dashboard-actions" aria-labelledby="quick-actions-heading"><div className="records-heading"><div><h2 id="quick-actions-heading">Quick actions</h2><p>Actions will be tailored to your access when roles are defined.</p></div></div><div className="quick-action-list">{dashboardQuickActions.map((action) => <Link className="quick-action" href={action.href} key={action.label}><Icon>{action.symbol}</Icon><span><strong>{action.label}</strong><small>{action.description}</small></span><b aria-hidden="true">›</b></Link>)}</div></section>
        </section>

        <p className="scope-note"><span>●</span> Dashboard values, rankings, and trend data use locally available records and follow the selected date range. Role-specific actions will apply after the RBAC matrix is approved.</p>
      </div></div>
    </main>
    <RecordDetailDrawer record={selectedDelivery ? { title: selectedDelivery.id, subtitle: "COMPLETED DELIVERY", status: { label: selectedDelivery.pod, tone: selectedDelivery.pod === "Missing" ? "warning" : "success" }, sections: getDashboardDeliverySections(selectedDelivery) } : null} onClose={() => setSelectedDelivery(null)} />
  </div>;
}
