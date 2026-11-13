"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { CompanyExpense } from "@/features/finance/company-expense-domain";
import { formatPeso } from "@/lib/format";

export function ConfirmExpenseDeletionDialog({
  expense,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  expense: CompanyExpense | null;
  pending: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (expense) {
      setReason("");
    }
  }, [expense]);

  useEffect(() => {
    if (!expense) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expense, pending, onCancel]);

  if (!expense || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="routex-dialog-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-expense-dialog-title"
      style={{ zIndex: 1000 }}
    >
      <div className="routex-dialog-backdrop" onClick={() => !pending && onCancel()} />
      <div
        className="routex-dialog finance-expense-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="routex-dialog-header">
          <div>
            <h2
              id="delete-expense-dialog-title"
              style={{ fontSize: "17px", color: "var(--color-danger, #dc2626)", background: "none", WebkitTextFillColor: "var(--color-danger, #dc2626)" }}
            >
              Delete Expense
            </h2>
          </div>
          <button
            type="button"
            className="routex-dialog-close"
            aria-label="Close confirmation dialog"
            title="Close confirmation dialog (Esc)"
            disabled={pending}
            onClick={onCancel}
          >
            ×
          </button>
        </header>

        <div className="routex-dialog-body finance-expense-dialog-body">
          {error ? (
            <div className="delivery-form-alert" role="alert">
              {error}
            </div>
          ) : null}

          <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--color-text-primary)" }}>
            Delete <strong>{expense.description || "Total Company Expenses"}</strong> ({formatPeso(expense.amount)})?
          </p>

          <div className="delete-delivery-summary">
            <div>
              <span>Date</span>
              <strong>{expense.expenseDate}</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong>{formatPeso(expense.amount)}</strong>
            </div>
            <div>
              <span>Recorded By</span>
              <strong>{expense.createdBy || "system"}</strong>
            </div>
            <div>
              <span>Note</span>
              <strong>{expense.notes || "—"}</strong>
            </div>
          </div>

          <div className="routex-dialog-field">
            <label htmlFor="delete-expense-reason">
              Reason <span className="field-required-tag">(Optional)</span>
            </label>
            <input
              id="delete-expense-reason"
              type="text"
              placeholder="e.g. Duplicate entry, incorrect amount"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>

        <footer className="routex-dialog-footer">
          <button
            type="button"
            className="secondary-button"
            disabled={pending}
            onClick={onCancel}
            title="Cancel deletion and close dialog"
          >
            Cancel
          </button>
          <button
            type="button"
            className="danger-confirm-button"
            disabled={pending}
            onClick={() => onConfirm(reason)}
            title="Permanently delete this company expense"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
