import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  calculateCompanyProfitability,
  validateCompanyExpenseInput,
  filterExpensesByDateRange,
  aggregateExpensesByCategory,
  aggregateMonthlyExpenses,
  type CompanyExpense,
  COMPANY_FOUNDATION_DATE,
} from "./company-expense-domain.ts";

describe("Company Expense Domain & Profitability Calculations", () => {
  it("calculates company profitability correctly with confirmed delivery & company expenses", () => {
    // Delivery Revenue: ₱100,000
    // Delivery Expenses: ₱40,000 (Delivery Net Profit = ₱60,000)
    // Company Expenses: ₱15,000
    // Company Net Profit = ₱100,000 - ₱40,000 - ₱15,000 = ₱45,000
    // Company Profit Margin = (45,000 / 100,000) * 100 = 45%
    const result = calculateCompanyProfitability({
      deliveryRevenue: 100_000,
      deliveryExpenses: 40_000,
      companyExpenses: 15_000,
    });

    assert.equal(result.deliveryRevenue, 100_000);
    assert.equal(result.deliveryExpenses, 40_000);
    assert.equal(result.deliveryNetProfit, 60_000);
    assert.equal(result.companyExpenses, 15_000);
    assert.equal(result.companyNetProfit, 45_000);
    assert.equal(result.companyProfitMargin, 45);
  });

  it("handles negative company net profit (overall net loss) accurately", () => {
    // Delivery Revenue: ₱50,000
    // Delivery Expenses: ₱30,000
    // Company Expenses: ₱40,000
    // Company Net Profit = 50,000 - 30,000 - 40,000 = -₱20,000
    // Margin = (-20,000 / 50,000) * 100 = -40%
    const result = calculateCompanyProfitability({
      deliveryRevenue: 50_000,
      deliveryExpenses: 30_000,
      companyExpenses: 40_000,
    });

    assert.equal(result.companyNetProfit, -20_000);
    assert.equal(result.companyProfitMargin, -40);
  });

  it("returns null profit margin when delivery revenue is zero", () => {
    const result = calculateCompanyProfitability({
      deliveryRevenue: 0,
      deliveryExpenses: 0,
      companyExpenses: 25_000,
    });

    assert.equal(result.companyNetProfit, -25_000);
    assert.equal(result.companyProfitMargin, null);
  });

  it("validates valid company expense input with decimal precision", () => {
    const result = validateCompanyExpenseInput({
      description: "Office Supplies - Printer Toner",
      amount: "1450.75",
      expenseDate: "2026-11-05",
      notes: "Invoice #INV-2026-99",
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.description, "Office Supplies - Printer Toner");
      assert.equal(result.data.amount, 1450.75);
      assert.equal(result.data.expenseDate, "2026-11-05");
      assert.equal(result.data.notes, "Invoice #INV-2026-99");
    }
  });

  it("rejects invalid, negative, or zero monetary amounts", () => {
    const zeroRes = validateCompanyExpenseInput({
      description: "Rent",
      amount: 0,
      expenseDate: "2026-11-05",
    });
    assert.equal(zeroRes.success, false);
    if (!zeroRes.success) {
      assert.ok(zeroRes.errors.some((e) => e.includes("greater than zero")));
    }

    const negativeRes = validateCompanyExpenseInput({
      description: "Rent",
      amount: -500,
      expenseDate: "2026-11-05",
    });
    assert.equal(negativeRes.success, false);

    const malformedRes = validateCompanyExpenseInput({
      description: "Rent",
      amount: "abc-invalid",
      expenseDate: "2026-11-05",
    });
    assert.equal(malformedRes.success, false);
  });

  it("defaults omitted description to Total Company Expenses", () => {
    const emptyRes = validateCompanyExpenseInput({
      description: "   ",
      amount: 5000,
      expenseDate: "2026-11-05",
    });
    assert.equal(emptyRes.success, true);
    if (emptyRes.success) {
      assert.equal(emptyRes.data.description, "Total Company Expenses");
    }
  });

  it("enforces company foundation date boundary (cannot precede 2024-01-01)", () => {
    const invalidDateRes = validateCompanyExpenseInput({
      description: "Old Office Rent",
      amount: 10000,
      expenseDate: "2023-12-31",
    });
    assert.equal(invalidDateRes.success, false);
    if (!invalidDateRes.success) {
      assert.ok(invalidDateRes.errors.some((e) => e.includes(COMPANY_FOUNDATION_DATE)));
    }

    const validDateRes = validateCompanyExpenseInput({
      description: "Founded Year Expense",
      amount: 10000,
      expenseDate: "2024-01-01",
    });
    assert.equal(validDateRes.success, true);
  });

  it("filters expenses by date range properly", () => {
    const sample: CompanyExpense[] = [
      { id: "1", description: "Exp 1", amount: 100, expenseDate: "2026-09-15", category: "Utilities", createdAt: "", updatedAt: "" },
      { id: "2", description: "Exp 2", amount: 200, expenseDate: "2026-10-15", category: "Rent & Facilities", createdAt: "", updatedAt: "" },
      { id: "3", description: "Exp 3", amount: 300, expenseDate: "2026-11-05", category: "Office & Admin", createdAt: "", updatedAt: "" },
    ];

    const octOnly = filterExpensesByDateRange(sample, "2026-10-01", "2026-10-31");
    assert.equal(octOnly.length, 1);
    assert.equal(octOnly[0].id, "2");

    const allTime = filterExpensesByDateRange(sample, null, null);
    assert.equal(allTime.length, 3);
  });

  it("aggregates expenses by category and monthly totals correctly", () => {
    const sample: CompanyExpense[] = [
      { id: "1", description: "Meralco Hub", amount: 12000, expenseDate: "2026-10-15", category: "Utilities", createdAt: "", updatedAt: "" },
      { id: "2", description: "Internet Fiber", amount: 3000, expenseDate: "2026-10-20", category: "Utilities", createdAt: "", updatedAt: "" },
      { id: "3", description: "Warehouse Rent", amount: 45000, expenseDate: "2026-10-01", category: "Rent & Facilities", createdAt: "", updatedAt: "" },
      { id: "4", description: "Office Paper", amount: 2000, expenseDate: "2026-11-02", category: "Office & Admin", createdAt: "", updatedAt: "" },
    ];

    const categories = aggregateExpensesByCategory(sample);
    assert.equal(categories.length, 3);
    assert.equal(categories[0].category, "Rent & Facilities");
    assert.equal(categories[0].total, 45000);
    assert.equal(categories[1].category, "Utilities");
    assert.equal(categories[1].total, 15000);

    const monthly = aggregateMonthlyExpenses(sample);
    assert.equal(monthly.length, 2);
    assert.equal(monthly[0].monthKey, "2026-10");
    assert.equal(monthly[0].total, 60000);
    assert.equal(monthly[1].monthKey, "2026-11");
    assert.equal(monthly[1].total, 2000);
  });

  it("enforces unified ledger layout and compact neumorphic modal workflow on Finance page", () => {
    const financePageSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(workspace)/finance/page.tsx"),
      "utf8",
    );
    const editModalSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/edit-company-expense-modal.tsx"),
      "utf8",
    );

    // Uses shared SortableTableHeader, GlobalDateRangePicker, and TablePagination
    assert.ok(financePageSrc.includes("SortableTableHeader"));
    assert.ok(financePageSrc.includes("GlobalDateRangePicker"));
    assert.ok(financePageSrc.includes("TablePagination"));

    // Record Expense is a popup modal triggered from the page intro, not an inline form card
    assert.ok(financePageSrc.includes("+ Record Expense"));
    assert.ok(financePageSrc.includes("routex-dialog finance-expense-dialog"));
    assert.ok(!financePageSrc.includes("finance-entry-card"));
    assert.ok(!financePageSrc.includes("finance-amount-hero-box"));

    // Both Record and Edit modals use shared numeric input guards and compact 2-column grid
    assert.ok(financePageSrc.includes("sanitizePositiveDecimalInput"));
    assert.ok(editModalSrc.includes("sanitizePositiveDecimalInput"));
    assert.ok(editModalSrc.includes("routex-dialog finance-expense-dialog"));

    // Only 3 summary cards (no redundant EXPENSE ENTRIES card) and vertical 3-dots row action menu
    assert.ok(!financePageSrc.includes("EXPENSE ENTRIES"));
    assert.ok(financePageSrc.includes("row-action-more-btn"));
    assert.ok(financePageSrc.includes("row-action-menu"));
  });
});
