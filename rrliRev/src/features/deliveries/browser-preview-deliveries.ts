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
  truckId?: string;
  status?: string;
  podStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function readBrowserPreviewDeliveries(): DeliveryLedgerItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value as DeliveryLedgerItem[] : [];
  } catch {
    return [];
  }
}

export function saveBrowserPreviewDelivery(delivery: DeliveryLedgerItem): void {
  const current = readBrowserPreviewDeliveries();
  if (current.some((item) => item.waybillNumber === delivery.waybillNumber)) {
    throw new Error(`Waybill ${delivery.waybillNumber} already exists in this browser.`);
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([delivery, ...current]));
  window.dispatchEvent(new Event(BROWSER_PREVIEW_DELIVERIES_CHANGED));
}

export function selectBrowserPreviewDeliveries(
  filters: BrowserDeliveryFilters = {},
): DeliveryLedgerItem[] {
  const search = filters.search?.trim().toLocaleLowerCase() ?? "";
  return readBrowserPreviewDeliveries().filter((item) => {
    const searchable = [
      item.waybillNumber,
      item.clientName,
      item.plateNumber,
      item.driverName ?? "",
      ...item.dropoffs.flatMap((dropoff) => [dropoff.storeName, dropoff.destinationArea]),
    ].join(" ").toLocaleLowerCase();
    return (
      (!search || searchable.includes(search)) &&
      (!filters.clientId || item.clientId === filters.clientId) &&
      (!filters.truckId || item.truckId === filters.truckId) &&
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
): PersistedProfitabilitySummary {
  const local = selectBrowserPreviewDeliveries({
    dateFrom: dateFrom ?? undefined,
    dateTo: dateTo ?? undefined,
  }).filter((item) => item.financialState === "finalized");
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
