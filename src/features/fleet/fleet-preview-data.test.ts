import assert from "node:assert/strict";
import test from "node:test";

import { findFleetProfileTruck, findOwnedFleetTruck, ownedFleetTrucks, subcontractedFleetTrucks } from "./fleet-preview-data.ts";

test("resolves each owned truck used by fleet detail routes", () => {
  for (const truck of ownedFleetTrucks) {
    assert.deepEqual(findOwnedFleetTruck(truck.id), truck);
  }
});

test("does not expose a detail route for an unknown preview truck", () => {
  assert.equal(findOwnedFleetTruck("UNKNOWN 0000"), undefined);
});

test("resolves both owned and subcontracted truck profiles by plate number", () => {
  const owned = findFleetProfileTruck("DAA 7310");
  const subcontracted = findFleetProfileTruck(subcontractedFleetTrucks[0].truck);

  assert.equal(owned?.ownership, "Owned");
  assert.equal(owned?.id, "DAA 7310");
  assert.equal(subcontracted?.ownership, "Subcontracted");
  assert.equal(subcontracted?.id, subcontractedFleetTrucks[0].truck);
  assert.equal(subcontracted?.provider, subcontractedFleetTrucks[0].company);
});
