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
  assert.equal(result.filters.trucks.length, 6);

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
  assert.equal(full.trucks.length, 6);
  assert.equal(full.netIncome, full.revenue - full.expenses);

  const finalDay = getSmallMockProfitabilitySummary({
    dateFrom: "2026-11-02",
    dateTo: "2026-11-02",
  });
  assert.equal(finalDay.deliveries, 0);
  assert.equal(finalDay.profitMargin, null);
});
