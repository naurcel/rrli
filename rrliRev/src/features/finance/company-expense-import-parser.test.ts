import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  applyDuplicateDetection,
  generateCompanyExpenseSampleCsv,
  generateCompanyExpenseSampleXlsx,
  generateExpenseImportErrorReport,
  normalizeExpenseDate,
  parseCollectionSheet,
  parseCsvCompanyExpenseImport,
  parseDisbursementSheet,
  parseExpenseAmount,
  parsePayablesNotCreditedSheet,
  parsePayablesPaidSheet,
  parseReceivablesSheet,
  parseServiceInvoiceSheet,
  parseXlsxCompanyExpenseImport,
  validateStagedExpenseRow,
  type StagedExpenseRow,
} from "./company-expense-import-parser.ts";

test("RouteX Finance: Company Expense Import Parser", async (t) => {
  await t.test("parseExpenseAmount parses numbers, currency symbols, and handles invalid values", () => {
    assert.equal(parseExpenseAmount(5000), 5000);
    assert.equal(parseExpenseAmount("₱12,500.50"), 12500.5);
    assert.equal(parseExpenseAmount("$3,400"), 3400);
    assert.equal(parseExpenseAmount("PHP 18,450.75"), 18450.75);
    assert.equal(parseExpenseAmount("-"), null);
    assert.equal(parseExpenseAmount("abc"), null);
    assert.equal(parseExpenseAmount(null), null);
  });

  await t.test("normalizeExpenseDate handles ISO, MM/DD/YYYY, day prefixes, and Excel serial numbers", () => {
    assert.equal(normalizeExpenseDate("2026-11-05"), "2026-11-05");
    assert.equal(normalizeExpenseDate("11/05/2026"), "2026-11-05");
    assert.equal(normalizeExpenseDate("Friday, October 02, 2026"), "2026-10-02");
    assert.equal(normalizeExpenseDate("September 9, 2026"), "2026-09-09");
    // Excel serial 46294 = 2026-09-29
    assert.equal(normalizeExpenseDate(46294), "2026-09-29");
  });

  await t.test("parseCsvCompanyExpenseImport parses valid CSV text into staged rows", () => {
    const csv = `Date,Description,Amount,Category,Notes\n2026-11-01,Office Rent,35000,Facility & Rent,November rent\n2026-11-03,Depot Utilities,18450.75,Utilities,Electricity`;
    const result = parseCsvCompanyExpenseImport(csv);

    assert.equal(result.rows.length, 2);
    assert.equal(result.readyCount, 2);
    assert.equal(result.rows[0].expenseDate, "2026-11-01");
    assert.equal(result.rows[0].description, "Office Rent");
    assert.equal(result.rows[0].amount, 35000);
    assert.equal(result.rows[0].category, "Facility & Rent");
    assert.equal(result.rows[0].notes, "November rent");
    assert.equal(result.rows[0].transactionType, "Outgoing");
  });

  await t.test("parseServiceInvoiceSheet extracts incoming transactions with date, company, ref, and amount due", () => {
    const grid = [
      ["NO.", "REF. RRLI", "DATE", "COMPANY NAME", "TIN NO.", null, "AMOUNT", "TOTAL SALES", "VAT", "DUE", "EWT", "AMOUNT DUE"],
      ["1034", "010-919", "September 9, 2026", "Southeastasia Retail Inc.", "008-909-992-000", null, null, null, null, null, null, " 55,880.00 "],
      ["1035", "010-920", "September 9, 2026", "Southeastasia Retail Inc.", "008-909-992-000", null, null, null, null, null, null, " 243,666.50 "],
    ];

    const rows = parseServiceInvoiceSheet(grid);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].transactionType, "Incoming");
    assert.equal(rows[0].expenseDate, "2026-09-09");
    assert.equal(rows[0].amount, 55880);
    assert.equal(rows[0].description, "Southeastasia Retail Inc. (Ref: 010-919)");
    assert.equal(rows[0].sourceSheet, "SERVICE INVOICE (BILLINGS)");
    assert.equal(rows[0].status, "ready");
  });

  await t.test("parseDisbursementSheet sums numeric values across columns E through Y into single outgoing transaction", () => {
    // Row with diesel in col 4 (500) and toll in col 5 (100) -> sum 600
    const grid = [
      ["DATE", "DESCRIPTION", "TIN", null, "GASOLINE", "TOLL", "ALLOWANCE"],
      ["October 27, 2026", "Petty Cash - NLH 7858", null, null, 500, " 100.00 ", null],
      ["October 28, 2026", "Depot Electricity", null, null, null, null, 2500],
    ];

    const rows = parseDisbursementSheet(grid);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].transactionType, "Outgoing");
    assert.equal(rows[0].expenseDate, "2026-10-27");
    assert.equal(rows[0].amount, 600);
    assert.equal(rows[0].description, "Petty Cash - NLH 7858");
    assert.equal(rows[1].amount, 2500);
    assert.equal(rows[1].status, "ready");
  });

  await t.test("parseCollectionSheet extracts incoming revenue with client, SI ref, and amount due", () => {
    const grid = [
      ["NO.", "DATE", "TRUCKER NAME", "TIN", null, "AMOUNT", "VAT", "EWT", "AMOUNT DUE", null, "SI REFERENCE"],
      ["287", "Friday, October 02, 2026", "Southeastasia Retail Inc.", "008-909-992-000", null, null, null, null, " 16,005.00 ", null, "857"],
    ];

    const rows = parseCollectionSheet(grid);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].transactionType, "Incoming");
    assert.equal(rows[0].expenseDate, "2026-10-02");
    assert.equal(rows[0].amount, 16005);
    assert.equal(rows[0].description, "Southeastasia Retail Inc. (SI: 857)");
    assert.equal(rows[0].status, "ready");
  });

  await t.test("parsePayablesPaidSheet carries over trucker name and extracts outgoing payments", () => {
    const grid = [
      ["DATE OF BILLING", "DATE OF PAYMENT", "SI NO.", "TRUCKER NAME", "TIN", null, "AMOUNT", "VAT", "VAT AMT", "EWT", "AMOUNT DUE", "REMARKS"],
      ["May 25, 2026", "September 3, 2026", "135", "QRS-X Trucking", "103-109", null, null, null, null, null, " ₱268,435.36 ", "PAID"],
      ["May 28, 2026", "September 3, 2026", "136", "", "103-109", null, null, null, null, null, " ₱100,000.00 ", "PAID"],
    ];

    const rows = parsePayablesPaidSheet(grid);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].transactionType, "Outgoing");
    assert.equal(rows[0].description, "QRS-X Trucking (SI: 135) - PAID");
    assert.equal(rows[0].amount, 268435.36);
    // Row 2 carries over QRS-X Trucking
    assert.equal(rows[1].description, "QRS-X Trucking (SI: 136) - PAID");
    assert.equal(rows[1].amount, 100000);
  });

  await t.test("parsePayablesNotCreditedSheet handles title header offset and creates outgoing transactions", () => {
    const grid = [
      ["PAYABLES"],
      ["TRUCKER", "DATE RECEIVED", "DATE COVERED", "DUE DATE", "AGING", "AMOUNT", "VAT", "VAT AMT", "EWT", "AMOUNT DUE", "SI #", "REMARKS"],
      ["KIM-Q CORPORATION", "August 03, 2026", "June", "September 17, 2026", "63", "10,844.00", null, null, null, " 10,650.36 ", "0000528", "JULY"],
    ];

    const rows = parsePayablesNotCreditedSheet(grid);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].transactionType, "Outgoing");
    assert.equal(rows[0].expenseDate, "2026-08-03");
    assert.equal(rows[0].amount, 10650.36);
    assert.equal(rows[0].description, "KIM-Q CORPORATION (SI: 0000528) - JULY");
    assert.equal(rows[0].status, "ready");
  });

  await t.test("parseReceivablesSheet extracts incoming receivables ignoring legacy NOT PAID status", () => {
    const grid = [
      ["BILLING", "BILLING DATE", "DATE COVERED", "DUE DATE", "AGING", "CLIENT", "INVOICE NO.", "AMOUNT", "VAT", "W/VAT", "EWT", "AMOUNT DUE", "STATUS"],
      ["RRLI2026-010-916", "October 05, 2026", "Sept", "October 20, 2026", "30", "VANGUARD", "1030", null, null, null, null, " 76,213.50 ", "NOT PAID"],
    ];

    const rows = parseReceivablesSheet(grid);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].transactionType, "Incoming");
    assert.equal(rows[0].expenseDate, "2026-10-05");
    assert.equal(rows[0].amount, 76213.5);
    assert.equal(rows[0].description, "VANGUARD (Inv: 1030) [RRLI2026-010-916]");
    assert.equal(rows[0].status, "ready");
  });

  await t.test("applyDuplicateDetection accurately identifies cross-sheet duplicates between SI and Receivables", () => {
    const siRows = parseServiceInvoiceSheet([
      ["NO.", "REF. RRLI", "DATE", "COMPANY NAME", null, null, null, null, null, null, null, "AMOUNT DUE"],
      ["1034", "010-919", "2026-09-09", "Southeastasia Retail Inc.", null, null, null, null, null, null, null, 55880],
    ]);

    const recRows = parseReceivablesSheet([
      ["BILLING", "BILLING DATE", null, null, null, "CLIENT", "INVOICE NO.", null, null, null, null, "AMOUNT DUE"],
      ["RRLI2026-010-919", "2026-10-05", null, null, null, "SEARI", "1034", null, null, null, null, 55880],
    ]);

    const all = [...siRows, ...recRows];
    const detected = applyDuplicateDetection(all, []);

    assert.equal(detected[0].status, "ready");
    assert.equal(detected[1].status, "duplicate");
    assert.ok(detected[1].duplicateReason?.includes("SERVICE INVOICE (BILLINGS)"));
  });

  await t.test("parseXlsxCompanyExpenseImport consolidates all 6 sheets with sheetName='all'", () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Service Invoice
    const ws1 = XLSX.utils.aoa_to_sheet([
      ["NO.", "REF. RRLI", "DATE", "COMPANY NAME", "TIN", null, "AMT", "SALES", "VAT", "DUE", "EWT", "AMOUNT DUE"],
      ["1001", "001-001", "2026-09-01", "Client A", null, null, null, null, null, null, null, 15000],
    ]);
    XLSX.utils.book_append_sheet(wb, ws1, "SERVICE INVOICE (BILLINGS)");

    // Sheet 2: Disbursement
    const ws2 = XLSX.utils.aoa_to_sheet([
      ["DATE", "DESCRIPTION", "TIN", null, "GASOLINE", "TOLL"],
      ["2026-09-02", "Daily Gas NLH", null, null, 2500, 300],
    ]);
    XLSX.utils.book_append_sheet(wb, ws2, "DISBURSEMENT (DAILY EXPENSE)");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const result = parseXlsxCompanyExpenseImport(buf, [], "all");

    assert.equal(result.rows.length, 2);
    assert.equal(result.incomingCount, 1);
    assert.equal(result.outgoingCount, 1);
    assert.equal(result.incomingTotal, 15000);
    assert.equal(result.outgoingTotal, 2800);
    assert.equal(result.readyCount, 2);
  });

  await t.test("validateStagedExpenseRow enforces company foundation boundary (2024-01-01)", () => {
    const row: StagedExpenseRow = {
      id: "1",
      rowNumber: 2,
      expenseDate: "2023-12-31",
      description: "Pre-foundation Expense",
      amount: 1000,
      category: "General",
      notes: "",
      transactionType: "Outgoing",
      status: "ready",
      issues: [],
    };

    const validated = validateStagedExpenseRow(row, new Set(), new Set());
    assert.equal(validated.status, "needs_attention");
    assert.ok(validated.issues.some((i) => i.field === "expenseDate"));
  });

  await t.test("generateCompanyExpenseSampleXlsx and generateCompanyExpenseSampleCsv generate valid templates", () => {
    const csv = generateCompanyExpenseSampleCsv();
    assert.ok(csv.includes("Office Rent"));
    assert.ok(csv.includes("Amount"));

    const xlsxBytes = generateCompanyExpenseSampleXlsx();
    assert.ok(xlsxBytes.length > 100);

    const parsed = parseXlsxCompanyExpenseImport(xlsxBytes.buffer);
    assert.ok(parsed.rows.length >= 4);
    assert.equal(parsed.readyCount, parsed.rows.length);
  });

  await t.test("generateExpenseImportErrorReport outputs lines for attention/duplicate rows", () => {
    const rows: StagedExpenseRow[] = [
      {
        id: "1",
        rowNumber: 2,
        expenseDate: "2026-11-01",
        description: "Valid Expense",
        amount: 500,
        category: "General",
        notes: "",
        transactionType: "Outgoing",
        status: "ready",
        issues: [],
      },
      {
        id: "2",
        rowNumber: 3,
        expenseDate: "2026-11-02",
        description: "",
        amount: -10,
        category: "General",
        notes: "",
        transactionType: "Outgoing",
        status: "needs_attention",
        issues: [{ field: "amount", message: "Amount must be strictly greater than 0." }],
      },
    ];

    const report = generateExpenseImportErrorReport(rows);
    assert.ok(report.includes("3,"));
    assert.ok(report.includes("Amount must be strictly greater than 0."));
    assert.ok(!report.includes("Valid Expense"));
  });
});
