import {
  calculateProfitMargin,
  summarizeTruckProfitability,
} from "@/features/deliveries/delivery-domain";
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
  podStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

function reconcileDeliveryFinancialState(item: DeliveryLedgerItem): DeliveryLedgerItem {
  if (item.financialState === "incomplete") {
    const hasUnknownExpenses = Object.values(item.expenseStates ?? {}).some(
      (st) => st === "unknown"
    );
    const hasUnconfirmedAmount = Object.entries(item.expenseStates ?? {}).some(
      ([key, st]) => st === "confirmed" && (item.expenses as unknown as Record<string, unknown>)?.[key] == null
    );
    const hasIssues = (item.financialIntegrityIssues?.length ?? 0) > 0;
    if (!hasUnknownExpenses && !hasUnconfirmedAmount && !hasIssues && item.deliveryRate != null && item.deliveryRate > 0) {
      return {
        ...item,
        financialState: "finalized",
        financialIntegrityIssues: [],
      };
    }
  }
  return item;
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
  return readBrowserPreviewDeliveries().filter((item) => {
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

    return (
      (!search ||
        searchable.includes(search) ||
        (searchClean.length > 0 && plateClean.includes(searchClean))) &&
      matchesClient &&
      matchesTruck &&
      (!filters.status || item.deliveryStatus === filters.status) &&
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
  }).filter((item) => item.financialState === "finalized" && !includedIds.has(item.id));
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
