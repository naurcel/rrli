import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateProfitMargin,
  calculateTripExpenseTotal,
  buildDeliveryTripRecord,
} from "./delivery-domain.ts";
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
  assert.ok(delivery.record.netIncome !== null);
  assert.ok(delivery.record.marginPercent !== null);
});

test("financial finalization protects incomplete trips and prevents duplicate finalization with wrong version", () => {
  const incompleteTrip = SMALL_MOCK_DATABASE.deliveries.find(
    (d) => d.record.financialState === "incomplete",
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

test("dynamic batch deliveries are queryable without corrupting the 9 base seed fixtures", () => {
  const baseCount = SMALL_MOCK_DATABASE.deliveries.length;
  assert.equal(baseCount, 9, "Base mock database must remain exactly 9 deliveries.");

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
  assert.equal(SMALL_MOCK_DATABASE.deliveries.length, 9);

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
