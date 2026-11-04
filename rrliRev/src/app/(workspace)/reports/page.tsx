"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  formatDateRange,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { ReportCustomizerModal } from "@/components/report-customizer-modal";
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
  const { deliveries: filteredDeliveries, loading, error } = usePersistedDeliveries(range);

  // Template collection state
  const [templates, setTemplates] = useState<ReportTemplate[]>(() => [
    ...BUILTIN_REPORT_TEMPLATES,
  ]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("default-revenue");

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
          "truck-profitability": "default-profitability",
          "client-deliveries": "default-revenue",
          "pod-completeness": "default-activity",
        };
        if (tabToId[tabParam]) {
          setActiveTemplateId(tabToId[tabParam]);
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // Find active template
  const activeTemplate = useMemo(() => {
    return (
      templates.find((t) => t.id === activeTemplateId) ||
      BUILTIN_REPORT_TEMPLATES.find((t) => t.id === activeTemplateId) ||
      DEFAULT_REVENUE_TEMPLATE
    );
  }, [templates, activeTemplateId]);

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
              Create printable and exportable delivery and financial reports.
            </p>
          </div>
          <div className="report-actions">
            {isAdmin && (
              <>
                <button
                  type="button"
                  className="page-intro-action report-customize-action"
                  aria-label="Customize current report layout"
                  onClick={() => handleOpenCustomizer(activeTemplate, false)}
                >
                  <span aria-hidden="true">⚙</span>
                  {activeTemplate.isDefault ? "Customize Layout" : "Edit Layout"}
                </button>
                <button
                  type="button"
                  className="page-intro-action report-new-action"
                  aria-label="Create new report format"
                  onClick={() => handleOpenCustomizer(activeTemplate, true)}
                >
                  <span aria-hidden="true">+</span> New Format
                </button>
              </>
            )}
            <button
              type="button"
              className="page-intro-action report-export-action"
              aria-label="Export report to Excel CSV"
              onClick={() => downloadReportCsvFile(processedReport, formatDateRange(range))}
            >
              <span aria-hidden="true">↓</span> Export Excel (.csv)
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
          <div className="report-tabs-bar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
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
                  {tpl.layout.title.replace(" Report", "")}
                </button>
              ))}
            </div>

            {/* Custom Saved Formats Selector */}
            {customTemplates.length > 0 && (
              <div className="report-custom-selector" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label htmlFor="custom-format-dropdown" style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)" }}>
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
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border-subtle)",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
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

          {/* Active Template Metadata Pill */}
          {!activeTemplate.isDefault && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 16px",
                marginBottom: "16px",
                borderRadius: "10px",
                background: "color-mix(in srgb, var(--color-accent-soft) 40%, transparent)",
                border: "1px solid var(--color-border-subtle)",
                fontSize: "11px",
              }}
            >
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
                <span>
                  Prepared for {actor.fullName} ({actor.roleLabel} — {actor.accessLevelLabel})
                </span>
                {activeTemplate.layout.subtitle && (
                  <p style={{ marginTop: "4px", fontSize: "11px", color: "var(--color-text-muted)" }}>
                    {activeTemplate.layout.subtitle}
                  </p>
                )}
              </div>
              <dl>
                <div>
                  <dt>Period</dt>
                  <dd>{formatDateRange(range)}</dd>
                </div>
                <div>
                  <dt>Trips Included</dt>
                  <dd>{processedReport.totals.totalTrips} trips</dd>
                </div>
                <div>
                  <dt>Store Drop-offs</dt>
                  <dd>{processedReport.totals.totalStoreDropoffs} stores</dd>
                </div>
                <div>
                  <dt>Layout Format</dt>
                  <dd>{activeTemplate.isDefault ? "Standard Default" : "Custom Layout"}</dd>
                </div>
              </dl>
            </header>

            {/* Dynamic Summary Cards Based on Configured Financial Breakdowns */}
            <section className="report-summary">
              {activeTemplate.breakdown.showGrossEarnings && (
                <div>
                  <span>Gross Delivery Earnings</span>
                  <strong>{formatPeso(processedReport.totals.grossEarnings)}</strong>
                  <em>Billed delivery rates</em>
                </div>
              )}
              {activeTemplate.breakdown.showTotalExpenses && (
                <div>
                  <span>Total Trip Expenses</span>
                  <strong>{formatPeso(processedReport.totals.totalExpenses)}</strong>
                  <em>Diesel, tolls, crew & entry</em>
                </div>
              )}
              {activeTemplate.breakdown.showNetProfit && (
                <div>
                  <span>Net Profit</span>
                  <strong>{formatPeso(processedReport.totals.netProfit)}</strong>
                  <em>
                    {formatPercent(processedReport.totals.marginPercent)}{" "}
                    net margin
                  </em>
                </div>
              )}
              {activeTemplate.breakdown.showProfitMargin && (
                <div>
                  <span>Profit Margin</span>
                  <strong>{formatPercent(processedReport.totals.marginPercent)}</strong>
                  <em>Net return on revenue</em>
                </div>
              )}
              {activeTemplate.breakdown.showActiveTrucks && (
                <div>
                  <span>Active Trucks</span>
                  <strong>{processedReport.totals.activeTruckCount} units</strong>
                  <em>Fleet units deployed</em>
                </div>
              )}
              {activeTemplate.breakdown.showStoreDropoffs && (
                <div>
                  <span>Store Drop-offs</span>
                  <strong>{processedReport.totals.totalStoreDropoffs} stores</strong>
                  <em>Destination delivery points</em>
                </div>
              )}
              {activeTemplate.breakdown.showDieselExpenses && (
                <div>
                  <span>Diesel Fuel Costs</span>
                  <strong>{formatPeso(processedReport.totals.totalDieselExpenses)}</strong>
                  <em>Fleet fuel consumption</em>
                </div>
              )}
              {activeTemplate.breakdown.showTollExpenses && (
                <div>
                  <span>Tollway Fees</span>
                  <strong>{formatPeso(processedReport.totals.totalTollExpenses)}</strong>
                  <em>Expressway toll costs</em>
                </div>
              )}
              {activeTemplate.breakdown.showCrewCosts && (
                <div>
                  <span>Crew Wages & Allowance</span>
                  <strong>{formatPeso(processedReport.totals.totalCrewCosts)}</strong>
                  <em>Driver & helper rates</em>
                </div>
              )}
            </section>

            <section className="report-table-section">
              <div className="report-table-heading">
                <div>
                  <h3>{activeTemplate.layout.sectionHeading}</h3>
                  <p>
                    {processedReport.rows.length}{" "}
                    {activeTemplate.baseType === "trip_ledger" ? "trip" : "group"}
                    {processedReport.rows.length === 1 ? "" : "s"} in the selected range
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
                    Showing Finalized Deliveries Only
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
                    {sortedRows.map((row, rowIdx) => (
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

              {processedReport.rows.length === 0 ? (
                <div className="empty-state report-empty-state">
                  <strong>No records in this range</strong>
                  <span>Choose a wider date range or adjust template filters to populate this report.</span>
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
