import assert from "node:assert";
import test, { describe, it } from "node:test";
import { getRoleDashboardActions } from "./dashboard-header-actions.ts";

describe("Dashboard Role-Tailored Actions", () => {
  const currentDashboardUrl = "/dashboard";

  it("provides Finance role with 'Record transaction' as primary and 'Import transactions' as secondary", () => {
    const actions = getRoleDashboardActions("finance", false, false, currentDashboardUrl);

    assert.ok(actions.primary);
    assert.strictEqual(actions.primary.label, "Record transaction");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/finance?record=1"));

    assert.ok(actions.secondary);
    assert.strictEqual(actions.secondary.label, "Import transactions");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/finance/import"));
  });

  it("provides Admin role with 'Manage permissions' as secondary (white) and 'Add user' as primary (amber)", () => {
    const actions = getRoleDashboardActions("admin", false, true, currentDashboardUrl);

    assert.ok(actions.secondary);
    assert.strictEqual(actions.secondary.label, "Manage permissions");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/user-management#permissions"));

    assert.ok(actions.primary);
    assert.strictEqual(actions.primary.label, "Add user");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/user-management#add-user"));
  });

  it("provides President / Superadmin with 'Manage permissions' as secondary (white) and 'Add user' as primary (amber)", () => {
    const actions = getRoleDashboardActions("custom_exec", true, true, currentDashboardUrl);

    assert.ok(actions.secondary);
    assert.strictEqual(actions.secondary.label, "Manage permissions");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/user-management#permissions"));

    assert.ok(actions.primary);
    assert.strictEqual(actions.primary.label, "Add user");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/user-management#add-user"));
  });

  it("provides Operations role with 'Record delivery' as primary and 'Import' as secondary", () => {
    const actions = getRoleDashboardActions("operations", false, true, currentDashboardUrl);

    assert.ok(actions.primary);
    assert.strictEqual(actions.primary.label, "Record delivery");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/deliveries/new"));

    assert.ok(actions.secondary);
    assert.strictEqual(actions.secondary.label, "Import");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/deliveries/import"));
  });

  it("provides HR role with no quick action buttons", () => {
    const actions = getRoleDashboardActions("hr", false, false, currentDashboardUrl);

    assert.strictEqual(actions.primary, null);
    assert.strictEqual(actions.secondary, null);
  });

  it("provides Secretary role with no quick action buttons", () => {
    const actions = getRoleDashboardActions("secretary", false, false, currentDashboardUrl);

    assert.strictEqual(actions.primary, null);
    assert.strictEqual(actions.secondary, null);
  });

  it("provides Customer Representative role with no quick action buttons", () => {
    const actions = getRoleDashboardActions("customer_representative", false, false, currentDashboardUrl);

    assert.strictEqual(actions.primary, null);
    assert.strictEqual(actions.secondary, null);
  });

  it("provides any other non-admin/superadmin/operations/finance roles with no quick action buttons even if canWriteDeliveries is true", () => {
    const viewerActions = getRoleDashboardActions("unknown_viewer", false, false, currentDashboardUrl);
    assert.strictEqual(viewerActions.primary, null);
    assert.strictEqual(viewerActions.secondary, null);

    const customWriterActions = getRoleDashboardActions("custom_role", false, true, currentDashboardUrl);
    assert.strictEqual(customWriterActions.primary, null);
    assert.strictEqual(customWriterActions.secondary, null);
  });
});
