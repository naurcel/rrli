import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteSmallMockDelivery,
  getAllMockDeliveries,
  deletedDeliveryIds,
} from "./small-mock-repository.ts";
import {
  deleteFleetTruck,
  deletedTruckPlateNumbers,
  getFleetTrucks,
} from "./truck-registry.ts";
import {
  createServerAccountProfile,
  deleteServerAccount,
  listServerAccountProfiles,
  findServerAccountById,
} from "../../lib/auth/server-account-store.ts";
import { hasPermission } from "../../lib/auth/rbac.ts";

test("admin deletion decisions for deliveries and accounts with governance constraints", async (t) => {
  await t.test("deleteSmallMockDelivery removes record and excludes it from ledger", async () => {
    deletedDeliveryIds.clear();
    const deliveries = getAllMockDeliveries();
    assert.ok(deliveries.length > 0, "should have initial deliveries");

    const targetId = deliveries[0].record.id;
    const initialCount = deliveries.length;

    const deleted = deleteSmallMockDelivery(targetId);
    assert.equal(deleted.ok, true, "should return true ok on successful deletion");

    const afterList = getAllMockDeliveries().filter((d) => !deletedDeliveryIds.has(d.record.id));
    assert.equal(afterList.length, initialCount - 1, "ledger count should decrease by 1");
    assert.equal(afterList.some((d) => d.record.id === targetId), false, "deleted delivery should not be found in active list");

    const deleteAgain = deleteSmallMockDelivery(targetId);
    assert.equal(deleteAgain.ok, false, "deleting already deleted delivery should return false ok");

    // Clean up
    deletedDeliveryIds.clear();
  });

  await t.test("deleteServerAccount allows deleting staff users but strictly protects primary admin", async () => {
    const accounts = listServerAccountProfiles();
    const primaryAdmin = accounts.find((acc) => acc.username === "admin" || acc.email === "admin@routex.local");
    assert.ok(primaryAdmin, "primary admin must exist in server account store");

    const adminDeleteAttempt = deleteServerAccount(primaryAdmin.id);
    assert.equal(adminDeleteAttempt.ok, false, "should reject deleting primary admin");
    assert.match(adminDeleteAttempt.message, /cannot be deleted/i);

    // Create a temporary staff user and verify admin can delete it
    const createRes = await createServerAccountProfile({
      email: "temp-staff@routex.local",
      username: "tempstaff",
      fullName: "Temporary Staff",
      role: "operations",
      temporaryPassword: "TempPassword123!",
    });
    assert.equal(createRes.ok, true, "user creation should succeed");
    const createdUser = (createRes as { ok: true; profile: { id: string } }).profile;

    const userInList = listServerAccountProfiles().find((acc) => acc.id === createdUser.id);
    assert.ok(userInList, "newly created user should exist in directory");

    const staffDeleteAttempt = deleteServerAccount(createdUser.id);
    assert.equal(staffDeleteAttempt.ok, true, "admin deletion of staff user should succeed");

    const userAfterDelete = findServerAccountById(createdUser.id);
    assert.equal(userAfterDelete, null, "deleted user must not exist in store");
  });

  await t.test("RBAC policies restrict management and deletion authority strictly to Admin role", () => {
    // users:manage allows user deletion decisions
    assert.equal(hasPermission("admin", "users:manage"), true, "admin must have users:manage");
    assert.equal(hasPermission("operations", "users:manage"), false, "operations cannot manage users");
    assert.equal(hasPermission("finance", "users:manage"), false, "finance cannot manage users");
    assert.equal(hasPermission("hr", "users:manage"), false, "hr cannot manage users");
    assert.equal(hasPermission("secretary", "users:manage"), false, "secretary cannot manage users");
    assert.equal(hasPermission("customer_representative", "users:manage"), false, "customer_representative cannot manage users");

    // report template management
    assert.equal(hasPermission("admin", "reports:manage_templates"), true, "admin can manage custom templates");
    assert.equal(hasPermission("operations", "reports:manage_templates"), false, "operations cannot manage templates");
  });

  await t.test("deleteFleetTruck removes truck from active registry and excludes it from queries", () => {
    deletedTruckPlateNumbers.clear();
    const originalTrucks = getFleetTrucks();
    const testTruck = originalTrucks[0];
    assert.ok(testTruck, "should have initial fleet trucks");

    const deleteRes = deleteFleetTruck(testTruck.plateNumber);
    assert.equal(deleteRes.ok, true, "deleting fleet truck should succeed");

    const remainingTrucks = getFleetTrucks();
    assert.equal(remainingTrucks.some((t) => t.plateNumber === testTruck.plateNumber), false, "deleted truck should be excluded from fleet trucks");

    const deleteAgain = deleteFleetTruck(testTruck.plateNumber);
    assert.equal(deleteAgain.ok, false, "deleting already deleted truck should return error");

    // Clean up
    deletedTruckPlateNumbers.clear();
  });
});
