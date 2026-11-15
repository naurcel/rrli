"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import type { TruckTemperature } from "@/features/deliveries/delivery-domain";
import {
  generateImportErrorReport,
  generateSampleCsv,
  parseDeliveryImport,
  validateStagedRow,
  type StagedDeliveryRow,
} from "@/features/deliveries/delivery-import-parser";
import {
  readBrowserPreviewDeliveries,
  upsertBrowserPreviewDelivery,
} from "@/features/deliveries/browser-preview-deliveries";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";

const DELIVERY_TEMPERATURES: readonly TruckTemperature[] = [
  "-20°C",
  "-18°C",
  "0°C",
  "2°C",
  "4°C",
  "20°C",
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

type ImportStep = 1 | 2 | 3 | 4;

type FilterTab = "all" | "ready" | "attention" | "duplicate";

export function DeliveryExcelImportClient({
  actorRoleLabel: _actorRoleLabel,
  actorFullName: _actorFullName,
}: {
  actorRoleLabel: string;
  actorFullName: string;
}) {
  const [step, setStep] = useState<ImportStep>(1);
  const [batchName, setBatchName] = useState(() => `DTR-Batch-${new Date().toISOString().slice(0, 10)}`);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stagedRows, setStagedRows] = useState<StagedDeliveryRow[]>([]);
  const [existingWaybills, setExistingWaybills] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    batchName: string;
    committedCount: number;
    committedWaybills: string[];
    duplicateCount: number;
    duplicateWaybills: string[];
    errors: { waybill: string; reason: string }[];
  } | null>(null);

  const searchInputId = useId();

  // Load existing waybills from browser preview and server
  useEffect(() => {
    const waybills = new Set<string>();
    try {
      const browserItems = readBrowserPreviewDeliveries();
      for (const item of browserItems) {
        if (item.waybillNumber) waybills.add(item.waybillNumber.trim().toUpperCase());
      }
    } catch {
      // Ignore localStorage read errors
    }

    fetch("/api/deliveries?pageSize=1000")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.items)) {
          for (const item of data.items) {
            if (item.waybillNumber) waybills.add(item.waybillNumber.trim().toUpperCase());
          }
        }
        setExistingWaybills(waybills);
      })
      .catch(() => {
        setExistingWaybills(waybills);
      });
  }, []);

  // Process text into parsed rows
  function processFileText(content: string, name: string) {
    setErrorMessage(null);
    setFileName(name);

    try {
      const result = parseDeliveryImport(content, existingWaybills);
      if (result.errors.length > 0 && result.rows.length === 0) {
        setErrorMessage(result.errors.join(". "));
        return;
      }
      if (result.rows.length === 0) {
        setErrorMessage("No valid delivery trip records could be found in the uploaded file.");
        return;
      }

      setStagedRows(result.rows);
      setStep(2);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to parse file.");
    }
  }

  function handleFileSelected(file: File) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage("File exceeds the maximum allowed size of 10MB.");
      return;
    }

    const cleanBaseName = file.name.replace(/\.[^/.]+$/, "");
    setBatchName(`DTR-${cleanBaseName}`);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        processFileText(text, file.name);
      }
    };
    reader.onerror = () => {
      setErrorMessage("Unable to read the uploaded file.");
    };
    reader.readAsText(file);
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }

  function loadSampleData() {
    const sample = generateSampleCsv();
    setBatchName(`DTR-Sample-Batch-${new Date().toISOString().slice(0, 10)}`);
    processFileText(sample, "sample_daily_trip_report.csv");
  }

  function downloadCsvTemplate() {
    const template = generateSampleCsv();
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "routex_daily_trip_report_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadErrorReport() {
    if (!importResult) return;
    const csv = generateImportErrorReport(stagedRows, importResult);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${batchName}-import-report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function updateRowField<K extends keyof StagedDeliveryRow>(
    id: string,
    field: K,
    value: StagedDeliveryRow[K],
  ) {
    setStagedRows((current) => {
      const updated = current.map((row) => {
        if (row.id !== id) return row;
        const modified = { ...row, [field]: value };
        // Recalculate status and issues
        const { status, issues } = validateStagedRow(modified, existingWaybills);
        return { ...modified, status, issues };
      });

      return updated;
    });
  }

  function removeStagedRow(id: string) {
    setStagedRows((current) => {
      const next = current.filter((r) => r.id !== id);
      return next;
    });
  }

  // Filtered rows for Step 2
  const visibleRows = useMemo(() => {
    return stagedRows.filter((r) => {
      if (activeTab === "ready" && r.status !== "ready") return false;
      if (activeTab === "attention" && r.status !== "needs_attention") return false;
      if (activeTab === "duplicate" && r.status !== "duplicate") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesWb = r.waybillNumber.toLowerCase().includes(q);
        const matchesClient = r.clientName.toLowerCase().includes(q);
        const matchesPlate = r.plateNumber.toLowerCase().includes(q);
        const matchesStore = r.dropoffs.some((d) => d.storeName.toLowerCase().includes(q));
        return matchesWb || matchesClient || matchesPlate || matchesStore;
      }

      return true;
    });
  }, [stagedRows, activeTab, searchQuery]);

  const readyCount = stagedRows.filter((r) => r.status === "ready").length;
  const attentionCount = stagedRows.filter((r) => r.status === "needs_attention").length;
  const duplicateCount = stagedRows.filter((r) => r.status === "duplicate").length;

  async function executeCommit() {
    const readyRows = stagedRows.filter((r) => r.status === "ready");
    if (readyRows.length === 0) {
      setErrorMessage("No ready rows are available for import.");
      return;
    }

    setImporting(true);
    setErrorMessage(null);

    try {
      const payload = {
        batchName,
        idempotencyKey: crypto.randomUUID(),
        rows: readyRows.map((r) => ({
          waybillNumber: r.waybillNumber,
          deliveryDate: r.deliveryDate,
          clientName: r.clientName,
          plateNumber: r.plateNumber,
          truckTemperature: r.truckTemperature,
          origin: r.origin || "Central Depot",
          distanceKm: r.distanceKm || 50,
          fuelRate: r.fuelRate || 85,
          deliveryRate: r.deliveryRate,
          dieselExpenses: r.dieselExpenses,
          dieselExpensesStatus: r.dieselExpenses != null ? "confirmed" : "unknown",
          tollGateExpenses: r.tollGateExpenses,
          tollGateExpensesStatus: r.tollGateExpenses != null ? "confirmed" : "not_applicable",
          tollGateBreakdown: r.tollGateBreakdown || "",
          driverDailyRate: r.driverDailyRate,
          driverDailyRateStatus: r.driverDailyRate != null ? "confirmed" : "unknown",
          driverAllowance: r.driverAllowance,
          driverAllowanceStatus: r.driverAllowance != null ? "confirmed" : "unknown",
          driverName: r.driverName,
          helperDailyRate: r.helperDailyRate,
          helperDailyRateStatus: r.helperDailyRate != null ? "confirmed" : "unknown",
          helperAllowance: r.helperAllowance,
          helperAllowanceStatus: r.helperAllowance != null ? "confirmed" : "unknown",
          helperName: r.helperName,
          otherExpenses: r.otherExpenses,
          otherExpensesStatus: r.otherExpenses != null ? "confirmed" : "not_applicable",
          dropoffs: r.dropoffs.map((d) => ({
            storeName: d.storeName,
            destinationArea: d.destinationArea,
            entryFee: d.entryFee,
            entryFeeStatus: d.entryFee != null ? "confirmed" : "not_applicable",
            podSubmitted: false,
            supportingDocsComplete: false,
            documentRef: "Awaiting POD upload",
          })),
        })),
      };

      const response = await fetch("/api/deliveries/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        batchName?: string;
        committedCount?: number;
        committedWaybills?: string[];
        committedRecords?: DeliveryLedgerItem[];
        duplicateCount?: number;
        duplicateWaybills?: string[];
        errors?: { waybill: string; reason: string }[];
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "Batch import failed.");
      }

      // Synchronize client preview cache so /deliveries immediately reflects new records
      if (Array.isArray(data.committedRecords)) {
        for (const record of data.committedRecords) {
          upsertBrowserPreviewDelivery(record);
        }
      }

      setImportResult({
        batchName: data.batchName ?? batchName,
        committedCount: data.committedCount ?? 0,
        committedWaybills: data.committedWaybills ?? [],
        duplicateCount: data.duplicateCount ?? 0,
        duplicateWaybills: data.duplicateWaybills ?? [],
        errors: data.errors ?? [],
      });

      setStep(4);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to commit import batch.");
    } finally {
      setImporting(false);
    }
  }

  function resetImportFlow() {
    setStep(1);
    setFileName(null);
    setStagedRows([]);
    setErrorMessage(null);
    setImportResult(null);
    setActiveTab("all");
    setSearchQuery("");
  }

  return (
    <>
      {/* Workflow Step Indicator */}
      <nav className="import-stepper" aria-label="Import Workflow Steps">
        <div className={`import-stepper-item${step === 1 ? " active" : step > 1 ? " completed" : ""}`}>
          <span className="import-stepper-num">1</span>
          <span>Select File</span>
        </div>
        <span className="import-stepper-arrow" aria-hidden="true">›</span>
        <div className={`import-stepper-item${step === 2 ? " active" : step > 2 ? " completed" : ""}`}>
          <span className="import-stepper-num">2</span>
          <span>Preview &amp; Validate</span>
        </div>
        <span className="import-stepper-arrow" aria-hidden="true">›</span>
        <div className={`import-stepper-item${step === 3 ? " active" : step > 3 ? " completed" : ""}`}>
          <span className="import-stepper-num">3</span>
          <span>Confirm Batch</span>
        </div>
        <span className="import-stepper-arrow" aria-hidden="true">›</span>
        <div className={`import-stepper-item${step === 4 ? " active" : ""}`}>
          <span className="import-stepper-num">4</span>
          <span>Import Results</span>
        </div>
      </nav>

      {/* Global Error Banner */}
      {errorMessage ? (
        <section className="notice" role="alert" style={{ marginBottom: "20px" }}>
          <span className="notice-icon" aria-hidden="true">
            !
          </span>
          <div>
            <strong>Import Notice:</strong>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss message"
            title="Dismiss message"
            onClick={() => setErrorMessage(null)}
          >
            ×
          </button>
        </section>
      ) : null}

      {/* STEP 1: Select File */}
      {step === 1 ? (
        <section className="records-card" aria-label="Select Import File">
          <div className="records-heading">
            <div>
              <h2>Select Daily Trip Report File</h2>
              <p>Upload a CSV, TSV, or spreadsheet export containing completed delivery trips.</p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button type="button" className="secondary-button" onClick={downloadCsvTemplate}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download CSV Template
              </button>
              <button type="button" className="secondary-button" onClick={loadSampleData}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Load Sample DTR Rows
              </button>
            </div>
          </div>

          <div style={{ padding: "24px", borderTop: "1px solid var(--line)" }}>
            <div className="import-batch-field" style={{ marginBottom: "22px" }}>
              <label htmlFor="import-batch-name" style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                Batch Reference Name
              </label>
              <input
                id="import-batch-name"
                type="text"
                className="import-table-input"
                style={{ maxWidth: "360px", minHeight: "38px", fontSize: "13px", padding: "8px 12px", borderRadius: "8px" }}
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. DTR-Batch-2026-11-01"
              />
            </div>

            <label
              className={`import-dropzone${isDragging ? " is-dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                setIsDragging(false);
                handleDrop(e);
              }}
            >
              <div className="import-dropzone-icon-wrap" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="12" y2="12" />
                  <line x1="15" y1="15" x2="12" y2="12" />
                </svg>
              </div>
              <strong className="import-dropzone-title">
                Click to browse or drag and drop your spreadsheet
              </strong>
              <span className="import-dropzone-desc">
                Supports standard CSV, TSV, and delimited text files up to 10MB.
              </span>
              <div className="import-dropzone-badges">
                <span className="import-badge">.CSV</span>
                <span className="import-badge">.TSV</span>
                <span className="import-badge">.TXT</span>
                <span className="import-badge">MAX 10MB</span>
              </div>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileInputChange}
                style={{ display: "none" }}
              />
            </label>

            <div className="import-guide-card" style={{ marginTop: "24px" }}>
              <strong className="import-guide-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--color-accent)" }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Import Requirements &amp; Multi-Stop Grouping:
              </strong>
              <ul className="import-guide-list">
                <li><strong>Mandatory Columns:</strong> Waybill Number, Delivery Date (2024 or later), Client Name, Truck Plate, Temperature, Delivery Rate/Revenue, and at least one Store Stop.</li>
                <li><strong>Multi-Stop Aggregation:</strong> Deliveries with multiple drop-offs repeat the same Waybill Number across consecutive rows and are automatically combined into a single trip record.</li>
                <li><strong>Duplicate Protection:</strong> Existing waybills in RouteX are detected before commit, preventing accidental historical record overwrites.</li>
                <li><strong>Strict Financial Integrity:</strong> Rates and allowances are strictly validated; incomplete or missing rates remain unresolved until verified.</li>
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {/* STEP 2: Preview & Validate */}
      {step === 2 ? (
        <section className="records-card" aria-label="Review and Validate Staged Deliveries">
          <div className="records-heading">
            <div>
              <h2>2. Staged Deliveries ({stagedRows.length} trips parsed)</h2>
              <p>
                File: <strong>{fileName}</strong> — Correct any highlighted errors before proceeding.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setStep(1)}
              >
                Replace File
              </button>
              <button
                type="button"
                className="primary-action-button"
                disabled={readyCount === 0}
                onClick={() => setStep(3)}
              >
                Proceed to Confirmation ({readyCount} Ready)
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="delivery-status-tabs" role="tablist" aria-label="Filter staged rows by validation status">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              className={`delivery-status-tab${activeTab === "all" ? " active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All Deliveries
              <span className="tab-count-badge">{stagedRows.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "ready"}
              className={`delivery-status-tab${activeTab === "ready" ? " active" : ""}`}
              onClick={() => setActiveTab("ready")}
            >
              Ready to Import
              <span className="tab-count-badge">{readyCount}</span>
            </button>
            {attentionCount > 0 ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "attention"}
                className={`delivery-status-tab is-incomplete-tab${activeTab === "attention" ? " active" : ""}`}
                onClick={() => setActiveTab("attention")}
              >
                Needs Attention
                <span className="tab-count-badge">{attentionCount}</span>
              </button>
            ) : null}
            {duplicateCount > 0 ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "duplicate"}
                className={`delivery-status-tab${activeTab === "duplicate" ? " active" : ""}`}
                onClick={() => setActiveTab("duplicate")}
              >
                Duplicates (Skip)
                <span className="tab-count-badge">{duplicateCount}</span>
              </button>
            ) : null}
          </div>

          {/* Quick Search inside staged table */}
          <div className="filters">
            <div className="search-box">
              <input
                id={searchInputId}
                type="search"
                placeholder="Search waybill, client, plate, or stop…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery ? (
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: "12px", padding: "6px 12px" }}
                onClick={() => setSearchQuery("")}
              >
                Clear Search
              </button>
            ) : null}
          </div>

          {/* Staged Deliveries Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Waybill</th>
                  <th>Client</th>
                  <th>Plate</th>
                  <th>Temp</th>
                  <th>Revenue</th>
                  <th>Diesel</th>
                  <th>Tolls</th>
                  <th>Crew (Driver / Helper)</th>
                  <th>Stops</th>
                  <th style={{ width: "40px" }} aria-label="Row Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: "center", padding: "36px 16px", color: "var(--color-text-muted)" }}>
                      No deliveries matching current filter.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr
                      key={row.id}
                      style={{
                        background:
                          row.status === "needs_attention"
                            ? "rgba(239, 68, 68, 0.04)"
                            : row.status === "duplicate"
                              ? "rgba(255, 255, 255, 0.02)"
                              : undefined,
                      }}
                    >
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span
                            className={`pod-status ${
                              row.status === "ready"
                                ? "attached"
                                : row.status === "duplicate"
                                  ? "missing"
                                  : "pending"
                            }`}
                            style={{ width: "fit-content" }}
                          >
                            {row.status === "ready"
                              ? "Ready"
                              : row.status === "duplicate"
                                ? "Duplicate"
                                : "Needs Attention"}
                          </span>
                          {row.issues.length > 0 ? (
                            <span className="import-row-error-badge">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              {row.issues.map((i) => i.message).join(", ")}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <input
                          type="date"
                          min="2024-01-01"
                          className="import-table-input"
                          value={row.deliveryDate}
                          onChange={(e) => updateRowField(row.id, "deliveryDate", e.target.value)}
                          style={{ width: "125px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className={`import-table-input${!row.waybillNumber.trim() ? " has-error" : ""}`}
                          value={row.waybillNumber}
                          onChange={(e) => updateRowField(row.id, "waybillNumber", e.target.value)}
                          style={{
                            width: "115px",
                            fontFamily: "var(--font-mono, monospace)",
                            fontWeight: 600,
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className={`import-table-input${!row.clientName.trim() ? " has-error" : ""}`}
                          value={row.clientName}
                          onChange={(e) => updateRowField(row.id, "clientName", e.target.value)}
                          style={{ width: "135px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className={`import-table-input${!row.plateNumber.trim() ? " has-error" : ""}`}
                          value={row.plateNumber}
                          onChange={(e) => updateRowField(row.id, "plateNumber", e.target.value)}
                          style={{ width: "95px", textTransform: "uppercase", fontWeight: 600 }}
                        />
                      </td>
                      <td>
                        <select
                          className="import-table-select"
                          value={row.truckTemperature}
                          onChange={(e) =>
                            updateRowField(row.id, "truckTemperature", e.target.value as TruckTemperature)
                          }
                          style={{ width: "75px" }}
                        >
                          {DELIVERY_TEMPERATURES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          className={`import-table-input${row.deliveryRate <= 0 ? " has-error" : ""}`}
                          min="0"
                          value={row.deliveryRate || ""}
                          placeholder="0"
                          onChange={(e) => updateRowField(row.id, "deliveryRate", Number(e.target.value) || 0)}
                          style={{ width: "90px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="import-table-input"
                          min="0"
                          value={row.dieselExpenses ?? ""}
                          placeholder="Optional"
                          onChange={(e) =>
                            updateRowField(
                              row.id,
                              "dieselExpenses",
                              e.target.value !== "" ? Number(e.target.value) : null,
                            )
                          }
                          style={{ width: "80px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="import-table-input"
                          min="0"
                          value={row.tollGateExpenses ?? ""}
                          placeholder="Optional"
                          onChange={(e) =>
                            updateRowField(
                              row.id,
                              "tollGateExpenses",
                              e.target.value !== "" ? Number(e.target.value) : null,
                            )
                          }
                          style={{ width: "80px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                        />
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <input
                            type="text"
                            className="import-table-input"
                            value={row.driverName ?? ""}
                            placeholder="Driver"
                            onChange={(e) =>
                              updateRowField(row.id, "driverName", e.target.value.trim() ? e.target.value : null)
                            }
                            style={{ width: "110px", fontSize: "11px", padding: "3px 6px" }}
                          />
                          <input
                            type="text"
                            className="import-table-input"
                            value={row.helperName ?? ""}
                            placeholder="Helper"
                            onChange={(e) =>
                              updateRowField(row.id, "helperName", e.target.value.trim() ? e.target.value : null)
                            }
                            style={{ width: "110px", fontSize: "11px", padding: "3px 6px" }}
                          />
                        </div>
                      </td>
                      <td>
                        <div style={{ maxWidth: "200px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span className="routex-badge" style={{ fontSize: "10px" }}>
                              {row.dropoffs.length} {row.dropoffs.length === 1 ? "Stop" : "Stops"}
                            </span>
                          </div>
                          <span
                            style={{
                              display: "block",
                              color: "var(--color-text-muted)",
                              fontSize: "11px",
                              marginTop: "3px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={row.dropoffs.map((d) => d.storeName).join(", ")}
                          >
                            {row.dropoffs.map((d) => d.storeName).join(", ")}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="truck-action-icon-btn danger"
                          aria-label={`Remove row for waybill ${row.waybillNumber}`}
                          title="Remove staged row"
                          onClick={() => removeStagedRow(row.id)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* STEP 3: Confirm Batch */}
      {step === 3 ? (
        <section className="records-card" aria-label="Confirm Delivery Batch">
          <div className="records-heading">
            <div>
              <h2>3. Confirm Batch Import</h2>
              <p>Review the import summary before committing to RouteX records.</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setStep(2)}
                disabled={importing}
              >
                Back to Review
              </button>
              <button
                type="button"
                className="primary-action-button"
                disabled={importing || readyCount === 0}
                onClick={executeCommit}
              >
                {importing ? "Committing Batch…" : `Confirm & Commit ${readyCount} Deliveries`}
              </button>
            </div>
          </div>

          <div style={{ padding: "24px", borderTop: "1px solid var(--line)" }}>
            <div className="import-metric-grid">
              <div className="import-metric-card">
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Batch Reference</span>
                <strong style={{ fontSize: "16px", color: "var(--color-text-primary)", marginTop: "4px" }}>
                  {batchName}
                </strong>
              </div>

              <div className="import-metric-card tone-ready">
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Ready to Commit</span>
                <strong style={{ fontSize: "22px", color: "#10b981", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                  {readyCount} trips
                </strong>
              </div>

              {duplicateCount > 0 ? (
                <div className="import-metric-card tone-duplicate">
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Duplicates (Will be Skipped)</span>
                  <strong style={{ fontSize: "22px", color: "var(--color-text-muted)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                    {duplicateCount} trips
                  </strong>
                </div>
              ) : null}

              {attentionCount > 0 ? (
                <div className="import-metric-card tone-attention">
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Needs Attention (Excluded)</span>
                  <strong style={{ fontSize: "22px", color: "#ef4444", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                    {attentionCount} trips
                  </strong>
                </div>
              ) : null}
            </div>

            <div className="import-guide-card">
              <strong className="import-guide-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--color-accent)" }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Import Safety Guarantees:
              </strong>
              <ul className="import-guide-list">
                <li>Only rows marked as <strong>Ready</strong> will be committed to the database.</li>
                <li>Duplicate waybills are never overwritten, protecting existing historical delivery trips.</li>
                <li>All import events are written to the audit log under entity ID for this batch.</li>
                <li>Created delivery records are immediately reflected across RouteX dashboards, ledgers, and profitability summaries.</li>
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {/* STEP 4: Import Results */}
      {step === 4 && importResult ? (
        <section className="records-card" aria-label="Import Batch Results">
          <div className="records-heading">
            <div>
              <h2>Import Batch Completed</h2>
              <p>Batch Reference: {importResult.batchName}</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" className="secondary-button" onClick={resetImportFlow}>
                Import Another Batch
              </button>
              <Link className="primary-action-button" href="/deliveries">
                View in Deliveries →
              </Link>
            </div>
          </div>

          <div style={{ padding: "24px", borderTop: "1px solid var(--line)" }}>
            <div className="import-metric-grid">
              <div className="import-metric-card tone-ready">
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Successfully Committed</span>
                <strong style={{ fontSize: "24px", color: "#10b981", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                  {importResult.committedCount} Deliveries
                </strong>
              </div>

              {importResult.duplicateCount > 0 ? (
                <div className="import-metric-card tone-duplicate">
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Duplicate Waybills Skipped</span>
                  <strong style={{ fontSize: "24px", color: "var(--color-text-muted)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                    {importResult.duplicateCount}
                  </strong>
                </div>
              ) : null}

              {importResult.errors.length > 0 ? (
                <div className="import-metric-card tone-attention">
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Failed Records</span>
                  <strong style={{ fontSize: "24px", color: "#ef4444", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                    {importResult.errors.length}
                  </strong>
                </div>
              ) : null}
            </div>

            {/* Committed Waybill Chips */}
            {importResult.committedWaybills.length > 0 ? (
              <div style={{ marginBottom: "24px" }}>
                <strong style={{ display: "block", fontSize: "13px", marginBottom: "10px", color: "var(--color-text-primary)" }}>
                  Committed Waybill Records ({importResult.committedWaybills.length}):
                </strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {importResult.committedWaybills.map((wb) => (
                    <span key={wb} className="import-waybill-pill">
                      {wb}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Skipped / Duplicates */}
            {importResult.duplicateWaybills.length > 0 ? (
              <div style={{ marginBottom: "24px" }}>
                <strong style={{ display: "block", fontSize: "13px", marginBottom: "10px", color: "var(--color-text-muted)" }}>
                  Skipped Duplicates ({importResult.duplicateWaybills.length}):
                </strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {importResult.duplicateWaybills.map((wb) => (
                    <span key={wb} className="import-waybill-pill" style={{ opacity: 0.75 }}>
                      {wb}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Error Report Download */}
            {(importResult.duplicateCount > 0 || importResult.errors.length > 0) ? (
              <div style={{ marginTop: "20px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
                <button type="button" className="secondary-button" onClick={downloadErrorReport}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Audit / Error Report (CSV)
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
