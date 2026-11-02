import assert from "node:assert/strict";
import test from "node:test";

import {
  canImportAndReviewExcel,
  canManageUsers,
  canMutateDeliveryRecords,
  canVerifyPodDocuments,
  getAccessLevelForRole,
  getAuthorizedNavigationForRole,
  hasPermission,
  USER_ROLES,
  type UserRole,
} from "./rbac.ts";

test("maps all six canonical roles to the three access levels", () => {
  assert.equal(getAccessLevelForRole("admin"), "admin");
  assert.equal(getAccessLevelForRole("operations"), "operations");
  assert.equal(getAccessLevelForRole("finance"), "view_only");
  assert.equal(getAccessLevelForRole("hr"), "view_only");
  assert.equal(getAccessLevelForRole("secretary"), "view_only");
  assert.equal(getAccessLevelForRole("customer_representative"), "view_only");
});

test("enforces full system permissions for Admin", () => {
  assert.equal(canManageUsers("admin"), true);
  assert.equal(canMutateDeliveryRecords("admin"), true);
  assert.equal(canImportAndReviewExcel("admin"), true);
  assert.equal(canVerifyPodDocuments("admin"), true);
  assert.equal(hasPermission("admin", "users:manage"), true);
  assert.equal(hasPermission("admin", "deliveries:create"), true);
});

test("grants delivery, import, and POD permissions to Operations while denying User Management", () => {
  assert.equal(canMutateDeliveryRecords("operations"), true);
  assert.equal(canImportAndReviewExcel("operations"), true);
  assert.equal(canVerifyPodDocuments("operations"), true);
  assert.equal(canManageUsers("operations"), false);
  assert.equal(hasPermission("operations", "users:manage"), false);
  assert.equal(hasPermission("operations", "users:view"), false);
});

test("restricts Finance, HR, Secretary, and Customer Representative strictly to view-only permissions", () => {
  const viewOnlyRoles: readonly UserRole[] = [
    "finance",
    "hr",
    "secretary",
    "customer_representative",
  ];

  for (const role of viewOnlyRoles) {
    assert.equal(hasPermission(role, "dashboard:view"), true, `${role} dashboard:view`);
    assert.equal(hasPermission(role, "deliveries:view"), true, `${role} deliveries:view`);
    assert.equal(hasPermission(role, "pod:view"), true, `${role} pod:view`);
    assert.equal(hasPermission(role, "profitability:view"), true, `${role} profitability:view`);
    assert.equal(hasPermission(role, "reports:view"), true, `${role} reports:view`);
    assert.equal(hasPermission(role, "settings:view"), true, `${role} settings:view`);

    assert.equal(canMutateDeliveryRecords(role), false, `${role} must not mutate deliveries`);
    assert.equal(canImportAndReviewExcel(role), false, `${role} must not import Excel`);
    assert.equal(canVerifyPodDocuments(role), false, `${role} must not verify PODs`);
    assert.equal(canManageUsers(role), false, `${role} must not manage users`);
  }
});

test("exposes User Management navigation item only to Admin", () => {
  const adminNav = getAuthorizedNavigationForRole("admin");
  assert.equal(
    adminNav.management.some((item) => item.href === "/user-management"),
    true,
  );

  for (const role of USER_ROLES.filter((r) => r !== "admin")) {
    const nav = getAuthorizedNavigationForRole(role);
    assert.equal(
      nav.management.some((item) => item.href === "/user-management"),
      false,
      `${role} should not see /user-management in navigation`,
    );
  }
});

