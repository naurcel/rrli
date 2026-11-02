"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RecordDetailDrawer, type RecordDetailSection } from "@/components/record-detail-drawer";
import { RoundedSelect } from "@/components/rounded-select";
import { Icon } from "@/components/route-x-ui";
import { getNextSortState, SortableTableHeader, type SortState } from "@/components/sortable-table-header";
import { fleetTruckTypes, ownedFleetTrucks, subcontractedFleetTrucks, type SubcontractedTruck } from "@/features/fleet/fleet-preview-data";
import { readCreatedFleetTrucks, type CreatedFleetTruck } from "@/features/fleet/fleet-local-preview";
import { FLEET_PROFILE_UPDATED_EVENT, readFleetProfileOverrides, type FleetProfileOverride } from "@/features/fleet/fleet-profile-local";

type SubcontractedSortKey = keyof SubcontractedTruck;
const ownedTruckTypeOptions = ["All types", ...fleetTruckTypes];
const subcontractorStatuses = ["All statuses", ...Array.from(new Set(subcontractedFleetTrucks.map((truck) => truck.status)))];
const subcontractorTypes = ["All types", ...fleetTruckTypes];
const subcontractorCompanies = ["All providers", ...Array.from(new Set(subcontractedFleetTrucks.map((truck) => truck.company)))];

function toAmount(value: string) { return Number(value.replace(/[^\d.-]/g, "")); }
function compareSubcontractedTrucks(left: SubcontractedTruck, right: SubcontractedTruck, key: SubcontractedSortKey) {
  if (key === "margin") return toAmount(left.margin) - toAmount(right.margin);
  return left[key].localeCompare(right[key], undefined, { numeric: true, sensitivity: "base" });
}

function getSubcontractedSections(truck: SubcontractedTruck): RecordDetailSection[] {
  return [
    { title: "Assignment", fields: [{ label: "Provider", value: truck.company }, { label: "Truck", value: truck.truck }, { label: "Vehicle type", value: truck.type }, { label: "Status", value: truck.status, tone: truck.status === "Inactive" ? "warning" : "success" }] },
    { title: "Financial details", fields: [{ label: "Net income", value: truck.margin, tone: "success" }], note: "Only the locally available net-income figure is shown for this assignment." },
  ];
}

export default function FleetPage() {
  const [ownedVisible, setOwnedVisible] = useState(true);
  const [ownedType, setOwnedType] = useState("All types");
  const [createdFleetTrucks, setCreatedFleetTrucks] = useState<CreatedFleetTruck[]>([]);
  const [fleetOverrides, setFleetOverrides] = useState<Record<string, FleetProfileOverride>>({});
  const [subcontractorQuery, setSubcontractorQuery] = useState("");
  const [subcontractorStatus, setSubcontractorStatus] = useState("All statuses");
  const [subcontractorType, setSubcontractorType] = useState("All types");
  const [subcontractorCompany, setSubcontractorCompany] = useState("All providers");
  const [showSubcontractorFilters, setShowSubcontractorFilters] = useState(false);
  const [sort, setSort] = useState<SortState<SubcontractedSortKey>>({ key: null, direction: "desc" });
  const [selectedSubcontractedTruck, setSelectedSubcontractedTruck] = useState<SubcontractedTruck | null>(null);
  const hasActiveSubcontractedFilters = subcontractorQuery.trim().length > 0 || subcontractorStatus !== "All statuses" || subcontractorType !== "All types" || subcontractorCompany !== "All providers";
  useEffect(() => {
    const syncCreatedTrucks = () => {
      setCreatedFleetTrucks(readCreatedFleetTrucks());
      setFleetOverrides(readFleetProfileOverrides());
    };
    syncCreatedTrucks();
    window.addEventListener("routex-fleet-preview-updated", syncCreatedTrucks);
    window.addEventListener(FLEET_PROFILE_UPDATED_EVENT, syncCreatedTrucks);
    return () => {
      window.removeEventListener("routex-fleet-preview-updated", syncCreatedTrucks);
      window.removeEventListener(FLEET_PROFILE_UPDATED_EVENT, syncCreatedTrucks);
    };
  }, []);
  const allOwnedTrucks = useMemo(() => [...ownedFleetTrucks, ...createdFleetTrucks].map((truck) => {
    const override = fleetOverrides[truck.id];
    return override ? { ...truck, type: override.type, status: override.status } : truck;
  }), [createdFleetTrucks, fleetOverrides]);
  const filteredOwnedTrucks = useMemo(() => allOwnedTrucks.filter((truck) => ownedType === "All types" || truck.type === ownedType), [allOwnedTrucks, ownedType]);
  const filteredSubcontractedTrucks = useMemo(() => {
    const query = subcontractorQuery.trim().toLowerCase();
    const filtered = subcontractedFleetTrucks.filter((truck) => {
      const matchesQuery = !query || Object.values(truck).some((value) => value.toLowerCase().includes(query));
      return matchesQuery && (subcontractorStatus === "All statuses" || truck.status === subcontractorStatus) && (subcontractorType === "All types" || truck.type === subcontractorType) && (subcontractorCompany === "All providers" || truck.company === subcontractorCompany);
    });
    if (!sort.key) return filtered;
    return [...filtered].sort((left, right) => compareSubcontractedTrucks(left, right, sort.key!) * (sort.direction === "asc" ? 1 : -1));
  }, [sort, subcontractorCompany, subcontractorQuery, subcontractorStatus, subcontractorType]);
  const clearSubcontractedFilters = () => { setSubcontractorQuery(""); setSubcontractorStatus("All statuses"); setSubcontractorType("All types"); setSubcontractorCompany("All providers"); setShowSubcontractorFilters(false); };
  const updateSort = (column: SubcontractedSortKey) => setSort((current) => getNextSortState(current, column));

  return <div className="app-shell"><OperationalSidebar /><main className="main-content"><OperationalTopbar />
    <div className="content-wrap">
      <section className="page-intro fleet-intro"><div><h1>Fleet</h1><p className="subtitle">Truck profitability by ownership and status.</p></div><div className="fleet-intro-actions"><RoundedSelect ariaLabel="Filter owned trucks by type" className="fleet-type-filter" options={ownedTruckTypeOptions} value={ownedType} onChange={setOwnedType} /><Link className="secondary-button" href="/fleet/new"><Icon>＋</Icon> Add vehicle</Link></div></section>
      <section className="fleet-section"><div className="fleet-section-heading"><button className="fleet-section-toggle fleet-section-toggle-full" type="button" aria-expanded={ownedVisible} aria-controls="owned-truck-grid" onClick={() => setOwnedVisible((visible) => !visible)}><strong>Owned trucks · {filteredOwnedTrucks.length}</strong><span className="dropdown-chevron" aria-hidden="true" /></button></div>
        <div id="owned-truck-grid" className={`fleet-card-grid${ownedVisible ? "" : " collapsed"}`} aria-hidden={!ownedVisible}>{filteredOwnedTrucks.map((truck) => <Link className="fleet-card fleet-card-link" href={`/fleet/${encodeURIComponent(truck.id)}`} key={truck.id} aria-label={`View ${truck.id} details`}><div className="fleet-photo">No photo yet</div><div className="fleet-card-body"><div className="fleet-card-title"><div><h2>{truck.id}</h2><p>{truck.type}</p></div><span className={`fleet-status${truck.status === "Inactive" ? " inactive" : ""}`}>{truck.status}</span></div><dl><div><dt>Revenue</dt><dd>{truck.revenue}</dd></div><div><dt>Total expenses</dt><dd>{truck.expenses}</dd></div><div><dt>Net income</dt><dd>{truck.margin}</dd></div></dl><span className="fleet-card-detail-link">View details <b>›</b></span></div></Link>)}{filteredOwnedTrucks.length === 0 && <div className="empty-state fleet-empty-state"><strong>No owned trucks found</strong><span>Choose a different truck type.</span></div>}</div>
      </section>
      <p className="scope-note"><span>●</span> Fleet profitability · Ownership, status, and financial figures are locally available sample records.</p>
      <section className="fleet-subcontracted records-card"><div className="records-heading"><div><h2>Subcontracted trucks</h2><p>Search assignments first, then refine by status, vehicle type, or provider.</p></div><button className="export-button" disabled title="Export permissions are not approved"><Icon>⇩</Icon> Export <span className="lock">◌</span></button></div><div className="filters subcontracted-filters"><label className="search-box"><Icon>⌕</Icon><input aria-label="Search subcontracted trucks" placeholder="Search by truck, company, or status" value={subcontractorQuery} onChange={(event) => setSubcontractorQuery(event.target.value)} /></label><RoundedSelect ariaLabel="Filter subcontracted trucks by status" options={subcontractorStatuses} value={subcontractorStatus} onChange={setSubcontractorStatus} /><div className="more-filters-control"><button className="filter-button subcontracted-filter-disclosure" type="button" aria-expanded={showSubcontractorFilters} aria-controls={showSubcontractorFilters ? "subcontracted-filter-controls" : undefined} onClick={() => setShowSubcontractorFilters((visible) => !visible)}><Icon>≡</Icon> More filters</button>{showSubcontractorFilters && <div id="subcontracted-filter-controls" className="more-filters-popover"><span>Refine by</span><RoundedSelect ariaLabel="Filter subcontracted trucks by type" options={subcontractorTypes} value={subcontractorType} onChange={setSubcontractorType} /><RoundedSelect ariaLabel="Filter subcontracted trucks by provider" options={subcontractorCompanies} value={subcontractorCompany} onChange={setSubcontractorCompany} /></div>}</div>{hasActiveSubcontractedFilters && <button className="filter-button filter-clear" type="button" onClick={clearSubcontractedFilters}>Clear all</button>}</div>
        <div className="table-wrap"><table><thead><tr><SortableTableHeader column="truck" label="Truck" sort={sort} onSort={updateSort} /><SortableTableHeader column="company" label="Company" sort={sort} onSort={updateSort} /><SortableTableHeader column="type" label="Type" sort={sort} onSort={updateSort} /><SortableTableHeader column="status" label="Status" sort={sort} onSort={updateSort} /><SortableTableHeader column="margin" label="Net income" sort={sort} onSort={updateSort} /></tr></thead><tbody>{filteredSubcontractedTrucks.map((item) => <tr className="record-row" tabIndex={0} role="button" aria-label={`View ${item.truck} subcontracted truck details`} key={`${item.truck}-${item.company}`} onClick={() => setSelectedSubcontractedTruck(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedSubcontractedTruck(item); } }}><td><Link className="record-link" href={`/fleet/${encodeURIComponent(item.truck)}`} onClick={(event) => event.stopPropagation()}>{item.truck}</Link></td><td>{item.company}</td><td>{item.type}</td><td><span className={`pod-status ${item.status === "Inactive" ? "missing" : "attached"}`}><i />{item.status}</span></td><td className="money">{item.margin}</td></tr>)}</tbody></table>{filteredSubcontractedTrucks.length === 0 && <div className="empty-state"><strong>No subcontracted trucks found</strong><span>Try a different search or status filter.</span></div>}</div><div className="table-footer"><span>{filteredSubcontractedTrucks.length} of {subcontractedFleetTrucks.length} locally available trucks {sort.key ? `· sorted by ${sort.key} ${sort.direction === "asc" ? "ascending" : "descending"}` : "· default assignment order"}</span><div className="pagination"><button disabled aria-label="Previous page">‹</button><span>1</span><button disabled aria-label="Next page">›</button></div></div>
      </section>
    </div>
    </main><RecordDetailDrawer record={selectedSubcontractedTruck ? { title: selectedSubcontractedTruck.truck, subtitle: "SUBCONTRACTED TRUCK", status: { label: selectedSubcontractedTruck.status, tone: selectedSubcontractedTruck.status === "Inactive" ? "warning" : "success" }, sections: getSubcontractedSections(selectedSubcontractedTruck), profileHref: `/fleet/${encodeURIComponent(selectedSubcontractedTruck.truck)}`, profileLabel: "View truck profile" } : null} onClose={() => setSelectedSubcontractedTruck(null)} />
  </div>;
}
