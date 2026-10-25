"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/route-x-ui";
import { useSidebarState } from "@/components/sidebar-state";

type Delivery = { id: string; client: string; truck: string; driver: string; completed: string; revenue: string; pod: "Attached" | "Missing" };

const previewDeliveries: Delivery[] = [
  { id: "DLV-0248", client: "Northstar Retail", truck: "TRK-041", driver: "M. Santos", completed: "Oct 21, 2026", revenue: "₱18,420", pod: "Attached" },
  { id: "DLV-0247", client: "Harbor Foods Co.", truck: "TRK-018", driver: "J. Rivera", completed: "Oct 20, 2026", revenue: "₱12,860", pod: "Attached" },
  { id: "DLV-0246", client: "Evergreen Supply", truck: "TRK-033", driver: "A. Dela Cruz", completed: "Oct 18, 2026", revenue: "₱9,740", pod: "Missing" },
  { id: "DLV-0245", client: "Metro Buildworks", truck: "TRK-006", driver: "R. Garcia", completed: "Oct 17, 2026", revenue: "₱21,110", pod: "Attached" },
  { id: "DLV-0244", client: "Lumen Home Goods", truck: "TRK-027", driver: "C. Reyes", completed: "Oct 15, 2026", revenue: "₱7,980", pod: "Attached" },
];
const navItems = [["Overview", "⌂"], ["Deliveries", "▤"], ["Fleet", "▱"], ["Transactions", "₱"], ["Reports", "▥"]];

const scrollPreviewDeliveries: Delivery[] = [
  { id: "DLV-0243", client: "Summit Hardware", truck: "TRK-012", driver: "N. Flores", completed: "Oct 14, 2026", revenue: "PHP 14,560", pod: "Attached" },
  { id: "DLV-0242", client: "Pacific Agri Supply", truck: "TRK-022", driver: "D. Lim", completed: "Oct 13, 2026", revenue: "PHP 16,280", pod: "Missing" },
  { id: "DLV-0241", client: "Cedar & Stone", truck: "TRK-031", driver: "P. Navarro", completed: "Oct 11, 2026", revenue: "PHP 11,390", pod: "Attached" },
  { id: "DLV-0240", client: "Brightline Markets", truck: "TRK-009", driver: "S. Tan", completed: "Oct 10, 2026", revenue: "PHP 8,740", pod: "Attached" },
  { id: "DLV-0239", client: "Oakridge Manufacturing", truck: "TRK-044", driver: "L. Bautista", completed: "Oct 8, 2026", revenue: "PHP 19,620", pod: "Attached" },
  { id: "DLV-0238", client: "Atlas Office Supply", truck: "TRK-015", driver: "K. Mendoza", completed: "Oct 7, 2026", revenue: "PHP 10,850", pod: "Missing" },
  { id: "DLV-0237", client: "Greenway Pharmacy", truck: "TRK-024", driver: "E. Cruz", completed: "Oct 6, 2026", revenue: "PHP 13,210", pod: "Attached" },
  { id: "DLV-0236", client: "Riverside Packaging", truck: "TRK-038", driver: "T. Ramos", completed: "Oct 4, 2026", revenue: "PHP 17,045", pod: "Attached" },
  { id: "DLV-0235", client: "Silverline Imports", truck: "TRK-003", driver: "B. Aquino", completed: "Oct 2, 2026", revenue: "PHP 6,920", pod: "Attached" },
];
const allPreviewDeliveries = [...previewDeliveries, ...scrollPreviewDeliveries];

function PodStatusDropdown({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const options = ["All POD status", "Attached", "Missing"];
  useEffect(() => {
    const closeMenu = () => {
      if (!open || closing) return;
      setClosing(true);
      window.setTimeout(() => { setOpen(false); setClosing(false); }, 160);
    };
    const closeOnOutside = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) closeMenu();
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeMenu(); };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [closing, open]);
  const toggleMenu = () => { if (open) { setClosing(true); window.setTimeout(() => { setOpen(false); setClosing(false); }, 160); } else { setClosing(false); setOpen(true); } };
  const closeAfterSelection = (option: string) => { onChange(option); setClosing(true); window.setTimeout(() => { setOpen(false); setClosing(false); }, 160); };
  return <div className="pod-dropdown" ref={dropdownRef}><button type="button" className="pod-dropdown-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={toggleMenu}><span>{value}</span><span aria-hidden="true">⌄</span></button>{(open || closing) && <div className={`pod-dropdown-menu${closing ? " closing" : ""}`} role="listbox" aria-label="Filter by POD status">{options.map((option) => <button type="button" role="option" aria-selected={option === value} className={option === value ? "selected" : ""} key={option} onClick={() => closeAfterSelection(option)}>{option}</button>)}</div>}</div>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [podFilter, setPodFilter] = useState("All POD status");
  const [showPreviewNotice, setShowPreviewNotice] = useState(true);
  const { width: sidebarWidth, collapsed: sidebarCollapsed, resizing: resizingSidebar, startResize: startSidebarResize, handleResizeKeyDown } = useSidebarState();
  const deliveries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allPreviewDeliveries.filter((delivery) => !normalized || Object.values(delivery).some((value) => value.toLowerCase().includes(normalized))).filter((delivery) => podFilter === "All POD status" || delivery.pod === podFilter);
  }, [podFilter, query]);

  return <div className="app-shell">
    <aside className={`sidebar${sidebarCollapsed ? " collapsed" : ""}${resizingSidebar ? " resizing" : ""}`} style={{ "--sidebar-width": `${sidebarCollapsed ? 72 : sidebarWidth}px` } as React.CSSProperties}>
      <div className="sidebar-brand-space" aria-hidden="true" />
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Primary navigation">{navItems.map(([label, symbol]) => <Link className={label === "Deliveries" ? "nav-item active" : "nav-item"} href={label === "Overview" ? "/dashboard" : label === "Deliveries" ? "/" : label === "Fleet" ? "/fleet" : label === "Transactions" ? "/transactions" : label === "Reports" ? "/reports" : `#${label.toLowerCase()}`} key={label}><Icon>{symbol}</Icon><span className="nav-label">{label}</span></Link>)}</nav>
      <div className="workspace-label lower">MANAGE</div>
      <nav aria-label="Management navigation"><Link className="nav-item" href="/administration"><Icon>◎</Icon><span className="nav-label">Administration</span></Link><Link className="nav-item" href="/settings"><Icon>⚙</Icon><span className="nav-label">Settings</span></Link></nav>
      <div className="sidebar-footer"><div className="avatar"><img src="/profiles/shinryu.png" alt="Shinryu" /></div><div><strong>Shinryu</strong><small>Operations</small></div><button className="more-button" aria-label="Account menu">•••</button></div>
      <div className="sidebar-resize-handle" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" aria-valuemin={72} aria-valuemax={360} aria-valuenow={sidebarCollapsed ? 72 : sidebarWidth} tabIndex={0} onKeyDown={handleResizeKeyDown} onPointerDown={startSidebarResize} />
    </aside>
    <main className="main-content" id="deliveries">
      <header className="topbar"><div className="breadcrumb"><span>Operations</span><b>/</b><strong>Deliveries</strong></div><div className="topbar-actions"><span className="preview-pill"><i /> Preview workspace</span><button className="help-button" aria-label="Help">?</button></div></header>
      <div className="content-wrap">
        <section className="page-intro"><div><p className="eyebrow">OPERATIONS / RECORDS</p><h1>Deliveries</h1><p className="subtitle">Search and review completed delivery records, financial entries, and proof of delivery.</p></div><button className="secondary-button" disabled title="Creation is unavailable until the data and authorization boundary is connected"><Icon>＋</Icon> New delivery <span className="lock">◌</span></button></section>
        {showPreviewNotice && <div className="notice" role="status"><span className="notice-icon">i</span><div><strong>Preview data only</strong><span>This screen is connected to a local preview while the approved data model, authentication, and server authorization boundary are finalized.</span></div><button type="button" aria-label="Dismiss notice" onClick={() => setShowPreviewNotice(false)}>×</button></div>}
        <section className="stat-grid" aria-label="Delivery summary"><div className="stat-card"><span className="stat-label">COMPLETED THIS MONTH</span><strong>24</strong><span className="stat-meta positive">↑ 8.2% <em>vs last month</em></span></div><div className="stat-card"><span className="stat-label">REVENUE RECORDED</span><strong>₱286,410</strong><span className="stat-meta positive">↑ 12.4% <em>vs last month</em></span></div><div className="stat-card"><span className="stat-label">POD FOLLOW-UP</span><strong>3</strong><span className="stat-meta warning">Needs attention <em>in current period</em></span></div></section>
        <section className="records-card"><div className="records-heading"><div><h2>Completed deliveries</h2><p>Showing locally available preview records</p></div><button className="export-button" disabled title="Export permissions and format are not approved"><Icon>⇩</Icon> Export <span className="lock">◌</span></button></div><div className="filters"><label className="search-box"><Icon>⌕</Icon><input aria-label="Search deliveries" placeholder="Search by delivery, client, truck, or driver" value={query} onChange={(event) => setQuery(event.target.value)} /></label><PodStatusDropdown value={podFilter} onChange={setPodFilter} /><button className="filter-button" type="button"><Icon>≡</Icon> More filters</button></div>
          <div className="table-wrap"><table><thead><tr><th>Delivery</th><th>Client</th><th>Truck</th><th>Driver</th><th>Completed</th><th>Revenue</th><th>POD</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{deliveries.map((delivery) => <tr key={delivery.id}><td><a href={`#${delivery.id}`} className="record-link">{delivery.id}</a></td><td>{delivery.client}</td><td><span className="truck-code">{delivery.truck}</span></td><td>{delivery.driver}</td><td>{delivery.completed}</td><td className="money">{delivery.revenue}</td><td><span className={`pod-status ${delivery.pod === "Missing" ? "missing" : "attached"}`}><i />{delivery.pod}</span></td><td><button className="row-menu" aria-label={`Actions for ${delivery.id}`}>•••</button></td></tr>)}</tbody></table>{deliveries.length === 0 && <div className="empty-state"><strong>No deliveries found</strong><span>Try a different search or POD filter.</span></div>}</div>
          <div className="table-footer"><span>{deliveries.length} of {allPreviewDeliveries.length} preview records</span><div className="pagination"><button disabled aria-label="Previous page">‹</button><span>1</span><button disabled aria-label="Next page">›</button></div></div>
        </section><p className="scope-note"><span>●</span> Completed-delivery workflow only · In-progress statuses and timing fields are intentionally not shown.</p>
      </div>
    </main>
  </div>;
}
