import * as XLSX from "xlsx";
import type { DeliveryLedgerItem } from "../deliveries/server/delivery-repository.ts";
import type { FleetTruck } from "../deliveries/truck-registry.ts";
import { FLEET_TRUCKS } from "../deliveries/truck-registry.ts";
import { getFleetCrew, type FleetCrewMember } from "../deliveries/driver-registry.ts";
import type { CompanyExpense } from "../finance/company-expense-domain.ts";
import {
  parseDeliveryImport,
  parseXlsxDeliveryImport,
  type StagedDeliveryRow,
} from "../deliveries/delivery-import-parser.ts";
import {
  parseCsvCompanyExpenseImport,
  parseXlsxCompanyExpenseImport,
  type StagedExpenseRow,
} from "../finance/company-expense-import-parser.ts";

export const ARCHIVE_MACHINE_STORAGE_KEY = "routex-archive-machine-state-v1";
export const ROUTEX_ARCHIVE_MACHINE_CHANGED = "routex:archive-machine-changed";

export interface ArchiveMachineSnapshot {
  id: string;
  fileName: string;
  loadedAt: string;
  archiveYear: number;
  periodLabel: string;
  referenceDate: string; // YYYY-MM-DD (latest date in the archive)
  dateFrom: string | null;
  dateTo: string | null;
  deliveries: DeliveryLedgerItem[];
  companyExpenses: CompanyExpense[];
  trucks: FleetTruck[];
  crew: FleetCrewMember[];
}

let memoryArchiveSnapshot: ArchiveMachineSnapshot | null | undefined = undefined;

export function readArchiveMachineSnapshot(): ArchiveMachineSnapshot | null {
  if (typeof window === "undefined") return null;
  if (memoryArchiveSnapshot !== undefined) return memoryArchiveSnapshot;
  try {
    const raw = window.localStorage.getItem(ARCHIVE_MACHINE_STORAGE_KEY);
    if (!raw) {
      memoryArchiveSnapshot = null;
      return null;
    }
    const parsed = JSON.parse(raw) as ArchiveMachineSnapshot;
    if (!parsed || !Array.isArray(parsed.deliveries)) {
      memoryArchiveSnapshot = null;
      return null;
    }
    memoryArchiveSnapshot = parsed;
    return parsed;
  } catch {
    memoryArchiveSnapshot = null;
    return null;
  }
}

export function isArchiveMachineActive(): boolean {
  return readArchiveMachineSnapshot() !== null;
}

export function activateArchiveMachineSnapshot(snapshot: ArchiveMachineSnapshot): void {
  memoryArchiveSnapshot = snapshot;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ARCHIVE_MACHINE_STORAGE_KEY, JSON.stringify(snapshot));
    window.dispatchEvent(
      new CustomEvent(ROUTEX_ARCHIVE_MACHINE_CHANGED, { detail: snapshot }),
    );
    window.dispatchEvent(new Event("routex:browser-preview-deliveries-changed"));
    window.dispatchEvent(new CustomEvent("routex:company-expenses-changed"));
    window.dispatchEvent(new Event("routex:browser-preview-trucks-changed"));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearArchiveMachineSnapshot(): void {
  memoryArchiveSnapshot = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ARCHIVE_MACHINE_STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent(ROUTEX_ARCHIVE_MACHINE_CHANGED, { detail: null }),
    );
    window.dispatchEvent(new Event("routex:browser-preview-deliveries-changed"));
    window.dispatchEvent(new CustomEvent("routex:company-expenses-changed"));
    window.dispatchEvent(new Event("routex:browser-preview-trucks-changed"));
  } catch {
    // Ignore storage errors
  }
}

function deriveArchiveDates(
  deliveries: readonly DeliveryLedgerItem[],
  expenses: readonly CompanyExpense[],
  explicitFrom?: string | null,
  explicitTo?: string | null,
  explicitPeriodLabel?: string | null,
): {
  archiveYear: number;
  referenceDate: string;
  dateFrom: string | null;
  dateTo: string | null;
  periodLabel: string;
} {
  const allDates: string[] = [];
  for (const d of deliveries) {
    if (d.deliveryDate && /^\d{4}-\d{2}-\d{2}/.test(d.deliveryDate)) {
      allDates.push(d.deliveryDate.slice(0, 10));
    }
  }
  for (const e of expenses) {
    if (e.expenseDate && /^\d{4}-\d{2}-\d{2}/.test(e.expenseDate)) {
      allDates.push(e.expenseDate.slice(0, 10));
    }
  }
  allDates.sort();

  const minDate = explicitFrom || allDates[0] || "2026-01-01";
  const maxDate = explicitTo || allDates[allDates.length - 1] || minDate;
  const referenceDate = maxDate;
  const parsedYear = Number(referenceDate.slice(0, 4));
  const archiveYear = Number.isFinite(parsedYear) && parsedYear >= 2000 ? parsedYear : 2026;

  let periodLabel = explicitPeriodLabel?.trim() || "";
  if (!periodLabel) {
    if (allDates.length > 0) {
      const minYear = minDate.slice(0, 4);
      const maxYear = maxDate.slice(0, 4);
      periodLabel =
        minDate === maxDate
          ? minDate
          : minYear === maxYear
            ? `${minYear} (${minDate} to ${maxDate})`
            : `${minDate} to ${maxDate}`;
    } else {
      periodLabel = `Year ${archiveYear}`;
    }
  }

  return {
    archiveYear,
    referenceDate,
    dateFrom: allDates.length > 0 ? minDate : explicitFrom ?? null,
    dateTo: allDates.length > 0 ? maxDate : explicitTo ?? null,
    periodLabel,
  };
}

function stagedDeliveryToLedgerItem(row: StagedDeliveryRow, index: number): DeliveryLedgerItem {
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
  const waybill = row.waybillNumber.trim() || `ARC-WB-${index + 1}`;

  return {
    id: `archive-deliv-${waybill}-${index}`,
    clientId: row.clientName,
    truckId: row.plateNumber,
    deliveryDate: row.deliveryDate,
    clientName: row.clientName,
    plateNumber: row.plateNumber,
    driverName: row.driverName ?? "Unknown Driver",
    helperName: row.helperName ?? "Unknown Helper",
    truckType: row.truckType || "6-Wheeler",
    truckOwnership: row.truckOwnership || "Owned",
    truckTemperature: row.truckTemperature,
    waybillNumber: waybill,
    deliveryStatus: "Completed",
    dropoffs: row.dropoffs.map((d, stopIdx) => ({
      id: `archive-stop-${index}-${stopIdx}`,
      sequence: stopIdx + 1,
      storeName: d.storeName,
      destinationArea: d.destinationArea,
      dropoffCount: d.dropoffCount || 1,
      entryFee: d.entryFee,
      entryFeeStatus: d.entryFee != null ? "confirmed" : "not_applicable",
      podSubmitted: true,
      supportingDocsComplete: true,
      documentRef: "Archived record",
    })),
    rateBasis: row.truckOwnership === "Subcontracted" ? "Trucker Rate" : "Redeemed Rate",
    origin: row.origin || "Central Depot",
    distanceKm: row.distanceKm || 50,
    fuelRate: row.fuelRate || 85,
    deliveryRate: row.deliveryRate,
    expenses,
    expenseStates,
    totalExpenses,
    netIncome,
    marginPercent,
    financialState: row.deliveryRate > 0 ? "finalized" : "incomplete",
    financialIntegrityIssues: [],
    version: 1,
    podStatus: "Verified",
    notes: row.notes || "Loaded via RouteX Archive Machine",
  };
}

function stagedExpenseToCompanyExpense(row: StagedExpenseRow, index: number): CompanyExpense {
  const txType = row.transactionType === "Incoming" ? "Incoming" : "Outgoing";
  return {
    id: `archive-exp-${index + 1}`,
    expenseDate: row.expenseDate,
    description: row.description,
    amount: row.amount,
    category: txType === "Incoming" ? "Company Income" : "Company Expenses",
    transactionType: txType,
    notes: row.notes || null,
    sourceSheet: row.sourceSheet || null,
    sourceRow: row.sourceRow || null,
    sourceRef: row.sourceRef || null,
    createdBy: "archive",
    createdAt: `${row.expenseDate}T08:00:00.000Z`,
    updatedAt: `${row.expenseDate}T08:00:00.000Z`,
  };
}

function buildTrucksFromDeliveries(
  deliveries: readonly DeliveryLedgerItem[],
  explicitTrucks?: readonly FleetTruck[],
): FleetTruck[] {
  const map = new Map<string, FleetTruck>();
  for (const t of explicitTrucks ?? FLEET_TRUCKS) {
    map.set(t.plateNumber.toUpperCase(), t);
  }
  for (const d of deliveries) {
    const key = d.plateNumber.trim().toUpperCase();
    if (!key || map.has(key)) continue;
    map.set(key, {
      id: `archive-truck-${key.replace(/[^A-Z0-9]/g, "")}`,
      plateNumber: key,
      truckType: d.truckType || "6-Wheeler",
      ownershipType: d.truckOwnership || "Owned",
      rateBasis: d.truckOwnership === "Subcontracted" ? "Trucker Rate" : "Redeemed Rate",
      provider: d.truckOwnership === "Subcontracted" ? "Subcontracted Trucker" : "Redeemed Route",
      driverName: d.driverName || "Unknown Driver",
      helperName: d.helperName || "Unknown Helper",
    });
  }
  return Array.from(map.values());
}

/**
 * Parses an exported JSON database snapshot, Offline HTML Web App recreation,
 * SQL database dump, multi-table CSV bundle, or DTR / Finance CSV into an ArchiveMachineSnapshot.
 */
export function parseArchiveMachineText(
  content: string,
  fileName: string,
): ArchiveMachineSnapshot {
  const trimmed = content.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    throw new Error("The selected archive file is empty.");
  }

  // 1. Offline HTML Website Recreation (contains `const SNAPSHOT = {...};`)
  if (trimmed.startsWith("<!DOCTYPE html") || trimmed.includes("const SNAPSHOT =")) {
    const match = trimmed.match(/const\s+SNAPSHOT\s*=\s*(\{[\s\S]*?\});\s*\n\s*const\s+peso/);
    const fallbackMatch = !match ? trimmed.match(/const\s+SNAPSHOT\s*=\s*(\{[\s\S]*?\});/) : null;
    const jsonStr = match?.[1] ?? fallbackMatch?.[1];
    if (!jsonStr) {
      throw new Error("Could not extract RouteX database snapshot from HTML file.");
    }
    const payload = JSON.parse(jsonStr) as {
      periodLabel?: string;
      dateFrom?: string | null;
      dateTo?: string | null;
      deliveries?: DeliveryLedgerItem[];
      companyExpenses?: CompanyExpense[];
      trucks?: FleetTruck[];
      crew?: FleetCrewMember[];
    };
    const deliveries = Array.isArray(payload.deliveries) ? payload.deliveries : [];
    const companyExpenses = Array.isArray(payload.companyExpenses) ? payload.companyExpenses : [];
    const meta = deriveArchiveDates(
      deliveries,
      companyExpenses,
      payload.dateFrom,
      payload.dateTo,
      payload.periodLabel,
    );
    return {
      id: `archive-${Date.now()}`,
      fileName,
      loadedAt: new Date().toISOString(),
      ...meta,
      deliveries,
      companyExpenses,
      trucks: buildTrucksFromDeliveries(deliveries, payload.trucks),
      crew: Array.isArray(payload.crew) && payload.crew.length > 0 ? [...payload.crew] : [...getFleetCrew()],
    };
  }

  // 2. JSON Database Snapshot (.json)
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as {
      schemaVersion?: string;
      exportMetadata?: {
        periodLabel?: string;
        dateFrom?: string | null;
        dateTo?: string | null;
      };
      periodLabel?: string;
      dateFrom?: string | null;
      dateTo?: string | null;
      tables?: {
        deliveries?: DeliveryLedgerItem[];
        company_expenses?: CompanyExpense[];
        trucks?: FleetTruck[];
        crew?: FleetCrewMember[];
      };
      deliveries?: DeliveryLedgerItem[];
      companyExpenses?: CompanyExpense[];
      trucks?: FleetTruck[];
      crew?: FleetCrewMember[];
    };

    const deliveries =
      parsed.tables?.deliveries ??
      parsed.deliveries ??
      [];
    const companyExpenses =
      parsed.tables?.company_expenses ??
      parsed.companyExpenses ??
      [];
    const trucks = parsed.tables?.trucks ?? parsed.trucks;
    const crew = parsed.tables?.crew ?? parsed.crew;
    const meta = deriveArchiveDates(
      deliveries,
      companyExpenses,
      parsed.exportMetadata?.dateFrom ?? parsed.dateFrom,
      parsed.exportMetadata?.dateTo ?? parsed.dateTo,
      parsed.exportMetadata?.periodLabel ?? parsed.periodLabel,
    );

    return {
      id: `archive-${Date.now()}`,
      fileName,
      loadedAt: new Date().toISOString(),
      ...meta,
      deliveries,
      companyExpenses,
      trucks: buildTrucksFromDeliveries(deliveries, trucks),
      crew: Array.isArray(crew) && crew.length > 0 ? [...crew] : [...getFleetCrew()],
    };
  }

  // 3. SQL Database Dump (.sql)
  if (
    trimmed.includes("INSERT INTO public.deliveries") ||
    trimmed.includes("INSERT INTO public.company_expenses") ||
    trimmed.includes("RouteX Relational Database Export")
  ) {
    return parseSqlDumpToArchiveSnapshot(trimmed, fileName);
  }

  // 4. Complete Datasets Bundle CSV (contains `=== 2. DELIVERIES DATASET ===`)
  if (trimmed.includes("=== 2. DELIVERIES DATASET ===")) {
    return parseDatasetsBundleCsvToArchiveSnapshot(trimmed, fileName);
  }

  // 5. Standard or DTR Delivery CSV / Finance CSV
  const delivParsed = parseDeliveryImport(trimmed);
  if (delivParsed.rows.length > 0) {
    const deliveries = delivParsed.rows.map(stagedDeliveryToLedgerItem);
    const meta = deriveArchiveDates(deliveries, []);
    return {
      id: `archive-${Date.now()}`,
      fileName,
      loadedAt: new Date().toISOString(),
      ...meta,
      deliveries,
      companyExpenses: [],
      trucks: buildTrucksFromDeliveries(deliveries),
      crew: [...getFleetCrew()],
    };
  }

  const expParsed = parseCsvCompanyExpenseImport(trimmed, []);
  if (expParsed.rows.length > 0) {
    const companyExpenses = expParsed.rows.map(stagedExpenseToCompanyExpense);
    const meta = deriveArchiveDates([], companyExpenses);
    return {
      id: `archive-${Date.now()}`,
      fileName,
      loadedAt: new Date().toISOString(),
      ...meta,
      deliveries: [],
      companyExpenses,
      trucks: [...FLEET_TRUCKS],
      crew: [...getFleetCrew()],
    };
  }

  throw new Error(
    "Unrecognized archive file format. Please upload a RouteX exported .xlsx, .csv, .json, .sql, or .html file.",
  );
}

function parseSqlTupleValues(tupleStr: string): Array<string | number | boolean | null> {
  const values: Array<string | number | boolean | null> = [];
  let i = 0;
  const len = tupleStr.length;

  while (i < len) {
    while (i < len && /\s/.test(tupleStr[i])) i++;
    if (i >= len) break;

    if (tupleStr[i] === "'") {
      i++;
      let str = "";
      while (i < len) {
        if (tupleStr[i] === "'" && tupleStr[i + 1] === "'") {
          str += "'";
          i += 2;
        } else if (tupleStr[i] === "'") {
          i++;
          break;
        } else {
          str += tupleStr[i];
          i++;
        }
      }
      values.push(str);
      while (i < len && tupleStr[i] !== ",") i++;
      if (tupleStr[i] === ",") i++;
    } else {
      let token = "";
      while (i < len && tupleStr[i] !== ",") {
        token += tupleStr[i];
        i++;
      }
      if (tupleStr[i] === ",") i++;
      const clean = token.trim();
      if (clean.toUpperCase() === "NULL") values.push(null);
      else if (clean.toUpperCase() === "TRUE") values.push(true);
      else if (clean.toUpperCase() === "FALSE") values.push(false);
      else {
        const num = Number(clean);
        values.push(Number.isFinite(num) ? num : clean);
      }
    }
  }
  return values;
}

function parseSqlDumpToArchiveSnapshot(
  sqlText: string,
  fileName: string,
): ArchiveMachineSnapshot {
  const deliveriesById = new Map<string, DeliveryLedgerItem>();
  const expenses: CompanyExpense[] = [];

  const lines = sqlText.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("INSERT INTO public.deliveries ")) {
      const valIdx = line.indexOf("VALUES (");
      const endIdx = line.lastIndexOf(") ON CONFLICT");
      if (valIdx >= 0 && endIdx > valIdx) {
        const tuple = parseSqlTupleValues(line.slice(valIdx + 8, endIdx));
        const [
          id,
          waybillNumber,
          deliveryDate,
          clientName,
          plateNumber,
          truckType,
          truckTemperature,
          origin,
          distanceKm,
          fuelRate,
          deliveryRate,
          dieselExpenses,
          tollGateExpenses,
          entryFees,
          driverDailyRate,
          driverAllowance,
          helperDailyRate,
          helperAllowance,
          otherExpenses,
          totalExpenses,
          netIncome,
          driverName,
          helperName,
          financialState,
          podStatus,
          version,
        ] = tuple;

        const rateNum = typeof deliveryRate === "number" ? deliveryRate : 0;
        const netNum = typeof netIncome === "number" ? netIncome : 0;
        const item: DeliveryLedgerItem = {
          id: String(id ?? `sql-deliv-${deliveriesById.size + 1}`),
          clientId: String(clientName ?? ""),
          truckId: String(plateNumber ?? ""),
          waybillNumber: String(waybillNumber ?? ""),
          deliveryDate: String(deliveryDate ?? "2026-01-01"),
          clientName: String(clientName ?? ""),
          plateNumber: String(plateNumber ?? ""),
          truckType: (String(truckType || "6-Wheeler") as any),
          truckOwnership:
            dieselExpenses == null && driverDailyRate == null && ( Number(totalExpenses) > 0 || Number(otherExpenses) > 0 )
              ? "Subcontracted"
              : "Owned",
          truckTemperature: (String(truckTemperature || "-18°C") as any),
          rateBasis: "Redeemed Rate",
          origin: String(origin ?? "Central Depot"),
          distanceKm: typeof distanceKm === "number" ? distanceKm : 50,
          fuelRate: typeof fuelRate === "number" ? fuelRate : 85,
          deliveryRate: typeof deliveryRate === "number" ? deliveryRate : null,
          expenses: {
            dieselExpenses: typeof dieselExpenses === "number" ? dieselExpenses : null,
            tollGateExpenses: typeof tollGateExpenses === "number" ? tollGateExpenses : null,
            tollGateBreakdown: "",
            entryFees: typeof entryFees === "number" ? entryFees : null,
            driverDailyRate: typeof driverDailyRate === "number" ? driverDailyRate : null,
            driverAllowance: typeof driverAllowance === "number" ? driverAllowance : null,
            helperDailyRate: typeof helperDailyRate === "number" ? helperDailyRate : null,
            helperAllowance: typeof helperAllowance === "number" ? helperAllowance : null,
            otherExpenses: typeof otherExpenses === "number" ? otherExpenses : null,
          },
          expenseStates: {
            dieselExpenses: dieselExpenses != null ? "confirmed" : "not_applicable",
            tollGateExpenses: tollGateExpenses != null ? "confirmed" : "not_applicable",
            entryFees: entryFees != null ? "confirmed" : "not_applicable",
            driverDailyRate: driverDailyRate != null ? "confirmed" : "not_applicable",
            driverAllowance: driverAllowance != null ? "confirmed" : "not_applicable",
            helperDailyRate: helperDailyRate != null ? "confirmed" : "not_applicable",
            helperAllowance: helperAllowance != null ? "confirmed" : "not_applicable",
            otherExpenses: otherExpenses != null ? "confirmed" : "not_applicable",
          },
          totalExpenses: typeof totalExpenses === "number" ? totalExpenses : 0,
          netIncome: typeof netIncome === "number" ? netIncome : null,
          marginPercent: rateNum > 0 ? (netNum / rateNum) * 100 : null,
          financialState: financialState === "incomplete" ? "incomplete" : "finalized",
          financialIntegrityIssues: [],
          version: typeof version === "number" ? version : 1,
          dropoffs: [],
          podStatus: (String(podStatus || "Verified") as any),
          deliveryStatus: "Completed",
          driverName: driverName ? String(driverName) : "Unknown Driver",
          helperName: helperName ? String(helperName) : "Unknown Helper",
        };
        deliveriesById.set(item.id, item);
      }
    } else if (line.startsWith("INSERT INTO public.delivery_dropoffs ")) {
      const valIdx = line.indexOf("VALUES (");
      const endIdx = line.lastIndexOf(") ON CONFLICT");
      if (valIdx >= 0 && endIdx > valIdx) {
        const tuple = parseSqlTupleValues(line.slice(valIdx + 8, endIdx));
        const [
          id,
          deliveryId,
          sequence,
          storeName,
          destinationArea,
          entryFee,
          entryFeeStatus,
          podSubmitted,
          supportingDocsComplete,
          documentRef,
        ] = tuple;
        const parent = deliveriesById.get(String(deliveryId ?? ""));
        if (parent) {
          parent.dropoffs = [
            ...parent.dropoffs,
            {
              id: String(id ?? `stop-${parent.dropoffs.length + 1}`),
              sequence: typeof sequence === "number" ? sequence : parent.dropoffs.length + 1,
              storeName: String(storeName ?? "Store"),
              destinationArea: String(destinationArea ?? "Metro Manila"),
              dropoffCount: 1,
              entryFee: typeof entryFee === "number" ? entryFee : null,
              entryFeeStatus: (String(entryFeeStatus || "not_applicable") as any),
              podSubmitted: Boolean(podSubmitted),
              supportingDocsComplete: Boolean(supportingDocsComplete),
              documentRef: String(documentRef ?? ""),
            },
          ];
        }
      }
    } else if (line.startsWith("INSERT INTO public.company_expenses ")) {
      const valIdx = line.indexOf("VALUES (");
      const endIdx = line.lastIndexOf(") ON CONFLICT");
      if (valIdx >= 0 && endIdx > valIdx) {
        const tuple = parseSqlTupleValues(line.slice(valIdx + 8, endIdx));
        const [id, expenseDate, description, amount, notes, createdBy] = tuple;
        expenses.push({
          id: String(id ?? `sql-exp-${expenses.length + 1}`),
          expenseDate: String(expenseDate ?? "2026-01-01"),
          description: String(description ?? "Archived Expense"),
          amount: typeof amount === "number" ? amount : Number(amount) || 0,
          category: "Company Expenses",
          transactionType: "Outgoing",
          notes: notes ? String(notes) : null,
          createdBy: createdBy ? String(createdBy) : "archive",
          createdAt: `${String(expenseDate ?? "2026-01-01")}T08:00:00.000Z`,
          updatedAt: `${String(expenseDate ?? "2026-01-01")}T08:00:00.000Z`,
        });
      }
    }
  }

  const deliveries = Array.from(deliveriesById.values()).map((d) =>
    d.dropoffs.length === 0
      ? {
          ...d,
          dropoffs: [
            {
              id: `${d.id}-stop-1`,
              sequence: 1,
              storeName: `${d.clientName} Store`,
              destinationArea: "Metro Manila",
              dropoffCount: 1,
              entryFee: d.expenses.entryFees,
              entryFeeStatus: d.expenses.entryFees != null ? ("confirmed" as const) : ("not_applicable" as const),
              podSubmitted: true,
              supportingDocsComplete: true,
              documentRef: "Archived record",
            },
          ],
        }
      : d,
  );

  const meta = deriveArchiveDates(deliveries, expenses);
  return {
    id: `archive-${Date.now()}`,
    fileName,
    loadedAt: new Date().toISOString(),
    ...meta,
    deliveries,
    companyExpenses: expenses,
    trucks: buildTrucksFromDeliveries(deliveries),
    crew: [...getFleetCrew()],
  };
}

function parseDatasetsBundleCsvToArchiveSnapshot(
  csvText: string,
  fileName: string,
): ArchiveMachineSnapshot {
  const sec2Start = csvText.indexOf("=== 2. DELIVERIES DATASET ===");
  const sec3Start = csvText.indexOf("=== 3. STORE DROP-OFFS & POD DATASET ===");
  const sec5Start = csvText.indexOf("=== 5. COMPANY OPERATING EXPENSES DATASET");
  const sec6Start = csvText.indexOf("=== 6. REFERENCE DAILY TRIP REPORT");

  let deliveries: DeliveryLedgerItem[] = [];
  if (sec6Start >= 0) {
    const sec7Start = csvText.indexOf("=== 7.", sec6Start);
    const dtrSlice = csvText
      .slice(sec6Start, sec7Start > sec6Start ? sec7Start : undefined)
      .split(/\r?\n/)
      .slice(1)
      .join("\n");
    const parsedDtr = parseDeliveryImport(dtrSlice);
    if (parsedDtr.rows.length > 0) {
      deliveries = parsedDtr.rows.map(stagedDeliveryToLedgerItem);
    }
  }

  if (deliveries.length === 0 && sec2Start >= 0) {
    const delivBlock = csvText
      .slice(sec2Start, sec3Start > sec2Start ? sec3Start : undefined)
      .split(/\r?\n/)
      .slice(1)
      .join("\n");
    const parsedDeliv = parseDeliveryImport(delivBlock);
    deliveries = parsedDeliv.rows.map(stagedDeliveryToLedgerItem);
  }

  let companyExpenses: CompanyExpense[] = [];
  if (sec5Start >= 0) {
    const endSec5 = sec6Start > sec5Start ? sec6Start : undefined;
    const expBlock = csvText
      .slice(sec5Start, endSec5)
      .split(/\r?\n/)
      .slice(1)
      .join("\n");
    const parsedExp = parseCsvCompanyExpenseImport(expBlock, []);
    companyExpenses = parsedExp.rows.map(stagedExpenseToCompanyExpense);
  }

  const meta = deriveArchiveDates(deliveries, companyExpenses);
  return {
    id: `archive-${Date.now()}`,
    fileName,
    loadedAt: new Date().toISOString(),
    ...meta,
    deliveries,
    companyExpenses,
    trucks: buildTrucksFromDeliveries(deliveries),
    crew: [...getFleetCrew()],
  };
}

/**
 * Parses an exported Excel workbook (.xlsx) into an ArchiveMachineSnapshot.
 * Supports RouteX Complete Datasets Workbook (.xlsx), Daily Trip Report workbooks,
 * and Company Finance workbooks.
 */
export function parseArchiveMachineWorkbook(
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
): ArchiveMachineSnapshot {
  const delivParsed = parseXlsxDeliveryImport(buffer);
  const deliveries = delivParsed.rows.map(stagedDeliveryToLedgerItem);

  let companyExpenses: CompanyExpense[] = [];
  try {
    const arrayBuf =
      buffer instanceof ArrayBuffer
        ? buffer
        : (buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    const expParsed = parseXlsxCompanyExpenseImport(arrayBuf, [], "all");
    if (expParsed.rows.length > 0) {
      companyExpenses = expParsed.rows.map(stagedExpenseToCompanyExpense);
    }
  } catch {
    // Ignore finance sheet parse errors if workbook is delivery-only
  }

  // Also check if there is a "Company Expenses" sheet in a RouteX Datasets Workbook
  if (companyExpenses.length === 0) {
    try {
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const expSheet = wb.Sheets["Company Expenses"];
      if (expSheet) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(expSheet, { defval: "" });
        rows.forEach((r, idx) => {
          const amt = Number(r["Amount (PHP)"] ?? r["Amount"] ?? 0);
          const dt = String(r["Expense Date"] ?? r["Date"] ?? "").slice(0, 10);
          const desc = String(r["Description"] ?? "").trim();
          if (amt > 0 && dt && desc) {
            const cat = String(r["Category"] ?? "Company Expenses");
            const isInc = /income|revenue|incoming/i.test(cat);
            companyExpenses.push({
              id: String(r["Expense ID"] || `archive-xlsx-exp-${idx + 1}`),
              expenseDate: dt,
              description: desc,
              amount: amt,
              category: isInc ? "Company Income" : "Company Expenses",
              transactionType: isInc ? "Incoming" : "Outgoing",
              notes: String(r["Notes"] ?? "") || null,
              createdBy: String(r["Created By"] ?? "archive"),
              createdAt: `${dt}T08:00:00.000Z`,
              updatedAt: `${dt}T08:00:00.000Z`,
            });
          }
        });
      }
    } catch {
      // Ignore
    }
  }

  if (deliveries.length === 0 && companyExpenses.length === 0) {
    throw new Error(
      "No valid archived deliveries or finance transactions were found in the uploaded Excel workbook.",
    );
  }

  const meta = deriveArchiveDates(deliveries, companyExpenses);
  return {
    id: `archive-${Date.now()}`,
    fileName,
    loadedAt: new Date().toISOString(),
    ...meta,
    deliveries,
    companyExpenses,
    trucks: buildTrucksFromDeliveries(deliveries),
    crew: [...getFleetCrew()],
  };
}
