import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDashboardProfit,
  calculateMergedExpenses,
  calculateNiceYAxis,
  calculateTopClient,
} from "./dashboard-kpi.ts";
import {
  buildDeliveryTripRecord,
  type DeliveryTripRecord,
} from "../deliveries/delivery-domain.ts";

function createMockTrip(overrides: Partial<Parameters<typeof buildDeliveryTripRecord>[0]> = {}): DeliveryTripRecord {
  return buildDeliveryTripRecord({
    id: "trip-1",
    waybillNumber: "WB-101",
    deliveryDate: "2026-11-05",
    clientName: "Client A",
    plateNumber: "CBD-4321",
    truckType: "6-Wheeler",
    truckTemperature: "-18°C",
    truckOwnership: "Owned",
    rateBasis: "Redeemed Rate",
    origin: "Meycauayan Hub",
    distanceKm: 25,
    fuelRate: 85,
    deliveryRate: 15_000,
    expenses: {
      dieselExpenses: 2_500,
      tollGateExpenses: 500,
      tollGateBreakdown: "NLEX: 500",
      driverAllowance: 1_000,
      helperAllowance: 500,
      driverDailyRate: 800,
      helperDailyRate: 500,
      otherExpenses: 0,
    },
    dropoffs: [
      {
        id: "stop-1",
        sequence: 1,
        storeName: "Client A Store 1",
        destinationArea: "Bocaue",
        entryFee: 200,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "DOC-1",
      },
    ],
    ...overrides,
  });
}

// ============================================================================
// 1. calculateNiceYAxis (Evenly Spaced Increments & Graph Scaling)
// ============================================================================

test("calculateNiceYAxis handles zero and negative revenue gracefully", () => {
  const zeroResult = calculateNiceYAxis(0);
  assert.equal(zeroResult.ceiling, 10_000);
  assert.equal(zeroResult.ticks[0], 0);
  assert.ok(zeroResult.ticks.length >= 3);

  const negResult = calculateNiceYAxis(-500);
  assert.equal(negResult.ceiling, 10_000);
});

test("calculateNiceYAxis generates evenly spaced ticks with no decimal fractions", () => {
  const testValues = [1_500, 4_800, 12_000, 24_500, 58_000, 85_000, 150_000, 320_000];

  for (const maxVal of testValues) {
    const res = calculateNiceYAxis(maxVal);

    // Ceiling must be at least the maxVal
    assert.ok(res.ceiling >= maxVal, `Ceiling ${res.ceiling} must be >= maxVal ${maxVal}`);

    // Last tick must equal ceiling
    assert.equal(res.ticks[res.ticks.length - 1], res.ceiling);

    // First tick must be 0
    assert.equal(res.ticks[0], 0);

    // Ticks must be strictly evenly spaced by step
    for (let i = 1; i < res.ticks.length; i++) {
      const diff = res.ticks[i] - res.ticks[i - 1];
      assert.equal(diff, res.step, `Interval between ticks must equal step (${res.step})`);
      assert.equal(Number.isInteger(res.ticks[i]), true, `Tick ${res.ticks[i]} must be an integer`);
    }
  }
});

// ============================================================================
// 2. calculateTopClient (Ranking by Actual Revenue, Ties, Empty State)
// ============================================================================

test("calculateTopClient returns None for empty deliveries or zero revenue", () => {
  const empty = calculateTopClient([]);
  assert.equal(empty.name, "None");
  assert.equal(empty.revenue, 0);
  assert.equal(empty.tripCount, 0);
  assert.equal(empty.isTied, false);

  const onlyIncomplete = [
    createMockTrip({
      expenseStates: {
        dieselExpenses: "unknown",
        tollGateExpenses: "confirmed",
        entryFees: "confirmed",
        driverAllowance: "confirmed",
        helperAllowance: "confirmed",
        driverDailyRate: "confirmed",
        helperDailyRate: "confirmed",
        otherExpenses: "confirmed",
      },
    }),
  ];
  const incompleteResult = calculateTopClient(onlyIncomplete);
  assert.equal(incompleteResult.name, "None");
  assert.equal(incompleteResult.revenue, 0);
});

test("calculateTopClient ranks strictly by actual delivery revenue (not delivery count)", () => {
  const trips: DeliveryTripRecord[] = [
    // Client Small: 3 trips @ ₱2,000 each = ₱6,000 total (3 trips)
    createMockTrip({ id: "t1", clientName: "Client Small", deliveryRate: 2_000 }),
    createMockTrip({ id: "t2", clientName: "Client Small", deliveryRate: 2_000 }),
    createMockTrip({ id: "t3", clientName: "Client Small", deliveryRate: 2_000 }),

    // Client Big: 1 trip @ ₱10,000 = ₱10,000 total (1 trip)
    createMockTrip({ id: "t4", clientName: "Client Big", deliveryRate: 10_000 }),
  ];

  const top = calculateTopClient(trips);
  assert.equal(top.name, "Client Big");
  assert.equal(top.revenue, 10_000);
  assert.equal(top.tripCount, 1);
  assert.equal(top.isTied, false);
});

test("calculateTopClient detects and formats revenue ties correctly", () => {
  const tiedTrips: DeliveryTripRecord[] = [
    createMockTrip({ id: "t1", clientName: "Landers Superstore", deliveryRate: 50_000 }),
    createMockTrip({ id: "t2", clientName: "Puregold Price Club", deliveryRate: 50_000 }),
    createMockTrip({ id: "t3", clientName: "Other Client", deliveryRate: 20_000 }),
  ];

  const result = calculateTopClient(tiedTrips);
  assert.equal(result.isTied, true);
  assert.equal(result.tiedCount, 2);
  assert.equal(result.revenue, 50_000);
  assert.ok(result.name.includes("Landers Superstore"));
  assert.ok(result.name.includes("Puregold Price Club"));
  assert.ok(result.allNames.includes("Landers Superstore, Puregold Price Club"));
});

// ============================================================================
// 3. Merged Expenses & Dashboard Profit Calculations
// ============================================================================

test("calculateMergedExpenses combines delivery and company expenses accurately", () => {
  const merged = calculateMergedExpenses(45_000, 15_000);
  assert.equal(merged, 60_000);

  const zeroCompany = calculateMergedExpenses(30_000, 0);
  assert.equal(zeroCompany, 30_000);
});

test("calculateDashboardProfit computes net profit and margin without anomaly", () => {
  const { profit, profitMargin } = calculateDashboardProfit(100_000, 70_000);
  assert.equal(profit, 30_000);
  assert.equal(profitMargin, 30);

  const netLoss = calculateDashboardProfit(50_000, 60_000);
  assert.equal(netLoss.profit, -10_000);
  assert.equal(netLoss.profitMargin, -20);

  const zeroRev = calculateDashboardProfit(0, 10_000);
  assert.equal(zeroRev.profit, -10_000);
  assert.equal(zeroRev.profitMargin, null);
});
