import assert from "node:assert/strict";
import test from "node:test";

import {
  generateImportErrorReport,
  generateSampleCsv,
  parseDelimitedText,
  parseDeliveryImport,
  validateStagedRow,
} from "./delivery-import-parser.ts";

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
    truckTemperature: "-18°C" as const,
    origin: "Depot",
    distanceKm: 50,
    fuelRate: 85,
    deliveryRate: 0,
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
      truckTemperature: "-18°C" as const,
      origin: "Depot",
      distanceKm: 50,
      fuelRate: 85,
      deliveryRate: 20000,
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
