import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCompanyProfitability,
  validateCompanyExpenseInput,
} from "./company-expense-domain.ts";
import {
  parseCsvCompanyExpenseImport,
  validateStagedExpenseRow,
  type StagedExpenseRow,
} from "./company-expense-import-parser.ts";

test("Finance: Company expense validation enforces positive amounts and foundation date boundary (2024)", () => {
  // Valid expense
  const valid = validateCompanyExpenseInput({
    description: "Office Internet & Telecommunications",
    amount: "4500.50",
    expenseDate: "2026-05-15",
    category: "Utilities",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.amount, 4500.5);
    assert.equal(valid.data.expenseDate, "2026-05-15");
  }

  // Pre-2024 boundary violation
  const preFoundation = validateCompanyExpenseInput({
    description: "Ancient expense",
    amount: 1000,
    expenseDate: "2023-12-31",
  });
  assert.equal(preFoundation.success, false);
  if (!preFoundation.success) {
    assert.ok(preFoundation.errors.some((e) => e.includes("2024")));
  }

  // Negative amount rejection
  const negativeAmount = validateCompanyExpenseInput({
    description: "Invalid refund",
    amount: -500,
    expenseDate: "2026-06-01",
  });
  assert.equal(negativeAmount.success, false);
});

test("Finance Import: Validates rows and rejects malformed, missing date, or invalid amounts", () => {
  const existingKeys = new Set<string>();
  const seenKeys = new Set<string>();

  // Row with date prior to foundation
  const preFoundationRow: StagedExpenseRow = {
    id: "staged-3",
    rowNumber: 3,
    expenseDate: "2023-11-20",
    description: "Office Supplies",
    category: "Supplies",
    amount: 1250,
    notes: "",
    status: "ready",
    issues: [],
  };
  const badDate = validateStagedExpenseRow(preFoundationRow, existingKeys, seenKeys);
  assert.equal(badDate.status, "needs_attention");
  assert.ok(badDate.issues.some((e) => e.message.toLowerCase().includes("foundation")));

  // Valid row
  const validRowItem: StagedExpenseRow = {
    id: "staged-4",
    rowNumber: 4,
    expenseDate: "2026-04-10",
    description: "Security Services",
    category: "Security",
    amount: 15000,
    notes: "",
    status: "ready",
    issues: [],
  };
  const validRow = validateStagedExpenseRow(validRowItem, existingKeys, seenKeys);
  assert.equal(validRow.status, "ready");
  assert.equal(validRow.issues.length, 0);

  // Bug Fix verification (BUG-001): validateStagedExpenseRow handles null amount safely
  // without throwing TypeError, marking the row as needs_attention.
  const badAmountRow = {
    id: "staged-2",
    rowNumber: 2,
    expenseDate: "2026-03-01",
    description: "Warehouse Lease",
    category: "Lease",
    amount: null as unknown as number,
    notes: "",
    status: "ready" as const,
    issues: [],
  };
  const badAmountResult = validateStagedExpenseRow(badAmountRow, existingKeys, seenKeys);
  assert.equal(badAmountResult.status, "needs_attention");
  assert.ok(badAmountResult.issues.some((e) => e.message.toLowerCase().includes("positive amount")));

  // CSV parsing integration
  const csv = "Date,Description,Category,Amount\n2026-05-01,Office Rent,Rent,25000\n2026-05-02,Internet,Utilities,3500";
  const parsedCsv = parseCsvCompanyExpenseImport(csv);
  assert.equal(parsedCsv.readyCount, 2);
  assert.equal(parsedCsv.attentionCount, 0);
});

test("Finance Isolation: Company expenses affect company-level net profit ONLY, without altering delivery profit", () => {
  const deliveries = [
    {
      deliveryRate: 20000,
      totalExpenses: 8000,
      netIncome: 12000,
    },
    {
      deliveryRate: 25000,
      totalExpenses: 10000,
      netIncome: 15000,
    },
  ];

  const deliveryRevenue = deliveries.reduce((s, d) => s + d.deliveryRate, 0);
  const deliveryExpenses = deliveries.reduce((s, d) => s + d.totalExpenses, 0);
  const companyExpenses = 10000;

  const result = calculateCompanyProfitability({
    deliveryRevenue,
    deliveryExpenses,
    companyExpenses,
  });

  // Delivery revenue: 20k + 25k = 45k
  assert.equal(result.deliveryRevenue, 45000);
  // Delivery expenses: 8k + 10k = 18k
  assert.equal(result.deliveryExpenses, 18000);
  // Delivery net profit: 45k - 18k = 27k (NOT reduced by company expenses)
  assert.equal(result.deliveryNetProfit, 27000);

  // Company expenses: 10k
  assert.equal(result.companyExpenses, 10000);
  // Company net profit: 27k - 10k = 17k
  assert.equal(result.companyNetProfit, 17000);

  // Margin: (17k / 45k) * 100 = 37.777...%
  assert.ok(result.companyProfitMargin !== null);
  assert.equal(Math.round(result.companyProfitMargin! * 100) / 100, 37.78);
});
