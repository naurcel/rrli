import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPANY_FOUNDATION_DATE,
  COMPANY_FOUNDATION_YEAR,
  getDeliveryDateWindow,
  validateDeliveryDateWindow,
} from "../deliveries/delivery-recording-policy.ts";
import {
  formatDateRange,
  isDateInRange,
  presetRange,
  toDateKey,
} from "../../components/date-range-utils.ts";
import {
  BASE_DRIVERS,
  BASE_HELPERS,
  getFleetCrew,
} from "../deliveries/driver-registry.ts";
import {
  buildDeliveryTripRecord,
  derivePodVerificationStatus,
} from "../deliveries/delivery-domain.ts";
import {
  correctSmallMockDelivery,
  getAllMockDeliveries,
  listSmallMockDeliveryRecords,
} from "../deliveries/small-mock-repository.ts";
import { processReport } from "../reports/report-engine.ts";
import { DEFAULT_DAILY_TRIP_TEMPLATE } from "../reports/report-template-types.ts";

// ============================================================================
// SUITE 1: 2024 Founding Year Boundary Invariants
// ============================================================================
test("POST-REGRESSION: Company foundation boundary (2024) is strictly enforced", () => {
  const reference = new Date("2026-11-09T03:00:00.000Z");

  assert.equal(COMPANY_FOUNDATION_YEAR, 2024);
  assert.equal(COMPANY_FOUNDATION_DATE, "2024-01-01");

  // Admin cannot record earlier than 2024-01-01
  const preFoundationAdmin = validateDeliveryDateWindow("2023-12-31", reference, "admin");
  assert.equal(preFoundationAdmin.ok, false);
  if (!preFoundationAdmin.ok) {
    assert.match(preFoundationAdmin.message, /2024/);
  }

  // Admin CAN record on or after 2024-01-01
  const foundationDayAdmin = validateDeliveryDateWindow("2024-01-01", reference, "admin");
  assert.equal(foundationDayAdmin.ok, true);

  // Non-admin is restricted to standard window (cannot record in 2024 if reference is 2026)
  const opFoundation = validateDeliveryDateWindow("2024-01-01", reference, "operations");
  assert.equal(opFoundation.ok, false);

  // Date range presets automatically clamp past ranges to 2024-01-01
  const earlyRef = new Date(2024, 0, 10); // Jan 10, 2024
  const last30 = presetRange("last30", earlyRef);
  assert.equal(toDateKey(last30.startDate!), "2024-01-01");
  assert.equal(toDateKey(last30.endDate!), "2024-01-10");

  const yearPreset = presetRange("year", earlyRef);
  assert.equal(toDateKey(yearPreset.startDate!), "2024-01-01");
});

// ============================================================================
// SUITE 2: Automatic Financial Resolution (No Manual Finalize Button)
// ============================================================================
test("POST-REGRESSION: Automatic financial resolution without manual finalize button", () => {
  // WB-261102 has unknown toll gate expense in the seeded dataset
  const mockDelivery = getAllMockDeliveries().find((d) => d.record.waybillNumber === "WB-261102");
  assert.ok(mockDelivery, "WB-261102 must exist in small mock database");
  const initial = mockDelivery.record;
  const initialVersion = initial.version;
  assert.equal(initial.financialState, "incomplete");
  assert.ok(initial.financialIntegrityIssues.length > 0);

  // 1. Partial edit leaving an expense unresolved: remains incomplete
  const partialResult = correctSmallMockDelivery({
    deliveryId: initial.id,
    expectedVersion: initialVersion,
    changes: {
      expenses: { dieselExpenses: 3400 },
    },
    reason: "Updated diesel expense only",
  });

  assert.equal(partialResult.ok, true);
  if (partialResult.ok) {
    assert.equal(mockDelivery.record.financialState, "incomplete", "Must remain incomplete while toll is unknown");
  }

  // 2. Full resolution: dispatcher confirms toll -> automatically finalized!
  const fullResult = correctSmallMockDelivery({
    deliveryId: initial.id,
    expectedVersion: initialVersion + 1,
    changes: {
      expenses: { tollGateExpenses: 750, tollGateBreakdown: "Confirmed CALAX + SLEX RFID" },
    },
    reason: "Confirmed missing toll receipts from RFID statement",
  });

  assert.equal(fullResult.ok, true);
  if (fullResult.ok) {
    assert.equal(mockDelivery.record.financialState, "finalized", "Must automatically finalize once all expenses confirmed");
    assert.equal(mockDelivery.record.financialIntegrityIssues.length, 0);
    assert.ok(mockDelivery.record.expenses.tollGateExpenses === 750);
    assert.ok(mockDelivery.record.netIncome !== null);
  }

  // Restore WB-261102 back to incomplete state for test idempotency
  correctSmallMockDelivery({
    deliveryId: initial.id,
    expectedVersion: initialVersion + 2,
    changes: {
      expenses: {
        dieselExpenses: 3900,
        tollGateExpenses: null,
        tollGateBreakdown: "CALAX and SLEX toll receipt amount awaiting confirmation",
      },
      expenseStates: {
        tollGateExpenses: "unknown",
      },
    },
    reason: "Reset fixture back to seeded incomplete state",
  });
});

// ============================================================================
// SUITE 3: Incomplete Delivery Financial Aggregate Exclusion
// ============================================================================
test("POST-REGRESSION: Incomplete deliveries are excluded from revenue & profit totals", () => {
  // Query all deliveries
  const allTrips = getAllMockDeliveries().map((d) => d.record);
  const incompleteItems = allTrips.filter((item) => item.financialState === "incomplete");
  const finalizedItems = allTrips.filter((item) => item.financialState === "finalized");

  assert.ok(incompleteItems.length > 0, "There must be seeded incomplete items (e.g. WB-261102)");

  // Reports summary engine
  const report = processReport(allTrips, DEFAULT_DAILY_TRIP_TEMPLATE);

  const totals = report.totals;

  // Finalized sum of gross earnings
  const expectedFinalizedRevenue = finalizedItems.reduce((acc, trip) => acc + (trip.deliveryRate ?? 0), 0);
  assert.equal(totals.grossEarnings, expectedFinalizedRevenue, "Gross earnings must match finalized trips only");

  // Incomplete revenue must NOT be included in totals.grossEarnings
  const totalRevenueAll = allTrips.reduce((acc, trip) => acc + (trip.deliveryRate ?? 0), 0);
  assert.notEqual(totals.grossEarnings, totalRevenueAll, "Unfinalized revenue must never be silently included in report totals");

  // Total trips count reflects physical volume
  assert.equal(totals.totalTrips, allTrips.length);
});

// ============================================================================
// SUITE 4: Helper & Driver Registry Differentiation
// ============================================================================
test("POST-REGRESSION: Helper and Driver roles are properly populated and differentiated", () => {
  const crew = getFleetCrew();
  const drivers = crew.filter((c) => c.assignmentType === "Driver");
  const helpers = crew.filter((c) => c.assignmentType === "Helper");

  assert.ok(drivers.length >= BASE_DRIVERS.length);
  assert.ok(helpers.length >= BASE_HELPERS.length);

  // Verify helpers are present in helper filter list from mock repository
  const list = listSmallMockDeliveryRecords({});
  assert.ok(list.filters.helpers && list.filters.helpers.length > 0);
  assert.ok(list.filters.drivers && list.filters.drivers.length > 0);

  // Verify helper names exist in BASE_HELPERS
  const helperLabels = list.filters.helpers.map((h) => h.label);
  for (const baseHelper of BASE_HELPERS) {
    assert.ok(helperLabels.includes(baseHelper.fullName), `Expected ${baseHelper.fullName} in helper list`);
  }
});

// ============================================================================
// SUITE 5: Late Submission Policy Automation
// ============================================================================
test("POST-REGRESSION: Late delivery submission auto-evaluates without popup blocking", () => {
  const reference = new Date("2026-11-05T03:00:00.000Z");
  const window = getDeliveryDateWindow(reference);

  // Today is on time
  const todayPolicy = validateDeliveryDateWindow("2026-11-05", reference, "operations");
  assert.equal(todayPolicy.ok, true);
  if (todayPolicy.ok) {
    assert.equal(todayPolicy.isLate, false);
  }

  // 2 days ago is in window but marked late
  const latePolicy = validateDeliveryDateWindow("2026-11-03", reference, "operations");
  assert.equal(latePolicy.ok, true);
  if (latePolicy.ok) {
    assert.equal(latePolicy.isLate, true);
  }

  // 3 days ago is outside window for operations
  const outsidePolicy = validateDeliveryDateWindow("2026-11-02", reference, "operations");
  assert.equal(outsidePolicy.ok, false);
});
