import assert from "node:assert/strict";
import test from "node:test";

import {
  canManageTrucks,
  USER_ROLES,
  type UserRole,
} from "../../lib/auth/rbac.ts";
import {
  getFleetTrucks,
  getOwnedTrucks,
  getSubcontractedTrucks,
  registerFleetTruck,
  resetDynamicFleetTrucks,
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

