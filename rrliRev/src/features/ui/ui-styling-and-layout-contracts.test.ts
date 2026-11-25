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

  const printCssPath = path.resolve(__dirname, "../../styles/print.css");
  const printCssContent = fs.existsSync(printCssPath) ? fs.readFileSync(printCssPath, "utf-8") : "";

  describe("Reports Print Architecture & Multi-Page Containment Contracts", () => {
    const combinedPrintCss = globalsCssContent + "\n" + printCssContent;

    it("hides print-only rows in normal screen mode", () => {
      assert.match(combinedPrintCss, /\.report-print-only-row\s*\{[^}]*display:\s*none\s*!important/);
    });

    it("defines authoritative @media print with viewport & scroll releases", () => {
      assert.ok(combinedPrintCss.includes("@media print"));
      assert.match(combinedPrintCss, /@media print\s*\{[\s\S]*html,\s*body\s*\{[^}]*overflow:\s*visible\s*!important/);
      assert.match(combinedPrintCss, /@media print\s*\{[\s\S]*\.app-shell[\s\S]*overflow:\s*visible\s*!important/);
    });

    it("hides navigation, toolbars, and web chrome during print", () => {
      assert.match(combinedPrintCss, /@media print\s*\{[\s\S]*aside\.sidebar[\s\S]*display:\s*none\s*!important/);
      assert.match(combinedPrintCss, /@media print\s*\{[\s\S]*header\.topbar[\s\S]*display:\s*none\s*!important/);
      assert.match(combinedPrintCss, /@media print\s*\{[\s\S]*\.report-actions[\s\S]*display:\s*none\s*!important/);
      assert.match(combinedPrintCss, /@media print\s*\{[\s\S]*\.report-tabs-bar[\s\S]*display:\s*none\s*!important/);
    });

    it("displays complete print rows while hiding paginated screen rows during print", () => {
      assert.match(combinedPrintCss, /@media print\s*\{[\s\S]*\.report-screen-only-row[\s\S]*display:\s*none\s*!important/);
      assert.match(combinedPrintCss, /@media print\s*\{[\s\S]*\.report-print-only-row\s*\{[^}]*display:\s*table-row\s*!important/);
    });
  });

  describe("CSS Structural Integrity & Layout Edge Protection Contracts", () => {
    it("ensures balanced opening and closing curly braces across globals.css and modular stylesheets", () => {
      function checkBraces(css: string, name: string) {
        let openBraces = 0;
        let closeBraces = 0;
        for (const char of css) {
          if (char === "{") openBraces++;
          if (char === "}") closeBraces++;
        }
        assert.strictEqual(openBraces, closeBraces, `Unbalanced braces in ${name}: ${openBraces} open vs ${closeBraces} close`);
      }

      checkBraces(globalsCssContent, "globals.css");
      checkBraces(printCssContent, "print.css");

      const modularFiles = ["login.css", "delivery-import.css", "permissions.css", "components.css", "overrides.css"];
      for (const file of modularFiles) {
        const filePath = path.resolve(__dirname, "../../styles", file);
        if (fs.existsSync(filePath)) {
          checkBraces(fs.readFileSync(filePath, "utf-8"), file);
        }
      }
    });

    it("does not contain truncated diff markers or diff artifact strings", () => {
      assert.ok(!globalsCssContent.includes("... [truncated for diff preview]"));
    });

    it("ensures content-wrap enforces generous horizontal padding across all layout modes", () => {
      assert.match(globalsCssContent, /\.content-wrap\s*\{[^}]*padding-left:\s*clamp\(56px,\s*5vw,\s*96px\)\s*!important/);
      assert.match(globalsCssContent, /\.content-wrap\s*\{[^}]*padding-right:\s*clamp\(56px,\s*5vw,\s*96px\)\s*!important/);
    });

    it("ensures page intro action buttons maintain gap and individual border radius", () => {
      assert.match(globalsCssContent, /\.page-intro-actions[^{]*\{[^}]*gap:\s*12px\s*!important/);
      assert.match(globalsCssContent, /\.page-intro-actions\s*>\s*\*[^}]*border-radius:\s*8px\s*!important/);
    });

    it("enforces modular stylesheet architecture and size hygiene across globals and modules", () => {
      const lineCount = globalsCssContent.split("\n").length;
      assert.ok(
        lineCount >= 15000 && lineCount <= 18000,
        `globals.css line count out of expected modular baseline range (actual: ${lineCount}).`,
      );
      const byteSize = Buffer.byteLength(globalsCssContent, "utf-8");
      assert.ok(
        byteSize >= 450000,
        `globals.css file size dropped unexpectedly below 450KB (actual: ${byteSize} bytes). Check for accidental truncation.`,
      );
    });

    it("ensures critical domain selectors across all views are preserved across styling architecture", () => {
      const requiredSelectors = [
        ".dashboard-attention-card",
        ".expand-all-text-button",
        ".revenue-chart-card",
        ".table-wrap th .sortable-table-header",
        ".waybill-code",
        ".cell-truck",
        ".truck-card-metric",
        ".settings-security-minimal-list",
        ".export-package-row",
        "@media print",
        ".report-document",
      ];
      const allCss = globalsCssContent + "\n" + printCssContent;
      for (const selector of requiredSelectors) {
        assert.ok(
          allCss.includes(selector),
          `Missing critical selector "${selector}" across styling architecture. This indicates an accidental deletion or regression.`,
        );
      }
    });
  });

  describe("Modular CSS Architecture Contracts", () => {
    const componentsCssPath = path.resolve(__dirname, "../../styles/components.css");
    const loginCssPath = path.resolve(__dirname, "../../styles/login.css");
    const deliveryImportCssPath = path.resolve(__dirname, "../../styles/delivery-import.css");
    const permissionsCssPath = path.resolve(__dirname, "../../styles/permissions.css");
    const printCssFilePath = path.resolve(__dirname, "../../styles/print.css");
    const overridesCssPath = path.resolve(__dirname, "../../styles/overrides.css");

    it("defines dedicated modular components.css for shared controls under 500 lines", () => {
      assert.ok(fs.existsSync(componentsCssPath), "src/styles/components.css must exist.");
      const content = fs.readFileSync(componentsCssPath, "utf-8");
      assert.ok(content.includes(".routex-btn"));
      assert.ok(content.includes(".routex-input-wrapper"));
      assert.ok(content.includes(".routex-tab-trigger"));
      assert.ok(content.includes(".routex-badge-dot"));
      const lines = content.split("\n").length;
      assert.ok(lines <= 500, `components.css must remain a focused, modular file under 500 lines (actual: ${lines}).`);
    });

    it("defines dedicated modular stylesheets for isolated domains (login, delivery import, permissions, print)", () => {
      assert.ok(fs.existsSync(loginCssPath), "src/styles/login.css must exist.");
      assert.ok(fs.existsSync(deliveryImportCssPath), "src/styles/delivery-import.css must exist.");
      assert.ok(fs.existsSync(permissionsCssPath), "src/styles/permissions.css must exist.");
      assert.ok(fs.existsSync(printCssFilePath), "src/styles/print.css must exist.");

      assert.ok(fs.readFileSync(loginCssPath, "utf-8").includes(".login-page"));
      assert.ok(fs.readFileSync(deliveryImportCssPath, "utf-8").includes(".import-stepper"));
      assert.ok(fs.readFileSync(permissionsCssPath, "utf-8").includes(".discord-permissions-container"));
      assert.ok(fs.readFileSync(printCssFilePath, "utf-8").includes("@media print"));
    });

    it("defines dedicated overrides.css for isolated feature refinements and neutralizes pill styling", () => {
      assert.ok(fs.existsSync(overridesCssPath), "src/styles/overrides.css must exist.");
      const content = fs.readFileSync(overridesCssPath, "utf-8");
      assert.ok(content.includes(".access-pill"));
      assert.ok(content.includes(".access-pill::before"));
      assert.ok(content.includes("display: none !important;"));
      assert.ok(content.includes("background: transparent !important;"));
      assert.ok(content.includes("border: none !important;"));
    });

    it("ensures root layout.tsx imports both globals.css and modular stylesheets in correct cascade order", () => {
      const layoutPath = path.resolve(__dirname, "../../app/layout.tsx");
      const layoutContent = fs.readFileSync(layoutPath, "utf-8");
      assert.ok(layoutContent.includes('import "./globals.css";'));
      assert.ok(layoutContent.includes('import "@/styles/components.css";'));
      assert.ok(layoutContent.includes('import "@/styles/login.css";'));
      assert.ok(layoutContent.includes('import "@/styles/delivery-import.css";'));
      assert.ok(layoutContent.includes('import "@/styles/permissions.css";'));
      assert.ok(layoutContent.includes('import "@/styles/print.css";'));
      assert.ok(layoutContent.includes('import "@/styles/overrides.css";'));

      const globalsIndex = layoutContent.indexOf('import "./globals.css";');
      const componentsIndex = layoutContent.indexOf('import "@/styles/components.css";');
      const loginIndex = layoutContent.indexOf('import "@/styles/login.css";');
      const importIndex = layoutContent.indexOf('import "@/styles/delivery-import.css";');
      const permissionsIndex = layoutContent.indexOf('import "@/styles/permissions.css";');
      const printIndex = layoutContent.indexOf('import "@/styles/print.css";');
      const overridesIndex = layoutContent.indexOf('import "@/styles/overrides.css";');

      assert.ok(globalsIndex < componentsIndex, "globals.css before components.css");
      assert.ok(componentsIndex < loginIndex, "components.css before login.css");
      assert.ok(loginIndex < importIndex, "login.css before delivery-import.css");
      assert.ok(importIndex < permissionsIndex, "delivery-import.css before permissions.css");
      assert.ok(permissionsIndex < printIndex, "permissions.css before print.css");
      assert.ok(printIndex < overridesIndex, "print.css before overrides.css");
    });
  });
});
