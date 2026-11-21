import {
  calculateProfitMargin,
  calculateTripExpenseTotal,
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
  summarizeTruckProfitability,
} from "@/features/deliveries/delivery-domain";
import { FLEET_TRUCKS } from "@/features/deliveries/truck-registry";
import { readBrowserPreviewTrucks } from "@/features/deliveries/browser-preview-trucks";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import type {
  PersistedProfitabilitySummary,
  PersistedTruckSummary,
} from "@/features/deliveries/use-delivery-profitability-summary";

const STORAGE_KEY = "routex-browser-preview-deliveries-v1";
export const BROWSER_PREVIEW_DELIVERIES_CHANGED = "routex:browser-preview-deliveries-changed";

export type BrowserDeliveryFilters = {
  search?: string;
  clientId?: string;
  clientIds?: string[];
  truckId?: string;
  truckIds?: string[];
  status?: string;
  financialState?: "finalized" | "incomplete" | "all" | null;
  podStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

function reconcileDeliveryFinancialState(item: DeliveryLedgerItem): DeliveryLedgerItem {
  const nextStates = { ...(item.expenseStates ?? {}) };
  const expensesObj = (item.expenses ?? {}) as unknown as Record<string, unknown>;
  for (const key of Object.keys(nextStates) as Array<keyof typeof nextStates>) {
    if (typeof expensesObj[key] === "number" && Number.isFinite(expensesObj[key] as number)) {
      nextStates[key] = "confirmed";
    }
  }
  const hasUnknownExpenses = Object.values(nextStates).some((st) => st === "unknown");
  const hasUnconfirmedAmount = Object.entries(nextStates).some(
    ([key, st]) => st === "confirmed" && expensesObj[key] == null,
  );
  if (!hasUnknownExpenses && !hasUnconfirmedAmount && item.deliveryRate != null && item.deliveryRate > 0) {
    const recomputedTotal = calculateTripExpenseTotal(item.expenses, nextStates);
    const recomputedNet =
      recomputedTotal != null && item.deliveryRate != null
        ? item.deliveryRate - recomputedTotal
        : item.netIncome;
    return {
      ...item,
      expenseStates: nextStates,
      totalExpenses: recomputedTotal,
      netIncome: recomputedNet,
      marginPercent: calculateProfitMargin(item.deliveryRate, recomputedNet),
      financialState: "finalized",
      financialIntegrityIssues: [],
    };
  }
  return {
    ...item,
    expenseStates: nextStates,
  };
}

export function readBrowserPreviewDeliveries(): DeliveryLedgerItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return (value as DeliveryLedgerItem[]).map(reconcileDeliveryFinancialState);
  } catch {
    return [];
  }
}

export function saveBrowserPreviewDelivery(delivery: DeliveryLedgerItem): void {
  const current = readBrowserPreviewDeliveries();
  if (current.some((item) => item.waybillNumber === delivery.waybillNumber)) {
    throw new Error(`Waybill ${delivery.waybillNumber} already exists in this browser.`);
  }
  const reconciled = reconcileDeliveryFinancialState(delivery);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([reconciled, ...current]));
  window.dispatchEvent(new Event(BROWSER_PREVIEW_DELIVERIES_CHANGED));
}

export function upsertBrowserPreviewDelivery(delivery: DeliveryLedgerItem): void {
  if (typeof window === "undefined") return;
  const current = readBrowserPreviewDeliveries();
  const reconciled = reconcileDeliveryFinancialState(delivery);
  const next = [
    reconciled,
    ...current.filter(
      (item) => item.id !== reconciled.id && item.waybillNumber !== reconciled.waybillNumber,
    ),
  ];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(BROWSER_PREVIEW_DELIVERIES_CHANGED));
}

export function deleteBrowserPreviewDelivery(deliveryId: string): void {
  if (typeof window === "undefined") return;
  const current = readBrowserPreviewDeliveries();
  const next = current.filter((item) => item.id !== deliveryId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(BROWSER_PREVIEW_DELIVERIES_CHANGED));
}

export function selectBrowserPreviewDeliveries(
  filters: BrowserDeliveryFilters = {},
): DeliveryLedgerItem[] {
  const search = filters.search?.trim().toLocaleLowerCase() ?? "";
  const searchClean = search.replace(/\s+/g, "");
  const allTrucks = [...FLEET_TRUCKS, ...readBrowserPreviewTrucks()];

  return readBrowserPreviewDeliveries().filter((item) => {
    const plateClean = item.plateNumber.toLocaleLowerCase().replace(/\s+/g, "");
    const regTruck = allTrucks.find(
      (t) =>
        t.plateNumber.toUpperCase() === item.plateNumber.toUpperCase() ||
        t.id === item.truckId,
    );
    const truckerName = (regTruck?.provider ?? "").toLocaleLowerCase();

    const searchable = [
      item.waybillNumber,
      item.clientName,
      item.plateNumber,
      plateClean,
      truckerName,
      item.driverName ?? "",
      item.notes ?? "",
      ...item.dropoffs.flatMap((dropoff) => [dropoff.storeName, dropoff.destinationArea]),
    ].join(" ").toLocaleLowerCase();
    const matchesClient =
      filters.clientIds && filters.clientIds.length > 0
        ? filters.clientIds.includes(item.clientId)
        : !filters.clientId || item.clientId === filters.clientId;

    const matchesTruck =
      filters.truckIds && filters.truckIds.length > 0
        ? filters.truckIds.some(
            (idOrPlate) =>
              item.truckId === idOrPlate ||
              item.plateNumber.toUpperCase() === idOrPlate.toUpperCase() ||
              plateClean === idOrPlate.replace(/\s+/g, "").toLowerCase(),
          )
        : !filters.truckId ||
          item.truckId === filters.truckId ||
          item.plateNumber.toUpperCase() === filters.truckId.toUpperCase() ||
          plateClean === filters.truckId.replace(/\s+/g, "").toLowerCase();

    const matchesStatus =
      !filters.status ||
      filters.status === "all" ||
      (filters.status.toLowerCase() === "completed" && !isDeliveryIncomplete(item)) ||
      (filters.status.toLowerCase() === "incomplete" && isDeliveryIncomplete(item)) ||
      item.deliveryStatus.toLowerCase() === filters.status.toLowerCase();

    const matchesFinancial =
      !filters.financialState ||
      filters.financialState === "all" ||
      (filters.financialState === "finalized" && isDeliveryFinanciallyComplete(item)) ||
      (filters.financialState === "incomplete" && !isDeliveryFinanciallyComplete(item)) ||
      item.financialState === filters.financialState;

    return (
      (!search ||
        searchable.includes(search) ||
        (searchClean.length > 0 && plateClean.includes(searchClean))) &&
      matchesClient &&
      matchesTruck &&
      matchesStatus &&
      matchesFinancial &&
      (!filters.podStatus || item.podStatus === filters.podStatus) &&
      (!filters.dateFrom || item.deliveryDate >= filters.dateFrom) &&
      (!filters.dateTo || item.deliveryDate <= filters.dateTo)
    );
  });
}

export function mergeBrowserPreviewSummary(
  summary: PersistedProfitabilitySummary,
  dateFrom: string | null,
  dateTo: string | null,
  includedDeliveryIds: readonly string[] = [],
): PersistedProfitabilitySummary {
  const includedIds = new Set(includedDeliveryIds);
  const local = selectBrowserPreviewDeliveries({
    dateFrom: dateFrom ?? undefined,
    dateTo: dateTo ?? undefined,
  }).filter((item) => isDeliveryFinanciallyComplete(item) && !includedIds.has(item.id));
  if (local.length === 0) return summary;

  const localRevenue = local.reduce((total, item) => total + (item.deliveryRate ?? 0), 0);
  const localExpenses = local.reduce((total, item) => total + (item.totalExpenses ?? 0), 0);
  const localNetIncome = local.reduce((total, item) => total + (item.netIncome ?? 0), 0);
  const trucks = new Map(summary.trucks.map((truck) => [truck.plate_number, truck]));

  for (const localTruck of summarizeTruckProfitability(local)) {
    const existing = trucks.get(localTruck.plateNumber);
    const revenue = (existing?.revenue ?? 0) + localTruck.totalEarnings;
    const expenses = (existing?.expenses ?? 0) + localTruck.totalExpenses;
    const netIncome = (existing?.net_income ?? 0) + localTruck.netProfit;
    trucks.set(localTruck.plateNumber, {
      truck_id: existing?.truck_id ?? local.find((item) => item.plateNumber === localTruck.plateNumber)?.truckId ?? localTruck.plateNumber,
      plate_number: localTruck.plateNumber,
      deliveries: (existing?.deliveries ?? 0) + localTruck.completedTrips,
      revenue,
      expenses,
      net_income: netIncome,
      profit_margin: calculateProfitMargin(revenue, netIncome),
    } satisfies PersistedTruckSummary);
  }

  const revenue = summary.revenue + localRevenue;
  const expenses = summary.expenses + localExpenses;
  const netIncome = summary.netIncome + localNetIncome;
  return {
    deliveries: summary.deliveries + local.length,
    revenue,
    expenses,
    netIncome,
    profitMargin: calculateProfitMargin(revenue, netIncome),
    trucks: [...trucks.values()],
  };
}
