import assert from "node:assert/strict";
import test from "node:test";

import {
  canManageTrucks,
  type UserRole,
} from "../../lib/auth/rbac.ts";
import {
  getFleetTrucks,
  getOwnedTrucks,
  getSubcontractedTrucks,
  registerFleetTruck,
  resetDynamicFleetTrucks,
  updateFleetTruck,
  type FleetTruck,
} from "./truck-registry.ts";
import {
  mergeRegisteredTrucks,
} from "./browser-preview-trucks.ts";

test("canManageTrucks authorizes Admin and Operations while denying all View-Only roles", () => {
  assert.equal(canManageTrucks("admin"), true);
  assert.equal(canManageTrucks("operations"), true);

  const viewOnlyRoles: UserRole[] = ["finance", "hr", "secretary", "customer_representative"];
  for (const role of viewOnlyRoles) {
    assert.equal(canManageTrucks(role), false, `${role} must not be allowed to manage trucks`);
  }
});

test("truck registry registers owned trucks and normalizes plate numbers", () => {
  resetDynamicFleetTrucks();
  const initialCount = getFleetTrucks().length;

  const newTruck: FleetTruck = {
    id: "test-truck-uuid-001",
    plateNumber: "abc 9876",
    truckType: "6-Wheeler",
    ownershipType: "Owned",
    rateBasis: "Redeemed Rate",
    provider: null,
    contactPerson: null,
  };

  const result = registerFleetTruck(newTruck);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.truck.plateNumber, "ABC 9876");
    assert.equal(result.truck.ownershipType, "Owned");
  }

  assert.equal(getFleetTrucks().length, initialCount + 1);
  const foundOwned = getOwnedTrucks().find((t) => t.plateNumber === "ABC 9876");
  assert.ok(foundOwned, "Truck must appear in getOwnedTrucks()");
  assert.equal(foundOwned.truckType, "6-Wheeler");

  // Prevent duplicate registration
  const duplicateResult = registerFleetTruck({
    ...newTruck,
    id: "test-truck-uuid-002",
    plateNumber: "ABC 9876",
  });
  assert.equal(duplicateResult.ok, false);
  if (!duplicateResult.ok) {
    assert.match(duplicateResult.error, /already exists/);
  }

  resetDynamicFleetTrucks();
});

test("truck registry registers subcontracted trucks with provider details", () => {
  resetDynamicFleetTrucks();
  const initialSubCount = getSubcontractedTrucks().length;

  const subcontractedTruck: FleetTruck = {
    id: "test-sub-uuid-001",
    plateNumber: "XYZ 5432",
    truckType: "10-Wheeler",
    ownershipType: "Subcontracted",
    rateBasis: "Trucker Rate",
    provider: "Apex Haulers Corp.",
    contactPerson: "Dennis Velasco",
  };

  const result = registerFleetTruck(subcontractedTruck);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.truck.plateNumber, "XYZ 5432");
    assert.equal(result.truck.provider, "Apex Haulers Corp.");
    assert.equal(result.truck.contactPerson, "Dennis Velasco");
  }

  assert.equal(getSubcontractedTrucks().length, initialSubCount + 1);
  const foundSub = getSubcontractedTrucks().find((t) => t.plateNumber === "XYZ 5432");
  assert.ok(foundSub, "Truck must appear in getSubcontractedTrucks()");
  assert.equal(foundSub.provider, "Apex Haulers Corp.");

  resetDynamicFleetTrucks();
});

test("mergeRegisteredTrucks correctly combines base trucks without duplicate plate numbers", () => {
  const baseTrucks: FleetTruck[] = [
    {
      id: "base-001",
      plateNumber: "NGS 4281",
      truckType: "6-Wheeler",
      ownershipType: "Owned",
      rateBasis: "Redeemed Rate",
      provider: null,
      contactPerson: null,
    },
  ];

  const merged = mergeRegisteredTrucks(baseTrucks);
  assert.equal(merged.length, baseTrucks.length);
  assert.equal(merged[0]?.plateNumber, "NGS 4281");
});

test("updateFleetTruck updates both owned and subcontracted trucks and prevents duplicate plates", () => {
  resetDynamicFleetTrucks();

  // 1. Update a base Owned truck (NGS 4281)
  const ownedUpdate = updateFleetTruck("NGS 4281", {
    plateNumber: "NGS 4281",
    truckType: "10-Wheeler",
    storageCapability: "Dry",
    ownershipType: "Owned",
    provider: null,
    contactPerson: null,
  });
  assert.equal(ownedUpdate.ok, true);
  if (ownedUpdate.ok) {
    assert.equal(ownedUpdate.truck.truckType, "10-Wheeler");
    assert.equal(ownedUpdate.truck.storageCapability, "Dry");
  }
  const updatedOwned = getOwnedTrucks().find((t) => t.plateNumber === "NGS 4281");
  assert.ok(updatedOwned);
  assert.equal(updatedOwned.truckType, "10-Wheeler");
  assert.equal(updatedOwned.storageCapability, "Dry");

  // 2. Update a base Subcontracted truck (KLM 4821) including plate rename
  const subUpdate = updateFleetTruck("KLM 4821", {
    plateNumber: "KLM 9999",
    truckType: "6-Wheeler",
    storageCapability: "Refrigerated",
    ownershipType: "Subcontracted",
    provider: "Updated Northline Hauling",
    contactPerson: "Updated Adrian Cruz",
  });
  assert.equal(subUpdate.ok, true);
  assert.equal(
    getSubcontractedTrucks().some((t) => t.plateNumber === "KLM 4821"),
    false,
    "Old plate must be replaced",
  );
  const updatedSub = getSubcontractedTrucks().find((t) => t.plateNumber === "KLM 9999");
  assert.ok(updatedSub);
  assert.equal(updatedSub.truckType, "6-Wheeler");
  assert.equal(updatedSub.provider, "Updated Northline Hauling");
  assert.equal(updatedSub.contactPerson, "Updated Adrian Cruz");

  // 3. Reject duplicate plate number against another existing truck
  const duplicateUpdate = updateFleetTruck("KLM 9999", {
    plateNumber: "DAA 7310",
    truckType: "6-Wheeler",
    storageCapability: "Refrigerated",
    ownershipType: "Subcontracted",
    provider: "Updated Northline Hauling",
    contactPerson: "Updated Adrian Cruz",
  });
  assert.equal(duplicateUpdate.ok, false);
  if (!duplicateUpdate.ok) {
    assert.equal(duplicateUpdate.code, "DUPLICATE_PLATE");
  }

  resetDynamicFleetTrucks();
});


