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
import {
  ExpenseDonutPieChart,
  type ExpenseCategorySlice,
} from "@/components/delivery-financial-breakdown";
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
import { ReportsDataExportTab } from "@/components/reports-data-export-tab";
import {
  canAccessDataExportTab,
  readExportRequests,
  ROUTEX_EXPORT_REQUESTS_CHANGED,
} from "@/features/reports/data-export-engine";
import { canExportReports } from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";

const ALL_TIME_RANGE: DateRange = { startDate: null, endDate: null };

export default function ReportsPage() {
  const actor = useAuthenticatedActor();
  const { range } = useGlobalDateRange();

  const [activeTemplateId, setActiveTemplateId] = useState<string>("default-revenue");
  const isDataExportTab = activeTemplateId === "data-export";

  // Daily trip report fixed-date state (defaults to today's date YYYY-MM-DD)
  const [dailyDate, setDailyDate] = useState<string>(() => toDateKey(new Date()));

  // Find active template from standard built-in formats
  const activeTemplate = useMemo(() => {
    return (
      BUILTIN_REPORT_TEMPLATES.find((t) => t.id === activeTemplateId) ||
      DEFAULT_REVENUE_TEMPLATE
    );
  }, [activeTemplateId]);

  const isDailyTripReport = !isDataExportTab && activeTemplate.id === "default-daily-trip";

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
  const { deliveries: allDeliveries } = usePersistedDeliveries(ALL_TIME_RANGE);
  const [pendingExportRequestsCount, setPendingExportRequestsCount] = useState(0);

  useEffect(() => {
    const syncPending = () => {
      const reqs = readExportRequests();
      setPendingExportRequestsCount(reqs.filter((r) => r.status === "pending").length);
    };
    syncPending();
    window.addEventListener(ROUTEX_EXPORT_REQUESTS_CHANGED, syncPending);
    window.addEventListener("storage", syncPending);
    return () => {
      window.removeEventListener(ROUTEX_EXPORT_REQUESTS_CHANGED, syncPending);
      window.removeEventListener("storage", syncPending);
    };
  }, []);

  // Table sorting
  const [reportSort, setReportSort] = useState<{ key: string; direction: TableSortDirection }>({
    key: "revenue",
    direction: "desc",
  });

  // Company expenses state for overall profitability reporting
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

  const companyExpensesTotal = useMemo(() => {
    return filteredCompanyExpenses.reduce((sum, item) => sum + item.amount, 0);
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
      // Prefer financial, count, or first column
      const preferred =
        visibleCols.find((c) => ["revenue", "expenses", "netProfit", "deliveries", "netIncome"].includes(c.id)) ||
        visibleCols[0];
      setReportSort({
        key: preferred.id,
        direction: preferred.id === "clientName" || preferred.id === "plateNumber" ? "asc" : "desc",
      });
    }
  }, [activeTemplate.id, activeTemplate.columns]);

  // Process report rows and metrics using the reporting engine
  const processedReport = useMemo(() => {
    const isTruckReport = activeTemplate.baseType === "truck_summary";
    const expTotal = isTruckReport ? 0 : companyExpensesTotal;
    return processReport(filteredDeliveries, activeTemplate, expTotal);
  }, [filteredDeliveries, activeTemplate, companyExpensesTotal]);

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

  // 1. Expense Distribution Slices (Cost Categories)
  const expenseBreakdown = useMemo(() => {
    const totals = processedReport.totals;
    const totalExp = totals.totalExpenses + (totals.totalCompanyExpenses ?? 0);
    if (totalExp <= 0) return { slices: [] as ExpenseCategorySlice[], total: 0 };

    const otherAndEntry = Math.max(
      0,
      totals.totalExpenses -
        (totals.totalDieselExpenses + totals.totalTollExpenses + totals.totalCrewCosts),
    );

    const slices: ExpenseCategorySlice[] = [];

    if (totals.totalDieselExpenses > 0) {
      slices.push({
        id: "diesel",
        label: "Diesel Fuel",
        amount: totals.totalDieselExpenses,
        color: "#f59e0b",
        status: "confirmed",
      });
    }

    if (totals.totalTollExpenses > 0) {
      slices.push({
        id: "toll",
        label: "Highway Tolls",
        amount: totals.totalTollExpenses,
        color: "#6366f1",
        status: "confirmed",
      });
    }

    if (totals.totalCrewCosts > 0) {
      slices.push({
        id: "crew",
        label: "Crew Compensation",
        amount: totals.totalCrewCosts,
        color: "#0284c7",
        status: "confirmed",
      });
    }

    if (otherAndEntry > 0) {
      slices.push({
        id: "entry_other",
        label: "Store Entry & Other",
        amount: otherAndEntry,
        color: "#10b981",
        status: "confirmed",
      });
    }

    if ((totals.totalCompanyExpenses ?? 0) > 0) {
      slices.push({
        id: "company_exp",
        label: "Company Expenses",
        amount: totals.totalCompanyExpenses ?? 0,
        color: "#ec4899",
        status: "confirmed",
      });
    }

    return { slices, total: totalExp };
  }, [processedReport.totals]);

  // 2. Contextual Contribution Slices (Revenue / Drops / Allocation)
  const contextualContribution = useMemo(() => {
    const totals = processedReport.totals;
    const baseType = activeTemplate.baseType;
    const rows = processedReport.rows;
    const isActivity = activeTemplate.id === "default-activity";

    const PALETTE = [
      "#f59e0b",
      "#3b82f6",
      "#10b981",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
      "#f97316",
      "#64748b",
    ];

    if (isActivity) {
      const totalDrops = totals.totalStoreDropoffs;
      if (totalDrops <= 0) {
        return {
          title: "Store Drop-offs by Client",
          eyebrow: "CLIENT DROP-OFFS",
          slices: [] as ExpenseCategorySlice[],
          total: 0,
          centerLabel: "Drop-offs",
          valueFormatter: (n: number) => `${n.toLocaleString()} drop-offs`,
        };
      }

      const clientRows = [...rows]
        .map((r) => ({
          name: String(r.clientName ?? "Unknown Client"),
          count: typeof r.dropoffs === "number" ? r.dropoffs : 0,
        }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count);

      const TOP_COUNT = 5;
      const topClients = clientRows.slice(0, TOP_COUNT);
      const otherClients = clientRows.slice(TOP_COUNT);

      const slices: ExpenseCategorySlice[] = topClients.map((c, i) => ({
        id: `client-drop-${i}`,
        label: c.name,
        amount: c.count,
        color: PALETTE[i % PALETTE.length],
        status: "confirmed",
      }));

      const otherTotal = otherClients.reduce((sum, c) => sum + c.count, 0);
      if (otherTotal > 0) {
        slices.push({
          id: "client-drop-other",
          label: `Other Clients (${otherClients.length})`,
          amount: otherTotal,
          color: PALETTE[TOP_COUNT % PALETTE.length],
          status: "confirmed",
        });
      }

      return {
        title: "Store Drop-offs by Client",
        eyebrow: "CLIENT DROP-OFFS",
        slices,
        total: totalDrops,
        centerLabel: "Drop-offs",
        valueFormatter: (n: number) => `${n.toLocaleString()} drop-offs`,
      };
    }

    if (baseType === "client_summary") {
      const totalRevenue = totals.grossEarnings;
      if (totalRevenue <= 0) {
        return {
          title: "Revenue by Client",
          eyebrow: "CLIENT ATTRIBUTION",
          slices: [] as ExpenseCategorySlice[],
          total: 0,
          centerLabel: "Revenue",
          valueFormatter: formatPeso,
        };
      }

      const clientRows = [...rows]
        .map((r) => ({
          name: String(r.clientName ?? "Unknown Client"),
          revenue: typeof r.revenue === "number" ? r.revenue : 0,
        }))
        .filter((c) => c.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue);

      const TOP_COUNT = 5;
      const topClients = clientRows.slice(0, TOP_COUNT);
      const otherClients = clientRows.slice(TOP_COUNT);

      const slices: ExpenseCategorySlice[] = topClients.map((c, i) => ({
        id: `client-rev-${i}`,
        label: c.name,
        amount: c.revenue,
        color: PALETTE[i % PALETTE.length],
        status: "confirmed",
      }));

      const otherTotal = otherClients.reduce((sum, c) => sum + c.revenue, 0);
      if (otherTotal > 0) {
        slices.push({
          id: "client-rev-other",
          label: `Other Clients (${otherClients.length})`,
          amount: otherTotal,
          color: PALETTE[TOP_COUNT % PALETTE.length],
          status: "confirmed",
        });
      }

      return {
        title: "Revenue by Client",
        eyebrow: "CLIENT ATTRIBUTION",
        slices,
        total: totalRevenue,
        centerLabel: "Revenue",
        valueFormatter: formatPeso,
      };
    }

    if (baseType === "truck_summary") {
      const totalRevenue = totals.grossEarnings;
      if (totalRevenue > 0) {
        const truckRows = [...rows]
          .map((r) => ({
            name: String(r.plateNumber ?? "Unknown Plate"),
            revenue: typeof r.revenue === "number" ? r.revenue : 0,
          }))
          .filter((t) => t.revenue > 0)
          .sort((a, b) => b.revenue - a.revenue);

        const TOP_COUNT = 5;
        const topTrucks = truckRows.slice(0, TOP_COUNT);
        const otherTrucks = truckRows.slice(TOP_COUNT);

        const slices: ExpenseCategorySlice[] = topTrucks.map((t, i) => ({
          id: `truck-rev-${i}`,
          label: t.name,
          amount: t.revenue,
          color: PALETTE[i % PALETTE.length],
          status: "confirmed",
        }));

        const otherTotal = otherTrucks.reduce((sum, t) => sum + t.revenue, 0);
        if (otherTotal > 0) {
          slices.push({
            id: "truck-rev-other",
            label: `Other Trucks (${otherTrucks.length})`,
            amount: otherTotal,
            color: PALETTE[TOP_COUNT % PALETTE.length],
            status: "confirmed",
          });
        }

        return {
          title: "Revenue Contribution by Truck",
          eyebrow: "FLEET REVENUE",
          slices,
          total: totalRevenue,
          centerLabel: "Revenue",
          valueFormatter: formatPeso,
        };
      }

      const totalExpenses = totals.totalExpenses;
      if (totalExpenses > 0) {
        const truckRows = [...rows]
          .map((r) => ({
            name: String(r.plateNumber ?? "Unknown Plate"),
            expenses: typeof r.expenses === "number" ? r.expenses : 0,
          }))
          .filter((t) => t.expenses > 0)
          .sort((a, b) => b.expenses - a.expenses);

        const TOP_COUNT = 5;
        const topTrucks = truckRows.slice(0, TOP_COUNT);
        const otherTrucks = truckRows.slice(TOP_COUNT);

        const slices: ExpenseCategorySlice[] = topTrucks.map((t, i) => ({
          id: `truck-exp-${i}`,
          label: t.name,
          amount: t.expenses,
          color: PALETTE[i % PALETTE.length],
          status: "confirmed",
        }));

        const otherTotal = otherTrucks.reduce((sum, t) => sum + t.expenses, 0);
        if (otherTotal > 0) {
          slices.push({
            id: "truck-exp-other",
            label: `Other Trucks (${otherTrucks.length})`,
            amount: otherTotal,
            color: PALETTE[TOP_COUNT % PALETTE.length],
            status: "confirmed",
          });
        }

        return {
          title: "Expenses by Truck Plate",
          eyebrow: "FLEET EXPENSES",
          slices,
          total: totalExpenses,
          centerLabel: "Expenses",
          valueFormatter: formatPeso,
        };
      }

      return {
        title: "Fleet Performance",
        eyebrow: "FLEET PERFORMANCE",
        slices: [] as ExpenseCategorySlice[],
        total: 0,
        centerLabel: "Revenue",
        valueFormatter: formatPeso,
      };
    }

    // baseType === "trip_ledger" (or Daily Trips) -> Revenue Allocation
    const totalRev = totals.grossEarnings;
    if (totalRev <= 0) {
      return {
        title: "Revenue Allocation",
        eyebrow: "FINANCIAL ALLOCATION",
        slices: [] as ExpenseCategorySlice[],
        total: 0,
        centerLabel: "Revenue",
        valueFormatter: formatPeso,
      };
    }

    const slices: ExpenseCategorySlice[] = [];

    if (totals.netProfit > 0) {
      slices.push({
        id: "net_profit",
        label: "Net Profit",
        amount: totals.netProfit,
        color: "#10b981",
        status: "confirmed",
      });
    }

    if (totals.totalDieselExpenses > 0) {
      slices.push({
        id: "diesel",
        label: "Diesel Fuel",
        amount: totals.totalDieselExpenses,
        color: "#f59e0b",
        status: "confirmed",
      });
    }

    if (totals.totalTollExpenses > 0) {
      slices.push({
        id: "toll",
        label: "Highway Tolls",
        amount: totals.totalTollExpenses,
        color: "#6366f1",
        status: "confirmed",
      });
    }

    if (totals.totalCrewCosts > 0) {
      slices.push({
        id: "crew",
        label: "Crew Compensation",
        amount: totals.totalCrewCosts,
        color: "#0284c7",
        status: "confirmed",
      });
    }

    const otherAndEntry = Math.max(
      0,
      totals.totalExpenses -
        (totals.totalDieselExpenses + totals.totalTollExpenses + totals.totalCrewCosts),
    );
    if (otherAndEntry > 0) {
      slices.push({
        id: "other",
        label: "Store Entry & Other",
        amount: otherAndEntry,
        color: "#8b5cf6",
        status: "confirmed",
      });
    }

    if ((totals.totalCompanyExpenses ?? 0) > 0) {
      slices.push({
        id: "company",
        label: "Company Expenses",
        amount: totals.totalCompanyExpenses ?? 0,
        color: "#ec4899",
        status: "confirmed",
      });
    }

    return {
      title: "Revenue Allocation (Profit vs. Costs)",
      eyebrow: "FINANCIAL ALLOCATION",
      slices,
      total: totalRev,
      centerLabel: "Revenue",
      valueFormatter: formatPeso,
    };
  }, [processedReport.totals, activeTemplate.baseType, activeTemplate.id, processedReport.rows]);

  function changeReportSort(key: string, direction: TableSortDirection) {
    setReportSort({ key, direction });
  }

  return (
    <>
      <OperationalTopbar
        contextLabel="Delivery Operations & Truck Reports"
        showDateFilter={false}
      />

      <div className="content-wrap report-page">
        <header className="page-intro report-intro">
          <div>
            <h1>Reports</h1>
            <p className="subtitle">
              Print and export delivery reports.
            </p>
          </div>
          <div className="report-actions">
            {!isDataExportTab && canExportReports(actor.role) && (
              <button
                type="button"
                className="page-intro-action report-export-action"
                aria-label="Export report to Excel CSV"
                onClick={() =>
                  downloadReportCsvFile(
                    processedReport,
                    formatDateRange(effectiveRange),
                  )
                }
              >
                <span aria-hidden="true">↓</span> Export CSV
              </button>
              <>
                <button
                  type="button"
                  className="page-intro-action report-export-action"
                  aria-label="Export report to Excel (.xlsx)"
                  onClick={() =>
                    downloadReportXlsxFile(
                      processedReport,
                      formatDateRange(effectiveRange),
                    )
                  }
                >
                  <span aria-hidden="true">↓</span> Export Excel (.xlsx)
                </button>
                <button
                  type="button"
                  className="page-intro-action report-export-action"
                  aria-label="Export report to Excel CSV"
                  onClick={() =>
                    downloadReportCsvFile(
                      processedReport,
                      formatDateRange(effectiveRange),
                    )
                  }
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
              <span>Loading completed deliveries for the selected period.</span>
            </div>
          </section>
        ) : null}

        <div className={`report-workspace${loading ? " is-loading" : ""}`}>
          {/* Report Format Selection Tabs */}
          <div className="report-tabs-bar">
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
              {canAccessDataExportTab(actor.role) && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isDataExportTab}
                  className={isDataExportTab ? "active" : undefined}
                  onClick={() => setActiveTemplateId("data-export")}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <span>Export Data</span>
                  {actor.role === "admin" && pendingExportRequestsCount > 0 ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: "18px",
                        height: "18px",
                        padding: "0 5px",
                        borderRadius: "999px",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        background: "var(--color-accent, #b45309)",
                        color: "#ffffff",
                      }}
                    >
                      {pendingExportRequestsCount}
                    </span>
                  ) : null}
                </button>
              )}
            </div>

            <div className="report-tabs-bar-controls">
              <GlobalDateRangePicker />
            </div>
          </div>

          {isDataExportTab ? (
            <ReportsDataExportTab
              actor={actor}
              allDeliveries={allDeliveries}
              allCompanyExpenses={companyExpenses}
              dateFrom={range.startDate ? toDateKey(range.startDate) : null}
              dateTo={range.endDate ? toDateKey(range.endDate) : null}
              periodLabel={formatDateRange(range)}
            />
          ) : (
            <>
          {/* Daily Trip Fixed-Day Date Navigation Controls */}
          {isDailyTripReport && (
            <div className="daily-trip-date-bar">
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

          <article className="report-document" aria-label="Formatted operational report">
            <header className="report-document-header">
              <div>
                <p>{activeTemplate.layout.documentTitle || "REDEEMED ROUTE LOGISTICS INC. · ROUTEX"}</p>
                <h2>{activeTemplate.layout.title}</h2>
                <span>Prepared for {actor.fullName}</span>
                {isDailyTripReport ? (
                  <p style={{ marginTop: "4px", fontSize: "11px", color: "var(--color-text-muted)" }}>
                    Daily trip log for {formatShortDate(parseDateValue(dailyDate))}.
                  </p>
                ) : activeTemplate.layout.subtitle ? (
                  <p style={{ marginTop: "4px", fontSize: "11px", color: "var(--color-text-muted)" }}>
                    {activeTemplate.layout.subtitle}
                  </p>
                ) : null}
              </div>
              <dl>
                <div>
                  <dt>Period</dt>
                  <dd>
                    {isDailyTripReport
                      ? `${formatShortDate(parseDateValue(dailyDate))} (Daily)`
                      : formatDateRange(range)}
                  </dd>
                </div>
                <div>
                  <dt>Trips</dt>
                  <dd>{processedReport.totals.totalTrips}</dd>
                </div>
                <div>
                  <dt>Drop-offs</dt>
                  <dd>{processedReport.totals.totalStoreDropoffs}</dd>
                </div>
                <div>
                  <dt>Layout</dt>
                  <dd>{activeTemplate.isDefault ? "Default" : "Custom"}</dd>
                </div>
              </dl>
            </header>

            {/* Dynamic Summary Cards Based on Configured Financial Breakdowns */}
            <section className="report-summary">
              {activeTemplate.breakdown.showGrossEarnings && (
                <div>
                  <span>Revenue</span>
                  <strong>{formatPeso(processedReport.totals.grossEarnings)}</strong>
                </div>
              )}
              {activeTemplate.breakdown.showTotalExpenses && (
                <div>
                  <span>Expenses</span>
                  <strong>{formatPeso(processedReport.totals.totalExpenses)}</strong>
                </div>
              )}
              {activeTemplate.breakdown.showNetProfit && (
                <div>
                  <span>Net Profit</span>
                  <strong>{formatPeso(processedReport.totals.netProfit)}</strong>
                </div>
              )}
              {activeTemplate.breakdown.showProfitMargin && (
                <div>
                  <span>Profit Margin</span>
                  <strong>{formatPercent(processedReport.totals.marginPercent)}</strong>
                </div>
              )}
              {activeTemplate.breakdown.showActiveTrucks && (
                <div>
                  <span>Active Trucks</span>
                  <strong>{processedReport.totals.activeTruckCount}</strong>
                </div>
              )}
              {activeTemplate.breakdown.showStoreDropoffs && (
                <div>
                  <span>Store Drop-offs</span>
                  <strong>{processedReport.totals.totalStoreDropoffs}</strong>
                </div>
              )}
              {activeTemplate.breakdown.showDieselExpenses && (
                <div>
                  <span>Diesel Fuel</span>
                  <strong>{formatPeso(processedReport.totals.totalDieselExpenses)}</strong>
                </div>
              )}
              {activeTemplate.breakdown.showTollExpenses && (
                <div>
                  <span>Highway Tolls</span>
                  <strong>{formatPeso(processedReport.totals.totalTollExpenses)}</strong>
                </div>
              )}
              {activeTemplate.breakdown.showCrewCosts && (
                <div>
                  <span>Crew Compensation</span>
                  <strong>{formatPeso(processedReport.totals.totalCrewCosts)}</strong>
                </div>
              )}
              {activeTemplate.baseType !== "truck_summary" && (processedReport.totals.totalCompanyExpenses ?? 0) > 0 && (
                <>
                  <div>
                    <span>Company Expenses</span>
                    <strong>{formatPeso(processedReport.totals.totalCompanyExpenses ?? 0)}</strong>
                  </div>
                  <div>
                    <span>Company Net Profit</span>
                    <strong style={{ color: (processedReport.totals.companyNetProfit ?? 0) >= 0 ? "var(--color-profit, #059669)" : "var(--color-danger, #dc2626)" }}>
                      {formatPeso(processedReport.totals.companyNetProfit ?? 0)}
                    </strong>
                  </div>
                </>
              )}
            </section>

            {/* Visual Breakdown Charts (Donut Pie Charts like Breakdown) */}
            {processedReport.totals.totalTrips > 0 &&
              (expenseBreakdown.slices.length > 0 ||
                contextualContribution.slices.length > 0) && (
                <section
                  className="report-breakdown-section"
                  aria-label="Visual breakdown charts"
                >
                  <div className="report-breakdown-grid">
                    {expenseBreakdown.slices.length > 0 && (
                      <div className="report-breakdown-card">
                        <div className="report-breakdown-card-header">
                          <div>
                            <span className="report-breakdown-eyebrow">
                              OPERATIONAL EXPENSES
                            </span>
                            <h4>Expense Category Distribution</h4>
                          </div>
                          <span className="report-chart-badge">
                            {formatPeso(expenseBreakdown.total)}
                          </span>
                        </div>
                        <ExpenseDonutPieChart
                          slices={expenseBreakdown.slices}
                          totalExpenses={expenseBreakdown.total}
                          isComplete={true}
                          title="Report Expense Distribution"
                          centerLabel="Fleet Expenses"
                          valueFormatter={formatPeso}
                          size="standard"
                        />
                      </div>
                    )}

                    {contextualContribution.slices.length > 0 && (
                      <div className="report-breakdown-card">
                        <div className="report-breakdown-card-header">
                          <div>
                            <span className="report-breakdown-eyebrow">
                              {contextualContribution.eyebrow}
                            </span>
                            <h4>{contextualContribution.title}</h4>
                          </div>
                          <span className="report-chart-badge">
                            {contextualContribution.valueFormatter(
                              contextualContribution.total,
                            )}
                          </span>
                        </div>
                        <ExpenseDonutPieChart
                          slices={contextualContribution.slices}
                          totalExpenses={contextualContribution.total}
                          isComplete={true}
                          title={contextualContribution.title}
                          centerLabel={contextualContribution.centerLabel}
                          valueFormatter={contextualContribution.valueFormatter}
                          size="standard"
                        />
                      </div>
                    )}
                  </div>
                </section>
              )}

            <section className="report-table-section">
              <div className="report-table-heading">
                <div>
                  <h3>
                    {isDailyTripReport
                      ? `Trip Records · ${formatShortDate(parseDateValue(dailyDate))}`
                      : activeTemplate.layout.sectionHeading}
                  </h3>
                  <p>
                    {processedReport.rows.length}{" "}
                    {activeTemplate.baseType === "trip_ledger"
                      ? processedReport.rows.length === 1
                        ? "trip"
                        : "trips"
                      : processedReport.rows.length === 1
                        ? "record"
                        : "records"}
                  </p>
                </div>
                {activeTemplate.filters.financialState === "finalized_only" && (
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      backgroundColor: "var(--color-surface-soft)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Finalized only
                  </span>
                )}
              </div>

              <div className="report-table-scroll">
                <table>
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
                              const isPositive =
                                rawVal === "Finalized" || rawVal === "Complete";
                              return (
                                <td key={col.id} style={{ textAlign: col.align }}>
                                  <span
                                    className={`report-status-badge ${isPositive ? "status-positive" : "status-neutral"}`}
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      color: isPositive ? "#059669" : "var(--color-text-muted)",
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
                            <td colSpan={processedReport.columns.length} className="table-empty-cell">
                              <div className="empty-state minimal">
                                <strong className="empty-state-title">No records found</strong>
                                <span className="empty-state-desc">
                                  {isDailyTripReport
                                    ? `No delivery trips recorded on ${formatShortDate(parseDateValue(dailyDate))}.`
                                    : "No records found within the selected date range or template filters."}
                                </span>
                              </div>
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
                </table>
              </div>

              {processedReport.rows.length > 0 ? (
                <TablePagination
                  page={reportPage}
                  pageCount={reportPageCount}
                  totalItems={sortedRows.length}
                  pageSize={REPORT_PAGE_SIZE}
                  onPageChange={setReportPage}
                  itemLabel={activeTemplate.baseType === "trip_ledger" ? "trips" : "records"}
                  itemCountInPage={paginatedRows.length}
                />
              ) : null}
            </section>

            <footer className="report-document-footer">
              <span>RouteX — Delivery Operations & Trucks</span>
              <span>Redeemed Route Logistics Inc.</span>
            </footer>
          </article>
            </>
          )}
        </div>
      </div>
    </>
  );
}
