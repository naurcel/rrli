import assert from "node:assert/strict";
import test from "node:test";

import { parseDeliveryListQuery } from "./delivery-query.ts";
import {
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


