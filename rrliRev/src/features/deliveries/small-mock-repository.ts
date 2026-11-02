import {
  calculateProfitMargin,
  summarizeTruckProfitability,
} from "./delivery-domain.ts";
import type { DeliveryListQuery } from "./delivery-query.ts";
import { SMALL_MOCK_DATABASE } from "./small-mock-database.ts";
import type {
  DeliveryLedgerItem,
  DeliveryListResult,
} from "./server/delivery-repository.ts";

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
  const drivers = new Map(
    SMALL_MOCK_DATABASE.drivers.map((employee) => [employee.id, employee.fullName]),
  );
  const helpers = new Map(
    SMALL_MOCK_DATABASE.helpers.map((employee) => [employee.id, employee.fullName]),
  );

  return SMALL_MOCK_DATABASE.deliveries.map((delivery) => ({
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
  if (sort === "delivery_rate") return item.deliveryRate;
  if (sort === "net_income") return item.netIncome;
  if (sort === "profit_margin") return item.marginPercent;
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
  const search = input.search.toLocaleLowerCase();
  const matching = ledgerItems().filter((item) => {
    const searchable = [
      item.waybillNumber,
      item.clientName,
      item.plateNumber,
      item.driverName ?? "",
      ...item.dropoffs.flatMap((dropoff) => [dropoff.storeName, dropoff.destinationArea]),
    ].join(" ").toLocaleLowerCase();

    return (
      (!search || searchable.includes(search)) &&
      (!input.clientId || item.clientId === input.clientId) &&
      (!input.truckId || item.truckId === input.truckId) &&
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
      clients: SMALL_MOCK_DATABASE.clients.map((client) => ({
        id: client.id,
        label: client.name,
      })),
      trucks: SMALL_MOCK_DATABASE.trucks.map((truck) => ({
        id: truck.id,
        label: truck.plateNumber,
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
  const eligible = SMALL_MOCK_DATABASE.deliveries
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
    SMALL_MOCK_DATABASE.trucks.map((truck) => [truck.plateNumber, truck.id]),
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
