"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { useAuthenticatedActor } from "@/components/auth-context";
import { ConfirmExpenseDeletionDialog } from "@/components/confirm-expense-deletion-dialog";
import { EditCompanyExpenseModal } from "@/components/edit-company-expense-modal";
import { ViewCompanyExpenseModal } from "@/components/view-company-expense-modal";
import { RoundedSelect } from "@/components/rounded-select";
import {
  formatDateRange,
  GlobalDateRangePicker,
  toDateKey,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import {
  SortableTableHeader,
  type TableSortDirection,
} from "@/components/sortable-table-header";
import { TablePagination } from "@/components/table-pagination";
import { useSearchBuffer } from "@/components/search-buffer";
import { SimpleLoading } from "@/components/simple-loading";
import {
  handlePositiveDecimalKeyDown,
  sanitizePositiveDecimalInput,
} from "@/features/deliveries/delivery-input-utils";
import {
  deleteBrowserPreviewExpense,
  readBrowserPreviewExpenses,
  ROUTEX_COMPANY_EXPENSES_CHANGED,
  upsertBrowserPreviewExpense,
} from "@/features/finance/browser-preview-expenses";
import {
  filterExpensesByDateRange,
  type CompanyExpense,
  type FinanceTransactionType,
  type ValidatedCompanyExpense,
  validateCompanyExpenseInput,
} from "@/features/finance/company-expense-domain";
import { canManageCompanyExpenses } from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";
import { CompactMoney } from "@/components/compact-money";

const PAGE_SIZE = 10;

export default function FinancePage() {
  const actor = useAuthenticatedActor();
  const canManage = canManageCompanyExpenses(actor.role);
  const { range, setRange } = useGlobalDateRange();

  // Company expenses state
  const [expenses, setExpenses] = useState<CompanyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Record Modal state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordType, setRecordType] = useState<FinanceTransactionType>("Outgoing");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(() => toDateKey(new Date()));
  const [newNotes, setNewNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Table filtering & sorting state
  const {
    value: searchQuery,
    setValue: setSearchQuery,
    bufferedQuery: debouncedSearchQuery,
    isBuffering: isSearchBuffering,
    clear: clearSearch,
  } = useSearchBuffer({ delay: 500 });
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"date" | "amount">("date");
  const [sortDirection, setSortDirection] = useState<TableSortDirection>("desc");
  const [page, setPage] = useState(1);

  // View, Edit & Delete dialog states
  const [viewingExpense, setViewingExpense] = useState<CompanyExpense | null>(null);
  const [editingExpense, setEditingExpense] = useState<CompanyExpense | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<CompanyExpense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRecordModalOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        setIsRecordModalOpen(false);
        setFormError(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecordModalOpen, submitting]);

  useEffect(() => {
    if (!isRecordModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isRecordModalOpen]);

  // Fetch or sync company expenses
  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/finance/expenses?pageSize=100");
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.items)) {
          setExpenses(data.items);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback to browser preview storage
    }

    const previewExpenses = readBrowserPreviewExpenses();
    setExpenses(previewExpenses);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  // Reactive listeners for cross-tab or cross-component expense events
  useEffect(() => {
    const handleExpenseChange = () => {
      const preview = readBrowserPreviewExpenses();
      setExpenses(preview);
    };

    window.addEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, handleExpenseChange);
    return () => {
      window.removeEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, handleExpenseChange);
    };
  }, []);

  useEffect(() => {
    if (!isRecordModalOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        setIsRecordModalOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecordModalOpen, submitting]);

  // Filter expenses by global date range
  const dateFilteredExpenses = useMemo(() => {
    return filterExpensesByDateRange(
      expenses,
      range.startDate ? toDateKey(range.startDate) : null,
      range.endDate ? toDateKey(range.endDate) : null,
    );
  }, [expenses, range.startDate, range.endDate]);

  // Aggregate incoming, outgoing, and net finance activity
  const financeActivity = useMemo(() => {
    let totalIncoming = 0;
    let incomingCount = 0;
    let totalOutgoing = 0;
    let outgoingCount = 0;

    for (const exp of dateFilteredExpenses) {
      if (exp.transactionType === "Incoming") {
        totalIncoming += exp.amount;
        incomingCount++;
      } else {
        totalOutgoing += exp.amount;
        outgoingCount++;
      }
    }

    return {
      totalIncoming,
      incomingCount,
      totalOutgoing,
      outgoingCount,
      netActivity: totalIncoming - totalOutgoing,
    };
  }, [dateFilteredExpenses]);

  // Actor filter options derived from unique expense creators
  const actorFilterOptions = useMemo(() => {
    const actors = new Set<string>();
    actors.add("admin");
    actors.add("finance");
    expenses.forEach((e) => {
      const c = e.createdBy?.trim();
      if (c) actors.add(c);
      else actors.add("system");
    });
    const sorted = Array.from(actors).sort((a, b) => {
      const aLower = a.replace(/^@/, "").toLowerCase();
      const bLower = b.replace(/^@/, "").toLowerCase();
      if (aLower === "admin") return -1;
      if (bLower === "admin") return 1;
      if (aLower === "finance") return -1;
      if (bLower === "finance") return 1;
      if (aLower === "system") return 1;
      if (bLower === "system") return -1;
      return aLower.localeCompare(bLower);
    });

    return [
      { value: "all", label: "All Users / Roles" },
      ...sorted.map((val) => {
        const clean = val.replace(/^@/, "").toLowerCase();
        let label = val;
        if (clean === "admin") label = "@admin (Admin)";
        else if (clean === "finance") label = "@finance (Finance)";
        else if (clean === "system") label = "System";
        else label = val.startsWith("@") ? val : `@${val}`;
        return { value: val, label };
      }),
    ];
  }, [expenses]);

  // Table filtering & sorting
  const filteredAndSortedExpenses = useMemo(() => {
    let result = [...dateFilteredExpenses];

    if (typeFilter !== "all") {
      result = result.filter((e) => (e.transactionType || "Outgoing") === typeFilter);
    }

    if (actorFilter !== "all") {
      const target = actorFilter.toLowerCase().replace(/^@/, "");
      result = result.filter((e) => {
        const creator = (e.createdBy?.trim() || "system").toLowerCase().replace(/^@/, "");
        return creator === target;
      });
    }

    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q)) ||
          (e.createdBy && e.createdBy.toLowerCase().includes(q)) ||
          e.expenseDate.includes(q) ||
          e.amount.toString().includes(q),
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") {
        cmp = a.expenseDate.localeCompare(b.expenseDate);
        if (cmp === 0) cmp = a.createdAt.localeCompare(b.createdAt);
      } else if (sortField === "amount") {
        cmp = a.amount - b.amount;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [dateFilteredExpenses, debouncedSearchQuery, actorFilter, typeFilter, sortField, sortDirection]);

  // Pagination slice
  const totalItems = filteredAndSortedExpenses.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const paginatedExpenses = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAndSortedExpenses.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedExpenses, page]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    actorFilter !== "all" ||
    range.startDate ||
    range.endDate,
  );

  function clearFilters() {
    clearSearch();
    setActorFilter("all");
    setRange({ startDate: null, endDate: null });
    setPage(1);
  }

  function handleSort(key: string, direction: TableSortDirection) {
    if (key === "date" || key === "amount") {
      setSortField(key);
      setSortDirection(direction);
      setPage(1);
    }
  }

  function handleResetSort() {
    setSortField("date");
    setSortDirection("desc");
    setPage(1);
  }

  function openRecordExpenseModal() {
    setRecordType("Outgoing");
    setFormError(null);
    setNewDescription("");
    setNewAmount("");
    setNewDate(toDateKey(new Date()));
    setNewNotes("");
    setIsRecordModalOpen(true);
  }

  function openRecordIncomeModal() {
    setRecordType("Incoming");
    setFormError(null);
    setNewDescription("");
    setNewAmount("");
    setNewDate(toDateKey(new Date()));
    setNewNotes("");
    setIsRecordModalOpen(true);
  }

  function closeRecordModal() {
    if (submitting) return;
    setIsRecordModalOpen(false);
    setFormError(null);
  }

  // Handle new transaction submission (Income or Expense)
  async function handleCreateExpense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    const isIncome = recordType === "Incoming";
    const defaultTitle = isIncome ? "Total Company Income" : "Total Company Expenses";
    const resolvedDescription =
      newDescription.trim() ||
      (newNotes.trim()
        ? `${isIncome ? "Company Income" : "Company Expenses"} - ${newNotes.trim()}`
        : defaultTitle);

    const validation = validateCompanyExpenseInput({
      description: resolvedDescription,
      amount: newAmount,
      expenseDate: newDate,
      category: isIncome ? "Company Income" : "Company Expenses",
      notes: newNotes,
      transactionType: recordType,
    });

    if (!validation.success) {
      setFormError(validation.errors[0]);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.expense) {
          upsertBrowserPreviewExpense(data.expense);
          setExpenses((prev) => [
            data.expense,
            ...prev.filter((item) => item.id !== data.expense.id),
          ]);
          setNewDescription("");
          setNewAmount("");
          setNewNotes("");
          setIsRecordModalOpen(false);
          const msg = `Recorded ${formatPeso(validation.data.amount)} company ${isIncome ? "income" : "expense"}.`;
          setFormSuccess(msg);
          toast.success(isIncome ? "Income recorded" : "Expense recorded", { description: msg });
          setSubmitting(false);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Preview mode fallback
    const newRecord: CompanyExpense = {
      id: `${isIncome ? "inc" : "exp"}-${Date.now()}`,
      description: validation.data.description,
      amount: validation.data.amount,
      expenseDate: validation.data.expenseDate,
      category: isIncome ? "Company Income" : "Company Expenses",
      notes: validation.data.notes,
      transactionType: recordType,
      createdBy: actor.username,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    upsertBrowserPreviewExpense(newRecord);
    setExpenses((prev) => [newRecord, ...prev]);
    setNewDescription("");
    setNewAmount("");
    setNewNotes("");
    setIsRecordModalOpen(false);
    const msg = `Recorded ${formatPeso(validation.data.amount)} company ${isIncome ? "income" : "expense"}.`;
    setFormSuccess(msg);
    toast.success(isIncome ? "Income recorded" : "Expense recorded", { description: msg });
    setSubmitting(false);
  }

  // Handle edit save
  async function handleSaveEdit(id: string, data: ValidatedCompanyExpense) {
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/finance/expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const resData = await res.json();
        if (resData.ok && resData.expense) {
          upsertBrowserPreviewExpense(resData.expense);
          setExpenses((prev) =>
            prev.map((e) => (e.id === id ? resData.expense : e)),
          );
          setEditingExpense(null);
          const updateMsg = `Updated ${formatPeso(data.amount)} company expense.`;
          setFormSuccess(updateMsg);
          toast.success("Expense updated", { description: updateMsg });
          setIsSavingEdit(false);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Preview mode fallback
    const existing = expenses.find((e) => e.id === id);
    if (existing) {
      const updated: CompanyExpense = {
        ...existing,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      upsertBrowserPreviewExpense(updated);
      setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    }
    setEditingExpense(null);
    const updateMsg = `Updated ${formatPeso(data.amount)} company expense.`;
    setFormSuccess(updateMsg);
    toast.success("Expense updated", { description: updateMsg });
    setIsSavingEdit(false);
  }

  // Handle delete confirm
  async function handleConfirmDelete(reason: string) {
    if (!deletingExpense) return;
    setIsDeleting(true);
    setDeleteError(null);

    const id = deletingExpense.id;

    try {
      const res = await fetch(`/api/finance/expenses/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        deleteBrowserPreviewExpense(id);
        setExpenses((prev) => prev.filter((e) => e.id !== id));
        setDeletingExpense(null);
        setFormSuccess("Deleted company expense record.");
        toast.success("Expense deleted", { description: "Deleted company expense record." });
        setIsDeleting(false);
        return;
      }
    } catch {
      // Fallback
    }

    // Preview mode fallback
    deleteBrowserPreviewExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setDeletingExpense(null);
    setFormSuccess("Deleted company expense record.");
    toast.success("Expense deleted", { description: "Deleted company expense record." });
    setIsDeleting(false);
  }

  return (
    <>
      <OperationalTopbar contextLabel="Finance" showDateFilter={false} />

      <div className="content-wrap finance-page">
        <header className="page-intro">
          <div>
            <h1>Company Finance</h1>
            <p className="subtitle">Company income and operating expenses.</p>
          </div>
          <div className="page-intro-actions fleet-intro-actions" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {canManage ? (
              <>
                <Link
                  className="secondary-button page-intro-action"
                  href="/finance/import"
                  aria-label="Import company finance spreadsheet"
                  style={{ borderRadius: "8px", margin: "0" }}
                >
                  Import
                </Link>
                <button
                  type="button"
                  className="secondary-button page-intro-action finance-record-income-btn"
                  onClick={openRecordIncomeModal}
                  style={{ borderRadius: "8px", margin: "0" }}
                >
                  + Record Income
                </button>
                <button
                  type="button"
                  className="primary-action-button page-intro-action"
                  onClick={openRecordExpenseModal}
                  style={{ borderRadius: "8px", margin: "0" }}
                >
                  + Record Expense
                </button>
              </>
            ) : (
              <span className="settings-readonly-pill">
                View-Only ({actor.roleLabel})
              </span>
            )}
          </div>
        </header>

        {error ? (
          <div className="notice" role="alert">
            <span className="notice-icon" aria-hidden="true">
              !
            </span>
            <div>
              <strong>Error:</strong>
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        {formSuccess ? (
          <div className="notice" role="status">
            <span className="notice-icon" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <div style={{ flex: 1 }}>
              <span>{formSuccess}</span>
            </div>
            <button
              type="button"
              className="secondary-button"
              style={{ minHeight: "28px", padding: "0 10px", fontSize: "11px" }}
              onClick={() => setFormSuccess(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Summary KPI Cards */}
        <section className="stat-grid" aria-label="Company finance summary">
          <button
            type="button"
            className={`stat-card stat-card-revenue stat-card-income is-interactive${typeFilter === "Incoming" ? " is-active" : ""}`}
            onClick={() => {
              setTypeFilter((curr) => (curr === "Incoming" ? "all" : "Incoming"));
              setPage(1);
            }}
            aria-pressed={typeFilter === "Incoming"}
            aria-label="Filter company ledger to incoming income"
          >
            <div className="stat-card-header">
              <span className="stat-label">INCOME</span>
              <span className="kpi-click-pill">
                {typeFilter === "Incoming" ? "Active" : "Filter ›"}
              </span>
            </div>
            <strong>
              <CompactMoney value={financeActivity.totalIncoming} />
            </strong>
            <span className={`stat-meta ${financeActivity.totalIncoming > 0 ? "positive" : ""}`}>
              {financeActivity.incomingCount} income {financeActivity.incomingCount === 1 ? "record" : "records"}
            </span>
          </button>

          <button
            type="button"
            className={`stat-card stat-card-expenses stat-card-outgoing is-interactive${typeFilter === "Outgoing" ? " is-active" : ""}`}
            onClick={() => {
              setTypeFilter((curr) => (curr === "Outgoing" ? "all" : "Outgoing"));
              setPage(1);
            }}
            aria-pressed={typeFilter === "Outgoing"}
            aria-label="Filter company ledger to outgoing expenses"
          >
            <div className="stat-card-header">
              <span className="stat-label">EXPENSES</span>
              <span className="kpi-click-pill">
                {typeFilter === "Outgoing" ? "Active" : "Filter ›"}
              </span>
            </div>
            <strong>
              <CompactMoney value={financeActivity.totalOutgoing} />
            </strong>
            <span className="stat-meta">
              {financeActivity.outgoingCount} expense {financeActivity.outgoingCount === 1 ? "record" : "records"}
            </span>
          </button>

          <button
            type="button"
            className={`stat-card stat-card-profit is-interactive${typeFilter === "all" ? " is-active" : ""}`}
            onClick={() => {
              setTypeFilter("all");
              setPage(1);
            }}
            aria-pressed={typeFilter === "all"}
            aria-label="View all transactions and net profit"
          >
            <div className="stat-card-header">
              <span className="stat-label">NET PROFIT</span>
              <span className="kpi-click-pill">
                {typeFilter === "all" ? "All" : "View All ›"}
              </span>
            </div>
            <strong className={financeActivity.netActivity >= 0 ? undefined : "warning"}>
              <CompactMoney value={financeActivity.netActivity} />
            </strong>
            <span className={`stat-meta ${financeActivity.netActivity >= 0 ? "positive" : "warning"}`}>
              {financeActivity.totalIncoming > 0
                ? `${formatPercent((financeActivity.netActivity / financeActivity.totalIncoming) * 100)} margin · ${dateFilteredExpenses.length} records`
                : `${dateFilteredExpenses.length} transactions · ${formatDateRange(range)}`}
            </span>
          </button>
        </section>

        {/* Company Ledger */}
        <section
          className="records-card finance-ledger-card"
          aria-label="Company finance ledger"
        >
          <div className="records-heading">
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <h2>Company Ledger</h2>
              <div className="finance-ledger-tabs" role="tablist" aria-label="Filter ledger view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === "all"}
                  className={`finance-ledger-tab${typeFilter === "all" ? " active" : ""}`}
                  onClick={() => {
                    setTypeFilter("all");
                    setPage(1);
                  }}
                >
                  All Records
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === "Incoming"}
                  className={`finance-ledger-tab${typeFilter === "Incoming" ? " active income" : ""}`}
                  onClick={() => {
                    setTypeFilter("Incoming");
                    setPage(1);
                  }}
                >
                  Company Income
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === "Outgoing"}
                  className={`finance-ledger-tab${typeFilter === "Outgoing" ? " active expense" : ""}`}
                  onClick={() => {
                    setTypeFilter("Outgoing");
                    setPage(1);
                  }}
                >
                  Company Expenses
                </button>
              </div>
            </div>
            <span className="ledger-total-badge">
              {filteredAndSortedExpenses.length} of {expenses.length} records
            </span>
          </div>

          <div className="filters" aria-label="Filter company expenses">
            <label
              className={`search-box${isSearchBuffering ? " is-buffering" : ""}`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                aria-label="Search company expenses"
                placeholder="Search description, note, or user…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
              {isSearchBuffering && (
                <span className="search-buffer-indicator" title="Buffering search…" aria-label="Buffering search…" />
              )}
              {searchQuery ? (
                <button
                  type="button"
                  className="search-clear-btn"
                  aria-label="Clear search query"
                  title="Clear search"
                  onClick={() => {
                    clearSearch();
                    setPage(1);
                  }}
                >
                  ×
                </button>
              ) : null}
            </label>

            <GlobalDateRangePicker />

            <RoundedSelect
              value={actorFilter}
              options={actorFilterOptions}
              onChange={(val) => {
                setActorFilter(val);
                setPage(1);
              }}
              ariaLabel="Filter expenses by user or role"
              className="finance-actor-filter"
            />
          </div>

          {hasActiveFilters ? (
            <div className="active-filter-chips" aria-label="Active filters">
              <span className="filter-chips-label">Filtered by:</span>
              {(range.startDate || range.endDate) ? (
                <span className="filter-chip">
                  <span className="filter-chip-category">Date:</span>{" "}
                  {formatDateRange(range)}
                  <button
                    type="button"
                    className="filter-chip-remove"
                    aria-label="Remove date range filter"
                    title="Remove date range filter"
                    onClick={() => setRange({ startDate: null, endDate: null })}
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {searchQuery.trim() ? (
                <span className="filter-chip">
                  <span className="filter-chip-category">Search:</span>{" "}
                  {searchQuery.trim()}
                  <button
                    type="button"
                    className="filter-chip-remove"
                    aria-label="Remove search filter"
                    onClick={() => {
                      setSearchQuery("");
                      setPage(1);
                    }}
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {actorFilter !== "all" ? (
                <span className="filter-chip">
                  <span className="filter-chip-category">User / Role:</span>{" "}
                  {actorFilterOptions.find((o) => o.value === actorFilter)?.label ?? actorFilter}
                  <button
                    type="button"
                    className="filter-chip-remove"
                    aria-label="Remove actor filter"
                    onClick={() => {
                      setActorFilter("all");
                      setPage(1);
                    }}
                  >
                    ×
                  </button>
                </span>
              ) : null}
              <button
                type="button"
                className="filter-chip-clear-all"
                onClick={clearFilters}
              >
                Clear all
              </button>
            </div>
          ) : null}

          {(loading || isSearchBuffering) ? (
            <SimpleLoading
              message={isSearchBuffering ? "Searching expenses…" : "Loading expense ledger…"}
            />
          ) : (
            <div className="table-wrap">
              <table className="finance-ledger-table">
                <thead>
                  <tr>
                    <SortableTableHeader
                      label="Date"
                      sortKey="date"
                      activeSortKey={sortField}
                      direction={sortDirection}
                      defaultDirection="desc"
                      onSort={handleSort}
                      onReset={handleResetSort}
                    />
                    <th>Description</th>
                    <th>Notes</th>
                    <th>User</th>
                    <SortableTableHeader
                      label="Amount"
                      sortKey="amount"
                      activeSortKey={sortField}
                      direction={sortDirection}
                      defaultDirection="desc"
                      onSort={handleSort}
                      onReset={handleResetSort}
                      className="money"
                    />
                    {canManage && (
                      <th style={{ width: "76px", textAlign: "right" }}>
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 6 : 5} className="table-empty-cell">
                        <div className="empty-state minimal">
                          <strong className="empty-state-title">No records found</strong>
                          <span className="empty-state-desc">
                            No expenses match the active filters or selected range.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedExpenses.map((exp) => {
                      return (
                        <tr
                          key={exp.id}
                          className="clickable-table-row"
                          tabIndex={0}
                          onClick={() => setViewingExpense(exp)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setViewingExpense(exp);
                            }
                          }}
                        >
                          <td className="cell-date">{exp.expenseDate}</td>
                          <td>
                            <strong>
                              {exp.description || "Total Company Expenses"}
                            </strong>
                          </td>
                          <td className="finance-note-cell">{exp.notes || "—"}</td>
                          <td>{exp.createdBy || "system"}</td>
                          <td className="money">
                            <strong
                              style={{
                                color:
                                  exp.transactionType === "Incoming"
                                    ? "var(--color-status-success, #059669)"
                                    : "var(--color-status-danger, #dc2626)",
                              }}
                            >
                              {exp.transactionType === "Incoming" ? "+ " : "- "}
                              <CompactMoney value={exp.amount} />
                            </strong>
                          </td>
                          {canManage && (
                            <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                              <div className="truck-row-actions">
                                <button
                                  type="button"
                                  className="truck-action-icon-btn"
                                  aria-label={`Edit expense: ${exp.description || "Expense"}`}
                                  title="Edit expense"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingExpense(exp);
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="truck-action-icon-btn danger"
                                  aria-label={`Delete expense: ${exp.description || "Expense"}`}
                                  title="Delete expense"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteError(null);
                                    setDeletingExpense(exp);
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          <TablePagination
            page={page}
            pageCount={pageCount}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            loading={loading || isSearchBuffering}
            itemLabel="expenses"
            itemCountInPage={paginatedExpenses.length}
          />
        </section>
      </div>

      {/* Record Modal (Income or Expense) */}
      {isRecordModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="record-expense-modal-title"
              style={{ zIndex: 1000 }}
            >
              <div
                className="routex-dialog-backdrop"
                onClick={closeRecordModal}
              />
              <div
                className="routex-dialog finance-expense-dialog"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="routex-dialog-header">
                  <div>
                    <h2 id="record-expense-modal-title">
                      {recordType === "Incoming" ? "Record Company Income" : "Record Company Expense"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="routex-dialog-close"
                    aria-label="Close record modal"
                    title="Close (Esc)"
                    disabled={submitting}
                    onClick={closeRecordModal}
                  >
                    ×
                  </button>
                </header>

                <form onSubmit={handleCreateExpense}>
                  <div className="routex-dialog-body finance-expense-dialog-body">
                    {formError ? (
                      <div className="delivery-form-alert" role="alert">
                        {formError}
                      </div>
                    ) : null}

                    {/* Transaction Type Switcher */}
                    <div className="finance-type-toggle-group" style={{ marginBottom: "14px" }}>
                      <button
                        type="button"
                        className={`finance-type-toggle-btn${recordType === "Incoming" ? " active income" : ""}`}
                        onClick={() => setRecordType("Incoming")}
                        disabled={submitting}
                      >
                        + Company Income
                      </button>
                      <button
                        type="button"
                        className={`finance-type-toggle-btn${recordType === "Outgoing" ? " active expense" : ""}`}
                        onClick={() => setRecordType("Outgoing")}
                        disabled={submitting}
                      >
                        - Company Expense
                      </button>
                    </div>

                    <div className="routex-dialog-grid-2">
                      <div className="routex-dialog-field">
                        <label htmlFor="finance-expense-amount">
                          Amount (₱) <span className="field-required-tag">*</span>
                        </label>
                        <div className="peso-input-wrap">
                          <span className="peso-prefix" aria-hidden="true">
                            ₱
                          </span>
                          <input
                            id="finance-expense-amount"
                            type="text"
                            inputMode="decimal"
                            className="peso-input"
                            placeholder="0.00"
                            value={newAmount}
                            onKeyDown={handlePositiveDecimalKeyDown}
                            onChange={(e) =>
                              setNewAmount(
                                sanitizePositiveDecimalInput(e.target.value),
                              )
                            }
                            disabled={submitting}
                            required
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="routex-dialog-field">
                        <label htmlFor="finance-expense-date">
                          Date <span className="field-required-tag">*</span>
                        </label>
                        <input
                          id="finance-expense-date"
                          type="date"
                          min="2024-01-01"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          disabled={submitting}
                          required
                        />
                      </div>
                    </div>

                    <div className="routex-dialog-field">
                      <label htmlFor="finance-expense-description">
                        Description{" "}
                        <span className="field-required-tag">(Optional)</span>
                      </label>
                      <input
                        id="finance-expense-description"
                        type="text"
                        placeholder={
                          recordType === "Incoming"
                            ? "e.g. Client retainer, customer payment, freight rebate"
                            : "Total Company Expenses"
                        }
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        disabled={submitting}
                      />
                    </div>

                    <div className="routex-dialog-field">
                      <label htmlFor="finance-expense-notes">
                        Note / Reference{" "}
                        <span className="field-required-tag">(Optional)</span>
                      </label>
                      <input
                        id="finance-expense-notes"
                        type="text"
                        placeholder={
                          recordType === "Incoming"
                            ? "e.g. Check / wire reference #, invoice number"
                            : "e.g. Utilities, office supplies, invoice #"
                        }
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <footer className="routex-dialog-footer">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={submitting}
                      onClick={closeRecordModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary-action-button"
                      disabled={submitting}
                    >
                      {submitting
                        ? "Saving…"
                        : recordType === "Incoming"
                        ? "Record Income"
                        : "Record Expense"}
                    </button>
                  </footer>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* View Expense Modal */}
      <ViewCompanyExpenseModal
        expense={viewingExpense}
        canManage={canManage}
        onClose={() => setViewingExpense(null)}
        onEdit={(exp) => {
          setViewingExpense(null);
          setEditingExpense(exp);
        }}
        onDelete={(exp) => {
          setViewingExpense(null);
          setDeletingExpense(exp);
        }}
      />

      {/* Edit Modal */}
      <EditCompanyExpenseModal
        expense={editingExpense}
        pending={isSavingEdit}
        onClose={() => setEditingExpense(null)}
        onSave={handleSaveEdit}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmExpenseDeletionDialog
        expense={deletingExpense}
        pending={isDeleting}
        error={deleteError}
        onCancel={() => {
          setDeleteError(null);
          setDeletingExpense(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
