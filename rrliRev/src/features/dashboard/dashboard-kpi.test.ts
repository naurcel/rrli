import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDashboardProfit,
  calculateMergedExpenses,
  calculateNiceYAxis,
  calculateNiceYRange,
  calculateTopClient,
  buildFinancialTimeSeries,
} from "./dashboard-kpi.ts";
import {
  buildDeliveryTripRecord,
  type DeliveryTripRecord,
} from "../deliveries/delivery-domain.ts";
import type { CompanyExpense } from "../finance/company-expense-domain.ts";

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

// ============================================================================
// 4. calculateNiceYRange & buildFinancialTimeSeries
// ============================================================================

test("calculateNiceYRange produces 0-based floor when all values are positive", () => {
  const result = calculateNiceYRange(0, 50_000);
  assert.equal(result.floor, 0);
  assert.ok(result.ceiling >= 50_000);
  assert.equal(result.ticks[0], 0);
  assert.equal(result.ticks[result.ticks.length - 1], result.ceiling);
});

test("calculateNiceYRange handles negative values with clean steps and includes zero", () => {
  const result = calculateNiceYRange(-15_000, 35_000);
  assert.ok(result.floor <= -15_000);
  assert.ok(result.ceiling >= 35_000);
  assert.ok(result.ticks.includes(0), "Ticks array must include 0 as a clean baseline");
  for (let i = 1; i < result.ticks.length; i++) {
    assert.equal(result.ticks[i] - result.ticks[i - 1], result.step);
  }
});

test("buildFinancialTimeSeries merges deliveries and company expenses correctly", () => {
  const trips: DeliveryTripRecord[] = [
    createMockTrip({
      id: "trip-a",
      deliveryDate: "2026-11-05",
      deliveryRate: 20_000,
      expenses: {
        dieselExpenses: 3_000,
        tollGateExpenses: 1_000,
        tollGateBreakdown: "Toll",
        driverAllowance: 1_000,
        helperAllowance: 500,
        driverDailyRate: 800,
        helperDailyRate: 500,
        otherExpenses: 200,
      },
    }),
    createMockTrip({
      id: "trip-incomplete",
      deliveryDate: "2026-11-05",
      deliveryRate: 50_000,
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

  const companyExpenses: CompanyExpense[] = [
    {
      id: "exp-1",
      description: "Warehouse Utilities",
      amount: 4_000,
      expenseDate: "2026-11-05",
      category: "Utilities",
      createdAt: "2026-11-05T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
    },
  ];

  const series = buildFinancialTimeSeries(trips, companyExpenses, {
    startDate: new Date("2026-11-05T00:00:00"),
    endDate: new Date("2026-11-05T00:00:00"),
  });

  assert.equal(series.length, 1);
  const day = series[0];
  assert.equal(day.date, "2026-11-05");
  // Only trip-a is financially complete: rate 20,000, delivery expenses 7,200 (diesel 3000 + toll 1000 + allowance 1500 + rate 1300 + other 200 + stop entryFee 200)
  assert.equal(day.revenue, 20_000);
  assert.equal(day.deliveryExpenses, 7_200);
  assert.equal(day.companyExpenses, 4_000);
  assert.equal(day.expenses, 11_200);
  assert.equal(day.profit, 8_800);
  assert.equal(day.tripCount, 1);
});

test("buildFinancialTimeSeries uses daily points for This Week", () => {
  const series = buildFinancialTimeSeries([], [], {
    startDate: new Date("2026-11-01T00:00:00"),
    endDate: new Date("2026-11-07T00:00:00"),
    preset: "week",
  });

  assert.equal(series.length, 7);
  assert.ok(series.every((point) => point.granularity === "day"));
});

test("buildFinancialTimeSeries uses seven-day buckets for This Month", () => {
  const series = buildFinancialTimeSeries([], [], {
    startDate: new Date("2026-11-01T00:00:00"),
    endDate: new Date("2026-11-30T00:00:00"),
    preset: "month",
  });

  assert.equal(series.length, 5);
  assert.deepEqual(series.map((point) => point.label), ["Nov 1–7", "Nov 8–14", "Nov 15–21", "Nov 22–28", "Nov 29–30"]);
  assert.ok(series.every((point) => point.granularity === "week"));
});

test("buildFinancialTimeSeries uses calendar months for This Year", () => {
  const series = buildFinancialTimeSeries([], [], {
    startDate: new Date("2026-01-01T00:00:00"),
    endDate: new Date("2026-12-31T00:00:00"),
    preset: "year",
  });

  assert.equal(series.length, 12);
  assert.equal(series[0]?.label, "Jan");
  assert.equal(series.at(-1)?.label, "Dec");
  assert.ok(series.every((point) => point.granularity === "month"));
});

test("buildFinancialTimeSeries divides custom ranges into evenly sized buckets", () => {
  const series = buildFinancialTimeSeries([], [], {
    startDate: new Date("2026-11-01T00:00:00"),
    endDate: new Date("2026-11-20T00:00:00"),
    preset: "custom",
  });

  assert.equal(series.length, 8);
  assert.deepEqual(series.map((point) => point.label), ["Nov 1–2", "Nov 3–5", "Nov 6–7", "Nov 8–10", "Nov 11–12", "Nov 13–15", "Nov 16–17", "Nov 18–20"]);
  assert.ok(series.every((point) => point.granularity === "custom"));
});
