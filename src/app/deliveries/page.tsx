"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { isDateInRange, useGlobalDateRange } from "@/components/global-date-range-picker";
import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RecordDetailDrawer, type RecordDetailSection } from "@/components/record-detail-drawer";
import { RoundedSelect } from "@/components/rounded-select";
import { Icon } from "@/components/route-x-ui";
import { getNextSortState, SortableTableHeader, type SortState } from "@/components/sortable-table-header";
import {
  dashboardPreviewDeliveries,
  filterDashboardDeliveries,
  formatDashboardDate,
  formatPeso,
  getDashboardMetrics,
  getPreviousDateRange,
} from "@/features/dashboard/dashboard-preview-data";
import { calculateFinancialPerformance } from "@/features/deliveries/completion/delivery-completion-financials";
import {
  DELIVERY_PREVIEW_UPDATED_EVENT,
  mergeWithDashboardDeliveries,
  readCreatedDeliveries,
  type CreatedDeliveryPreview,
} from "@/features/deliveries/delivery-local-preview";

type Delivery = {
  id: string;
  client: string;
  truck: string;
  driver: string;
  completed: string;
  revenue: string;
  expenses?: string;
  netIncome?: string;
  pod: "Attached" | "Missing";
  podAttachmentName?: string;
};

type DeliverySortKey = "id" | "client" | "truck" | "driver" | "completed" | "revenue" | "pod";

const previewDeliveries: Delivery[] = dashboardPreviewDeliveries.map((delivery) => ({
  id: delivery.id,
  client: delivery.client,
  truck: delivery.truck,
  driver: delivery.driver,
  completed: formatDashboardDate(delivery.completedOn),
  revenue: formatPeso(delivery.revenue),
  expenses: formatPeso(delivery.expenses),
  netIncome: formatPeso(calculateFinancialPerformance([{ revenue: delivery.revenue, totalExpenses: delivery.expenses }]).netIncome),
  pod: delivery.pod,
}));

function changeLabel(currentValue: number, previousValue: number, fallback: string) {
  if (previousValue === 0) return { text: fallback, state: "positive" };
  const change = ((currentValue - previousValue) / previousValue) * 100;
  const direction = change >= 0 ? "↑" : "↓";
  return {
    text: `${direction} ${Math.abs(change).toFixed(1)}% vs prior period`,
    state: change >= 0 ? "positive" : "warning",
  };
}

function toAmount(value: string) {
  return Number(value.replace(/[^\d.-]/g, ""));
}

function compareDeliveries(left: Delivery, right: Delivery, key: DeliverySortKey) {
  if (key === "completed") return Date.parse(left.completed) - Date.parse(right.completed);
  if (key === "revenue") return toAmount(left.revenue) - toAmount(right.revenue);
  return left[key].localeCompare(right[key], undefined, { numeric: true, sensitivity: "base" });
}

function getDeliverySections(delivery: Delivery): RecordDetailSection[] {
  const financialFields: RecordDetailSection["fields"] = delivery.expenses && delivery.netIncome
    ? [
        { label: "Revenue", value: delivery.revenue, tone: "success" },
        { label: "Total expenses", value: delivery.expenses, tone: "warning" },
        { label: "Net income", value: delivery.netIncome, tone: "success" },
      ]
    : [{ label: "Revenue", value: delivery.revenue, tone: "success" }];
  return [
    { title: "Delivery", fields: [{ label: "Client", value: delivery.client }, { label: "Truck", value: delivery.truck }, { label: "Driver", value: delivery.driver }, { label: "Completed", value: delivery.completed }] },
    {
      title: "Financial details",
      fields: financialFields,
      note: delivery.expenses ? undefined : "Expense details and profitability breakdowns are not available for this record.",
    },
    { title: "Proof of delivery", fields: [{ label: "POD status", value: delivery.pod, tone: delivery.pod === "Missing" ? "warning" : "success" }, ...(delivery.podAttachmentName ? [{ label: "Attached file", value: delivery.podAttachmentName }] : [])], note: delivery.pod === "Missing" ? "Proof of delivery is still required for this completed record." : delivery.podAttachmentName ? "The selected attachment name is stored in this local workspace. File storage will require the approved backend connection." : "Proof of delivery is marked as attached locally." },
  ];
}

function PodQueryFilter({ onApply }: { onApply: (value: "Attached" | "Missing") => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const requestedPod = searchParams.get("pod");
    if (requestedPod === "Attached" || requestedPod === "Missing") onApply(requestedPod);
  }, [onApply, searchParams]);

  return null;
}

export default function DeliveriesPage() {
  const { range } = useGlobalDateRange();
  const [query, setQuery] = useState("");
  const [podFilter, setPodFilter] = useState("All POD status");
  const [driverFilter, setDriverFilter] = useState("All drivers");
  const [clientFilter, setClientFilter] = useState("All clients");
  const [truckFilter, setTruckFilter] = useState("All trucks");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [sort, setSort] = useState<SortState<DeliverySortKey>>({ key: null, direction: "desc" });
  const [showNotice, setShowNotice] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [createdDeliveries, setCreatedDeliveries] = useState<CreatedDeliveryPreview[]>([]);

  useEffect(() => {
    const syncCreatedDeliveries = () => setCreatedDeliveries(readCreatedDeliveries());
    syncCreatedDeliveries();
    window.addEventListener(DELIVERY_PREVIEW_UPDATED_EVENT, syncCreatedDeliveries);
    return () => window.removeEventListener(DELIVERY_PREVIEW_UPDATED_EVENT, syncCreatedDeliveries);
  }, []);

  const allDeliveries = useMemo<Delivery[]>(() => [...createdDeliveries, ...previewDeliveries], [createdDeliveries]);
  const allDashboardDeliveries = useMemo(() => mergeWithDashboardDeliveries(createdDeliveries), [createdDeliveries]);
  const rangeDeliveries = useMemo(() => filterDashboardDeliveries(allDashboardDeliveries, range), [allDashboardDeliveries, range]);
  const previousRangeDeliveries = useMemo(() => {
    const previousRange = getPreviousDateRange(range);
    return previousRange ? filterDashboardDeliveries(allDashboardDeliveries, previousRange) : [];
  }, [allDashboardDeliveries, range]);
  const rangeMetrics = useMemo(() => getDashboardMetrics(rangeDeliveries), [rangeDeliveries]);
  const previousRangeMetrics = useMemo(() => getDashboardMetrics(previousRangeDeliveries), [previousRangeDeliveries]);
  const missingPodsInRange = useMemo(() => rangeDeliveries.filter((delivery) => delivery.pod === "Missing").length, [rangeDeliveries]);
  const completedChange = changeLabel(rangeMetrics.deliveries, previousRangeMetrics.deliveries, "Selected date range");
  const revenueChange = changeLabel(rangeMetrics.revenue, previousRangeMetrics.revenue, "Selected date range");

  const allDrivers = useMemo(() => ["All drivers", ...Array.from(new Set(allDeliveries.map((item) => item.driver)))], [allDeliveries]);
  const allClients = useMemo(() => ["All clients", ...Array.from(new Set(allDeliveries.map((item) => item.client)))], [allDeliveries]);
  const allTrucks = useMemo(() => ["All trucks", ...Array.from(new Set(allDeliveries.map((item) => item.truck)))], [allDeliveries]);
  const hasAdvancedFilters = driverFilter !== "All drivers" || clientFilter !== "All clients" || truckFilter !== "All trucks";

  const deliveries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = allDeliveries.filter((delivery) => {
      const searchableValues = [delivery.id, delivery.client, delivery.truck, delivery.driver, delivery.completed, delivery.revenue, delivery.pod];
      const matchesQuery = !normalized || searchableValues.some((value) => value.toLowerCase().includes(normalized));
      return matchesQuery && (podFilter === "All POD status" || delivery.pod === podFilter) && (driverFilter === "All drivers" || delivery.driver === driverFilter) && (clientFilter === "All clients" || delivery.client === clientFilter) && (truckFilter === "All trucks" || delivery.truck === truckFilter) && isDateInRange(delivery.completed, range);
    });
    if (!sort.key) return filtered;
    return [...filtered].sort((left, right) => compareDeliveries(left, right, sort.key!) * (sort.direction === "asc" ? 1 : -1));
  }, [allDeliveries, clientFilter, driverFilter, podFilter, query, range, sort, truckFilter]);

  const updateSort = (column: DeliverySortKey) => setSort((current) => getNextSortState(current, column));
  const clearAdvancedFilters = () => { setDriverFilter("All drivers"); setClientFilter("All clients"); setTruckFilter("All trucks"); };

  return (
    <div className="app-shell">
      <OperationalSidebar />
      <main className="main-content" id="deliveries">
        <OperationalTopbar />
        <Suspense fallback={null}><PodQueryFilter onApply={setPodFilter} /></Suspense>
        <div className="content-wrap">
          <section className="page-intro">
            <div><h1>Deliveries</h1><p className="subtitle">Search and review completed delivery records, financial entries, and proof of delivery.</p></div>
            <Link className="secondary-button" href="/deliveries/new"><Icon>＋</Icon> Add delivery</Link>
          </section>
          {showNotice && <div className="notice" role="status"><span className="notice-icon">i</span><div><strong>Local workspace</strong><span>New records stay in this browser while the data model and authorization boundary are finalized.</span></div><button type="button" aria-label="Dismiss notice" onClick={() => setShowNotice(false)}>×</button></div>}
          <section className="stat-grid" aria-label="Delivery summary"><div className="stat-card"><span className="stat-label">COMPLETED IN RANGE</span><strong>{rangeMetrics.deliveries}</strong><span className={`stat-meta ${completedChange.state}`}><em>{completedChange.text}</em></span></div><div className="stat-card"><span className="stat-label">REVENUE RECORDED</span><strong>{formatPeso(rangeMetrics.revenue)}</strong><span className={`stat-meta ${revenueChange.state}`}><em>{revenueChange.text}</em></span></div><div className="stat-card"><span className="stat-label">POD FOLLOW-UP</span><strong>{missingPodsInRange}</strong><span className={`stat-meta ${missingPodsInRange > 0 ? "warning" : "positive"}`}>{missingPodsInRange > 0 ? "Needs attention" : "All attached"} <em>in selected range</em></span></div></section>
          <section className="records-card">
            <div className="records-heading"><div><h2>Completed deliveries</h2><p>Use filters or select a row to review the available details.</p></div><button className="export-button" disabled title="Export permissions and format are not approved"><Icon>⇩</Icon> Export <span className="lock">◌</span></button></div>
            <div className="filters"><label className="search-box"><Icon>⌕</Icon><input aria-label="Search deliveries" placeholder="Search by delivery, client, truck, or driver" value={query} onChange={(event) => setQuery(event.target.value)} /></label><RoundedSelect ariaLabel="Filter by POD status" options={["All POD status", "Attached", "Missing"]} value={podFilter} onChange={setPodFilter} /><div className="more-filters-control"><button className="filter-button" type="button" aria-expanded={showMoreFilters} onClick={() => setShowMoreFilters((visible) => !visible)}><Icon>≡</Icon> More filters</button>{showMoreFilters && <div className="more-filters-popover"><span>Refine by</span><RoundedSelect ariaLabel="Filter deliveries by driver" options={allDrivers} value={driverFilter} onChange={setDriverFilter} /><RoundedSelect ariaLabel="Filter deliveries by client" options={allClients} value={clientFilter} onChange={setClientFilter} /><RoundedSelect ariaLabel="Filter deliveries by truck" options={allTrucks} value={truckFilter} onChange={setTruckFilter} /></div>}</div>{hasAdvancedFilters && <button className="filter-button filter-clear" type="button" onClick={clearAdvancedFilters}>Clear filters</button>}</div>
            <div className="table-wrap"><table><thead><tr><SortableTableHeader column="id" label="Delivery" sort={sort} onSort={updateSort} /><SortableTableHeader column="client" label="Client" sort={sort} onSort={updateSort} /><SortableTableHeader column="truck" label="Truck" sort={sort} onSort={updateSort} /><SortableTableHeader column="driver" label="Driver" sort={sort} onSort={updateSort} /><SortableTableHeader column="completed" label="Completed" sort={sort} onSort={updateSort} /><SortableTableHeader column="revenue" label="Revenue" sort={sort} onSort={updateSort} /><SortableTableHeader column="pod" label="POD" sort={sort} onSort={updateSort} /></tr></thead><tbody>{deliveries.map((delivery) => <tr className="record-row" tabIndex={0} role="button" aria-label={`View ${delivery.id} details`} key={delivery.id} onClick={() => setSelectedDelivery(delivery)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDelivery(delivery); } }}><td className="record-link">{delivery.id}</td><td>{delivery.client}</td><td><span className="truck-code">{delivery.truck}</span></td><td>{delivery.driver}</td><td>{delivery.completed}</td><td className="money">{delivery.revenue}</td><td><span className={`pod-status ${delivery.pod === "Missing" ? "missing" : "attached"}`}><i />{delivery.pod}</span></td></tr>)}</tbody></table>{deliveries.length === 0 && <div className="empty-state"><strong>No deliveries found</strong><span>Try a different search, date range, or record filter.</span></div>}</div>
            <div className="table-footer"><span>{deliveries.length} of {allDeliveries.length} records {sort.key ? `· sorted by ${sort.key} ${sort.direction === "asc" ? "ascending" : "descending"}` : "· default completion order"}</span><div className="pagination"><button disabled aria-label="Previous page">‹</button><span>1</span><button disabled aria-label="Next page">›</button></div></div>
          </section>
          <p className="scope-note"><span>●</span> Completed-delivery list only · Local additions do not update dashboard, reports, financial calculations, or audit history.</p>
        </div>
      </main>
      <RecordDetailDrawer record={selectedDelivery ? { title: selectedDelivery.id, subtitle: "COMPLETED DELIVERY", status: { label: selectedDelivery.pod, tone: selectedDelivery.pod === "Missing" ? "warning" : "success" }, sections: getDeliverySections(selectedDelivery) } : null} onClose={() => setSelectedDelivery(null)} />
    </div>
  );
}
