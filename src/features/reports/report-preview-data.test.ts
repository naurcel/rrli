import assert from "node:assert/strict";
import test from "node:test";

import { dashboardPreviewDeliveries } from "../dashboard/dashboard-preview-data.ts";
import { getReportPreview } from "./report-preview-data.ts";

test("report previews reconcile each aggregate with the supplied delivery preview", () => {
  const revenue = getReportPreview(dashboardPreviewDeliveries, "revenue");
  const profitability = getReportPreview(dashboardPreviewDeliveries, "profitability");

  assert.equal(revenue.rows.reduce((total, row) => total + row.primary, 0), revenue.totals.revenue);
  assert.equal(profitability.rows.reduce((total, row) => total + row.primary, 0), profitability.totals.netIncome);
  assert.equal(revenue.totals.deliveries, dashboardPreviewDeliveries.length);
});
