"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  type CompanyExpense,
  type ValidatedCompanyExpense,
  validateCompanyExpenseInput,
} from "@/features/finance/company-expense-domain";
import {
  handlePositiveDecimalKeyDown,
  sanitizePositiveDecimalInput,
} from "@/features/deliveries/delivery-input-utils";

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

  useEffect(() => {
    if (!expense) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expense, pending, onClose]);

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
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save company expense changes.",
      );
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
      <div
        className="routex-dialog finance-expense-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="routex-dialog-header">
          <div>
            <h2 id="edit-expense-modal-title">Edit Expense</h2>
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
          <div className="routex-dialog-body finance-expense-dialog-body">
            {errorMessage ? (
              <div className="delivery-form-alert" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <div className="routex-dialog-grid-2">
              <div className="routex-dialog-field">
                <label htmlFor="edit-expense-amount">
                  Amount (₱) <span className="field-required-tag">*</span>
                </label>
                <div className="peso-input-wrap">
                  <span className="peso-prefix" aria-hidden="true">
                    ₱
                  </span>
                  <input
                    id="edit-expense-amount"
                    type="text"
                    inputMode="decimal"
                    className="peso-input"
                    placeholder="0.00"
                    value={amount}
                    onKeyDown={handlePositiveDecimalKeyDown}
                    onChange={(e) => setAmount(sanitizePositiveDecimalInput(e.target.value))}
                    disabled={pending}
                    required
                  />
                </div>
              </div>

              <div className="routex-dialog-field">
                <label htmlFor="edit-expense-date">
                  Date <span className="field-required-tag">*</span>
                </label>
                <input
                  id="edit-expense-date"
                  type="date"
                  min="2024-01-01"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  disabled={pending}
                  required
                />
              </div>
            </div>

            <div className="routex-dialog-field">
              <label htmlFor="edit-expense-description">
                Description <span className="field-required-tag">(Optional)</span>
              </label>
              <input
                id="edit-expense-description"
                type="text"
                placeholder="Total Company Expenses"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={pending}
              />
            </div>

            <div className="routex-dialog-field">
              <label htmlFor="edit-expense-notes">
                Note / Reference <span className="field-required-tag">(Optional)</span>
              </label>
              <input
                id="edit-expense-notes"
                type="text"
                placeholder="e.g. Utilities, office supplies, invoice #"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          <footer className="routex-dialog-footer">
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
