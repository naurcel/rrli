import * as XLSX from "xlsx";
import type { TruckTemperature, TruckType } from "./delivery-domain.ts";
import { getFleetTrucks } from "./truck-registry.ts";
import { getFleetCrew } from "./driver-registry.ts";

export type StagedDropoff = {
  storeName: string;
  destinationArea: string;
  dropoffCount?: number;
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
  truckType: TruckType;
  truckOwnership: "Owned" | "Subcontracted";
  truckTemperature: TruckTemperature;
  origin: string;
  distanceKm: number;
  fuelRate: number;
  deliveryRate: number;
  totalExpenses: number | null;
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
  entryFees?: number | null;
  notes?: string | null;
  dropoffs: StagedDropoff[];
  status: "ready" | "needs_attention" | "duplicate";
  issues: StagedValidationIssue[];
  isNewTruck?: boolean;
  isNewDriver?: boolean;
  isNewHelper?: boolean;
  expectedCompletionStatus?: "Completed" | "Incomplete";
};

export type ImportParseResult = {
  rows: StagedDeliveryRow[];
  totalRawRows: number;
  totalGroupedDeliveries: number;
  readyCount: number;
  attentionCount: number;
  duplicateCount: number;
  ownedCount: number;
  subconCount: number;
  existingTrucksMatched: number;
  newTrucksToCreate: number;
  existingCrewMatched: number;
  newCrewToCreate: number;
  autoCompletedCount: number;
  incompleteCount: number;
  errors: string[];
};

export function normalizeTruckType(raw: string | null | undefined): TruckType {
  if (!raw) return "6-Wheeler";
  const str = raw.trim().toUpperCase();
  if (str.includes("10") || str.includes("10W")) return "10-Wheeler";
  if (str.includes("6") || str.includes("6W") || str.includes("4T")) return "6-Wheeler";
  if (str.includes("4") || str.includes("2T") || str.includes("4W")) return "4-Wheeler";
  return "6-Wheeler";
}

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
): {
  status: "ready" | "needs_attention" | "duplicate";
  issues: StagedValidationIssue[];
  expectedCompletionStatus: "Completed" | "Incomplete";
} {
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
      expectedCompletionStatus: "Completed",
    };
  } else if (seenInBatch && seenInBatch.has(wb)) {
    return {
      status: "duplicate",
      issues: [{ field: "waybillNumber", message: `Duplicate waybill ${wb} detected within this import batch.` }],
      expectedCompletionStatus: "Completed",
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
  if (row.truckOwnership === "Subcontracted") {
    // For Subcontracted deliveries:
    // Do NOT force driverDailyRate, helperDailyRate, or detailed breakdown.
    if (row.totalExpenses != null && row.totalExpenses < 0) {
      issues.push({ field: "totalExpenses", message: "Total expense cannot be negative." });
    }
    if (row.otherExpenses != null && row.otherExpenses < 0) {
      issues.push({ field: "otherExpenses", message: "Other expenses cannot be negative." });
    }
  } else {
    // For Owned deliveries:
    const expenseFields: Array<[keyof StagedDeliveryRow, string]> = [
      ["dieselExpenses", "Diesel expense"],
      ["tollGateExpenses", "Toll gate expense"],
      ["driverDailyRate", "Driver daily rate"],
      ["driverAllowance", "Driver allowance"],
      ["helperDailyRate", "Helper daily rate"],
      ["helperAllowance", "Helper allowance"],
      ["otherExpenses", "Other expenses"],
      ["totalExpenses", "Total expenses"],
    ];

    for (const [key, label] of expenseFields) {
      const val = row[key];
      if (typeof val === "number" && val < 0) {
        issues.push({ field: key as string, message: `${label} cannot be negative.` });
      }
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

  // Determine expected completion status:
  // A delivery automatically becomes Completed if all core required fields are present.
  // Optional items (waybill, POD turn-in, optional extra charges) do not prevent completion.
  let expectedCompletionStatus: "Completed" | "Incomplete" = "Completed";
  if (
    !row.clientName.trim() ||
    !row.plateNumber.trim() ||
    !row.deliveryDate.trim() ||
    row.deliveryRate == null ||
    row.deliveryRate <= 0 ||
    !row.dropoffs ||
    row.dropoffs.length === 0 ||
    row.dropoffs.some((s) => !s.storeName.trim())
  ) {
    expectedCompletionStatus = "Incomplete";
  }

  if (row.truckOwnership === "Subcontracted" && (row.totalExpenses == null || row.totalExpenses < 0)) {
    expectedCompletionStatus = "Incomplete";
  }

  return {
    status: issues.length === 0 ? "ready" : "needs_attention",
    issues,
    expectedCompletionStatus,
  };
}

/**
 * Parses and validates tabular rows into StagedDeliveryRows.
 * Groups multi-stop deliveries sharing the same Waybill Number.
 */
export function parseDeliveryImportFromTable(
  table: string[][],
  existingWaybills?: Set<string>,
): ImportParseResult {
  if (table.length < 2) {
    return {
      rows: [],
      totalRawRows: 0,
      totalGroupedDeliveries: 0,
      readyCount: 0,
      attentionCount: 0,
      duplicateCount: 0,
      ownedCount: 0,
      subconCount: 0,
      existingTrucksMatched: 0,
      newTrucksToCreate: 0,
      existingCrewMatched: 0,
      newCrewToCreate: 0,
      autoCompletedCount: 0,
      incompleteCount: 0,
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
  const truckTypeIdx = findIdx("truck type", "type", "vehicle type");
  const ownershipIdx = findIdx("ownership", "truck ownership", "classification");
  const tempIdx = findIdx("temperature", "temp", "truck temp");
  const rateIdx = findIdx("delivery rate", "revenue", "rate", "earnings", "fee");
  const totalExpIdx = findIdx("total expense", "total expenses", "expense", "expenses");
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
  const dropoffCountIdx = findIdx("drop-offs", "dropoffs", "dropoff count", "stops", "number of drop-offs", "drops");
  const originIdx = findIdx("origin", "depot", "hub");
  const distanceIdx = findIdx("distance km", "distance", "km");
  const fuelRateIdx = findIdx("fuel rate", "fuel price");
  const notesIdx = findIdx("notes", "note", "remarks", "remark", "instructions", "comments");

  // Group raw rows by waybill number if present, or assign sequential id
  type RawParsedLine = {
    rowNumber: number;
    waybillNumber: string;
    deliveryDate: string;
    clientName: string;
    plateNumber: string;
    truckType: TruckType;
    truckOwnership: "Owned" | "Subcontracted";
    truckTemperature: TruckTemperature;
    origin: string;
    distanceKm: number;
    fuelRate: number;
    deliveryRate: number;
    totalExpenses: number | null;
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
    dropoffCount: number;
    entryFee: number | null;
    notes: string | null;
  };

  const lines: RawParsedLine[] = [];
  const fleetTrucks = getFleetTrucks();

  for (let i = 1; i < table.length; i++) {
    const cols = table[i];
    if (cols.length === 0 || cols.every((c) => c.trim().length === 0)) continue;

    const waybill = wbIdx >= 0 ? cols[wbIdx]?.trim() || "" : "";
    const date = dateIdx >= 0 ? normalizeDate(cols[dateIdx] || "") : "";
    const client = clientIdx >= 0 ? cols[clientIdx]?.trim() || "" : "";
    const plate = plateIdx >= 0 ? cols[plateIdx]?.trim().toUpperCase() || "" : "";
    const cleanPlate = plate.replace(/\s+/g, "");
    const registeredTruck = fleetTrucks.find(
      (t) => t.plateNumber.toUpperCase().replace(/\s+/g, "") === cleanPlate,
    );

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
    const totalExpVal = totalExpIdx >= 0 ? cleanNumeric(cols[totalExpIdx]) : null;
    const store = storeIdx >= 0 ? cols[storeIdx]?.trim() || "" : "";
    const area = areaIdx >= 0 ? cols[areaIdx]?.trim() || "" : "";
    const fee = feeIdx >= 0 ? cleanNumeric(cols[feeIdx]) : null;
    const drops = dropoffCountIdx >= 0 ? Math.max(1, cleanNumeric(cols[dropoffCountIdx]) || 1) : 1;

    const truckType = normalizeTruckType(truckTypeIdx >= 0 ? cols[truckTypeIdx] : registeredTruck?.truckType);

    // Determine ownership
    let ownership: "Owned" | "Subcontracted" = "Owned";
    if (registeredTruck) {
      ownership = registeredTruck.ownershipType;
    } else if (ownershipIdx >= 0 && cols[ownershipIdx]) {
      ownership = cols[ownershipIdx].toLowerCase().includes("sub") ? "Subcontracted" : "Owned";
    } else if (totalExpVal != null && totalExpVal > 0 && diesel == null && drvRate == null && hlpRate == null) {
      ownership = "Subcontracted";
    }

    const totalExpenses = ownership === "Subcontracted"
      ? (totalExpVal ?? other ?? 0)
      : (totalExpVal ?? ((diesel ?? 0) + (tolls ?? 0) + (drvRate ?? 0) + (drvAllow ?? 0) + (hlpRate ?? 0) + (hlpAllow ?? 0) + (other ?? 0) + (fee ?? 0)));

    lines.push({
      rowNumber: i + 1,
      waybillNumber: waybill,
      deliveryDate: date,
      clientName: client,
      plateNumber: plate,
      truckType,
      truckOwnership: ownership,
      truckTemperature: temp,
      origin,
      distanceKm: distance,
      fuelRate,
      deliveryRate: rate,
      totalExpenses,
      dieselExpenses: ownership === "Subcontracted" ? null : diesel,
      tollGateExpenses: ownership === "Subcontracted" ? null : tolls,
      driverDailyRate: ownership === "Subcontracted" ? null : drvRate,
      driverAllowance: ownership === "Subcontracted" ? null : drvAllow,
      driverName: drvName || registeredTruck?.driverName || null,
      helperDailyRate: ownership === "Subcontracted" ? null : hlpRate,
      helperAllowance: ownership === "Subcontracted" ? null : hlpAllow,
      helperName: hlpName || registeredTruck?.helperName || null,
      otherExpenses: ownership === "Subcontracted" ? totalExpenses : other,
      storeName: store,
      destinationArea: area,
      dropoffCount: drops,
      entryFee: fee,
      notes: notesIdx >= 0 ? cols[notesIdx]?.trim() || null : null,
    });
  }

  // Aggregate by Waybill Number
  const groupedMap = new Map<string, StagedDeliveryRow>();
  const seenWaybillsInBatch = new Set<string>();
  const fleetCrew = getFleetCrew();

  for (const line of lines) {
    const key = line.waybillNumber.trim() || `UNKNOWN_ROW_${line.rowNumber}`;
    const stop: StagedDropoff = {
      storeName: line.storeName || (line.clientName ? `${line.clientName} Store` : "Main Store"),
      destinationArea: line.destinationArea || "Metro Manila",
      dropoffCount: line.dropoffCount,
      entryFee: line.entryFee,
    };

    if (groupedMap.has(key)) {
      // Append stop to existing waybill delivery
      const existing = groupedMap.get(key)!;
      existing.dropoffs.push(stop);
    } else {
      const cleanPlate = line.plateNumber.replace(/\s+/g, "");
      const registeredTruck = fleetTrucks.find(
        (t) => t.plateNumber.toUpperCase().replace(/\s+/g, "") === cleanPlate,
      );
      const isNewTruck = !registeredTruck;

      const dName = line.driverName || "Unknown Driver";
      const hName = line.helperName || "Unknown Helper";

      const isNewDriver = Boolean(
        dName &&
        !dName.toLowerCase().includes("unknown") &&
        !fleetCrew.some(
          (c) => c.assignmentType === "Driver" && c.fullName.toLowerCase().replace(/\s+/g, " ") === dName.toLowerCase().replace(/\s+/g, " "),
        ),
      );
      const isNewHelper = Boolean(
        hName &&
        !hName.toLowerCase().includes("unknown") &&
        !fleetCrew.some(
          (c) => c.assignmentType === "Helper" && c.fullName.toLowerCase().replace(/\s+/g, " ") === hName.toLowerCase().replace(/\s+/g, " "),
        ),
      );

      const newRow: StagedDeliveryRow = {
        id: `imp-${line.rowNumber}-${Date.now().toString(36)}`,
        rowNumber: line.rowNumber,
        waybillNumber: line.waybillNumber,
        deliveryDate: line.deliveryDate,
        clientName: line.clientName,
        plateNumber: line.plateNumber,
        truckType: line.truckType,
        truckOwnership: line.truckOwnership,
        truckTemperature: line.truckTemperature,
        origin: line.origin,
        distanceKm: line.distanceKm,
        fuelRate: line.fuelRate,
        deliveryRate: line.deliveryRate,
        totalExpenses: line.totalExpenses,
        dieselExpenses: line.dieselExpenses,
        tollGateExpenses: line.tollGateExpenses,
        tollGateBreakdown: "",
        driverDailyRate: line.driverDailyRate,
        driverAllowance: line.driverAllowance,
        driverName: dName,
        helperDailyRate: line.helperDailyRate,
        helperAllowance: line.helperAllowance,
        helperName: hName,
        otherExpenses: line.otherExpenses,
        notes: line.notes,
        dropoffs: [stop],
        status: "ready",
        issues: [],
        isNewTruck,
        isNewDriver,
        isNewHelper,
      };
      groupedMap.set(key, newRow);
    }
  }

  // Run validation on all grouped deliveries
  const rows = Array.from(groupedMap.values());
  for (const row of rows) {
    const { status, issues, expectedCompletionStatus } = validateStagedRow(row, existingWaybills, seenWaybillsInBatch);
    row.status = status;
    row.issues = issues;
    row.expectedCompletionStatus = expectedCompletionStatus;
    if (row.waybillNumber.trim()) {
      seenWaybillsInBatch.add(row.waybillNumber.trim());
    }
  }

  const readyCount = rows.filter((r) => r.status === "ready").length;
  const duplicateCount = rows.filter((r) => r.status === "duplicate").length;
  const attentionCount = rows.filter((r) => r.status === "needs_attention").length;
  const ownedCount = rows.filter((r) => r.truckOwnership === "Owned").length;
  const subconCount = rows.filter((r) => r.truckOwnership === "Subcontracted").length;
  const newTrucksToCreate = rows.filter((r) => r.isNewTruck).length;
  const existingTrucksMatched = rows.length - newTrucksToCreate;
  const newCrewToCreate = rows.filter((r) => r.isNewDriver || r.isNewHelper).length;
  const existingCrewMatched = rows.length - newCrewToCreate;
  const autoCompletedCount = rows.filter((r) => r.status === "ready" && r.expectedCompletionStatus === "Completed").length;
  const incompleteCount = rows.filter((r) => r.expectedCompletionStatus === "Incomplete").length;

  return {
    rows,
    totalRawRows: lines.length,
    totalGroupedDeliveries: rows.length,
    readyCount,
    attentionCount,
    duplicateCount,
    ownedCount,
    subconCount,
    existingTrucksMatched,
    newTrucksToCreate,
    existingCrewMatched,
    newCrewToCreate,
    autoCompletedCount,
    incompleteCount,
    errors: [],
  };
}

/**
 * Parses and validates an entire CSV/TSV spreadsheet into StagedDeliveryRows.
 */
export function parseDeliveryImport(
  text: string,
  existingWaybills?: Set<string>,
): ImportParseResult {
  const table = parseDelimitedText(text);
  return parseDeliveryImportFromTable(table, existingWaybills);
}

export function parseExcelSerialDate(serial: unknown): string {
  if (serial == null) return "";
  if (typeof serial === "number" && serial > 20000 && serial < 60000) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    const year = date_info.getUTCFullYear();
    const month = String(date_info.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date_info.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const str = String(serial).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const num = Number(str);
  if (!Number.isNaN(num) && num > 20000 && num < 60000) {
    return parseExcelSerialDate(num);
  }
  return "";
}

export function parseDateFromTitle(title: string): string {
  if (!title) return "";
  const match = title.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (match) {
    const months: Record<string, string> = {
      january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
      july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
      jan: "01", feb: "02", mar: "03", apr: "04", jun: "06", jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
    };
    const m = months[match[1].toLowerCase()];
    if (m) {
      const d = match[2].padStart(2, "0");
      const y = match[3];
      return `${y}-${m}-${d}`;
    }
  }
  return "";
}

/**
 * Parses a Daily Trip Report formatted Excel workbook.
 * Supports multi-sheet daily blocks, client carry-over, store splitting on \n or /,
 * overall trip entry fees (Col M/13), toll plaza breakdowns, and flagging missing waybills.
 */
export function parseDailyTripReportWorkbook(
  workbook: XLSX.WorkBook,
  existingWaybills?: Set<string>,
): ImportParseResult | null {
  const stagedRows: StagedDeliveryRow[] = [];
  const seenWaybillsInBatch = new Set<string>();
  let totalRawRows = 0;
  let isDtrLayout = false;

  for (const sheetName of workbook.SheetNames) {
    if (/template|truck condition|number of trips/i.test(sheetName)) continue;
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    if (rawRows.length < 4) continue;

    // Detect header row & section date
    let headerIdx = -1;
    let sectionDate = "";
    for (let r = 0; r < Math.min(12, rawRows.length); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map((c) => String(c ?? "")).join(" ").toUpperCase();
      if (rowStr.includes("DAILY TRIP REPORT")) {
        sectionDate = parseDateFromTitle(rowStr);
      }
      if (
        rowStr.includes("WAYBILL") &&
        (rowStr.includes("PLATE") || rowStr.includes("CLIENT") || rowStr.includes("STORE") || rowStr.includes("TRUCK"))
      ) {
        headerIdx = r;
        break;
      }
    }

    if (headerIdx === -1) continue;

    const header = (rawRows[headerIdx] as unknown[]).map((c) =>
      String(c ?? "").toUpperCase().replace(/\s+/g, " ").trim(),
    );

    // Ensure this is a Daily Trip Report layout (has DTR title, NET INCOME, or TOTAL EXPENSE)
    const isDtrHeader =
      header.some((h) => h.includes("TOTAL EXPENSE") || h.includes("NET INCOME")) ||
      sectionDate.length > 0;
    if (!isDtrHeader) continue;

    isDtrLayout = true;
    const wbCol = header.findIndex((h) => h.includes("WAYBILL"));
    const clientCol = header.findIndex((h) => h.includes("CLIENT"));
    const plateCol = header.findIndex((h) => h.includes("PLATE"));
    const dateCol = header.findIndex((h) => h === "DATE" || h.includes("DATE"));
    const tempCol = header.findIndex((h) => h.includes("TEMP"));
    const originCol = header.findIndex((h) => h.includes("ORIGIN"));
    const storeCol = header.findIndex((h) => h.includes("STORE"));
    const tollCol = header.findIndex((h) => h.includes("TOLL GATE") || h === "TOLLS");
    const otherCol = header.findIndex((h) => h.includes("OTHER"));
    const feeCol = header.findIndex((h) => h.includes("ENTRY"));
    const dieselCol = header.findIndex((h) => h.includes("DIESEL"));
    const totalExpCol = header.findIndex((h) => h.includes("TOTAL EXPENSE"));
    const truckTypeCol = header.findIndex((h) => h.includes("TRUCK TYPE") || h === "TYPE");
    const rateCol = header.findIndex(
      (h) =>
        h === "RATE" ||
        h === "DELIVERY RATE" ||
        (h.includes("RATE") && !h.includes("FUEL") && !h.includes("DRIVER") && !h.includes("HELPER") && !h.includes("DAILY")),
    );
    const fuelRateCol = header.findIndex((h) => h.includes("FUEL"));
    const kmCol = header.findIndex((h) => h.includes("KM"));

    // Sub-headers for Driver & Helper (ALLOWANCE / DAILY RATE)
    let driverAllowCol = 13;
    let driverRateCol = 14;
    let helperAllowCol = 15;
    let helperRateCol = 16;
    if (rawRows.length > headerIdx + 1 && Array.isArray(rawRows[headerIdx + 1])) {
      const subHeader = (rawRows[headerIdx + 1] as unknown[]).map((c) =>
        String(c ?? "").toUpperCase().trim(),
      );
      const dAllow = subHeader.findIndex((c, i) => c === "ALLOWANCE" && i < 15);
      const dRate = subHeader.findIndex((c, i) => c.includes("RATE") && i < 16);
      const hAllow = subHeader.findIndex((c, i) => c === "ALLOWANCE" && i >= 15);
      const hRate = subHeader.findIndex((c, i) => c.includes("RATE") && i >= 16);
      if (dAllow >= 0) driverAllowCol = dAllow;
      if (dRate >= 0) driverRateCol = dRate;
      if (hAllow >= 0) helperAllowCol = hAllow;
      if (hRate >= 0) helperRateCol = hRate;
    }

    let clientCarry = "";

    for (let r = headerIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!Array.isArray(row) || row.every((c) => String(c ?? "").trim().length === 0)) continue;

      const rowText = row.map((c) => String(c ?? "")).join(" ").toUpperCase();
      if (rowText.includes("ALLOWANCE") && rowText.includes("DAILY RATE")) continue;
      if (rowText.includes("TOTAL") || rowText.includes("DAILY TRIP REPORT")) {
        if (rowText.includes("DAILY TRIP REPORT")) sectionDate = parseDateFromTitle(rowText);
        continue;
      }

      const rawWb = wbCol >= 0 ? String(row[wbCol] ?? "").trim() : "";
      const plate = plateCol >= 0 ? String(row[plateCol] ?? "").trim().toUpperCase() : "";
      if (!plate && !rawWb) continue;

      const rawClient = clientCol >= 0 ? String(row[clientCol] ?? "").trim() : "";
      if (rawClient) clientCarry = rawClient;

      const rawDate = dateCol >= 0 ? row[dateCol] : "";
      let parsedDate = parseExcelSerialDate(rawDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) parsedDate = sectionDate;

      const temp = tempCol >= 0 ? normalizeTemperature(String(row[tempCol] ?? "")) : "-18°C";
      const origin = originCol >= 0 ? String(row[originCol] ?? "").trim() || "Central Depot" : "Central Depot";
      const distance = kmCol >= 0 ? cleanNumeric(row[kmCol]) ?? 50 : 50;
      const fuelRate = fuelRateCol >= 0 ? cleanNumeric(row[fuelRateCol]) ?? 85.0 : 85.0;

      const revenue = rateCol >= 0 ? cleanNumeric(row[rateCol]) ?? 0 : 0;
      const diesel = dieselCol >= 0 ? cleanNumeric(row[dieselCol]) : null;
      const tolls = tollCol >= 0 ? cleanNumeric(row[tollCol]) : null;
      const other = otherCol >= 0 ? cleanNumeric(row[otherCol]) : null;
      const overallEntryFee = feeCol >= 0 ? cleanNumeric(row[feeCol]) : null;

      const drvAllow = driverAllowCol >= 0 ? cleanNumeric(row[driverAllowCol]) : null;
      const drvRate = driverRateCol >= 0 ? cleanNumeric(row[driverRateCol]) : null;
      const hlpAllow = helperAllowCol >= 0 ? cleanNumeric(row[helperAllowCol]) : null;
      const hlpRate = helperRateCol >= 0 ? cleanNumeric(row[helperRateCol]) : null;

      // Toll Plaza Breakdown notes from columns after KM
      const tollStartCol = Math.max(kmCol + 1, 23);
      const tollPlazaNotes: string[] = [];
      for (let c = tollStartCol; c < row.length; c++) {
        const val = String(row[c] ?? "").trim();
        if (val) {
          tollPlazaNotes.push(val.replace(/\n+/g, " "));
        }
      }
      const tollGateBreakdown = tollPlazaNotes.join(", ");

      // Split store drop-offs by newline or slash
      const rawStores = storeCol >= 0 ? String(row[storeCol] ?? "").trim() : "";
      const storeNames = rawStores
        ? rawStores.split(/[\n/]/).map((s) => s.trim()).filter(Boolean)
        : [];
      const dropoffs: StagedDropoff[] = (storeNames.length > 0 ? storeNames : ["Main Store"]).map((storeName) => ({
        storeName,
        destinationArea: "Metro Manila",
        dropoffCount: 1,
        entryFee: null, // individual stop fee (overall fee is mapped to entryFees)
      }));

      const totalExpVal = totalExpCol >= 0 ? cleanNumeric(row[totalExpCol]) : null;
      const truckType = normalizeTruckType(truckTypeCol >= 0 ? String(row[truckTypeCol] ?? "") : undefined);

      let truckOwnership: "Owned" | "Subcontracted" = "Owned";
      const regTruck = getFleetTrucks().find((t) => t.plateNumber.replace(/\s+/g, "").toUpperCase() === plate.replace(/\s+/g, "").toUpperCase());
      if (regTruck) {
        truckOwnership = regTruck.ownershipType;
      } else if (totalExpVal != null && totalExpVal > 0 && diesel == null && drvRate == null && hlpRate == null) {
        truckOwnership = "Subcontracted";
      }

      const totalExpenses = truckOwnership === "Subcontracted"
        ? (totalExpVal ?? other ?? 0)
        : (totalExpVal ?? ((diesel ?? 0) + (tolls ?? 0) + (drvRate ?? 0) + (drvAllow ?? 0) + (hlpRate ?? 0) + (hlpAllow ?? 0) + (other ?? 0) + (overallEntryFee ?? 0)));

      totalRawRows++;

      const stagedRow: StagedDeliveryRow = {
        id: `dtr-${totalRawRows}-${Date.now().toString(36)}`,
        rowNumber: totalRawRows,
        waybillNumber: rawWb,
        deliveryDate: parsedDate,
        clientName: clientCarry || "Unknown Client",
        plateNumber: plate,
        truckType,
        truckOwnership,
        truckTemperature: temp,
        origin,
        distanceKm: distance,
        fuelRate,
        deliveryRate: revenue,
        totalExpenses,
        dieselExpenses: truckOwnership === "Subcontracted" ? null : diesel,
        tollGateExpenses: truckOwnership === "Subcontracted" ? null : tolls,
        tollGateBreakdown,
        driverDailyRate: truckOwnership === "Subcontracted" ? null : drvRate,
        driverAllowance: truckOwnership === "Subcontracted" ? null : drvAllow,
        driverName: "Unknown Driver",
        helperDailyRate: truckOwnership === "Subcontracted" ? null : hlpRate,
        helperAllowance: truckOwnership === "Subcontracted" ? null : hlpAllow,
        helperName: "Unknown Helper",
        otherExpenses: other,
        entryFees: overallEntryFee,
        dropoffs,
        status: "ready",
        issues: [],
      };

      const validation = validateStagedRow(stagedRow, existingWaybills, seenWaybillsInBatch);
      stagedRow.status = validation.status;
      stagedRow.issues = validation.issues;
      stagedRow.expectedCompletionStatus = validation.expectedCompletionStatus;

      if (rawWb) seenWaybillsInBatch.add(rawWb);
      stagedRows.push(stagedRow);
    }
  }

  if (!isDtrLayout || stagedRows.length === 0) return null;

  const readyCount = stagedRows.filter((r) => r.status === "ready").length;
  const duplicateCount = stagedRows.filter((r) => r.status === "duplicate").length;
  const attentionCount = stagedRows.filter((r) => r.status === "needs_attention").length;
  const ownedCount = stagedRows.filter((r) => r.truckOwnership === "Owned").length;
  const subconCount = stagedRows.filter((r) => r.truckOwnership === "Subcontracted").length;
  const newTrucksToCreate = stagedRows.filter((r) => r.isNewTruck).length;
  const existingTrucksMatched = stagedRows.length - newTrucksToCreate;
  const newCrewToCreate = stagedRows.filter((r) => r.isNewDriver || r.isNewHelper).length;
  const existingCrewMatched = stagedRows.length - newCrewToCreate;
  const autoCompletedCount = stagedRows.filter((r) => r.status === "ready" && r.expectedCompletionStatus === "Completed").length;
  const incompleteCount = stagedRows.filter((r) => r.expectedCompletionStatus === "Incomplete").length;

  return {
    rows: stagedRows,
    totalRawRows,
    totalGroupedDeliveries: stagedRows.length,
    readyCount,
    attentionCount,
    duplicateCount,
    ownedCount,
    subconCount,
    existingTrucksMatched,
    newTrucksToCreate,
    existingCrewMatched,
    newCrewToCreate,
    autoCompletedCount,
    incompleteCount,
    errors: [],
  };
}

/**
 * Parses binary Excel .xlsx or .xls buffer into a 2D string array.
 */
export function parseXlsxToTable(data: ArrayBuffer | Uint8Array): string[][] {
  try {
    const workbook = XLSX.read(data, { type: "array", cellDates: true });
    const sheetName =
      workbook.SheetNames.find((s) => /deliver|trip|dtr|sheet1/i.test(s)) ||
      workbook.SheetNames[0];
    if (!sheetName) return [];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return [];

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    return rawRows
      .map((row) =>
        Array.isArray(row)
          ? row.map((cell) => {
              if (cell instanceof Date) {
                return cell.toISOString().slice(0, 10);
              }
              return String(cell ?? "").trim();
            })
          : [],
      )
      .filter((row) => row.some((c) => c.length > 0));
  } catch {
    return [];
  }
}

/**
 * Parses and validates an Excel (.xlsx / .xls) buffer into StagedDeliveryRows.
 */
export function parseXlsxDeliveryImport(
  data: ArrayBuffer | Uint8Array,
  existingWaybills?: Set<string>,
): ImportParseResult {
  try {
    const workbook = XLSX.read(data, { type: "array", cellDates: true });
    const dtrResult = parseDailyTripReportWorkbook(workbook, existingWaybills);
    if (dtrResult && dtrResult.rows.length > 0) {
      return dtrResult;
    }
  } catch {
    // Proceed to standard fallback table parsing
  }

  const table = parseXlsxToTable(data);
  if (table.length === 0) {
    return {
      rows: [],
      totalRawRows: 0,
      totalGroupedDeliveries: 0,
      readyCount: 0,
      attentionCount: 0,
      duplicateCount: 0,
      ownedCount: 0,
      subconCount: 0,
      existingTrucksMatched: 0,
      newTrucksToCreate: 0,
      existingCrewMatched: 0,
      newCrewToCreate: 0,
      autoCompletedCount: 0,
      incompleteCount: 0,
      errors: [
        "Unable to read Excel file (.xlsx). Please ensure the spreadsheet has at least one sheet with valid column headers.",
      ],
    };
  }
  return parseDeliveryImportFromTable(table, existingWaybills);
}

/**
 * Generates sample Excel .xlsx binary workbook data.
 */
export function generateSampleXlsx(): Uint8Array {
  const sampleCsv = generateSampleCsv();
  const rows = parseDelimitedText(sampleCsv);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Deliveries");
  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbOut);
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
