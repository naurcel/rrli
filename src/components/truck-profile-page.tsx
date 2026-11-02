"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useGlobalDateRange } from "@/components/global-date-range-picker";
import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import { Icon } from "@/components/route-x-ui";
import { getNextSortState, SortableTableHeader, type SortState } from "@/components/sortable-table-header";
import { TruckPhotoManager } from "@/components/truck-photo-manager";
import { filterDashboardDeliveries, formatDashboardDate, formatPeso, formatProfitMargin, getDashboardMetrics, type DashboardDelivery } from "@/features/dashboard/dashboard-preview-data";
import { DELIVERY_PREVIEW_UPDATED_EVENT, mergeWithDashboardDeliveries, readCreatedDeliveries, type CreatedDeliveryPreview } from "@/features/deliveries/delivery-local-preview";
import { findFleetProfileTruck, fleetTruckTypes, type FleetProfileTruck, type FleetTruckStatus, type FleetTruckType } from "@/features/fleet/fleet-preview-data";
import { readCreatedFleetTrucks, type CreatedFleetTruck } from "@/features/fleet/fleet-local-preview";
import { FLEET_PROFILE_UPDATED_EVENT, readFleetProfileOverrides, saveFleetProfileOverride, type FleetProfileOverride } from "@/features/fleet/fleet-profile-local";

type HistorySortKey = keyof DashboardDelivery;
const HISTORY_PAGE_SIZE = 5;

function normalizeTruckId(value: string) {
  try {
    return decodeURIComponent(value).replace(/\+/g, " ").trim().replace(/\s+/g, " ");
  } catch {
    return value.trim().replace(/\s+/g, " ");
  }
}

function compareHistory(left: DashboardDelivery, right: DashboardDelivery, key: HistorySortKey) {
  if (key === "completedOn") return left.completedOn.localeCompare(right.completedOn);
  if (key === "revenue" || key === "expenses") return left[key] - right[key];
  return left[key].localeCompare(right[key], undefined, { numeric: true, sensitivity: "base" });
}

function getTruckFromCreated(createdTrucks: readonly CreatedFleetTruck[], truckId: string): FleetProfileTruck | undefined {
  const truck = createdTrucks.find((item) => item.id === truckId);
  return truck ? { id: truck.id, type: truck.type, status: truck.status, ownership: "Owned" } : undefined;
}

function statusClass(status: string) {
  return status === "Active" || status === "Delivered" || status === "In transit" ? "success" : "warning";
}

export function TruckProfilePage({ truckId }: { truckId: string }) {
  const normalizedTruckId = normalizeTruckId(truckId);
  const { range } = useGlobalDateRange();
  const [createdTrucks, setCreatedTrucks] = useState<CreatedFleetTruck[]>([]);
  const [createdDeliveries, setCreatedDeliveries] = useState<CreatedDeliveryPreview[]>([]);
  const [overrides, setOverrides] = useState<Record<string, FleetProfileOverride>>({});
  const [query, setQuery] = useState("");
  const [podFilter, setPodFilter] = useState("All POD status");
  const [sort, setSort] = useState<SortState<HistorySortKey>>({ key: null, direction: "desc" });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [draftType, setDraftType] = useState<FleetTruckType>("6-wheeler");
  const [draftStatus, setDraftStatus] = useState<FleetTruckStatus>("Active");

  useEffect(() => {
    const syncLocalFleet = () => {
      setCreatedTrucks(readCreatedFleetTrucks());
      setOverrides(readFleetProfileOverrides());
    };
    syncLocalFleet();
    window.addEventListener("routex-fleet-preview-updated", syncLocalFleet);
    window.addEventListener(FLEET_PROFILE_UPDATED_EVENT, syncLocalFleet);
    const syncCreatedDeliveries = () => setCreatedDeliveries(readCreatedDeliveries());
    syncCreatedDeliveries();
    window.addEventListener(DELIVERY_PREVIEW_UPDATED_EVENT, syncCreatedDeliveries);
    return () => {
      window.removeEventListener("routex-fleet-preview-updated", syncLocalFleet);
      window.removeEventListener(FLEET_PROFILE_UPDATED_EVENT, syncLocalFleet);
      window.removeEventListener(DELIVERY_PREVIEW_UPDATED_EVENT, syncCreatedDeliveries);
    };
  }, []);

  const baseTruck = useMemo(
    () => findFleetProfileTruck(normalizedTruckId) ?? getTruckFromCreated(createdTrucks, normalizedTruckId),
    [createdTrucks, normalizedTruckId],
  );
  const truck = useMemo(() => {
    if (!baseTruck) return undefined;
    const override = baseTruck.ownership === "Owned" ? overrides[baseTruck.id] : undefined;
    return override ? { ...baseTruck, type: override.type, status: override.status } : baseTruck;
  }, [baseTruck, overrides]);

  useEffect(() => {
    if (!truck || truck.ownership !== "Owned") return;
    setDraftType(truck.type);
    setDraftStatus(truck.status as FleetTruckStatus);
    setEditing(false);
  }, [truck?.id, truck?.ownership, truck?.status, truck?.type]);

  const allDeliveries = useMemo(() => mergeWithDashboardDeliveries(createdDeliveries), [createdDeliveries]);
  const deliveryHistory = useMemo(() => {
    if (!truck) return [];
    return filterDashboardDeliveries(allDeliveries, range).filter((delivery) => delivery.truck === truck.id);
  }, [allDeliveries, range, truck]);
  const filteredHistory = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = deliveryHistory.filter((delivery) => {
      const matchesQuery = !normalized || [delivery.id, delivery.client, delivery.pod, delivery.completedOn].some((value) => value.toLowerCase().includes(normalized));
      return matchesQuery && (podFilter === "All POD status" || delivery.pod === podFilter);
    });
    if (!sort.key) return filtered;
    return [...filtered].sort((left, right) => compareHistory(left, right, sort.key!) * (sort.direction === "asc" ? 1 : -1));
  }, [deliveryHistory, podFilter, query, sort]);
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const paginatedHistory = filteredHistory.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);
  const totals = useMemo(() => getDashboardMetrics(deliveryHistory), [deliveryHistory]);

  useEffect(() => { setPage(1); }, [podFilter, query, range.startDate, range.endDate, sort]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const updateSort = (column: HistorySortKey) => setSort((current) => getNextSortState(current, column));
  const saveEdits = () => {
    if (!truck || truck.ownership !== "Owned") return;
    saveFleetProfileOverride({ truckId: truck.id, type: draftType, status: draftStatus });
    setOverrides(readFleetProfileOverrides());
    setEditing(false);
  };
  const toggleStatus = () => {
    if (!truck || truck.ownership !== "Owned") return;
    const nextStatus: FleetTruckStatus = truck.status === "Active" ? "Inactive" : "Active";
    saveFleetProfileOverride({ truckId: truck.id, type: truck.type, status: nextStatus });
    setOverrides(readFleetProfileOverrides());
  };

  if (!truck) {
    return <div className="app-shell"><OperationalSidebar /><main className="main-content"><OperationalTopbar /><div className="content-wrap fallback-page fleet-detail-page"><p className="eyebrow">FLEET</p><h1>Truck profile unavailable</h1><p className="subtitle">This truck is not available in the local Fleet workspace.</p><Link className="secondary-button" href="/fleet">Back to fleet</Link></div></main></div>;
  }

  const isOwned = truck.ownership === "Owned";
  const status = String(truck.status);

  return <div className="app-shell"><OperationalSidebar /><main className="main-content"><OperationalTopbar /><div className="content-wrap fleet-detail-page">
    <Link className="back-link" href="/fleet"><Icon>‹</Icon> Back to fleet</Link>
    <section className="page-intro fleet-detail-intro">
      <div><p className="eyebrow">FLEET / {truck.ownership.toUpperCase()}</p><h1>{truck.id}</h1><p className="subtitle">{truck.type} · {truck.ownership.toLowerCase()} truck profile</p></div>
      {isOwned && <div className="truck-profile-actions"><button className="secondary-button" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel edit" : "Edit truck details"}</button><button className="secondary-button" type="button" onClick={toggleStatus}>{status === "Active" ? "Set inactive" : "Set active"}</button></div>}
    </section>

    <section className="truck-profile-hero">
      <TruckPhotoManager truckId={truck.id} truckType={truck.type} ownership={truck.ownership} />
      <article className="records-card truck-profile-card">
        <div className="records-heading"><div><h2>Truck details</h2><p>Identity and currently available assignment information.</p></div><span className={`detail-status ${statusClass(status)}`}>{status}</span></div>
        <dl className="truck-profile-list"><div><dt>Plate number</dt><dd>{truck.id}</dd></div><div><dt>Ownership</dt><dd>{truck.ownership}</dd></div><div><dt>Vehicle type</dt><dd>{truck.type}</dd></div>{truck.provider && <div><dt>Provider</dt><dd>{truck.provider}</dd></div>}<div><dt>Status</dt><dd className={statusClass(status)}>{status}</dd></div></dl>
        {editing && <form className="truck-profile-editor" onSubmit={(event) => { event.preventDefault(); saveEdits(); }}><label>Vehicle type<select value={draftType} onChange={(event) => setDraftType(event.target.value as FleetTruckType)}>{fleetTruckTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Availability<select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as FleetTruckStatus)}><option>Active</option><option>Inactive</option></select></label><div><button className="secondary-button" type="submit">Save local changes</button></div></form>}
      </article>
      <article className="records-card truck-profile-card truck-profile-availability">
        <div className="records-heading"><div><h2>Operational summary</h2><p>Completed delivery records in the selected date range.</p></div></div>
        <div className="truck-performance-kpis" aria-label="Truck performance metrics">
          <div><span>Total deliveries</span><strong>{totals.deliveries}</strong></div>
          <div><span>Revenue</span><strong>{formatPeso(totals.revenue)}</strong></div>
          <div><span>Total expenses</span><strong>{formatPeso(totals.totalExpenses)}</strong></div>
          <div><span>Net income</span><strong className={totals.netIncome < 0 ? "warning" : undefined}>{formatPeso(totals.netIncome)}</strong></div>
          <div><span>Profit margin</span><strong className={totals.netIncome < 0 ? "warning" : undefined}>{formatProfitMargin(totals.profitMargin)}</strong></div>
        </div>
      </article>
    </section>

    <section className="records-card truck-profile-history" aria-label="Delivery history">
      <div className="records-heading"><div><h2>Delivery history</h2><p>Completed deliveries for {truck.id}; the global date selector controls the current range.</p></div><span className="truck-history-count">{deliveryHistory.length} record{deliveryHistory.length === 1 ? "" : "s"}</span></div>
      <div className="filters"><label className="search-box"><Icon>⌕</Icon><input aria-label="Search this truck's delivery history" placeholder="Search delivery or client" value={query} onChange={(event) => setQuery(event.target.value)} /></label><RoundedSelect ariaLabel="Filter this truck's delivery history by POD status" options={["All POD status", "Attached", "Missing"]} value={podFilter} onChange={setPodFilter} /></div>
      <div className="table-wrap"><table><thead><tr><SortableTableHeader column="id" label="Delivery" sort={sort} onSort={updateSort} /><SortableTableHeader column="client" label="Client" sort={sort} onSort={updateSort} /><SortableTableHeader column="completedOn" label="Completed" sort={sort} onSort={updateSort} /><SortableTableHeader column="revenue" label="Revenue" sort={sort} onSort={updateSort} /><SortableTableHeader column="expenses" label="Expenses" sort={sort} onSort={updateSort} /><SortableTableHeader column="pod" label="POD" sort={sort} onSort={updateSort} /></tr></thead><tbody>{paginatedHistory.map((delivery) => <tr key={delivery.id}><td className="record-link">{delivery.id}</td><td>{delivery.client}</td><td>{formatDashboardDate(delivery.completedOn)}</td><td className="money">{formatPeso(delivery.revenue)}</td><td className="money">{formatPeso(delivery.expenses)}</td><td><span className={`pod-status ${delivery.pod === "Missing" ? "missing" : "attached"}`}><i />{delivery.pod}</span></td></tr>)}</tbody></table>{filteredHistory.length === 0 && <div className="empty-state"><strong>No delivery records found</strong><span>{isOwned ? "Try a different date range, search, or POD filter." : "No completed-delivery records are available for this subcontracted assignment."}</span></div>}</div>
      <div className="table-footer"><span>{filteredHistory.length === 0 ? "No matching records" : `Showing ${(page - 1) * HISTORY_PAGE_SIZE + 1}–${Math.min(page * HISTORY_PAGE_SIZE, filteredHistory.length)} of ${filteredHistory.length} matching records`}</span><div className="pagination"><button type="button" disabled={page === 1} aria-label="Previous page" onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button><span>{page}</span><button type="button" disabled={page === totalPages} aria-label="Next page" onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>›</button></div></div>
    </section>
    <p className="scope-note"><span>•</span> Local Fleet profile · Photo, edit, and availability changes stay in this browser until Fleet persistence is connected.</p>
  </div></main></div>;
}
