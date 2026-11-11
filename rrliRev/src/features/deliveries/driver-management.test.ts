import assert from "node:assert/strict";
import test from "node:test";

import {
  canManageDrivers,
  type UserRole,
} from "../../lib/auth/rbac.ts";
import {
  getFleetCrew,
  getFleetDrivers,
  registerFleetCrewMember,
  setFleetCrewActive,
  registerFleetDriver,
  updateFleetCrewMember,
  deleteFleetCrewMember,
  resetDynamicFleetCrew,
  resetDynamicFleetDrivers,
  type FleetCrewMember,
  type FleetDriver,
} from "./driver-registry.ts";
import {
  correctSmallMockDelivery,
  getAllMockDeliveries,
} from "./small-mock-repository.ts";

test("canManageDrivers authorizes Admin and Operations while denying all View-Only roles", () => {
  assert.equal(canManageDrivers("admin"), true);
  assert.equal(canManageDrivers("operations"), true);

  const viewOnlyRoles: UserRole[] = ["finance", "hr", "secretary", "customer_representative"];
  for (const role of viewOnlyRoles) {
    assert.equal(canManageDrivers(role), false, `${role} must not be allowed to manage drivers`);
  }
});

test("driver registry registers new drivers and normalizes names", () => {
  resetDynamicFleetDrivers();
  const initialCount = getFleetDrivers().length;

  const result = registerFleetDriver({
    fullName: "  Eduardo Santos  ",
    employeeCode: "drv-09",
    contactNumber: "0918-999-8888",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.driver.fullName, "Eduardo Santos");
    assert.equal(result.driver.employeeCode, "DRV-09");
    assert.equal(result.driver.contactNumber, "0918-999-8888");
    assert.equal(result.driver.assignmentType, "Driver");
    assert.equal(result.driver.isActive, true);
  }

  assert.equal(getFleetDrivers().length, initialCount + 1);

  // Duplicate driver name check
  const duplicate = registerFleetDriver({
    fullName: "eduardo santos",
  });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.match(duplicate.error, /already exists/i);
  }

  // Name too short validation
  const tooShort = registerFleetDriver({
    fullName: "A",
  });
  assert.equal(tooShort.ok, false);
  if (!tooShort.ok) {
    assert.match(tooShort.error, /at least 2 characters/i);
  }

  resetDynamicFleetDrivers();
});

test("correctSmallMockDelivery correctly updates driver and helper names on a delivery", () => {
  const deliveries = getAllMockDeliveries();
  const target = deliveries[0];
  assert.ok(target, "At least one mock delivery exists");

  const originalDriver = target.driverName;
  const version = target.record.version;

  const result = correctSmallMockDelivery({
    deliveryId: target.record.id,
    expectedVersion: version,
    changes: {
      driverName: "Ramon Valenzuela",
      helperName: "Mark Dalisay",
    },
    reason: "Correction: assigned relief driver and helper",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.record.driverName, "Ramon Valenzuela");
    assert.equal(result.record.helperName, "Mark Dalisay");
    assert.equal(result.version, version + 1);
  }

  // Verify driver was registered into fleet drivers
  const found = getFleetDrivers().find((d) => d.fullName === "Ramon Valenzuela");
  assert.ok(found, "Newly assigned driver should be registered in fleet drivers");

  // Revert back
  correctSmallMockDelivery({
    deliveryId: target.record.id,
    expectedVersion: version + 1,
    changes: {
      driverName: originalDriver,
    },
    reason: "Revert test change",
  });

  resetDynamicFleetDrivers();
});

test("registerFleetCrewMember registers helpers with HLP- prefix and Helper assignmentType", () => {
  resetDynamicFleetCrew();
  const initialCrew = getFleetCrew();

  // Verify base drivers and helpers are present
  const baseDriverNames = initialCrew.filter((c) => c.assignmentType === "Driver").map((c) => c.fullName);
  const baseHelperNames = initialCrew.filter((c) => c.assignmentType === "Helper").map((c) => c.fullName);
  assert.ok(baseDriverNames.includes("Mateo Dela Vega"));
  assert.ok(baseDriverNames.includes("Nico Serrano"));
  assert.ok(baseHelperNames.includes("Ira Santos"));
  assert.ok(baseHelperNames.includes("Paolo Reyes"));

  // Register a new helper
  const result = registerFleetCrewMember({
    fullName: "Darwin Alcantara",
    assignmentType: "Helper",
    contactNumber: "0919-555-1234",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.crewMember.fullName, "Darwin Alcantara");
    assert.equal(result.crewMember.assignmentType, "Helper");
    assert.equal(result.crewMember.employeeCode.startsWith("HLP-"), true);
    assert.equal(result.crewMember.contactNumber, "0919-555-1234");
    assert.equal(result.crewMember.isActive, true);
  }

  // Verify it appears in getFleetCrew
  const updatedCrew = getFleetCrew();
  const foundHelper = updatedCrew.find((c) => c.fullName === "Darwin Alcantara");
  assert.ok(foundHelper, "New helper must be in fleet crew");
  assert.equal(foundHelper.assignmentType, "Helper");

  resetDynamicFleetCrew();
});

test("crew members can be deactivated and excluded from active delivery choices", () => {
  resetDynamicFleetCrew();
  const helper = getFleetCrew().find((member) => member.assignmentType === "Helper");
  assert.ok(helper);

  const deactivated = setFleetCrewActive(helper.id, false);
  assert.equal(deactivated.ok, true);
  assert.equal(getFleetCrew().find((member) => member.id === helper.id)?.isActive, false);
  assert.equal(getFleetDrivers().some((member) => member.id === helper.id), false);

  const reactivated = setFleetCrewActive(helper.id, true);
  assert.equal(reactivated.ok, true);
  assert.equal(getFleetDrivers().some((member) => member.id === helper.id), true);
  resetDynamicFleetCrew();
});

test("updateFleetCrewMember modifies crew member details and validates input", () => {
  resetDynamicFleetCrew();
  const initialCrew = getFleetCrew();
  const target = initialCrew.find((c) => c.fullName === "Mateo Dela Vega");
  assert.ok(target);

  // Successful update of name and contact number
  const updated = updateFleetCrewMember(target.id, {
    fullName: "Mateo Dela Vega Jr.",
    contactNumber: "0917-111-2222",
  });
  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.crewMember.fullName, "Mateo Dela Vega Jr.");
    assert.equal(updated.crewMember.contactNumber, "0917-111-2222");
    assert.equal(updated.crewMember.assignmentType, "Driver");
  }

  // Duplicate name rejection
  const dupResult = updateFleetCrewMember(target.id, {
    fullName: "Nico Serrano",
  });
  assert.equal(dupResult.ok, false);
  if (!dupResult.ok) {
    assert.match(dupResult.error, /already exists/i);
  }

  // Name too short rejection
  const shortResult = updateFleetCrewMember(target.id, {
    fullName: "M",
  });
  assert.equal(shortResult.ok, false);
  if (!shortResult.ok) {
    assert.match(shortResult.error, /at least 2 characters/i);
  }

  resetDynamicFleetCrew();
});

test("deleteFleetCrewMember removes crew member from active registry", () => {
  resetDynamicFleetCrew();
  const initialCrew = getFleetCrew();
  const helper = initialCrew.find((c) => c.assignmentType === "Helper");
  assert.ok(helper);

  const initialCount = getFleetCrew().length;
  const deleted = deleteFleetCrewMember(helper.id);
  assert.equal(deleted.ok, true);

  const remaining = getFleetCrew();
  assert.equal(remaining.length, initialCount - 1);
  assert.equal(remaining.some((c) => c.id === helper.id), false);

  // Deleting non-existent crew returns error
  const invalidDelete = deleteFleetCrewMember("non-existent-id");
  assert.equal(invalidDelete.ok, false);

  resetDynamicFleetCrew();
});
