export const DELIVERY_COMPLETION_EXPENSE_CATEGORIES = [
  "fuel",
  "tolls",
  "other-expenses",
  "entry-fees",
  "driver-helper-costs",
] as const;

export type DeliveryCompletionExpenseCategory =
  (typeof DELIVERY_COMPLETION_EXPENSE_CATEGORIES)[number];

export type DeliveryExpenseConfirmation = {
  category: DeliveryCompletionExpenseCategory;
  state: "amount" | "not-applicable" | "unknown";
  amount?: number;
};

export type DeliveryCompletionFinancials = {
  rate: number;
  totalExpenses: number;
  netIncome: number;
  profitMargin: number | null;
};

export type FinancialRecord = {
  revenue: number;
  totalExpenses: number;
};

export type FinancialPerformanceMetrics = {
  revenue: number;
  totalExpenses: number;
  netIncome: number;
  profitMargin: number | null;
};

export type FinancialValidation =
  | { ok: true; value: DeliveryCompletionFinancials }
  | { ok: false; fieldErrors: Record<string, string> };

function isCurrencyAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    Math.round(value * 100) === value * 100
  );
}

/**
 * Shared financial definition for completed-delivery reporting surfaces.
 * Callers must apply their date and authorization scope before passing records.
 * A zero-revenue scope has no meaningful percentage, so profitMargin is null.
 */
export function calculateFinancialPerformance(
  records: readonly FinancialRecord[],
): FinancialPerformanceMetrics {
  const totals = records.reduce(
    (current, record) => ({
      revenue: current.revenue + record.revenue,
      totalExpenses: current.totalExpenses + record.totalExpenses,
    }),
    { revenue: 0, totalExpenses: 0 },
  );
  const netIncome = totals.revenue - totals.totalExpenses;

  return {
    ...totals,
    netIncome,
    profitMargin: totals.revenue === 0 ? null : (netIncome / totals.revenue) * 100,
  };
}

/**
 * The application has not yet adopted a finance rounding policy. This helper
 * therefore accepts only already precise two-decimal input and returns exact
 * sums, leaving any future currency-policy rounding to the approved adapter.
 */
export function calculateDeliveryCompletionFinancials(input: {
  rate: unknown;
  expenses: readonly DeliveryExpenseConfirmation[];
}): FinancialValidation {
  const fieldErrors: Record<string, string> = {};

  if (!isCurrencyAmount(input.rate) || input.rate <= 0) {
    fieldErrors.rate = "Enter a valid rate greater than zero.";
  }

  const confirmations = new Map<
    DeliveryCompletionExpenseCategory,
    DeliveryExpenseConfirmation
  >();

  for (const expense of input.expenses) {
    const field = `expenses.${expense.category}`;

    if (confirmations.has(expense.category)) {
      fieldErrors[field] = "Confirm this expense category once.";
      continue;
    }

    confirmations.set(expense.category, expense);

    if (expense.state === "unknown") {
      fieldErrors[field] = "Confirm an amount or mark this expense not applicable.";
      continue;
    }

    if (expense.state === "amount" && !isCurrencyAmount(expense.amount)) {
      fieldErrors[field] = "Enter a valid confirmed amount.";
    }
  }

  for (const category of DELIVERY_COMPLETION_EXPENSE_CATEGORIES) {
    if (!confirmations.has(category)) {
      fieldErrors[`expenses.${category}`] =
        "Confirm an amount or mark this expense not applicable.";
    }
  }

  if (Object.keys(fieldErrors).length > 0 || typeof input.rate !== "number") {
    return { ok: false, fieldErrors };
  }

  const totalExpenses = input.expenses.reduce(
    (total, expense) => total + (expense.state === "amount" ? expense.amount ?? 0 : 0),
    0,
  );

  return {
    ok: true,
    value: {
      rate: input.rate,
      totalExpenses,
      netIncome: input.rate - totalExpenses,
      profitMargin: ((input.rate - totalExpenses) / input.rate) * 100,
    },
  };
}
