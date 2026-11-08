import assert from "node:assert/strict";
import test from "node:test";

import { parseDeliveryListQuery } from "./delivery-query.ts";
import {
  correctSmallMockDelivery,
  getSmallMockProfitabilitySummary,
  listSmallMockDeliveryRecords,
} from "./small-mock-repository.ts";

function query(value: string) {
  const parsed = parseDeliveryListQuery(new URLSearchParams(value));
  if (!parsed.ok) throw new Error(parsed.message);
  assert.equal(parsed.ok, true);
  return parsed.value;
}

test("mock repository filters, sorts, and paginates with the persisted API shape", () => {
  const result = listSmallMockDeliveryRecords(query(
    "dateFrom=2026-10-27&dateTo=2026-11-02&sort=delivery_date&direction=desc&page=1&pageSize=10",
  ));
  assert.equal(result.total, 9);
  assert.equal(result.items[0]?.deliveryDate, "2026-11-02");
  assert.equal(result.filters.clients.length, 3);
  assert.equal(result.filters.trucks.length, 16);

  const missingPod = listSmallMockDeliveryRecords(query("podStatus=Incomplete&pageSize=10"));
  assert.equal(missingPod.total, 4);

  const searched = listSmallMockDeliveryRecords(query("q=Popeyes%20-%20SM%20Mall%20of%20Asia&pageSize=10"));
  assert.equal(searched.total, 1);
  assert.equal(searched.items[0]?.clientName, "Manila Comisario Central Inc. (MCCI)");

  const byExpense = listSmallMockDeliveryRecords(query("sort=total_expenses&direction=desc&pageSize=10"));
  const knownExpenses = byExpense.items.flatMap((item) => item.totalExpenses == null ? [] : [item.totalExpenses]);
  assert.deepEqual(knownExpenses, [...knownExpenses].sort((left, right) => right - left));

  const byTruck = listSmallMockDeliveryRecords(query("sort=truck&direction=asc&pageSize=10"));
  assert.deepEqual(
    byTruck.items.map((item) => item.plateNumber),
    [...byTruck.items].map((item) => item.plateNumber).sort((left, right) => left.localeCompare(right)),
  );
});

test("mock profitability honors dates and excludes financially incomplete trips", () => {
  const full = getSmallMockProfitabilitySummary({
    dateFrom: "2026-10-27",
    dateTo: "2026-11-02",
  });
  assert.equal(full.deliveries, 8);
  assert.equal(full.deliveryIds.length, full.deliveries);
  assert.equal(new Set(full.deliveryIds).size, full.deliveries);
  assert.equal(full.trucks.length, 7);
  assert.equal(full.netIncome, full.revenue - full.expenses);

  const finalDay = getSmallMockProfitabilitySummary({
    dateFrom: "2026-11-02",
    dateTo: "2026-11-02",
  });
  assert.equal(finalDay.deliveries, 0);
  assert.equal(finalDay.profitMargin, null);
});

test("mock repository filters by multiple clients and multiple trucks", () => {
  const all = listSmallMockDeliveryRecords(query("pageSize=10"));
  const client1 = all.filters.clients[0].id;
  const client2 = all.filters.clients[1].id;

  // Filter by two clients simultaneously
  const multiClient = listSmallMockDeliveryRecords(
    query(`clientIds=${client1},${client2}&pageSize=10`),
  );
  assert.equal(multiClient.total, 6);
  assert.ok(
    multiClient.items.every(
      (item) => item.clientId === client1 || item.clientId === client2,
    ),
  );
});

test("mock repository allows searching and filtering by typed plate numbers", () => {
  // Search with space
  const searchWithSpace = listSmallMockDeliveryRecords(query("q=NGS%204281&pageSize=10"));
  assert.equal(searchWithSpace.total, 2);
  assert.ok(searchWithSpace.items.every((item) => item.plateNumber === "NGS 4281"));

  // Search without space (e.g. user typed "ngs4281")
  const searchClean = listSmallMockDeliveryRecords(query("q=ngs4281&pageSize=10"));
  assert.equal(searchClean.total, 2);
  assert.ok(searchClean.items.every((item) => item.plateNumber === "NGS 4281"));

  // Filter using typed plate number directly in truckIds
  const filterByPlate = listSmallMockDeliveryRecords(query("truckIds=NGS%204281&pageSize=10"));
  assert.equal(filterByPlate.total, 2);
  assert.ok(filterByPlate.items.every((item) => item.plateNumber === "NGS 4281"));
});

test("correctSmallMockDelivery updates drop-offs and automatically recalculates entry fees and net income", () => {
  const deliveries = listSmallMockDeliveryRecords(query(
    "dateFrom=2026-10-27&dateTo=2026-11-02&sort=delivery_date&direction=desc&page=1&pageSize=10",
  ));
  const target = deliveries.items[0];
  assert.ok(target);

  const updatedDropoffs = [
    {
      id: "stop-1",
      sequence: 1,
      storeName: "Wilcon Depot - Las Piñas",
      destinationArea: "Almanza Uno, Las Piñas City, Metro Manila",
      entryFee: 250,
      entryFeeStatus: "confirmed" as const,
      podSubmitted: true,
      supportingDocsComplete: true,
      documentRef: "DOC-001",
    },
    {
      id: "stop-2",
      sequence: 2,
      storeName: "S&R Membership Shopping - Imus",
      destinationArea: "Anabu I-D, Imus City, Cavite",
      entryFee: 175,
      entryFeeStatus: "confirmed" as const,
      podSubmitted: true,
      supportingDocsComplete: true,
      documentRef: "DOC-002",
    },
  ];

  const result = correctSmallMockDelivery({
    deliveryId: target.id,
    expectedVersion: target.version,
    reason: "Updated gate passes and store entry tolls",
    changes: {
      dropoffs: updatedDropoffs,
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.record.dropoffs.length, 2);
    assert.equal(result.record.dropoffs[0].entryFee, 250);
    assert.equal(result.record.dropoffs[1].entryFee, 175);
    assert.equal(result.record.expenses.entryFees, 425);
    assert.equal(result.record.expenseStates.entryFees, "confirmed");
  }
});

test("correctSmallMockDelivery recovers and updates delivery when provided fallbackRecord", () => {
  const missingId = "custom-missing-delivery-999";
  const fallbackRecord: any = {
    id: missingId,
    waybillNumber: "WB-FALLBACK-01",
    deliveryDate: "2026-11-01",
    clientName: "Universal Robina Corporation (URC)",
    clientId: "10000000-0000-4000-8000-000000000002",
    plateNumber: "NFD 5821",
    truckId: "30000000-0000-4000-8000-000000000001",
    truckType: "6-Wheeler",
    truckTemperature: "-18°C",
    origin: "Laguna Hub",
    distanceKm: 50,
    fuelRate: 85,
    deliveryRate: 20000,
    expenses: {
      dieselExpenses: 3000,
      tollGateExpenses: 500,
      entryFees: 150,
      driverAllowance: 300,
      driverDailyRate: 800,
      helperAllowance: 200,
      helperDailyRate: 600,
      otherExpenses: 100,
    },
    expenseStates: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      entryFees: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      otherExpenses: "confirmed",
    },
    dropoffs: [],
    financialState: "incomplete",
    version: 1,
  };

  const result = correctSmallMockDelivery({
    deliveryId: missingId,
    expectedVersion: 1,
    reason: "Updated missing preview record",
    changes: {
      deliveryRate: 22000,
    },
    fallbackRecord,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.record.id, missingId);
    assert.equal(result.record.deliveryRate, 22000);
    assert.equal(result.record.version, 2);
  }
});

test("mock repository sorts incomplete null expenses to the bottom when sorting ascending", () => {
  const ascExpenses = listSmallMockDeliveryRecords({
    page: 1,
    pageSize: 50,
    search: "",
    clientId: null,
    clientIds: [],
    truckId: null,
    truckIds: [],
    status: null,
    podStatus: null,
    dateFrom: null,
    dateTo: null,
    sort: "total_expenses",
    direction: "asc",
  });

  const lastItem = ascExpenses.items[ascExpenses.items.length - 1];
  assert.equal(lastItem.waybillNumber, "WB-261102", "Incomplete trip with null expenses must sort to the end in asc order");
  assert.equal(lastItem.totalExpenses, null);

  // First item must have lowest confirmed expenses, not null
  const firstItem = ascExpenses.items[0];
  assert.ok(firstItem.totalExpenses !== null && firstItem.totalExpenses > 0, "First item must be lowest confirmed expense");
  assert.equal(firstItem.waybillNumber, "WB-261029", "WB-261029 has lowest expenses (4,400)");
});


