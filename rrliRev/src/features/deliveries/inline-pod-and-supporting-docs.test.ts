import test from "node:test";
import assert from "node:assert/strict";
import {
  derivePodVerificationStatus,
  type DeliveryStoreDropoff,
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
});
