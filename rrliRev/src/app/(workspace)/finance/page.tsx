"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useAuthenticatedActor } from "@/components/auth-context";
import { ConfirmExpenseDeletionDialog } from "@/components/confirm-expense-deletion-dialog";
import { EditCompanyExpenseModal } from "@/components/edit-company-expense-modal";
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
  type ValidatedCompanyExpense,
  validateCompanyExpenseInput,
} from "@/features/finance/company-expense-domain";
import { canManageCompanyExpenses } from "@/lib/auth/rbac";
import { formatPeso } from "@/lib/format";

const PAGE_SIZE = 10;

export default function FinancePage() {
  const actor = useAuthenticatedActor();
  const canManage = canManageCompanyExpenses(actor.role);
  const { range, setRange } = useGlobalDateRange();

  // Company expenses state
  const [expenses, setExpenses] = useState<CompanyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Record Expense Modal state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(() => toDateKey(new Date()));
  const [newNotes, setNewNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Table filtering & sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"date" | "amount">("date");
  const [sortDirection, setSortDirection] = useState<TableSortDirection>("desc");
  const [page, setPage] = useState(1);

  // Edit & Delete dialog states
  const [openActionExpenseId, setOpenActionExpenseId] = useState<string | null>(null);
  const [actionMenuOpensAbove, setActionMenuOpensAbove] = useState(false);
  const [editingExpense, setEditingExpense] = useState<CompanyExpense | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<CompanyExpense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!openActionExpenseId) return;
    function handleClickOutside() {
      setOpenActionExpenseId(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenActionExpenseId(null);
      }
    }
    document.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openActionExpenseId]);

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

  // Aggregate Company Expenses metrics for selected period
  const expenseMetrics = useMemo(() => {
    const total = dateFilteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const count = dateFilteredExpenses.length;
    const average = count > 0 ? total / count : 0;
    const highestEntry = dateFilteredExpenses.reduce<CompanyExpense | null>(
      (max, e) => (max === null || e.amount > max.amount ? e : max),
      null,
    );

    return {
      total,
      count,
      average,
      highest: highestEntry ? highestEntry.amount : 0,
      highestEntry,
    };
  }, [dateFilteredExpenses]);

  // Table filtering & sorting
  const filteredAndSortedExpenses = useMemo(() => {
    let result = [...dateFilteredExpenses];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
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
  }, [dateFilteredExpenses, searchQuery, sortField, sortDirection]);

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
    searchQuery.trim() || range.startDate || range.endDate,
  );

  function clearFilters() {
    setSearchQuery("");
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

  function openRecordModal() {
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

  // Handle new expense submission
  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    const resolvedDescription =
      newDescription.trim() ||
      (newNotes.trim()
        ? `Company Expenses - ${newNotes.trim()}`
        : "Total Company Expenses");

    const validation = validateCompanyExpenseInput({
      description: resolvedDescription,
      amount: newAmount,
      expenseDate: newDate,
      notes: newNotes,
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
          setFormSuccess(
            `Recorded ${formatPeso(validation.data.amount)} company expense.`,
          );
          setSubmitting(false);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Preview mode fallback
    const newRecord: CompanyExpense = {
      id: `exp-${Date.now()}`,
      description: validation.data.description,
      amount: validation.data.amount,
      expenseDate: validation.data.expenseDate,
      category: "Company Expenses",
      notes: validation.data.notes,
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
    setFormSuccess(
      `Recorded ${formatPeso(validation.data.amount)} company expense.`,
    );
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
          setFormSuccess(`Updated ${formatPeso(data.amount)} company expense.`);
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
    setFormSuccess(`Updated ${formatPeso(data.amount)} company expense.`);
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
    setIsDeleting(false);
  }

  return (
    <>
      <OperationalTopbar contextLabel="Finance" showDateFilter={false} />

      <div className="content-wrap finance-page">
        <header className="page-intro">
          <div>
            <h1>Finance</h1>
            <p className="subtitle">Company operating expense ledger and records.</p>
          </div>
          <div className="page-intro-actions">
            {canManage ? (
              <button
                type="button"
                className="primary-action-button page-intro-action"
                onClick={openRecordModal}
                title="Record a company operating expense"
              >
                + Record Expense
              </button>
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
              ✓
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
        <section className="stat-grid" aria-label="Company expense summary">
          <article className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">TOTAL COMPANY EXPENSES</span>
            </div>
            <strong>{formatPeso(expenseMetrics.total)}</strong>
            <span className="stat-meta">
              {formatDateRange(range)}
            </span>
          </article>

          <article className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">AVERAGE EXPENSE</span>
            </div>
            <strong>{formatPeso(expenseMetrics.average)}</strong>
            <span className="stat-meta">Per entry average</span>
          </article>

          <article className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">LARGEST EXPENSE</span>
            </div>
            <strong>{formatPeso(expenseMetrics.highest)}</strong>
            <span className="stat-meta">
              {expenseMetrics.highestEntry
                ? expenseMetrics.highestEntry.expenseDate
                : "No entries recorded"}
            </span>
          </article>
        </section>

        {/* Expense Ledger */}
        <section
          className="records-card finance-ledger-card"
          aria-label="Company expense ledger"
        >
          <div className="records-heading">
            <div>
              <h2>Expense Ledger</h2>
            </div>
            <span className="ledger-total-badge">
              {filteredAndSortedExpenses.length} of {expenses.length} records
            </span>
          </div>

          <div className="filters" aria-label="Filter company expenses">
            <label
              className="search-box"
              title="Search expenses by description, note, user, date, or amount"
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
              {searchQuery ? (
                <button
                  type="button"
                  className="search-clear-btn"
                  aria-label="Clear search query"
                  title="Clear search"
                  onClick={() => {
                    setSearchQuery("");
                    setPage(1);
                  }}
                >
                  ×
                </button>
              ) : null}
            </label>

            <GlobalDateRangePicker />

            {hasActiveFilters ? (
              <button
                type="button"
                className="secondary-button filter-clear-action-btn"
                onClick={clearFilters}
                title="Reset all active filters"
              >
                Clear Filters
              </button>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <div className="active-filter-chips" aria-label="Active filters">
              <span className="filter-chips-label">Filtered by:</span>
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
              {range.startDate || range.endDate ? (
                <span className="filter-chip">
                  <span className="filter-chip-category">Date:</span>{" "}
                  {formatDateRange(range)}
                  <button
                    type="button"
                    className="filter-chip-remove"
                    aria-label="Remove date range filter"
                    onClick={() => {
                      setRange({ startDate: null, endDate: null });
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

          {loading ? (
            <div className="empty-state" role="status">
              <strong>Loading expense ledger…</strong>
              <span>Retrieving company operating expense records.</span>
            </div>
          ) : filteredAndSortedExpenses.length === 0 ? (
            <div className="empty-state">
              <strong>
                {expenses.length === 0
                  ? "No company expenses recorded yet"
                  : "No expenses match the active filters"}
              </strong>
              <span>
                {expenses.length === 0
                  ? canManage
                    ? "Use + Record Expense to add the first company operating expense."
                    : "No company operating expenses have been recorded yet."
                  : "Try clearing the search query or selecting All Dates."}
              </span>
            </div>
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
                    <th>Note / Reference</th>
                    <th>Recorded By</th>
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
                    {canManage ? (
                      <th style={{ width: "48px", textAlign: "right" }}>
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.map((exp, expIndex) => (
                    <tr
                      key={exp.id}
                      style={{
                        position: "relative",
                        zIndex: openActionExpenseId === exp.id ? 150 : undefined,
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
                        <strong>{formatPeso(exp.amount)}</strong>
                      </td>
                      {canManage ? (
                        <td style={{ textAlign: "right" }}>
                          <div
                            className="table-row-actions"
                            style={{ position: "relative", display: "inline-block" }}
                          >
                            <button
                              type="button"
                              className="row-action-more-btn"
                              aria-label={`More actions for ${exp.description || "Total Company Expenses"}`}
                              title="More actions"
                              aria-haspopup="menu"
                              aria-expanded={openActionExpenseId === exp.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const spaceBelow = window.innerHeight - rect.bottom;
                                const isNearBottom =
                                  spaceBelow < 200 ||
                                  expIndex >= paginatedExpenses.length - 2;
                                setActionMenuOpensAbove(isNearBottom);
                                setOpenActionExpenseId((curr) =>
                                  curr === exp.id ? null : exp.id,
                                );
                              }}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <circle cx="8" cy="3" r="1.5" />
                                <circle cx="8" cy="8" r="1.5" />
                                <circle cx="8" cy="13" r="1.5" />
                              </svg>
                            </button>

                            {openActionExpenseId === exp.id ? (
                              <div
                                className={`row-action-menu${actionMenuOpensAbove ? " opens-above" : ""}`}
                                role="menu"
                                aria-label={`Actions for ${exp.description || "Total Company Expenses"}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenActionExpenseId(null);
                                    setEditingExpense(exp);
                                  }}
                                >
                                  Edit Expense
                                </button>
                                <div
                                  className="row-action-menu-divider"
                                  role="separator"
                                />
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="row-action-menu-danger"
                                  onClick={() => {
                                    setOpenActionExpenseId(null);
                                    setDeleteError(null);
                                    setDeletingExpense(exp);
                                  }}
                                >
                                  Delete Expense
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="finance-ledger-tfoot-row">
                    <td colSpan={4}>
                      Filtered Total ({filteredAndSortedExpenses.length}{" "}
                      {filteredAndSortedExpenses.length === 1
                        ? "entry"
                        : "entries"}
                      )
                    </td>
                    <td className="money">
                      <strong>
                        {formatPeso(
                          filteredAndSortedExpenses.reduce(
                            (s, e) => s + e.amount,
                            0,
                          ),
                        )}
                      </strong>
                    </td>
                    {canManage ? <td /> : null}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <TablePagination
            page={page}
            pageCount={pageCount}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            loading={loading}
            itemLabel="expenses"
            itemCountInPage={paginatedExpenses.length}
          />
        </section>
      </div>

      {/* Record Expense Modal */}
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
                    <h2 id="record-expense-modal-title">Record Expense</h2>
                  </div>
                  <button
                    type="button"
                    className="routex-dialog-close"
                    aria-label="Close record expense modal"
                    title="Close dialog (Esc)"
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
                        placeholder="Total Company Expenses"
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
                        placeholder="e.g. Utilities, office supplies, invoice #"
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
                      {submitting ? "Saving…" : "Record Expense"}
                    </button>
                  </footer>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

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
