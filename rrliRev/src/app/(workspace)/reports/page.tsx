"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  addDays,
  formatDateRange,
  formatShortDate,
  parseDateValue,
  toDateKey,
  useGlobalDateRange,
  type DateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { ReportCustomizerModal } from "@/components/report-customizer-modal";
import { TablePagination } from "@/components/table-pagination";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import {
  ExpenseDonutPieChart,
  type ExpenseCategorySlice,
} from "@/components/delivery-financial-breakdown";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import {
  downloadReportCsvFile,
  formatCellValue,
  processReport,
} from "@/features/reports/report-engine";
import {
  deleteClientReportTemplate,
  loadClientReportTemplates,
  saveClientReportTemplate,
} from "@/features/reports/report-template-store";
import {
  BUILTIN_REPORT_TEMPLATES,
  DEFAULT_REVENUE_TEMPLATE,
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
import { canManageReportTemplates } from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";

export default function ReportsPage() {
  const actor = useAuthenticatedActor();
  const isAdmin = canManageReportTemplates(actor.role);
  const { range } = useGlobalDateRange();

  // Template collection state
  const [templates, setTemplates] = useState<ReportTemplate[]>(() => [
    ...BUILTIN_REPORT_TEMPLATES,
  ]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("default-revenue");

  // Daily trip report fixed-date state (defaults to today's date YYYY-MM-DD)
  const [dailyDate, setDailyDate] = useState<string>(() => toDateKey(new Date()));

  // Find active template
  const activeTemplate = useMemo(() => {
    return (
      templates.find((t) => t.id === activeTemplateId) ||
      BUILTIN_REPORT_TEMPLATES.find((t) => t.id === activeTemplateId) ||
      DEFAULT_REVENUE_TEMPLATE
    );
  }, [templates, activeTemplateId]);

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

  // Customizer modal state
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customizerTargetTemplate, setCustomizerTargetTemplate] = useState<ReportTemplate>(
    DEFAULT_REVENUE_TEMPLATE,
  );
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Table sorting
  const [reportSort, setReportSort] = useState<{ key: string; direction: TableSortDirection }>({
    key: "revenue",
    direction: "desc",
  });

  // Load saved templates from localStorage & server API
  useEffect(() => {
    const localTemplates = loadClientReportTemplates();
    if (localTemplates.length > 0) {
      setTemplates(localTemplates);
    }

    fetch("/api/reports/templates")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && Array.isArray(data.templates)) {
          setTemplates(data.templates);
        }
      })
      .catch(() => {
        // Fallback to local storage
      });
  }, []);

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
          title: "Revenue by Client Account",
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
        title: "Revenue by Client Account",
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

  // Open customizer modal
  function handleOpenCustomizer(targetTemplate: ReportTemplate, asNew: boolean) {
    if (asNew) {
      const cloned: ReportTemplate = {
        ...targetTemplate,
        id: "",
        name: `${targetTemplate.name} (Custom Layout)`,
        isDefault: false,
        layout: {
          ...targetTemplate.layout,
          title: `${targetTemplate.layout.title} (Custom)`,
        },
      };
      setCustomizerTargetTemplate(cloned);
    } else {
      setCustomizerTargetTemplate(targetTemplate);
    }
    setIsCustomizerOpen(true);
  }

  // Save template from customizer modal
  async function handleSaveTemplate(templateToSave: ReportTemplate, isNew: boolean) {
    try {
      const response = await fetch("/api/reports/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...templateToSave,
          id: isNew ? undefined : templateToSave.id,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Failed to save template layout.");
      }

      const savedTemplate = data.template as ReportTemplate;
      saveClientReportTemplate(savedTemplate);

      setTemplates((prev) => {
        const filtered = prev.filter((t) => t.id !== savedTemplate.id);
        return [...filtered, savedTemplate];
      });

      setActiveTemplateId(savedTemplate.id);
      setFeedbackNotice({
        type: "success",
        message: `Report layout "${savedTemplate.name}" has been saved.`,
      });
      setTimeout(() => setFeedbackNotice(null), 5000);
    } catch (err) {
      setFeedbackNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Error saving report layout.",
      });
      throw err;
    }
  }

  // Delete custom template
  async function handleDeleteTemplate(id: string) {
    try {
      const response = await fetch(`/api/reports/templates?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Failed to delete template.");
      }

      deleteClientReportTemplate(id);

      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setActiveTemplateId("default-revenue");
      setIsCustomizerOpen(false);
      setFeedbackNotice({
        type: "success",
        message: "Custom report layout was deleted.",
      });
      setTimeout(() => setFeedbackNotice(null), 5000);
    } catch (err) {
      setFeedbackNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Error deleting report layout.",
      });
      throw err;
    }
  }

  // Filter custom templates for selector
  const customTemplates = useMemo(() => {
    return templates.filter((t) => !t.isDefault);
  }, [templates]);

  return (
    <>
      <OperationalTopbar contextLabel="Delivery Operations & Truck Reports" />

      <div className="content-wrap report-page">
        <header className="page-intro report-intro">
          <div>
            <h1>Reports</h1>
            <p className="subtitle">
              Print and export delivery reports.
            </p>
          </div>
          <div className="report-actions">
            {isAdmin && (
              <>
                <button
                  type="button"
                  className="page-intro-action report-customize-action"
                  aria-label="Customize current report layout (temporarily disabled)"
                  data-tooltip="Customize report layout (temporarily disabled)"
                  title="Feature temporarily disabled"
                  disabled
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  {activeTemplate.isDefault ? "Customize" : "Edit Layout"}
                </button>
                <button
                  type="button"
                  className="page-intro-action report-new-action"
                  aria-label="Create new report format (temporarily disabled)"
                  data-tooltip="Create new report format (temporarily disabled)"
                  title="Feature temporarily disabled"
                  disabled
                >
                  <span aria-hidden="true">+</span> New Format
                </button>
              </>
            )}
            <button
              type="button"
              className="page-intro-action report-export-action"
              aria-label="Export report to Excel CSV (temporarily disabled)"
              data-tooltip="Export report to Excel CSV (temporarily disabled)"
              title="Feature temporarily disabled"
              disabled
            >
              <span aria-hidden="true">↓</span> Export CSV
            </button>
            <button
              type="button"
              className="report-print-button page-intro-action"
              aria-label="Print the report or save it as a PDF"
              data-tooltip="Print report or save as PDF"
              title="Print the report or save it as a PDF"
              onClick={() => window.print()}
            >
              Print
            </button>
          </div>
        </header>

        {feedbackNotice && (
          <section
            className={`notice ${feedbackNotice.type === "success" ? "notice-success" : "notice-alert"}`}
            role="status"
            style={{ marginBottom: "16px" }}
          >
            <span className="notice-icon" aria-hidden="true">
              {feedbackNotice.type === "success" ? "✓" : "!"}
            </span>
            <div>
              <strong>
                {feedbackNotice.type === "success" ? "Report Format Updated:" : "Action Failed:"}
              </strong>
              <span>{feedbackNotice.message}</span>
            </div>
          </section>
        )}

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
            </div>

            {/* Custom Saved Formats Selector */}
            {customTemplates.length > 0 && (
              <div className="report-custom-selector">
                <label htmlFor="custom-format-dropdown">
                  Custom Formats:
                </label>
                <select
                  id="custom-format-dropdown"
                  value={activeTemplate.isDefault ? "" : activeTemplate.id}
                  onChange={(e) => {
                    if (e.target.value) {
                      setActiveTemplateId(e.target.value);
                    }
                  }}
                >
                  <option value="">— Select Saved Layout ({customTemplates.length}) —</option>
                  {customTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

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
                  title="Select date for daily trip report (from 2024)"
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
                Fixed to {formatShortDate(parseDateValue(dailyDate))} · Ignores global date filter
              </span>
            </div>
          )}

          {/* Active Template Metadata Pill */}
          {!activeTemplate.isDefault && (
            <div className="report-custom-banner">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 700, color: "var(--color-accent)" }}>Custom Layout Active:</span>
                <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{activeTemplate.name}</span>
                <span style={{ color: "var(--color-text-muted)" }}>— {activeTemplate.description}</span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleOpenCustomizer(activeTemplate, false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-accent)",
                    fontWeight: 700,
                    fontSize: "11px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Edit Format Settings
                </button>
              )}
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
                    {paginatedRows.map((row, rowIdx) => (
                      <tr
                        key={
                          (row.waybillNumber as string) ||
                          (row.clientName as string) ||
                          (row.plateNumber as string) ||
                          rowIdx
                        }
                      >
                        {processedReport.columns.map((col) => {
                          const rawVal = row[col.id];
                          if (col.dataType === "badge") {
                            const isPositive =
                              rawVal === "Finalized" || rawVal === "Complete";
                            return (
                              <td key={col.id} style={{ textAlign: col.align }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    backgroundColor: isPositive
                                      ? "rgba(16, 185, 129, 0.15)"
                                      : "rgba(107, 114, 128, 0.15)",
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
                    ))}
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

              {processedReport.rows.length === 0 ? (
                <div
                  className="empty-state report-empty-state"
                  title={isDailyTripReport ? "No delivery trips recorded for the selected single day" : "No operational records found within the selected date range"}
                >
                  <strong>
                    {isDailyTripReport
                      ? "No trips recorded for this date"
                      : "No records in this range"}
                  </strong>
                  <span>
                    {isDailyTripReport
                      ? `No delivery trips were executed on ${formatShortDate(parseDateValue(dailyDate))}. Use the date selector above to view other days.`
                      : "Choose a wider date range or adjust template filters to populate this report."}
                  </span>
                </div>
              ) : null}
            </section>

            <footer className="report-document-footer">
              <span>RouteX — Delivery Operations & Trucks</span>
              <span>Redeemed Route Logistics Inc.</span>
            </footer>
          </article>
        </div>
      </div>

      {/* Report Layout Customizer Modal */}
      {isCustomizerOpen && (
        <ReportCustomizerModal
          isOpen={isCustomizerOpen}
          onClose={() => setIsCustomizerOpen(false)}
          currentTemplate={customizerTargetTemplate}
          onSaveTemplate={handleSaveTemplate}
          onDeleteTemplate={
            customizerTargetTemplate.isDefault ? undefined : handleDeleteTemplate
          }
          sampleDeliveries={filteredDeliveries}
        />
      )}
    </>
  );
}
