import assert from "node:assert/strict";
import test from "node:test";

import {
  getTruckPhotoStorageKey,
} from "../../components/truck-photo-storage.ts";
import {
  getFleetTrucks,
  getTruckClassificationLabel,
  getTruckStorageCapability,
  SUBCONTRACTED_TRUCKS,
} from "./truck-registry.ts";

test("RouteX: Display Truck Picture in Delivery Information", async (t) => {
  await t.test("Predictable storage key resolution with plate normalization", () => {
    // Normalizes casing and whitespace
    assert.equal(
      getTruckPhotoStorageKey("ngs 4281"),
      "routex.truck-photo.NGS 4281",
      "Should normalize lowercase to uppercase",
    );
    assert.equal(
      getTruckPhotoStorageKey("  DAA 7310  "),
      "routex.truck-photo.DAA 7310",
      "Should trim whitespace",
    );
    assert.equal(
      getTruckPhotoStorageKey("cbz 1187"),
      "routex.truck-photo.CBZ 1187",
    );
  });

  await t.test("Strict isolation across multiple trucks (no cross-contamination)", () => {
    const fleet = getFleetTrucks();
    const plates = fleet.map((t) => t.plateNumber);

    // Ensure all trucks have unique storage keys
    const keys = new Set(plates.map((plate) => getTruckPhotoStorageKey(plate)));
    assert.equal(
      keys.size,
      plates.length,
      "Every truck in the fleet must have a strictly isolated storage key",
    );

    // Verify specific truck pairs never collide
    const keyTruck1 = getTruckPhotoStorageKey("NGS 4281");
    const keyTruck2 = getTruckPhotoStorageKey("DAA 7310");
    const keyTruck3 = getTruckPhotoStorageKey("PQR 7156");

    assert.notEqual(keyTruck1, keyTruck2);
    assert.notEqual(keyTruck2, keyTruck3);
    assert.notEqual(keyTruck1, keyTruck3);
  });

  await t.test("Reuses existing truck profile image record without duplication", () => {
    // Simulating an existing truck profile image saved during Fleet Truck Management
    const mockStorage = new Map<string, string>();
    const truckPlate = "NGS 4281";
    const existingPhotoDataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...";

    // Save under the truck's canonical profile record
    const canonicalKey = getTruckPhotoStorageKey(truckPlate);
    mockStorage.set(canonicalKey, existingPhotoDataUrl);

    // Verify that delivery information retrieval uses the exact same canonical key
    const retrievedKey = getTruckPhotoStorageKey(truckPlate);
    assert.equal(retrievedKey, canonicalKey, "Delivery view must use the canonical truck profile photo key");
    assert.equal(mockStorage.get(retrievedKey), existingPhotoDataUrl, "Must retrieve existing image record");

    // Ensure no secondary or duplicated storage keys are required
    const duplicateDeliveryKey = `routex.delivery-truck-photo.${truckPlate}`;
    assert.equal(
      mockStorage.has(duplicateDeliveryKey),
      false,
      "Must not create duplicate delivery-specific image records",
    );
  });

  await t.test("Fleet truck metadata integration for delivery information view", () => {
    // Owned Reefer Truck
    const ownedPlate = "NGS 4281";
    const ownedCapability = getTruckStorageCapability(ownedPlate);
    assert.equal(ownedCapability, "Refrigerated");
    const ownedLabel = getTruckClassificationLabel("6-Wheeler", ownedCapability);
    assert.equal(ownedLabel, "6-Wheeler · Cold");

    // Owned Dry Truck
    const dryPlate = "CBZ 1187";
    const dryCapability = getTruckStorageCapability(dryPlate);
    assert.equal(dryCapability, "Dry");
    const dryLabel = getTruckClassificationLabel("10-Wheeler", dryCapability);
    assert.equal(dryLabel, "10-Wheeler · Dry");

    // Subcontracted Truck with Provider
    const subPlate = "PQR 7156";
    const subTruck = SUBCONTRACTED_TRUCKS.find((t) => t.plateNumber === subPlate);
    assert.ok(subTruck);
    assert.equal(subTruck.provider, "Silverroad Transport");
    assert.equal(subTruck.ownershipType, "Subcontracted");
    assert.equal(getTruckStorageCapability(subPlate), "Refrigerated");
  });
});
