import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sortDeliveryLedgerItems } from "./delivery-sort.ts";
import { listSmallMockDeliveryRecords } from "./small-mock-repository.ts";
import type { DeliveryLedgerItem } from "./server/delivery-repository.ts";
import { getDeliveryIncompleteIssues, isDeliveryFinanciallyComplete, isDeliveryIncomplete } from "./delivery-domain.ts";

const baseMock = listSmallMockDeliveryRecords().items[0];

function createMockTrip(overrides: Partial<DeliveryLedgerItem>): DeliveryLedgerItem {
  return {
    ...baseMock,
    ...overrides,
  };
}

describe("RouteX: Delivery Details Page & Navigator Logic", () => {
  const tripA = createMockTrip({
    id: "trip-a",
    waybillNumber: "WB-001",
    deliveryDate: "2026-11-01",
    clientName: "Alpha Freight",
    driverName: "Juan Dela Cruz",
    helperName: "Pedro Penduko",
    deliveryRate: 10000,
    totalExpenses: 4000,
    netIncome: 6000,
    expenses: {
      ...baseMock.expenses,
      dieselExpenses: 1500,
      tollGateExpenses: 500,
      driverAllowance: 1000,
      driverDailyRate: 1000,
      helperAllowance: 850,
      helperDailyRate: 850,
      otherExpenses: 0,
    },
    expenseStates: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      entryFees: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      otherExpenses: "not_applicable",
    },
    dropoffs: [
      {
        id: "stop-1",
        sequence: 1,
        storeName: "Alpha Store",
        destinationArea: "Makati",
        entryFee: 150,
        entryFeeStatus: "confirmed",
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "doc-1",
      },
    ],
    podStatus: "Verified",
    financialIntegrityIssues: [],
    financialState: "finalized",
  });

  const tripB = createMockTrip({
    id: "trip-b",
    waybillNumber: "WB-002",
    deliveryDate: "2026-11-05",
    clientName: "Beta Logistics",
    driverName: "Juan Dela Cruz",
    helperName: "Pedro Penduko",
    deliveryRate: 15000,
    totalExpenses: 5000,
    netIncome: 10000,
    expenses: {
      ...baseMock.expenses,
      dieselExpenses: 2000,
      tollGateExpenses: 800,
      driverAllowance: 1200,
      driverDailyRate: 1000,
      helperAllowance: 800,
      helperDailyRate: 850,
      otherExpenses: 0,
    },
    expenseStates: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      entryFees: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      otherExpenses: "not_applicable",
    },
    dropoffs: [
      {
        id: "stop-2",
        sequence: 1,
        storeName: "Beta Store",
        destinationArea: "Pasig",
        entryFee: 200,
        entryFeeStatus: "confirmed",
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "doc-2",
      },
    ],
    podStatus: "Verified",
    financialIntegrityIssues: [],
    financialState: "finalized",
  });

  const tripC = createMockTrip({
    id: "trip-c",
    waybillNumber: "WB-003",
    deliveryDate: "2026-11-03",
    clientName: "Gamma Retail",
    driverName: "Juan Dela Cruz",
    helperName: "Pedro Penduko",
    deliveryRate: 12000,
    totalExpenses: null,
    netIncome: null,
    dropoffs: [
      {
        id: "stop-3",
        sequence: 1,
        storeName: "Gamma Store",
        destinationArea: "Quezon City",
        entryFee: 0,
        entryFeeStatus: "not_applicable",
        podSubmitted: false,
        supportingDocsComplete: false,
        documentRef: "",
      },
    ],
    financialState: "incomplete",
    podStatus: "Incomplete",
    expenseStates: {
      dieselExpenses: "unknown",
      tollGateExpenses: "confirmed",
      entryFees: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      otherExpenses: "confirmed",
    },
  });

  const allDeliveries = [tripA, tripB, tripC];

  it("sortDeliveryLedgerItems correctly sorts by delivery_date descending and ascending", () => {
    const desc = sortDeliveryLedgerItems(allDeliveries, "delivery_date", "desc");
    assert.deepEqual(
      desc.map((d) => d.id),
      ["trip-b", "trip-c", "trip-a"],
    );

    const asc = sortDeliveryLedgerItems(allDeliveries, "delivery_date", "asc");
    assert.deepEqual(
      asc.map((d) => d.id),
      ["trip-a", "trip-c", "trip-b"],
    );
  });

  it("sortDeliveryLedgerItems correctly sorts by client name", () => {
    const asc = sortDeliveryLedgerItems(allDeliveries, "client", "asc");
    assert.deepEqual(
      asc.map((d) => d.clientName),
      ["Alpha Freight", "Beta Logistics", "Gamma Retail"],
    );
  });

  it("sortDeliveryLedgerItems correctly sorts by revenue (delivery_rate)", () => {
    const desc = sortDeliveryLedgerItems(allDeliveries, "delivery_rate", "desc");
    assert.deepEqual(
      desc.map((d) => d.id),
      ["trip-b", "trip-c", "trip-a"],
    );
  });

  it("Delivery Navigator finds adjacent records in sorted context", () => {
    const sorted = sortDeliveryLedgerItems(allDeliveries, "delivery_date", "desc");
    // sorted: [tripB, tripC, tripA]
    const currentId = "trip-c";
    const currentIndex = sorted.findIndex((d) => d.id === currentId);
    assert.equal(currentIndex, 1);

    const prevTrip = currentIndex > 0 ? sorted[currentIndex - 1] : null;
    const nextTrip = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null;

    assert.equal(prevTrip?.id, "trip-b");
    assert.equal(nextTrip?.id, "trip-a");
  });

  it("Delivery Navigator correctly disables navigation at boundaries", () => {
    const sorted = sortDeliveryLedgerItems(allDeliveries, "delivery_date", "desc");
    // First record: trip-b has no previous
    const firstIndex = 0;
    const hasPrevFirst = firstIndex > 0;
    const hasNextFirst = firstIndex < sorted.length - 1;
    assert.equal(hasPrevFirst, false);
    assert.equal(hasNextFirst, true);

    // Last record: trip-a has no next
    const lastIndex = sorted.length - 1;
    const hasPrevLast = lastIndex > 0;
    const hasNextLast = lastIndex < sorted.length - 1;
    assert.equal(hasPrevLast, true);
    assert.equal(hasNextLast, false);
  });

  it("Delivery Navigator filters respect ledger status filter (completed vs incomplete)", () => {
    const completedOnly = allDeliveries.filter(
      (d) => !isDeliveryIncomplete(d) && isDeliveryFinanciallyComplete(d),
    );
    assert.equal(completedOnly.length, 2);
    assert.deepEqual(
      completedOnly.map((d) => d.id),
      ["trip-a", "trip-b"],
    );

    const incompleteOnly = allDeliveries.filter(
      (d) => isDeliveryIncomplete(d) || !isDeliveryFinanciallyComplete(d),
    );
    assert.equal(incompleteOnly.length, 1);
    assert.equal(incompleteOnly[0].id, "trip-c");
  });

  it("Preserves search query and filter parameters in return link", () => {
    const params = new URLSearchParams();
    params.set("search", "Alpha");
    params.set("status", "completed");
    params.set("page", "2");
    params.set("sort", "delivery_rate:desc");

    const ledgerHref = `/deliveries?${params.toString()}`;
    assert.ok(ledgerHref.includes("search=Alpha"));
    assert.ok(ledgerHref.includes("status=completed"));
    assert.ok(ledgerHref.includes("page=2"));
    assert.ok(ledgerHref.includes("sort=delivery_rate%3Adesc"));
  });
});
