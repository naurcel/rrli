import { SMALL_MOCK_COMPANY_EXPENSES } from "../deliveries/small-mock-database.ts";
import { readArchiveMachineSnapshot } from "../archive/archive-machine.ts";
import { formatExpenseActorUsername, type CompanyExpense } from "./company-expense-domain.ts";

export const COMPANY_EXPENSES_STORAGE_KEY = "routex-browser-preview-company-expenses-v2";
export const COMPANY_EXPENSES_DELETED_IDS_KEY = "routex-browser-preview-company-expenses-deleted-v2";
export const ROUTEX_COMPANY_EXPENSES_CHANGED = "routex:company-expenses-changed";

const DEFAULT_SEED_ID = SMALL_MOCK_COMPANY_EXPENSES[0]?.id;

function getInitialCompanyExpenses(): CompanyExpense[] {
  return [SMALL_MOCK_COMPANY_EXPENSES[0]];
}

export function readDeletedCompanyExpenseIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COMPANY_EXPENSES_DELETED_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function recordDeletedCompanyExpenseId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const set = readDeletedCompanyExpenseIds();
    set.add(id);
    window.localStorage.setItem(COMPANY_EXPENSES_DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage errors
  }
}

export function readBrowserPreviewExpenses(): CompanyExpense[] {
  if (typeof window === "undefined") {
    return getInitialCompanyExpenses();
  }
  const archive = readArchiveMachineSnapshot();
  if (archive) {
    return archive.companyExpenses;
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

    const deletedIds = readDeletedCompanyExpenseIds();
    return parsed
      .filter((item: any) => item && item.id && !deletedIds.has(item.id))
      .map((item: any) => {
        const txType =
          item.transactionType === "Incoming" ||
          item.category === "Company Income" ||
          item.category === "Billing Revenue" ||
          item.category === "Revenue"
            ? "Incoming"
            : "Outgoing";
        return {
          ...item,
          transactionType: txType,
          createdBy: formatExpenseActorUsername(item.createdBy),
          category: txType === "Incoming" ? "Company Income" : "Company Expenses",
        };
      }) as CompanyExpense[];
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

export function batchUpsertBrowserPreviewExpenses(newExpenses: CompanyExpense[]): CompanyExpense[] {
  if (newExpenses.length === 0) return readBrowserPreviewExpenses();
  const current = readBrowserPreviewExpenses();
  const byId = new Map<string, CompanyExpense>();

  for (const item of newExpenses) {
    byId.set(item.id, item);
  }
  for (const item of current) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }

  const merged = Array.from(byId.values());
  writeBrowserPreviewExpenses(merged);
  return merged;
}

export function mergeRemoteAndLocalCompanyExpenses(remoteItems: CompanyExpense[]): CompanyExpense[] {
  const archive = readArchiveMachineSnapshot();
  if (archive) {
    return archive.companyExpenses;
  }
  const deletedIds = readDeletedCompanyExpenseIds();
  const localItems = readBrowserPreviewExpenses();
  const byId = new Map<string, CompanyExpense>();
  const signatureSet = new Set<string>();

  for (const item of remoteItems) {
    if (!item || !item.id || deletedIds.has(item.id)) continue;
    const normalized: CompanyExpense = {
      ...item,
      createdBy: formatExpenseActorUsername(item.createdBy),
    };
    byId.set(normalized.id, normalized);
    signatureSet.add(`${normalized.expenseDate}_${Number(normalized.amount).toFixed(2)}_${(normalized.description || "").toLowerCase().trim()}`);
  }

  for (const local of localItems) {
    if (!local || !local.id || deletedIds.has(local.id)) continue;
    if (remoteItems.length > 0 && local.id === DEFAULT_SEED_ID && !byId.has(local.id)) {
      continue;
    }
    const sig = `${local.expenseDate}_${Number(local.amount).toFixed(2)}_${(local.description || "").toLowerCase().trim()}`;
    if (!byId.has(local.id) && !signatureSet.has(sig)) {
      byId.set(local.id, local);
      signatureSet.add(sig);
    }
  }

  return Array.from(byId.values());
}

export function deleteBrowserPreviewExpense(id: string): boolean {
  recordDeletedCompanyExpenseId(id);
  const current = readBrowserPreviewExpenses();
  const filtered = current.filter((item) => item.id !== id);

  if (filtered.length !== current.length) {
    writeBrowserPreviewExpenses(filtered);
    return true;
  }

  return false;
}

export function clearBrowserPreviewExpenses(): void {
  if (DEFAULT_SEED_ID) {
    recordDeletedCompanyExpenseId(DEFAULT_SEED_ID);
  }
  const current = readBrowserPreviewExpenses();
  for (const item of current) {
    if (item.id) recordDeletedCompanyExpenseId(item.id);
  }
  writeBrowserPreviewExpenses([]);
}
