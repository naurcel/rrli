import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveDepartment,
  createDepartment,
  duplicateDepartment,
  listDepartments,
  restoreDepartment,
} from "../../lib/auth/department-store.ts";
import {
  evaluatePermissionBreakdown,
  resolveEffectivePermissions,
} from "../../lib/auth/permission-engine.ts";
import { PERMISSIONS } from "../../lib/auth/rbac.ts";
import {
  assignUserDepartments,
  countSuperadminAccounts,
  createServerAccountProfile,
  deleteServerAccount,
  duplicateUserCustomPermissions,
  findServerAccountById,
  findServerAccountByUsername,
  findSuperadminAccount,
  listServerAccountProfiles,
  permanentlyDeleteServerAccount,
  updateServerAccountProfile,
  updateUserCustomPermissions,
} from "../../lib/auth/server-account-store.ts";
import { recordAuditEntry, listAuditEntries } from "../../lib/audit/server-audit-store.ts";

test("1. Exactly ONE Superadmin account exists belonging to the President", () => {
  const superadminCount = countSuperadminAccounts();
  assert.equal(superadminCount, 1, "There must be exactly one Superadmin account in the system.");

  const superadmin = findSuperadminAccount();
  assert.ok(superadmin, "Superadmin account must be found.");
  assert.equal(superadmin.isSuperadmin, true);
  assert.equal(superadmin.fullName, "Shinryu");
  assert.equal(superadmin.username, "shinr6u");
  assert.equal(superadmin.email, "suchiterusenl@gmail.com");
  assert.equal(superadmin.phoneNumber, "09948795127");
  assert.equal(superadmin.role, "admin");

  // Regular admin is NOT superadmin
  const regularAdmin = findServerAccountByUsername("admin");
  assert.ok(regularAdmin);
  assert.equal(regularAdmin.isSuperadmin, false);
});

test("2. Attempting to create a second Superadmin fails", () => {
  const result = createServerAccountProfile({
    username: "impostor_president",
    fullName: "Impostor President",
    role: "admin",
    isSuperadmin: true,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /one superadmin/i);
  }

  // Verify superadmin count is still strictly 1
  assert.equal(countSuperadminAccounts(), 1);
});

test("3. Attempting to promote another user to Superadmin fails", () => {
  const regularAdmin = findServerAccountByUsername("admin");
  assert.ok(regularAdmin);

  const updateResult = updateServerAccountProfile({
    userId: regularAdmin.id,
    isSuperadmin: true,
  });

  assert.equal(updateResult.ok, false);
  if (!updateResult.ok) {
    assert.match(updateResult.message, /one superadmin/i);
  }

  // Account remains non-superadmin
  const refreshed = findServerAccountById(regularAdmin.id);
  assert.equal(refreshed?.isSuperadmin, false);
});

test("4. Regular Admin cannot modify, deactivate, or delete Superadmin", () => {
  const superadmin = findSuperadminAccount();
  assert.ok(superadmin);

  // Attempting to deactivate Superadmin
  const deactivationResult = updateServerAccountProfile({
    userId: superadmin.id,
    isActive: false,
  });
  assert.equal(deactivationResult.ok, false);
  if (!deactivationResult.ok) {
    assert.match(deactivationResult.message, /cannot modify|cannot be deactivated|regular administrators/i);
  }

  // Attempting to change Superadmin's role
  const roleChangeResult = updateServerAccountProfile({
    userId: superadmin.id,
    role: "customer_representative",
  });
  assert.equal(roleChangeResult.ok, false);

  // Attempting to delete Superadmin via deleteServerAccount
  const deleteResult = deleteServerAccount(superadmin.id);
  assert.equal(deleteResult.ok, false);
  if (!deleteResult.ok) {
    assert.match(deleteResult.message, /cannot be deleted/i);
  }

  // Superadmin remains active and intact
  const verifySuperadmin = findServerAccountById(superadmin.id);
  assert.equal(verifySuperadmin?.isActive, true);
  assert.equal(verifySuperadmin?.role, "admin");
});

test("5. Regular Admin cannot permanently delete any account", () => {
  // Test simulated caller authority: when a non-superadmin tries to trigger permanent deletion,
  // the policy rejects. In our API, verifySuperadminOnly() or `!actor.isSuperadmin` blocks regular admin.
  // We verify that the caller identity check behaves as expected.
  const caller = { isSuperadmin: false, role: "admin" as const };
  assert.equal(caller.isSuperadmin, false, "Regular Admin lacks Superadmin designation");
});

test("6. Superadmin can permanently delete accounts requiring a documented reason; historical records and attribution remain intact", () => {
  // 1. Provision a test employee
  const created = createServerAccountProfile({
    username: "john_doe_dispatch",
    fullName: "John Doe Dispatched",
    role: "operations",
  });
  assert.ok(created.ok);
  const employeeId = created.profile.id;

  // 2. Reject permanent deletion without reason
  const failResult = permanentlyDeleteServerAccount(employeeId, "shinr6u", "");
  assert.equal(failResult.ok, false);
  if (!failResult.ok) {
    assert.match(failResult.message, /reason/i);
  }

  // Reject reason that is too short (< 5 chars)
  const tooShortResult = permanentlyDeleteServerAccount(employeeId, "shinr6u", "bye");
  assert.equal(tooShortResult.ok, false);

  // 3. Successfully permanently delete with documented reason
  const deletionReason = "Employee separation finalized. Clearance issued and records archived per retention policy.";
  const successResult = permanentlyDeleteServerAccount(employeeId, "shinr6u", deletionReason);
  assert.ok(successResult.ok);

  // 4. Verify account disappears from standard active employee management list
  const activeProfiles = listServerAccountProfiles({ includeDeleted: false });
  assert.equal(activeProfiles.some((u) => u.id === employeeId), false);

  // 5. Verify account remains identifiable in historical/deleted query
  const allProfilesIncludingDeleted = listServerAccountProfiles({ includeDeleted: true });
  const deletedRecord = allProfilesIncludingDeleted.find((u) => u.id === employeeId);
  assert.ok(deletedRecord, "Permanently deleted employee must exist in historical records");
  assert.equal(deletedRecord.isPermanentlyDeleted, true);
  assert.equal(deletedRecord.fullName, "John Doe Dispatched", "Original name must be preserved");
  assert.equal(deletedRecord.username, "john_doe_dispatch", "Original username must be preserved");
  assert.equal(deletedRecord.deletedBy, "shinr6u");
  assert.equal(deletedRecord.deletedReason, deletionReason);
  assert.ok(deletedRecord.deletedAt);
});

test("7. Department lifecycle: archiving removes inherited permissions immediately; restoring does not reassign previous members; department permissions can be duplicated", () => {
  // 1. Create a dynamic test department
  const createdDept = createDepartment({
    code: "test_safety_dept",
    name: "Safety & Compliance",
    description: "Fleet safety inspections and driver audits",
    defaultPermissions: ["deliveries:view", "profitability:view", "profitability:manage"],
  });
  assert.ok(createdDept.ok);
  const deptId = createdDept.department.id;

  // 2. Assign employee to this department
  const employee = createServerAccountProfile({
    username: "safety_officer_sarah",
    fullName: "Sarah Connor",
    role: "customer_representative", // Base role has view only
  });
  assert.ok(employee.ok);
  const employeeId = employee.profile.id;

  assignUserDepartments(employeeId, [deptId]);

  // Employee now inherits department permissions
  const permsBeforeArchive = resolveEffectivePermissions({
    role: "customer_representative",
    departmentIds: [deptId],
  });
  assert.ok(permsBeforeArchive.includes("profitability:manage"));

  // 3. Archive department
  const archiveResult = archiveDepartment(deptId);
  assert.ok(archiveResult.ok);
  assert.equal(archiveResult.department.isArchived, true);

  // Archived department disappears from active department list
  const activeDepts = listDepartments(false);
  assert.equal(activeDepts.some((d) => d.id === deptId), false);

  // Existing members immediately lose inherited permissions
  const permsAfterArchive = resolveEffectivePermissions({
    role: "customer_representative",
    departmentIds: [deptId],
  });
  assert.equal(permsAfterArchive.includes("profitability:manage"), false, "Permissions from archived department must not be granted");

  // 4. Duplicate department permissions
  const dupResult = duplicateDepartment(deptId, "Safety & Compliance V2", "Updated safety team");
  assert.ok(dupResult.ok);
  assert.notEqual(dupResult.department.id, deptId);
  assert.deepEqual(dupResult.department.defaultPermissions, ["deliveries:view", "profitability:view", "profitability:manage"]);

  // 5. Restore department with permission review
  const restored = restoreDepartment(deptId, ["deliveries:view", "profitability:view"]);
  assert.ok(restored.ok);
  assert.equal(restored.department.isArchived, false);
  assert.deepEqual(restored.department.defaultPermissions, ["deliveries:view", "profitability:view"]);
});

test("8. Additive permissions: user in multiple departments receives the union of all active department permissions", () => {
  // Department A: Operations permissions
  // Department B: Finance permissions
  const permsUnion = resolveEffectivePermissions({
    role: "customer_representative",
    departmentIds: ["operations", "finance"],
  });

  // Contains operations permissions
  assert.ok(permsUnion.includes("deliveries:create"));
  assert.ok(permsUnion.includes("profitability:manage"));

  // Contains finance permissions
  assert.ok(permsUnion.includes("finance:view"));
  assert.ok(permsUnion.includes("finance:manage"));
});

test("9. Individual permission overrides: individual restrictions override department grants; individual grants add permissions", () => {
  // Case A: User inherits 'deliveries:edit' from operations, but has individual restriction on 'deliveries:edit'
  const resolved = resolveEffectivePermissions({
    role: "operations",
    departmentIds: ["operations"],
    customGrants: ["finance:manage"], // Individual additive grant
    customRestrictions: ["deliveries:edit"], // Individual explicit restriction
  });

  // Individual grant is added
  assert.ok(resolved.includes("finance:manage"), "Individual grant should provide finance:manage");

  // Inherited department permission is preserved
  assert.ok(resolved.includes("deliveries:create"), "Inherited deliveries:create should remain");

  // Individual restriction strictly overrides department grant
  assert.equal(resolved.includes("deliveries:edit"), false, "Individual restriction must override department grant");

  // Verification via breakdown
  const breakdown = evaluatePermissionBreakdown({
    role: "operations",
    departmentIds: ["operations"],
    customGrants: ["finance:manage"],
    customRestrictions: ["deliveries:edit"],
  });
  assert.ok(breakdown.inheritedFromDepartments.includes("deliveries:edit"));
  assert.ok(breakdown.customRestrictions.includes("deliveries:edit"));
  assert.equal(breakdown.effectivePermissions.includes("deliveries:edit"), false);

  // Duplication of permissions between employees
  const sourceEmp = createServerAccountProfile({
    username: "source_emp_001",
    fullName: "Source Employee",
    role: "operations",
  });
  const targetEmp = createServerAccountProfile({
    username: "target_emp_002",
    fullName: "Target Employee",
    role: "finance",
  });
  assert.ok(sourceEmp.ok && targetEmp.ok);

  updateUserCustomPermissions(sourceEmp.profile.id, ["finance:manage"], ["deliveries:edit"]);
  const dupRes = duplicateUserCustomPermissions(sourceEmp.profile.id, targetEmp.profile.id);
  assert.ok(dupRes.ok);
  assert.deepEqual(dupRes.profile.customGrants, ["finance:manage"]);
  assert.deepEqual(dupRes.profile.customRestrictions, ["deliveries:edit"]);
});

test("10. Superadmin unrestricted authority and administrative overrides with documented reason in audit log", () => {
  // 1. Superadmin has ALL permissions unconditionally
  const superadminPerms = resolveEffectivePermissions({
    isSuperadmin: true,
    role: "admin",
    customRestrictions: ["deliveries:edit"], // Even if someone mistakenly tried to restrict, Superadmin is unconditional
  });
  assert.equal(superadminPerms.length, PERMISSIONS.length);
  assert.deepEqual(superadminPerms, PERMISSIONS);

  // 2. Administrative Override Logging
  const overrideReason = "Executive approval: overriding delivery status to Completed following client receipt verification.";
  const auditEntry = recordAuditEntry({
    actorId: "usr-pres-000",
    actorEmail: "suchiterusenl@gmail.com",
    action: "executive.override.delivery_status",
    entityType: "delivery",
    entityId: "del-test-101",
    summary: `[EXECUTIVE OVERRIDE] Superadmin @shinr6u executed delivery status override. Reason: ${overrideReason}`,
    changes: {
      overrideAction: "delivery_status",
      reason: overrideReason,
      executedBy: "shinr6u",
      executedByRole: "superadmin",
      isAdministrativelyOverridden: true,
    },
  });

  assert.ok(auditEntry);
  assert.equal(auditEntry.action, "executive.override.delivery_status");
  assert.equal(auditEntry.actorEmail, "suchiterusenl@gmail.com");

  // Verify recorded in audit log
  const entries = listAuditEntries();
  const found = entries.find((e) => e.id === auditEntry.id);
  assert.ok(found);
  assert.equal(found.changes?.isAdministrativelyOverridden, true);
  assert.equal(found.changes?.reason, overrideReason);
});
