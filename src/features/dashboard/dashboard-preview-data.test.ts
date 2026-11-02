import assert from "node:assert/strict";
import test from "node:test";

import { dashboardPreviewDeliveries, filterDashboardDeliveries, getDashboardMetrics, getPreviousDateRange, getRevenueSeries, getTopTrucks, type DashboardDelivery } from "./dashboard-preview-data.ts";

test("filters dashboard preview deliveries using inclusive local date boundaries", () => {
  const deliveries = filterDashboardDeliveries(dashboardPreviewDeliveries, { startDate: new Date(2026, 9, 28), endDate: new Date(2026, 9, 29) });
  assert.deepEqual(deliveries.map((delivery) => delivery.id), ["DLV-0312", "DLV-0311", "DLV-0310", "DLV-0309"]);
});

test("derives dashboard totals and rankings from the same filtered preview records", () => {
  const deliveries = filterDashboardDeliveries(dashboardPreviewDeliveries, { startDate: new Date(2026, 9, 23), endDate: new Date(2026, 9, 29) });
  assert.deepEqual(getDashboardMetrics(deliveries), { revenue: 239_300, totalExpenses: 115_300, netIncome: 124_000, profitMargin: (124_000 / 239_300) * 100, deliveries: 12 });
  assert.equal(getTopTrucks(deliveries, "revenue")[0]?.truck, "NBE 9042");
  assert.equal(getTopTrucks(deliveries, "netIncome")[0]?.truck, "NBE 9042");
});

test("applies access scope before date-scoped financial metrics", () => {
  const deliveries = filterDashboardDeliveries(
    dashboardPreviewDeliveries,
    { startDate: new Date(2026, 9, 28), endDate: new Date(2026, 9, 29) },
    (delivery) => delivery.truck !== "NBE 9042",
  );
  assert.deepEqual(deliveries.map((delivery) => delivery.id), ["DLV-0312", "DLV-0310", "DLV-0309"]);
  assert.equal(getDashboardMetrics(deliveries).revenue, 59_900);
});

test("ranks trucks by selected financial metric, preserving losses and zero-revenue N/A margins", () => {
  const deliveries: DashboardDelivery[] = [
    { id: "A", client: "A", completedOn: "2026-10-29", truck: "ALPHA 1", driver: "A", revenue: 100, expenses: 10, pod: "Attached" },
    { id: "B", client: "B", completedOn: "2026-10-29", truck: "BETA 2", driver: "B", revenue: 1_000, expenses: 500, pod: "Attached" },
    { id: "C", client: "C", completedOn: "2026-10-29", truck: "CHARLIE 3", driver: "C", revenue: 100, expenses: 150, pod: "Attached" },
    { id: "D", client: "D", completedOn: "2026-10-29", truck: "DELTA 4", driver: "D", revenue: 0, expenses: 50, pod: "Attached" },
  ];
  assert.equal(getTopTrucks(deliveries, "revenue", 4)[0]?.truck, "BETA 2");
  assert.equal(getTopTrucks(deliveries, "netIncome", 4)[0]?.truck, "BETA 2");
  assert.deepEqual(getTopTrucks(deliveries, "profitMargin", 4).map((truck) => truck.truck), ["ALPHA 1", "BETA 2", "CHARLIE 3", "DELTA 4"]);
  assert.equal(getTopTrucks(deliveries, "profitMargin", 4)[2]?.profitMargin, -50);
  assert.equal(getTopTrucks(deliveries, "profitMargin", 4)[3]?.profitMargin, null);
});

test("creates a complete date-aware revenue series and previous comparison period", () => {
  const range = { startDate: new Date(2026, 9, 27), endDate: new Date(2026, 9, 29) };
  assert.deepEqual(getRevenueSeries(dashboardPreviewDeliveries, range), [{ date: "2026-10-27", revenue: 35_400 }, { date: "2026-10-28", revenue: 35_100 }, { date: "2026-10-29", revenue: 46_400 }]);
  assert.deepEqual(getPreviousDateRange(range), { startDate: new Date(2026, 9, 24), endDate: new Date(2026, 9, 26) });
});
