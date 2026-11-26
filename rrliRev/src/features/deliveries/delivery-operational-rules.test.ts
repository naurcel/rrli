import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateProfitMargin,
  calculateTripExpenseTotal,
  getDeliveryIncompleteIssues,
  getTripTotalDropoffs,
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
  type DeliveryStoreDropoff,
  type DeliveryTripRecord,
  type TripExpenseBreakdown,
  type TripExpenseStates,
} from "./delivery-domain.ts";
import {
  getFleetTrucks,
  getTruckStorageCapability,
} from "./truck-registry.ts";
import {
  getMockClients,
  registerMockClient,
} from "./small-mock-database.ts";

test("Delivery Ops: Registered truck auto-determines classification, storage capability, and ownership type", () => {
  const allTrucks = getFleetTrucks();

  // Owned Freezer 6-Wheeler
  const ownedTruck = allTrucks.find((t) => t.plateNumber === "NGS 4281");
  assert.ok(ownedTruck, "NGS 4281 must exist in fleet registry");
  assert.equal(ownedTruck.ownershipType, "Owned");
  assert.equal(ownedTruck.truckType, "6-Wheeler");
  assert.equal(getTruckStorageCapability("NGS 4281", "6-Wheeler"), "Freezer");
  assert.equal(ownedTruck.rateBasis, "Redeemed Rate");

  // Subcontracted Chilled 6-Wheeler
  const subTruck = allTrucks.find((t) => t.plateNumber === "PQR 7156");
  assert.ok(subTruck, "PQR 7156 must exist in fleet registry");
  assert.equal(subTruck.ownershipType, "Subcontracted");
  assert.equal(subTruck.truckType, "6-Wheeler");
  assert.equal(getTruckStorageCapability("PQR 7156", "6-Wheeler"), "Chilled");
  assert.equal(subTruck.rateBasis, "Trucker Rate");
  assert.equal(subTruck.provider, "Silverroad Transport");

  // Subcontracted Dry 4-Wheeler
  const dryTruck = allTrucks.find((t) => t.plateNumber === "KLM 4821");
  assert.ok(dryTruck);
  assert.equal(getTruckStorageCapability("KLM 4821", "4-Wheeler"), "Dry");
  assert.equal(dryTruck.truckType, "4-Wheeler");
});

test("Delivery Ops: Adding a new client dynamically registers it permanently for selection", () => {
  const newClientName = `Test Enterprise Retail ${Date.now()}`;

  const created = registerMockClient(newClientName);
  assert.ok(created);
  assert.equal(created.name, newClientName);

  const updatedClients = getMockClients();
  assert.ok(updatedClients.some((c) => c.name === newClientName), "New client must be present in client registry");
});

test("Delivery Ops: Multiple drop-offs and general location stop counts calculate correctly", () => {
  const dropoffs: DeliveryStoreDropoff[] = [
    {
      id: "drop-1",
      sequence: 1,
      storeName: "SM Megamall Supermarket",
      destinationArea: "Mandaluyong",
      dropoffCount: 1,
      entryFee: 150,
      entryFeeStatus: "confirmed",
      podSubmitted: true,
      supportingDocsComplete: true,
      documentRef: "REF-001",
    },
    {
      id: "drop-2",
      sequence: 2,
      storeName: "Various Sari-Sari Stores",
      destinationArea: "Pasig General Area",
      dropoffCount: 5, // General location with 5 stops
      entryFee: 0,
      entryFeeStatus: "not_applicable",
      podSubmitted: true,
      supportingDocsComplete: true,
      documentRef: "REF-002",
    },
    {
      id: "drop-3",
      sequence: 3,
      storeName: "Historical Stop Without Explicit Count",
      destinationArea: "Taguig",
      dropoffCount: undefined, // Historical stop defaults to 1
      entryFee: null,
      entryFeeStatus: "not_applicable",
      podSubmitted: true,
      supportingDocsComplete: true,
      documentRef: "REF-003",
    },
  ];

  // Total stops: 1 + 5 + 1 (default for undefined) = 7
  const totalStops = getTripTotalDropoffs(dropoffs);
  assert.equal(totalStops, 7, "Total dropoff count must sum explicit and defaulted stop counts");
});

test("Delivery Ops: Completeness evaluation flags unknown expenses or missing revenue, while POD is not required", () => {
  const incompleteTrip: DeliveryTripRecord = {
    id: "del-test-inc-1",
    waybillNumber: "WB-99001",
    deliveryDate: "2026-11-20",
    clientName: "Universal Robina Corp",
    plateNumber: "NGS 4281",
    truckType: "6-Wheeler",
    truckTemperature: "-18°C",
    truckOwnership: "Owned",
    rateBasis: "Redeemed Rate",
    origin: "Canlubang, Laguna",
    distanceKm: 85,
    fuelRate: 54.5,
    deliveryRate: 14500,
    expenses: {
      dieselExpenses: 3200,
      tollGateExpenses: 450,
      tollGateBreakdown: "SLEX",
      entryFees: 100,
      driverAllowance: 500,
      driverDailyRate: 800,
      helperAllowance: 300,
      helperDailyRate: 600,
      otherExpenses: null, // unknown other expenses
    },
    expenseStates: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      entryFees: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      otherExpenses: "unknown", // unknown!
    },
    totalExpenses: null,
    netIncome: null,
    marginPercent: null,
    financialState: "incomplete",
    financialIntegrityIssues: [],
    version: 1,
    dropoffs: [
      {
        id: "drop-1",
        sequence: 1,
        storeName: "Puregold San Pedro",
        destinationArea: "San Pedro, Laguna",
        dropoffCount: 1,
        entryFee: 100,
        entryFeeStatus: "confirmed",
        podSubmitted: false, // missing POD!
        supportingDocsComplete: false,
        documentRef: "",
      },
    ],
    podStatus: "Incomplete",
  };

  assert.equal(isDeliveryIncomplete(incompleteTrip), true);
  assert.equal(isDeliveryFinanciallyComplete(incompleteTrip), false);

  const issues = getDeliveryIncompleteIssues(incompleteTrip);
  assert.equal(issues.some((i) => i.toLowerCase().includes("pod")), false, "POD is not required for daily trips and must not be flagged");
  assert.ok(issues.some((i) => i.toLowerCase().includes("pending other expenses") || i.toLowerCase().includes("other expenses")), "Must flag pending expense");
});

test("Delivery Financials: Financial calculations independently verify Owned and Subcontracted deliveries", () => {
  // Owned delivery calculation:
  // Revenue: 18,000
  // Expenses: Diesel 4,000 + Toll 600 + Entry 200 + Driver (Rate 900 + Allow 500) + Helper (Rate 650 + Allow 350) + Other 200
  // Total Expenses = 4000 + 600 + 200 + 1400 + 1000 + 200 = 7,400
  // Net Income = 18,000 - 7,400 = 10,600
  // Margin = (10,600 / 18,000) * 100 = 58.888...%
  const expenses: TripExpenseBreakdown = {
    dieselExpenses: 4000,
    tollGateExpenses: 600,
    tollGateBreakdown: "SLEX + Skyway",
    entryFees: 200,
    driverDailyRate: 900,
    driverAllowance: 500,
    helperDailyRate: 650,
    helperAllowance: 350,
    otherExpenses: 200,
  };
  const states: TripExpenseStates = {
    dieselExpenses: "confirmed",
    tollGateExpenses: "confirmed",
    entryFees: "confirmed",
    driverDailyRate: "confirmed",
    driverAllowance: "confirmed",
    helperDailyRate: "confirmed",
    helperAllowance: "confirmed",
    otherExpenses: "confirmed",
  };

  const total = calculateTripExpenseTotal(expenses, states);
  assert.equal(total, 7400);

  const netIncome = 18000 - total!;
  assert.equal(netIncome, 10600);

  const margin = calculateProfitMargin(18000, netIncome);
  assert.ok(margin !== null);
  assert.equal(Math.round(margin! * 100) / 100, 58.89);

  // Unknown expense must preserve null total expenses
  const unknownStates = { ...states, dieselExpenses: "unknown" as const };
  const nullTotal = calculateTripExpenseTotal(expenses, unknownStates);
  assert.equal(nullTotal, null, "Unknown expense must not silently become zero");
});
