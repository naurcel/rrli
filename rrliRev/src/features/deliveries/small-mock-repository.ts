import fs from "node:fs";
import path from "node:path";

import {
  calculateProfitMargin,
  calculateTripExpenseTotal,
  type DeliveryTripRecord,
  derivePodVerificationStatus,
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
  summarizeTruckProfitability,
} from "./delivery-domain.ts";
import type { DeliveryListQuery } from "./delivery-query.ts";
import {
  getMockClients,
  SMALL_MOCK_DATABASE,
  type SmallMockDelivery,
} from "./small-mock-database.ts";
import { getFleetTrucks } from "./truck-registry.ts";
import { getFleetCrew, getFleetDrivers, registerFleetDriver } from "./driver-registry.ts";
import type {
  DeliveryLedgerItem,
  DeliveryListResult,
} from "./server/delivery-repository.ts";

export const dynamicMockDeliveries: SmallMockDelivery[] = [];
export const deletedDeliveryIds = new Set<string>();

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.execArgv.includes("--test") ||
  process.argv.some((arg) => arg.includes("test"));

const PERSISTED_MOCK_PATH = path.resolve(process.cwd(), ".mock-storage.json");

export function loadPersistedMockDeliveries(): void {
  if (isTestEnv) return;
  try {
    if (fs.existsSync(PERSISTED_MOCK_PATH)) {
      const raw = fs.readFileSync(PERSISTED_MOCK_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.dynamicMockDeliveries)) {
        for (const item of parsed.dynamicMockDeliveries) {
          if (!dynamicMockDeliveries.some((existing) => existing.record.id === item.record.id)) {
            dynamicMockDeliveries.push(item);
          }
        }
      }
      if (Array.isArray(parsed?.deletedDeliveryIds)) {
        for (const id of parsed.deletedDeliveryIds) {
          deletedDeliveryIds.add(id);
        }
      }
    }
  } catch {
    // Ignore read errors
  }
}

export function savePersistedMockDeliveries(): void {
  if (isTestEnv) return;
  try {
    fs.writeFileSync(
      PERSISTED_MOCK_PATH,
      JSON.stringify(
        {
          dynamicMockDeliveries,
          deletedDeliveryIds: Array.from(deletedDeliveryIds),
        },
        null,
        2,
      ),
      "utf-8",
    );
  } catch {
    // Ignore write errors
  }
}

// Initial load
loadPersistedMockDeliveries();

export function getAllMockDeliveries(): SmallMockDelivery[] {
  loadPersistedMockDeliveries();
  return [...SMALL_MOCK_DATABASE.deliveries, ...dynamicMockDeliveries].filter(
    (item) => !deletedDeliveryIds.has(item.record.id),
  );
}

export type SmallMockProfitabilitySummary = {
  deliveryIds: string[];
  deliveries: number;
  revenue: number;
  expenses: number;
  netIncome: number;
  profitMargin: number | null;
  trucks: Array<{
    truck_id: string;
    plate_number: string;
    deliveries: number;
    revenue: number;
    expenses: number;
    net_income: number;
    profit_margin: number | null;
  }>;
};

function ledgerItems(): DeliveryLedgerItem[] {
  const drivers = new Map<string, string>(
    SMALL_MOCK_DATABASE.drivers.map((employee) => [employee.id, employee.fullName]),
  );
  const helpers = new Map<string, string>(
    SMALL_MOCK_DATABASE.helpers.map((employee) => [employee.id, employee.fullName]),
  );

  return getAllMockDeliveries().map((delivery) => ({
    ...delivery.record,
    clientId: delivery.clientId,
    truckId: delivery.truckId,
    deliveryStatus: "Completed",
    driverName: delivery.driverName ?? drivers.get(delivery.driverId) ?? null,
    helperName: delivery.helperName ?? helpers.get(delivery.helperId) ?? null,
  }));
}

function sortableValue(item: DeliveryLedgerItem, sort: DeliveryListQuery["sort"]): string | number | null {
  if (sort === "client") return (item.clientName ?? "").toLocaleLowerCase();
  if (sort === "waybill") return (item.waybillNumber ?? "").toLocaleLowerCase();
  if (sort === "truck") return (item.plateNumber ?? "").toLocaleLowerCase();
  if (sort === "temperature") {
    const raw = item.truckTemperature ?? "";
    const num = Number(raw.replace(/°?c/i, "").trim());
    return Number.isFinite(num) ? num : raw.toLowerCase();
  }
  if (sort === "origin") return (item.origin ?? "").toLocaleLowerCase();
  if (sort === "dropoffs") return item.dropoffs?.length ?? 0;
  if (sort === "distance") return item.distanceKm ?? 0;
  if (sort === "delivery_rate") return item.deliveryRate;
  if (sort === "total_expenses") return item.totalExpenses;
  if (sort === "net_income") return item.netIncome;
  if (sort === "profit_margin") return item.marginPercent;
  if (sort === "pod_status") return (item.podStatus ?? "").toLowerCase();
  return item.deliveryDate ?? "";
}

function compareValues(
  left: string | number | null,
  right: string | number | null,
  direction: DeliveryListQuery["direction"],
): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  const comparison = typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right));
  return direction === "asc" ? comparison : -comparison;
}

export function listSmallMockDeliveryRecords(input: Partial<DeliveryListQuery> = {}): DeliveryListResult {
  const search = (input.search ?? "").toLocaleLowerCase().trim();
  const searchClean = search.replace(/\s+/g, "");
  const matchingBase = ledgerItems().filter((item) => {
    const plateClean = item.plateNumber.toLocaleLowerCase().replace(/\s+/g, "");
    const searchable = [
      item.waybillNumber,
      item.clientName,
      item.plateNumber,
      plateClean,
      item.driverName ?? "",
      ...item.dropoffs.flatMap((dropoff) => [dropoff.storeName, dropoff.destinationArea]),
    ].join(" ").toLocaleLowerCase();

    const matchesClient =
      input.clientIds && input.clientIds.length > 0
        ? input.clientIds.includes(item.clientId)
        : !input.clientId || item.clientId === input.clientId;

    const matchesTruck =
      input.truckIds && input.truckIds.length > 0
        ? input.truckIds.some(
            (idOrPlate) =>
              item.truckId === idOrPlate ||
              item.plateNumber.toUpperCase() === idOrPlate.toUpperCase() ||
              plateClean === idOrPlate.replace(/\s+/g, "").toLowerCase(),
          )
        : !input.truckId ||
          item.truckId === input.truckId ||
          item.plateNumber.toUpperCase() === input.truckId.toUpperCase() ||
          plateClean === input.truckId.replace(/\s+/g, "").toLowerCase();

    return (
      (!search ||
        searchable.includes(search) ||
        (searchClean.length > 0 && plateClean.includes(searchClean))) &&
      matchesClient &&
      matchesTruck &&
      (!input.podStatus || item.podStatus === input.podStatus) &&
      (!input.dateFrom || item.deliveryDate >= input.dateFrom) &&
      (!input.dateTo || item.deliveryDate <= input.dateTo)
    );
  });

  const statusCounts = {
    all: matchingBase.length,
    completed: matchingBase.filter((item) => !isDeliveryIncomplete(item)).length,
    incomplete: matchingBase.filter((item) => isDeliveryIncomplete(item)).length,
  };

  const matchesStatus = (item: DeliveryTripRecord) => {
    if (!input.status || input.status === "all") return true;
    if (input.status.toLowerCase() === "completed") return !isDeliveryIncomplete(item);
    if (input.status.toLowerCase() === "incomplete") return isDeliveryIncomplete(item);
    const customStatus = (item as unknown as { deliveryStatus?: string }).deliveryStatus;
    return Boolean(customStatus && customStatus.toLowerCase() === input.status.toLowerCase());
  };

  const matchesFinancial = (item: DeliveryTripRecord) => {
    if (!input.financialState || input.financialState === "all") return true;
    if (input.financialState === "finalized") return isDeliveryFinanciallyComplete(item);
    if (input.financialState === "incomplete") return !isDeliveryFinanciallyComplete(item);
    return item.financialState === input.financialState;
  };

  const matching = matchingBase.filter((item) => matchesStatus(item) && matchesFinancial(item));

  const sort = input.sort ?? "delivery_date";
  const direction = input.direction ?? "desc";
  matching.sort((left, right) => {
    const compared = compareValues(
      sortableValue(left, sort),
      sortableValue(right, sort),
      direction,
    );
    return compared || left.id.localeCompare(right.id);
  });

  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  const total = matching.length;
  return {
    items: matching.slice(start, start + pageSize),
    total,
    statusCounts,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    filters: {
      clients: getMockClients().map((client) => ({
        id: client.id,
        label: client.name,
      })),
      trucks: getFleetTrucks().map((truck) => ({
        id: truck.id,
        label: truck.plateNumber,
        ownershipType: truck.ownershipType,
      })),
      statuses: ["Completed"],
      podStatuses: ["Verified", "Incomplete", "Pending"],
      drivers: [
        ...SMALL_MOCK_DATABASE.drivers.map((driver) => ({ id: driver.id, label: driver.fullName })),
        ...getFleetDrivers().map((driver) => ({ id: driver.id, label: driver.fullName })),
        ...dynamicMockDeliveries
          .filter((delivery) => Boolean(delivery.driverName))
          .map((delivery) => ({
            id: `driver-${delivery.driverName!.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            label: delivery.driverName!,
          })),
      ].filter((driver, index, all) =>
        all.findIndex((candidate) => candidate.label.toLowerCase() === driver.label.toLowerCase()) === index
      ),
      helpers: [
        ...SMALL_MOCK_DATABASE.helpers.map((helper) => ({ id: helper.id, label: helper.fullName })),
        ...getFleetCrew().filter((c) => c.assignmentType === "Helper").map((h) => ({ id: h.id, label: h.fullName })),
        ...dynamicMockDeliveries
          .filter((delivery) => Boolean(delivery.helperName))
          .flatMap((delivery) => delivery.helperName!.split(/[,/&]/).map((h) => h.trim()))
          .filter(Boolean)
          .map((name) => ({
            id: `helper-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            label: name,
          })),
      ].filter((helper, index, all) =>
        all.findIndex((candidate) => candidate.label.toLowerCase() === helper.label.toLowerCase()) === index
      ),
    },
  };
}

export function getSmallMockProfitabilitySummary(input: {
  dateFrom: string | null;
  dateTo: string | null;
}): SmallMockProfitabilitySummary {
  const eligible = getAllMockDeliveries()
    .map((delivery) => delivery.record)
    .filter((delivery) =>
      isDeliveryFinanciallyComplete(delivery) &&
      (!input.dateFrom || delivery.deliveryDate >= input.dateFrom) &&
      (!input.dateTo || delivery.deliveryDate <= input.dateTo)
    );
  const revenue = eligible.reduce((total, delivery) => total + (delivery.deliveryRate ?? 0), 0);
  const expenses = eligible.reduce((total, delivery) => total + (delivery.totalExpenses ?? 0), 0);
  const netIncome = eligible.reduce((total, delivery) => total + (delivery.netIncome ?? 0), 0);
  const truckIds = new Map<string, string>(
    getFleetTrucks().map((truck) => [truck.plateNumber, truck.id]),
  );

  return {
    deliveryIds: eligible.map((delivery) => delivery.id),
    deliveries: eligible.length,
    revenue,
    expenses,
    netIncome,
    profitMargin: calculateProfitMargin(revenue, netIncome),
    trucks: summarizeTruckProfitability(eligible).map((truck) => ({
      truck_id: truckIds.get(truck.plateNumber) ?? truck.plateNumber,
      plate_number: truck.plateNumber,
      deliveries: truck.completedTrips,
      revenue: truck.totalEarnings,
      expenses: truck.totalExpenses,
      net_income: truck.netProfit,
      profit_margin: truck.marginPercent,
    })),
  };
}

export function updateSmallMockPodState(input: {
  deliveryId: string;
  dropoffId: string;
  expectedVersion: number;
  podSubmitted: boolean;
  supportingDocsComplete: boolean;
  documentRef?: string;
}): { ok: true; version: number; podStatus: string } | { ok: false; error: string } {
  const delivery = getAllMockDeliveries().find(
    (item) => item.record.id === input.deliveryId,
  );
  if (!delivery) {
    return { ok: false, error: "DELIVERY_NOT_FOUND" };
  }
  if (delivery.record.version !== input.expectedVersion) {
    return { ok: false, error: "VERSION_CONFLICT: Expected version does not match current version." };
  }

  const dropoff = delivery.record.dropoffs.find((stop) => stop.id === input.dropoffId);
  if (!dropoff) {
    return { ok: false, error: "DROPOFF_NOT_FOUND" };
  }

  dropoff.podSubmitted = input.podSubmitted;
  dropoff.supportingDocsComplete = input.supportingDocsComplete;
  if (input.documentRef !== undefined) {
    dropoff.documentRef = input.documentRef;
  }

  const existingDoc = SMALL_MOCK_DATABASE.documents.find(
    (doc) => doc.deliveryId === input.deliveryId && doc.dropoffId === input.dropoffId,
  );
  if (existingDoc) {
    (existingDoc as { status: string; originalFilename: string | null }).status = input.podSubmitted && input.supportingDocsComplete
      ? "Verified"
      : input.podSubmitted
        ? "Submitted"
        : "Missing";
    (existingDoc as { status: string; originalFilename: string | null }).originalFilename = input.documentRef ?? null;
  }

  delivery.record.podStatus = derivePodVerificationStatus(delivery.record.dropoffs);
  delivery.record.version += 1;

  return {
    ok: true,
    version: delivery.record.version,
    podStatus: delivery.record.podStatus,
  };
}

export function finalizeSmallMockDelivery(input: {
  deliveryId: string;
  expectedVersion: number;
  fallbackRecord?: DeliveryLedgerItem;
}): { ok: true; version: number } | { ok: false; error: string } {
  loadPersistedMockDeliveries();
  let delivery = getAllMockDeliveries().find(
    (item) => item.record.id === input.deliveryId,
  );
  if (!delivery && input.fallbackRecord) {
    const fallback = input.fallbackRecord;
    const client = getMockClients().find((c) => c.name === fallback.clientName || c.id === fallback.clientId) ?? {
      id: fallback.clientId || crypto.randomUUID(),
      name: fallback.clientName,
    };
    const newMockDelivery: SmallMockDelivery = {
      record: {
        ...fallback,
        version: input.expectedVersion,
      },
      clientId: client.id,
      truckId: fallback.truckId || "truck-1",
      driverId: "",
      helperId: "",
      driverName: fallback.driverName,
      helperName: fallback.helperName,
      scenario: "User-recorded completed delivery.",
    };
    dynamicMockDeliveries.push(newMockDelivery);
    deletedDeliveryIds.delete(input.deliveryId);
    savePersistedMockDeliveries();
    delivery = newMockDelivery;
  }
  if (!delivery) {
    return { ok: false, error: "DELIVERY_NOT_FOUND" };
  }
  if (delivery.record.version !== input.expectedVersion) {
    return { ok: false, error: "VERSION_CONFLICT: Expected version does not match current version." };
  }
  if (delivery.record.financialIntegrityIssues.length > 0) {
    return { ok: false, error: "FINANCIALS_INCOMPLETE: Cannot finalize delivery with unresolved expenses." };
  }

  delivery.record.financialState = "finalized";
  delivery.record.version += 1;
  savePersistedMockDeliveries();

  return { ok: true, version: delivery.record.version };
}

export function correctSmallMockDelivery(input: {
  deliveryId: string;
  expectedVersion: number;
  changes: Record<string, unknown>;
  reason: string;
  fallbackRecord?: DeliveryLedgerItem;
}): { ok: true; version: number; record: DeliveryLedgerItem } | { ok: false; error: string } {
  loadPersistedMockDeliveries();
  let delivery = getAllMockDeliveries().find(
    (item) => item.record.id === input.deliveryId,
  );
  if (!delivery && input.fallbackRecord) {
    const fallback = input.fallbackRecord;
    const client = getMockClients().find((c) => c.name === fallback.clientName || c.id === fallback.clientId) ?? {
      id: fallback.clientId || crypto.randomUUID(),
      name: fallback.clientName,
    };
    const newMockDelivery: SmallMockDelivery = {
      record: {
        ...fallback,
        version: input.expectedVersion,
      },
      clientId: client.id,
      truckId: fallback.truckId || "truck-1",
      driverId: "",
      helperId: "",
      driverName: fallback.driverName,
      helperName: fallback.helperName,
      scenario: "User-recorded completed delivery.",
    };
    dynamicMockDeliveries.push(newMockDelivery);
    deletedDeliveryIds.delete(input.deliveryId);
    savePersistedMockDeliveries();
    delivery = newMockDelivery;
  }
  if (!delivery) {
    return { ok: false, error: "DELIVERY_NOT_FOUND" };
  }
  if (delivery.record.version !== input.expectedVersion) {
    return { ok: false, error: "VERSION_CONFLICT: Expected version does not match current version." };
  }

  const rec = delivery.record;
  if (typeof input.changes.deliveryRate === "number") {
    rec.deliveryRate = input.changes.deliveryRate;
  }
  if (typeof input.changes.driverName === "string") {
    const trimmed = input.changes.driverName.trim();
    delivery.driverName = trimmed || null;
    if (trimmed) {
      registerFleetDriver({ fullName: trimmed, assignmentType: "Driver" });
    }
  }
  if (typeof input.changes.helperName === "string") {
    const trimmed = input.changes.helperName.trim();
    delivery.helperName = trimmed || null;
    if (trimmed) {
      registerFleetDriver({ fullName: trimmed, assignmentType: "Helper" });
    }
  }
  if (input.changes.expenses && typeof input.changes.expenses === "object") {
    Object.assign(rec.expenses, input.changes.expenses);
    for (const [k, v] of Object.entries(input.changes.expenses as Record<string, unknown>)) {
      if (typeof v === "number" && rec.expenseStates[k as keyof typeof rec.expenseStates] === "unknown") {
        rec.expenseStates[k as keyof typeof rec.expenseStates] = "confirmed";
      }
    }
  }
  if (input.changes.expenseStates && typeof input.changes.expenseStates === "object") {
    Object.assign(rec.expenseStates, input.changes.expenseStates);
  }
  if (Array.isArray(input.changes.supportingDocuments)) {
    rec.supportingDocuments = input.changes.supportingDocuments as string[];
  }
  if (Array.isArray(input.changes.dropoffs)) {
    rec.dropoffs = input.changes.dropoffs as typeof rec.dropoffs;
    rec.podStatus = derivePodVerificationStatus(rec.dropoffs);
    if (!input.changes.expenses || !("entryFees" in (input.changes.expenses as object))) {
      const hasUnknown = rec.dropoffs.some((d) => d.entryFeeStatus === "unknown");
      const allNa = rec.dropoffs.length > 0 && rec.dropoffs.every((d) => d.entryFeeStatus === "not_applicable");
      if (hasUnknown) {
        rec.expenses.entryFees = null;
        rec.expenseStates.entryFees = "unknown";
      } else if (allNa) {
        rec.expenses.entryFees = null;
        rec.expenseStates.entryFees = "not_applicable";
      } else {
        rec.expenses.entryFees = rec.dropoffs.reduce((sum, d) => sum + (d.entryFee ?? 0), 0);
        rec.expenseStates.entryFees = "confirmed";
      }
    }
  }

  rec.totalExpenses = calculateTripExpenseTotal(rec.expenses, rec.expenseStates);
  rec.netIncome = rec.totalExpenses == null || rec.deliveryRate == null ? null : rec.deliveryRate - rec.totalExpenses;
  rec.marginPercent = calculateProfitMargin(rec.deliveryRate, rec.netIncome);

  const expenseKeys = [
    "dieselExpenses",
    "tollGateExpenses",
    "entryFees",
    "driverAllowance",
    "driverDailyRate",
    "helperAllowance",
    "helperDailyRate",
    "otherExpenses",
  ] as const;
  rec.financialIntegrityIssues = expenseKeys.flatMap((key) => {
    if (rec.expenseStates[key] === "unknown") return [`${key} is unknown`];
    if (rec.expenseStates[key] === "confirmed" && rec.expenses[key] == null) {
      return [`${key} has no confirmed amount`];
    }
    return [];
  });
  if (typeof input.changes.financialState === "string") {
    rec.financialState =
      input.changes.financialState === "finalized" && rec.financialIntegrityIssues.length === 0
        ? "finalized"
        : "incomplete";
  } else {
    // When editing a delivery: once all expenses are resolved/completed,
    // the delivery is automatically finalized and included in computations.
    rec.financialState =
      rec.financialIntegrityIssues.length === 0 ? "finalized" : "incomplete";
  }
  rec.version += 1;

  savePersistedMockDeliveries();

  const updated = ledgerItems().find((item) => item.id === rec.id);
  if (!updated) return { ok: false, error: "DELIVERY_NOT_FOUND" };
  return { ok: true, version: rec.version, record: updated };
}

export function deleteSmallMockDelivery(deliveryId: string): { ok: true } | { ok: false; error: string } {
  loadPersistedMockDeliveries();
  const all = [...SMALL_MOCK_DATABASE.deliveries, ...dynamicMockDeliveries];
  const exists = all.some((item) => item.record.id === deliveryId);
  if (!exists || deletedDeliveryIds.has(deliveryId)) {
    return { ok: false, error: "DELIVERY_NOT_FOUND" };
  }
  deletedDeliveryIds.add(deliveryId);
  const dynIndex = dynamicMockDeliveries.findIndex((item) => item.record.id === deliveryId);
  if (dynIndex >= 0) {
    dynamicMockDeliveries.splice(dynIndex, 1);
  }
  savePersistedMockDeliveries();
  return { ok: true };
}
