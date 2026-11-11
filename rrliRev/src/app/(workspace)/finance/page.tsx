"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { ConfirmExpenseDeletionDialog } from "@/components/confirm-expense-deletion-dialog";
import {
  toDateKey,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { EditCompanyExpenseModal } from "@/components/edit-company-expense-modal";
import { OperationalTopbar } from "@/components/operational-topbar";
import { TablePagination } from "@/components/table-pagination";
import {
  BROWSER_PREVIEW_DELIVERIES_CHANGED,
  readBrowserPreviewDeliveries,
} from "@/features/deliveries/browser-preview-deliveries";
import {
  calculateProfitMargin,
  isDeliveryFinanciallyComplete,
} from "@/features/deliveries/delivery-domain";
import {
  deleteBrowserPreviewExpense,
  readBrowserPreviewExpenses,
  ROUTEX_COMPANY_EXPENSES_CHANGED,
  upsertBrowserPreviewExpense,
} from "@/features/finance/browser-preview-expenses";
import {
  calculateCompanyProfitability,
  filterExpensesByDateRange,
  type CompanyExpense,
  type ValidatedCompanyExpense,
  validateCompanyExpenseInput,
} from "@/features/finance/company-expense-domain";
import { canManageCompanyExpenses } from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";

const PAGE_SIZE = 10;

export default function FinancePage() {
  const actor = useAuthenticatedActor();
  const canManage = canManageCompanyExpenses(actor.role);
  const { range } = useGlobalDateRange();

  // Company expenses state
  const [expenses, setExpenses] = useState<CompanyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New expense form state (clean & direct: amount + date + optional note)
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(() => toDateKey(new Date()));
  const [newNotes, setNewNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Table filtering & sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"date" | "amount">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // Edit & Delete dialog states
  const [editingExpense, setEditingExpense] = useState<CompanyExpense | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<CompanyExpense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Deliveries data for overall company net profit calculation
  const [deliveryRevenue, setDeliveryRevenue] = useState(0);
  const [deliveryExpenses, setDeliveryExpenses] = useState(0);

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

    // Browser preview mode fallback
    const previewExpenses = readBrowserPreviewExpenses();
    setExpenses(previewExpenses);
    setLoading(false);
  }, []);

  // Compute delivery totals matching the active date range
  const loadDeliveryTotals = useCallback(() => {
    const allDeliveries = readBrowserPreviewDeliveries();
    const dateFiltered = allDeliveries.filter((d) => {
      if (range.startDate && d.deliveryDate < toDateKey(range.startDate)) return false;
      if (range.endDate && d.deliveryDate > toDateKey(range.endDate)) return false;
      return true;
    });

    const finalized = dateFiltered.filter(isDeliveryFinanciallyComplete);
    const rev = finalized.reduce((sum, d) => sum + (d.deliveryRate ?? 0), 0);
    const exp = finalized.reduce((sum, d) => sum + (d.totalExpenses ?? 0), 0);

    setDeliveryRevenue(rev);
    setDeliveryExpenses(exp);
  }, [range.startDate, range.endDate]);

  useEffect(() => {
    loadExpenses();
    loadDeliveryTotals();
  }, [loadExpenses, loadDeliveryTotals]);

  // Reactive listeners for cross-tab or cross-component events
  useEffect(() => {
    const handleExpenseChange = () => {
      const preview = readBrowserPreviewExpenses();
      setExpenses(preview);
    };

    const handleDeliveryChange = () => {
      loadDeliveryTotals();
    };

    window.addEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, handleExpenseChange);
    window.addEventListener(BROWSER_PREVIEW_DELIVERIES_CHANGED, handleDeliveryChange);

    return () => {
      window.removeEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, handleExpenseChange);
      window.removeEventListener(BROWSER_PREVIEW_DELIVERIES_CHANGED, handleDeliveryChange);
    };
  }, [loadDeliveryTotals]);

  // Filter expenses by global date range
  const dateFilteredExpenses = useMemo(() => {
    return filterExpensesByDateRange(
      expenses,
      range.startDate ? toDateKey(range.startDate) : null,
      range.endDate ? toDateKey(range.endDate) : null,
    );
  }, [expenses, range.startDate, range.endDate]);

  // Overall Company Profitability calculation
  const companyProfitability = useMemo(() => {
    const totalCompanyExpenses = dateFilteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    return calculateCompanyProfitability({
      deliveryRevenue,
      deliveryExpenses,
      companyExpenses: totalCompanyExpenses,
    });
  }, [deliveryRevenue, deliveryExpenses, dateFilteredExpenses]);

  // Table filtering & sorting
  const filteredAndSortedExpenses = useMemo(() => {
    let result = [...dateFilteredExpenses];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q)) ||
          e.expenseDate.includes(q),
      );
    }

    result.sort((a, b) => {
      let comp = 0;
      if (sortField === "date") {
        comp = a.expenseDate.localeCompare(b.expenseDate);
      } else {
        comp = a.amount - b.amount;
      }
      return sortDirection === "asc" ? comp : -comp;
    });

    return result;
  }, [dateFilteredExpenses, searchQuery, sortField, sortDirection]);

  // Pagination calculation
  const totalItems = filteredAndSortedExpenses.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const paginatedExpenses = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAndSortedExpenses.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedExpenses, page]);

  // Handle new expense submission
  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    const validation = validateCompanyExpenseInput({
      description: newNotes ? `Company Expenses - ${newNotes}` : "Total Company Expenses",
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
          setExpenses((prev) => [data.expense, ...prev.filter((item) => item.id !== data.expense.id)]);
          setNewAmount("");
          setNewNotes("");
          setFormSuccess(`Recorded ₱${validation.data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} company expenses.`);
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
    setNewAmount("");
    setNewNotes("");
    setFormSuccess(`Recorded ₱${validation.data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} company expenses.`);
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
          setExpenses((prev) => prev.map((e) => (e.id === id ? resData.expense : e)));
          setEditingExpense(null);
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
    setIsDeleting(false);
  }

  function toggleSort(field: "date" | "amount") {
    if (sortField === field) {
      setSortDirection((curr) => (curr === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "amount" || field === "date" ? "desc" : "asc");
    }
    setPage(1);
  }

  return (
    <>
      <OperationalTopbar contextLabel="Finance" />

      <div className="content-wrap finance-page">
        <header className="page-intro">
          <div>
            <h1>Finance</h1>
            <p className="subtitle">
              Company expense ledger and profitability.
            </p>
          </div>
        </header>

        {/* Top KPI Cards Summary */}
        <section
          className="dashboard-kpi-grid"
          aria-label="Company financial overview"
          style={{ marginBottom: "20px" }}
        >
          {/* Card 1: Company Expenses */}
          <article className="stat-card" style={{ borderColor: "rgba(217, 119, 6, 0.25)" }}>
            <span className="stat-label">TOTAL COMPANY EXPENSES</span>
            <strong style={{ color: "var(--color-accent-deep, #92400e)" }}>
              {formatPeso(companyProfitability.companyExpenses)}
            </strong>
            <span className="stat-meta">
              {dateFilteredExpenses.length} {dateFilteredExpenses.length === 1 ? "record" : "records"} in selected period
            </span>
          </article>

          {/* Card 2: Company Net Profit */}
          <article className="stat-card" style={{ borderColor: companyProfitability.companyNetProfit >= 0 ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)" }}>
            <span className="stat-label">COMPANY NET PROFIT</span>
            <strong className={companyProfitability.companyNetProfit >= 0 ? undefined : "warning"}>
              {formatPeso(companyProfitability.companyNetProfit)}
            </strong>
            <span className={`stat-meta ${companyProfitability.companyNetProfit >= 0 ? "positive" : "warning"}`}>
              {companyProfitability.companyProfitMargin !== null
                ? `${formatPercent(companyProfitability.companyProfitMargin)} overall profit margin`
                : "After delivery and company expenses"}
            </span>
          </article>

          {/* Card 3: Delivery Revenue */}
          <article className="stat-card">
            <span className="stat-label">DELIVERY REVENUE</span>
            <strong>{formatPeso(companyProfitability.deliveryRevenue)}</strong>
            <span className="stat-meta positive">
              From confirmed operational deliveries
            </span>
          </article>

          {/* Card 4: Delivery Expenses */}
          <article className="stat-card">
            <span className="stat-label">DELIVERY EXPENSES</span>
            <strong>{formatPeso(companyProfitability.deliveryExpenses)}</strong>
            <span className="stat-meta">
              Fuel, highway tolls, entry fees &amp; crew compensation
            </span>
          </article>
        </section>

        {/* Clean, Centered Expense Input Area */}
        {canManage ? (
          <section
            className="records-card finance-entry-card"
            aria-label="Input total company expenses"
            style={{
              maxWidth: "540px",
              margin: "0 auto 28px",
              padding: "24px 28px",
              border: "1px solid var(--color-border-subtle, rgba(0,0,0,0.08))",
              boxShadow: "0 4px 16px -2px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 750, color: "var(--color-text-primary)" }}>
                Company Expenses
              </h2>
            </div>

            {formError ? (
              <div className="notice" role="alert" style={{ marginBottom: "16px" }}>
                <span className="notice-icon" aria-hidden="true">!</span>
                <div>
                  <strong>Validation Notice:</strong>
                  <span>{formError}</span>
                </div>
              </div>
            ) : null}

            {formSuccess ? (
              <div className="notice" role="status" style={{ marginBottom: "16px", borderColor: "rgba(16, 185, 129, 0.3)", background: "rgba(16, 185, 129, 0.08)" }}>
                <span className="notice-icon" aria-hidden="true" style={{ background: "#10b981" }}>✓</span>
                <div>
                  <strong style={{ color: "#047857" }}>Saved:</strong>
                  <span style={{ color: "#065f46" }}>{formSuccess}</span>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleCreateExpense}>
              {/* Visually Centered Hero Amount Input */}
              <div
                className="finance-amount-hero-box"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "18px 20px",
                  background: "var(--color-surface-subtle, rgba(0, 0, 0, 0.02))",
                  border: "1px solid var(--color-border, #e5e7eb)",
                  borderRadius: "10px",
                  marginBottom: "16px",
                }}
              >
                <label htmlFor="new-expense-amount" style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", marginBottom: "6px" }}>
                  Amount (₱ PHP)
                </label>
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: "340px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--color-accent, #d97706)", marginRight: "6px" }} aria-hidden="true">
                    ₱
                  </span>
                  <input
                    id="new-expense-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    disabled={submitting}
                    required
                    style={{
                      width: "100%",
                      fontSize: "26px",
                      fontWeight: 800,
                      textAlign: "center",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: "var(--color-text-primary)",
                      letterSpacing: "-0.02em",
                    }}
                  />
                </div>
              </div>

              {/* Date & Note Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
                <div>
                  <label htmlFor="new-expense-date" className="field-label-text">
                    Date <span style={{ color: "var(--color-danger, #dc2626)" }}>*</span>
                  </label>
                  <input
                    id="new-expense-date"
                    type="date"
                    min="2024-01-01"
                    className="delivery-input"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    disabled={submitting}
                    required
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>

                <div>
                  <label htmlFor="new-expense-notes" className="field-label-text">
                    Note / Reference <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>(Optional)</span>
                  </label>
                  <input
                    id="new-expense-notes"
                    type="text"
                    className="delivery-input"
                    placeholder="e.g. November total expenses"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    disabled={submitting}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>
              </div>

              {/* Submit Action */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={submitting}
                  style={{ minWidth: "220px", padding: "11px 24px", fontSize: "13px" }}
                >
                  {submitting ? "Saving…" : "Save Total Company Expenses"}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <div
            className="notice"
            role="status"
            style={{
              maxWidth: "540px",
              margin: "0 auto 28px",
              background: "var(--color-surface-subtle, rgba(0,0,0,0.03))",
              borderColor: "var(--color-border-subtle, rgba(0,0,0,0.1))",
            }}
          >
            <span className="notice-icon" aria-hidden="true">i</span>
            <div>
              <strong>View-Only Access:</strong>
              <span>Company operating expenses are managed by Operations and Admin personnel.</span>
            </div>
          </div>
        )}

        {/* Expense Records Ledger (Clean & Minimal: Date, Amount, Note, Recorded By, Actions) */}
        <section className={`records-card${loading ? " is-loading" : ""}`} aria-label="Company expenses ledger">
          <div className="records-heading">
            <div className="records-heading-copy">
              <h2>Expense Ledger</h2>
            </div>
          </div>

          {/* Search Toolbar */}
          <div className="filters">
            <label className="search-box">
              <span className="sr-only">Search notes or dates</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Search notes or dates…"
                aria-label="Search company expenses"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>

            {searchQuery ? (
              <button
                type="button"
                className="filter-button filter-clear"
                onClick={() => {
                  setSearchQuery("");
                  setPage(1);
                }}
              >
                Clear
              </button>
            ) : null}
          </div>

          {/* Table */}
          {error ? (
            <div className="empty-state" role="alert">
              <strong>Finance database is unavailable</strong>
              <span>{error}</span>
            </div>
          ) : loading ? (
            <div className="empty-state" role="status">
              <strong>Loading company expense ledger…</strong>
              <span>Retrieving operating expense records.</span>
            </div>
          ) : paginatedExpenses.length === 0 ? (
            <div className="empty-state">
              <strong>No company expenses recorded</strong>
              <span>
                {searchQuery
                  ? "Try adjusting your search criteria."
                  : "No operating expenses recorded for this date range."}
              </span>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th
                      style={{ cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("date")}
                      title="Click to sort by date"
                    >
                      Date {sortField === "date" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                    </th>
                    <th
                      style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("amount")}
                      title="Click to sort by amount"
                    >
                      Total Amount (₱) {sortField === "amount" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                    </th>
                    <th>Note / Reference</th>
                    <th>Recorded By</th>
                    {canManage ? <th style={{ textAlign: "center", width: "90px" }}>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.map((exp) => (
                    <tr key={exp.id} className="record-row">
                      <td className="cell-date">
                        <span className="date-main">{exp.expenseDate}</span>
                      </td>
                      <td className="money" style={{ textAlign: "right", fontWeight: 700, color: "var(--color-accent-deep, #92400e)" }}>
                        {formatPeso(exp.amount)}
                      </td>
                      <td style={{ color: exp.notes ? "var(--color-text-secondary)" : "var(--color-text-muted)" }}>
                        {exp.notes || exp.description || "—"}
                      </td>
                      <td style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                        {exp.createdBy || "operations"}
                      </td>
                      {canManage ? (
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              type="button"
                              className="icon-only-action compact ui-tooltip"
                              aria-label="Edit expense amount"
                              title="Edit expense amount"
                              onClick={() => setEditingExpense(exp)}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="icon-only-action compact danger ui-tooltip"
                              aria-label="Delete expense record"
                              title="Delete expense record"
                              onClick={() => {
                                setDeleteError(null);
                                setDeletingExpense(exp);
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination (Strictly 10 records per page per Rule 3D) */}
          {totalItems > 0 ? (
            <TablePagination
              page={page}
              pageCount={pageCount}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="company expenses"
              itemCountInPage={paginatedExpenses.length}
            />
          ) : null}
        </section>
      </div>

      {/* Edit Expense Modal */}
      {editingExpense ? (
        <EditCompanyExpenseModal
          expense={editingExpense}
          pending={isSavingEdit}
          onClose={() => setEditingExpense(null)}
          onSave={handleSaveEdit}
        />
      ) : null}

      {/* Delete Confirmation Dialog */}
      {deletingExpense ? (
        <ConfirmExpenseDeletionDialog
          expense={deletingExpense}
          pending={isDeleting}
          error={deleteError}
          onCancel={() => setDeletingExpense(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </>
  );
}
