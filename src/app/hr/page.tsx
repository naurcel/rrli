"use client";

import { useState } from "react";

import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";

type HrView = "overview" | "employees" | "attendance" | "payroll";

const views: { id: HrView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "employees", label: "Employees" },
  { id: "attendance", label: "Attendance" },
  { id: "payroll", label: "Payroll" },
];

const payrollCutoffs = ["1st–15th · paid every 20th", "16th–month end · paid every 5th"];

const payrollWorkflow = [
  "Review attendance and timecards for the selected cutoff.",
  "Confirm delivery assignments, parking work, meetings, leave, and adjustments.",
  "Review pay, allowances, and delivery-related earnings.",
  "Review deductions, cash advances, and supporting records.",
  "Verify individual payslips and payroll totals before finalization.",
];

function EmptyHrState({ title, description }: { title: string; description: string }) {
  return <section className="records-card hr-empty-state"><strong>{title}</strong><span>{description}</span><p>Connect an approved employee and payroll data source before records, calculations, or finalization can be used here.</p></section>;
}

export default function HumanResourcesPage() {
  const [view, setView] = useState<HrView>("overview");
  const [cutoff, setCutoff] = useState(payrollCutoffs[1]);

  return <div className="app-shell"><OperationalSidebar /><main className="main-content"><OperationalTopbar /><div className="content-wrap hr-page">
    <section className="page-intro"><div><h1>Human resources</h1><p className="subtitle">Review employees, attendance readiness, and payroll preparation by cutoff.</p></div><RoundedSelect ariaLabel="Choose payroll cutoff" options={payrollCutoffs} value={cutoff} onChange={setCutoff} /></section>
    <nav className="hr-tabs" aria-label="Human resources sections">{views.map((item) => <button key={item.id} type="button" className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}>{item.label}</button>)}</nav>

    {view === "overview" && <>
      <section className="hr-status-grid" aria-label="Human resources overview">
        <article className="stat-card"><span className="stat-label">EMPLOYEES</span><strong>Not connected</strong><span className="stat-meta">Drivers, helpers, and office staff need an approved source.</span></article>
        <article className="stat-card"><span className="stat-label">CURRENT CUTOFF</span><strong>{cutoff.startsWith("1st") ? "1st–15th" : "16th–month end"}</strong><span className="stat-meta">Selected payroll review period.</span></article>
        <article className="stat-card"><span className="stat-label">ATTENDANCE REVIEW</span><strong>Not connected</strong><span className="stat-meta">Timecards and work classifications are not loaded.</span></article>
        <article className="stat-card"><span className="stat-label">PAYROLL</span><strong>Not prepared</strong><span className="stat-meta">No approved payroll records are available.</span></article>
      </section>

      <section className="records-card hr-workflow-card"><div className="records-heading"><div><h2>Payroll preparation</h2><p>{cutoff}</p></div></div><ol className="hr-workflow-list">{payrollWorkflow.map((item, index) => <li key={item}><span>{index + 1}</span><p>{item}</p></li>)}</ol></section>
      <section className="records-card hr-rules-card"><div className="records-heading"><div><h2>Confirmed operating context</h2><p>Shown for HR review only. These entries do not generate payroll.</p></div></div><div className="hr-rules-grid"><div><strong>Attendance classifications</strong><span>Delivery assignment, no booking, long-distance trip, parking work, company meeting, leave, Sunday booking, and holiday work.</span></div><div><strong>Known daily rates</strong><span>Driver ₱700 and helper ₱600 are recorded interview values. Office-staff rules require a verified source.</span></div><div><strong>Allowances and adjustments</strong><span>Destination allowances, cash releases, pending balances, drops, night work, second trips, and deductions require verified records.</span></div></div></section>
      <p className="scope-note"><span>●</span> HR data is not connected · This workspace does not calculate payroll, contributions, deductions, or payslips yet.</p>
    </>}
    {view === "employees" && <EmptyHrState title="Employee records are not connected" description="Profiles will include employee type, status, compensation references, attendance, allowances, deductions, and cash advances once an approved data source is available." />}
    {view === "attendance" && <EmptyHrState title="Attendance records are not connected" description="Weekly parking-area timecards and HR adjustments must be connected before attendance can be reviewed by employee, date, or cutoff." />}
    {view === "payroll" && <EmptyHrState title="Payroll is not ready to prepare" description="The selected cutoff is visible, but payroll calculations remain unavailable until the approved employee, attendance, allowance, deduction, and contribution rules are connected." />}
  </div></main></div>;
}
