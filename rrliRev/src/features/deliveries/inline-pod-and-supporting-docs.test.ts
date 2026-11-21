import test from "node:test";
import assert from "node:assert/strict";
import {
  derivePodVerificationStatus,
  normalizeSupportingDocument,
  type DeliveryStoreDropoff,
  type SupportingDocumentRecord,
} from "./delivery-domain.ts";
import {
  correctSmallMockDelivery,
  getAllMockDeliveries,
  deletedDeliveryIds,
} from "./small-mock-repository.ts";

test("inline POD attachment and supporting documents in edit overlay", async (t) => {
  await t.test("derivePodVerificationStatus accounts for podSubmitted and supportingDocsComplete", () => {
    const stopsMissing: DeliveryStoreDropoff[] = [
      {
        id: "stop-1",
        sequence: 1,
        storeName: "Store A",
        destinationArea: "North",
        entryFee: 0,
        entryFeeStatus: "confirmed",
        podSubmitted: false,
        supportingDocsComplete: false,
        documentRef: "Pending upload",
      },
    ];
    assert.equal(derivePodVerificationStatus(stopsMissing), "Pending");

    const stopsPodOnly: DeliveryStoreDropoff[] = [
      {
        ...stopsMissing[0],
        podSubmitted: true,
        documentRef: "signed-pod.pdf",
      },
    ];
    assert.equal(derivePodVerificationStatus(stopsPodOnly), "Incomplete");

    const stopsFullyVerified: DeliveryStoreDropoff[] = [
      {
        ...stopsPodOnly[0],
        supportingDocsComplete: true,
      },
    ];
    assert.equal(derivePodVerificationStatus(stopsFullyVerified), "Verified");
  });

  await t.test("correctSmallMockDelivery persists supportingDocuments and dropoffs in edit overlay", () => {
    deletedDeliveryIds.clear();
    const deliveries = getAllMockDeliveries();
    assert.ok(deliveries.length > 0, "mock deliveries exist");

    const target = deliveries[0];
    const initialVersion = target.record.version;

    const supportingDocs = ["receiving-slip-001.pdf", "invoice-signed.jpg"];
    const updatedDropoffs: DeliveryStoreDropoff[] = target.record.dropoffs.map((stop) => ({
      ...stop,
      supportingDocsComplete: true,
    }));

    const result = correctSmallMockDelivery({
      deliveryId: target.record.id,
      expectedVersion: initialVersion,
      reason: "Added supporting documents from monthly reconciliation",
      changes: {
        supportingDocuments: supportingDocs,
        dropoffs: updatedDropoffs,
      },
    });

    assert.equal(result.ok, true, "correction should succeed");
    if (result.ok) {
      assert.deepEqual(result.record.supportingDocuments, supportingDocs);
      assert.equal(result.record.dropoffs[0].supportingDocsComplete, true);
      assert.equal(result.version, initialVersion + 1);
    }

    deletedDeliveryIds.clear();
  });

  await t.test("dropoff stop POD attachment directly links POD to that specific stop", () => {
    deletedDeliveryIds.clear();
    const deliveries = getAllMockDeliveries();
    const target = deliveries[0];
    const initialVersion = target.record.version;

    const stopWithPod: DeliveryStoreDropoff = {
      ...target.record.dropoffs[0],
      podSubmitted: true,
      documentRef: "signed_receipt_stop_1.pdf",
    };

    const result = correctSmallMockDelivery({
      deliveryId: target.record.id,
      expectedVersion: initialVersion,
      reason: "Attached POD directly to stop 1",
      changes: {
        dropoffs: [stopWithPod, ...target.record.dropoffs.slice(1)],
      },
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.record.dropoffs[0].podSubmitted, true);
      assert.equal(result.record.dropoffs[0].documentRef, "signed_receipt_stop_1.pdf");
    }

    deletedDeliveryIds.clear();
  });

  await t.test("trip supporting documents can be added, renamed, and deleted independently", () => {
    deletedDeliveryIds.clear();
    const deliveries = getAllMockDeliveries();
    const target = deliveries[0];

    // Add documents
    const addResult = correctSmallMockDelivery({
      deliveryId: target.record.id,
      expectedVersion: target.record.version,
      reason: "Added new supporting documents",
      changes: {
        supportingDocuments: ["Doc1.pdf", "Doc2.png"],
      },
    });
    assert.equal(addResult.ok, true);
    if (!addResult.ok) return;

    // Rename document
    const renameResult = correctSmallMockDelivery({
      deliveryId: target.record.id,
      expectedVersion: addResult.version,
      reason: "Renamed Doc1.pdf",
      changes: {
        supportingDocuments: ["GatePass_Signed.pdf", "Doc2.png"],
      },
    });
    assert.equal(renameResult.ok, true);
    if (!renameResult.ok) return;
    assert.deepEqual(renameResult.record.supportingDocuments, ["GatePass_Signed.pdf", "Doc2.png"]);

    // Delete document
    const deleteResult = correctSmallMockDelivery({
      deliveryId: target.record.id,
      expectedVersion: renameResult.version,
      reason: "Deleted Doc2.png",
      changes: {
        supportingDocuments: ["GatePass_Signed.pdf"],
      },
    });
    assert.equal(deleteResult.ok, true);
    if (deleteResult.ok) {
      assert.deepEqual(deleteResult.record.supportingDocuments, ["GatePass_Signed.pdf"]);
    }

    deletedDeliveryIds.clear();
  });

  await t.test("supporting documents can be linked to specific stores or entire trip", () => {
    deletedDeliveryIds.clear();
    const deliveries = getAllMockDeliveries();
    const target = deliveries[0];
    const firstStop = target.record.dropoffs[0];
    assert.ok(firstStop, "Delivery has at least one dropoff stop");

    const linkedDocs: SupportingDocumentRecord[] = [
      {
        id: "doc-trip-1",
        name: "TollwayReceipt.pdf",
        dropoffId: null,
        storeName: null,
      },
      {
        id: "doc-store-1",
        name: "StoreGatePass.jpg",
        dropoffId: firstStop.id,
        storeName: firstStop.storeName,
      },
    ];

    const saveResult = correctSmallMockDelivery({
      deliveryId: target.record.id,
      expectedVersion: target.record.version,
      reason: "Linked StoreGatePass.jpg to first store",
      changes: {
        supportingDocuments: linkedDocs,
      },
    });

    assert.equal(saveResult.ok, true);
    if (!saveResult.ok) return;

    assert.equal(saveResult.record.supportingDocuments?.length, 2);
    const normalized = (saveResult.record.supportingDocuments ?? []).map((d, i) =>
      normalizeSupportingDocument(d, i),
    );

    assert.equal(normalized[0].name, "TollwayReceipt.pdf");
    assert.equal(normalized[0].dropoffId, null, "First doc is trip-wide");

    assert.equal(normalized[1].name, "StoreGatePass.jpg");
    assert.equal(normalized[1].dropoffId, firstStop.id, "Second doc is linked to store");
    assert.equal(normalized[1].storeName, firstStop.storeName);

    // Re-link to trip-wide
    const relinkResult = correctSmallMockDelivery({
      deliveryId: target.record.id,
      expectedVersion: saveResult.version,
      reason: "Re-linked to trip-wide",
      changes: {
        supportingDocuments: [
          normalized[0],
          { ...normalized[1], dropoffId: null, storeName: null },
        ],
      },
    });

    assert.equal(relinkResult.ok, true);
    if (relinkResult.ok) {
      const relinked = (relinkResult.record.supportingDocuments ?? []).map((d, i) =>
        normalizeSupportingDocument(d, i),
      );
      assert.equal(relinked[1].dropoffId, null, "Successfully re-linked to trip-wide");
    }

    deletedDeliveryIds.clear();
  });
});
