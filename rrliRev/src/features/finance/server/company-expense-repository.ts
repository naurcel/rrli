import { SMALL_MOCK_COMPANY_EXPENSES } from "../../deliveries/small-mock-database.ts";
import { recordAuditEntry } from "../../../lib/audit/server-audit-store.ts";
import { isSupabaseConfigured } from "../../../lib/config/env.ts";
import {
  type CompanyExpense,
  type ValidatedCompanyExpense,
  aggregateExpensesByCategory,
  aggregateMonthlyExpenses,
  filterExpensesByDateRange,
} from "../company-expense-domain.ts";

async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  try {
    const { createServerSupabaseClient } = await import("../../../lib/supabase/server.ts");
    return await createServerSupabaseClient();
  } catch {
    return null;
  }
}

export type CompanyExpenseQuery = {
  search?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "expense_date" | "amount" | "description" | "created_at";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type CompanyExpenseListResult = {
  items: CompanyExpense[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  summary: {
    totalAmount: number;
    count: number;
    monthlyAverage: number;
    categoryTotals: Array<{ category: string; total: number; count: number; percentage: number }>;
  };
};

// Global in-memory cache for server preview mode across requests
const mockExpensesGlobal = globalThis as typeof globalThis & {
  __routexCompanyExpenses?: CompanyExpense[];
};

function getMockExpensesStore(): CompanyExpense[] {
  if (!mockExpensesGlobal.__routexCompanyExpenses) {
    mockExpensesGlobal.__routexCompanyExpenses = SMALL_MOCK_COMPANY_EXPENSES.map((e) => ({
      ...e,
    }));
  }
  return mockExpensesGlobal.__routexCompanyExpenses;
}

export function resetCompanyExpensesStore(): CompanyExpense[] {
  mockExpensesGlobal.__routexCompanyExpenses = SMALL_MOCK_COMPANY_EXPENSES.map((e) => ({
    ...e,
  }));
  return mockExpensesGlobal.__routexCompanyExpenses;
}

export async function listCompanyExpenses(query: CompanyExpenseQuery = {}): Promise<CompanyExpenseListResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, Math.min(5000, query.pageSize ?? 10));
  const sort = query.sort ?? "expense_date";
  const direction = query.direction ?? "desc";

  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error("Supabase unavailable");
      let dbQuery = supabase
        .from("company_expenses")
        .select("*", { count: "exact" });

      if (query.dateFrom) {
        dbQuery = dbQuery.gte("expense_date", query.dateFrom);
      }
      if (query.dateTo) {
        dbQuery = dbQuery.lte("expense_date", query.dateTo);
      }
      if (query.category && query.category !== "all") {
        dbQuery = dbQuery.eq("category", query.category);
      }
      if (query.search?.trim()) {
        dbQuery = dbQuery.or(`description.ilike.%${query.search.trim()}%,notes.ilike.%${query.search.trim()}%`);
      }

      dbQuery = dbQuery.order(sort, { ascending: direction === "asc" });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      dbQuery = dbQuery.range(from, to);

      const { data, count, error } = await dbQuery;
      if (!error && data) {
        const items: CompanyExpense[] = data.map((row) => ({
          id: row.id,
          description: row.description,
          amount: Number(row.amount),
          expenseDate: row.expense_date,
          category: row.category,
          notes: row.notes,
          transactionType: (row.transaction_type as "Incoming" | "Outgoing") ?? "Outgoing",
          sourceSheet: row.source_sheet ?? null,
          sourceRow: row.source_row ?? null,
          sourceRef: row.source_ref ?? null,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

        const total = count ?? items.length;
        const pageCount = Math.max(1, Math.ceil(total / pageSize));

        // Fetch full range totals for summary
        let summaryQuery = supabase
          .from("company_expenses")
          .select("amount, category, expense_date");
        if (query.dateFrom) summaryQuery = summaryQuery.gte("expense_date", query.dateFrom);
        if (query.dateTo) summaryQuery = summaryQuery.lte("expense_date", query.dateTo);
        const summaryRes = await summaryQuery;

        const allRangeItems = (summaryRes.data ?? []).map((r) => ({
          id: "",
          description: "",
          amount: Number(r.amount),
          expenseDate: r.expense_date,
          category: r.category,
          createdAt: "",
          updatedAt: "",
        }));

        const totalAmount = allRangeItems.reduce((sum, item) => sum + item.amount, 0);
        const categoryTotals = aggregateExpensesByCategory(allRangeItems);
        const monthly = aggregateMonthlyExpenses(allRangeItems);
        const monthlyAverage = monthly.length > 0 ? totalAmount / monthly.length : totalAmount;

        return {
          items,
          total,
          page,
          pageSize,
          pageCount,
          summary: {
            totalAmount,
            count: allRangeItems.length,
            monthlyAverage,
            categoryTotals,
          },
        };
      }
    } catch {
      // Fallback to in-memory store
    }
  }

  // In-Memory / Preview Mode Store
  let store = getMockExpensesStore();

  // Filter by date
  store = filterExpensesByDateRange(store, query.dateFrom ?? null, query.dateTo ?? null);

  // Filter by category
  if (query.category && query.category !== "all") {
    store = store.filter((e) => e.category?.toLowerCase() === query.category!.toLowerCase());
  }

  // Filter by search
  if (query.search?.trim()) {
    const q = query.search.trim().toLowerCase();
    store = store.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q)),
    );
  }

  // Sort
  store.sort((a, b) => {
    let comparison = 0;
    if (sort === "expense_date") {
      comparison = a.expenseDate.localeCompare(b.expenseDate);
      if (comparison === 0) comparison = b.createdAt.localeCompare(a.createdAt);
    } else if (sort === "amount") {
      comparison = a.amount - b.amount;
    } else if (sort === "description") {
      comparison = a.description.localeCompare(b.description);
    } else {
      comparison = a.createdAt.localeCompare(b.createdAt);
    }
    return direction === "asc" ? comparison : -comparison;
  });

  const total = store.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;
  const items = store.slice(startIndex, startIndex + pageSize);

  const outgoingStore = store.filter((e) => e.transactionType !== "Incoming");
  const totalAmount = outgoingStore.reduce((sum, e) => sum + e.amount, 0);
  const categoryTotals = aggregateExpensesByCategory(outgoingStore);
  const monthly = aggregateMonthlyExpenses(outgoingStore);
  const monthlyAverage = monthly.length > 0 ? totalAmount / monthly.length : totalAmount;

  return {
    items,
    total,
    page,
    pageSize,
    pageCount,
    summary: {
      totalAmount,
      count: store.length,
      monthlyAverage,
      categoryTotals,
    },
  };
}

export async function getCompanyExpenseById(id: string): Promise<CompanyExpense | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("company_expenses")
          .select("*")
          .eq("id", id)
          .single();

        if (!error && data) {
          return {
            id: data.id,
            description: data.description,
            amount: Number(data.amount),
            expenseDate: data.expense_date,
            category: data.category,
            notes: data.notes,
            transactionType: (data.transaction_type as "Incoming" | "Outgoing") ?? "Outgoing",
            sourceSheet: data.source_sheet ?? null,
            sourceRow: data.source_row ?? null,
            sourceRef: data.source_ref ?? null,
            createdBy: data.created_by,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      }
    } catch {
      // Fallback
    }
  }

  const store = getMockExpensesStore();
  return store.find((e) => e.id === id) ?? null;
}

export async function createCompanyExpense(
  validated: ValidatedCompanyExpense,
  actorEmail: string,
): Promise<CompanyExpense> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const newExpense: CompanyExpense = {
    id,
    description: validated.description,
    amount: validated.amount,
    expenseDate: validated.expenseDate,
    category: validated.category,
    notes: validated.notes,
    transactionType: validated.transactionType ?? "Outgoing",
    sourceSheet: validated.sourceSheet ?? null,
    sourceRow: validated.sourceRow ?? null,
    sourceRef: validated.sourceRef ?? null,
    createdBy: actorEmail,
    createdAt: now,
    updatedAt: now,
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { error } = await supabase
          .from("company_expenses")
          .insert({
            id: newExpense.id,
            description: newExpense.description,
            amount: newExpense.amount,
            expense_date: newExpense.expenseDate,
            category: newExpense.category,
            notes: newExpense.notes,
            transaction_type: newExpense.transactionType,
            source_sheet: newExpense.sourceSheet,
            source_row: newExpense.sourceRow,
            source_ref: newExpense.sourceRef,
            created_by: newExpense.createdBy,
            created_at: newExpense.createdAt,
            updated_at: newExpense.updatedAt,
          })
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }
      }
    } catch (err) {
      console.warn("Supabase insert failed, falling back to in-memory:", err);
    }
  }

  // Always update in-memory store
  const store = getMockExpensesStore();
  store.unshift(newExpense);

  // Record Audit Log Entry
  recordAuditEntry({
    actorId: actorEmail,
    actorEmail,
    action: "company_expense.created",
    entityType: "company_expense",
    entityId: newExpense.id,
    summary: `Recorded company expense "${newExpense.description}" (₱${newExpense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}) under ${newExpense.category}.`,
    changes: {
      description: newExpense.description,
      amount: newExpense.amount,
      expenseDate: newExpense.expenseDate,
      category: newExpense.category,
      notes: newExpense.notes,
    },
  });

  return newExpense;
}

export async function batchCreateCompanyExpenses(
  expenses: ValidatedCompanyExpense[],
  actorEmail: string,
  batchName?: string,
): Promise<{ committed: CompanyExpense[]; count: number }> {
  const now = new Date().toISOString();
  const createdList: CompanyExpense[] = expenses.map((validated, idx) => ({
    id: `comp-exp-${Date.now()}-${idx}-${crypto.randomUUID().slice(0, 8)}`,
    description: validated.description,
    amount: validated.amount,
    expenseDate: validated.expenseDate,
    category: validated.category,
    notes: validated.notes,
    transactionType: validated.transactionType ?? "Outgoing",
    sourceSheet: validated.sourceSheet ?? null,
    sourceRow: validated.sourceRow ?? null,
    sourceRef: validated.sourceRef ?? null,
    createdBy: actorEmail,
    createdAt: now,
    updatedAt: now,
  }));

  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseClient();
      if (supabase && createdList.length > 0) {
        const rows = createdList.map((e) => ({
          id: e.id,
          description: e.description,
          amount: e.amount,
          expense_date: e.expenseDate,
          category: e.category,
          notes: e.notes,
          created_by: e.createdBy,
          created_at: e.createdAt,
          updated_at: e.updatedAt,
        }));
        await supabase.from("company_expenses").insert(rows);
      }
    } catch (err) {
      console.warn("Supabase batch insert failed, falling back to in-memory:", err);
    }
  }

  const store = getMockExpensesStore();
  store.unshift(...createdList);

  const totalAmount = createdList.reduce((sum, e) => sum + e.amount, 0);

  recordAuditEntry({
    actorId: actorEmail,
    actorEmail,
    action: "company_expense.created",
    entityType: "company_expense",
    entityId: createdList[0]?.id ?? "batch",
    summary: `Batch imported ${createdList.length} company expenses (${batchName ?? "Spreadsheet Import"}) totaling ₱${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`,
    changes: {
      count: createdList.length,
      totalAmount,
      batchName,
    },
  });

  return { committed: createdList, count: createdList.length };
}

export async function updateCompanyExpense(
  id: string,
  validated: ValidatedCompanyExpense,
  actorEmail: string,
): Promise<CompanyExpense | null> {
  const existing = await getCompanyExpenseById(id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const updatedExpense: CompanyExpense = {
    ...existing,
    description: validated.description,
    amount: validated.amount,
    expenseDate: validated.expenseDate,
    category: validated.category,
    notes: validated.notes,
    transactionType: validated.transactionType ?? existing.transactionType ?? "Outgoing",
    updatedAt: now,
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseClient();
      if (supabase) {
        await supabase
          .from("company_expenses")
          .update({
            description: updatedExpense.description,
            amount: updatedExpense.amount,
            expense_date: updatedExpense.expenseDate,
            category: updatedExpense.category,
            notes: updatedExpense.notes,
            updated_at: updatedExpense.updatedAt,
          })
          .eq("id", id);
      }
    } catch (err) {
      console.warn("Supabase update failed, falling back to in-memory:", err);
    }
  }

  // Update in-memory store
  const store = getMockExpensesStore();
  const idx = store.findIndex((e) => e.id === id);
  if (idx >= 0) {
    store[idx] = updatedExpense;
  }

  // Record Audit Log Entry with detailed transitions
  recordAuditEntry({
    actorId: actorEmail,
    actorEmail,
    action: "company_expense.updated",
    entityType: "company_expense",
    entityId: id,
    summary: `Updated company expense "${updatedExpense.description}" (Amount: ₱${updatedExpense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}).`,
    changes: {
      previousDescription: existing.description,
      newDescription: updatedExpense.description,
      previousAmount: existing.amount,
      newAmount: updatedExpense.amount,
      previousDate: existing.expenseDate,
      newDate: updatedExpense.expenseDate,
      previousCategory: existing.category,
      newCategory: updatedExpense.category,
    },
  });

  return updatedExpense;
}

export async function deleteCompanyExpense(
  id: string,
  actorEmail: string,
  reason?: string,
): Promise<boolean> {
  const existing = await getCompanyExpenseById(id);
  if (!existing) {
    return false;
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseClient();
      if (supabase) {
        await supabase.from("company_expenses").delete().eq("id", id);
      }
    } catch (err) {
      console.warn("Supabase delete failed, falling back to in-memory:", err);
    }
  }

  // Update in-memory store
  const store = getMockExpensesStore();
  const idx = store.findIndex((e) => e.id === id);
  if (idx >= 0) {
    store.splice(idx, 1);
  }

  // Record Audit Log Entry
  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  recordAuditEntry({
    actorId: actorEmail,
    actorEmail,
    action: "company_expense.deleted",
    entityType: "company_expense",
    entityId: id,
    summary: `Deleted company expense "${existing.description}" (₱${existing.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}).${cleanReason ? ` Reason: "${cleanReason}".` : ""}`,
    changes: {
      deletedDescription: existing.description,
      deletedAmount: existing.amount,
      deletedDate: existing.expenseDate,
      deletedCategory: existing.category,
      deletionReason: cleanReason || "Administrative deletion",
    },
  });

  return true;
}

/**
 * Returns raw aggregate summary of company expenses for date range.
 * Used for fast computations in Dashboard and Reports.
 */
export async function getCompanyExpensesSummary(
  dateFrom?: string | null,
  dateTo?: string | null,
): Promise<{
  totalAmount: number;
  count: number;
  categoryTotals: Array<{ category: string; total: number; count: number; percentage: number }>;
  monthlyTotals: Array<{ monthKey: string; label: string; total: number; count: number }>;
}> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseClient();
      if (supabase) {
        let query = supabase
          .from("company_expenses")
          .select("id, description, amount, category, expense_date, created_at, updated_at");
        if (dateFrom) query = query.gte("expense_date", dateFrom);
        if (dateTo) query = query.lte("expense_date", dateTo);
        const { data, error } = await query;
        if (!error && data) {
          const items: CompanyExpense[] = data.map((r) => ({
            id: r.id,
            description: r.description,
            amount: Number(r.amount),
            expenseDate: r.expense_date,
            category: r.category,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }));
          const totalAmount = items.reduce((sum, e) => sum + e.amount, 0);
          const categoryTotals = aggregateExpensesByCategory(items);
          const monthlyTotals = aggregateMonthlyExpenses(items);
          return {
            totalAmount,
            count: items.length,
            categoryTotals,
            monthlyTotals,
          };
        }
      }
    } catch {
      // Fallback to in-memory store
    }
  }

  const store = getMockExpensesStore();
  const filtered = filterExpensesByDateRange(store, dateFrom ?? null, dateTo ?? null);
  const outgoingFiltered = filtered.filter((e) => e.transactionType !== "Incoming");

  const totalAmount = outgoingFiltered.reduce((sum, e) => sum + e.amount, 0);
  const categoryTotals = aggregateExpensesByCategory(outgoingFiltered);
  const monthlyTotals = aggregateMonthlyExpenses(outgoingFiltered);

  return {
    totalAmount,
    count: outgoingFiltered.length,
    categoryTotals,
    monthlyTotals,
  };
}
