"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  type CompanyExpense,
  type ValidatedCompanyExpense,
  validateCompanyExpenseInput,
} from "@/features/finance/company-expense-domain";

export function EditCompanyExpenseModal({
  expense,
  pending,
  onClose,
  onSave,
}: {
  expense: CompanyExpense | null;
  pending: boolean;
  onClose: () => void;
  onSave: (id: string, data: ValidatedCompanyExpense) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (expense) {
      setDescription(expense.description || "Total Company Expenses");
      setAmount(expense.amount.toString());
      setExpenseDate(expense.expenseDate);
      setNotes(expense.notes || "");
      setErrorMessage(null);
    }
  }, [expense]);

  if (!expense || typeof document === "undefined") return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateCompanyExpenseInput({
      description,
      amount,
      expenseDate,
      notes,
    });

    if (!validation.success) {
      setErrorMessage(validation.errors[0]);
      return;
    }

    try {
      await onSave(expense!.id, validation.data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save company expense changes.");
    }
  }

  return createPortal(
    <div
      className="routex-dialog-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-expense-modal-title"
      style={{ zIndex: 1000 }}
    >
      <div className="routex-dialog-backdrop" onClick={() => !pending && onClose()} />
      <div className="routex-dialog" style={{ maxWidth: "480px" }}>
        <header className="routex-dialog-header" style={{ flexShrink: 0 }}>
          <div>
            <h2 id="edit-expense-modal-title" style={{ fontSize: "17px" }}>
              Edit Company Expense
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--color-text-muted)" }}>
              Update company operating expense amount.
            </p>
          </div>
          <button
            type="button"
            className="routex-dialog-close"
            aria-label="Close edit modal"
            title="Close dialog (Esc)"
            disabled={pending}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="routex-dialog-body" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {errorMessage ? (
              <div className="notice" role="alert">
                <span className="notice-icon" aria-hidden="true">!</span>
                <div>
                  <strong>Validation Notice:</strong>
                  <span>{errorMessage}</span>
                </div>
              </div>
            ) : null}

            {/* Prominent Centered Amount Input */}
            <div className="finance-amount-hero-box" style={{ padding: "16px 20px", textAlign: "center" }}>
              <label htmlFor="edit-expense-amount" style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", display: "block", marginBottom: "6px" }}>
                Total Company Expenses (₱ PHP)
              </label>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: "300px" }}>
                <span style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-accent, #d97706)", marginRight: "6px" }} aria-hidden="true">
                  ₱
                </span>
                <input
                  id="edit-expense-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={pending}
                  required
                  style={{
                    width: "100%",
                    fontSize: "24px",
                    fontWeight: 800,
                    textAlign: "center",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>
            </div>

            {/* Expense Date */}
            <div>
              <label htmlFor="edit-expense-date" className="field-label-text">
                Expense Date <span style={{ color: "var(--color-danger, #dc2626)" }}>*</span>
              </label>
              <input
                id="edit-expense-date"
                type="date"
                min="2024-01-01"
                className="finance-input"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                disabled={pending}
                required
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>

            {/* Optional Notes */}
            <div>
              <label htmlFor="edit-expense-notes" className="field-label-text">
                Note / Reference <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>(Optional)</span>
              </label>
              <input
                id="edit-expense-notes"
                type="text"
                className="finance-input"
                placeholder="Optional note or reference..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
          </div>

          <footer className="routex-dialog-footer" style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              className="secondary-button"
              disabled={pending}
              onClick={onClose}
              title="Discard changes and close modal"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-action-button"
              disabled={pending}
              title="Save updated company expense"
            >
              {pending ? "Saving…" : "Save Changes"}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
