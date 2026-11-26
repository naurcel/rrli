"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  generateImportErrorReport,
  generateSampleCsv,
  generateSampleXlsx,
  parseDeliveryImport,
  parseXlsxDeliveryImport,
  validateStagedRow,
  type StagedDeliveryRow,
} from "@/features/deliveries/delivery-import-parser";
import {
  batchUpsertBrowserPreviewDeliveries,
  deleteBrowserPreviewDeliveriesByWaybills,
  readBrowserPreviewDeliveries,
} from "@/features/deliveries/browser-preview-deliveries";
import { getFleetTrucks, type FleetTruck } from "@/features/deliveries/truck-registry";
import { getFleetCrew, type FleetCrewMember } from "@/features/deliveries/driver-registry";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";

import { ImportStepper } from "./delivery-import/import-stepper";
import { ImportStep1Select } from "./delivery-import/import-step1-select";
import { ImportStep2Review } from "./delivery-import/import-step2-review";
import { ImportStep3Confirm } from "./delivery-import/import-step3-confirm";
import { ImportStep4Results } from "./delivery-import/import-step4-results";
import { ImportUndoModal } from "./delivery-import/import-undo-modal";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

type ImportStep = 1 | 2 | 3 | 4;
type FilterTab = "all" | "ready" | "attention" | "duplicate";

export function DeliveryExcelImportClient({
  actorRoleLabel: _actorRoleLabel,
  actorFullName: _actorFullName,
  returnHref,
}: {
  actorRoleLabel: string;
  actorFullName: string;
  returnHref?: string;
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

  const [liveTrucks, setLiveTrucks] = useState<FleetTruck[]>([]);
  const [liveCrew, setLiveCrew] = useState<FleetCrewMember[]>([]);
  const [liveClients, setLiveClients] = useState<string[]>([]);

  // Step 3 Preview Table state
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState<number>(10);

  // Step 4 Undo state
  const [undoing, setUndoing] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [isUndone, setIsUndone] = useState(false);
  const [undoneCount, setUndoneCount] = useState(0);

  // Load existing waybills and live registries from server
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
          const clientNames = new Set<string>();
          for (const item of data.items) {
            if (item.waybillNumber) waybills.add(item.waybillNumber.trim().toUpperCase());
            if (item.clientName) clientNames.add(item.clientName.trim());
          }
          setExistingWaybills(waybills);
          if (clientNames.size > 0) {
            setLiveClients(Array.from(clientNames).sort());
          }
        } else {
          setExistingWaybills(waybills);
        }
      })
      .catch(() => {
        setExistingWaybills(waybills);
      });

    fetch("/api/trucks")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.trucks) && data.trucks.length > 0) {
          setLiveTrucks(data.trucks);
        }
      })
      .catch(() => {});

    fetch("/api/drivers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const crewList = data?.crew || data?.drivers;
        if (Array.isArray(crewList)) {
          setLiveCrew(crewList);
        }
      })
      .catch(() => {});
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
      toast.success("Spreadsheet parsed", {
        description: `Loaded ${result.rows.length} trips (${result.readyCount} ready for import).`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse file.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  }

  // Process binary Excel workbook into parsed rows
  function processFileBuffer(buffer: ArrayBuffer, name: string) {
    setErrorMessage(null);
    setFileName(name);

    try {
      const result = parseXlsxDeliveryImport(buffer, existingWaybills);
      if (result.errors.length > 0 && result.rows.length === 0) {
        setErrorMessage(result.errors.join(". "));
        return;
      }
      if (result.rows.length === 0) {
        setErrorMessage("No valid delivery trip records could be found in the uploaded Excel file.");
        return;
      }

      setStagedRows(result.rows);
      setStep(2);
      toast.success("Excel workbook parsed", {
        description: `Loaded ${result.rows.length} trips (${result.readyCount} ready for import).`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse Excel spreadsheet.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  }

  function handleFileSelected(file: File) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage("File exceeds the maximum allowed size of 10MB.");
      return;
    }

    const cleanBaseName = file.name.replace(/\.[^/.]+$/, "");
    setBatchName(`DTR-${cleanBaseName}`);

    const isExcel = /\.xlsx?$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result;
        if (buffer instanceof ArrayBuffer) {
          processFileBuffer(buffer, file.name);
        }
      };
      reader.onerror = () => {
        setErrorMessage("Unable to read the uploaded Excel file.");
      };
      reader.readAsArrayBuffer(file);
    } else {
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

  function downloadXlsxTemplate() {
    const bytes = generateSampleXlsx();
    const blob = new Blob([bytes as unknown as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "routex_daily_trip_report_template.xlsx");
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
        const { status, issues } = validateStagedRow(modified, existingWaybills);
        return { ...modified, status, issues };
      });
      return updated;
    });
  }

  function removeStagedRow(id: string) {
    setStagedRows((current) => current.filter((r) => r.id !== id));
  }

  function autoGenerateMissingWaybills() {
    setStagedRows((current) => {
      const seen = new Set<string>();
      for (const r of current) {
        if (r.waybillNumber.trim()) seen.add(r.waybillNumber.trim().toUpperCase());
      }
      return current.map((row) => {
        if (row.waybillNumber.trim()) return row;
        const cleanPlate = (row.plateNumber || "TRIP").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const yymmdd = (row.deliveryDate || new Date().toISOString().slice(0, 10)).replace(/-/g, "").slice(2);
        const base = `WB-${yymmdd}-${cleanPlate || `ROW${row.rowNumber}`}`;
        let candidate = base;
        let counter = 2;
        while (seen.has(candidate.toUpperCase()) || existingWaybills.has(candidate.toUpperCase())) {
          candidate = `${base}-${counter++}`;
        }
        seen.add(candidate.toUpperCase());
        const modified = { ...row, waybillNumber: candidate };
        const { status, issues, expectedCompletionStatus } = validateStagedRow(modified, existingWaybills);
        return { ...modified, status, issues, expectedCompletionStatus };
      });
    });
    toast.success("Generated waybills for trips missing waybills.");
  }

  // Filtered rows for Step 2
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredPreviewSearch = useDeferredValue(previewSearch);

  const visibleRows = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return stagedRows.filter((r) => {
      if (activeTab === "ready" && r.status !== "ready") return false;
      if (activeTab === "attention" && r.status !== "needs_attention") return false;
      if (activeTab === "duplicate" && r.status !== "duplicate") return false;

      if (q) {
        const matchesWb = r.waybillNumber.toLowerCase().includes(q);
        const matchesClient = r.clientName.toLowerCase().includes(q);
        const matchesPlate = r.plateNumber.toLowerCase().includes(q);
        const matchesStore = r.dropoffs.some((d) => d.storeName.toLowerCase().includes(q));
        return matchesWb || matchesClient || matchesPlate || matchesStore;
      }

      return true;
    });
  }, [stagedRows, activeTab, deferredSearchQuery]);

  const {
    readyRows,
    readyCount,
    attentionCount,
    duplicateCount,
    readyOwnedCount,
    readySubconCount,
    readyNewTrucksCount,
    readyMatchedTrucksCount,
    readyAutoCompletedCount,
    missingWaybillCount,
  } = useMemo(() => {
    const ready: StagedDeliveryRow[] = [];
    let attention = 0;
    let duplicate = 0;
    let owned = 0;
    let subcon = 0;
    let newTrucks = 0;
    let matchedTrucks = 0;
    let autoCompleted = 0;
    let missingWb = 0;

    for (const r of stagedRows) {
      if (!r.waybillNumber.trim()) missingWb++;
      if (r.status === "ready") {
        ready.push(r);
        if (r.truckOwnership === "Owned") owned++;
        if (r.truckOwnership === "Subcontracted") subcon++;
        if (r.isNewTruck) newTrucks++;
        else matchedTrucks++;
        if (r.expectedCompletionStatus === "Completed") autoCompleted++;
      } else if (r.status === "needs_attention") {
        attention++;
      } else if (r.status === "duplicate") {
        duplicate++;
      }
    }

    return {
      readyRows: ready,
      readyCount: ready.length,
      attentionCount: attention,
      duplicateCount: duplicate,
      readyOwnedCount: owned,
      readySubconCount: subcon,
      readyNewTrucksCount: newTrucks,
      readyMatchedTrucksCount: matchedTrucks,
      readyAutoCompletedCount: autoCompleted,
      missingWaybillCount: missingWb,
    };
  }, [stagedRows]);

  // Step 3 preview table filtering and pagination
  const filteredReadyRows = useMemo(() => {
    const q = deferredPreviewSearch.trim().toLowerCase();
    if (!q) return readyRows;
    return readyRows.filter((r) => {
      const stops = r.dropoffs.map((d) => d.storeName).join(" ").toLowerCase();
      return (
        r.waybillNumber.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        r.plateNumber.toLowerCase().includes(q) ||
        (r.driverName ?? "").toLowerCase().includes(q) ||
        (r.helperName ?? "").toLowerCase().includes(q) ||
        stops.includes(q)
      );
    });
  }, [readyRows, deferredPreviewSearch]);

  const totalPreviewPages = Math.ceil(filteredReadyRows.length / previewPageSize) || 1;
  const paginatedReadyRows = useMemo(() => {
    const start = (previewPage - 1) * previewPageSize;
    return filteredReadyRows.slice(start, start + previewPageSize);
  }, [filteredReadyRows, previewPage, previewPageSize]);

  async function executeCommit() {
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
        rows: readyRows.map((r) => {
          const isSubcon = r.truckOwnership === "Subcontracted";
          return {
            waybillNumber: r.waybillNumber,
            deliveryDate: r.deliveryDate,
            clientName: r.clientName,
            plateNumber: r.plateNumber,
            truckType: r.truckType || "6-Wheeler",
            truckOwnership: r.truckOwnership || "Owned",
            truckTemperature: r.truckTemperature,
            origin: r.origin || "Central Depot",
            distanceKm: r.distanceKm || 50,
            fuelRate: r.fuelRate || 85,
            deliveryRate: r.deliveryRate,
            totalExpenses: r.totalExpenses,
            dieselExpenses: isSubcon ? null : r.dieselExpenses,
            dieselExpensesStatus: isSubcon ? "not_applicable" : (r.dieselExpenses != null ? "confirmed" : "not_applicable"),
            tollGateExpenses: isSubcon ? null : r.tollGateExpenses,
            tollGateExpensesStatus: isSubcon ? "not_applicable" : (r.tollGateExpenses != null ? "confirmed" : "not_applicable"),
            tollGateBreakdown: isSubcon ? "" : (r.tollGateBreakdown || ""),
            driverDailyRate: isSubcon ? null : r.driverDailyRate,
            driverDailyRateStatus: isSubcon ? "not_applicable" : (r.driverDailyRate != null ? "confirmed" : "not_applicable"),
            driverAllowance: isSubcon ? null : r.driverAllowance,
            driverAllowanceStatus: isSubcon ? "not_applicable" : (r.driverAllowance != null ? "confirmed" : "not_applicable"),
            driverName: r.driverName,
            helperDailyRate: isSubcon ? null : r.helperDailyRate,
            helperDailyRateStatus: isSubcon ? "not_applicable" : (r.helperDailyRate != null ? "confirmed" : "not_applicable"),
            helperAllowance: isSubcon ? null : r.helperAllowance,
            helperAllowanceStatus: isSubcon ? "not_applicable" : (r.helperAllowance != null ? "confirmed" : "not_applicable"),
            helperName: r.helperName,
            otherExpenses: isSubcon ? (r.totalExpenses ?? r.otherExpenses ?? 0) : r.otherExpenses,
            otherExpensesStatus: isSubcon ? "confirmed" : (r.otherExpenses != null ? "confirmed" : "not_applicable"),
            entryFees: r.entryFees ?? null,
            entryFeesStatus: r.entryFees != null ? "confirmed" : "not_applicable",
            dropoffs: r.dropoffs.map((d) => ({
              storeName: d.storeName,
              destinationArea: d.destinationArea,
              dropoffCount: d.dropoffCount || 1,
              entryFee: d.entryFee,
              entryFeeStatus: d.entryFee != null ? "confirmed" : "not_applicable",
              podSubmitted: true,
              supportingDocsComplete: true,
              documentRef: "Imported from spreadsheet",
            })),
          };
        }),
      };

      const res = await fetch("/api/deliveries/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Server rejected the import payload.");
      }

      // Mirror to browser-preview in a single atomic batch write so local view stays responsive
      const previewItems: DeliveryLedgerItem[] = readyRows.map((row) => {
        const isSubcon = row.truckOwnership === "Subcontracted";
        const expenses = {
          dieselExpenses: isSubcon ? null : row.dieselExpenses,
          tollGateExpenses: isSubcon ? null : row.tollGateExpenses,
          tollGateBreakdown: isSubcon ? "" : (row.tollGateBreakdown || ""),
          entryFees: row.entryFees ?? null,
          driverAllowance: isSubcon ? null : row.driverAllowance,
          driverDailyRate: isSubcon ? null : row.driverDailyRate,
          helperAllowance: isSubcon ? null : row.helperAllowance,
          helperDailyRate: isSubcon ? null : row.helperDailyRate,
          otherExpenses: isSubcon ? (row.totalExpenses ?? row.otherExpenses ?? 0) : row.otherExpenses,
        };
        const expenseStates = {
          dieselExpenses: isSubcon ? ("not_applicable" as const) : (row.dieselExpenses != null ? ("confirmed" as const) : ("not_applicable" as const)),
          tollGateExpenses: isSubcon ? ("not_applicable" as const) : (row.tollGateExpenses != null ? ("confirmed" as const) : ("not_applicable" as const)),
          entryFees: row.entryFees != null ? ("confirmed" as const) : ("not_applicable" as const),
          driverAllowance: isSubcon ? ("not_applicable" as const) : (row.driverAllowance != null ? ("confirmed" as const) : ("not_applicable" as const)),
          driverDailyRate: isSubcon ? ("not_applicable" as const) : (row.driverDailyRate != null ? ("confirmed" as const) : ("not_applicable" as const)),
          helperAllowance: isSubcon ? ("not_applicable" as const) : (row.helperAllowance != null ? ("confirmed" as const) : ("not_applicable" as const)),
          helperDailyRate: isSubcon ? ("not_applicable" as const) : (row.helperDailyRate != null ? ("confirmed" as const) : ("not_applicable" as const)),
          otherExpenses: isSubcon ? ("confirmed" as const) : (row.otherExpenses != null ? ("confirmed" as const) : ("not_applicable" as const)),
        };
        const totalExpenses = row.totalExpenses ?? 0;
        const netIncome = row.deliveryRate - totalExpenses;
        const marginPercent = row.deliveryRate > 0 ? (netIncome / row.deliveryRate) * 100 : null;

        return {
          id: `preview-dtr-${row.waybillNumber}`,
          clientId: row.clientName,
          truckId: row.plateNumber,
          deliveryDate: row.deliveryDate,
          clientName: row.clientName,
          plateNumber: row.plateNumber,
          driverName: row.driverName ?? "Assigned Fleet Driver",
          helperName: row.helperName,
          truckType: (row.truckType as any) || "6-Wheeler",
          truckOwnership: (row.truckOwnership as any) || "Owned",
          truckTemperature: row.truckTemperature,
          waybillNumber: row.waybillNumber,
          deliveryStatus: row.expectedCompletionStatus || "In Transit",
          dropoffs: row.dropoffs.map((d, idx) => ({
            id: `dtr-drop-${row.waybillNumber}-${idx}`,
            sequence: idx + 1,
            storeName: d.storeName,
            destinationArea: d.destinationArea,
            dropoffCount: d.dropoffCount || 1,
            entryFee: d.entryFee,
            entryFeeStatus: d.entryFee != null ? "confirmed" : "not_applicable",
            podSubmitted: true,
            supportingDocsComplete: true,
            documentRef: "Imported from spreadsheet",
          })),
          rateBasis: "Redeemed Rate",
          origin: row.origin || "Central Depot",
          distanceKm: row.distanceKm || 50,
          fuelRate: row.fuelRate || 85,
          deliveryRate: row.deliveryRate,
          expenses,
          expenseStates,
          totalExpenses,
          netIncome,
          marginPercent,
          financialState: row.totalExpenses != null && row.deliveryRate > 0 ? "finalized" : "incomplete",
          financialIntegrityIssues: [],
          version: 1,
          podStatus: "Verified",
          notes: `Batch Reference: ${batchName}`,
        };
      });
      batchUpsertBrowserPreviewDeliveries(previewItems);

      setImportResult({
        batchName,
        committedCount: data.committedCount ?? readyRows.length,
        committedWaybills: data.committedWaybills ?? readyRows.map((r) => r.waybillNumber),
        duplicateCount: data.duplicateCount ?? 0,
        duplicateWaybills: data.duplicateWaybills ?? [],
        errors: data.errors ?? [],
      });

      toast.success("Import completed!", {
        description: `Committed ${data.committedCount ?? 0} deliveries to RouteX ledger.`,
      });

      setStep(4);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to commit import batch.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  }

  async function handleUndoImport() {
    if (!importResult || importResult.committedWaybills.length === 0) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/deliveries/import/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchName: importResult.batchName,
          waybillNumbers: importResult.committedWaybills,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Failed to undo import batch.");
      }

      deleteBrowserPreviewDeliveriesByWaybills(importResult.committedWaybills);

      setIsUndone(true);
      setUndoneCount(data.removedCount ?? importResult.committedWaybills.length);
      setShowUndoConfirm(false);

      toast.success("Import batch undone!", {
        description: `Successfully removed ${data.removedCount ?? importResult.committedWaybills.length} deliveries from RouteX ledger.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to undo import batch.";
      toast.error(msg);
    } finally {
      setUndoing(false);
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
    setPreviewSearch("");
    setPreviewPage(1);
    setIsUndone(false);
    setUndoneCount(0);
    setShowUndoConfirm(false);
  }

  return (
    <>
      {/* Workflow Step Indicator */}
      <ImportStepper step={step} />

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
        <ImportStep1Select
          batchName={batchName}
          isDragging={isDragging}
          onBatchNameChange={setBatchName}
          setIsDragging={setIsDragging}
          onDrop={handleDrop}
          onFileInputChange={handleFileInputChange}
          onDownloadXlsxTemplate={downloadXlsxTemplate}
          onDownloadCsvTemplate={downloadCsvTemplate}
          onLoadSampleData={loadSampleData}
        />
      ) : null}

      {/* STEP 2: Preview & Validate */}
      {step === 2 ? (
        <ImportStep2Review
          stagedRows={stagedRows}
          fileName={fileName}
          missingWaybillCount={missingWaybillCount}
          readyCount={readyCount}
          attentionCount={attentionCount}
          duplicateCount={duplicateCount}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onAutoGenerateMissingWaybills={autoGenerateMissingWaybills}
          onReplaceFile={() => setStep(1)}
          onProceed={() => setStep(3)}
          visibleRows={visibleRows}
          updateRowField={updateRowField}
          removeStagedRow={removeStagedRow}
          liveClients={liveClients}
          liveTrucks={liveTrucks}
          liveCrew={liveCrew}
        />
      ) : null}

      {/* STEP 3: Confirm Batch */}
      {step === 3 ? (
        <ImportStep3Confirm
          batchName={batchName}
          readyCount={readyCount}
          readyOwnedCount={readyOwnedCount}
          readySubconCount={readySubconCount}
          readyMatchedTrucksCount={readyMatchedTrucksCount}
          readyNewTrucksCount={readyNewTrucksCount}
          readyAutoCompletedCount={readyAutoCompletedCount}
          duplicateCount={duplicateCount}
          attentionCount={attentionCount}
          importing={importing}
          onBack={() => setStep(2)}
          onCommit={executeCommit}
          filteredReadyRows={filteredReadyRows}
          paginatedReadyRows={paginatedReadyRows}
          previewSearch={previewSearch}
          onPreviewSearchChange={(q) => {
            setPreviewSearch(q);
            setPreviewPage(1);
          }}
          previewPage={previewPage}
          onPreviewPageChange={setPreviewPage}
          previewPageSize={previewPageSize}
          onPreviewPageSizeChange={(sz) => {
            setPreviewPageSize(sz);
            setPreviewPage(1);
          }}
          totalPreviewPages={totalPreviewPages}
        />
      ) : null}

      {/* STEP 4: Import Results */}
      {step === 4 && importResult ? (
        <ImportStep4Results
          importResult={importResult}
          isUndone={isUndone}
          undoneCount={undoneCount}
          undoing={undoing}
          returnHref={returnHref}
          onUndoClick={() => setShowUndoConfirm(true)}
          onReset={resetImportFlow}
          onDownloadErrorReport={downloadErrorReport}
        />
      ) : null}

      {/* Undo Confirmation Modal */}
      {importResult ? (
        <ImportUndoModal
          isOpen={showUndoConfirm}
          batchName={importResult.batchName}
          committedCount={importResult.committedCount}
          undoing={undoing}
          onCancel={() => setShowUndoConfirm(false)}
          onConfirm={handleUndoImport}
        />
      ) : null}
    </>
  );
}
