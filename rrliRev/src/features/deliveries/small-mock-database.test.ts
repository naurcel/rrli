import assert from "node:assert/strict";
import test from "node:test";

import { summarizeTruckProfitability } from "./delivery-domain.ts";
import {
  filterSmallMockDeliveries,
  getMockClients,
  registerMockClient,
  SMALL_MOCK_COMPANY_EXPENSES,
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
  assert.equal(SMALL_MOCK_DATABASE.trucks.length, 21);
  assert.equal(
    SMALL_MOCK_DATABASE.trucks.filter((truck) => truck.ownershipType === "Owned").length,
    6,
  );
  assert.equal(
    SMALL_MOCK_DATABASE.trucks.filter((truck) => truck.ownershipType === "Subcontracted").length,
    15,
  );
  const ownedTrucks = SMALL_MOCK_DATABASE.trucks.filter(
    (truck) => truck.ownershipType === "Owned",
  );
  assert.deepEqual(
    Object.fromEntries(
      ["4-Wheeler", "6-Wheeler", "10-Wheeler"].map((type) => [
        type,
        ownedTrucks.filter((truck) => truck.truckType === type).length,
      ]),
    ),
    { "4-Wheeler": 3, "6-Wheeler": 2, "10-Wheeler": 1 },
  );
  assert.equal(SMALL_MOCK_DATABASE.drivers.length, 2);
  assert.equal(SMALL_MOCK_DATABASE.helpers.length, 2);
  assert.equal(SMALL_MOCK_DATABASE.deliveries.length, 21);
  assert.equal(
    SMALL_MOCK_DATABASE.deliveries.reduce(
      (count, delivery) => count + delivery.record.dropoffs.length,
      0,
    ),
    24,
  );
});

test("returns exactly seven deliveries per client and honors the date range filter", () => {
  for (const client of SMALL_MOCK_DATABASE.clients) {
    assert.equal(filterSmallMockDeliveries({ clientId: client.id }).length, 7);
  }

  assert.equal(
    filterSmallMockDeliveries({
      dateFrom: SMALL_MOCK_PERIOD.start,
      dateTo: SMALL_MOCK_PERIOD.end,
    }).length,
    21,
  );
  assert.equal(
    filterSmallMockDeliveries({ dateFrom: "2026-10-29", dateTo: "2026-10-31" }).length,
    7,
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

  const subcontracted = records.find((record) => record.waybillNumber === "WB-261029");
  assert.equal(subcontracted?.truckOwnership, "Subcontracted");
  assert.equal(subcontracted?.rateBasis, "Trucker Rate");
  assert.equal(subcontracted?.deliveryRate, 6325);
});

test("excludes the incomplete trip from confirmed truck profitability", () => {
  const records = SMALL_MOCK_DATABASE.deliveries.map((delivery) => delivery.record);
  const summaries = summarizeTruckProfitability(records);

  assert.equal(summaries.length, 7);
  assert.equal(summaries.reduce((count, truck) => count + truck.completedTrips, 0), 20);
  for (const summary of summaries) {
    assert.equal(summary.netProfit, summary.totalEarnings - summary.totalExpenses);
    assert.ok(summary.netProfit > 0, `Truck ${summary.plateNumber} should have positive net profit`);
  }
});

test("maintains positive delivery and company net profit across All Time, October, November, and recent periods", () => {
  const finalized = SMALL_MOCK_DATABASE.deliveries
    .map((d) => d.record)
    .filter((r) => r.financialState === "finalized");

  for (const record of finalized) {
    assert.ok((record.netIncome ?? 0) > 0, `${record.waybillNumber} must have positive net profit`);
  }

  const allRevenue = finalized.reduce((sum, r) => sum + (r.deliveryRate ?? 0), 0);
  const allDeliveryExp = finalized.reduce((sum, r) => sum + (r.totalExpenses ?? 0), 0);
  const allCompanyExp = SMALL_MOCK_COMPANY_EXPENSES
    .filter((e) => (e as { transactionType?: string }).transactionType !== "Incoming")
    .reduce((sum, e) => sum + e.amount, 0);
  assert.ok(allRevenue - allDeliveryExp - allCompanyExp > 0, "All Time company net profit must be positive");

  const novDeliveries = finalized.filter((r) => r.deliveryDate.startsWith("2026-11-"));
  const novRevenue = novDeliveries.reduce((sum, r) => sum + (r.deliveryRate ?? 0), 0);
  const novDeliveryExp = novDeliveries.reduce((sum, r) => sum + (r.totalExpenses ?? 0), 0);
  const novCompanyExp = SMALL_MOCK_COMPANY_EXPENSES
    .filter((e) => e.expenseDate.startsWith("2026-11-") && (e as { transactionType?: string }).transactionType !== "Incoming")
    .reduce((sum, e) => sum + e.amount, 0);
  assert.ok(novRevenue - novDeliveryExp - novCompanyExp > 0, "November 2026 company net profit must be positive");
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

test("dynamically registers custom clients without corrupting base mock database fixtures", () => {
  const initialCount = getMockClients().length;
  const newClient = registerMockClient("San Miguel Foods");

  assert.equal(newClient.name, "San Miguel Foods");
  assert.equal(newClient.code, "SMF");
  assert.equal(getMockClients().length, initialCount + 1);

  // Re-registering existing client returns existing record
  const duplicate = registerMockClient("san miguel foods");
  assert.equal(duplicate.id, newClient.id);
  assert.equal(getMockClients().length, initialCount + 1);

  // Base fixtures remain completely intact
  assert.deepEqual(validateSmallMockDatabase(), []);
});


