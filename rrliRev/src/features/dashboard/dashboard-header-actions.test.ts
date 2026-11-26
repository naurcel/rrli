import assert from "node:assert";
import test, { describe, it } from "node:test";
import { getRoleDashboardActions } from "./dashboard-header-actions.ts";

describe("Dashboard Role-Tailored Actions", () => {
  const currentDashboardUrl = "/dashboard";

  it("provides Finance role with 'Record expense / income' as primary and 'Import' as secondary", () => {
    const actions = getRoleDashboardActions("finance", false, false, currentDashboardUrl);

    assert.ok(actions.primary);
    assert.strictEqual(actions.primary.label, "Record expense / income");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/finance?record=1"));

    assert.ok(actions.secondary);
    assert.strictEqual(actions.secondary.label, "Import");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/finance/import"));
  });

  it("provides Admin role with 'Add user' as primary and no secondary action", () => {
    const actions = getRoleDashboardActions("admin", false, true, currentDashboardUrl);

    assert.ok(actions.primary);
    assert.strictEqual(actions.primary.label, "Add user");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/user-management#add-user"));
    assert.strictEqual(actions.secondary, null);
  });

  it("provides President / Superadmin with 'Add user' as primary and no record delivery secondary action", () => {
    const actions = getRoleDashboardActions("custom_exec", true, true, currentDashboardUrl);

    assert.ok(actions.primary);
    assert.strictEqual(actions.primary.label, "Add user");
    assert.ok(actions.primary.href.includes("/user-management#add-user"));
    assert.strictEqual(actions.secondary, null);
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

  it("provides generic view-only roles with no quick action buttons", () => {
    const actions = getRoleDashboardActions("unknown_viewer", false, false, currentDashboardUrl);

    assert.strictEqual(actions.primary, null);
    assert.strictEqual(actions.secondary, null);
  });
});
