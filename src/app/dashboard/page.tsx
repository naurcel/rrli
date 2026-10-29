"use client";

import { useMemo } from "react";
import Link from "next/link";

import { formatDateRange, isDateInRange, useGlobalDateRange } from "@/components/global-date-range-picker";
import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";

const recent = [
  { id: "DLV-0248", client: "Northstar Retail", pod: "Attached", revenue: "₱18,420", completed: "Oct 21, 2026" },
  { id: "DLV-0247", client: "Harbor Foods Co.", pod: "Attached", revenue: "₱12,860", completed: "Oct 20, 2026" },
  { id: "DLV-0246", client: "Evergreen Supply", pod: "Missing", revenue: "₱9,740", completed: "Oct 18, 2026" },
  { id: "DLV-0245", client: "Metro Buildworks", pod: "Attached", revenue: "₱21,110", completed: "Oct 17, 2026" },
] as const;

export default function DashboardPage() {
  const { range } = useGlobalDateRange();
  const filteredRecent = useMemo(() => recent.filter((delivery) => isDateInRange(delivery.completed, range)), [range]);

  return (
    <div className="app-shell">
      <OperationalSidebar />
      <main className="main-content">
        <OperationalTopbar />
        <div className="content-wrap">
          <section className="dashboard-welcome"><p className="eyebrow">OPERATIONS / OVERVIEW</p><h1>Good morning, Shinryu!</h1><p className="subtitle">{formatDateRange(range)} · {filteredRecent.length} deliveries</p></section>
          <section className="stat-grid dashboard-stats"><div className="stat-card"><span className="stat-label">REVENUE</span><strong>₱559,600</strong><span className="stat-meta positive">↑ 8.2% <em>vs last period</em></span></div><div className="stat-card"><span className="stat-label">EXPENSES</span><strong>₱256,000</strong><span className="stat-meta warning">↑ 4.1% <em>vs last period</em></span></div><div className="stat-card"><span className="stat-label">NET MARGIN</span><strong>₱303,600</strong><span className="stat-meta positive">54.3% <em>current margin</em></span></div><div className="stat-card"><span className="stat-label">DELIVERED</span><strong>5</strong><span className="stat-meta positive">↑ 2 <em>this period</em></span></div></section>
          <div className="dashboard-columns">
            <section className="records-card"><div className="records-heading"><div><h2>Recent deliveries</h2><p>Showing locally available preview records</p></div><Link className="record-link" href="/deliveries">View all</Link></div><div className="table-wrap"><table><thead><tr><th>Delivery</th><th>Client</th><th>POD</th><th>Revenue</th></tr></thead><tbody>{filteredRecent.map((delivery) => <tr key={delivery.id}><td className="record-link">{delivery.id}</td><td>{delivery.client}</td><td><span className={`pod-status ${delivery.pod === "Missing" ? "missing" : "attached"}`}><i />{delivery.pod}</span></td><td className="money">{delivery.revenue}</td></tr>)}</tbody></table>{filteredRecent.length === 0 && <div className="empty-state"><strong>No recent deliveries in this range</strong><span>Choose a wider date range to view preview records.</span></div>}</div></section>
            <section className="records-card dashboard-actions"><div className="records-heading"><div><h2>Attention needed</h2><p>Current operational follow-up</p></div></div><div className="attention-item"><strong>Missing POD</strong><span>3 deliveries need proof attached</span></div><div className="attention-item"><strong>Maintenance due</strong><span>3 vehicles need review</span></div></section>
          </div>
          <p className="scope-note"><span>●</span> Recent deliveries follow the selected date range · Summary cards remain local preview totals.</p>
        </div>
      </main>
    </div>
  );
}
