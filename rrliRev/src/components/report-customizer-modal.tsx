"use client";

import { useMemo, useState } from "react";

import { type DeliveryTripRecord } from "@/features/deliveries/delivery-domain";
import {
  formatCellValue,
  generateReportRows,
  resolveTemplateColumns,
} from "@/features/reports/report-engine";
import {
  type ColumnConfig,
  getColumnCatalog,
  type ReportBaseType,
  type ReportTemplate,
} from "@/features/reports/report-template-types";

type CustomizerTab = "layout" | "columns" | "breakdowns" | "preview";

interface ReportCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTemplate: ReportTemplate;
  onSaveTemplate: (updated: ReportTemplate, isNew: boolean) => Promise<void>;
  onDeleteTemplate?: (id: string) => Promise<void>;
  sampleDeliveries: readonly DeliveryTripRecord[];
}

export function ReportCustomizerModal({
  isOpen,
  onClose,
  currentTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  sampleDeliveries,
}: ReportCustomizerModalProps) {
  const [activeTab, setActiveTab] = useState<CustomizerTab>("columns");
  const [name, setName] = useState(currentTemplate.name);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [description, setDescription] = useState(currentTemplate.description);
  const [baseType, setBaseType] = useState<ReportBaseType>(currentTemplate.baseType);
  const [title, setTitle] = useState(currentTemplate.layout.title);
  const [sectionHeading, setSectionHeading] = useState(currentTemplate.layout.sectionHeading);
  const [subtitle, setSubtitle] = useState(currentTemplate.layout.subtitle || "");

  // Column configurations
  const catalog = useMemo(() => getColumnCatalog(baseType), [baseType]);

  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(() => {
    // Merge existing columns with catalog
    const existingMap = new Map(currentTemplate.columns.map((c) => [c.id, c]));
    return catalog.map((def, index) => {
      const existing = existingMap.get(def.id);
      return (
        existing || {
          id: def.id,
          visible: true,
          order: index,
          customLabel: "",
          align: def.defaultAlign,
        }
      );
    });
  });

  // Financial breakdown toggles
  const [breakdown, setBreakdown] = useState(currentTemplate.breakdown);

  // Filters
  const [financialStateFilter, setFinancialStateFilter] = useState(
    currentTemplate.filters.financialState,
  );
  const [truckOwnershipFilter, setTruckOwnershipFilter] = useState(
    currentTemplate.filters.truckOwnership,
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // When baseType changes, reset columns to catalog defaults
  function handleBaseTypeChange(newType: ReportBaseType) {
    setBaseType(newType);
    const newCatalog = getColumnCatalog(newType);
    setColumnConfigs(
      newCatalog.map((def, index) => ({
        id: def.id,
        visible: index < 5,
        order: index,
        customLabel: "",
        align: def.defaultAlign,
      })),
    );
  }

  // Toggle column visibility
  function toggleColumnVisibility(colId: string) {
    setColumnConfigs((current) =>
      current.map((col) => (col.id === colId ? { ...col, visible: !col.visible } : col)),
    );
  }

  // Update custom column label
  function updateColumnLabel(colId: string, customLabel: string) {
    setColumnConfigs((current) =>
      current.map((col) => (col.id === colId ? { ...col, customLabel } : col)),
    );
  }

  // Move column up/down in order
  function moveColumn(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columnConfigs.length) return;

    const reordered = [...columnConfigs];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Re-index orders
    const normalized = reordered.map((col, idx) => ({ ...col, order: idx }));
    setColumnConfigs(normalized);
  }

  // Build the live preview template
  const previewTemplate: ReportTemplate = useMemo(
    () => ({
      id: currentTemplate.id,
      name: name.trim() || "Custom Report",
      description: description.trim(),
      baseType,
      isDefault: currentTemplate.isDefault,
      createdAt: currentTemplate.createdAt,
      updatedAt: new Date().toISOString(),
      layout: {
        title: title.trim() || "Operational Report",
        sectionHeading: sectionHeading.trim() || "Report Breakdown",
        subtitle: subtitle.trim() || undefined,
      },
      columns: columnConfigs,
      breakdown,
      filters: {
        financialState: financialStateFilter,
        truckOwnership: truckOwnershipFilter,
      },
    }),
    [
      currentTemplate,
      name,
      description,
      baseType,
      title,
      sectionHeading,
      subtitle,
      columnConfigs,
      breakdown,
      financialStateFilter,
      truckOwnershipFilter,
    ],
  );

  // Compute live preview rows
  const previewData = useMemo(() => {
    try {
      const resolvedCols = resolveTemplateColumns(previewTemplate.baseType, previewTemplate.columns);
      const { rows, totals } = generateReportRows(sampleDeliveries, previewTemplate);
      return { resolvedCols, rows, totals };
    } catch {
      return { resolvedCols: [], rows: [], totals: null };
    }
  }, [sampleDeliveries, previewTemplate]);

  async function handleSave(asNew: boolean) {
    setSaving(true);
    setSaveError(null);

    const visibleCount = columnConfigs.filter((c) => c.visible).length;
    if (visibleCount === 0) {
      setSaveError("At least one column must be visible in the report format.");
      setSaving(false);
      return;
    }

    try {
      await onSaveTemplate(previewTemplate, asNew);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save report template.");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 21, 0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizer-modal-title"
    >
      <div
        className="records-card report-customizer-dialog"
        style={{
          width: "min(100%, 920px)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          background: "var(--color-surface)",
          boxShadow: "0 24px 64px rgba(15, 23, 21, 0.35)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: "18px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: "rgba(180, 83, 9, 0.12)",
                  color: "var(--color-accent)",
                  border: "1px solid rgba(180, 83, 9, 0.25)",
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Admin Tool
              </span>
              <h2 id="customizer-modal-title" style={{ margin: 0, fontSize: "18px" }}>
                Customize Report Format
              </h2>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
              Configure column ordering, custom headings, visibility, and financial breakdowns for Redeemed Route Logistics.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: "transparent",
              border: 0,
              fontSize: "20px",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              padding: "4px 8px",
            }}
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "10px 24px",
            background: "var(--color-surface-subtle)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <button
            type="button"
            className={`secondary-button ${activeTab === "columns" ? "is-active" : ""}`}
            onClick={() => setActiveTab("columns")}
            style={{
              minHeight: "34px",
              fontSize: "12px",
              fontWeight: activeTab === "columns" ? 700 : 500,
              background: activeTab === "columns" ? "var(--color-surface)" : "transparent",
            }}
          >
            1. Columns &amp; Headings ({columnConfigs.filter((c) => c.visible).length} visible)
          </button>
          <button
            type="button"
            className={`secondary-button ${activeTab === "layout" ? "is-active" : ""}`}
            onClick={() => setActiveTab("layout")}
            style={{
              minHeight: "34px",
              fontSize: "12px",
              fontWeight: activeTab === "layout" ? 700 : 500,
              background: activeTab === "layout" ? "var(--color-surface)" : "transparent",
            }}
          >
            2. Layout &amp; Titles
          </button>
          <button
            type="button"
            className={`secondary-button ${activeTab === "breakdowns" ? "is-active" : ""}`}
            onClick={() => setActiveTab("breakdowns")}
            style={{
              minHeight: "34px",
              fontSize: "12px",
              fontWeight: activeTab === "breakdowns" ? 700 : 500,
              background: activeTab === "breakdowns" ? "var(--color-surface)" : "transparent",
            }}
          >
            3. Financial KPIs &amp; Filters
          </button>
          <button
            type="button"
            className={`secondary-button ${activeTab === "preview" ? "is-active" : ""}`}
            onClick={() => setActiveTab("preview")}
            style={{
              minHeight: "34px",
              fontSize: "12px",
              fontWeight: activeTab === "preview" ? 700 : 500,
              background: activeTab === "preview" ? "var(--color-surface)" : "transparent",
            }}
          >
            4. Live Preview ({previewData.rows.length} rows)
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {/* TAB 1: Columns & Headings */}
          {activeTab === "columns" && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "14px" }}>
                    Column Selection, Ordering &amp; Custom Headings
                  </h3>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--color-text-muted)" }}>
                    Check or uncheck columns, rename headings to match company terminology, and use ↑ / ↓ to adjust ordering.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() =>
                      setColumnConfigs((curr) => curr.map((c) => ({ ...c, visible: true })))
                    }
                    className="secondary-button"
                    style={{ minHeight: "30px", fontSize: "11px", padding: "0 10px" }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setColumnConfigs((curr) => curr.map((c, i) => ({ ...c, visible: i < 4 })))
                    }
                    className="secondary-button"
                    style={{ minHeight: "30px", fontSize: "11px", padding: "0 10px" }}
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>

              <div
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--color-surface-subtle)", textAlign: "left" }}>
                      <th style={{ padding: "10px 12px", width: "40px" }}>Order</th>
                      <th style={{ padding: "10px 12px", width: "50px" }}>Show</th>
                      <th style={{ padding: "10px 12px", width: "180px" }}>Default Field</th>
                      <th style={{ padding: "10px 12px" }}>Custom Column Heading (Rename)</th>
                      <th style={{ padding: "10px 12px", width: "100px" }}>Data Type</th>
                      <th style={{ padding: "10px 12px", width: "80px", textAlign: "center" }}>Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columnConfigs.map((col, index) => {
                      const def = catalog.find((c) => c.id === col.id);
                      return (
                        <tr
                          key={col.id}
                          style={{
                            borderTop: "1px solid var(--color-border)",
                            background: col.visible ? "transparent" : "var(--color-surface-subtle)",
                            opacity: col.visible ? 1 : 0.6,
                          }}
                        >
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--color-text-muted)" }}>
                            {index + 1}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <input
                              type="checkbox"
                              checked={col.visible}
                              onChange={() => toggleColumnVisibility(col.id)}
                              style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                            {def?.defaultLabel || col.id}
                            <br />
                            <small style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                              {def?.description}
                            </small>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <input
                              type="text"
                              value={col.customLabel ?? ""}
                              placeholder={def?.defaultLabel || "Custom heading…"}
                              onChange={(e) => updateColumnLabel(col.id, e.target.value)}
                              disabled={!col.visible}
                              style={{
                                width: "100%",
                                minHeight: "34px",
                                padding: "0 10px",
                                borderRadius: "6px",
                                border: "1px solid var(--color-border)",
                                background: "var(--glass-surface-strong)",
                                fontSize: "12px",
                              }}
                            />
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "var(--color-surface-subtle)",
                                fontSize: "10px",
                                textTransform: "uppercase",
                                fontWeight: 700,
                                color: "var(--color-text-muted)",
                              }}
                            >
                              {def?.dataType || "string"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: "2px" }}>
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveColumn(index, "up")}
                                style={{
                                  padding: "3px 6px",
                                  fontSize: "11px",
                                  borderRadius: "4px",
                                  border: "1px solid var(--color-border)",
                                  background: "var(--color-surface)",
                                  cursor: index === 0 ? "not-allowed" : "pointer",
                                  opacity: index === 0 ? 0.3 : 1,
                                }}
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={index === columnConfigs.length - 1}
                                onClick={() => moveColumn(index, "down")}
                                style={{
                                  padding: "3px 6px",
                                  fontSize: "11px",
                                  borderRadius: "4px",
                                  border: "1px solid var(--color-border)",
                                  background: "var(--color-surface)",
                                  cursor: index === columnConfigs.length - 1 ? "not-allowed" : "pointer",
                                  opacity: index === columnConfigs.length - 1 ? 0.3 : 1,
                                }}
                                title="Move down"
                              >
                                ↓
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Layout & Titles */}
          {activeTab === "layout" && (
            <div style={{ display: "grid", gap: "18px", maxWidth: "600px" }}>
              <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                Template Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Executive Client Profitability"
                  style={{
                    minHeight: "40px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--glass-surface-strong)",
                  }}
                  required
                />
              </label>

              <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain when and who uses this report format…"
                  rows={2}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--glass-surface-strong)",
                    fontSize: "12px",
                    resize: "vertical",
                  }}
                />
              </label>

              <div style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                <span>Report Base Aggregation / Scope</span>
                <select
                  value={baseType}
                  onChange={(e) => handleBaseTypeChange(e.target.value as ReportBaseType)}
                  style={{
                    minHeight: "40px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--glass-surface-strong)",
                    fontSize: "12px",
                  }}
                >
                  <option value="client_summary">Client Summary (Grouped by Client Company)</option>
                  <option value="truck_summary">Truck Summary (Grouped by Vehicle Plate)</option>
                  <option value="trip_ledger">Detailed Trip Ledger (Itemized Delivery Trips)</option>
                </select>
                <small style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                  Changing the base type updates available columns to match the selected level of detail.
                </small>
              </div>

              <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                Document Title (Print &amp; PDF Header)
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Completed-Delivery Revenue Report"
                  style={{
                    minHeight: "40px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--glass-surface-strong)",
                  }}
                  required
                />
              </label>

              <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                Table Section Heading
                <input
                  type="text"
                  value={sectionHeading}
                  onChange={(e) => setSectionHeading(e.target.value)}
                  placeholder="e.g. Completed Deliveries by Client"
                  style={{
                    minHeight: "40px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--glass-surface-strong)",
                  }}
                  required
                />
              </label>

              <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                Subtitle / Footnote Note
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g. Prepared for executive review — Confirmed trips only"
                  style={{
                    minHeight: "40px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--glass-surface-strong)",
                  }}
                />
              </label>
            </div>
          )}

          {/* TAB 3: Financial Breakdowns & Filters */}
          {activeTab === "breakdowns" && (
            <div style={{ display: "grid", gap: "22px" }}>
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "14px" }}>
                  Summary Metric Cards (Top KPIs)
                </h3>
                <p style={{ margin: "0 0 14px", fontSize: "11px", color: "var(--color-text-muted)" }}>
                  Select which summary cards appear above the data table in the exported document.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {[
                    { key: "showGrossEarnings", label: "Delivery Revenue" },
                    { key: "showTotalExpenses", label: "Trip Expenses" },
                    { key: "showNetProfit", label: "Net Profit" },
                    { key: "showProfitMargin", label: "Profit Margin" },
                    { key: "showActiveTrucks", label: "Active Trucks" },
                    { key: "showStoreDropoffs", label: "Store Drop-offs" },
                    { key: "showDieselExpenses", label: "Diesel Fuel" },
                    { key: "showTollExpenses", label: "Highway Tolls" },
                    { key: "showCrewCosts", label: "Crew Compensation" },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border)",
                        background: breakdown[key as keyof typeof breakdown]
                          ? "rgba(180, 83, 9, 0.08)"
                          : "transparent",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={breakdown[key as keyof typeof breakdown]}
                        onChange={(e) =>
                          setBreakdown((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "14px" }}>
                  Data Integrity &amp; Financial Filtering
                </h3>
                <p style={{ margin: "0 0 14px", fontSize: "11px", color: "var(--color-text-muted)" }}>
                  Control whether unfinalized trips with unknown expenses or subcontractor vehicles are included.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "14px",
                  }}
                >
                  <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                    Financial Finalization State
                    <select
                      value={financialStateFilter}
                      onChange={(e) =>
                        setFinancialStateFilter(e.target.value as "all" | "finalized_only")
                      }
                      style={{
                        minHeight: "40px",
                        padding: "0 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border)",
                        background: "var(--glass-surface-strong)",
                        fontSize: "12px",
                      }}
                    >
                      <option value="finalized_only">
                        Finalized Trips Only (Excludes unknown expenses)
                      </option>
                      <option value="all">All Trips (Includes trips with pending expenses)</option>
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                    Truck Ownership Filter
                    <select
                      value={truckOwnershipFilter}
                      onChange={(e) =>
                        setTruckOwnershipFilter(
                          e.target.value as "all" | "owned_only" | "subcontracted_only",
                        )
                      }
                      style={{
                        minHeight: "40px",
                        padding: "0 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border)",
                        background: "var(--glass-surface-strong)",
                        fontSize: "12px",
                      }}
                    >
                      <option value="all">All Fleet (Owned &amp; Subcontracted)</option>
                      <option value="owned_only">Owned Fleet Only</option>
                      <option value="subcontracted_only">Subcontracted Providers Only</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Live Preview */}
          {activeTab === "preview" && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "rgba(16, 185, 129, 0.12)",
                    color: "#059669",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  Live Report Preview
                </span>
                <h3 style={{ margin: "4px 0 2px", fontSize: "16px" }}>
                  {previewTemplate.layout.title}
                </h3>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--color-text-muted)" }}>
                  {previewTemplate.layout.sectionHeading} — Showing {previewData.rows.length} rows using active delivery data.
                </p>
              </div>

              {previewData.resolvedCols.length === 0 ? (
                <div className="empty-state">
                  <strong>No visible columns selected</strong>
                  <span>Please check at least one column under the Columns tab.</span>
                </div>
              ) : (
                <div
                  style={{
                    overflowX: "auto",
                    border: "1px solid var(--color-border)",
                    borderRadius: "10px",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "var(--color-surface-subtle)" }}>
                        {previewData.resolvedCols.map((col) => (
                          <th
                            key={col.id}
                            style={{
                              padding: "10px 12px",
                              textAlign: col.align,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.slice(0, 10).map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          style={{
                            borderTop: "1px solid var(--color-border)",
                          }}
                        >
                          {previewData.resolvedCols.map((col) => (
                            <td
                              key={col.id}
                              style={{
                                padding: "8px 12px",
                                textAlign: col.align,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatCellValue(row[col.id], col.dataType)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {saveError && (
            <div
              style={{
                marginTop: "16px",
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.1)",
                color: "#dc2626",
                fontSize: "12px",
              }}
            >
              {saveError}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--color-border)",
            background: "var(--color-surface-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            {!currentTemplate.isDefault && onDeleteTemplate ? (
              isConfirmingDelete ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600 }}>
                    Confirm deletion of &ldquo;{currentTemplate.name}&rdquo;?
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isDeleting}
                    onClick={() => setIsConfirmingDelete(false)}
                    style={{ minHeight: "30px", padding: "0 10px", fontSize: "11px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={async () => {
                      setIsDeleting(true);
                      try {
                        await onDeleteTemplate(currentTemplate.id);
                        onClose();
                      } finally {
                        setIsDeleting(false);
                      }
                    }}
                    style={{
                      minHeight: "30px",
                      padding: "0 12px",
                      fontSize: "11px",
                      background: "#dc2626",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {isDeleting ? "Deleting…" : "Confirm Delete"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="filter-button"
                  onClick={() => setIsConfirmingDelete(true)}
                  style={{ color: "#dc2626", fontSize: "12px" }}
                >
                  Delete Custom Template
                </button>
              )
            ) : null}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
              style={{ minHeight: "38px", padding: "0 16px", fontSize: "12px" }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => handleSave(true)}
              disabled={saving}
              style={{ minHeight: "38px", padding: "0 16px", fontSize: "12px" }}
            >
              {saving ? "Saving…" : "Save as New Template"}
            </button>

            {!currentTemplate.isDefault ? (
              <button
                type="button"
                className="primary-action-button"
                onClick={() => handleSave(false)}
                disabled={saving}
                style={{ minHeight: "38px", padding: "0 18px", fontSize: "12px" }}
              >
                {saving ? "Updating…" : "Update Template"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
