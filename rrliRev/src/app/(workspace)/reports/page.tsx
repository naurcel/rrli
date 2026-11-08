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
    return processReport(filteredDeliveries, activeTemplate);
  }, [filteredDeliveries, activeTemplate]);

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
              title="Feature temporarily disabled"
              disabled
            >
              <span aria-hidden="true">↓</span> Export CSV
            </button>
            <button
              type="button"
              className="report-print-button page-intro-action"
              aria-label="Print the report or save it as a PDF"
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
                  onClick={() => setDailyDate((prev) => toDateKey(addDays(parseDateValue(prev), -1)))}
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
                  className="daily-date-input"
                  aria-label="Select report date"
                  value={dailyDate}
                  onChange={(e) => {
                    if (e.target.value) setDailyDate(e.target.value);
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
                    Daily delivery log, route drop-offs, and driver trip records for {formatShortDate(parseDateValue(dailyDate))}.
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
                  <span>Delivery Revenue</span>
                  <strong>{formatPeso(processedReport.totals.grossEarnings)}</strong>
                </div>
              )}
              {activeTemplate.breakdown.showTotalExpenses && (
                <div>
                  <span>Trip Expenses</span>
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
            </section>

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
                <div className="empty-state report-empty-state">
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
