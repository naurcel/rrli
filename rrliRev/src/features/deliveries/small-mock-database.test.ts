import assert from "node:assert/strict";
import test from "node:test";

import { summarizeTruckProfitability } from "./delivery-domain.ts";
import {
  filterSmallMockDeliveries,
  SMALL_MOCK_DATABASE,
  SMALL_MOCK_PERIOD,
  validateSmallMockDatabase,
} from "./small-mock-database.ts";

test("keeps the RouteX mock database intentionally small and internally related", () => {
  assert.deepEqual(validateSmallMockDatabase(), []);
  assert.deepEqual(
    SMALL_MOCK_DATABASE.clients.map((client) => client.name),
    ["Landers", "Manila Comisario Central Inc. (MCCI)", "Vanguard"],
  );
  assert.equal(SMALL_MOCK_DATABASE.trucks.length, 6);
  assert.deepEqual(
    Object.fromEntries(
      ["4-Wheeler", "6-Wheeler", "10-Wheeler"].map((type) => [
        type,
        SMALL_MOCK_DATABASE.trucks.filter((truck) => truck.truckType === type).length,
      ]),
    ),
    { "4-Wheeler": 3, "6-Wheeler": 2, "10-Wheeler": 1 },
  );
  assert.equal(SMALL_MOCK_DATABASE.drivers.length, 2);
  assert.equal(SMALL_MOCK_DATABASE.helpers.length, 2);
  assert.equal(SMALL_MOCK_DATABASE.deliveries.length, 9);
  assert.equal(
    SMALL_MOCK_DATABASE.deliveries.reduce(
      (count, delivery) => count + delivery.record.dropoffs.length,
      0,
    ),
    12,
  );
});

test("returns exactly three deliveries per client and honors the current seven-day filter", () => {
  for (const client of SMALL_MOCK_DATABASE.clients) {
    assert.equal(filterSmallMockDeliveries({ clientId: client.id }).length, 3);
  }

  assert.equal(
    filterSmallMockDeliveries({
      dateFrom: SMALL_MOCK_PERIOD.start,
      dateTo: SMALL_MOCK_PERIOD.end,
    }).length,
    9,
  );
  assert.equal(
    filterSmallMockDeliveries({ dateFrom: "2026-10-29", dateTo: "2026-10-31" }).length,
    3,
  );
  assert.equal(
    filterSmallMockDeliveries({ dateFrom: "2026-10-01", dateTo: "2026-10-26" }).length,
    0,
  );
});

test("preserves confirmed zero, not applicable, unknown, low-margin, and incomplete scenarios", () => {
  const records = SMALL_MOCK_DATABASE.deliveries.map((delivery) => delivery.record);
  const confirmedZero = records.find((record) => record.waybillNumber === "WB-261028");
  const notApplicable = records.find((record) => record.waybillNumber === "WB-261029");
  const lowMargin = records.find((record) => record.waybillNumber === "WB-261030");
  const incomplete = records.find((record) => record.waybillNumber === "WB-261102");

  assert.equal(confirmedZero?.expenses.otherExpenses, 0);
  assert.equal(confirmedZero?.expenseStates.otherExpenses, "confirmed");
  assert.equal(notApplicable?.expenses.entryFees, null);
  assert.equal(notApplicable?.expenseStates.entryFees, "not_applicable");
  assert.ok(lowMargin?.marginPercent != null && lowMargin.marginPercent < 35);
  assert.equal(incomplete?.expenses.tollGateExpenses, null);
  assert.equal(incomplete?.expenseStates.tollGateExpenses, "unknown");
  assert.equal(incomplete?.totalExpenses, null);
  assert.equal(incomplete?.netIncome, null);
  assert.equal(incomplete?.marginPercent, null);
  assert.equal(incomplete?.financialState, "incomplete");
});

test("excludes the incomplete trip from confirmed truck profitability", () => {
  const records = SMALL_MOCK_DATABASE.deliveries.map((delivery) => delivery.record);
  const summaries = summarizeTruckProfitability(records);

  assert.equal(summaries.length, 6);
  assert.equal(summaries.reduce((count, truck) => count + truck.completedTrips, 0), 8);
  for (const summary of summaries) {
    assert.equal(summary.netProfit, summary.totalEarnings - summary.totalExpenses);
  }
});

test("represents every requested POD document state with explicitly fictional metadata", () => {
  const statuses = new Set(SMALL_MOCK_DATABASE.documents.map((document) => document.status));
  assert.deepEqual([...statuses].sort(), ["Missing", "Rejected", "Submitted", "Verified"]);
  assert.ok(
    SMALL_MOCK_DATABASE.documents
      .filter((document) => document.originalFilename)
      .every((document) => document.originalFilename?.includes("SAMPLE-NOT-SIGNED")),
  );
  assert.ok(
    SMALL_MOCK_DATABASE.documents.some(
      (document) =>
        document.status === "Rejected" && document.verificationNotes?.includes("Needs correction"),
    ),
  );
});

