import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDonutArcs,
  formatExpenseResolutionStatus,
  resolveTripFinancialGroups,
  type ExpenseCategorySlice,
} from "./delivery-breakdown-model.ts";
import type { DeliveryTripRecord } from "./delivery-domain.ts";

test("RouteX: Delivery Breakdown UI & Visualization Improvements", async (t) => {
  await t.test("Donut Arc Trigonometry & Percentage Calculations", () => {
    const slices: ExpenseCategorySlice[] = [
      { id: "diesel", label: "Diesel", amount: 4000, color: "#f59e0b", status: "confirmed" },
      { id: "tolls", label: "Tolls", amount: 1000, color: "#6366f1", status: "confirmed" },
      { id: "crew", label: "Crew", amount: 3000, color: "#0284c7", status: "confirmed" },
      { id: "other", label: "Other", amount: 2000, color: "#8b5cf6", status: "confirmed" },
    ];
    const total = 10000;

    const arcs = computeDonutArcs(slices, total);
    assert.equal(arcs.length, 4, "Should compute 4 distinct arc segments");

    // Check percentages
    assert.equal(arcs[0].percentage, 40.0, "Diesel should be 40%");
    assert.equal(arcs[1].percentage, 10.0, "Tolls should be 10%");
    assert.equal(arcs[2].percentage, 30.0, "Crew should be 30%");
    assert.equal(arcs[3].percentage, 20.0, "Other should be 20%");

    const sumPercentages = arcs.reduce((acc, curr) => acc + curr.percentage, 0);
    assert.equal(Math.round(sumPercentages), 100, "Sum of slice percentages must equal 100%");

    // Verify clockwise angle continuity
    assert.equal(arcs[0].startAngle, -Math.PI / 2, "First arc should start at 12 o'clock (-Math.PI / 2)");
    for (let i = 0; i < arcs.length - 1; i++) {
      assert.ok(
        Math.abs(arcs[i].endAngle - arcs[i + 1].startAngle) < 1e-6,
        `End angle of slice ${i} must match start angle of slice ${i + 1}`,
      );
    }
  });

  await t.test("Single Category / 100% Share Handling", () => {
    const slices: ExpenseCategorySlice[] = [
      { id: "diesel", label: "Diesel", amount: 5000, color: "#f59e0b", status: "confirmed" },
    ];
    const total = 5000;

    const arcs = computeDonutArcs(slices, total);
    assert.equal(arcs.length, 1);
    assert.equal(arcs[0].percentage, 100);
    assert.equal(arcs[0].isFullCircle, true, "Single 100% slice must be flagged as full circle");
    assert.ok(arcs[0].pathD.length > 0, "Should generate valid SVG path string without arc glitch");
  });

  await t.test("Zero Total Expenses Handling", () => {
    const slices: ExpenseCategorySlice[] = [
      { id: "diesel", label: "Diesel", amount: 0, color: "#f59e0b", status: "confirmed" },
      { id: "tolls", label: "Tolls", amount: 0, color: "#6366f1", status: "confirmed" },
    ];

    const arcs = computeDonutArcs(slices, 0);
    assert.equal(arcs.length, 0, "Zero total expenses should return empty arc list without NaN or division by zero");

    const nullArcs = computeDonutArcs(slices, null);
    assert.equal(nullArcs.length, 0, "Null total expenses should return empty arc list");
  });

  await t.test("Zero-Amount Individual Category Handling", () => {
    const slices: ExpenseCategorySlice[] = [
      { id: "diesel", label: "Diesel", amount: 5000, color: "#f59e0b", status: "confirmed" },
      { id: "tolls", label: "Tolls", amount: 0, color: "#6366f1", status: "confirmed" },
    ];
    const total = 5000;

    const arcs = computeDonutArcs(slices, total);
    assert.equal(arcs.length, 1, "Zero amount category should not create a 0-degree degenerate SVG arc");
    assert.equal(arcs[0].slice.id, "diesel");

    const statusRes = formatExpenseResolutionStatus(0, "confirmed");
    assert.equal(statusRes.text, "₱0");
    assert.equal(statusRes.isUnknown, false);
    assert.equal(statusRes.isNotApplicable, false);
  });

  await t.test("Not Applicable Expense Handling", () => {
    const slices: ExpenseCategorySlice[] = [
      { id: "diesel", label: "Diesel", amount: 4000, color: "#f59e0b", status: "confirmed" },
      { id: "tolls", label: "Tolls", amount: 0, color: "#6366f1", status: "not_applicable" },
    ];
    const total = 4000;

    const arcs = computeDonutArcs(slices, total);
    assert.equal(arcs.length, 1, "Not applicable category must not generate an arc");

    const naRes = formatExpenseResolutionStatus(null, "not_applicable");
    assert.equal(naRes.text, "Not applicable");
    assert.equal(naRes.isNotApplicable, true);
    assert.equal(naRes.isUnknown, false);
  });

  await t.test("Handling Incomplete & Unknown Values (Never Treated As Zero)", () => {
    const unknownRes = formatExpenseResolutionStatus(null, "unknown");
    assert.equal(unknownRes.text, "Unconfirmed", "Unknown status must format as Unconfirmed");
    assert.equal(unknownRes.isUnknown, true);
    assert.notEqual(unknownRes.text, "₱0", "Unknown expense must NEVER be displayed as ₱0");

    // Trip with unknown tollGateExpenses
    const incompleteTrip: DeliveryTripRecord & { driverName?: string; helperName?: string } = {
      id: "trip-incomplete-1",
      waybillNumber: "WB-INCOMPLETE-001",
      deliveryDate: "2026-06-01",
      clientName: "Test Supermarket",
      plateNumber: "NBD-1234",
      truckType: "6-Wheeler",
      truckTemperature: "-18°C",
      truckOwnership: "Owned",
      rateBasis: "Redeemed Rate",
      origin: "Navotas",
      distanceKm: 45,
      fuelRate: 85.0,
      deliveryRate: 20000,
      expenses: {
        dieselExpenses: 3000,
        tollGateExpenses: null,
        tollGateBreakdown: "Unknown",
        entryFees: 400,
        driverDailyRate: 900,
        driverAllowance: 300,
        helperDailyRate: 700,
        helperAllowance: 200,
        otherExpenses: 0,
      },
      expenseStates: {
        dieselExpenses: "confirmed",
        tollGateExpenses: "unknown",
        entryFees: "confirmed",
        driverDailyRate: "confirmed",
        driverAllowance: "confirmed",
        helperDailyRate: "confirmed",
        helperAllowance: "confirmed",
        otherExpenses: "confirmed",
      },
      totalExpenses: null,
      netIncome: null,
      marginPercent: null,
      financialState: "incomplete",
      financialIntegrityIssues: ["tollGateExpenses is unknown"],
      version: 1,
      dropoffs: [],
      podStatus: "Incomplete",
    };

    const resolution = resolveTripFinancialGroups(incompleteTrip);
    assert.equal(resolution.isFinanciallyComplete, false, "Must flag record as incomplete");
    assert.deepEqual(resolution.unknownList, ["Highway Tolls"], "Must identify exact unconfirmed items");
    assert.equal(resolution.totalExpenses, null, "Total expenses must remain null to avoid misrepresentation");
    assert.equal(resolution.netIncome, null, "Net income must remain null");
    assert.equal(resolution.marginPercent, null, "Profit margin must remain null");
    assert.equal(resolution.isTransitComplete, false, "Transit subtotal must be flagged as incomplete");
    assert.equal(resolution.transitSubtotal, null, "Transit subtotal must not be computed with missing items");

    // Check that toll gate slice is marked as unknown and not treated as zero in status
    const tollSlice = resolution.expenseSlices.find((s) => s.id === "tolls");
    assert.ok(tollSlice);
    assert.equal(tollSlice.status, "unknown");
  });

  await t.test("Organized Financial Groups & Subtotals for Fully Finalized Trip", () => {
    const finalizedTrip: DeliveryTripRecord & { driverName?: string; helperName?: string } = {
      id: "trip-finalized-1",
      waybillNumber: "WB-FINALIZED-001",
      deliveryDate: "2026-06-02",
      clientName: "Mega Foods Inc",
      plateNumber: "NBD-9999",
      truckType: "4-Wheeler",
      truckTemperature: "-20°C",
      truckOwnership: "Owned",
      rateBasis: "Redeemed Rate",
      origin: "Pasig Cold Hub",
      distanceKm: 60,
      fuelRate: 85.0,
      deliveryRate: 25000,
      expenses: {
        dieselExpenses: 4000,
        tollGateExpenses: 1200,
        tollGateBreakdown: "SLEX + Skyway",
        entryFees: 600,
        driverDailyRate: 1000,
        driverAllowance: 400,
        helperDailyRate: 800,
        helperAllowance: 250,
        otherExpenses: 150,
      },
      expenseStates: {
        dieselExpenses: "confirmed",
        tollGateExpenses: "confirmed",
        entryFees: "confirmed",
        driverDailyRate: "confirmed",
        driverAllowance: "confirmed",
        helperDailyRate: "confirmed",
        helperAllowance: "confirmed",
        otherExpenses: "confirmed",
      },
      totalExpenses: 8400,
      netIncome: 16600,
      marginPercent: 66.4,
      financialState: "finalized",
      financialIntegrityIssues: [],
      version: 1,
      dropoffs: [],
      podStatus: "Verified",
      driverName: "Juan Dela Cruz",
      helperName: "Pedro Santos",
    };

    const resolution = resolveTripFinancialGroups(finalizedTrip);
    assert.equal(resolution.isFinanciallyComplete, true, "Finalized trip must be complete");
    assert.equal(resolution.unknownList.length, 0);

    // Direct Transit Subtotal = 4000 (Diesel) + 1200 (Tolls) + 600 (Entry) + 150 (Other) = 5950
    assert.equal(resolution.isTransitComplete, true);
    assert.equal(resolution.transitSubtotal, 5950);

    // Crew Labor Subtotal = (1000 + 400) + (800 + 250) = 1400 + 1050 = 2450
    assert.equal(resolution.isCrewComplete, true);
    assert.equal(resolution.driverTotal, 1400);
    assert.equal(resolution.helperTotal, 1050);
    assert.equal(resolution.crewSubtotal, 2450);

    // Total Expenses = Transit (5950) + Crew (2450) = 8400
    assert.equal(
      (resolution.transitSubtotal ?? 0) + (resolution.crewSubtotal ?? 0),
      8400,
      "Transit + Crew must reconcile exactly with total expenses",
    );
    assert.equal(resolution.totalExpenses, 8400);
    assert.equal(resolution.netIncome, 16600);
    assert.equal(resolution.marginPercent, 66.4);

    // Donut Slices should compute 6 active slices
    const arcs = computeDonutArcs(resolution.expenseSlices, resolution.totalExpenses);
    assert.equal(arcs.length, 6, "All 6 expense categories should produce slices");
    const arcTotal = arcs.reduce((acc, curr) => acc + curr.slice.amount, 0);
    assert.equal(arcTotal, 8400, "Arc amounts must equal total expenses");
  });
});
