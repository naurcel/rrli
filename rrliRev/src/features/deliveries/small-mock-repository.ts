import {
  calculateProfitMargin,
  calculateTripExpenseTotal,
  derivePodVerificationStatus,
  summarizeTruckProfitability,
} from "./delivery-domain.ts";
import type { DeliveryListQuery } from "./delivery-query.ts";
import {
  getMockClients,
  SMALL_MOCK_DATABASE,
  type SmallMockDelivery,
} from "./small-mock-database.ts";
import { getFleetTrucks } from "./truck-registry.ts";
import type {
  DeliveryLedgerItem,
  DeliveryListResult,
} from "./server/delivery-repository.ts";

export const dynamicMockDeliveries: SmallMockDelivery[] = [];

export function getAllMockDeliveries(): SmallMockDelivery[] {
  return [...SMALL_MOCK_DATABASE.deliveries, ...dynamicMockDeliveries];
}

export type SmallMockProfitabilitySummary = {
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
    driverName: drivers.get(delivery.driverId) ?? null,
    helperName: helpers.get(delivery.helperId) ?? null,
  }));
}

function sortableValue(item: DeliveryLedgerItem, sort: DeliveryListQuery["sort"]): string | number | null {
  if (sort === "client") return item.clientName.toLocaleLowerCase();
  if (sort === "waybill") return item.waybillNumber.toLocaleLowerCase();
  if (sort === "truck") return item.plateNumber.toLocaleLowerCase();
  if (sort === "temperature") {
    const num = Number(item.truckTemperature.replace(/°?c/i, "").trim());
    return Number.isFinite(num) ? num : item.truckTemperature;
  }
  if (sort === "origin") return item.origin.toLocaleLowerCase();
  if (sort === "distance") return item.distanceKm;
  if (sort === "delivery_rate") return item.deliveryRate;
  if (sort === "total_expenses") return item.totalExpenses;
  if (sort === "net_income") return item.netIncome;
  if (sort === "profit_margin") return item.marginPercent;
  if (sort === "pod_status") return item.podStatus;
  return item.deliveryDate;
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

export function listSmallMockDeliveryRecords(input: DeliveryListQuery): DeliveryListResult {
  const search = input.search.toLocaleLowerCase().trim();
  const searchClean = search.replace(/\s+/g, "");
  const matching = ledgerItems().filter((item) => {
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
      (!input.status || item.deliveryStatus === input.status) &&
      (!input.podStatus || item.podStatus === input.podStatus) &&
      (!input.dateFrom || item.deliveryDate >= input.dateFrom) &&
      (!input.dateTo || item.deliveryDate <= input.dateTo)
    );
  });

  matching.sort((left, right) => {
    const compared = compareValues(
      sortableValue(left, input.sort),
      sortableValue(right, input.sort),
      input.direction,
    );
    return compared || left.id.localeCompare(right.id);
  });

  const start = (input.page - 1) * input.pageSize;
  const total = matching.length;
  return {
    items: matching.slice(start, start + input.pageSize),
    total,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
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
      delivery.financialState === "finalized" &&
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
}): { ok: true; version: number } | { ok: false; error: string } {
  const delivery = getAllMockDeliveries().find(
    (item) => item.record.id === input.deliveryId,
  );
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

  return { ok: true, version: delivery.record.version };
}

export function correctSmallMockDelivery(input: {
  deliveryId: string;
  expectedVersion: number;
  changes: Record<string, unknown>;
  reason: string;
}): { ok: true; version: number } | { ok: false; error: string } {
  const delivery = getAllMockDeliveries().find(
    (item) => item.record.id === input.deliveryId,
  );
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
  if (input.changes.expenses && typeof input.changes.expenses === "object") {
    Object.assign(rec.expenses, input.changes.expenses);
  }
  if (input.changes.expenseStates && typeof input.changes.expenseStates === "object") {
    Object.assign(rec.expenseStates, input.changes.expenseStates);
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
  rec.financialState = rec.financialIntegrityIssues.length === 0 ? "finalized" : "incomplete";
  rec.version += 1;

  return { ok: true, version: rec.version };
}
