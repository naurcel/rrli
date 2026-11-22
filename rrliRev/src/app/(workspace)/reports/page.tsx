"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  addDays,
  formatDateRange,
  formatShortDate,
  GlobalDateRangePicker,
  parseDateValue,
  toDateKey,
  useGlobalDateRange,
  type DateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { TablePagination } from "@/components/table-pagination";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import { toast } from "sonner";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import {
  downloadReportCsvFile,
  downloadReportXlsxFile,
  formatCellValue,
  processReport,
} from "@/features/reports/report-engine";
import {
  BUILTIN_REPORT_TEMPLATES,
  DEFAULT_REVENUE_TEMPLATE,
} from "@/features/reports/report-template-types";
import {
  CompanyExpense,
  filterExpensesByDateRange,
} from "@/features/finance/company-expense-domain";
import {
  readBrowserPreviewExpenses,
  ROUTEX_COMPANY_EXPENSES_CHANGED,
} from "@/features/finance/browser-preview-expenses";
import { canExportReports } from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";

export default function ReportsPage() {
  const actor = useAuthenticatedActor();
  const { range } = useGlobalDateRange();

  const [activeTemplateId, setActiveTemplateId] = useState<string>("default-revenue");
  const [dailyDate, setDailyDate] = useState<string>(() => {
    return toDateKey(new Date());
  });

  // Find active template from standard built-in formats
  const activeTemplate = useMemo(() => {
    return (
      BUILTIN_REPORT_TEMPLATES.find((t) => t.id === activeTemplateId) ||
      DEFAULT_REVENUE_TEMPLATE
    );
  }, [activeTemplateId]);

  const isDailyTripReport = activeTemplate.id === "default-daily-trip";

  // For Daily Trip Report, the effective date range is strictly fixed to that single day,
  // completely ignoring whatever date filter is selected in the global topbar.
  const effectiveRange = useMemo<DateRange>(() => {
    if (isDailyTripReport) {
      const parsedDay = parseDateValue(dailyDate);
      return { startDate: parsedDay, endDate: parsedDay };
    }
    return range;
  }, [isDailyTripReport, dailyDate, range]);

  const { deliveries: filteredDeliveries, loading, error } = usePersistedDeliveries(effectiveRange);

  // Table sorting
  const [reportSort, setReportSort] = useState<{ key: string; direction: TableSortDirection }>({
    key: "revenue",
    direction: "desc",
  });

  // Company finance records (incoming & outgoing)
  const [companyExpenses, setCompanyExpenses] = useState<CompanyExpense[]>([]);

  useEffect(() => {
    async function fetchExpenses() {
      try {
        const res = await fetch("/api/finance/expenses?pageSize=100");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.items)) {
            setCompanyExpenses(data.items);
            return;
          }
        }
      } catch {
        // Fallback
      }
      setCompanyExpenses(readBrowserPreviewExpenses());
    }

    fetchExpenses();

    const onExpensesChanged = () => {
      setCompanyExpenses(readBrowserPreviewExpenses());
    };
    window.addEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, onExpensesChanged);
    return () => {
      window.removeEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, onExpensesChanged);
    };
  }, []);

  const filteredCompanyExpenses = useMemo(() => {
    return filterExpensesByDateRange(
      companyExpenses,
      effectiveRange.startDate ? toDateKey(effectiveRange.startDate) : null,
      effectiveRange.endDate ? toDateKey(effectiveRange.endDate) : null,
    );
  }, [companyExpenses, effectiveRange]);

  // Aggregate company general ledger: incoming income and outgoing operating expenses
  const companyFinanceSummary = useMemo(() => {
    let incoming = 0;
    let incomingCount = 0;
    let outgoing = 0;
    let outgoingCount = 0;

    for (const exp of filteredCompanyExpenses) {
      if (exp.transactionType === "Incoming") {
        incoming += exp.amount;
        incomingCount++;
      } else {
        outgoing += exp.amount;
        outgoingCount++;
      }
    }

    return {
      incoming,
      incomingCount,
      outgoing,
      outgoingCount,
      net: incoming - outgoing,
      totalCount: filteredCompanyExpenses.length,
    };
  }, [filteredCompanyExpenses]);

  // Handle URL query parameters for tab / template routing
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const templateParam = params.get("template") || params.get("templateId");
      const tabParam = params.get("tab");

      if (templateParam) {
        setActiveTemplateId(templateParam);
      } else if (tabParam) {
        const tabToId: Record<string, string> = {
          revenue: "default-revenue",
          expenses: "default-expenses",
          profitability: "default-profitability",
          activity: "default-activity",
          "trip-ledger": "default-trip-ledger",
          ledger: "default-trip-ledger",
          daily: "default-daily-trip",
          "daily-trip": "default-daily-trip",
          "daily-trips": "default-daily-trip",
          "truck-profitability": "default-profitability",
          "client-deliveries": "default-revenue",
          "pod-completeness": "default-activity",
          export: "data-export",
          "data-export": "data-export",
        };
        if (tabToId[tabParam]) {
          setActiveTemplateId(tabToId[tabParam]);
        }
      }

      const dateParam = params.get("date");
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        setDailyDate(dateParam);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // Adjust default sort key when active template changes
  useEffect(() => {
    const visibleCols = activeTemplate.columns.filter((c) => c.visible);
    if (visibleCols.length > 0) {
      const preferred =
        visibleCols.find((c) => ["revenue", "expenses", "netProfit", "deliveries", "netIncome"].includes(c.id)) ||
        visibleCols[0];
      setReportSort({
        key: preferred.id,
        direction: preferred.id === "clientName" || preferred.id === "plateNumber" ? "asc" : "desc",
      });
    }
  }, [activeTemplate.id, activeTemplate.columns]);

  // Process report rows and metrics using reporting engine with combined company finance
  const processedReport = useMemo(() => {
    return processReport(filteredDeliveries, activeTemplate, {
      incoming: companyFinanceSummary.incoming,
      outgoing: companyFinanceSummary.outgoing,
    });
  }, [filteredDeliveries, activeTemplate, companyFinanceSummary]);

  // Consolidated financial aggregates
  const totalInflow = processedReport.totals.grossEarnings + companyFinanceSummary.incoming;
  const totalOutflow = processedReport.totals.totalExpenses + companyFinanceSummary.outgoing;
  const consolidatedNetProfit = totalInflow - totalOutflow;
  const consolidatedMargin = totalInflow > 0 ? (consolidatedNetProfit / totalInflow) * 100 : null;

  // Sort rows for presentation
  const sortedRows = useMemo(() => {
    if (!reportSort.key) return processedReport.rows;
    const mult = reportSort.direction === "asc" ? 1 : -1;
    return [...processedReport.rows].sort((a, b) => {
      const valA = a[reportSort.key];
      const valB = b[reportSort.key];
      if (typeof valA === "number" && typeof valB === "number") {
        return (valA - valB) * mult;
      }
      return String(valA ?? "").localeCompare(String(valB ?? "")) * mult;
    });
  }, [processedReport.rows, reportSort.key, reportSort.direction]);

  const [reportPage, setReportPage] = useState(1);
  const REPORT_PAGE_SIZE = 10;
  const reportPageCount = Math.max(1, Math.ceil(sortedRows.length / REPORT_PAGE_SIZE));

  useEffect(() => {
    setReportPage(1);
  }, [activeTemplate.id, effectiveRange, reportSort]);

  const paginatedRows = useMemo(() => {
    const start = (reportPage - 1) * REPORT_PAGE_SIZE;
    return sortedRows.slice(start, start + REPORT_PAGE_SIZE);
  }, [sortedRows, reportPage]);

  // Column totals for footer row
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const col of processedReport.columns) {
      if (col.dataType === "currency" || col.dataType === "number") {
        let sum = 0;
        for (const row of sortedRows) {
          const val = row[col.id];
          if (typeof val === "number") sum += val;
        }
        totals[col.id] = sum;
      }
    }
    return totals;
  }, [processedReport.columns, sortedRows]);

  const generatedDateString = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  function changeReportSort(key: string, direction: TableSortDirection) {
    setReportSort({ key, direction });
  }

  return (
    <>
      <style>{`
        @media print {
          html, body {
            overflow: visible !important;
            background: #ffffff !important;
            color: #111827 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
          }
          .app-shell, .main-content, .content-wrap, .report-workspace {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
          }
          aside.sidebar,
          .sidebar,
          header.topbar,
          .topbar,
          footer.routex-footer,
          .routex-footer,
          header.page-intro,
          .page-intro,
          .report-intro,
          .report-actions,
          .report-tabs-bar,
          .daily-trip-date-bar,
          .no-print,
          .no-print *,
          [role="alert"],
          [role="status"] {
            display: none !important;
            visibility: hidden !important;
          }
          .report-workspace > *:not(.report-document) {
            display: none !important;
          }
          .report-document,
          .report-document.doc-sheet {
            display: block !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #111827 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .report-screen-only-row {
            display: none !important;
          }
          .report-print-only-row {
            display: table-row !important;
          }
        }
      `}</style>

      <OperationalTopbar
        contextLabel="Delivery Operations & Truck Reports"
        showDateFilter={false}
      />

      <div className="content-wrap report-page">
        <header className="page-intro report-intro no-print">
          <div>
            <h1>Reports</h1>
            <p className="subtitle">
              Print and export delivery and company financial reports.
            </p>
          </div>
          <div className="report-actions">
            {canExportReports(actor.role) && (
              <>
                <button
                  type="button"
                  className="page-intro-action report-export-action"
                  aria-label="Export report to Excel (.xlsx)"
                  onClick={() => {
                    downloadReportXlsxFile(
                      processedReport,
                      formatDateRange(effectiveRange),
                    );
                    toast.success("Excel report downloaded", {
                      description: `${processedReport.template.name} exported as .xlsx.`,
                    });
                  }}
                >
                  <span aria-hidden="true">↓</span> Export Excel (.xlsx)
                </button>
                <button
                  type="button"
                  className="page-intro-action report-export-action"
                  aria-label="Export report to Excel CSV"
                  onClick={() => {
                    downloadReportCsvFile(
                      processedReport,
                      formatDateRange(effectiveRange),
                    );
                    toast.success("CSV report downloaded", {
                      description: `${processedReport.template.name} exported as .csv.`,
                    });
                  }}
                >
                  <span aria-hidden="true">↓</span> Export CSV
                </button>
              </>
            )}
            <button
              type="button"
              className="report-print-button page-intro-action"
              aria-label="Print report"
              onClick={() => window.print()}
            >
              Print
            </button>
          </div>
        </header>

        {error ? (
          <section className="notice" role="alert">
            <span className="notice-icon" aria-hidden="true">!</span>
            <div>
              <strong>Report data unavailable:</strong>
              <span>{error}</span>
            </div>
          </section>
        ) : loading ? (
          <section className="notice" role="status">
            <span className="notice-icon" aria-hidden="true">i</span>
            <div>
              <strong>Preparing report:</strong>
              <span>Loading completed deliveries and corporate finance records.</span>
            </div>
          </section>
        ) : null}

        <div className={`report-workspace${loading ? " is-loading" : ""}`}>
          {/* Report Format Selection Tabs */}
          <div className="report-tabs-bar no-print">
            <div className="report-tabs" role="tablist" aria-label="Standard report formats">
              {BUILTIN_REPORT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTemplateId === tpl.id}
                  className={activeTemplateId === tpl.id ? "active" : undefined}
                  onClick={() => setActiveTemplateId(tpl.id)}
                >
                  {tpl.id === "default-daily-trip"
                    ? "Daily Trips"
                    : tpl.layout.title.replace(" Report", "")}
                </button>
              ))}
            </div>

            <div className="report-tabs-bar-controls">
              <GlobalDateRangePicker />
            </div>
          </div>

          {/* Daily Trip Fixed-Day Date Navigation Controls */}
          {isDailyTripReport && (
            <div className="daily-trip-date-bar no-print">
              <div className="daily-trip-date-controls">
                <span className="daily-trip-date-label">Trip Date:</span>
                <button
                  type="button"
                  className="daily-nav-btn"
                  disabled={dailyDate <= "2024-01-01"}
                  onClick={() =>
                    setDailyDate((prev) => {
                      const next = toDateKey(addDays(parseDateValue(prev), -1));
                      return next < "2024-01-01" ? "2024-01-01" : next;
                    })
                  }
                  aria-label="Previous day"
                  title="Previous day"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>Prev Day</span>
                </button>
                <input
                  type="date"
                  min="2024-01-01"
                  className="daily-date-input"
                  aria-label="Select report date"
                  value={dailyDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDailyDate(e.target.value < "2024-01-01" ? "2024-01-01" : e.target.value);
                    }
                  }}
                />
                <button
                  type="button"
                  className="daily-nav-btn"
                  onClick={() => setDailyDate((prev) => toDateKey(addDays(parseDateValue(prev), 1)))}
                  aria-label="Next day"
                  title="Next day"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                >
                  <span>Next Day</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="daily-today-btn"
                  onClick={() => setDailyDate(toDateKey(new Date()))}
                >
                  Today
                </button>
              </div>
              <span className="daily-trip-notice">
                Fixed to {formatShortDate(parseDateValue(dailyDate))} (Single-day report)
              </span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MICROSOFT WORD / GOOGLE DOCS STYLE DOCUMENT SHEET                         */}
          {/* ========================================================================= */}
          <article className="report-document doc-sheet" aria-label="Formatted operational report">
            {/* Document Letterhead */}
            <header className="doc-header-border">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 750, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280" }}>
                    REDEEMED ROUTE LOGISTICS INC.
                  </span>
                  <h1 style={{ margin: "4px 0 0", fontSize: "24px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
                    {activeTemplate.layout.title}
                  </h1>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#4b5563" }}>
                    {isDailyTripReport
                      ? `Daily operational trip manifest for ${formatShortDate(parseDateValue(dailyDate))}.`
                      : (activeTemplate.layout.subtitle || "Consolidated operations and corporate financial statement.")}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ display: "inline-block", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", textTransform: "uppercase" }}>
                    Official Report
                  </span>
                </div>
              </div>

              {/* Document Metadata Table (Word/Docs key-value grid) */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px", fontSize: "11.5px" }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "6px 0", color: "#6b7280", width: "16%" }}><strong>Period:</strong></td>
                    <td style={{ padding: "6px 0", color: "#111827", width: "34%" }}>
                      {isDailyTripReport
                        ? `${formatShortDate(parseDateValue(dailyDate))} (Daily)`
                        : formatDateRange(effectiveRange)}
                    </td>
                    <td style={{ padding: "6px 0", color: "#6b7280", width: "16%" }}><strong>Generated:</strong></td>
                    <td style={{ padding: "6px 0", color: "#111827", width: "34%" }}>{generatedDateString}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "6px 0", color: "#6b7280" }}><strong>Prepared By:</strong></td>
                    <td style={{ padding: "6px 0", color: "#111827" }}>{actor.fullName || actor.username} ({actor.roleLabel})</td>
                    <td style={{ padding: "6px 0", color: "#6b7280" }}><strong>Scope:</strong></td>
                    <td style={{ padding: "6px 0", color: "#111827" }}>Deliveries &amp; General Company Ledger</td>
                  </tr>
                </tbody>
              </table>
            </header>

            {/* ========================================================================= */}
            {/* 1. FINANCIAL STATEMENT (Accommodating Delivery AND Finance Incoming/Outgoing) */}
            {/* ========================================================================= */}
            <section style={{ marginBottom: "28px" }}>
              <h2 style={{ fontSize: "13px", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.04em", color: "#111827", margin: "0 0 8px 0", borderBottom: "1px solid #d1d5db", paddingBottom: "5px" }}>
                1. Consolidated Financial Statement &amp; Profitability
              </h2>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", width: "42%" }}>Account / Financial Stream</th>
                    <th style={{ textAlign: "right", width: "19%" }}>Delivery Operations</th>
                    <th style={{ textAlign: "right", width: "19%" }}>Company Ledger</th>
                    <th style={{ textAlign: "right", width: "20%" }}>Consolidated Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 650 }}>Gross Inflow / Revenue</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(processedReport.totals.grossEarnings)}</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(companyFinanceSummary.incoming)}</td>
                    <td style={{ textAlign: "right", fontWeight: 750, color: "#059669" }}>
                      {formatPeso(totalInflow)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 650 }}>Operating Outflow / Expenses</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(processedReport.totals.totalExpenses)}</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(companyFinanceSummary.outgoing)}</td>
                    <td style={{ textAlign: "right", fontWeight: 750, color: "#dc2626" }}>
                      {formatPeso(totalOutflow)}
                    </td>
                  </tr>
                  {/* Itemized Outflow Breakdown */}
                  <tr style={{ fontSize: "11px", color: "#6b7280", background: "#fcfcfc" }}>
                    <td style={{ paddingLeft: "24px" }}>— Diesel Fuel Expenses</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(processedReport.totals.totalDieselExpenses)}</td>
                    <td style={{ textAlign: "right" }}>—</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(processedReport.totals.totalDieselExpenses)}</td>
                  </tr>
                  <tr style={{ fontSize: "11px", color: "#6b7280", background: "#fcfcfc" }}>
                    <td style={{ paddingLeft: "24px" }}>— Highway Toll &amp; Pass Fees</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(processedReport.totals.totalTollExpenses)}</td>
                    <td style={{ textAlign: "right" }}>—</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(processedReport.totals.totalTollExpenses)}</td>
                  </tr>
                  <tr style={{ fontSize: "11px", color: "#6b7280", background: "#fcfcfc" }}>
                    <td style={{ paddingLeft: "24px" }}>— Driver &amp; Helper Compensation</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(processedReport.totals.totalCrewCosts)}</td>
                    <td style={{ textAlign: "right" }}>—</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(processedReport.totals.totalCrewCosts)}</td>
                  </tr>
                  <tr style={{ fontSize: "11px", color: "#6b7280", background: "#fcfcfc" }}>
                    <td style={{ paddingLeft: "24px" }}>— Corporate Operating / General Outgoing</td>
                    <td style={{ textAlign: "right" }}>—</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(companyFinanceSummary.outgoing)}</td>
                    <td style={{ textAlign: "right" }}>{formatPeso(companyFinanceSummary.outgoing)}</td>
                  </tr>
                  {/* Bottom Line Balance */}
                  <tr style={{ borderTop: "2px solid #111827", background: "#f9fafb" }}>
                    <td style={{ fontWeight: 800, color: "#111827" }}>Net Profit / Operating Balance (=)</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: processedReport.totals.netProfit >= 0 ? "#059669" : "#dc2626" }}>
                      {formatPeso(processedReport.totals.netProfit)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: companyFinanceSummary.net >= 0 ? "#059669" : "#dc2626" }}>
                      {formatPeso(companyFinanceSummary.net)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800, fontSize: "13px", color: consolidatedNetProfit >= 0 ? "#059669" : "#dc2626" }}>
                      {formatPeso(consolidatedNetProfit)}
                    </td>
                  </tr>
                  <tr style={{ background: "#f9fafb", fontSize: "11.5px" }}>
                    <td style={{ fontWeight: 700, color: "#4b5563" }}>Profit Margin %</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {processedReport.totals.marginPercent !== null ? formatPercent(processedReport.totals.marginPercent) : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {companyFinanceSummary.incoming > 0 ? formatPercent((companyFinanceSummary.net / companyFinanceSummary.incoming) * 100) : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 750, color: consolidatedNetProfit >= 0 ? "#059669" : "#dc2626" }}>
                      {consolidatedMargin !== null ? formatPercent(consolidatedMargin) : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* ========================================================================= */}
            {/* 2. OPERATIONAL FLEET & VOLUME STATISTICS                                  */}
            {/* ========================================================================= */}
            <section style={{ marginBottom: "28px" }}>
              <h2 style={{ fontSize: "13px", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.04em", color: "#111827", margin: "0 0 8px 0", borderBottom: "1px solid #d1d5db", paddingBottom: "5px" }}>
                2. Operational Volume Statistics
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "4px", padding: "8px 12px", background: "#f9fafb" }}>
                  <span style={{ display: "block", fontSize: "10px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Completed Trips</span>
                  <strong style={{ display: "block", fontSize: "16px", fontWeight: 800, color: "#111827", marginTop: "1px" }}>
                    {processedReport.totals.totalTrips}
                  </strong>
                  <span style={{ fontSize: "9.5px", color: "#9ca3af" }}>Finalized manifests</span>
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "4px", padding: "8px 12px", background: "#f9fafb" }}>
                  <span style={{ display: "block", fontSize: "10px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Store Drop-offs</span>
                  <strong style={{ display: "block", fontSize: "16px", fontWeight: 800, color: "#111827", marginTop: "1px" }}>
                    {processedReport.totals.totalStoreDropoffs}
                  </strong>
                  <span style={{ fontSize: "9.5px", color: "#9ca3af" }}>Delivered locations</span>
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "4px", padding: "8px 12px", background: "#f9fafb" }}>
                  <span style={{ display: "block", fontSize: "10px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Active Trucks</span>
                  <strong style={{ display: "block", fontSize: "16px", fontWeight: 800, color: "#111827", marginTop: "1px" }}>
                    {processedReport.totals.activeTruckCount}
                  </strong>
                  <span style={{ fontSize: "9.5px", color: "#9ca3af" }}>Dispatched fleet</span>
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "4px", padding: "8px 12px", background: "#f9fafb" }}>
                  <span style={{ display: "block", fontSize: "10px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Finance Records</span>
                  <strong style={{ display: "block", fontSize: "16px", fontWeight: 800, color: "#111827", marginTop: "1px" }}>
                    {companyFinanceSummary.totalCount}
                  </strong>
                  <span style={{ fontSize: "9.5px", color: "#9ca3af" }}>
                    {companyFinanceSummary.incomingCount} in · {companyFinanceSummary.outgoingCount} out
                  </span>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* 3. DETAILED RECORDS LEDGER                                                */}
            {/* ========================================================================= */}
            <section style={{ marginBottom: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #d1d5db", paddingBottom: "5px", marginBottom: "8px" }}>
                <h2 style={{ fontSize: "13px", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.04em", color: "#111827", margin: 0 }}>
                  3. {isDailyTripReport
                    ? `Daily Trip Manifest · ${formatShortDate(parseDateValue(dailyDate))}`
                    : activeTemplate.layout.sectionHeading}
                </h2>
                <span style={{ fontSize: "11px", color: "#6b7280" }}>
                  {sortedRows.length} {sortedRows.length === 1 ? "record" : "records"}
                  {activeTemplate.filters.financialState === "finalized_only" ? " (finalized only)" : ""}
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="doc-table">
                  <thead>
                    <tr>
                      {processedReport.columns.map((col) => (
                        <SortableTableHeader
                          key={col.id}
                          label={col.label}
                          sortKey={col.id}
                          activeSortKey={reportSort.key}
                          direction={reportSort.direction}
                          defaultDirection={col.dataType === "string" ? "asc" : "desc"}
                          onSort={changeReportSort}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const renderReportRow = (
                        row: (typeof sortedRows)[number],
                        rowIdx: number,
                        extraClass?: string
                      ) => (
                        <tr
                          key={
                            `${extraClass ? extraClass + "-" : ""}${(row.waybillNumber as string) ||
                            (row.clientName as string) ||
                            (row.plateNumber as string) ||
                            rowIdx}`
                          }
                          className={extraClass}
                        >
                          {processedReport.columns.map((col) => {
                            const rawVal = row[col.id];
                            if (col.dataType === "badge") {
                              return (
                                <td key={col.id} style={{ textAlign: col.align }}>
                                  <span
                                    style={{
                                      fontSize: "10.5px",
                                      fontWeight: 600,
                                      color: "#374151",
                                      padding: "1px 6px",
                                      borderRadius: "3px",
                                      background: "#f3f4f6",
                                      border: "1px solid #d1d5db",
                                      display: "inline-block",
                                    }}
                                  >
                                    {String(rawVal ?? "—")}
                                  </span>
                                </td>
                              );
                            }

                            return (
                              <td key={col.id} style={{ textAlign: col.align }}>
                                {formatCellValue(rawVal, col.dataType)}
                              </td>
                            );
                          })}
                        </tr>
                      );

                      if (processedReport.rows.length === 0) {
                        return (
                          <tr>
                            <td colSpan={processedReport.columns.length} style={{ textAlign: "center", padding: "28px 12px", color: "#6b7280" }}>
                              <strong>No records found</strong>
                              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#9ca3af" }}>
                                {isDailyTripReport
                                  ? `No delivery trips recorded on ${formatShortDate(parseDateValue(dailyDate))}.`
                                  : "No records found within the selected date range or template filters."}
                              </p>
                            </td>
                          </tr>
                        );
                      }

                      if (sortedRows.length > paginatedRows.length) {
                        return (
                          <>
                            {paginatedRows.map((row, rowIdx) =>
                              renderReportRow(row, rowIdx, "report-screen-only-row")
                            )}
                            {sortedRows.map((row, rowIdx) =>
                              renderReportRow(row, rowIdx, "report-print-only-row")
                            )}
                          </>
                        );
                      }

                      return paginatedRows.map((row, rowIdx) =>
                        renderReportRow(row, rowIdx)
                      );
                    })()}
                  </tbody>
                  {sortedRows.length > 0 && (
                    <tfoot>
                      <tr>
                        {processedReport.columns.map((col, idx) => {
                          if (idx === 0) {
                            return (
                              <td key={col.id} style={{ textAlign: "left", fontWeight: 750 }}>
                                Total ({sortedRows.length} items)
                              </td>
                            );
                          }
                          if (col.dataType === "currency" || col.dataType === "number") {
                            const sum = columnTotals[col.id];
                            return (
                              <td key={col.id} style={{ textAlign: col.align, fontWeight: 750 }}>
                                {sum != null ? formatCellValue(sum, col.dataType) : "—"}
                              </td>
                            );
                          }
                          if (col.id === "margin") {
                            return (
                              <td key={col.id} style={{ textAlign: col.align, fontWeight: 750 }}>
                                {processedReport.totals.marginPercent != null
                                  ? formatPercent(processedReport.totals.marginPercent)
                                  : "—"}
                              </td>
                            );
                          }
                          return <td key={col.id} style={{ textAlign: col.align }}>—</td>;
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {processedReport.rows.length > 0 ? (
                <div className="no-print">
                  <TablePagination
                    page={reportPage}
                    pageCount={reportPageCount}
                    totalItems={sortedRows.length}
                    pageSize={REPORT_PAGE_SIZE}
                    onPageChange={setReportPage}
                    itemLabel={activeTemplate.baseType === "trip_ledger" ? "trips" : "records"}
                    itemCountInPage={paginatedRows.length}
                  />
                </div>
              ) : null}
            </section>

            {/* ========================================================================= */}
            {/* 4. DOCUMENT CERTIFICATION & SIGNATURES                                    */}
            {/* ========================================================================= */}
            <section className="doc-signatures-section" style={{ marginTop: "36px", paddingTop: "20px", borderTop: "1px solid #e5e7eb" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
                <div>
                  <span style={{ display: "block", fontSize: "10.5px", fontWeight: 700, color: "#6b7280", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "28px" }}>
                    Prepared By:
                  </span>
                  <div style={{ borderBottom: "1px solid #111827", width: "85%", marginBottom: "4px" }} />
                  <strong style={{ display: "block", fontSize: "12px", color: "#111827" }}>
                    {actor.fullName || actor.username}
                  </strong>
                  <span style={{ fontSize: "11px", color: "#6b7280" }}>
                    {actor.roleLabel} · Redeemed Route Logistics Inc.
                  </span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "10.5px", fontWeight: 700, color: "#6b7280", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "28px" }}>
                    Verified &amp; Certified By:
                  </span>
                  <div style={{ borderBottom: "1px solid #111827", width: "85%", marginBottom: "4px" }} />
                  <strong style={{ display: "block", fontSize: "12px", color: "#111827" }}>
                    Executive Operations &amp; Corporate Finance
                  </strong>
                  <span style={{ fontSize: "11px", color: "#6b7280" }}>
                    Redeemed Route Logistics Inc.
                  </span>
                </div>
              </div>
            </section>

            {/* Document Sheet Footer */}
            <footer style={{ marginTop: "28px", paddingTop: "10px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#9ca3af" }}>
              <span>RouteX Enterprise Logistics System · Official Document</span>
              <span>CONFIDENTIAL — REDEEMED ROUTE LOGISTICS INC.</span>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
}
