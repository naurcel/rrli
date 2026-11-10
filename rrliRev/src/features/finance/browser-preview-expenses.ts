import { SMALL_MOCK_COMPANY_EXPENSES } from "../deliveries/small-mock-database.ts";
import type { CompanyExpense } from "./company-expense-domain.ts";

export const COMPANY_EXPENSES_STORAGE_KEY = "routex-browser-preview-company-expenses-v1";
export const ROUTEX_COMPANY_EXPENSES_CHANGED = "routex:company-expenses-changed";

function getInitialCompanyExpenses(): CompanyExpense[] {
  return SMALL_MOCK_COMPANY_EXPENSES.map((exp) => ({ ...exp }));
}

export function readBrowserPreviewExpenses(): CompanyExpense[] {
  if (typeof window === "undefined") {
    return getInitialCompanyExpenses();
  }

  try {
    const raw = window.localStorage.getItem(COMPANY_EXPENSES_STORAGE_KEY);
    if (!raw) {
      const seeded = getInitialCompanyExpenses();
      window.localStorage.setItem(COMPANY_EXPENSES_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const seeded = getInitialCompanyExpenses();
      window.localStorage.setItem(COMPANY_EXPENSES_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    return parsed as CompanyExpense[];
  } catch {
    return getInitialCompanyExpenses();
  }
}

export function writeBrowserPreviewExpenses(expenses: CompanyExpense[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(COMPANY_EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
    window.dispatchEvent(new CustomEvent(ROUTEX_COMPANY_EXPENSES_CHANGED, { detail: { count: expenses.length } }));
  } catch (error) {
    console.error("Failed to persist browser preview company expenses:", error);
  }
}

export function upsertBrowserPreviewExpense(expense: CompanyExpense): CompanyExpense {
  const current = readBrowserPreviewExpenses();
  const existingIdx = current.findIndex((item) => item.id === expense.id);

  let updated: CompanyExpense[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = expense;
  } else {
    updated = [expense, ...current];
  }

  writeBrowserPreviewExpenses(updated);
  return expense;
}

export function deleteBrowserPreviewExpense(id: string): boolean {
  const current = readBrowserPreviewExpenses();
  const filtered = current.filter((item) => item.id !== id);

  if (filtered.length !== current.length) {
    writeBrowserPreviewExpenses(filtered);
    return true;
  }

  return false;
}
