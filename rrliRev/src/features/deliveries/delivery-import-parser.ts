import type { TruckTemperature } from "./delivery-domain";

export type StagedDropoff = {
  storeName: string;
  destinationArea: string;
  entryFee: number | null;
};

export type StagedValidationIssue = {
  field: string;
  message: string;
};

export type StagedDeliveryRow = {
  id: string;
  rowNumber: number;
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
  tollGateBreakdown: string;
  driverDailyRate: number | null;
  driverAllowance: number | null;
  driverName: string | null;
  helperDailyRate: number | null;
  helperAllowance: number | null;
  helperName: string | null;
  otherExpenses: number | null;
  dropoffs: StagedDropoff[];
  status: "ready" | "needs_attention" | "duplicate";
  issues: StagedValidationIssue[];
};

export type ImportParseResult = {
  rows: StagedDeliveryRow[];
  totalRawRows: number;
  totalGroupedDeliveries: number;
  readyCount: number;
  attentionCount: number;
  duplicateCount: number;
  errors: string[];
};

/**
 * Standard RFC 4180 Delimited Text Parser.
 * Handles commas, tabs, semicolons, quoted cells with internal commas/quotes, and CRLF newlines.
 */
export function parseDelimitedText(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, ""); // Strip UTF-8 BOM if present
  if (!clean.trim()) return [];

  // Auto-detect delimiter from first non-empty line: tab, semicolon, or comma
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  let delimiter = ",";
  if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = "\t";
  } else if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ";";
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else if (char === "\n") {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  // Push remainder
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function cleanNumeric(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const str = String(val).trim().replace(/[₱$,\s]/g, "");
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function normalizeDate(raw: string): string {
  const str = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  // Try MM/DD/YYYY or DD/MM/YYYY
  const slashParts = str.split(/[/.-]/).map((p) => p.trim());
  if (slashParts.length === 3) {
    if (slashParts[0].length === 4) {
      // YYYY-MM-DD
      const y = slashParts[0];
      const m = slashParts[1].padStart(2, "0");
      const d = slashParts[2].padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    // Assume MM/DD/YYYY if month <= 12
    const m = slashParts[0].padStart(2, "0");
    const d = slashParts[1].padStart(2, "0");
    const y = slashParts[2].length === 2 ? `20${slashParts[2]}` : slashParts[2];
    return `${y}-${m}-${d}`;
  }
  return str;
}

function normalizeTemperature(raw: string): TruckTemperature {
  const str = raw.trim();
  const match = str.match(/^(-?\d+(?:\.\d+)?)/);
  if (match) {
    return `${match[1]}°C` as TruckTemperature;
  }
  return "-18°C";
}

/**
 * Validates a single staged delivery row.
 */
export function validateStagedRow(
  row: StagedDeliveryRow,
  existingWaybills?: Set<string>,
  seenInBatch?: Set<string>,
): { status: "ready" | "needs_attention" | "duplicate"; issues: StagedValidationIssue[] } {
  const issues: StagedValidationIssue[] = [];

  // 1. Waybill validation
  const wb = row.waybillNumber.trim();
  if (!wb) {
    issues.push({ field: "waybillNumber", message: "Waybill number is required." });
  } else if (wb.length < 3) {
    issues.push({ field: "waybillNumber", message: "Waybill number must be at least 3 characters." });
  } else if (existingWaybills?.has(wb)) {
    return {
      status: "duplicate",
      issues: [{ field: "waybillNumber", message: `Waybill ${wb} already exists in the system (will be skipped).` }],
    };
  } else if (seenInBatch && seenInBatch.has(wb)) {
    return {
      status: "duplicate",
      issues: [{ field: "waybillNumber", message: `Duplicate waybill ${wb} detected within this import batch.` }],
    };
  }

  // 2. Date validation
  const d = row.deliveryDate.trim();
  if (!d) {
    issues.push({ field: "deliveryDate", message: "Delivery date is required." });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    issues.push({ field: "deliveryDate", message: "Date must be YYYY-MM-DD." });
  } else if (d < "2024-01-01") {
    issues.push({ field: "deliveryDate", message: "Date cannot be earlier than company foundation (2024)." });
  }

  // 3. Client Name
  if (!row.clientName.trim()) {
    issues.push({ field: "clientName", message: "Client name is required." });
  }

  // 4. Truck Plate
  if (!row.plateNumber.trim()) {
    issues.push({ field: "plateNumber", message: "Truck plate number is required." });
  }

  // 5. Revenue
  if (row.deliveryRate == null || row.deliveryRate <= 0) {
    issues.push({ field: "deliveryRate", message: "Delivery revenue must be greater than ₱0." });
  }

  // 6. Expenses non-negative checks
  const expenseFields: Array<[keyof StagedDeliveryRow, string]> = [
    ["dieselExpenses", "Diesel expense"],
    ["tollGateExpenses", "Toll gate expense"],
    ["driverDailyRate", "Driver daily rate"],
    ["driverAllowance", "Driver allowance"],
    ["helperDailyRate", "Helper daily rate"],
    ["helperAllowance", "Helper allowance"],
    ["otherExpenses", "Other expenses"],
  ];

  for (const [key, label] of expenseFields) {
    const val = row[key];
    if (typeof val === "number" && val < 0) {
      issues.push({ field: key as string, message: `${label} cannot be negative.` });
    }
  }

  // 7. Store Drop-offs
  if (!row.dropoffs || row.dropoffs.length === 0) {
    issues.push({ field: "dropoffs", message: "At least one store drop-off is required." });
  } else {
    row.dropoffs.forEach((stop, idx) => {
      if (!stop.storeName.trim()) {
        issues.push({ field: `dropoffs[${idx}].storeName`, message: `Store name required for Stop #${idx + 1}.` });
      }
      if (typeof stop.entryFee === "number" && stop.entryFee < 0) {
        issues.push({ field: `dropoffs[${idx}].entryFee`, message: `Entry fee for Stop #${idx + 1} cannot be negative.` });
      }
    });
  }

  return {
    status: issues.length === 0 ? "ready" : "needs_attention",
    issues,
  };
}

/**
 * Parses and validates an entire CSV/TSV spreadsheet into StagedDeliveryRows.
 * Groups multi-stop deliveries sharing the same Waybill Number.
 */
export function parseDeliveryImport(
  text: string,
  existingWaybills?: Set<string>,
): ImportParseResult {
  const table = parseDelimitedText(text);
  if (table.length < 2) {
    return {
      rows: [],
      totalRawRows: 0,
      totalGroupedDeliveries: 0,
      readyCount: 0,
      attentionCount: 0,
      duplicateCount: 0,
      errors: ["File contains no data rows. Must contain a header row and at least one trip record."],
    };
  }

  // Map header row to indices
  const header = table[0].map((h) => h.toLowerCase().trim());
  const findIdx = (...keywords: string[]) =>
    header.findIndex((h) => keywords.some((k) => h === k || h.includes(k)));

  const wbIdx = findIdx("waybill", "wb", "waybill number", "waybill #");
  const dateIdx = findIdx("delivery date", "trip date", "date");
  const clientIdx = findIdx("client", "client name", "customer");
  const plateIdx = findIdx("truck plate", "plate number", "plate", "truck", "vehicle");
  const tempIdx = findIdx("temperature", "temp", "truck temp");
  const rateIdx = findIdx("delivery rate", "revenue", "rate", "earnings", "fee");
  const dieselIdx = findIdx("diesel", "fuel", "diesel cost");
  const tollIdx = findIdx("toll gate", "tolls", "toll");
  const driverRateIdx = findIdx("driver rate", "driver daily rate");
  const driverAllowIdx = findIdx("driver allowance", "driver meals");
  const driverNameIdx = findIdx("driver name", "driver");
  const helperRateIdx = findIdx("helper rate", "helper daily rate");
  const helperAllowIdx = findIdx("helper allowance", "helper meals");
  const helperNameIdx = findIdx("helper name", "helper");
  const otherIdx = findIdx("other expenses", "other cost", "other");
  const storeIdx = findIdx("store name", "store", "destination store", "stop");
  const areaIdx = findIdx("destination area", "area", "destination", "city", "location");
  const feeIdx = findIdx("entry fee", "store entry fee", "gate fee");
  const originIdx = findIdx("origin", "depot", "hub");
  const distanceIdx = findIdx("distance km", "distance", "km");
  const fuelRateIdx = findIdx("fuel rate", "fuel price");

  // Group raw rows by waybill number if present, or assign sequential id
  type RawParsedLine = {
    rowNumber: number;
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
    driverName: string | null;
    helperDailyRate: number | null;
    helperAllowance: number | null;
    helperName: string | null;
    otherExpenses: number | null;
    storeName: string;
    destinationArea: string;
    entryFee: number | null;
  };

  const lines: RawParsedLine[] = [];

  for (let i = 1; i < table.length; i++) {
    const cols = table[i];
    if (cols.length === 0 || cols.every((c) => c.trim().length === 0)) continue;

    const waybill = wbIdx >= 0 ? cols[wbIdx]?.trim() || "" : "";
    const date = dateIdx >= 0 ? normalizeDate(cols[dateIdx] || "") : "";
    const client = clientIdx >= 0 ? cols[clientIdx]?.trim() || "" : "";
    const plate = plateIdx >= 0 ? cols[plateIdx]?.trim().toUpperCase() || "" : "";
    const temp = tempIdx >= 0 ? normalizeTemperature(cols[tempIdx] || "") : "-18°C";
    const origin = originIdx >= 0 ? cols[originIdx]?.trim() || "Central Depot" : "Central Depot";
    const distance = distanceIdx >= 0 ? cleanNumeric(cols[distanceIdx]) ?? 50 : 50;
    const fuelRate = fuelRateIdx >= 0 ? cleanNumeric(cols[fuelRateIdx]) ?? 85.0 : 85.0;
    const rate = rateIdx >= 0 ? cleanNumeric(cols[rateIdx]) ?? 0 : 0;
    const diesel = dieselIdx >= 0 ? cleanNumeric(cols[dieselIdx]) : null;
    const tolls = tollIdx >= 0 ? cleanNumeric(cols[tollIdx]) : null;
    const drvRate = driverRateIdx >= 0 ? cleanNumeric(cols[driverRateIdx]) : null;
    const drvAllow = driverAllowIdx >= 0 ? cleanNumeric(cols[driverAllowIdx]) : null;
    const drvName = driverNameIdx >= 0 ? cols[driverNameIdx]?.trim() || null : null;
    const hlpRate = helperRateIdx >= 0 ? cleanNumeric(cols[helperRateIdx]) : null;
    const hlpAllow = helperAllowIdx >= 0 ? cleanNumeric(cols[helperAllowIdx]) : null;
    const hlpName = helperNameIdx >= 0 ? cols[helperNameIdx]?.trim() || null : null;
    const other = otherIdx >= 0 ? cleanNumeric(cols[otherIdx]) : null;
    const store = storeIdx >= 0 ? cols[storeIdx]?.trim() || "" : "";
    const area = areaIdx >= 0 ? cols[areaIdx]?.trim() || "" : "";
    const fee = feeIdx >= 0 ? cleanNumeric(cols[feeIdx]) : null;

    lines.push({
      rowNumber: i + 1,
      waybillNumber: waybill,
      deliveryDate: date,
      clientName: client,
      plateNumber: plate,
      truckTemperature: temp,
      origin,
      distanceKm: distance,
      fuelRate,
      deliveryRate: rate,
      dieselExpenses: diesel,
      tollGateExpenses: tolls,
      driverDailyRate: drvRate,
      driverAllowance: drvAllow,
      driverName: drvName,
      helperDailyRate: hlpRate,
      helperAllowance: hlpAllow,
      helperName: hlpName,
      otherExpenses: other,
      storeName: store,
      destinationArea: area,
      entryFee: fee,
    });
  }

  // Aggregate by Waybill Number
  const groupedMap = new Map<string, StagedDeliveryRow>();
  const seenWaybillsInBatch = new Set<string>();

  for (const line of lines) {
    const key = line.waybillNumber.trim() || `UNKNOWN_ROW_${line.rowNumber}`;
    const stop: StagedDropoff = {
      storeName: line.storeName || (line.clientName ? `${line.clientName} Store` : "Main Store"),
      destinationArea: line.destinationArea || "Metro Manila",
      entryFee: line.entryFee,
    };

    if (groupedMap.has(key)) {
      // Append stop to existing waybill delivery
      const existing = groupedMap.get(key)!;
      existing.dropoffs.push(stop);
    } else {
      const newRow: StagedDeliveryRow = {
        id: `imp-${line.rowNumber}-${Date.now().toString(36)}`,
        rowNumber: line.rowNumber,
        waybillNumber: line.waybillNumber,
        deliveryDate: line.deliveryDate,
        clientName: line.clientName,
        plateNumber: line.plateNumber,
        truckTemperature: line.truckTemperature,
        origin: line.origin,
        distanceKm: line.distanceKm,
        fuelRate: line.fuelRate,
        deliveryRate: line.deliveryRate,
        dieselExpenses: line.dieselExpenses,
        tollGateExpenses: line.tollGateExpenses,
        tollGateBreakdown: "",
        driverDailyRate: line.driverDailyRate,
        driverAllowance: line.driverAllowance,
        driverName: line.driverName,
        helperDailyRate: line.helperDailyRate,
        helperAllowance: line.helperAllowance,
        helperName: line.helperName,
        otherExpenses: line.otherExpenses,
        dropoffs: [stop],
        status: "ready",
        issues: [],
      };
      groupedMap.set(key, newRow);
    }
  }

  // Run validation on all grouped deliveries
  const rows = Array.from(groupedMap.values());
  for (const row of rows) {
    const { status, issues } = validateStagedRow(row, existingWaybills, seenWaybillsInBatch);
    row.status = status;
    row.issues = issues;
    if (row.waybillNumber.trim()) {
      seenWaybillsInBatch.add(row.waybillNumber.trim());
    }
  }

  const readyCount = rows.filter((r) => r.status === "ready").length;
  const duplicateCount = rows.filter((r) => r.status === "duplicate").length;
  const attentionCount = rows.filter((r) => r.status === "needs_attention").length;

  return {
    rows,
    totalRawRows: lines.length,
    totalGroupedDeliveries: rows.length,
    readyCount,
    attentionCount,
    duplicateCount,
    errors: [],
  };
}

/**
 * Generates sample CSV data for download or preview demo.
 */
export function generateSampleCsv(): string {
  return [
    "Delivery Date,Waybill Number,Client Name,Truck Plate,Temperature,Origin,Distance Km,Fuel Rate,Delivery Rate,Diesel,Tolls,Driver Rate,Driver Allowance,Driver Name,Helper Rate,Helper Allowance,Helper Name,Store Name,Destination Area,Entry Fee",
    "2026-11-01,WB-2611-9001,Landers,NGS 4281,-18°C,Marilao Depot,85,85.5,23000,3800,950,950,300,Carlos Mendoza,700,200,Ira Santos,Landers Balintawak,Quezon City,150",
    "2026-11-01,WB-2611-9002,Manila Comisario Central Inc. (MCCI),NFO 8324,4°C,FTI Taguig Hub,110,84.0,26500,4200,1200,1000,350,Nico Serrano,750,250,Paolo Reyes,MCCI Alabang Center,Muntinlupa,0",
    "2026-11-02,WB-2611-9003,Vanguard,CBC 5519,20°C,North Harbor Terminal,65,86.5,19500,2900,450,900,250,Carlos Mendoza,650,200,Ira Santos,Vanguard Pasig Hub,Pasig City,100",
    "2026-11-02,WB-2611-9004,Puregold Price Club Inc.,DAA 7310,4°C,Meycauayan Depot,78,84.5,18800,3180,840,950,300,Nico Serrano,700,200,Paolo Reyes,Puregold North Harbor,Manila,120",
    "2026-11-03,WB-2611-9005,Jollibee Foods Corp. (Commissary),CBZ 1187,-18°C,Santa Rosa Cold Storage,94,85.5,24500,4120,1180,950,300,Carlos Mendoza,700,200,Ira Santos,Jollibee Laguna Commissary,Santa Rosa,0",
  ].join("\n");
}

/**
 * Generates an export report detailing imported, duplicate, and failed rows.
 */
export function generateImportErrorReport(
  rows: StagedDeliveryRow[],
  duplicatesOrResult:
    | string[]
    | {
        batchName?: string;
        duplicateWaybills?: string[];
        errors?: Array<{ waybill: string; reason: string }>;
        [key: string]: unknown;
      },
  serverErrors?: Array<{ waybill: string; reason: string }>,
): string {
  const duplicateWaybills: string[] = Array.isArray(duplicatesOrResult)
    ? duplicatesOrResult
    : duplicatesOrResult?.duplicateWaybills ?? [];
  const errors = Array.isArray(duplicatesOrResult)
    ? serverErrors ?? []
    : duplicatesOrResult?.errors ?? serverErrors ?? [];

  const lines: string[] = [
    "Waybill Number,Delivery Date,Client,Plate Number,Status,Issues / Details",
  ];

  for (const r of rows) {
    const isDup = duplicateWaybills.includes(r.waybillNumber);
    const serverErr = errors.find((e) => e.waybill === r.waybillNumber);
    let statusText = r.status.toUpperCase();
    let detailText = r.issues.map((i) => `${i.field}: ${i.message}`).join("; ");

    if (serverErr) {
      statusText = "SERVER_ERROR";
      detailText = serverErr.reason;
    } else if (isDup) {
      statusText = "DUPLICATE_SKIPPED";
      detailText = "Waybill already exists in RouteX database.";
    }

    lines.push(
      `"${r.waybillNumber}","${r.deliveryDate}","${r.clientName}","${r.plateNumber}","${statusText}","${detailText.replace(/"/g, '""')}"`,
    );
  }

  return lines.join("\n");
}
