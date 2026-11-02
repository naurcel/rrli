import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeliveryTripRecord,
  calculateProfitMargin,
  calculateTripExpenseTotal,
  createConfirmedExpenseStates,
  INITIAL_DELIVERY_TRIP_RECORDS,
  summarizeTruckProfitability,
} from "./delivery-domain.ts";

const expenses = {
  dieselExpenses: 0,
  tollGateExpenses: 0,
  tollGateBreakdown: "",
  entryFees: 0,
  driverAllowance: 0,
  driverDailyRate: 0,
  helperAllowance: 0,
  helperDailyRate: 0,
  otherExpenses: 0,
};

test("distinguishes confirmed zero, not applicable, and unknown expenses", () => {
  const confirmed = createConfirmedExpenseStates();
  assert.equal(calculateTripExpenseTotal(expenses, confirmed), 0);

  assert.equal(
    calculateTripExpenseTotal(
      { ...expenses, tollGateExpenses: null },
      { ...confirmed, tollGateExpenses: "not_applicable" },
    ),
    0,
  );

  assert.equal(
    calculateTripExpenseTotal(
      { ...expenses, tollGateExpenses: null },
      { ...confirmed, tollGateExpenses: "unknown" },
    ),
    null,
  );
});

test("preserves a not-applicable aggregate entry fee as null", () => {
  const trip = buildDeliveryTripRecord({
    id: "dlv-na-entry-fee",
    waybillNumber: "WB-NA-ENTRY",
    deliveryDate: "2026-06-03",
    clientName: "Test Client Corp.",
    plateNumber: "AAA 1001",
    truckType: "6-Wheeler",
    truckTemperature: "Ambient",
    origin: "Test Hub",
    distanceKm: 10,
    fuelRate: 60,
    deliveryRate: 1000,
    expenses: { ...expenses, entryFees: null },
    dropoffs: [{
      id: "stop-na-entry",
      sequence: 1,
      storeName: "Sample Store",
      destinationArea: "Sample Area",
      entryFee: null,
      entryFeeStatus: "not_applicable",
      podSubmitted: false,
      supportingDocsComplete: false,
      documentRef: "",
    }],
  });

  assert.equal(trip.expenses.entryFees, null);
  assert.equal(trip.expenseStates.entryFees, "not_applicable");
  assert.equal(trip.totalExpenses, 0);
});

test("returns N/A-compatible null margin for zero revenue and preserves losses", () => {
  assert.equal(calculateProfitMargin(0, 0), null);
  assert.equal(calculateProfitMargin(1000, -250), -25);
});

test("computes multi-store delivery expenses, net income, and POD verification status accurately", () => {
  const trip = buildDeliveryTripRecord({
    id: "dlv-test-1",
    waybillNumber: "WB-TEST-900",
    deliveryDate: "2026-11-01",
    clientName: "Test Client Corp.",
    plateNumber: "NGS 4281",
    truckType: "10-Wheeler",
    truckTemperature: "Frozen (-18°C)",
    origin: "Marilao Hub",
    distanceKm: 80,
    fuelRate: 60,
    deliveryRate: 20000,
    expenses: {
      dieselExpenses: 3000,
      tollGateExpenses: 1000,
      tollGateBreakdown: "NLEX ₱1000",
      driverAllowance: 300,
      driverDailyRate: 900,
      helperAllowance: 200,
      helperDailyRate: 600,
      otherExpenses: 100,
    },
    dropoffs: [
      {
        id: "s1",
        sequence: 1,
        storeName: "Store North",
        destinationArea: "QC",
        entryFee: 200,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "POD-1.pdf",
      },
      {
        id: "s2",
        sequence: 2,
        storeName: "Store South",
        destinationArea: "Pasig",
        entryFee: 200,
        podSubmitted: true,
        supportingDocsComplete: false,
        documentRef: "Missing slip",
      },
    ],
  });

  // Entry fees = 200 + 200 = 400; Total expenses = 3000 + 1000 + 400 + 300 + 900 + 200 + 600 + 100 = 6500
  assert.equal(trip.expenses.entryFees, 400);
  assert.equal(trip.deliveryRate, 20000, "revenue remains trip-level across multiple stores");
  assert.equal(trip.totalExpenses, 6500);
  assert.equal(trip.netIncome, 13500);
  assert.equal(trip.marginPercent, 67.5);
  assert.equal(trip.podStatus, "Incomplete");
});

test("aggregates truck profitability summaries across completed deliveries", () => {
  const summaries = summarizeTruckProfitability(INITIAL_DELIVERY_TRIP_RECORDS);
  assert.ok(summaries.length >= 5);

  for (const truck of summaries) {
    assert.equal(truck.netProfit, truck.totalEarnings - truck.totalExpenses);
    assert.ok(truck.totalStoresServed >= truck.completedTrips);
  }
});

test("excludes financially incomplete deliveries from profitability summaries", () => {
  const incomplete = buildDeliveryTripRecord({
    id: "dlv-incomplete",
    waybillNumber: "WB-INCOMPLETE",
    deliveryDate: "2026-11-01",
    clientName: "Test Client Corp.",
    plateNumber: "ZZZ 9999",
    truckType: "6-Wheeler",
    truckTemperature: "Ambient",
    origin: "Hub",
    distanceKm: 10,
    fuelRate: 60,
    deliveryRate: 1000,
    expenses: { ...expenses, tollGateExpenses: null },
    expenseStates: { tollGateExpenses: "unknown" },
    dropoffs: [{
      id: "stop-incomplete",
      sequence: 1,
      storeName: "Store",
      destinationArea: "Area",
      entryFee: 0,
      podSubmitted: false,
      supportingDocsComplete: false,
      documentRef: "",
    }],
  });

  assert.equal(incomplete.financialState, "incomplete");
  assert.equal(incomplete.totalExpenses, null);
  assert.deepEqual(summarizeTruckProfitability([incomplete]), []);
});

