/**
 * RouteX: Company Expense & Profitability Domain
 *
 * Implements company-wide operating expenses (outside individual deliveries and trucks)
 * and calculates overall company net profit and margin.
 */

export type CompanyExpense = {
  readonly id: string;
  readonly description: string;
  readonly amount: number;
  readonly expenseDate: string; // YYYY-MM-DD
  readonly category?: string;
  readonly notes?: string | null;
  readonly createdAt: string; // ISO timestamp
  readonly updatedAt: string; // ISO timestamp
  readonly createdBy?: string | null;
};

export type CompanyExpenseInput = {
  description?: string;
  amount: number | string;
  expenseDate: string;
  category?: string;
  notes?: string | null;
};

export type ValidatedCompanyExpense = {
  description: string;
  amount: number;
  expenseDate: string;
  category: string;
  notes: string | null;
};

export type CompanyExpenseValidationResult =
  | { success: true; data: ValidatedCompanyExpense }
  | { success: false; errors: string[] };

export const COMPANY_FOUNDATION_YEAR = 2024;
export const COMPANY_FOUNDATION_DATE = "2024-01-01";

/**
 * Validates and sanitizes company expense input.
 * Ensures monetary amount is valid, strictly positive, and formatted with 2 decimal precision.
 * Enforces company foundation date boundary (2024-01-01).
 * Defaults description to "Total Company Expenses" if not specified.
 */
export function validateCompanyExpenseInput(input: unknown): CompanyExpenseValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { success: false, errors: ["Expense data must be a valid object."] };
  }

  const raw = input as Record<string, unknown>;

  // 1. Description validation (defaults to "Total Company Expenses" if omitted)
  let description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (!description) {
    description = "Total Company Expenses";
  } else if (description.length > 200) {
    errors.push("Expense description cannot exceed 200 characters.");
  }

  // 2. Amount validation
  let numAmount: number | null = null;
  if (typeof raw.amount === "number") {
    numAmount = raw.amount;
  } else if (typeof raw.amount === "string") {
    const cleaned = raw.amount.replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed)) {
      numAmount = parsed;
    }
  }

  if (numAmount === null || Number.isNaN(numAmount) || !Number.isFinite(numAmount)) {
    errors.push("Amount must be a valid monetary number.");
  } else if (numAmount <= 0) {
    errors.push("Expense amount must be greater than zero.");
  } else if (numAmount > 100_000_000) {
    errors.push("Expense amount exceeds maximum allowable limit (₱100,000,000).");
  }

  // 3. Date validation
  const expenseDate = typeof raw.expenseDate === "string" ? raw.expenseDate.trim() : "";
  if (!expenseDate) {
    errors.push("Expense date is required.");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
    errors.push("Expense date must follow the YYYY-MM-DD format.");
  } else {
    const dateObj = new Date(`${expenseDate}T00:00:00Z`);
    if (Number.isNaN(dateObj.getTime())) {
      errors.push("Expense date is not a valid calendar date.");
    } else if (expenseDate < COMPANY_FOUNDATION_DATE) {
      errors.push(`Expense date cannot precede company foundation (${COMPANY_FOUNDATION_DATE}).`);
    }
  }

  // 4. Category (no tags or distribution, internal default)
  const category = "Company Expenses";

  // 5. Notes
  const notes = typeof raw.notes === "string" ? raw.notes.trim() || null : null;

  if (errors.length > 0 || numAmount === null) {
    return { success: false, errors };
  }

  // Round amount to 2 decimal places to avoid floating point anomalies
  const roundedAmount = Math.round(numAmount * 100) / 100;

  return {
    success: true,
    data: {
      description,
      amount: roundedAmount,
      expenseDate,
      category,
      notes,
    },
  };
}

export type CompanyProfitabilityInputs = {
  /** Delivery revenue from financially complete deliveries */
  deliveryRevenue: number;
  /** Delivery expenses from financially complete deliveries */
  deliveryExpenses: number;
  /** Total company expenses from the company expense ledger */
  companyExpenses: number;
};

export type CompanyProfitabilitySummary = {
  deliveryRevenue: number;
  deliveryExpenses: number;
  deliveryNetProfit: number;
  companyExpenses: number;
  companyNetProfit: number;
  companyProfitMargin: number | null;
};

/**
 * Computes overall company profitability.
 *
 * Formula:
 * Company Net Profit = Delivery Revenue - Delivery Expenses - Company Expenses
 * Company Profit Margin = (Company Net Profit / Delivery Revenue) * 100
 */
export function calculateCompanyProfitability({
  deliveryRevenue,
  deliveryExpenses,
  companyExpenses,
}: CompanyProfitabilityInputs): CompanyProfitabilitySummary {
  const safeRevenue = Math.max(0, deliveryRevenue);
  const safeDeliveryExpenses = Math.max(0, deliveryExpenses);
  const safeCompanyExpenses = Math.max(0, companyExpenses);

  const deliveryNetProfit = safeRevenue - safeDeliveryExpenses;
  const companyNetProfit = safeRevenue - safeDeliveryExpenses - safeCompanyExpenses;
  const companyProfitMargin =
    safeRevenue > 0 ? (companyNetProfit / safeRevenue) * 100 : null;

  return {
    deliveryRevenue: safeRevenue,
    deliveryExpenses: safeDeliveryExpenses,
    deliveryNetProfit,
    companyExpenses: safeCompanyExpenses,
    companyNetProfit,
    companyProfitMargin,
  };
}

/**
 * Filter company expenses by date range.
 */
export function filterExpensesByDateRange(
  expenses: readonly CompanyExpense[],
  startDate: Date | string | null,
  endDate: Date | string | null,
): CompanyExpense[] {
  const startStr = typeof startDate === "string" ? startDate : startDate ? startDate.toISOString().slice(0, 10) : null;
  const endStr = typeof endDate === "string" ? endDate : endDate ? endDate.toISOString().slice(0, 10) : null;

  return expenses.filter((e) => {
    if (startStr && e.expenseDate < startStr) return false;
    if (endStr && e.expenseDate > endStr) return false;
    return true;
  });
}

/**
 * Aggregate company expenses by category.
 */
export function aggregateExpensesByCategory(
  expenses: readonly CompanyExpense[],
): Array<{ category: string; total: number; count: number; percentage: number }> {
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const map = new Map<string, { total: number; count: number }>();

  for (const exp of expenses) {
    const cat = exp.category || "Other Operating Expenses";
    const existing = map.get(cat) ?? { total: 0, count: 0 };
    existing.total += exp.amount;
    existing.count += 1;
    map.set(cat, existing);
  }

  const result = Array.from(map.entries()).map(([category, { total, count }]) => ({
    category,
    total,
    count,
    percentage: totalAmount > 0 ? (total / totalAmount) * 100 : 0,
  }));

  // Sort descending by total amount
  result.sort((a, b) => b.total - a.total);
  return result;
}

/**
 * Aggregate monthly expense totals for timelines.
 */
export function aggregateMonthlyExpenses(
  expenses: readonly CompanyExpense[],
): Array<{ monthKey: string; label: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();

  for (const exp of expenses) {
    const monthKey = exp.expenseDate.slice(0, 7); // YYYY-MM
    const existing = map.get(monthKey) ?? { total: 0, count: 0 };
    existing.total += exp.amount;
    existing.count += 1;
    map.set(monthKey, existing);
  }

  const sortedKeys = Array.from(map.keys()).sort();
  return sortedKeys.map((monthKey) => {
    const [year, month] = monthKey.split("-");
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    const { total, count } = map.get(monthKey)!;
    return { monthKey, label, total, count };
  });
}
