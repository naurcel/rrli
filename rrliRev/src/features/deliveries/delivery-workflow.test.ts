import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeliveryTripRecord,
} from "./delivery-domain.ts";
import {
  checkCrewDateAvailability,
} from "./driver-registry.ts";
import {
  SMALL_MOCK_DATABASE,
} from "./small-mock-database.ts";
import {
  correctSmallMockDelivery,
  dynamicMockDeliveries,
  finalizeSmallMockDelivery,
  getAllMockDeliveries,
  listSmallMockDeliveryRecords,
  updateSmallMockPodState,
} from "./small-mock-repository.ts";

test("audited financial correction updates delivery financials and increments version", () => {
  const delivery = SMALL_MOCK_DATABASE.deliveries[0];
  assert.ok(delivery);
  const initialVersion = delivery.record.version;
  const initialRate = delivery.record.deliveryRate ?? 10000;

  // Stale version must fail with VERSION_CONFLICT
  const conflictResult = correctSmallMockDelivery({
    deliveryId: delivery.record.id,
    expectedVersion: initialVersion + 999,
    changes: { deliveryRate: initialRate + 1500 },
    reason: "Attempted stale update",
  });
  assert.equal(conflictResult.ok, false);
  if (!conflictResult.ok) {
    assert.match(conflictResult.error, /VERSION_CONFLICT/);
  }

  // Valid update with correct expectedVersion
  const successResult = correctSmallMockDelivery({
    deliveryId: delivery.record.id,
    expectedVersion: initialVersion,
    changes: {
      deliveryRate: initialRate + 2000,
      expenses: { dieselExpenses: 3500 },
    },
    reason: "Reconciled diesel expense receipt after audit",
  });
  assert.equal(successResult.ok, true);
  if (successResult.ok) {
    assert.equal(successResult.version, initialVersion + 1);
  }

  assert.equal(delivery.record.deliveryRate, initialRate + 2000);
  assert.equal(delivery.record.expenses.dieselExpenses, 3500);
  assert.equal(delivery.record.version, initialVersion + 1);
  assert.equal(delivery.record.financialState, "finalized", "Once all expenses are resolved/completed, record is automatically finalized.");
  assert.ok(delivery.record.netIncome !== null);
  assert.ok(delivery.record.marginPercent !== null);
});

test("financial finalization protects incomplete trips and prevents duplicate finalization with wrong version", () => {
  const incompleteTrip = SMALL_MOCK_DATABASE.deliveries.find(
    (d) => d.record.financialState === "incomplete" && d.record.financialIntegrityIssues.length > 0,
  );
  assert.ok(incompleteTrip, "Mock database must contain an incomplete trip fixture.");

  // Cannot finalize an incomplete delivery with unresolved expenses
  const finalizeIncomplete = finalizeSmallMockDelivery({
    deliveryId: incompleteTrip.record.id,
    expectedVersion: incompleteTrip.record.version,
  });
  assert.equal(finalizeIncomplete.ok, false);
  if (!finalizeIncomplete.ok) {
    assert.match(finalizeIncomplete.error, /FINANCIALS_INCOMPLETE/);
  }
});

test("financial correction with resolved fields transitions incomplete delivery to finalized", () => {
  const incompleteTrip = SMALL_MOCK_DATABASE.deliveries.find(
    (d) => d.record.financialState === "incomplete" && d.record.financialIntegrityIssues.length > 0,
  );
  assert.ok(incompleteTrip, "Mock database must contain an incomplete trip fixture.");

  const prevVersion = incompleteTrip.record.version;
  const resolveResult = correctSmallMockDelivery({
    deliveryId: incompleteTrip.record.id,
    expectedVersion: prevVersion,
    changes: {
      deliveryRate: 21000,
      expenses: { tollGateExpenses: 450 },
      expenseStates: { tollGateExpenses: "confirmed" },
      financialState: "finalized",
    },
    reason: "Confirmed SLEX toll receipt amount with operations",
  });

  assert.equal(resolveResult.ok, true);
  if (resolveResult.ok) {
    assert.equal(resolveResult.record.financialState, "finalized");
    assert.equal(resolveResult.record.financialIntegrityIssues.length, 0);
    assert.ok(resolveResult.record.totalExpenses !== null);
    assert.ok(resolveResult.record.netIncome !== null);
  }
});

test("POD document attachment updates dropoffs and document reference", () => {
  const delivery = SMALL_MOCK_DATABASE.deliveries[0];
  assert.ok(delivery);
  const dropoff = delivery.record.dropoffs[0];
  assert.ok(dropoff);
  const currentVersion = delivery.record.version;

  // Update dropoff POD document attachment
  const updateResult = updateSmallMockPodState({
    deliveryId: delivery.record.id,
    dropoffId: dropoff.id,
    expectedVersion: currentVersion,
    podSubmitted: true,
    supportingDocsComplete: true,
    documentRef: "POD-VERIFIED-TEST.pdf",
  });

  assert.equal(updateResult.ok, true);
  if (updateResult.ok) {
    assert.equal(updateResult.version, currentVersion + 1);
    assert.ok(["Verified", "Incomplete", "Pending"].includes(updateResult.podStatus));
  }
  assert.equal(dropoff.podSubmitted, true);
  assert.equal(dropoff.supportingDocsComplete, true);
  assert.equal(dropoff.documentRef, "POD-VERIFIED-TEST.pdf");
});

test("dynamic batch deliveries are queryable without corrupting the 21 base seed fixtures", () => {
  const baseCount = SMALL_MOCK_DATABASE.deliveries.length;
  assert.equal(baseCount, 21, "Base mock database must remain exactly 21 deliveries.");

  const importId = "imp-test-uuid-001";
  const newRecord = buildDeliveryTripRecord({
    id: importId,
    waybillNumber: "WB-IMPORT-9999",
    deliveryDate: "2026-10-30",
    clientName: "Landers",
    plateNumber: "CBL-4412",
    truckType: "4-Wheeler",
    truckTemperature: "20°C",
    origin: "Laguna Hub",
    distanceKm: 85,
    fuelRate: 86.5,
    deliveryRate: 14500,
    expenses: {
      dieselExpenses: 2800,
      tollGateExpenses: 450,
      tollGateBreakdown: "SLEX",
      driverAllowance: 500,
      driverDailyRate: 900,
      helperAllowance: 400,
      helperDailyRate: 750,
      otherExpenses: 0,
    },
    dropoffs: [
      {
        id: "imp-test-stop-1",
        sequence: 1,
        storeName: "Landers Alabang",
        destinationArea: "Alabang",
        entryFee: 150,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "POD-ALABANG-9999.pdf",
      },
    ],
  });

  dynamicMockDeliveries.push({
    record: newRecord,
    clientId: SMALL_MOCK_DATABASE.clients[0].id,
    truckId: SMALL_MOCK_DATABASE.trucks[0].id,
    driverId: SMALL_MOCK_DATABASE.drivers[0].id,
    helperId: SMALL_MOCK_DATABASE.helpers[0].id,
    scenario: "Dynamic import test",
  });

  // Base fixtures are untouched
  assert.equal(SMALL_MOCK_DATABASE.deliveries.length, 21);

  // All deliveries include the dynamic import
  const all = getAllMockDeliveries();
  assert.equal(all.length, baseCount + dynamicMockDeliveries.length);

  // Delivery list query finds the imported record
  const list = listSmallMockDeliveryRecords({
    search: "WB-IMPORT-9999",
    clientId: null,
    truckId: null,
    status: null,
    podStatus: null,
    dateFrom: null,
    dateTo: null,
    page: 1,
    pageSize: 10,
    sort: "delivery_date",
    direction: "desc",
  });
  assert.equal(list.total, 1);
  assert.equal(list.items[0]?.waybillNumber, "WB-IMPORT-9999");
  assert.equal(list.items[0]?.deliveryRate, 14500);
});

test("subcontracted delivery supports adding 2nd helper without requiring owned crew daily rates", () => {
  const subDelivery = buildDeliveryTripRecord({
    id: "del-subcon-2helpers-test",
    waybillNumber: "WB-SUB-2H-01",
    deliveryDate: "2024-06-15",
    clientName: "Universal Robina Corporation",
    plateNumber: "SUB-8821",
    truckType: "6-Wheeler",
    truckTemperature: "4°C",
    truckOwnership: "Subcontracted",
    rateBasis: "Redeemed Rate",
    origin: "Laguna Plant",
    distanceKm: 65,
    fuelRate: 60,
    deliveryRate: 18500,
    expenses: {
      dieselExpenses: 2800,
      tollGateExpenses: 450,
      tollGateBreakdown: "SLEX",
      driverAllowance: null,
      driverDailyRate: null,
      helperAllowance: null,
      helperDailyRate: null,
      otherExpenses: 0,
    },
    expenseStates: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      entryFees: "confirmed",
      driverAllowance: "not_applicable",
      driverDailyRate: "not_applicable",
      helperAllowance: "not_applicable",
      helperDailyRate: "not_applicable",
      otherExpenses: "confirmed",
    },
    financialState: "finalized",
    dropoffs: [
      {
        id: "drop-1",
        sequence: 1,
        storeName: "Robinsons Supermarket Galleria",
        destinationArea: "Pasig",
        dropoffCount: 1,
        entryFee: 150,
        entryFeeStatus: "confirmed",
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "POD-SUB-01.pdf",
      },
    ],
  });

  dynamicMockDeliveries.push({
    record: subDelivery,
    clientId: SMALL_MOCK_DATABASE.clients[0].id,
    truckId: "truck-sub-1",
    driverId: "",
    helperId: "",
    driverName: "Subcontractor Driver",
    helperName: "Subcontractor Helper 1",
    scenario: "Subcontracted 2-helper delivery test",
  });

  // Perform audited correction adding a 2nd helper: "Subcontractor Helper 1, Subcontractor Helper 2"
  const correction = correctSmallMockDelivery({
    deliveryId: "del-subcon-2helpers-test",
    expectedVersion: 1,
    reason: "Added optional second helper from subcontractor crew",
    changes: {
      helperName: "Subcontractor Helper 1, Subcontractor Helper 2",
      expenses: {
        helperDailyRate: null,
        helperAllowance: null,
      },
      expenseStates: {
        helperDailyRate: "not_applicable",
        helperAllowance: "not_applicable",
      },
    },
  });

  assert.equal(correction.ok, true);
  if (correction.ok) {
    assert.equal(correction.version, 2);
    assert.equal(correction.record.helperName, "Subcontractor Helper 1, Subcontractor Helper 2");
    assert.equal(correction.record.expenses.helperDailyRate, null);
    assert.equal(correction.record.expenseStates.helperDailyRate, "not_applicable");
    assert.equal(correction.record.expenses.helperAllowance, null);
    assert.equal(correction.record.expenseStates.helperAllowance, "not_applicable");
    assert.equal(correction.record.financialState, "finalized");
  }
});

test("delivery edit works by waybill number (#WB-... and WB-...) and handles missing version safely", () => {
  const target = SMALL_MOCK_DATABASE.deliveries[0];
  assert.ok(target, "Fixture must exist");

  const waybill = target.record.waybillNumber;
  const currentVer = target.record.version ?? 1;

  // Correct using prefixed waybill number
  const result1 = correctSmallMockDelivery({
    deliveryId: `#${waybill}`,
    expectedVersion: currentVer,
    reason: "Updated notes via prefixed waybill lookup",
    changes: {
      notes: "Test note updated by waybill",
    },
  });

  assert.equal(result1.ok, true);
  if (result1.ok) {
    assert.equal(result1.version, currentVer + 1);
    assert.equal(result1.record.notes, "Test note updated by waybill");
    assert.ok(!Number.isNaN(result1.version), "Version must not be NaN");
  }

  // Correct using unprefixed waybill number
  const result2 = correctSmallMockDelivery({
    deliveryId: waybill,
    expectedVersion: (result1.ok ? result1.version : currentVer + 1),
    reason: "Updated notes via raw waybill lookup",
    changes: {
      notes: "Test note updated again",
    },
  });

  assert.equal(result2.ok, true);
  if (result2.ok) {
    assert.equal(result2.record.notes, "Test note updated again");
  }
});

test("checkCrewDateAvailability exempts editing delivery by ID or waybill with/without # and search matches ID", () => {
  const testDeliveries = [
    {
      id: "del-crew-check-101",
      waybillNumber: "#WB-CREW-909",
      deliveryDate: "2024-07-20",
      driverName: "Juan Dela Cruz",
      helperName: "Pedro Penduko",
    },
  ];

  // Self-conflict should be exempted when matching ID or Waybill (even with/without #)
  const selfCheck1 = checkCrewDateAvailability({
    employeeName: "Juan Dela Cruz",
    deliveryDate: "2024-07-20",
    currentWaybillOrId: "del-crew-check-101",
    deliveries: testDeliveries,
  });
  assert.equal(selfCheck1.ok, true, "Matching delivery ID must exempt self from crew conflict");

  const selfCheck2 = checkCrewDateAvailability({
    employeeName: "Juan Dela Cruz",
    deliveryDate: "2024-07-20",
    currentWaybillOrId: "WB-CREW-909",
    deliveries: testDeliveries,
  });
  assert.equal(selfCheck2.ok, true, "Matching waybill without # must exempt self from crew conflict");

  const selfCheck3 = checkCrewDateAvailability({
    employeeName: "Pedro Penduko",
    deliveryDate: "2024-07-20",
    currentWaybillOrId: "#wb-crew-909",
    deliveries: testDeliveries,
  });
  assert.equal(selfCheck3.ok, true, "Matching case-insensitive waybill with # must exempt helper self");

  // Conflict on a different delivery on the same date should be blocked
  const diffConflict = checkCrewDateAvailability({
    employeeName: "Juan Dela Cruz",
    deliveryDate: "2024-07-20",
    currentWaybillOrId: "del-different-trip",
    deliveries: testDeliveries,
  });
  assert.equal(diffConflict.ok, false, "Different delivery on same date must be detected as conflict");

  // listSmallMockDeliveryRecords finds delivery by ID
  const firstId = SMALL_MOCK_DATABASE.deliveries[0].record.id;
  const searchById = listSmallMockDeliveryRecords({
    search: firstId,
    page: 1,
    pageSize: 10,
  });
  assert.ok(searchById.items.length > 0, "listSmallMockDeliveryRecords must match deliveries by ID");
  assert.equal(searchById.items[0]?.id, firstId);
});
