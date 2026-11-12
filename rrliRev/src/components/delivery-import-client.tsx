"use client";

import Link from "next/link";
import { useState } from "react";
import type { TruckTemperature } from "@/features/deliveries/delivery-domain";

type ParsedImportRow = {
  id: string;
  waybillNumber: string;
  deliveryDate: string;
  clientName: string;
  plateNumber: string;
  truckTemperature: TruckTemperature;
  origin: string;
  distanceKm: number;
  fuelRate: number;
  deliveryRate: number;
  dieselExpenses: number | null;
  tollGateExpenses: number | null;
  driverDailyRate: number | null;
  driverAllowance: number | null;
  helperDailyRate: number | null;
  helperAllowance: number | null;
  otherExpenses: number | null;
  dropoffs: {
    storeName: string;
    destinationArea: string;
    entryFee: number | null;
  }[];
  isValid: boolean;
  validationIssue?: string;
};

const SAMPLE_CSV_DATA = `Delivery Date,Waybill Number,Client Name,Truck Plate,Temperature,Origin,Distance Km,Fuel Rate,Delivery Rate,Diesel,Tolls,Driver Rate,Driver Allowance,Helper Rate,Helper Allowance,Store Name,Destination Area,Entry Fee
2026-11-01,WB-2611-9001,Landers,NGS 4281,-18°C,Marilao Depot,85,85.5,23000,3800,950,950,300,700,200,Landers Balintawak,Quezon City,150
2026-11-01,WB-2611-9002,Manila Comisario Central Inc. (MCCI),NFO 8324,4°C,FTI Taguig Hub,110,84.0,26500,4200,1200,1000,350,750,250,MCCI Alabang Center,Muntinlupa,0
2026-11-02,WB-2611-9003,Vanguard,CBC 5519,20°C,North Harbor Terminal,65,86.5,19500,2900,450,900,250,650,200,Vanguard Pasig Hub,Pasig City,100`;

const DELIVERY_TEMPERATURES: readonly TruckTemperature[] = [
  "-20°C",
  "-18°C",
  "0°C",
  "2°C",
  "4°C",
  "20°C",
];

type ImportIconName = "arrow" | "check" | "download" | "sample" | "spreadsheet" | "warning";

function ImportIcon({ name, className = "" }: { name: ImportIconName; className?: string }) {
  return (
    <svg
      className={`import-vector-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {name === "download" ? (
        <>
          <path d="M12 3v11" />
          <path d="m8 10 4 4 4-4" />
          <path d="M5 18h14v3H5z" />
        </>
      ) : name === "sample" ? (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 9h8M8 13h5M8 17h7" />
        </>
      ) : name === "spreadsheet" ? (
        <>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v5h4M9 12h7M9 16h7M12 10v8" />
        </>
      ) : name === "check" ? (
        <path d="m5 12 4 4L19 6" />
      ) : name === "warning" ? (
        <>
          <path d="M12 3 2.8 20h18.4z" />
          <path d="M12 9v5M12 17.5v.1" />
        </>
      ) : (
        <>
          <path d="M5 12h14" />
          <path d="m14 7 5 5-5 5" />
        </>
      )}
    </svg>
  );
}

export function DeliveryExcelImportClient({
  actorRoleLabel: _actorRoleLabel,
  actorFullName: _actorFullName,
}: {
  actorRoleLabel: string;
  actorFullName: string;
}) {
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [batchName, setBatchName] = useState(`DTR-Batch-${new Date().toISOString().slice(0, 10)}`);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    committedCount: number;
    duplicateCount: number;
    committedWaybills: string[];
    duplicateWaybills: string[];
    errors: { waybill: string; reason: string }[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function parseCsvContent(text: string) {
    setErrorMessage(null);
    setImportResult(null);

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      setErrorMessage("Spreadsheet must contain a header row and at least one data row.");
      return;
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const dateIdx = header.findIndex((h) => h.includes("date"));
    const wbIdx = header.findIndex((h) => h.includes("waybill"));
    const clientIdx = header.findIndex((h) => h.includes("client"));
    const plateIdx = header.findIndex((h) => h.includes("plate") || h.includes("truck"));
    const temperatureIdx = header.findIndex((h) => h.includes("temperature") || h === "temp");
    const rateIdx = header.findIndex((h) => h.includes("rate") || h.includes("revenue") || h.includes("earnings"));
    const dieselIdx = header.findIndex((h) => h.includes("diesel"));
    const tollIdx = header.findIndex((h) => h.includes("toll"));
    const storeIdx = header.findIndex((h) => h.includes("store"));
    const areaIdx = header.findIndex((h) => h.includes("area") || h.includes("destination"));
    const feeIdx = header.findIndex((h) => h.includes("entry") || h.includes("fee"));

    const parsed: ParsedImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      if (cols.length < 4) continue;

      const waybillNumber = wbIdx >= 0 ? cols[wbIdx] : `WB-${Date.now().toString().slice(-6)}`;
      const deliveryDate = dateIdx >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(cols[dateIdx]) ? cols[dateIdx] : new Date().toISOString().slice(0, 10);
      const clientName = clientIdx >= 0 && cols[clientIdx] ? cols[clientIdx] : "Landers";
      const plateNumber = plateIdx >= 0 && cols[plateIdx] ? cols[plateIdx] : "NGS 4281";
      const rawTemperature = temperatureIdx >= 0 ? cols[temperatureIdx].trim() : "";
      const match = rawTemperature.match(/^(-?\d+(?:\.\d+)?)/);
      const truckTemperature: TruckTemperature = match
        ? (`${match[1]}°C` as TruckTemperature)
        : "-18°C";
      const deliveryRate = rateIdx >= 0 ? Number(cols[rateIdx]) || 20000 : 20000;
      const dieselExpenses = dieselIdx >= 0 && cols[dieselIdx] ? Number(cols[dieselIdx]) || null : 3500;
      const tollGateExpenses = tollIdx >= 0 && cols[tollIdx] ? Number(cols[tollIdx]) || null : 800;
      const storeName = storeIdx >= 0 && cols[storeIdx] ? cols[storeIdx] : "Store Stop 1";
      const destinationArea = areaIdx >= 0 && cols[areaIdx] ? cols[areaIdx] : "Metro Manila";
      const entryFee = feeIdx >= 0 && cols[feeIdx] ? Number(cols[feeIdx]) || null : 0;

      const isDateValid = Boolean(deliveryDate && deliveryDate >= "2024-01-01");
      const isValid = Boolean(waybillNumber && isDateValid && clientName && plateNumber && deliveryRate > 0);
      const validationIssue = !waybillNumber
        ? "Waybill number required"
        : !isDateValid
          ? "Date prior to company start (2024)"
          : deliveryRate <= 0
            ? "Delivery revenue must be positive"
            : undefined;

      parsed.push({
        id: `row-${i}-${Date.now().toString(36)}`,
        waybillNumber,
        deliveryDate,
        clientName,
        plateNumber,
        truckTemperature,
        origin: "Main Hub",
        distanceKm: 75,
        fuelRate: 85.0,
        deliveryRate,
        dieselExpenses,
        tollGateExpenses,
        driverDailyRate: 950,
        driverAllowance: 300,
        helperDailyRate: 700,
        helperAllowance: 200,
        otherExpenses: 0,
        dropoffs: [
          {
            storeName,
            destinationArea,
            entryFee,
          },
        ],
        isValid,
        validationIssue,
      });
    }

    if (parsed.length === 0) {
      setErrorMessage("No valid delivery rows could be extracted from this spreadsheet.");
      return;
    }

    setRows(parsed);
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBatchName(file.name.replace(/\.[^/.]+$/, ""));

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        parseCsvContent(text);
      }
    };
    reader.onerror = () => {
      setErrorMessage("Failed to read the selected file.");
    };
    reader.readAsText(file);
  }

  function loadSampleData() {
    setBatchName("Sample-DTR-Import-2026");
    parseCsvContent(SAMPLE_CSV_DATA);
  }

  function downloadCsvTemplate() {
    const blob = new Blob([SAMPLE_CSV_DATA], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "routex_daily_trip_report_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function updateRowField(id: string, field: keyof ParsedImportRow, value: unknown) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        const isDateValid = Boolean(updated.deliveryDate && updated.deliveryDate >= "2024-01-01");
        updated.isValid = Boolean(
          updated.waybillNumber &&
          isDateValid &&
          updated.clientName &&
          updated.plateNumber &&
          updated.deliveryRate > 0
        );
        updated.validationIssue = !updated.waybillNumber
          ? "Waybill number required"
          : !isDateValid
            ? "Date prior to company start (2024)"
            : updated.deliveryRate <= 0
              ? "Delivery revenue must be positive"
              : undefined;
        return updated;
      })
    );
  }

  async function commitImportBatch() {
    const validRows = rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setErrorMessage("There are no valid rows to import.");
      return;
    }

    setImporting(true);
    setErrorMessage(null);

    try {
      const payload = {
        batchName,
        idempotencyKey: crypto.randomUUID(),
        rows: validRows.map((r) => ({
          waybillNumber: r.waybillNumber,
          deliveryDate: r.deliveryDate,
          clientName: r.clientName,
          plateNumber: r.plateNumber,
          truckTemperature: r.truckTemperature,
          origin: r.origin,
          distanceKm: r.distanceKm,
          fuelRate: r.fuelRate,
          deliveryRate: r.deliveryRate,
          dieselExpenses: r.dieselExpenses,
          dieselExpensesStatus: r.dieselExpenses != null ? "confirmed" : "unknown",
          tollGateExpenses: r.tollGateExpenses,
          tollGateExpensesStatus: r.tollGateExpenses != null ? "confirmed" : "not_applicable",
          driverDailyRate: r.driverDailyRate,
          driverDailyRateStatus: "confirmed",
          driverAllowance: r.driverAllowance,
          driverAllowanceStatus: "confirmed",
          helperDailyRate: r.helperDailyRate,
          helperDailyRateStatus: "confirmed",
          helperAllowance: r.helperAllowance,
          helperAllowanceStatus: "confirmed",
          otherExpenses: r.otherExpenses,
          otherExpensesStatus: "confirmed",
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

      const data = await response.json() as {
        ok?: boolean;
        message?: string;
        committedCount?: number;
        duplicateCount?: number;
        committedWaybills?: string[];
        duplicateWaybills?: string[];
        errors?: { waybill: string; reason: string }[];
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "Batch import failed.");
      }

      setImportResult({
        committedCount: data.committedCount ?? 0,
        duplicateCount: data.duplicateCount ?? 0,
        committedWaybills: data.committedWaybills ?? [],
        duplicateWaybills: data.duplicateWaybills ?? [],
        errors: data.errors ?? [],
      });
      setRows([]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to commit import batch.");
    } finally {
      setImporting(false);
    }
  }

  const validCount = rows.filter((r) => r.isValid).length;
  const issueCount = rows.length - validCount;

  return (
    <>
      {errorMessage ? (
        <section className="notice" role="alert">
          <span className="notice-icon" aria-hidden="true">!</span>
          <div>
            <strong>Import Error:</strong>
            <span>{errorMessage}</span>
          </div>
          <button type="button" aria-label="Dismiss message" title="Dismiss message" onClick={() => setErrorMessage(null)}>
            ×
          </button>
        </section>
      ) : null}

      {importResult ? (
        <section className="notice" role="status" style={{ borderLeftColor: "#22c55e" }}>
          <span className="notice-icon" aria-hidden="true" style={{ color: "#22c55e" }}>
            <ImportIcon name="check" />
          </span>
          <div>
            <strong>Import Batch Committed Successfully:</strong>
            <span>
              {importResult.committedCount} completed delivery records created.
              {importResult.duplicateCount > 0
                ? ` ${importResult.duplicateCount} duplicate waybill(s) skipped (${importResult.duplicateWaybills.join(", ")}).`
                : ""}
            </span>
          </div>
          <Link className="secondary-button" href="/deliveries" style={{ marginLeft: "auto" }}>
            View Deliveries <ImportIcon name="arrow" />
          </Link>
        </section>
      ) : null}

      <section className="records-card" style={{ marginTop: "22px" }} aria-label="File Upload & Staging">
        <div className="records-heading">
          <div>
            <h2>1. Upload Spreadsheet</h2>
            <p>Upload a CSV or XLSX file.</p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button type="button" className="secondary-button" onClick={downloadCsvTemplate}>
              <ImportIcon name="download" /> Download CSV Template
            </button>
            <button type="button" className="secondary-button" onClick={loadSampleData}>
              <ImportIcon name="sample" /> Load Sample DTR Rows
            </button>
          </div>
        </div>

        <div style={{ padding: "20px 24px", borderTop: "1px solid var(--line)" }}>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px",
              border: "2px dashed var(--line)",
              borderRadius: "12px",
              background: "var(--color-surface)",
              cursor: "pointer",
            }}
          >
            <ImportIcon name="spreadsheet" className="import-upload-icon" />
            <strong style={{ fontSize: "14px", color: "var(--ink)" }}>Choose CSV or Daily Trip Report Spreadsheet</strong>
            <small style={{ color: "var(--muted)", marginTop: "4px" }}>CSV, TSV, or spreadsheet exports</small>
            <input
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </section>

      {rows.length > 0 ? (
        <section className="records-card" style={{ marginTop: "24px" }} aria-label="Staged Rows Review">
          <div className="records-heading">
            <div>
              <h2>2. Staged Review ({rows.length} trips parsed)</h2>
              <p>Review parsed rows before committing.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="stat-meta positive import-status-label">
                <ImportIcon name="check" /> {validCount} Ready
              </span>
              {issueCount > 0 ? (
                <span className="stat-meta warning import-status-label">
                  <ImportIcon name="warning" /> {issueCount} Need Review
                </span>
              ) : null}
              <button
                type="button"
                className="primary-action-button"
                disabled={importing || validCount === 0}
                onClick={commitImportBatch}
              >
                {importing ? "Committing Batch…" : `Commit ${validCount} Valid Deliveries`}
              </button>
            </div>
          </div>

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
                  <th>Highway Tolls</th>
                  <th>Drop-offs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className={`pod-status ${row.isValid ? "attached" : "missing"}`}>
                        <i aria-hidden="true" />
                        {row.isValid ? "Valid" : row.validationIssue ?? "Invalid"}
                      </span>
                    </td>
                    <td>
                      <input
                        type="date"
                        min="2024-01-01"
                        value={row.deliveryDate}
                        onChange={(e) => updateRowField(row.id, "deliveryDate", e.target.value)}
                        style={{ border: "1px solid var(--line)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.waybillNumber}
                        onChange={(e) => updateRowField(row.id, "waybillNumber", e.target.value)}
                        style={{ border: "1px solid var(--line)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", width: "130px" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.clientName}
                        onChange={(e) => updateRowField(row.id, "clientName", e.target.value)}
                        style={{ border: "1px solid var(--line)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", width: "140px" }}
                      />
                    </td>
                    <td className="truck-code">
                      <input
                        type="text"
                        value={row.plateNumber}
                        onChange={(e) => updateRowField(row.id, "plateNumber", e.target.value)}
                        style={{ border: "1px solid var(--line)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", width: "100px" }}
                      />
                    </td>
                    <td>
                      <select
                        value={row.truckTemperature}
                        onChange={(e) => updateRowField(row.id, "truckTemperature", e.target.value as TruckTemperature)}
                        style={{ border: "1px solid var(--line)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", width: "145px" }}
                      >
                        {DELIVERY_TEMPERATURES.map((temperature) => <option key={temperature} value={temperature}>{temperature}</option>)}
                      </select>
                    </td>
                    <td className="money">
                      <input
                        type="number"
                        value={row.deliveryRate}
                        onChange={(e) => updateRowField(row.id, "deliveryRate", Number(e.target.value) || 0)}
                        style={{ border: "1px solid var(--line)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", width: "90px" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.dieselExpenses ?? ""}
                        placeholder="0"
                        onChange={(e) => updateRowField(row.id, "dieselExpenses", e.target.value ? Number(e.target.value) : null)}
                        style={{ border: "1px solid var(--line)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", width: "80px" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.tollGateExpenses ?? ""}
                        placeholder="0"
                        onChange={(e) => updateRowField(row.id, "tollGateExpenses", e.target.value ? Number(e.target.value) : null)}
                        style={{ border: "1px solid var(--line)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", width: "80px" }}
                      />
                    </td>
                    <td>
                      {row.dropoffs.map((d) => d.storeName).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}

