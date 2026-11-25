import assert from "node:assert";
import test, { describe, it } from "node:test";
import { getRoleDashboardActions } from "./dashboard-header-actions.ts";

describe("Dashboard Role-Tailored Actions", () => {
  const currentDashboardUrl = "/dashboard";

  it("provides Finance role with 'Record expense / income' as primary and 'Import' as secondary", () => {
    const actions = getRoleDashboardActions("finance", false, false, currentDashboardUrl);

    assert.strictEqual(actions.primary.label, "Record expense / income");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/finance?record=1"));

    assert.strictEqual(actions.secondary.label, "Import");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/finance/import"));
  });

  it("provides Admin role with 'Add user' as primary and 'Record delivery' as secondary", () => {
    const actions = getRoleDashboardActions("admin", false, true, currentDashboardUrl);

    assert.strictEqual(actions.primary.label, "Add user");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/user-management#add-user"));

    assert.strictEqual(actions.secondary.label, "Record delivery");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/deliveries/new"));
  });

  it("provides President / Superadmin with 'Add user' as primary even if role is customized", () => {
    const actions = getRoleDashboardActions("custom_exec", true, true, currentDashboardUrl);

    assert.strictEqual(actions.primary.label, "Add user");
    assert.ok(actions.primary.href.includes("/user-management#add-user"));
    assert.strictEqual(actions.secondary.label, "Record delivery");
  });

  it("provides Operations role with 'Record delivery' as primary and 'Import' as secondary", () => {
    const actions = getRoleDashboardActions("operations", false, true, currentDashboardUrl);

    assert.strictEqual(actions.primary.label, "Record delivery");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/deliveries/new"));

    assert.strictEqual(actions.secondary.label, "Import");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/deliveries/import"));
  });

  it("provides HR role with 'Drivers & crew' as primary and 'View reports' as secondary", () => {
    const actions = getRoleDashboardActions("hr", false, false, currentDashboardUrl);

    assert.strictEqual(actions.primary.label, "Drivers & crew");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/drivers"));

    assert.strictEqual(actions.secondary.label, "View reports");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/reports"));
  });

  it("provides Secretary role with 'Verify PODs' as primary and 'View deliveries' as secondary", () => {
    const actions = getRoleDashboardActions("secretary", false, false, currentDashboardUrl);

    assert.strictEqual(actions.primary.label, "Verify PODs");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/pod-documents"));

    assert.strictEqual(actions.secondary.label, "View deliveries");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/deliveries"));
  });

  it("provides Customer Representative role with 'Search deliveries' as primary and 'Track PODs' as secondary", () => {
    const actions = getRoleDashboardActions("customer_representative", false, false, currentDashboardUrl);

    assert.strictEqual(actions.primary.label, "Search deliveries");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/deliveries"));

    assert.strictEqual(actions.secondary.label, "Track PODs");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/pod-documents"));
  });

  it("provides generic view-only roles with 'View deliveries' as primary and 'View reports' as secondary", () => {
    const actions = getRoleDashboardActions("unknown_viewer", false, false, currentDashboardUrl);

    assert.strictEqual(actions.primary.label, "View deliveries");
    assert.strictEqual(actions.primary.variant, "primary");
    assert.ok(actions.primary.href.includes("/deliveries"));

    assert.strictEqual(actions.secondary.label, "View reports");
    assert.strictEqual(actions.secondary.variant, "secondary");
    assert.ok(actions.secondary.href.includes("/reports"));
  });
});
