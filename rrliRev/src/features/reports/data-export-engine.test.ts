import assert from "node:assert/strict";
import test from "node:test";

import { SMALL_MOCK_COMPANY_EXPENSES } from "../deliveries/small-mock-database.ts";
import { listSmallMockDeliveryRecords } from "../deliveries/small-mock-repository.ts";
import {
  buildScopedExportPayload,
  canAccessDataExportTab,
  canApproveDataExports,
  canDownloadExportRequest,
  canRequestDataExports,
  createDataExportRequest,
  generateDatabaseJsonDump,
  generateDatabaseSqlDump,
  generateDatasetsCsvBundle,
  generateDatasetsXlsxWorkbook,
  generateWorkingWebsiteHtml,
  reviewDataExportRequest,
} from "./data-export-engine.ts";
import {
  parseArchiveMachineText,
  parseArchiveMachineWorkbook,
} from "../archive/archive-machine.ts";

const allMockDeliveries = listSmallMockDeliveryRecords({ page: 1, pageSize: 100 }).items;

test("buildScopedExportPayload strictly filters deliveries and company expenses by the selected date range", () => {
  const octPayload = buildScopedExportPayload({
    deliveries: allMockDeliveries,
    companyExpenses: SMALL_MOCK_COMPANY_EXPENSES,
    dateFrom: "2026-10-01",
    dateTo: "2026-10-31",
    periodLabel: "Oct 1, 2026 - Oct 31, 2026",
    generatedBy: "admin",
  });

  assert.ok(octPayload.deliveries.length > 0);
  assert.ok(
    octPayload.deliveries.every(
      (d) => d.deliveryDate >= "2026-10-01" && d.deliveryDate <= "2026-10-31",
    ),
  );
  assert.ok(
    octPayload.companyExpenses.every(
      (e) => e.expenseDate >= "2026-10-01" && e.expenseDate <= "2026-10-31",
    ),
  );
  assert.ok(octPayload.summary.companyNetProfit > 0);
});

test("generateDatasetsCsvBundle, generateDatabaseJsonDump, generateDatabaseSqlDump, and generateWorkingWebsiteHtml produce valid date-filtered exports", () => {
  const payload = buildScopedExportPayload({
    deliveries: allMockDeliveries,
    companyExpenses: SMALL_MOCK_COMPANY_EXPENSES,
    dateFrom: "2026-11-01",
    dateTo: "2026-11-30",
    periodLabel: "Nov 1, 2026 - Nov 30, 2026",
    generatedBy: "admin",
  });

  const csv = generateDatasetsCsvBundle(payload);
  assert.ok(csv.includes("ROUTEX COMPLETE DATASETS EXPORT"));
  assert.ok(csv.includes("2. DELIVERIES DATASET"));
  assert.ok(csv.includes("3. STORE DROP-OFFS & POD DATASET"));
  assert.ok(csv.includes("4. TRUCK PROFITABILITY DATASET"));
  assert.ok(csv.includes("5. COMPANY OPERATING EXPENSES DATASET"));

  const jsonDump = JSON.parse(generateDatabaseJsonDump(payload));
  assert.equal(jsonDump.schemaVersion, "routex-db-snapshot-v1");
  assert.equal(jsonDump.exportMetadata.periodLabel, "Nov 1, 2026 - Nov 30, 2026");
  assert.equal(jsonDump.tables.deliveries.length, payload.deliveries.length);

  const sqlDump = generateDatabaseSqlDump(payload);
  assert.ok(sqlDump.includes("INSERT INTO public.deliveries"));
  assert.ok(sqlDump.includes("INSERT INTO public.delivery_dropoffs"));
  assert.ok(sqlDump.includes("INSERT INTO public.company_expenses"));

  const htmlWebsite = generateWorkingWebsiteHtml(payload);
  assert.ok(htmlWebsite.includes("<!DOCTYPE html>"));
  assert.ok(htmlWebsite.includes("Interactive Website Recreation"));
  assert.ok(htmlWebsite.includes("Nov 1, 2026 - Nov 30, 2026"));
  assert.ok(htmlWebsite.includes("const SNAPSHOT ="));

  const xlsxBytes = generateDatasetsXlsxWorkbook(payload);
  assert.ok(xlsxBytes instanceof Uint8Array);
  assert.ok(xlsxBytes.length > 1000, "Should generate multi-sheet XLSX binary workbook");

  // Round-trip every exported format through the Archive Machine parser
  const jsonArchive = parseArchiveMachineText(generateDatabaseJsonDump(payload), "archive-2026.json");
  assert.equal(jsonArchive.archiveYear, 2026);
  assert.equal(jsonArchive.deliveries.length, payload.deliveries.length);
  assert.equal(jsonArchive.companyExpenses.length, payload.companyExpenses.length);

  const htmlArchive = parseArchiveMachineText(htmlWebsite, "archive-2026.html");
  assert.equal(htmlArchive.archiveYear, 2026);
  assert.equal(htmlArchive.deliveries.length, payload.deliveries.length);
  assert.equal(htmlArchive.companyExpenses.length, payload.companyExpenses.length);

  const sqlArchive = parseArchiveMachineText(sqlDump, "archive-2026.sql");
  assert.equal(sqlArchive.archiveYear, 2026);
  assert.equal(sqlArchive.deliveries.length, payload.deliveries.length);
  assert.equal(sqlArchive.companyExpenses.length, payload.companyExpenses.length);

  const csvArchive = parseArchiveMachineText(csv, "archive-2026.csv");
  assert.equal(csvArchive.archiveYear, 2026);
  assert.ok(csvArchive.deliveries.length > 0);
  assert.equal(csvArchive.companyExpenses.length, payload.companyExpenses.length);

  const xlsxArchive = parseArchiveMachineWorkbook(xlsxBytes, "archive-2026.xlsx");
  assert.equal(xlsxArchive.archiveYear, 2026);
  assert.ok(xlsxArchive.deliveries.length > 0);
  assert.ok(xlsxArchive.companyExpenses.length > 0);
});

test("enforces Admin-only approval governance for Operations and Finance export requests", () => {
  assert.equal(canAccessDataExportTab("admin"), true);
  assert.equal(canAccessDataExportTab("operations"), true);
  assert.equal(canAccessDataExportTab("finance"), true);
  assert.equal(canAccessDataExportTab("hr"), false);

  assert.equal(canApproveDataExports("admin"), true);
  assert.equal(canApproveDataExports("operations"), false);
  assert.equal(canApproveDataExports("finance"), false);

  assert.equal(canRequestDataExports("operations"), true);
  assert.equal(canRequestDataExports("finance"), true);
  assert.equal(canRequestDataExports("admin"), false);

  const req = createDataExportRequest({
    packageType: "website_recreation",
    requestedByUsername: "operations",
    requestedByFullName: "Operations User",
    requestedByRole: "operations",
    reason: "Offline field verification for November dispatches.",
    dateFrom: "2026-11-01",
    dateTo: "2026-11-18",
    periodLabel: "Nov 1, 2026 - Nov 18, 2026",
  });

  // Pending request cannot be downloaded by operations or finance yet
  assert.equal(canDownloadExportRequest(req, { role: "operations", username: "operations" }), false);
  assert.equal(canDownloadExportRequest(req, { role: "finance", username: "finance" }), false);
  assert.equal(canDownloadExportRequest(req, { role: "admin", username: "admin" }), true);

  // Operations or Finance cannot self-approve
  assert.throws(() =>
    reviewDataExportRequest({
      requestId: req.id,
      decision: "approved",
      reviewerRole: "operations",
      reviewerUsername: "operations",
    }),
  );

  // Once approved by Admin, requester can download
  const approvedReq = { ...req, status: "approved" as const, reviewedByUsername: "admin" };
  assert.equal(
    canDownloadExportRequest(approvedReq, { role: "operations", username: "operations" }),
    true,
  );
  assert.equal(
    canDownloadExportRequest(approvedReq, { role: "finance", username: "finance" }),
    false,
  );
});
