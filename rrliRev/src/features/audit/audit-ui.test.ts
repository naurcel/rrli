import assert from "node:assert/strict";
import test from "node:test";

import {
  extractStateChanges,
  formatAuditValue,
  getActionVisuals,
} from "./audit-formatters.ts";

test("extractStateChanges accurately pairs old and new field transitions", () => {
  // Username update
  const usernameChanges = {
    oldUsername: "old_driver",
    newUsername: "new_driver",
  };
  const parsedUsername = extractStateChanges(usernameChanges);
  assert.equal(parsedUsername.hasChanges, true);
  assert.equal(parsedUsername.transitions.length, 1);
  assert.equal(parsedUsername.transitions[0].field, "Username");
  assert.equal(parsedUsername.transitions[0].oldValue, "old_driver");
  assert.equal(parsedUsername.transitions[0].newValue, "new_driver");
  assert.equal(parsedUsername.attributes.length, 0);

  // Financial correction with previous and new toll values
  const financialChanges = {
    previousToll: 1750,
    tollGateExpenses: 1600,
    version: 2,
  };
  const parsedFinancial = extractStateChanges(financialChanges);
  assert.equal(parsedFinancial.hasChanges, true);
  assert.equal(parsedFinancial.transitions.length, 1);
  assert.equal(parsedFinancial.transitions[0].field, "tollGateExpenses");
  assert.equal(parsedFinancial.transitions[0].label, "Toll Gate Expenses");
  assert.equal(parsedFinancial.transitions[0].oldValue, 1750);
  assert.equal(parsedFinancial.transitions[0].newValue, 1600);
  assert.equal(parsedFinancial.attributes.length, 1);
  assert.equal(parsedFinancial.attributes[0].field, "version");

  // Nested before and after objects
  const nestedChanges = {
    before: { role: "operations", isActive: true },
    after: { role: "admin", isActive: true },
  };
  const parsedNested = extractStateChanges(nestedChanges);
  assert.equal(parsedNested.transitions.length, 1);
  assert.equal(parsedNested.transitions[0].field, "role");
  assert.equal(parsedNested.transitions[0].oldValue, "operations");
  assert.equal(parsedNested.transitions[0].newValue, "admin");
});

test("extractStateChanges parses single attributes and creation metadata", () => {
  const creationChanges = {
    clientName: "Landers Superstore",
    plateNumber: "NBM 3012",
    deliveryRate: 28000,
    isActive: true,
  };
  const parsed = extractStateChanges(creationChanges);
  assert.equal(parsed.hasChanges, true);
  assert.equal(parsed.transitions.length, 0);
  assert.equal(parsed.attributes.length, 4);

  const clientAttr = parsed.attributes.find((a) => a.field === "clientName");
  assert.ok(clientAttr);
  assert.equal(clientAttr?.label, "Client Account");
  assert.equal(clientAttr?.value, "Landers Superstore");
});

test("extractStateChanges handles empty, null, and undefined safely", () => {
  assert.equal(extractStateChanges(null).hasChanges, false);
  assert.equal(extractStateChanges(undefined).hasChanges, false);
  assert.equal(extractStateChanges({}).hasChanges, false);
});

test("formatAuditValue formats currencies, percentages, roles, and usernames cleanly", () => {
  assert.equal(formatAuditValue("deliveryRate", 28000), "₱28,000");
  assert.equal(formatAuditValue("tollGateExpenses", 1600.5), "₱1,600.5");
  assert.equal(formatAuditValue("marginPercent", 68.2), "68.2%");
  assert.equal(formatAuditValue("isActive", true), "Active");
  assert.equal(formatAuditValue("isActive", false), "Inactive");
  assert.equal(formatAuditValue("username", "suchi"), "@suchi");
  assert.equal(formatAuditValue("newUsername", "@already_prefixed"), "@already_prefixed");
  assert.equal(formatAuditValue("role", "customer_representative"), "Customer Representative");
  assert.equal(formatAuditValue("role", "finance"), "Finance");
  assert.equal(formatAuditValue("roles", ["admin", "finance"]), "admin, finance");
  assert.equal(formatAuditValue("emptyField", null), "None");
});

test("getActionVisuals assigns informative visual tones to audit events", () => {
  assert.equal(getActionVisuals("user.created").className, "attached");
  assert.equal(getActionVisuals("delivery.financials_finalized").className, "info");
  assert.equal(getActionVisuals("delivery.financials_corrected").className, "attention");
  assert.equal(getActionVisuals("user.password_changed").className, "security");
  assert.equal(getActionVisuals("user.recovery_authorized").className, "security");
  assert.equal(getActionVisuals("user.username_changed_by_admin").className, "security");
});
