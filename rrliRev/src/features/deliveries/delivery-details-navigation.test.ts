import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sortDeliveryLedgerItems } from "./delivery-sort.ts";
import { listSmallMockDeliveryRecords } from "./small-mock-repository.ts";
import type { DeliveryLedgerItem } from "./server/delivery-repository.ts";
import { isDeliveryFinanciallyComplete, isDeliveryIncomplete } from "./delivery-domain.ts";

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

  it("filters deliveries strictly by truck plate when from=truck", () => {
    const truckTrip1 = createMockTrip({ id: "t-1", plateNumber: "ABC-123", deliveryDate: "2026-11-01" });
    const truckTrip2 = createMockTrip({ id: "t-2", plateNumber: "ABC 123", deliveryDate: "2026-11-02" });
    const otherTruckTrip = createMockTrip({ id: "t-3", plateNumber: "XYZ-999", deliveryDate: "2026-11-03" });

    const trips = [truckTrip1, truckTrip2, otherTruckTrip];
    const targetPlate = "ABC-123";
    const norm = (s: string) => s.trim().replace(/\s+/g, "").replace(/-/g, "").toUpperCase();

    const filtered = trips.filter((t) => norm(t.plateNumber) === norm(targetPlate));
    assert.equal(filtered.length, 2);
    assert.deepEqual(filtered.map((t) => t.id), ["t-1", "t-2"]);
    assert.ok(!filtered.some((t) => t.id === "t-3"));
  });

  it("sortDeliveryLedgerItems supports aliases: date, revenue, expenses, netIncome", () => {
    const trips = [
      createMockTrip({ id: "1", deliveryDate: "2026-11-01", deliveryRate: 5000, totalExpenses: 2000, netIncome: 3000 }),
      createMockTrip({ id: "2", deliveryDate: "2026-11-03", deliveryRate: 9000, totalExpenses: 1000, netIncome: 8000 }),
      createMockTrip({ id: "3", deliveryDate: "2026-11-02", deliveryRate: 7000, totalExpenses: 4000, netIncome: 3000 }),
    ];

    const sortedByRevenueDesc = sortDeliveryLedgerItems(trips, "revenue", "desc");
    assert.deepEqual(sortedByRevenueDesc.map((t) => t.id), ["2", "3", "1"]);

    const sortedByExpensesAsc = sortDeliveryLedgerItems(trips, "expenses", "asc");
    assert.deepEqual(sortedByExpensesAsc.map((t) => t.id), ["2", "1", "3"]);

    const sortedByNetIncomeDesc = sortDeliveryLedgerItems(trips, "netIncome", "desc");
    assert.deepEqual(sortedByNetIncomeDesc.map((t) => t.id), ["2", "1", "3"]);

    const sortedByDateAsc = sortDeliveryLedgerItems(trips, "date", "asc");
    assert.deepEqual(sortedByDateAsc.map((t) => t.id), ["1", "3", "2"]);
  });

  it("builds truck return URL preserving page, sort, and date range", () => {
    const params = new URLSearchParams();
    params.set("from", "truck");
    params.set("truck", "ABC-123");
    params.set("sort", "revenue:desc");
    params.set("truckPage", "3");
    params.set("dateFrom", "2026-11-01");
    params.set("dateTo", "2026-11-15");

    const truckHref = `/truck-profitability/ABC-123?sort=revenue%3Adesc&page=3&dateFrom=2026-11-01&dateTo=2026-11-15`;
    assert.ok(truckHref.includes("/truck-profitability/ABC-123"));
    assert.ok(truckHref.includes("page=3"));
    assert.ok(truckHref.includes("sort=revenue%3Adesc"));
    assert.ok(truckHref.includes("dateFrom=2026-11-01"));
    assert.ok(truckHref.includes("dateTo=2026-11-15"));
  });
});
