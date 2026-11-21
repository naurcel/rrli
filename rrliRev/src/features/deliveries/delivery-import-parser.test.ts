import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  generateImportErrorReport,
  generateSampleCsv,
  generateSampleXlsx,
  parseDelimitedText,
  parseDeliveryImport,
  parseXlsxDeliveryImport,
  validateStagedRow,
} from "./delivery-import-parser.ts";
import { canImportAndReviewExcel } from "../../lib/auth/rbac.ts";
import { canRoleAccessPath } from "../../lib/auth/route-policy.ts";

test("parseDelimitedText parses CSV correctly including quotes and escaped characters", () => {
  const csv = `Col1,Col2,"Col 3 with, comma","Col 4 with ""escaped"" quotes"\r\nval1,val2,"nested, text","quoted ""value"""`;
  const parsed = parseDelimitedText(csv);

  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], [
    "Col1",
    "Col2",
    "Col 3 with, comma",
    "Col 4 with \"escaped\" quotes",
  ]);
  assert.deepEqual(parsed[1], [
    "val1",
    "val2",
    "nested, text",
    "quoted \"value\"",
  ]);
});

test("parseDelimitedText auto-detects TSV delimiter", () => {
  const tsv = "Waybill\tClient\tPlate\tRate\nWB-101\tLanders\tCBL-1234\t15000";
  const parsed = parseDelimitedText(tsv);

  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], ["Waybill", "Client", "Plate", "Rate"]);
  assert.deepEqual(parsed[1], ["WB-101", "Landers", "CBL-1234", "15000"]);
});

test("parseDeliveryImport parses and validates clean CSV data", () => {
  const csv = `Waybill,Delivery Date,Client,Plate Number,Temperature,Revenue,Diesel,Tolls,Driver,Store,Area\nWB-2026-901,2026-11-01,Landers,NGS 4281,-18°C,25000,3500,800,Juan Dela Cruz,Landers Alabang,Muntinlupa`;
  const existing = new Set<string>();

  const result = parseDeliveryImport(csv, existing);
  assert.equal(result.totalGroupedDeliveries, 1);
  assert.equal(result.readyCount, 1);
  assert.equal(result.attentionCount, 0);
  assert.equal(result.duplicateCount, 0);

  const row = result.rows[0];
  assert.equal(row.waybillNumber, "WB-2026-901");
  assert.equal(row.clientName, "Landers");
  assert.equal(row.plateNumber, "NGS 4281");
  assert.equal(row.truckTemperature, "-18°C");
  assert.equal(row.deliveryRate, 25000);
  assert.equal(row.dieselExpenses, 3500);
  assert.equal(row.tollGateExpenses, 800);
  assert.equal(row.driverName, "Juan Dela Cruz");
  assert.equal(row.dropoffs.length, 1);
  assert.equal(row.dropoffs[0]?.storeName, "Landers Alabang");
  assert.equal(row.status, "ready");
});

test("parseDeliveryImport groups multi-stop dropoffs under the same waybill number", () => {
  const csv = `Waybill,Delivery Date,Client,Plate Number,Temperature,Revenue,Store,Area,Entry Fee
WB-MULTI-01,2026-11-02,Landers,NGS 4281,-18°C,28000,Landers Balintawak,Quezon City,150
WB-MULTI-01,2026-11-02,Landers,NGS 4281,-18°C,28000,Landers Otis,Manila,100
WB-MULTI-01,2026-11-02,Landers,NGS 4281,-18°C,28000,Landers BGC,Taguig,200`;

  const result = parseDeliveryImport(csv, new Set());
  assert.equal(result.totalRawRows, 3);
  assert.equal(result.totalGroupedDeliveries, 1);
  assert.equal(result.readyCount, 1);

  const grouped = result.rows[0];
  assert.equal(grouped.waybillNumber, "WB-MULTI-01");
  assert.equal(grouped.dropoffs.length, 3);
  assert.equal(grouped.dropoffs[0]?.storeName, "Landers Balintawak");
  assert.equal(grouped.dropoffs[0]?.entryFee, 150);
  assert.equal(grouped.dropoffs[1]?.storeName, "Landers Otis");
  assert.equal(grouped.dropoffs[1]?.entryFee, 100);
  assert.equal(grouped.dropoffs[2]?.storeName, "Landers BGC");
  assert.equal(grouped.dropoffs[2]?.entryFee, 200);
});

test("parseDeliveryImport flags existing system waybills as duplicates", () => {
  const csv = `Waybill,Delivery Date,Client,Plate Number,Temperature,Revenue,Store,Area\nWB-EXISTING-001,2026-11-01,Landers,NGS 4281,-18°C,22000,Store A,Area A`;
  const existing = new Set(["WB-EXISTING-001"]);

  const result = parseDeliveryImport(csv, existing);
  assert.equal(result.totalGroupedDeliveries, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.readyCount, 0);

  const row = result.rows[0];
  assert.equal(row.status, "duplicate");
  assert.ok(row.issues.some((i) => i.message.includes("already exists in the system")));
});

test("parseDeliveryImport flags rows with missing required fields or pre-2024 dates", () => {
  const csv = `Waybill,Delivery Date,Client,Plate Number,Temperature,Revenue,Store,Area
,2026-11-01,Landers,NGS 4281,-18°C,20000,Store A,Area A
WB-BAD-DATE,2023-12-31,Landers,NGS 4281,-18°C,20000,Store B,Area B
WB-ZERO-RATE,2026-11-01,Landers,NGS 4281,-18°C,0,Store C,Area C`;

  const result = parseDeliveryImport(csv, new Set());
  assert.equal(result.totalGroupedDeliveries, 3);
  assert.equal(result.readyCount, 0);
  assert.equal(result.attentionCount, 3);

  // Missing waybill
  assert.ok(result.rows[0].issues.some((i) => i.field === "waybillNumber"));
  // Date before 2024
  assert.ok(result.rows[1].issues.some((i) => i.field === "deliveryDate"));
  // Zero revenue
  assert.ok(result.rows[2].issues.some((i) => i.field === "deliveryRate"));
});

test("validateStagedRow allows fixing an invalid row interactively", () => {
  const invalidRow = {
    id: "test-row-1",
    rowNumber: 2,
    waybillNumber: "",
    deliveryDate: "2026-11-01",
    clientName: "Landers",
    plateNumber: "NGS 4281",
    truckType: "6-Wheeler" as const,
    truckOwnership: "Owned" as const,
    truckTemperature: "-18°C" as const,
    origin: "Depot",
    distanceKm: 50,
    fuelRate: 85,
    deliveryRate: 0,
    totalExpenses: null,
    dieselExpenses: null,
    tollGateExpenses: null,
    tollGateBreakdown: "",
    driverDailyRate: null,
    driverAllowance: null,
    driverName: null,
    helperDailyRate: null,
    helperAllowance: null,
    helperName: null,
    otherExpenses: null,
    dropoffs: [{ storeName: "Store 1", destinationArea: "Manila", entryFee: null }],
    status: "needs_attention" as const,
    issues: [],
  };

  const initialCheck = validateStagedRow(invalidRow, new Set());
  assert.equal(initialCheck.status, "needs_attention");
  assert.equal(initialCheck.issues.length, 2); // missing waybill, zero rate

  // Correct the fields
  const correctedRow = {
    ...invalidRow,
    waybillNumber: "WB-FIXED-001",
    deliveryRate: 21500,
  };

  const fixedCheck = validateStagedRow(correctedRow, new Set());
  assert.equal(fixedCheck.status, "ready");
  assert.equal(fixedCheck.issues.length, 0);
});

test("generateSampleCsv produces valid CSV template", () => {
  const template = generateSampleCsv();
  assert.ok(template.includes("Waybill Number"));
  assert.ok(template.includes("Delivery Date"));
  assert.ok(template.includes("Store Name"));

  const parsed = parseDeliveryImport(template, new Set());
  assert.ok(parsed.readyCount >= 2);
  assert.equal(parsed.attentionCount, 0);
});

test("generateImportErrorReport formats CSV with error breakdown", () => {
  const staged = [
    {
      id: "r1",
      rowNumber: 2,
      waybillNumber: "WB-DUP-01",
      deliveryDate: "2026-11-01",
      clientName: "Client A",
      plateNumber: "PLT 101",
      truckType: "6-Wheeler" as const,
      truckOwnership: "Owned" as const,
      truckTemperature: "-18°C" as const,
      origin: "Depot",
      distanceKm: 50,
      fuelRate: 85,
      deliveryRate: 20000,
      totalExpenses: 5000,
      dieselExpenses: null,
      tollGateExpenses: null,
      tollGateBreakdown: "",
      driverDailyRate: null,
      driverAllowance: null,
      driverName: null,
      helperDailyRate: null,
      helperAllowance: null,
      helperName: null,
      otherExpenses: null,
      dropoffs: [{ storeName: "Store A", destinationArea: "Area A", entryFee: null }],
      status: "duplicate" as const,
      issues: [{ field: "waybillNumber", message: "Duplicate" }],
    },
  ];

  const report = generateImportErrorReport(staged, {
    batchName: "Test Batch",
    committedCount: 0,
    committedWaybills: [],
    duplicateCount: 1,
    duplicateWaybills: ["WB-DUP-01"],
    errors: [],
  });

  assert.ok(report.includes("WB-DUP-01"));
  assert.ok(report.includes("DUPLICATE_SKIPPED"));
});

test("Operations and Admin roles have full authorization to import deliveries", () => {
  assert.equal(canImportAndReviewExcel("operations"), true);
  assert.equal(canImportAndReviewExcel("admin"), true);
  assert.equal(canRoleAccessPath("operations", "/deliveries/import"), true);
  assert.equal(canRoleAccessPath("operations", "/api/deliveries/import"), true);
});

test("generateSampleXlsx and parseXlsxDeliveryImport successfully roundtrip Excel spreadsheets", () => {
  const xlsxBytes = generateSampleXlsx();
  assert.ok(xlsxBytes.length > 500, "XLSX binary should be generated");

  const result = parseXlsxDeliveryImport(xlsxBytes);
  assert.equal(result.errors.length, 0);
  assert.ok(result.totalGroupedDeliveries >= 4, "Should parse at least 4 sample deliveries");
  assert.ok(result.readyCount >= 4, "Sample deliveries should be ready for staging");

  const first = result.rows[0];
  assert.ok(first.waybillNumber.startsWith("WB-2611-"));
  assert.equal(first.status, "ready");
  assert.ok(first.dropoffs.length >= 1);
});

test("Daily Trip Report Excel format parses multi-stop drop-offs, entry fees, client inheritance, and flags missing waybill", () => {
  const dtrRows = [
    ["", "SEPTEMBER 28, 2026 - DAILY TRIP REPORT"],
    [""],
    ["", "NO.", "CLIENT", "DATE", "WAYBILL NUMBER", "PLATE NUMBER", "TRUCK TYPE", "TRUCK TEMP", "ORIGIN", "STORE", "TOLL GATE", "OTHER EXPENSES", "ENTRY FEES", "DRIVER", "", "HELPER", "", "DIESEL", "TOTAL EXPENSE", "RATE", "NET INCOME", "FUEL RATE", "KM", "TOLL PLAZAS"],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "ALLOWANCE", "DAILY RATE", "ALLOWANCE", "DAILY RATE"],
    ["", 1, "LANDERS", 46293, "6959", "NLB 8295", "2T", "+18", "ARCA LANDERS", "LANDERS ALABANG/LANDERS ARCOVIA", 460, 0, 100, 350, 700, 400, 1200, 1698.23, 4908.23, 9550, 4641.77, 105, 117, "BICUTAN 230", "MCX 230"],
    ["", 2, "", 46293, "", "NKS 2540", "2T", "-18", "GLACIER", "PASAY\nTAGUIG", 200, 0, 50, 350, 700, 200, 600, 1107.33, 3000, 9280, 6280, 104, 119, "SUCAT 77"],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(dtrRows);
  XLSX.utils.book_append_sheet(wb, ws, "SEPTEMBER 28");
  const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });

  const result = parseXlsxDeliveryImport(bytes);
  assert.equal(result.errors.length, 0);
  assert.equal(result.totalGroupedDeliveries, 2);

  // Row 1: Ready with 2 dropoffs split on '/' and entry fee
  const trip1 = result.rows[0];
  assert.equal(trip1.waybillNumber, "6959");
  assert.equal(trip1.clientName, "LANDERS");
  assert.equal(trip1.deliveryDate, "2026-09-28");
  assert.equal(trip1.deliveryRate, 9550);
  assert.equal(trip1.entryFees, 100);
  assert.equal(trip1.dropoffs.length, 2);
  assert.equal(trip1.dropoffs[0].storeName, "LANDERS ALABANG");
  assert.equal(trip1.dropoffs[1].storeName, "LANDERS ARCOVIA");
  assert.ok(trip1.tollGateBreakdown.includes("BICUTAN 230"));
  assert.equal(trip1.status, "ready");

  // Row 2: Inherited client, 2 dropoffs split on '\n', missing waybill flagged as needs_attention
  const trip2 = result.rows[1];
  assert.equal(trip2.clientName, "LANDERS"); // Inherited from row 1
  assert.equal(trip2.dropoffs.length, 2);
  assert.equal(trip2.dropoffs[0].storeName, "PASAY");
  assert.equal(trip2.dropoffs[1].storeName, "TAGUIG");
  assert.equal(trip2.entryFees, 50);
  assert.equal(trip2.status, "needs_attention");
  assert.ok(trip2.issues.some((i) => i.field === "waybillNumber"));
});

test("parseDeliveryImport captures operational notes and remarks columns", () => {
  const csv = `Waybill,Delivery Date,Client,Plate Number,Revenue,Driver,Store,Area,Remarks\nWB-2026-999,2026-11-03,Landers,NGS 4281,28000,Juan Dela Cruz,Landers Otis,Manila,Night delivery schedule requested`;
  const result = parseDeliveryImport(csv, new Set());

  assert.equal(result.totalGroupedDeliveries, 1);
  assert.equal(result.rows[0].waybillNumber, "WB-2026-999");
  assert.equal(result.rows[0].notes, "Night delivery schedule requested");
});

test("parseDeliveryImport correctly distinguishes Owned vs Subcontracted trucks and computes completion status", () => {
  const dtrRows = [
    ["", "OCTOBER 15, 2026 - DAILY TRIP REPORT"],
    [""],
    ["", "NO.", "CLIENT", "DATE", "WAYBILL NUMBER", "PLATE NUMBER", "TRUCK TYPE", "TRUCK TEMP", "ORIGIN", "STORE", "TOLL GATE", "OTHER EXPENSES", "ENTRY FEES", "DRIVER", "", "HELPER", "", "DIESEL", "TOTAL EXPENSE", "RATE", "NET INCOME", "FUEL RATE", "KM"],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "ALLOWANCE", "DAILY RATE", "ALLOWANCE", "DAILY RATE"],
    // Row 1: Owned truck (NLB 8295) with full breakdown
    ["", 1, "LANDERS", 46310, "WB-OWNED-01", "NLB 8295", "6W", "-18", "CENTRAL", "STORE A", 500, 0, 100, 300, 700, 200, 500, 2000, 4300, 12000, 7700, 85, 100],
    // Row 2: Subcontracted truck (NGB 3914) with total expense only, no diesel/driver rate
    ["", 2, "LANDERS", 46310, "WB-SUBCON-01", "NGB 3914", "4W", "-18", "CENTRAL", "STORE B", "-", 0, 0, "-", "-", "-", "-", "-", 3500, 8000, 4500, 85, 80],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(dtrRows);
  XLSX.utils.book_append_sheet(wb, ws, "OCTOBER 15");
  const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });

  const result = parseXlsxDeliveryImport(bytes);
  assert.equal(result.errors.length, 0);
  assert.equal(result.totalGroupedDeliveries, 2);

  // Row 1: Owned
  const ownedRow = result.rows[0];
  assert.equal(ownedRow.waybillNumber, "WB-OWNED-01");
  assert.equal(ownedRow.truckOwnership, "Owned");
  assert.equal(ownedRow.dieselExpenses, 2000);
  assert.equal(ownedRow.expectedCompletionStatus, "Completed");

  // Row 2: Subcontracted
  const subconRow = result.rows[1];
  assert.equal(subconRow.waybillNumber, "WB-SUBCON-01");
  assert.equal(subconRow.truckOwnership, "Subcontracted");
  assert.equal(subconRow.totalExpenses, 3500);
  assert.equal(subconRow.dieselExpenses, null);
  assert.equal(subconRow.driverDailyRate, null);
  assert.equal(subconRow.expectedCompletionStatus, "Completed");
  assert.equal(subconRow.status, "ready");

  // Summary counts
  assert.equal(result.ownedCount, 1);
  assert.equal(result.subconCount, 1);
  assert.equal(result.readyCount, 2);
  assert.equal(result.autoCompletedCount, 2);
});
