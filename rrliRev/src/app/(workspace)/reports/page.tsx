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
import { useSearchBuffer } from "@/components/search-buffer";
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
  DEFAULT_PROFITABILITY_TEMPLATE,
  DEFAULT_REVENUE_TEMPLATE,
  type ColumnConfig,
  type ReportTemplate,
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

  const [activeTemplateId, setActiveTemplateId] = useState<string>("default-profitability");
  const [dailyDate, setDailyDate] = useState<string>(() => {
    return toDateKey(new Date());
  });

  const PRIMARY_REPORT_TABS = [
    { id: "default-profitability", label: "Profitability" },
    { id: "default-revenue", label: "Client Summary" },
    { id: "default-trip-ledger", label: "Trip Ledger" },
  ] as const;

  const activePrimaryTab = useMemo(() => {
    if (activeTemplateId === "default-expenses" || activeTemplateId === "default-profitability") {
      return "default-profitability";
    }
    if (activeTemplateId === "default-revenue" || activeTemplateId === "default-activity") {
      return "default-revenue";
    }
    if (activeTemplateId === "default-trip-ledger" || activeTemplateId === "default-daily-trip") {
      return "default-trip-ledger";
    }
    return "default-profitability";
  }, [activeTemplateId]);

  // Find active template from standard built-in formats
  const activeTemplate = useMemo<ReportTemplate>(() => {
    const tpl: ReportTemplate =
      BUILTIN_REPORT_TEMPLATES.find((t) => t.id === activeTemplateId) ||
      DEFAULT_PROFITABILITY_TEMPLATE;
    if (tpl.id === "default-revenue") {
      return {
        ...tpl,
        layout: {
          ...tpl.layout,
          title: "Client Summary Report",
          sectionHeading: "Client Volume & Revenue Summary",
        },
      };
    }
    return tpl;
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
          profitability: "default-profitability",
          profit: "default-profitability",
          truck: "default-profitability",
          "truck-profitability": "default-profitability",
          expenses: "default-profitability",
          expense: "default-profitability",
          revenue: "default-revenue",
          clients: "default-revenue",
          client: "default-revenue",
          "client-summary": "default-revenue",
          activity: "default-revenue",
          "trip-ledger": "default-trip-ledger",
          ledger: "default-trip-ledger",
          daily: "default-daily-trip",
          "daily-trip": "default-daily-trip",
          "daily-trips": "default-daily-trip",
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
    const visibleCols = activeTemplate.columns.filter((c: ColumnConfig) => c.visible);
    if (visibleCols.length > 0) {
      const preferred =
        visibleCols.find((c: ColumnConfig) => ["revenue", "expenses", "netProfit", "deliveries", "netIncome"].includes(c.id)) ||
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

  const {
    value: reportSearchQuery,
    setValue: setReportSearchQuery,
    bufferedQuery: debouncedReportSearch,
    isBuffering: isReportSearchBuffering,
    clear: clearReportSearch,
  } = useSearchBuffer({ delay: 500 });

  const filteredReportRows = useMemo(() => {
    const q = debouncedReportSearch.trim().toLowerCase();
    if (!q) return processedReport.rows;
    return processedReport.rows.filter((row) =>
      Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      )
    );
  }, [processedReport.rows, debouncedReportSearch]);

  // Sort rows for presentation
  const sortedRows = useMemo(() => {
    if (!reportSort.key) return filteredReportRows;
    const mult = reportSort.direction === "asc" ? 1 : -1;
    return [...filteredReportRows].sort((a, b) => {
      const valA = a[reportSort.key];
      const valB = b[reportSort.key];
      if (typeof valA === "number" && typeof valB === "number") {
        return (valA - valB) * mult;
      }
      return String(valA ?? "").localeCompare(String(valB ?? "")) * mult;
    });
  }, [filteredReportRows, reportSort.key, reportSort.direction]);

  const [reportPage, setReportPage] = useState(1);
  const REPORT_PAGE_SIZE = 10;
  const reportPageCount = Math.max(1, Math.ceil(sortedRows.length / REPORT_PAGE_SIZE));

  useEffect(() => {
    setReportPage(1);
  }, [activeTemplate.id, effectiveRange, reportSort, debouncedReportSearch]);

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
          <div className="report-tabs-bar no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div className="report-tabs" role="tablist" aria-label="Standard report formats">
                {PRIMARY_REPORT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activePrimaryTab === tab.id}
                    className={activePrimaryTab === tab.id ? "active" : undefined}
                    onClick={() => setActiveTemplateId(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* In Trip Ledger: compact mode toggle between Date Range and Single Day */}
              {activePrimaryTab === "default-trip-ledger" && (
                <div
                  className="trip-ledger-mode-tabs"
                  role="group"
                  aria-label="Trip ledger view mode"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                    background: "color-mix(in srgb, var(--color-border) 45%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-border) 55%, transparent)",
                    padding: "2px",
                    borderRadius: "999px",
                  }}
                >
                  <button
                    type="button"
                    style={{
                      padding: "2px 10px",
                      borderRadius: "999px",
                      border: "none",
                      background: !isDailyTripReport ? "var(--color-surface, #ffffff)" : "transparent",
                      color: !isDailyTripReport ? "var(--color-accent-deep, #8b3a0b)" : "var(--color-text-secondary)",
                      fontWeight: !isDailyTripReport ? 700 : 600,
                      fontSize: "11px",
                      boxShadow: !isDailyTripReport ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => setActiveTemplateId("default-trip-ledger")}
                  >
                    Date Range
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "2px 10px",
                      borderRadius: "999px",
                      border: "none",
                      background: isDailyTripReport ? "var(--color-surface, #ffffff)" : "transparent",
                      color: isDailyTripReport ? "var(--color-accent-deep, #8b3a0b)" : "var(--color-text-secondary)",
                      fontWeight: isDailyTripReport ? 700 : 600,
                      fontSize: "11px",
                      boxShadow: isDailyTripReport ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => setActiveTemplateId("default-daily-trip")}
                  >
                    Single Day
                  </button>
                </div>
              )}
            </div>

            <div className="report-tabs-bar-controls">
              {!isDailyTripReport ? (
                <GlobalDateRangePicker />
              ) : (
                <div className="daily-trip-date-controls" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
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
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", fontSize: "11.5px" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span>Prev</span>
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
                    style={{ padding: "3px 6px", fontSize: "11.5px", height: "30px" }}
                  />
                  <button
                    type="button"
                    className="daily-nav-btn"
                    onClick={() => setDailyDate((prev) => toDateKey(addDays(parseDateValue(prev), 1)))}
                    aria-label="Next day"
                    title="Next day"
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", fontSize: "11.5px" }}
                  >
                    <span>Next</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="daily-today-btn"
                    onClick={() => setDailyDate(toDateKey(new Date()))}
                    style={{ padding: "4px 8px", fontSize: "11.5px" }}
                  >
                    Today
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COMPACT CLEAN DOCUMENT SHEET                                              */}
          {/* ========================================================================= */}
          <article className="report-document doc-sheet" aria-label="Formatted operational report">
            {/* Document Letterhead */}
            <header className="doc-header-border" style={{ paddingBottom: "10px", marginBottom: "14px", borderBottom: "2px solid #111827" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: "10px", fontWeight: 750, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280" }}>
                    REDEEMED ROUTE LOGISTICS INC.
                  </span>
                  <h1 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>
                    {activeTemplate.layout.title}
                  </h1>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#4b5563" }}>
                    {isDailyTripReport
                      ? `Daily operational trip manifest for ${formatShortDate(parseDateValue(dailyDate))}.`
                      : (activeTemplate.layout.subtitle || "Consolidated operations and corporate financial statement.")}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ display: "inline-block", fontSize: "9.5px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", textTransform: "uppercase" }}>
                    Official Report
                  </span>
                </div>
              </div>

              {/* Compact Inline Metadata Strip */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "8px", padding: "4px 8px", background: "#f9fafb", borderRadius: "4px", border: "1px solid #f3f4f6", fontSize: "10.5px", color: "#4b5563", flexWrap: "wrap" }}>
                <span><strong>Period:</strong> {isDailyTripReport ? `${formatShortDate(parseDateValue(dailyDate))} (Daily)` : formatDateRange(effectiveRange)}</span>
                <span>·</span>
                <span><strong>Generated:</strong> {generatedDateString}</span>
                <span>·</span>
                <span><strong>Prepared by:</strong> {actor.fullName || actor.username} ({actor.roleLabel})</span>
                <span>·</span>
                <span><strong>Scope:</strong> Consolidated Operations &amp; Ledger</span>
              </div>
            </header>

            {/* ========================================================================= */}
            {/* 1. FINANCIAL STATEMENT (Compact Consolidated Summary)                      */}
            {/* ========================================================================= */}
            <section style={{ marginBottom: "16px" }}>
              <h2 style={{ fontSize: "11.5px", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.04em", color: "#111827", margin: "0 0 6px 0", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                1. Consolidated Financial Statement &amp; Profitability
              </h2>
              <table className="doc-table" style={{ fontSize: "11px", marginBottom: "4px" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", width: "42%", padding: "5px 8px" }}>Account / Financial Stream</th>
                    <th style={{ textAlign: "right", width: "19%", padding: "5px 8px" }}>Delivery Operations</th>
                    <th style={{ textAlign: "right", width: "19%", padding: "5px 8px" }}>Company Ledger</th>
                    <th style={{ textAlign: "right", width: "20%", padding: "5px 8px" }}>Consolidated Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 650, padding: "5px 8px" }}>Gross Inflow / Revenue</td>
                    <td style={{ textAlign: "right", padding: "5px 8px" }}>{formatPeso(processedReport.totals.grossEarnings)}</td>
                    <td style={{ textAlign: "right", padding: "5px 8px" }}>{formatPeso(companyFinanceSummary.incoming)}</td>
                    <td style={{ textAlign: "right", fontWeight: 750, color: "#059669", padding: "5px 8px" }}>
                      {formatPeso(totalInflow)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 650, padding: "5px 8px" }}>
                      <div>Operating Outflow / Expenses</div>
                      <div style={{ fontSize: "9.5px", color: "#6b7280", fontWeight: 400, marginTop: "1px" }}>
                        Fuel: {formatPeso(processedReport.totals.totalDieselExpenses)} · Tolls: {formatPeso(processedReport.totals.totalTollExpenses)} · Crew: {formatPeso(processedReport.totals.totalCrewCosts)} · Corp: {formatPeso(companyFinanceSummary.outgoing)}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", padding: "5px 8px" }}>{formatPeso(processedReport.totals.totalExpenses)}</td>
                    <td style={{ textAlign: "right", padding: "5px 8px" }}>{formatPeso(companyFinanceSummary.outgoing)}</td>
                    <td style={{ textAlign: "right", fontWeight: 750, color: "#dc2626", padding: "5px 8px" }}>
                      {formatPeso(totalOutflow)}
                    </td>
                  </tr>
                  <tr style={{ borderTop: "1.5px solid #111827", background: "#f9fafb" }}>
                    <td style={{ fontWeight: 800, color: "#111827", padding: "5px 8px" }}>
                      Net Profit / Operating Balance (=)
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: processedReport.totals.netProfit >= 0 ? "#059669" : "#dc2626", padding: "5px 8px" }}>
                      {formatPeso(processedReport.totals.netProfit)}
                      <span style={{ fontSize: "9.5px", color: "#6b7280", marginLeft: "4px" }}>
                        ({processedReport.totals.marginPercent !== null ? formatPercent(processedReport.totals.marginPercent) : "—"})
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: companyFinanceSummary.net >= 0 ? "#059669" : "#dc2626", padding: "5px 8px" }}>
                      {formatPeso(companyFinanceSummary.net)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800, fontSize: "12px", color: consolidatedNetProfit >= 0 ? "#059669" : "#dc2626", padding: "5px 8px" }}>
                      {formatPeso(consolidatedNetProfit)}
                      <span style={{ fontSize: "10px", color: consolidatedNetProfit >= 0 ? "#059669" : "#dc2626", marginLeft: "5px" }}>
                        ({consolidatedMargin !== null ? formatPercent(consolidatedMargin) : "—"})
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* ========================================================================= */}
            {/* 2. OPERATIONAL VOLUME STATISTICS (Compact Strip)                          */}
            {/* ========================================================================= */}
            <section style={{ marginBottom: "16px" }}>
              <h2 style={{ fontSize: "11.5px", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.04em", color: "#111827", margin: "0 0 6px 0", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>
                2. Operational Volume Statistics
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" }}>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "4px", padding: "6px 10px", background: "#f9fafb" }}>
                  <span style={{ display: "block", fontSize: "9.5px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Completed Trips</span>
                  <strong style={{ display: "block", fontSize: "14px", fontWeight: 800, color: "#111827" }}>
                    {processedReport.totals.totalTrips}
                  </strong>
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "4px", padding: "6px 10px", background: "#f9fafb" }}>
                  <span style={{ display: "block", fontSize: "9.5px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Store Drop-offs</span>
                  <strong style={{ display: "block", fontSize: "14px", fontWeight: 800, color: "#111827" }}>
                    {processedReport.totals.totalStoreDropoffs}
                  </strong>
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "4px", padding: "6px 10px", background: "#f9fafb" }}>
                  <span style={{ display: "block", fontSize: "9.5px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Active Trucks</span>
                  <strong style={{ display: "block", fontSize: "14px", fontWeight: 800, color: "#111827" }}>
                    {processedReport.totals.activeTruckCount}
                  </strong>
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "4px", padding: "6px 10px", background: "#f9fafb" }}>
                  <span style={{ display: "block", fontSize: "9.5px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Finance Records</span>
                  <strong style={{ display: "block", fontSize: "14px", fontWeight: 800, color: "#111827" }}>
                    {companyFinanceSummary.totalCount}
                  </strong>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* 3. DETAILED RECORDS LEDGER (Compact & Clean)                              */}
            {/* ========================================================================= */}
            <section style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "6px", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <h2 style={{ fontSize: "11.5px", fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.04em", color: "#111827", margin: 0 }}>
                    3. {isDailyTripReport
                      ? `Daily Trip Manifest · ${formatShortDate(parseDateValue(dailyDate))}`
                      : activeTemplate.layout.sectionHeading}
                  </h2>
                  <span style={{ fontSize: "10.5px", color: "#6b7280" }}>
                    {sortedRows.length} {sortedRows.length === 1 ? "record" : "records"}
                    {activeTemplate.filters.financialState === "finalized_only" ? " (finalized only)" : ""}
                  </span>
                </div>
                <div className="no-print" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label className={`search-box${isReportSearchBuffering ? " is-buffering" : ""}`} style={{ maxWidth: "260px", minWidth: "180px", minHeight: "28px", height: "28px" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="search"
                      placeholder="Search records..."
                      value={reportSearchQuery}
                      onChange={(e) => setReportSearchQuery(e.target.value)}
                      aria-label="Search report records"
                      style={{ fontSize: "11px" }}
                    />
                    {reportSearchQuery ? (
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={clearReportSearch}
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    ) : null}
                  </label>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="doc-table" style={{ fontSize: "11px" }}>
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
                                <td key={col.id} style={{ textAlign: col.align, padding: "5px 8px" }}>
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 600,
                                      color: "#374151",
                                      padding: "1px 5px",
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
                              <td key={col.id} style={{ textAlign: col.align, padding: "5px 8px" }}>
                                {formatCellValue(rawVal, col.dataType)}
                              </td>
                            );
                          })}
                        </tr>
                      );

                      if (sortedRows.length === 0) {
                        return (
                          <tr>
                            <td colSpan={processedReport.columns.length} style={{ textAlign: "center", padding: "20px 10px", color: "#6b7280" }}>
                              <strong>
                                {debouncedReportSearch.trim()
                                  ? `No report records match "${reportSearchQuery.trim()}"`
                                  : "No records found"}
                              </strong>
                              <p style={{ margin: "2px 0 0", fontSize: "10.5px", color: "#9ca3af" }}>
                                {debouncedReportSearch.trim()
                                  ? "Try searching for a different keyword or clear the search input."
                                  : isDailyTripReport
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
                              <td key={col.id} style={{ textAlign: "left", fontWeight: 750, padding: "5px 8px" }}>
                                Total ({sortedRows.length})
                              </td>
                            );
                          }
                          if (col.dataType === "currency" || col.dataType === "number") {
                            const sum = columnTotals[col.id];
                            return (
                              <td key={col.id} style={{ textAlign: col.align, fontWeight: 750, padding: "5px 8px" }}>
                                {sum != null ? formatCellValue(sum, col.dataType) : "—"}
                              </td>
                            );
                          }
                          if (col.id === "margin") {
                            return (
                              <td key={col.id} style={{ textAlign: col.align, fontWeight: 750, padding: "5px 8px" }}>
                                {processedReport.totals.marginPercent != null
                                  ? formatPercent(processedReport.totals.marginPercent)
                                  : "—"}
                              </td>
                            );
                          }
                          return <td key={col.id} style={{ textAlign: col.align, padding: "5px 8px" }}>—</td>;
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {processedReport.rows.length > 0 ? (
                <div className="no-print" style={{ marginTop: "10px" }}>
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
            {/* 4. DOCUMENT CERTIFICATION & SIGNATURES (Compact)                          */}
            {/* ========================================================================= */}
            <section className="doc-signatures-section" style={{ marginTop: "18px", paddingTop: "12px", borderTop: "1px solid #e5e7eb" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px" }}>
                <div>
                  <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#6b7280", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "16px" }}>
                    Prepared By:
                  </span>
                  <div style={{ borderBottom: "1px solid #111827", width: "80%", marginBottom: "3px" }} />
                  <strong style={{ display: "block", fontSize: "11.5px", color: "#111827" }}>
                    {actor.fullName || actor.username}
                  </strong>
                  <span style={{ fontSize: "10.5px", color: "#6b7280" }}>
                    {actor.roleLabel} · Redeemed Route Logistics Inc.
                  </span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#6b7280", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "16px" }}>
                    Verified &amp; Certified By:
                  </span>
                  <div style={{ borderBottom: "1px solid #111827", width: "80%", marginBottom: "3px" }} />
                  <strong style={{ display: "block", fontSize: "11.5px", color: "#111827" }}>
                    Executive Operations &amp; Corporate Finance
                  </strong>
                  <span style={{ fontSize: "10.5px", color: "#6b7280" }}>
                    Redeemed Route Logistics Inc.
                  </span>
                </div>
              </div>
            </section>

            {/* Document Sheet Footer */}
            <footer style={{ marginTop: "16px", paddingTop: "8px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", fontSize: "9.5px", color: "#9ca3af" }}>
              <span>RouteX Enterprise Logistics System · Official Document</span>
              <span>CONFIDENTIAL — REDEEMED ROUTE LOGISTICS INC.</span>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
}
