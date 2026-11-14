"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import type { TruckTemperature } from "@/features/deliveries/delivery-domain";
import {
  generateImportErrorReport,
  generateSampleCsv,
  parseDeliveryImport,
  validateStagedRow,
  type ImportParseResult,
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
  const [rawText, setRawText] = useState<string>("");
  const [stagedRows, setStagedRows] = useState<StagedDeliveryRow[]>([]);
  const [parseSummary, setParseSummary] = useState<Omit<ImportParseResult, "rows"> | null>(null);
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
    setRawText(content);

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
      setParseSummary({
        totalRawRows: result.totalRawRows,
        totalGroupedDeliveries: result.totalGroupedDeliveries,
        readyCount: result.readyCount,
        attentionCount: result.attentionCount,
        duplicateCount: result.duplicateCount,
        errors: result.errors,
      });
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

      // Update summary counts
      const ready = updated.filter((r) => r.status === "ready").length;
      const attention = updated.filter((r) => r.status === "needs_attention").length;
      const dupes = updated.filter((r) => r.status === "duplicate").length;

      setParseSummary((prev) =>
        prev
          ? {
              ...prev,
              readyCount: ready,
              attentionCount: attention,
              duplicateCount: dupes,
            }
          : null,
      );

      return updated;
    });
  }

  function removeStagedRow(id: string) {
    setStagedRows((current) => {
      const next = current.filter((r) => r.id !== id);
      const ready = next.filter((r) => r.status === "ready").length;
      const attention = next.filter((r) => r.status === "needs_attention").length;
      const dupes = next.filter((r) => r.status === "duplicate").length;

      setParseSummary((prev) =>
        prev
          ? {
              ...prev,
              totalGroupedDeliveries: next.length,
              readyCount: ready,
              attentionCount: attention,
              duplicateCount: dupes,
            }
          : null,
      );

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
    setRawText("");
    setStagedRows([]);
    setParseSummary(null);
    setErrorMessage(null);
    setImportResult(null);
    setActiveTab("all");
    setSearchQuery("");
  }

  return (
    <>
      {/* Workflow Step Indicator */}
      <nav aria-label="Import Workflow Steps" style={{ marginBottom: "20px" }}>
        <ol
          style={{
            display: "flex",
            gap: "12px",
            listStyle: "none",
            padding: 0,
            margin: 0,
            fontSize: "13px",
            color: "var(--muted)",
          }}
        >
          <li style={{ fontWeight: step === 1 ? 600 : 400, color: step === 1 ? "var(--ink)" : undefined }}>
            1. Select File
          </li>
          <li aria-hidden="true">›</li>
          <li style={{ fontWeight: step === 2 ? 600 : 400, color: step === 2 ? "var(--ink)" : undefined }}>
            2. Preview & Validate
          </li>
          <li aria-hidden="true">›</li>
          <li style={{ fontWeight: step === 3 ? 600 : 400, color: step === 3 ? "var(--ink)" : undefined }}>
            3. Confirm Batch
          </li>
          <li aria-hidden="true">›</li>
          <li style={{ fontWeight: step === 4 ? 600 : 400, color: step === 4 ? "var(--ink)" : undefined }}>
            4. Import Results
          </li>
        </ol>
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
                Download CSV Template
              </button>
              <button type="button" className="secondary-button" onClick={loadSampleData}>
                Load Sample DTR Rows
              </button>
            </div>
          </div>

          <div style={{ padding: "24px", borderTop: "1px solid var(--line)" }}>
            <div style={{ marginBottom: "20px", maxWidth: "480px" }}>
              <label
                htmlFor="import-batch-name"
                style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}
              >
                Batch Reference Name
              </label>
              <input
                id="import-batch-name"
                type="text"
                className="base-input"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. DTR-Batch-2026-11-01"
                style={{ width: "100%" }}
              />
            </div>

            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 24px",
                border: "2px dashed var(--line)",
                borderRadius: "12px",
                background: "var(--color-surface)",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--muted)", marginBottom: "12px" }}
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="12" y2="12" />
                <line x1="15" y1="15" x2="12" y2="12" />
              </svg>
              <strong style={{ fontSize: "14px", color: "var(--ink)", marginBottom: "4px" }}>
                Click to browse or drag and drop your spreadsheet
              </strong>
              <small style={{ color: "var(--muted)", fontSize: "12px" }}>
                Supports standard CSV, TSV, and delimited text files up to 10MB.
              </small>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileInputChange}
                style={{ display: "none" }}
              />
            </label>

            <div
              style={{
                marginTop: "24px",
                padding: "16px 20px",
                borderRadius: "8px",
                background: "var(--color-surface)",
                border: "1px solid var(--line)",
                fontSize: "12px",
                color: "var(--muted)",
                lineHeight: "1.6",
              }}
            >
              <strong style={{ display: "block", color: "var(--ink)", marginBottom: "6px" }}>
                Import Requirements & Multi-Stop Grouping:
              </strong>
              <ul style={{ margin: 0, paddingLeft: "20px" }}>
                <li>Required columns: Waybill Number, Delivery Date (2024 or later), Client Name, Truck Plate, Temperature, Delivery Rate/Revenue, and at least one Store Stop.</li>
                <li>Multiple stops for the same trip should repeat the same Waybill Number with different store stops. They will automatically be grouped into a single delivery.</li>
                <li>Existing waybills in the system are safely detected to prevent duplicate record insertion.</li>
                <li>Financial values and trip details are strictly validated; missing rates will not be silently replaced with dummy values.</li>
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
                    <td colSpan={12} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
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
                              ? "rgba(107, 114, 128, 0.04)"
                              : undefined,
                      }}
                    >
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
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
                            <small
                              style={{
                                color: "var(--color-critical, #dc2626)",
                                fontSize: "11px",
                                lineHeight: "1.2",
                                marginTop: "2px",
                              }}
                            >
                              {row.issues.map((i) => i.message).join(", ")}
                            </small>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <input
                          type="date"
                          min="2024-01-01"
                          className="base-input"
                          value={row.deliveryDate}
                          onChange={(e) => updateRowField(row.id, "deliveryDate", e.target.value)}
                          style={{ fontSize: "12px", padding: "4px 6px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="base-input"
                          value={row.waybillNumber}
                          onChange={(e) => updateRowField(row.id, "waybillNumber", e.target.value)}
                          style={{
                            fontSize: "12px",
                            padding: "4px 6px",
                            width: "120px",
                            borderColor: !row.waybillNumber.trim() ? "var(--color-critical, #dc2626)" : undefined,
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="base-input"
                          value={row.clientName}
                          onChange={(e) => updateRowField(row.id, "clientName", e.target.value)}
                          style={{
                            fontSize: "12px",
                            padding: "4px 6px",
                            width: "130px",
                            borderColor: !row.clientName.trim() ? "var(--color-critical, #dc2626)" : undefined,
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="base-input"
                          value={row.plateNumber}
                          onChange={(e) => updateRowField(row.id, "plateNumber", e.target.value)}
                          style={{
                            fontSize: "12px",
                            padding: "4px 6px",
                            width: "95px",
                            borderColor: !row.plateNumber.trim() ? "var(--color-critical, #dc2626)" : undefined,
                          }}
                        />
                      </td>
                      <td>
                        <select
                          className="base-input"
                          value={row.truckTemperature}
                          onChange={(e) =>
                            updateRowField(row.id, "truckTemperature", e.target.value as TruckTemperature)
                          }
                          style={{ fontSize: "12px", padding: "4px 6px" }}
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
                          className="base-input"
                          min="0"
                          value={row.deliveryRate || ""}
                          placeholder="0"
                          onChange={(e) => updateRowField(row.id, "deliveryRate", Number(e.target.value) || 0)}
                          style={{
                            fontSize: "12px",
                            padding: "4px 6px",
                            width: "90px",
                            borderColor: row.deliveryRate <= 0 ? "var(--color-critical, #dc2626)" : undefined,
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="base-input"
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
                          style={{ fontSize: "12px", padding: "4px 6px", width: "80px" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="base-input"
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
                          style={{ fontSize: "12px", padding: "4px 6px", width: "80px" }}
                        />
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <input
                            type="text"
                            className="base-input"
                            value={row.driverName ?? ""}
                            placeholder="Driver"
                            onChange={(e) =>
                              updateRowField(row.id, "driverName", e.target.value.trim() ? e.target.value : null)
                            }
                            style={{ fontSize: "11px", padding: "2px 6px", width: "110px" }}
                          />
                          <input
                            type="text"
                            className="base-input"
                            value={row.helperName ?? ""}
                            placeholder="Helper"
                            onChange={(e) =>
                              updateRowField(row.id, "helperName", e.target.value.trim() ? e.target.value : null)
                            }
                            style={{ fontSize: "11px", padding: "2px 6px", width: "110px" }}
                          />
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: "12px", maxWidth: "200px" }}>
                          <strong style={{ display: "block" }}>
                            {row.dropoffs.length} {row.dropoffs.length === 1 ? "Stop" : "Stops"}
                          </strong>
                          <span style={{ color: "var(--muted)", fontSize: "11px" }}>
                            {row.dropoffs.map((d) => d.storeName).join(", ")}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="row-action-btn"
                          aria-label={`Remove row for waybill ${row.waybillNumber}`}
                          title="Remove row"
                          onClick={() => removeStagedRow(row.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--muted)",
                            cursor: "pointer",
                            padding: "4px",
                          }}
                        >
                          ✕
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "var(--color-surface)",
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>Batch Reference</div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--ink)", marginTop: "4px" }}>
                  {batchName}
                </div>
              </div>

              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "var(--color-surface)",
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>Ready to Commit</div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "var(--color-positive, #16a34a)",
                    marginTop: "4px",
                  }}
                >
                  {readyCount} trips
                </div>
              </div>

              {duplicateCount > 0 ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: "var(--color-surface)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Duplicates (Will be Skipped)</div>
                  <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--muted)", marginTop: "4px" }}>
                    {duplicateCount} trips
                  </div>
                </div>
              ) : null}

              {attentionCount > 0 ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: "var(--color-surface)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Needs Attention (Excluded)</div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: 600,
                      color: "var(--color-critical, #dc2626)",
                      marginTop: "4px",
                    }}
                  >
                    {attentionCount} trips
                  </div>
                </div>
              ) : null}
            </div>

            <div
              style={{
                padding: "16px 20px",
                borderRadius: "8px",
                background: "var(--color-surface)",
                border: "1px solid var(--line)",
                fontSize: "13px",
                lineHeight: "1.6",
                color: "var(--ink)",
              }}
            >
              <strong style={{ display: "block", marginBottom: "6px" }}>Import Safety Guarantees:</strong>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--muted)", fontSize: "12px" }}>
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  background: "rgba(22, 163, 74, 0.06)",
                  border: "1px solid rgba(22, 163, 74, 0.2)",
                }}
              >
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>Successfully Committed</div>
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: 600,
                    color: "var(--color-positive, #16a34a)",
                    marginTop: "4px",
                  }}
                >
                  {importResult.committedCount} Deliveries
                </div>
              </div>

              {importResult.duplicateCount > 0 ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: "var(--color-surface)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Duplicate Waybills Skipped</div>
                  <div style={{ fontSize: "22px", fontWeight: 600, color: "var(--muted)", marginTop: "4px" }}>
                    {importResult.duplicateCount}
                  </div>
                </div>
              ) : null}

              {importResult.errors.length > 0 ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: "rgba(220, 38, 38, 0.06)",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Failed Records</div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 600,
                      color: "var(--color-critical, #dc2626)",
                      marginTop: "4px",
                    }}
                  >
                    {importResult.errors.length}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Committed Waybill Chips */}
            {importResult.committedWaybills.length > 0 ? (
              <div style={{ marginBottom: "24px" }}>
                <strong style={{ display: "block", fontSize: "13px", marginBottom: "8px", color: "var(--ink)" }}>
                  Committed Waybill Records:
                </strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {importResult.committedWaybills.map((wb) => (
                    <span
                      key={wb}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: "var(--color-surface)",
                        border: "1px solid var(--line)",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        color: "var(--ink)",
                      }}
                    >
                      {wb}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Skipped / Duplicates */}
            {importResult.duplicateWaybills.length > 0 ? (
              <div style={{ marginBottom: "24px" }}>
                <strong style={{ display: "block", fontSize: "13px", marginBottom: "8px", color: "var(--muted)" }}>
                  Skipped Duplicates:
                </strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {importResult.duplicateWaybills.map((wb) => (
                    <span
                      key={wb}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: "var(--color-surface)",
                        border: "1px solid var(--line)",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        color: "var(--muted)",
                      }}
                    >
                      {wb}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Error Report Download */}
            {(importResult.duplicateCount > 0 || importResult.errors.length > 0) ? (
              <div style={{ marginTop: "16px" }}>
                <button type="button" className="secondary-button" onClick={downloadErrorReport}>
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
