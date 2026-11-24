"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  type CompanyExpense,
  type FinanceTransactionType,
  type ValidatedCompanyExpense,
  validateCompanyExpenseInput,
} from "@/features/finance/company-expense-domain";
import {
  handlePositiveDecimalKeyDown,
  sanitizePositiveDecimalInput,
} from "@/features/deliveries/delivery-input-utils";
import { SingleDatePicker } from "@/components/single-date-picker";

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
  const [transactionType, setTransactionType] = useState<FinanceTransactionType>("Outgoing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (expense) {
      setDescription(expense.description || (expense.transactionType === "Incoming" ? "Total Company Income" : "Total Company Expenses"));
      setAmount(expense.amount.toString());
      setExpenseDate(expense.expenseDate);
      setNotes(expense.notes || "");
      setTransactionType(expense.transactionType || "Outgoing");
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

  useEffect(() => {
    if (!expense) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [expense]);

  if (!expense || typeof document === "undefined") return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateCompanyExpenseInput({
      description,
      amount,
      expenseDate,
      category: transactionType === "Incoming" ? "Company Income" : "Company Expenses",
      notes,
      transactionType,
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
            <h2 id="edit-expense-modal-title">
              {transactionType === "Incoming" ? "Edit Company Income" : "Edit Company Expense"}
            </h2>
          </div>
          <button
            type="button"
            className="routex-dialog-close"
            aria-label="Close edit modal"
            title="Close (Esc)"
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

            {/* Type Switcher */}
            <div className="finance-type-toggle-group" style={{ marginBottom: "14px" }}>
              <button
                type="button"
                className={`finance-type-toggle-btn${transactionType === "Incoming" ? " active income" : ""}`}
                onClick={() => setTransactionType("Incoming")}
                disabled={pending}
              >
                + Company Income
              </button>
              <button
                type="button"
                className={`finance-type-toggle-btn${transactionType === "Outgoing" ? " active expense" : ""}`}
                onClick={() => setTransactionType("Outgoing")}
                disabled={pending}
              >
                - Company Expense
              </button>
            </div>

            <div className="routex-dialog-grid-2">
              <div className="routex-dialog-field">
                <label htmlFor="edit-expense-amount">
                  Amount (₱) <span className="required-asterisk" aria-hidden="true">*</span>
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
                  Date <span className="required-asterisk" aria-hidden="true">*</span>
                </label>
                <SingleDatePicker
                  id="edit-expense-date"
                  min="2024-01-01"
                  value={expenseDate}
                  onChange={(val) => setExpenseDate(val)}
                  ariaLabel="Select transaction date"
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
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-action-button"
              disabled={pending}
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
