import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeliveryTripRecord,
  getDeliveryIncompleteIssues,
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
} from "./delivery-domain.ts";
import { parseDeliveryListQuery } from "./delivery-query.ts";
import { listSmallMockDeliveryRecords } from "./small-mock-repository.ts";

test("incomplete delivery detection rules: required core items vs optional supporting docs", () => {
  // Base complete delivery
  const completeTrip = buildDeliveryTripRecord({
    id: "test-trip-complete",
    waybillNumber: "WB-TEST-COMPLETE",
    deliveryDate: "2026-11-01",
    clientName: "Test Client",
    plateNumber: "ABC 1234",
    truckType: "6-Wheeler",
    truckTemperature: "4°C",
    origin: "Laguna Hub",
    distanceKm: 50,
    fuelRate: 85,
    deliveryRate: 10000,
    expenses: {
      dieselExpenses: 2000,
      tollGateExpenses: 500,
      tollGateBreakdown: "NLEX round trip",
      driverDailyRate: 800,
      driverAllowance: 200,
      helperDailyRate: 600,
      helperAllowance: 200,
      otherExpenses: 100,
    },
    dropoffs: [
      {
        id: "dropoff-1",
        sequence: 1,
        storeName: "SM Megamall",
        destinationArea: "Mandaluyong",
        entryFee: 150,
        podSubmitted: true,
        supportingDocsComplete: false, // Optional!
        documentRef: "POD-001.pdf",
      },
    ],
    supportingDocuments: [], // Optional!
  });

  // Supporting docs being absent or incomplete must NOT make delivery incomplete
  assert.equal(isDeliveryIncomplete(completeTrip), false);
  assert.equal(isDeliveryFinanciallyComplete(completeTrip), true);
  assert.deepEqual(getDeliveryIncompleteIssues(completeTrip), []);

  // 1. Missing POD makes delivery incomplete, but finances remain complete
  const missingPodTrip: typeof completeTrip = {
    ...completeTrip,
    id: "test-trip-missing-pod",
    dropoffs: [
      {
        ...completeTrip.dropoffs[0],
        podSubmitted: false,
        documentRef: "Pending upload",
      },
    ],
  };
  assert.equal(isDeliveryIncomplete(missingPodTrip), true, "Missing POD must make delivery incomplete");
  assert.equal(isDeliveryFinanciallyComplete(missingPodTrip), true, "Finances remain complete when expenses are confirmed");
  const podIssues = getDeliveryIncompleteIssues(missingPodTrip);
  assert.ok(podIssues.some((issue) => issue.toLowerCase().includes("pod")));

  // 2. Unknown expense makes delivery incomplete AND financially incomplete
  const unknownExpenseTrip: typeof completeTrip = {
    ...completeTrip,
    id: "test-trip-unknown-expense",
    financialState: "incomplete",
    expenses: {
      ...completeTrip.expenses,
      tollGateExpenses: null,
    },
    expenseStates: {
      ...completeTrip.expenseStates,
      tollGateExpenses: "unknown",
    },
  };
  assert.equal(isDeliveryIncomplete(unknownExpenseTrip), true);
  assert.equal(isDeliveryFinanciallyComplete(unknownExpenseTrip), false, "Unknown tolls must make finances incomplete");
  const expIssues = getDeliveryIncompleteIssues(unknownExpenseTrip);
  assert.ok(expIssues.some((issue) => issue.toLowerCase().includes("toll") || issue.toLowerCase().includes("unknown")));

  // 3. Missing revenue makes delivery incomplete AND financially incomplete
  const missingRevenueTrip: typeof completeTrip = {
    ...completeTrip,
    id: "test-trip-missing-revenue",
    deliveryRate: 0,
  };
  assert.equal(isDeliveryIncomplete(missingRevenueTrip), true);
  assert.equal(isDeliveryFinanciallyComplete(missingRevenueTrip), false);

  // 4. Missing driver makes delivery incomplete
  const missingDriverTrip = {
    ...completeTrip,
    id: "test-trip-missing-driver",
    driverName: "",
  } as unknown as typeof completeTrip;
  assert.equal(isDeliveryIncomplete(missingDriverTrip), true);
});

test("financial inclusion rule: only financially complete deliveries are included in calculation totals", () => {
  // Query finalized financials vs incomplete
  const parsedFinalized = parseDeliveryListQuery(new URLSearchParams("financialState=finalized&pageSize=10"));
  assert.ok(parsedFinalized.ok);
  const finalizedResult = listSmallMockDeliveryRecords(parsedFinalized.value);
  assert.ok(finalizedResult.items.every(isDeliveryFinanciallyComplete), "All items must be financially complete");

  // Query operational status
  const parsedCompleted = parseDeliveryListQuery(new URLSearchParams("status=completed&pageSize=10"));
  assert.ok(parsedCompleted.ok);
  const completedResult = listSmallMockDeliveryRecords(parsedCompleted.value);
  assert.ok(completedResult.items.every((d) => !isDeliveryIncomplete(d)), "Completed status must have all required details");

  const parsedIncomplete = parseDeliveryListQuery(new URLSearchParams("status=incomplete&pageSize=10"));
  assert.ok(parsedIncomplete.ok);
  const incompleteResult = listSmallMockDeliveryRecords(parsedIncomplete.value);
  assert.ok(incompleteResult.items.every(isDeliveryIncomplete), "Incomplete status must have missing details");
});
