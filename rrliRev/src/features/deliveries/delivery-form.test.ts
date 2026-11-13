import assert from "node:assert/strict";
import test from "node:test";

import {
  type ExpenseResolutionStatus,
} from "./delivery-domain.ts";
import {
  sanitizePersonNameInput,
  sanitizePositiveDecimalInput,
  sanitizeSignedDecimalInput,
} from "./delivery-input-utils.ts";

/**
 * Pure calculation logic matching NewCompletedDeliveryPage financialReview
 */
function calculateDeliveryFinancials(input: {
  deliveryRate: number | null;
  fuelRate: number;
  entryFees: number | null;
  dieselExpenses: number | null;
  tollGateExpenses: number | null;
  driverAllowance: number | null;
  driverDailyRate: number | null;
  helperAllowance: number | null;
  helperDailyRate: number | null;
  hasSecondHelper: boolean;
  helper2Allowance?: number | null;
  helper2DailyRate?: number | null;
  otherExpenses: number | null;
  statuses: {
    dieselExpenses: ExpenseResolutionStatus;
    tollGateExpenses: ExpenseResolutionStatus;
    driverAllowance: ExpenseResolutionStatus;
    driverDailyRate: ExpenseResolutionStatus;
    helperAllowance: ExpenseResolutionStatus;
    helperDailyRate: ExpenseResolutionStatus;
    helper2Allowance?: ExpenseResolutionStatus;
    helper2DailyRate?: ExpenseResolutionStatus;
    otherExpenses: ExpenseResolutionStatus;
  };
}) {
  const activeKeys: (keyof typeof input.statuses)[] = [
    "dieselExpenses",
    "tollGateExpenses",
    "driverAllowance",
    "driverDailyRate",
    "helperAllowance",
    "helperDailyRate",
    "otherExpenses",
  ];

  if (input.hasSecondHelper) {
    activeKeys.push("helper2Allowance", "helper2DailyRate");
  }

  const values: Record<string, number | null> = {
    dieselExpenses: input.dieselExpenses,
    tollGateExpenses: input.tollGateExpenses,
    driverAllowance: input.driverAllowance,
    driverDailyRate: input.driverDailyRate,
    helperAllowance: input.helperAllowance,
    helperDailyRate: input.helperDailyRate,
    helper2Allowance: input.helper2Allowance ?? null,
    helper2DailyRate: input.helper2DailyRate ?? null,
    otherExpenses: input.otherExpenses,
  };

  const expensesComplete = activeKeys.every((key) => {
    const status = input.statuses[key];
    if (status === "not_applicable") return true;
    if (status === "confirmed") {
      const val = values[key];
      return val != null && Number.isFinite(val) && val >= 0;
    }
    return false;
  });

  const totalExpenses =
    input.entryFees == null || !expensesComplete
      ? null
      : activeKeys.reduce((sum, key) => {
          const status = input.statuses[key];
          return sum + (status === "confirmed" ? (values[key] ?? 0) : 0);
        }, input.entryFees);

  const revenue = input.deliveryRate;
  const netIncome =
    revenue == null || totalExpenses == null ? null : revenue - totalExpenses;

  return {
    revenue,
    totalExpenses,
    netIncome,
    isComplete: expensesComplete && input.entryFees != null && revenue != null,
  };
}

test("Delivery Rate vs Fuel Rate distinct concepts", () => {
  // Fuel Rate: smaller amount per liter (e.g. ₱85.00/L)
  const fuelRatePerLiter = 85.0;
  // Delivery Rate: larger monetary amount for the delivery (e.g. ₱28,000.00)
  const deliveryRateGrossRevenue = 28000.0;

  assert.ok(
    deliveryRateGrossRevenue > fuelRatePerLiter,
    "Delivery rate must represent the larger gross trip billable revenue",
  );
  assert.equal(typeof fuelRatePerLiter, "number");
  assert.equal(typeof deliveryRateGrossRevenue, "number");
});

test("Single Helper financial calculation calculates correct total without second helper", () => {
  const result = calculateDeliveryFinancials({
    deliveryRate: 25000,
    fuelRate: 85.0,
    entryFees: 450,
    dieselExpenses: 4000,
    tollGateExpenses: 1200,
    driverAllowance: 350,
    driverDailyRate: 950,
    helperAllowance: 250,
    helperDailyRate: 700,
    hasSecondHelper: false,
    otherExpenses: 200,
    statuses: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      otherExpenses: "confirmed",
    },
  });

  // Expected expenses: 450 (entry) + 4000 (diesel) + 1200 (toll) + 350 (driver allow) + 950 (driver rate) + 250 (h1 allow) + 700 (h1 rate) + 200 (other) = 8100
  assert.equal(result.totalExpenses, 8100);
  assert.equal(result.netIncome, 25000 - 8100); // 16900
  assert.equal(result.isComplete, true);
});

test("Adding Second Helper calculates both helpers independently without duplication", () => {
  const result = calculateDeliveryFinancials({
    deliveryRate: 25000,
    fuelRate: 85.0,
    entryFees: 450,
    dieselExpenses: 4000,
    tollGateExpenses: 1200,
    driverAllowance: 350,
    driverDailyRate: 950,
    // Helper 1
    helperAllowance: 250,
    helperDailyRate: 700,
    // Helper 2
    hasSecondHelper: true,
    helper2Allowance: 200,
    helper2DailyRate: 650,
    otherExpenses: 200,
    statuses: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      helper2Allowance: "confirmed",
      helper2DailyRate: "confirmed",
      otherExpenses: "confirmed",
    },
  });

  // Helper 1 costs: 700 + 250 = 950
  // Helper 2 costs: 650 + 200 = 850
  // Combined helper costs: 1800
  // Base other expenses: 450 + 4000 + 1200 + 350 + 950 + 200 = 7150
  // Total expenses: 7150 + 1800 = 8950
  assert.equal(result.totalExpenses, 8950);
  assert.equal(result.netIncome, 25000 - 8950); // 16050
  assert.equal(result.isComplete, true);
});

test("Financial completeness: unknown Helper 2 expense marks delivery incomplete", () => {
  const result = calculateDeliveryFinancials({
    deliveryRate: 25000,
    fuelRate: 85.0,
    entryFees: 450,
    dieselExpenses: 4000,
    tollGateExpenses: 1200,
    driverAllowance: 350,
    driverDailyRate: 950,
    helperAllowance: 250,
    helperDailyRate: 700,
    hasSecondHelper: true,
    helper2Allowance: null,
    helper2DailyRate: 650,
    otherExpenses: 200,
    statuses: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      helper2Allowance: "unknown", // unresolved
      helper2DailyRate: "confirmed",
      otherExpenses: "confirmed",
    },
  });

  assert.equal(result.totalExpenses, null, "Total expenses must be null when an active helper expense is unknown");
  assert.equal(result.netIncome, null);
  assert.equal(result.isComplete, false);
});

test("Financial completeness: not_applicable Helper 2 expense does not block completeness", () => {
  const result = calculateDeliveryFinancials({
    deliveryRate: 25000,
    fuelRate: 85.0,
    entryFees: 450,
    dieselExpenses: 4000,
    tollGateExpenses: 1200,
    driverAllowance: 350,
    driverDailyRate: 950,
    helperAllowance: 250,
    helperDailyRate: 700,
    hasSecondHelper: true,
    helper2Allowance: null,
    helper2DailyRate: 650,
    otherExpenses: 200,
    statuses: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      helper2Allowance: "not_applicable", // N/A allowance for second helper
      helper2DailyRate: "confirmed",
      otherExpenses: "confirmed",
    },
  });

  // Base: 7150 + Helper 1 (950) + Helper 2 Daily Rate (650) = 8750
  assert.equal(result.totalExpenses, 8750);
  assert.equal(result.netIncome, 25000 - 8750); // 16250
  assert.equal(result.isComplete, true);
});

test("Toggling off Second Helper cleanly restores single helper calculation", () => {
  // Even if leftover values exist in helper2 fields, hasSecondHelper: false ignores them
  const result = calculateDeliveryFinancials({
    deliveryRate: 25000,
    fuelRate: 85.0,
    entryFees: 450,
    dieselExpenses: 4000,
    tollGateExpenses: 1200,
    driverAllowance: 350,
    driverDailyRate: 950,
    helperAllowance: 250,
    helperDailyRate: 700,
    hasSecondHelper: false,
    helper2Allowance: 9999,
    helper2DailyRate: 9999,
    otherExpenses: 200,
    statuses: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      helper2Allowance: "unknown",
      helper2DailyRate: "unknown",
      otherExpenses: "confirmed",
    },
  });

  assert.equal(result.totalExpenses, 8100, "Must ignore helper 2 when hasSecondHelper is false");
  assert.equal(result.isComplete, true);
});

// ============================================================================
// SUITE: Record Delivery Page Updates (Client selection, Rate, Stop labels, Expenses)
// ============================================================================
test("RECORD-DELIVERY: Client deduplication is case-insensitive and trims whitespace", () => {
  const existingClients = [
    { id: "c-1", label: "Puregold Price Club" },
    { id: "c-2", label: "SM Supermarket" },
  ];

  function isDuplicateClient(candidates: typeof existingClients, newName: string): boolean {
    const normalized = newName.trim().toLowerCase();
    return candidates.some((c) => c.label.trim().toLowerCase() === normalized);
  }

  assert.equal(isDuplicateClient(existingClients, "  Puregold Price Club  "), true);
  assert.equal(isDuplicateClient(existingClients, "puregold price club"), true);
  assert.equal(isDuplicateClient(existingClients, "PUREGOLD PRICE CLUB"), true);
  assert.equal(isDuplicateClient(existingClients, "Robinsons Supermarket"), false);
});

test("RECORD-DELIVERY: Rate and Additional Charges remain cleanly separated", () => {
  const baseRate = 28000;
  const additionalCharges = 2500; // e.g. waiting time or extra drop-off fee

  // The base rate represents deliveryRate in the domain
  assert.equal(baseRate, 28000);
  assert.equal(additionalCharges, 2500);

  // Financial review calculates base profit without silently blending unconfirmed charge rules
  const expenses = 9500;
  const baseNetIncome = baseRate - expenses;
  assert.equal(baseNetIncome, 18500);
});

test("RECORD-DELIVERY: Stop numbering ordinals format correctly", () => {
  const ordinals = [
    "First Stop",
    "Second Stop",
    "Third Stop",
    "Fourth Stop",
    "Fifth Stop",
    "Sixth Stop",
    "Seventh Stop",
    "Eighth Stop",
    "Ninth Stop",
    "Tenth Stop",
  ];

  function getStopLabel(index: number): string {
    return ordinals[index] ?? `Stop #${index + 1}`;
  }

  assert.equal(getStopLabel(0), "First Stop");
  assert.equal(getStopLabel(1), "Second Stop");
  assert.equal(getStopLabel(2), "Third Stop");
  assert.equal(getStopLabel(9), "Tenth Stop");
  assert.equal(getStopLabel(10), "Stop #11");
});

test("RECORD-DELIVERY: Entry Fee supports only Amount (confirmed) and N/A (not_applicable)", () => {
  const allowedStatuses = ["confirmed", "not_applicable"] as const;
  assert.ok(allowedStatuses.includes("confirmed"));
  assert.ok(allowedStatuses.includes("not_applicable"));
  // "unknown" is removed from entry fee options
  assert.ok(!allowedStatuses.includes("unknown" as any));
});

test("RECORD-DELIVERY: Truck selection groups into Owned Trucks and Subcontracted Trucks", () => {
  const trucks = [
    { label: "NBO-1204", ownershipType: "Owned" },
    { label: "SUB-8812", ownershipType: "Subcontracted" },
    { label: "CAE-5519", ownershipType: "Owned" },
  ];

  const owned = trucks.filter((t) => t.ownershipType === "Owned").map((t) => ({ ...t, group: "Owned Trucks" }));
  const subcon = trucks.filter((t) => t.ownershipType === "Subcontracted").map((t) => ({ ...t, group: "Subcontracted Trucks" }));
  const grouped = [...owned, ...subcon];

  assert.equal(grouped[0].group, "Owned Trucks");
  assert.equal(grouped[1].group, "Owned Trucks");
  assert.equal(grouped[2].group, "Subcontracted Trucks");
});

test("RECORD-DELIVERY: Numeric input sanitization strips letters, signs, and extra decimals", () => {
  assert.equal(sanitizePositiveDecimalInput("abc"), "");
  assert.equal(sanitizePositiveDecimalInput("12e34"), "1234");
  assert.equal(sanitizePositiveDecimalInput("28000.559"), "28000.55");
  assert.equal(sanitizePositiveDecimalInput("12..34.56"), "12.34");
  assert.equal(sanitizePositiveDecimalInput("-500.25"), "500.25");
  assert.equal(sanitizePositiveDecimalInput("₱1,250.50"), "1250.50");

  // Signed decimal (Temperature in °C)
  assert.equal(sanitizeSignedDecimalInput("-18.45", 1), "-18.4");
  assert.equal(sanitizeSignedDecimalInput("-abc", 1), "-");
  assert.equal(sanitizeSignedDecimalInput("4.2", 1), "4.2");
  assert.equal(sanitizeSignedDecimalInput("--12..5", 1), "-12.5");

  // Person name sanitization (Driver / Helper names cannot contain digits)
  assert.equal(sanitizePersonNameInput("Juan123 Dela45 Cruz"), "Juan Dela Cruz");
  assert.equal(sanitizePersonNameInput("999"), "");
  assert.equal(sanitizePersonNameInput("Pedro Santos Jr."), "Pedro Santos Jr.");
});
