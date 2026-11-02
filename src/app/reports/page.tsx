"use client";

import { useEffect, useMemo, useState } from "react";

import { formatDateRange, useGlobalDateRange } from "@/components/global-date-range-picker";
import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { Icon } from "@/components/route-x-ui";
import { filterDashboardDeliveries, formatPeso, formatProfitMargin } from "@/features/dashboard/dashboard-preview-data";
import {
  DELIVERY_PREVIEW_UPDATED_EVENT,
  mergeWithDashboardDeliveries,
  readCreatedDeliveries,
  type CreatedDeliveryPreview,
} from "@/features/deliveries/delivery-local-preview";
import { getReportPreview, type ReportKind, type ReportPreview, type ReportRow } from "@/features/reports/report-preview-data";

const reportTabs: Array<{ kind: ReportKind; label: string }> = [
  { kind: "revenue", label: "Revenue" },
  { kind: "expenses", label: "Expenses" },
  { kind: "profitability", label: "Profitability" },
  { kind: "operations", label: "Activity" },
];

function primaryValue(row: ReportRow, report: ReportPreview) {
  return report.kind === "operations" ? row.primary.toLocaleString("en-PH") : formatPeso(row.primary);
}

function secondaryValue(row: ReportRow, report: ReportPreview) {
  if (report.kind === "operations") return (row.secondary ?? 0).toLocaleString("en-PH");
  const value = report.kind === "profitability" ? row.secondary : row.share;
  return formatProfitMargin(value);
}

export default function ReportsPage() {
  const { range } = useGlobalDateRange();
  const [reportKind, setReportKind] = useState<ReportKind>("revenue");
  const [createdDeliveries, setCreatedDeliveries] = useState<CreatedDeliveryPreview[]>([]);

  useEffect(() => {
    const syncCreatedDeliveries = () => setCreatedDeliveries(readCreatedDeliveries());
    syncCreatedDeliveries();
    window.addEventListener(DELIVERY_PREVIEW_UPDATED_EVENT, syncCreatedDeliveries);
    return () => window.removeEventListener(DELIVERY_PREVIEW_UPDATED_EVENT, syncCreatedDeliveries);
  }, []);

  const allDeliveries = useMemo(() => mergeWithDashboardDeliveries(createdDeliveries), [createdDeliveries]);
  const deliveries = useMemo(() => filterDashboardDeliveries(allDeliveries, range), [allDeliveries, range]);
  const report = useMemo(() => getReportPreview(deliveries, reportKind), [deliveries, reportKind]);
  const period = formatDateRange(range);
  const isOperations = report.kind === "operations";
  const totalPrimary = isOperations
    ? report.rows.reduce((total, row) => total + row.primary, 0)
    : formatPeso(report.kind === "expenses" ? report.totals.totalExpenses : report.kind === "profitability" ? report.totals.netIncome : report.totals.revenue);
  const totalSecondary = isOperations ? report.rows.reduce((total, row) => total + (row.secondary ?? 0), 0) : "100.0%";

  return (
    <div className="app-shell">
      <OperationalSidebar />
      <main className="main-content">
        <OperationalTopbar />
        <div className="content-wrap report-page">
          <section className="page-intro report-intro">
            <div>
              <h1>Reports</h1>
              <p className="subtitle">Review a date-aware document, then print or save it as a PDF.</p>
            </div>
            <div className="report-actions">
              <button className="secondary-button" disabled title="Export formats and permissions are not approved">
                <Icon>⇩</Icon> Export <span className="lock">◌</span>
              </button>
              <button className="report-print-button" type="button" onClick={() => window.print()}>
                <Icon>▤</Icon> Print / Save PDF
              </button>
            </div>
          </section>

          <div className="notice report-notice" role="status">
            <span className="notice-icon">i</span>
            <div>
              <strong>Local document</strong>
              <span>Totals use local completed-delivery samples and the selected date range. It is not an official accounting, tax, or generated report.</span>
            </div>
          </div>

          <section className="report-workspace" aria-label="Report workspace">
            <div className="report-tabs" role="tablist" aria-label="Report type">
              {reportTabs.map((tab) => (
                <button
                  key={tab.kind}
                  type="button"
                  role="tab"
                  aria-selected={reportKind === tab.kind}
                  className={reportKind === tab.kind ? "active" : ""}
                  onClick={() => setReportKind(tab.kind)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <article className="report-document" aria-labelledby="report-document-title">
              <header className="report-document-header">
                <div>
                  <p>ROUTEX</p>
                  <h2 id="report-document-title">RouteX workspace</h2>
                  <span>{report.title}</span>
                </div>
                <dl>
                  <div><dt>Period</dt><dd>{period}</dd></div>
                  <div><dt>Scope</dt><dd>Local data</dd></div>
                </dl>
              </header>

              <section className="report-summary" aria-label="Report summary">
                <div><span>Revenue</span><strong>{formatPeso(report.totals.revenue)}</strong></div>
                <div><span>Total expenses</span><strong>{formatPeso(report.totals.totalExpenses)}</strong></div>
                <div><span>Deliveries</span><strong>{report.totals.deliveries}</strong></div>
                <div><span>Net income</span><strong>{formatPeso(report.totals.netIncome)} <em>{formatProfitMargin(report.totals.profitMargin)} profit margin</em></strong></div>
              </section>

              <section className="report-table-section">
                <div className="report-table-heading">
                  <h3>{report.description}</h3>
                  <p>{report.rows.length} group{report.rows.length === 1 ? "" : "s"} in the selected range</p>
                </div>
                <div className="report-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{report.subjectLabel}</th>
                        <th>Deliveries</th>
                        <th>{report.primaryLabel}</th>
                        <th>{report.secondaryLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.deliveries}</td>
                          <td>{primaryValue(row, report)}</td>
                          <td>{secondaryValue(row, report)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th>Total</th>
                        <th>{report.totals.deliveries}</th>
                        <th>{totalPrimary}</th>
                        <th>{totalSecondary}</th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {report.rows.length === 0 && (
                  <div className="empty-state report-empty-state">
                    <strong>No records in this range</strong>
                    <span>Choose a wider date range to populate this document.</span>
                  </div>
                )}
              </section>

              <footer className="report-document-footer">
                <span>Prepared in RouteX · local data</span>
                <span>Definitions and export authorization are pending approval.</span>
              </footer>
            </article>
          </section>

          <p className="scope-note"><span>●</span> This document shares the Dashboard&apos;s local figures and selected date range. Export, schedule, and official-document workflows remain unavailable.</p>
        </div>
      </main>
    </div>
  );
}
