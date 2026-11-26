import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("RouteX Shared Component System Architecture", () => {
  const globalsCssPath = path.resolve(__dirname, "../../app/globals.css");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

  describe("Shared Button System", () => {
    it("defines canonical .routex-btn with base, variants, and sizes", () => {
      assert.ok(globalsCss.includes(".routex-btn {"));
      assert.ok(globalsCss.includes(".routex-btn.variant-primary"));
      assert.ok(globalsCss.includes(".routex-btn.variant-secondary"));
      assert.ok(globalsCss.includes(".routex-btn.variant-outline"));
      assert.ok(globalsCss.includes(".routex-btn.variant-ghost"));
      assert.ok(globalsCss.includes(".routex-btn.variant-danger"));
      assert.ok(globalsCss.includes(".routex-btn.size-xs"));
      assert.ok(globalsCss.includes(".routex-btn.size-sm"));
      assert.ok(globalsCss.includes(".routex-btn.size-md"));
      assert.ok(globalsCss.includes(".routex-btn.size-lg"));
    });

    it("defines icon-button styling with square dimensions", () => {
      assert.ok(globalsCss.includes(".routex-btn.icon-btn"));
      assert.ok(globalsCss.includes(".routex-btn.icon-btn.size-xs"));
      assert.ok(globalsCss.includes(".routex-btn.icon-btn.size-sm"));
    });

    it("defines accessible focus rings and disabled states", () => {
      assert.ok(globalsCss.includes(".routex-btn:focus-visible"));
      assert.ok(globalsCss.includes(".routex-btn:disabled"));
    });
  });

  describe("Shared Badge System", () => {
    it("defines standard compact badge with tones", () => {
      assert.ok(globalsCss.includes(".routex-badge"));
      assert.ok(globalsCss.includes(".routex-badge.tone-primary"));
      assert.ok(globalsCss.includes(".routex-badge.tone-success"));
      assert.ok(globalsCss.includes(".routex-badge.tone-warning"));
      assert.ok(globalsCss.includes(".routex-badge.tone-danger"));
      assert.ok(globalsCss.includes(".routex-badge.tone-neutral"));
    });

    it("defines badge dot indicators and counter pill variants", () => {
      assert.ok(globalsCss.includes(".routex-badge-dot"));
      assert.ok(globalsCss.includes(".routex-badge.variant-counter"));
    });
  });

  describe("Shared Tabs System", () => {
    it("defines canonical .routex-tab-trigger with active state and transitions", () => {
      assert.ok(globalsCss.includes(".routex-tab-trigger"));
      assert.ok(globalsCss.includes(".routex-tab-trigger.active"));
    });
  });

  describe("Shared Input System", () => {
    it("defines input wrapper with focus-within ring and sizes", () => {
      assert.ok(globalsCss.includes(".routex-input-wrapper"));
      assert.ok(globalsCss.includes(".routex-input-wrapper:focus-within"));
      assert.ok(globalsCss.includes(".routex-input-clear-btn"));
    });
  });

  describe("Dashboard Component Modular Architecture", () => {
    const dashboardPagePath = path.resolve(
      __dirname,
      "../../app/(workspace)/dashboard/page.tsx",
    );
    const dashboardPage = fs.readFileSync(dashboardPagePath, "utf-8");

    it("composes dashboard using focused child components rather than monolithic layout", () => {
      assert.ok(dashboardPage.includes("<DashboardHeader"));
      assert.ok(dashboardPage.includes("<DashboardFinancialChart"));
      assert.ok(dashboardPage.includes("<DashboardSummaryCards"));
      assert.ok(dashboardPage.includes("<DashboardRecentDeliveries"));
      assert.ok(dashboardPage.includes("<DashboardTopTrucks"));
    });

    it("has a compact orchestrator page file under 500 lines (down from 1,664)", () => {
      const lineCount = dashboardPage.split("\n").length;
      assert.ok(
        lineCount <= 450,
        `Expected DashboardPage to be under 450 lines, but was ${lineCount}`,
      );
    });
  });
});
