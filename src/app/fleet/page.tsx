"use client";

import { useMemo, useState } from "react";

import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import { Icon } from "@/components/route-x-ui";

const trucks = [
  { id: "NGS 4281", type: "6-wheeler", status: "Active", revenue: "₱158,300", expenses: "₱70,600", margin: "₱87,700" },
  { id: "DAA 7310", type: "6-wheeler", status: "Active", revenue: "₱46,800", expenses: "₱18,800", margin: "₱28,000" },
  { id: "CBZ 1187", type: "10-wheeler", status: "Active", revenue: "₱48,100", expenses: "₱22,100", margin: "₱26,000" },
  { id: "NBE 9042", type: "6-wheeler", status: "Active", revenue: "₱155,600", expenses: "₱70,400", margin: "₱85,200" },
  { id: "ABX 2201", type: "6-wheeler", status: "Active", revenue: "₱57,000", expenses: "₱27,200", margin: "₱29,800" },
  { id: "XCY 6612", type: "4-wheeler", status: "Active", revenue: "₱44,100", expenses: "₱26,200", margin: "₱17,900" },
] as const;

const subcontractedTrucks = [
  { truck: "MMC 6667", company: "Monde Nissin Logistics", type: "6-wheeler", status: "Delivered", margin: "₱29,000" },
  { truck: "NBE 9042", company: "San Miguel Food and Beverage", type: "6-wheeler", status: "In transit", margin: "₱35,200" },
  { truck: "CBZ 1187", company: "Universal Robina Corporation", type: "10-wheeler", status: "Delayed", margin: "₱26,000" },
  { truck: "NGS 4281", company: "Del Monte Philippines, Inc.", type: "6-wheeler", status: "Delivered", margin: "₱31,500" },
] as const;

const truckTypes = ["All types", ...Array.from(new Set(trucks.map((truck) => truck.type)))] as const;
const subcontractorStatuses = ["All statuses", ...Array.from(new Set(subcontractedTrucks.map((truck) => truck.status)))] as const;

export default function FleetPage() {
  const [ownedVisible, setOwnedVisible] = useState(true);
  const [ownedType, setOwnedType] = useState<string>("All types");
  const [subcontractorQuery, setSubcontractorQuery] = useState("");
  const [subcontractorStatus, setSubcontractorStatus] = useState<string>("All statuses");
  const [showSubcontractorFilters, setShowSubcontractorFilters] = useState(false);

  const filteredOwnedTrucks = useMemo(
    () => trucks.filter((truck) => ownedType === "All types" || truck.type === ownedType),
    [ownedType],
  );

  const filteredSubcontractedTrucks = useMemo(() => {
    const query = subcontractorQuery.trim().toLowerCase();
    return subcontractedTrucks.filter((truck) => {
      const matchesQuery = !query || Object.values(truck).some((value) => value.toLowerCase().includes(query));
      const matchesStatus = subcontractorStatus === "All statuses" || truck.status === subcontractorStatus;
      return matchesQuery && matchesStatus;
    });
  }, [subcontractorQuery, subcontractorStatus]);

  return (
    <div className="app-shell">
      <OperationalSidebar />
      <main className="main-content">
        <OperationalTopbar />
        <div className="content-wrap">
          <section className="page-intro fleet-intro">
            <div>
              <p className="eyebrow">OPERATIONS / ASSETS</p>
              <h1>Fleet</h1>
              <p className="subtitle">Truck profitability by ownership and status.</p>
            </div>
            <div className="fleet-intro-actions">
              <RoundedSelect ariaLabel="Filter owned trucks by type" className="fleet-type-filter" options={truckTypes} value={ownedType} onChange={setOwnedType} />
              <button className="secondary-button" disabled title="Creation is unavailable until the data and authorization boundary is connected"><Icon>＋</Icon> Add vehicle <span className="lock">◌</span></button>
            </div>
          </section>

          <section className="fleet-section">
            <div className="fleet-section-heading">
              <strong>Owned trucks · {filteredOwnedTrucks.length}</strong>
              <button className="fleet-section-toggle" type="button" aria-expanded={ownedVisible} aria-controls="owned-truck-grid" onClick={() => setOwnedVisible((visible) => !visible)}>
                <span>{ownedVisible ? "Hide" : "Show"}</span><span className="dropdown-chevron" aria-hidden="true" />
              </button>
            </div>
            <div id="owned-truck-grid" className={`fleet-card-grid${ownedVisible ? "" : " collapsed"}`} aria-hidden={!ownedVisible}>
              {filteredOwnedTrucks.map((truck) => (
                <article className="fleet-card" key={truck.id}>
                  <div className="fleet-photo">No photo yet</div>
                  <div className="fleet-card-body">
                    <div className="fleet-card-title"><div><h2>{truck.id}</h2><p>{truck.type}</p></div><span className="fleet-status">{truck.status}</span></div>
                    <dl><div><dt>Revenue</dt><dd>{truck.revenue}</dd></div><div><dt>Expenses</dt><dd>{truck.expenses}</dd></div><div><dt>Margin</dt><dd>{truck.margin}</dd></div></dl>
                  </div>
                </article>
              ))}
              {filteredOwnedTrucks.length === 0 && <div className="empty-state fleet-empty-state"><strong>No owned trucks found</strong><span>Choose a different truck type.</span></div>}
            </div>
          </section>
          <p className="scope-note"><span>●</span> Fleet profitability preview · Ownership, status, and financial figures are locally available sample records.</p>

          <section className="fleet-subcontracted records-card">
            <div className="records-heading"><div><h2>Subcontracted trucks</h2><p>Showing locally available preview records</p></div><button className="export-button" disabled title="Export permissions are not approved"><Icon>⇩</Icon> Export <span className="lock">◌</span></button></div>
            <div className="filters">
              <label className="search-box"><Icon>⌕</Icon><input aria-label="Search subcontracted trucks" placeholder="Search by truck, company, or status" value={subcontractorQuery} onChange={(event) => setSubcontractorQuery(event.target.value)} /></label>
              {showSubcontractorFilters && <RoundedSelect ariaLabel="Filter subcontracted trucks by status" className="inline-filter" options={subcontractorStatuses} value={subcontractorStatus} onChange={setSubcontractorStatus} />}
              <button className="filter-button" type="button" aria-expanded={showSubcontractorFilters} onClick={() => setShowSubcontractorFilters((visible) => !visible)}><Icon>≡</Icon> {showSubcontractorFilters ? "Hide filters" : "More filters"}</button>
            </div>
            <div className="table-wrap"><table><thead><tr><th>Truck</th><th>Company</th><th>Type</th><th>Status</th><th>Margin</th></tr></thead><tbody>{filteredSubcontractedTrucks.map((item) => <tr key={`${item.truck}-${item.company}`}><td><a href={`#${item.truck}`} className="record-link">{item.truck}</a></td><td>{item.company}</td><td>{item.type}</td><td><span className={`pod-status ${item.status === "Delayed" ? "missing" : "attached"}`}><i />{item.status}</span></td><td className="money">{item.margin}</td></tr>)}</tbody></table>{filteredSubcontractedTrucks.length === 0 && <div className="empty-state"><strong>No subcontracted trucks found</strong><span>Try a different search or status filter.</span></div>}</div>
            <div className="table-footer"><span>{filteredSubcontractedTrucks.length} of {subcontractedTrucks.length} preview trucks</span><div className="pagination"><button disabled aria-label="Previous page">‹</button><span>1</span><button disabled aria-label="Next page">›</button></div></div>
          </section>
        </div>
      </main>
    </div>
  );
}
