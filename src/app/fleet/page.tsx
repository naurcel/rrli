"use client";

import Link from "next/link";
import { Icon } from "@/components/route-x-ui";
import { useSidebarState } from "@/components/sidebar-state";

const trucks = [
  ["NGS 4281", "6-wheeler", "Active", "₱158,300", "₱70,600", "₱87,700"],
  ["DAA 7310", "6-wheeler", "Active", "₱46,800", "₱18,800", "₱28,000"],
  ["CBZ 1187", "10-wheeler", "Active", "₱48,100", "₱22,100", "₱26,000"],
  ["NBE 9042", "6-wheeler", "Active", "₱155,600", "₱70,400", "₱85,200"],
  ["ABX 2201", "6-wheeler", "Active", "₱57,000", "₱27,200", "₱29,800"],
  ["XCY 6612", "4-wheeler", "Active", "₱44,100", "₱26,200", "₱17,900"],
];
const subcontractedTrucks = [
  ["MMC 6667", "Monde Nissin Logistics", "6-wheeler", "Delivered", "₱29,000"],
  ["NBE 9042", "San Miguel Food and Beverage", "6-wheeler", "In transit", "₱35,200"],
  ["CBZ 1187", "Universal Robina Corporation", "10-wheeler", "Delayed", "₱26,000"],
  ["NGS 4281", "Del Monte Philippines, Inc.", "6-wheeler", "Delivered", "₱31,500"],
];

const navItems = [["Overview", "⌂"], ["Deliveries", "▤"], ["Fleet", "▱"], ["Transactions", "₱"], ["Reports", "▥"]];

export default function FleetPage() {
  const { width: sidebarWidth, collapsed: sidebarCollapsed, resizing: resizingSidebar, startResize, handleResizeKeyDown } = useSidebarState();

  return <div className="app-shell">
    <aside className={`sidebar${sidebarCollapsed ? " collapsed" : ""}${resizingSidebar ? " resizing" : ""}`} style={{ "--sidebar-width": `${sidebarCollapsed ? 72 : sidebarWidth}px` } as React.CSSProperties}>
      <div className="sidebar-brand-space" aria-hidden="true" />
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Primary navigation">{navItems.map(([label, symbol]) => <Link className={label === "Fleet" ? "nav-item active" : "nav-item"} href={label === "Overview" ? "/dashboard" : label === "Deliveries" ? "/" : label === "Fleet" ? "/fleet" : label === "Transactions" ? "/transactions" : label === "Reports" ? "/reports" : `#${label.toLowerCase()}`} key={label}><Icon>{symbol}</Icon><span className="nav-label">{label}</span></Link>)}</nav>
      <div className="workspace-label lower">MANAGE</div>
      <nav aria-label="Management navigation"><Link className="nav-item" href="/administration"><Icon>◎</Icon><span className="nav-label">Administration</span></Link><Link className="nav-item" href="/settings"><Icon>⚙</Icon><span className="nav-label">Settings</span></Link></nav>
      <div className="sidebar-footer"><div className="avatar"><img src="/profiles/shinryu.png" alt="Shinryu" /></div><div><strong>Shinryu</strong><small>Operations</small></div><button className="more-button" aria-label="Account menu">•••</button></div>
      <div className="sidebar-resize-handle" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" aria-valuemin={72} aria-valuemax={360} aria-valuenow={sidebarCollapsed ? 72 : sidebarWidth} tabIndex={0} onKeyDown={handleResizeKeyDown} onPointerDown={startResize} />
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb"><span>Operations</span><b>/</b><strong>Fleet</strong></div><div className="topbar-actions"><span className="preview-pill"><i /> Preview workspace</span><button className="help-button" aria-label="Help">?</button></div></header>
      <div className="content-wrap">
        <section className="page-intro fleet-intro"><div><p className="eyebrow">OPERATIONS / ASSETS</p><h1>Fleet</h1><p className="subtitle">Truck profitability by ownership and status.</p></div><button className="secondary-button" disabled title="Creation is unavailable until the data and authorization boundary is connected"><Icon>＋</Icon> Add vehicle <span className="lock">◌</span></button></section>
        <section className="fleet-section"><div className="fleet-section-heading"><strong>Owned trucks · 6</strong><button type="button">HIDE　⌄</button></div><div className="fleet-card-grid">{trucks.map(([id, type, status, revenue, expenses, margin]) => <article className="fleet-card" key={id}><div className="fleet-photo">No photo yet</div><div className="fleet-card-body"><div className="fleet-card-title"><div><h2>{id}</h2><p>{type}</p></div><span className="fleet-status">{status}</span></div><dl><div><dt>Revenue</dt><dd>{revenue}</dd></div><div><dt>Expenses</dt><dd>{expenses}</dd></div><div><dt>Margin</dt><dd>{margin}</dd></div></dl></div></article>)}</div></section><p className="scope-note"><span>●</span> Fleet profitability preview · Ownership, status, and financial figures are locally available sample records.</p>
        <section className="fleet-subcontracted records-card"><div className="records-heading"><div><h2>Subcontracted trucks</h2><p>Showing locally available preview records</p></div><button className="export-button" disabled title="Export permissions are not approved"><Icon>⇩</Icon> Export <span className="lock">◌</span></button></div><div className="filters"><label className="search-box"><Icon>⌕</Icon><input aria-label="Search subcontracted trucks" placeholder="Search by truck, company, or status" /></label><button className="filter-button" type="button"><Icon>≡</Icon> More filters</button></div><div className="table-wrap"><table><thead><tr><th>Truck</th><th>Company</th><th>Type</th><th>Status</th><th>Margin</th></tr></thead><tbody>{subcontractedTrucks.map(([truck, company, type, status, margin]) => <tr key={`${truck}-${company}`}><td><a href={`#${truck}`} className="record-link">{truck}</a></td><td>{company}</td><td>{type}</td><td><span className={`pod-status ${status === "Delayed" ? "missing" : "attached"}`}><i />{status}</span></td><td className="money">{margin}</td></tr>)}</tbody></table></div><div className="table-footer"><span>{subcontractedTrucks.length} of 12 preview trucks</span><div className="pagination"><button disabled aria-label="Previous page">‹</button><span>1</span><button disabled aria-label="Next page">›</button></div></div></section>
      </div>
    </main>
  </div>;
}
