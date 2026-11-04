import assert from "node:assert/strict";
import test from "node:test";

import { canManageReportTemplates, hasPermission, USER_ROLES } from "../../lib/auth/rbac.ts";
import { type DeliveryTripRecord } from "../deliveries/delivery-domain.ts";
import {
  downloadReportCsvFile,
  filterDeliveriesForTemplate,
  formatCellValue,
  generateReportCsv,
  generateReportRows,
  processReport,
  resolveTemplateColumns,
} from "./report-engine.ts";
import {
  deleteServerReportTemplate,
  findServerReportTemplateById,
  listServerReportTemplates,
  saveServerReportTemplate,
} from "./report-template-store.ts";
import {
  BUILTIN_REPORT_TEMPLATES,
  DEFAULT_ACTIVITY_TEMPLATE,
  DEFAULT_EXPENSES_TEMPLATE,
  DEFAULT_PROFITABILITY_TEMPLATE,
  DEFAULT_REVENUE_TEMPLATE,
  DEFAULT_TRIP_LEDGER_TEMPLATE,
  getColumnCatalog,
  type ReportTemplate,
} from "./report-template-types.ts";

const MOCK_DELIVERIES: readonly DeliveryTripRecord[] = [
  {
    id: "del-01",
    waybillNumber: "WB-261101",
    deliveryDate: "2026-11-01",
    clientName: "Vanguard",
    plateNumber: "CBZ 1187",
    truckType: "10-Wheeler",
    truckOwnership: "Owned",
    truckTemperature: "-18°C",
    rateBasis: "Redeemed Rate",
    origin: "Vanguard Cross-Dock",
    distanceKm: 120,
    fuelRate: 90,
    deliveryRate: 25000,
    totalExpenses: 15000,
    netIncome: 10000,
    marginPercent: 40,
    financialState: "finalized",
    financialIntegrityIssues: [],
    version: 1,
    podStatus: "Verified",
    dropoffs: [
      {
        id: "drop-01",
        sequence: 1,
        storeName: "Wilcon Depot - Las Pinas",
        destinationArea: "Las Pinas City",
        entryFee: 150,
        entryFeeStatus: "confirmed",
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-01.pdf",
      },
      {
        id: "drop-02",
        sequence: 2,
        storeName: "S&R - Imus",
        destinationArea: "Imus City",
        entryFee: 150,
        entryFeeStatus: "confirmed",
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-02.pdf",
      },
    ],
    expenses: {
      dieselExpenses: 8000,
      tollGateExpenses: 1500,
      tollGateBreakdown: "SLEX: P1,500",
      driverDailyRate: 1500,
      driverAllowance: 500,
      helperDailyRate: 1200,
      helperAllowance: 300,
      entryFees: 300,
      otherExpenses: 1700,
    },
    expenseStates: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      entryFees: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      otherExpenses: "confirmed",
    },
  },
  {
    id: "del-02",
    waybillNumber: "WB-261102",
    deliveryDate: "2026-11-02",
    clientName: "Manila Comisario",
    plateNumber: "KLM 4821",
    truckType: "4-Wheeler",
    truckOwnership: "Subcontracted",
    truckTemperature: "4°C",
    rateBasis: "Trucker Rate",
    origin: "MCCI Central Commissary",
    distanceKm: 60,
    fuelRate: 88,
    deliveryRate: 12000,
    totalExpenses: 7000,
    netIncome: 5000,
    marginPercent: 41.67,
    financialState: "finalized",
    financialIntegrityIssues: [],
    version: 1,
    podStatus: "Incomplete",
    dropoffs: [
      {
        id: "drop-03",
        sequence: 1,
        storeName: "Kuya J - Alabang",
        destinationArea: "Festival Mall Alabang",
        entryFee: 200,
        entryFeeStatus: "confirmed",
        podSubmitted: false,
        supportingDocsComplete: false,
        documentRef: "",
      },
    ],
    expenses: {
      dieselExpenses: 3500,
      tollGateExpenses: 800,
      tollGateBreakdown: "MCX: P800",
      driverDailyRate: 1200,
      driverAllowance: 300,
      helperDailyRate: 900,
      helperAllowance: 100,
      entryFees: 200,
      otherExpenses: 0,
    },
    expenseStates: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "confirmed",
      entryFees: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      otherExpenses: "confirmed",
    },
  },
  {
    id: "del-03",
    waybillNumber: "WB-261103",
    deliveryDate: "2026-11-03",
    clientName: "Vanguard",
    plateNumber: "CBZ 1187",
    truckType: "10-Wheeler",
    truckOwnership: "Owned",
    truckTemperature: "-18°C",
    rateBasis: "Redeemed Rate",
    origin: "Vanguard Cross-Dock",
    distanceKm: 80,
    fuelRate: 89,
    deliveryRate: 18000,
    totalExpenses: null,
    netIncome: null,
    marginPercent: null,
    financialState: "incomplete",
    financialIntegrityIssues: ["tollGateExpenses is unknown"],
    version: 1,
    podStatus: "Pending",
    dropoffs: [
      {
        id: "drop-04",
        sequence: 1,
        storeName: "AllHome - Taguig",
        destinationArea: "Taguig City",
        entryFee: 100,
        entryFeeStatus: "confirmed",
        podSubmitted: false,
        supportingDocsComplete: false,
        documentRef: "",
      },
    ],
    expenses: {
      dieselExpenses: 4000,
      tollGateExpenses: null,
      tollGateBreakdown: "",
      driverDailyRate: 1500,
      driverAllowance: 500,
      helperDailyRate: 1200,
      helperAllowance: 300,
      entryFees: 100,
      otherExpenses: 0,
    },
    expenseStates: {
      dieselExpenses: "confirmed",
      tollGateExpenses: "unknown",
      entryFees: "confirmed",
      driverAllowance: "confirmed",
      driverDailyRate: "confirmed",
      helperAllowance: "confirmed",
      helperDailyRate: "confirmed",
      otherExpenses: "confirmed",
    },
  },
];

// ============================================================================
// 1. Built-in Standards & Default Protection
// ============================================================================

test("BUILTIN_REPORT_TEMPLATES provides all 5 standard company layouts as defaults", () => {
  assert.equal(BUILTIN_REPORT_TEMPLATES.length, 5);
  const ids = BUILTIN_REPORT_TEMPLATES.map((t) => t.id);
  assert.ok(ids.includes("default-revenue"));
  assert.ok(ids.includes("default-expenses"));
  assert.ok(ids.includes("default-profitability"));
  assert.ok(ids.includes("default-activity"));
  assert.ok(ids.includes("default-trip-ledger"));

  for (const t of BUILTIN_REPORT_TEMPLATES) {
    assert.equal(t.isDefault, true, `Template ${t.id} must be marked as isDefault`);
  }
});

test("Default templates cannot be deleted or overwritten by ID", () => {
  const deleteResult = deleteServerReportTemplate("default-revenue");
  assert.equal(deleteResult.ok, false);
  assert.match(deleteResult.message || "", /cannot be deleted/i);

  const overwriteResult = saveServerReportTemplate({
    id: "default-revenue",
    name: "Hacked Revenue",
    description: "test",
    baseType: "client_summary",
    layout: { title: "Bad", sectionHeading: "Bad" },
    columns: [],
    breakdown: {
      showGrossEarnings: false,
      showTotalExpenses: false,
      showNetProfit: false,
      showProfitMargin: false,
      showActiveTrucks: false,
      showStoreDropoffs: false,
      showDieselExpenses: false,
      showTollExpenses: false,
      showCrewCosts: false,
    },
    filters: { financialState: "all", truckOwnership: "all" },
  });
  assert.equal(overwriteResult.ok, false);
  assert.match(overwriteResult.message, /cannot be overwritten/i);
});

// ============================================================================
// 2. Custom Layouts: Dynamic Columns, Reordering & Heading Overrides
// ============================================================================

test("resolveTemplateColumns respects ordering, visibility, and custom heading labels", () => {
  const customColumns = [
    { id: "revenue", visible: true, order: 0, customLabel: "Billed Freight" },
    { id: "clientName", visible: true, order: 1, customLabel: "Customer Account" },
    { id: "deliveries", visible: false, order: 2 },
    { id: "share", visible: true, order: 3, customLabel: "% Share of Billings" },
  ];

  const resolved = resolveTemplateColumns("client_summary", customColumns);

  assert.equal(resolved.length, 3, "Only visible columns should be resolved");
  assert.equal(resolved[0].id, "revenue");
  assert.equal(resolved[0].label, "Billed Freight");
  assert.equal(resolved[1].id, "clientName");
  assert.equal(resolved[1].label, "Customer Account");
  assert.equal(resolved[2].id, "share");
  assert.equal(resolved[2].label, "% Share of Billings");
});

test("getColumnCatalog returns appropriate definitions for client_summary, truck_summary, and trip_ledger", () => {
  const clientCols = getColumnCatalog("client_summary");
  assert.ok(clientCols.some((c) => c.id === "clientName"));
  assert.ok(clientCols.some((c) => c.id === "revenue"));

  const truckCols = getColumnCatalog("truck_summary");
  assert.ok(truckCols.some((c) => c.id === "plateNumber"));
  assert.ok(truckCols.some((c) => c.id === "dieselExpenses"));
  assert.ok(truckCols.some((c) => c.id === "netProfit"));

  const ledgerCols = getColumnCatalog("trip_ledger");
  assert.ok(ledgerCols.some((c) => c.id === "waybillNumber"));
  assert.ok(ledgerCols.some((c) => c.id === "fuelRate"));
  assert.ok(ledgerCols.some((c) => c.id === "financialState"));
});

// ============================================================================
// 3. Report Processing Engine & Financial Consistency
// ============================================================================

test("filterDeliveriesForTemplate enforces finalized_only and truckOwnership filters", () => {
  const finalizedTemplate: ReportTemplate = {
    ...DEFAULT_REVENUE_TEMPLATE,
    filters: { financialState: "finalized_only", truckOwnership: "all" },
  };
  const filtered = filterDeliveriesForTemplate(MOCK_DELIVERIES, finalizedTemplate);
  assert.equal(filtered.length, 2, "Incomplete WB-261103 should be excluded when finalized_only");

  const ownedTemplate: ReportTemplate = {
    ...DEFAULT_REVENUE_TEMPLATE,
    filters: { financialState: "all", truckOwnership: "owned_only" },
  };
  const ownedFiltered = filterDeliveriesForTemplate(MOCK_DELIVERIES, ownedTemplate);
  assert.equal(ownedFiltered.length, 2, "Only owned CBZ 1187 trips should be included");
  assert.ok(ownedFiltered.every((d) => d.truckOwnership === "Owned"));

  const subcontractedTemplate: ReportTemplate = {
    ...DEFAULT_REVENUE_TEMPLATE,
    filters: { financialState: "all", truckOwnership: "subcontracted_only" },
  };
  const subFiltered = filterDeliveriesForTemplate(MOCK_DELIVERIES, subcontractedTemplate);
  assert.equal(subFiltered.length, 1);
  assert.equal(subFiltered[0].plateNumber, "KLM 4821");
});

test("processReport aggregates client summary correctly", () => {
  const result = processReport(MOCK_DELIVERIES, DEFAULT_REVENUE_TEMPLATE);

  assert.equal(result.template.id, "default-revenue");
  assert.equal(result.filteredDeliveryCount, 2);
  assert.equal(result.totals.grossEarnings, 37000); // 25000 + 12000
  assert.equal(result.totals.totalExpenses, 22000); // 15000 + 7000
  assert.equal(result.totals.netProfit, 15000); // 37000 - 22000
  assert.equal(result.rows.length, 2);

  const vanguardRow = result.rows.find((r) => r.clientName === "Vanguard");
  assert.ok(vanguardRow);
  assert.equal(vanguardRow.revenue, 25000);
  assert.equal(vanguardRow.deliveries, 1);
});

test("processReport itemizes trip ledger records with all operational attributes", () => {
  const result = processReport(MOCK_DELIVERIES, DEFAULT_TRIP_LEDGER_TEMPLATE);

  assert.equal(result.rows.length, 3, "Trip ledger with filter all includes all 3 trips");
  const wb1 = result.rows.find((r) => r.waybillNumber === "WB-261101");
  assert.ok(wb1);
  assert.equal(wb1.revenue, 25000);
  assert.equal(wb1.expenses, 15000);
  assert.equal(wb1.netIncome, 10000);
  assert.equal(wb1.financialState, "Finalized");
});

test("formatCellValue correctly formats currencies, percentages, and badges", () => {
  assert.equal(formatCellValue(25000, "currency"), "₱25,000");
  assert.equal(formatCellValue(40.5, "percent"), "40.5%");
  assert.equal(formatCellValue(null, "currency"), "—");
  assert.equal(formatCellValue(1250, "number"), "1,250");
  assert.equal(formatCellValue("Finalized", "badge"), "Finalized");
});

// ============================================================================
// 4. Excel CSV Export Generation
// ============================================================================

test("generateReportCsv creates compliant Excel CSV with company metadata, custom headers, and totals", () => {
  const customTemplate: ReportTemplate = {
    ...DEFAULT_REVENUE_TEMPLATE,
    layout: {
      title: "Monthly Client Billings",
      sectionHeading: "Revenue Breakdown",
      subtitle: "Custom Executive Summary",
    },
    columns: [
      { id: "clientName", visible: true, order: 0, customLabel: "Account Name" },
      { id: "revenue", visible: true, order: 1, customLabel: "Total Billed" },
    ],
  };

  const processed = processReport(MOCK_DELIVERIES, customTemplate);
  const csv = generateReportCsv(processed, "Nov 1, 2026 - Nov 30, 2026");

  // Verify company header and titles
  assert.ok(csv.includes("REDEEMED ROUTE LOGISTICS INC. · ROUTEX"));
  assert.ok(csv.includes("MONTHLY CLIENT BILLINGS"));
  assert.ok(csv.includes("Period: Nov 1, 2026 - Nov 30, 2026"));

  // Verify custom column labels are used in CSV table
  assert.ok(csv.includes("Account Name,Total Billed"));

  // Verify row values exist
  assert.ok(csv.includes("Vanguard,25000.00"));
  assert.ok(csv.includes("Manila Comisario,12000.00"));

  // Verify summary totals row
  assert.ok(csv.includes("TOTALS,37000.00"));
});

// ============================================================================
// 5. Template Persistence & Storage
// ============================================================================

test("saveServerReportTemplate creates and updates custom templates while listing them", () => {
  const saveRes = saveServerReportTemplate({
    name: "Executive Client Summary",
    description: "Detailed client financial overview",
    baseType: "client_summary",
    layout: {
      title: "Executive Summary",
      sectionHeading: "Client Accounts",
      subtitle: "Internal Company Ledger",
    },
    columns: [
      { id: "clientName", visible: true, order: 0, customLabel: "Client" },
      { id: "revenue", visible: true, order: 1, customLabel: "Revenue" },
    ],
    breakdown: {
      showGrossEarnings: true,
      showTotalExpenses: true,
      showNetProfit: true,
      showProfitMargin: true,
      showActiveTrucks: false,
      showStoreDropoffs: false,
      showDieselExpenses: false,
      showTollExpenses: false,
      showCrewCosts: false,
    },
    filters: {
      financialState: "finalized_only",
      truckOwnership: "all",
    },
    createdBy: "admin_test",
  });

  assert.equal(saveRes.ok, true);
  if (!saveRes.ok) return;

  const customId = saveRes.template.id;
  assert.ok(customId);
  assert.equal(saveRes.template.isDefault, false);

  const found = findServerReportTemplateById(customId);
  assert.ok(found);
  assert.equal(found.name, "Executive Client Summary");

  // Verify update works
  const updateRes = saveServerReportTemplate({
    id: customId,
    name: "Executive Client Summary Updated",
    description: "Updated description",
    baseType: "client_summary",
    layout: {
      title: "Executive Summary v2",
      sectionHeading: "Client Accounts",
    },
    columns: [{ id: "clientName", visible: true, order: 0 }],
    breakdown: saveRes.template.breakdown,
    filters: saveRes.template.filters,
  });
  assert.equal(updateRes.ok, true);
  if (updateRes.ok) {
    assert.equal(updateRes.template.name, "Executive Client Summary Updated");
  }

  // Verify deletion works
  const deleteRes = deleteServerReportTemplate(customId);
  assert.equal(deleteRes.ok, true);
  assert.equal(findServerReportTemplateById(customId), null);
});

// ============================================================================
// 6. RBAC Permission Checks
// ============================================================================

test("enforces that reports:manage_templates is granted exclusively to Admin role", () => {
  assert.equal(canManageReportTemplates("admin"), true);
  assert.equal(hasPermission("admin", "reports:manage_templates"), true);

  const nonAdminRoles = USER_ROLES.filter((r) => r !== "admin");
  for (const role of nonAdminRoles) {
    assert.equal(
      canManageReportTemplates(role),
      false,
      `Role ${role} must not have permission to manage report templates`,
    );
    assert.equal(
      hasPermission(role, "reports:manage_templates"),
      false,
      `Role ${role} must not have reports:manage_templates`,
    );
  }
});
