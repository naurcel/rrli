import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeliveryTripRecord,
  calculateProfitMargin,
  calculateTripExpenseTotal,
  createConfirmedExpenseStates,
  getTripTotalDropoffs,
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
    truckTemperature: "20°C",
    origin: "Test Hub",
    distanceKm: 10,
    fuelRate: 85,
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
    truckTemperature: "-18°C",
    origin: "Marilao Hub",
    distanceKm: 80,
    fuelRate: 85,
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
    truckTemperature: "20°C",
    origin: "Hub",
    distanceKm: 10,
    fuelRate: 85,
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

test("supports locations with multiple drop-offs and accurately counts total drop-offs", () => {
  assert.equal(getTripTotalDropoffs(null), 0);
  assert.equal(getTripTotalDropoffs([]), 0);

  const stops = [
    {
      id: "stop-1",
      sequence: 1,
      storeName: "SM Megamall",
      destinationArea: "Mandaluyong",
      dropoffCount: 3, // 3 drop-offs at this mall/location
      entryFee: 150,
      entryFeeStatus: "confirmed" as const,
      podSubmitted: true,
      supportingDocsComplete: true,
      documentRef: "DOC-1",
    },
    {
      id: "stop-2",
      sequence: 2,
      storeName: "Robinsons Galleria",
      destinationArea: "Quezon City",
      dropoffCount: 2, // 2 drop-offs at this location
      entryFee: 100,
      entryFeeStatus: "confirmed" as const,
      podSubmitted: true,
      supportingDocsComplete: true,
      documentRef: "DOC-2",
    },
    {
      id: "stop-3",
      sequence: 3,
      storeName: "Puregold Taguig",
      destinationArea: "Taguig",
      // default / omitted dropoffCount
      entryFee: 50,
      entryFeeStatus: "confirmed" as const,
      podSubmitted: true,
      supportingDocsComplete: true,
      documentRef: "DOC-3",
    },
  ];

  // 3 locations, but 3 + 2 + 1 = 6 total drop-offs
  assert.equal(getTripTotalDropoffs(stops), 6);

  const trip = buildDeliveryTripRecord({
    id: "dlv-multi-drop",
    waybillNumber: "WB-MULTI-DROP",
    deliveryDate: "2026-11-20",
    clientName: "Multi-Stop Client",
    plateNumber: "NFD 1234",
    truckType: "6-Wheeler",
    truckTemperature: "4°C",
    origin: "Warehouse 1",
    distanceKm: 45,
    fuelRate: 65,
    deliveryRate: 15000,
    expenses,
    expenseStates: createConfirmedExpenseStates(),
    dropoffs: stops,
  });

  assert.equal(trip.dropoffs.length, 3, "Trip has 3 physical locations/stores");
  assert.equal(trip.dropoffs[0].dropoffCount, 3);
  assert.equal(trip.dropoffs[1].dropoffCount, 2);
  assert.equal(trip.dropoffs[2].dropoffCount, 1, "Missing dropoffCount defaults to 1");
  assert.equal(getTripTotalDropoffs(trip.dropoffs), 6, "Total dropoffs equals 6");

  const [truckSummary] = summarizeTruckProfitability([trip]);
  assert.ok(truckSummary);
  assert.equal(truckSummary.completedTrips, 1);
  assert.equal(truckSummary.totalStoresServed, 6, "Total stores served in truck profitability reflects total drop-offs");
});


