import assert from "node:assert/strict";
import test from "node:test";

import { calculateFinancialPerformance } from "./delivery-completion-financials.ts";

test("calculates revenue, total expenses, net income, and profit margin from the same records", () => {
  assert.deepEqual(
    calculateFinancialPerformance([
      { revenue: 1_000, totalExpenses: 400 },
      { revenue: 500, totalExpenses: 700 },
    ]),
    { revenue: 1_500, totalExpenses: 1_100, netIncome: 400, profitMargin: (400 / 1_500) * 100 },
  );
});

test("keeps negative income and reports an undefined margin for zero revenue", () => {
  assert.deepEqual(calculateFinancialPerformance([{ revenue: 100, totalExpenses: 140 }]), {
    revenue: 100,
    totalExpenses: 140,
    netIncome: -40,
    profitMargin: -40,
  });
  assert.equal(calculateFinancialPerformance([{ revenue: 0, totalExpenses: 40 }]).profitMargin, null);
});
