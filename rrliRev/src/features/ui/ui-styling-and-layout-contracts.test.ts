import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("RouteX UI Styling and Layout Architectural Contracts", () => {
  const globalsCssPath = path.resolve(__dirname, "../../app/globals.css");
  const globalsCssContent = fs.readFileSync(globalsCssPath, "utf-8");

  describe("Canonical Design Tokens in globals.css", () => {
    it("defines essential surface, color, and accent tokens on :root", () => {
      assert.ok(globalsCssContent.includes("--color-page:"));
      assert.ok(globalsCssContent.includes("--color-surface:"));
      assert.ok(globalsCssContent.includes("--color-accent:"));
      assert.ok(globalsCssContent.includes("--color-accent-deep:"));
      assert.ok(globalsCssContent.includes("--color-status-success:"));
      assert.ok(globalsCssContent.includes("--color-status-warning:"));
    });

    it("defines centralized z-index hierarchy tokens on :root", () => {
      assert.ok(globalsCssContent.includes("--z-base: 1;"));
      assert.ok(globalsCssContent.includes("--z-sticky: 100;"));
      assert.ok(globalsCssContent.includes("--z-dropdown: 200;"));
      assert.ok(globalsCssContent.includes("--z-modal-backdrop: 1000;"));
      assert.ok(globalsCssContent.includes("--z-modal: 1050;"));
      assert.ok(globalsCssContent.includes("--z-tooltip: 1200;"));
    });

    it("defines standard compact badge design tokens on :root", () => {
      assert.ok(globalsCssContent.includes("--badge-radius:"));
      assert.ok(globalsCssContent.includes("--badge-font-size:"));
      assert.ok(globalsCssContent.includes("--badge-min-height:"));
    });
  });

  describe("App Shell Viewport & Scroll Containment Contracts", () => {
    it("ensures html and body enforce fixed viewport height and overflow containment", () => {
      assert.match(globalsCssContent, /html\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/);
      assert.match(globalsCssContent, /body\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/);
    });

    it("ensures app-shell enforces 100vh height and hidden overflow", () => {
      assert.match(globalsCssContent, /\.app-shell\s*\{[^}]*height:\s*100vh[^}]*overflow:\s*hidden/);
    });

    it("ensures main-content enforces independent vertical scrolling", () => {
      assert.match(globalsCssContent, /\.main-content\s*\{[^}]*overflow-y:\s*auto/);
    });
  });

  describe("CSS Architecture & Specificity Protections", () => {
    it("does not contain uncoordinated 6-digit z-index overrides", () => {
      assert.ok(!globalsCssContent.includes("z-index: 999999"));
    });

    it("does not style bare unconstrained input tags with disruptive backgrounds", () => {
      assert.doesNotMatch(globalsCssContent, /\ninput\s*\{[^}]*background-color\s*:/);
    });
  });

  describe("Tab & Permissions Architectural Placement", () => {
    const settingsPath = path.resolve(__dirname, "../../app/(workspace)/settings/page.tsx");
    const settingsContent = fs.readFileSync(settingsPath, "utf-8");

    const userManagementPath = path.resolve(__dirname, "../../app/(workspace)/user-management/page.tsx");
    const userManagementContent = fs.readFileSync(userManagementPath, "utf-8");

    it("ensures settings page tabs do not include permissions", () => {
      assert.ok(!settingsContent.includes('id="tab-permissions"'));
      assert.ok(!settingsContent.includes('setActiveTab("permissions")'));
    });

    it("ensures user management page includes permissions tab and excludes departments tab", () => {
      assert.ok(userManagementContent.includes('id="tab-permissions"'));
      assert.ok(!userManagementContent.includes('id="tab-departments"'));
      assert.ok(!userManagementContent.includes('setActiveTab("departments")'));
    });
  });

  describe("Design Preferences (Font Size & Compactness) Scaling Contracts", () => {
    it("enforces small font size scale across body, tables, inputs, and buttons", () => {
      assert.ok(globalsCssContent.includes('html[data-font-size="small"]'));
      assert.ok(globalsCssContent.includes('font-size: 12px;'));
      assert.ok(globalsCssContent.includes('font-size: 8px !important;'));
      assert.ok(globalsCssContent.includes('font-size: 10.5px !important;'));
    });

    it("enforces default medium font size scale across body, tables, and buttons", () => {
      assert.ok(globalsCssContent.includes('html[data-font-size="default"]'));
      assert.ok(globalsCssContent.includes('font-size: 14px;'));
      assert.ok(globalsCssContent.includes('font-size: 9px;'));
      assert.ok(globalsCssContent.includes('font-size: 12px;'));
    });

    it("enforces large font size scale across body, tables, inputs, and buttons", () => {
      assert.ok(globalsCssContent.includes('html[data-font-size="large"]'));
      assert.ok(globalsCssContent.includes('font-size: 16px;'));
      assert.ok(globalsCssContent.includes('font-size: 11px !important;'));
      assert.ok(globalsCssContent.includes('font-size: 14px !important;'));
    });

    it("enforces compact layout density modifiers for dense whitespace", () => {
      assert.ok(globalsCssContent.includes('html[data-compactness="compact"] td'));
      assert.ok(globalsCssContent.includes('padding-top: 7px !important;'));
      assert.ok(globalsCssContent.includes('padding-bottom: 7px !important;'));
    });

    it("enforces comfortable layout density modifiers for generous whitespace", () => {
      assert.ok(globalsCssContent.includes('html[data-compactness="comfortable"] td'));
      assert.ok(globalsCssContent.includes('padding-top: 18px !important;'));
      assert.ok(globalsCssContent.includes('padding-bottom: 18px !important;'));
    });
  });

  describe("Reports Print Architecture & Multi-Page Containment Contracts", () => {
    it("hides print-only rows in normal screen mode", () => {
      assert.match(globalsCssContent, /\.report-print-only-row\s*\{[^}]*display:\s*none\s*!important/);
    });

    it("defines authoritative @media print with viewport & scroll releases", () => {
      assert.ok(globalsCssContent.includes("@media print"));
      assert.match(globalsCssContent, /@media print\s*\{[\s\S]*html,\s*body\s*\{[^}]*overflow:\s*visible\s*!important/);
      assert.match(globalsCssContent, /@media print\s*\{[\s\S]*\.app-shell[\s\S]*overflow:\s*visible\s*!important/);
    });

    it("hides navigation, toolbars, and web chrome during print", () => {
      assert.match(globalsCssContent, /@media print\s*\{[\s\S]*aside\.sidebar[\s\S]*display:\s*none\s*!important/);
      assert.match(globalsCssContent, /@media print\s*\{[\s\S]*header\.topbar[\s\S]*display:\s*none\s*!important/);
      assert.match(globalsCssContent, /@media print\s*\{[\s\S]*\.report-actions[\s\S]*display:\s*none\s*!important/);
      assert.match(globalsCssContent, /@media print\s*\{[\s\S]*\.report-tabs-bar[\s\S]*display:\s*none\s*!important/);
    });

    it("displays complete print rows while hiding paginated screen rows during print", () => {
      assert.match(globalsCssContent, /@media print\s*\{[\s\S]*\.report-screen-only-row[\s\S]*display:\s*none\s*!important/);
      assert.match(globalsCssContent, /@media print\s*\{[\s\S]*\.report-print-only-row\s*\{[^}]*display:\s*table-row\s*!important/);
    });
  });

  describe("CSS Structural Integrity & Layout Edge Protection Contracts", () => {
    it("ensures balanced opening and closing curly braces across globals.css", () => {
      let openBraces = 0;
      let closeBraces = 0;
      for (const char of globalsCssContent) {
        if (char === "{") openBraces++;
        if (char === "}") closeBraces++;
      }
      assert.strictEqual(openBraces, closeBraces, `Unbalanced braces in globals.css: ${openBraces} open vs ${closeBraces} close`);
    });

    it("does not contain truncated diff markers or diff artifact strings", () => {
      assert.ok(!globalsCssContent.includes("... [truncated for diff preview]"));
    });

    it("ensures content-wrap enforces generous horizontal padding across all layout modes", () => {
      assert.match(globalsCssContent, /\.content-wrap\s*\{[^}]*padding-left:\s*42px\s*!important/);
      assert.match(globalsCssContent, /\.content-wrap\s*\{[^}]*padding-right:\s*42px\s*!important/);
    });

    it("ensures page intro action buttons maintain gap and individual border radius", () => {
      assert.match(globalsCssContent, /\.page-intro-actions[^{]*\{[^}]*gap:\s*12px\s*!important/);
      assert.match(globalsCssContent, /\.page-intro-actions\s*>\s*\*[^}]*border-radius:\s*8px\s*!important/);
    });
  });
});
