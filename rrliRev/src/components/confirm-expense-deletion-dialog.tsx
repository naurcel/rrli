"use client";

import { useState } from "react";
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
      <div className="routex-dialog" style={{ maxWidth: "460px" }}>
        <header className="routex-dialog-header" style={{ flexShrink: 0 }}>
          <div>
            <h2 id="delete-expense-dialog-title" style={{ fontSize: "17px", color: "var(--color-danger, #dc2626)" }}>
              Confirm Expense Deletion
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "11px" }}>Action is audited and permanently logged.</p>
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

        <div className="routex-dialog-body" style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {error ? (
            <div className="notice" role="alert">
              <span className="notice-icon" aria-hidden="true">!</span>
              <div>
                <strong>Error:</strong>
                <span>{error}</span>
              </div>
            </div>
          ) : null}

          <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--color-text-primary)" }}>
            Are you sure you want to delete this company operating expense?
          </p>

          <div className="delete-delivery-summary">
            <div>
              <span>Description</span>
              <strong>{expense.description}</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong style={{ color: "var(--color-accent, #d97706)" }}>{formatPeso(expense.amount)}</strong>
            </div>
            <div>
              <span>Expense Date</span>
              <strong>{expense.expenseDate}</strong>
            </div>
            <div>
              <span>Category</span>
              <strong>{expense.category}</strong>
            </div>
          </div>

          <div>
            <label htmlFor="delete-expense-reason" style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "4px" }}>
              Deletion Reason (Audited):
            </label>
            <input
              id="delete-expense-reason"
              type="text"
              placeholder="e.g. Duplicate entry, incorrect receipt, voided transaction..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: "12px",
                borderRadius: "6px",
                border: "1px solid var(--color-border, #d1d5db)",
                background: "var(--color-surface, #ffffff)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>

          <div className="delete-delivery-warning">
            <strong>Warning:</strong> Deleting this expense permanently removes it from company financial records.
          </div>
        </div>

        <footer className="routex-dialog-footer" style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: "10px" }}>
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
            {pending ? "Deleting…" : "Confirm Delete"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
