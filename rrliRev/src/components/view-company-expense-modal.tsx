"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import type { CompanyExpense } from "@/features/finance/company-expense-domain";
import { formatPeso } from "@/lib/format";

export function ViewCompanyExpenseModal({
  expense,
  canManage,
  onClose,
  onEdit,
  onDelete,
}: {
  expense: CompanyExpense | null;
  canManage: boolean;
  onClose: () => void;
  onEdit?: (expense: CompanyExpense) => void;
  onDelete?: (expense: CompanyExpense) => void;
}) {
  useEffect(() => {
    if (!expense) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expense, onClose]);

  useEffect(() => {
    if (!expense) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [expense]);

  if (!expense || typeof document === "undefined") return null;

  const formattedDate = new Date(expense.expenseDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedCreated = new Date(expense.createdAt).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedUpdated = expense.updatedAt
    ? new Date(expense.updatedAt).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const actorUsername = expense.createdBy?.startsWith("@")
    ? expense.createdBy
    : `@${expense.createdBy || "system"}`;

  return createPortal(
    <div
      className="routex-dialog-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-expense-dialog-title"
      style={{ zIndex: 1000 }}
    >
      <div className="routex-dialog-backdrop" onClick={onClose} />
      <div
        className="routex-dialog finance-expense-dialog view-expense-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "560px", width: "95%" }}
      >
        <header className="routex-dialog-header">
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--color-accent-deep)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "4px",
              }}
            >
              <span>Company Operating Expense</span>
            </div>
            <h2 id="view-expense-dialog-title" style={{ margin: 0, fontSize: "18px", fontWeight: 750 }}>
              {expense.description || "Total Company Expenses"}
            </h2>
          </div>
          <button
            type="button"
            className="routex-dialog-close"
            aria-label="Close expense details"
            title="Close dialog (Esc)"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="routex-dialog-body" style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Amount and Category Hero Card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%)",
              border: "1px solid rgba(217, 119, 6, 0.22)",
            }}
          >
            <div>
              <span
                style={{
                  display: "block",
                  fontSize: "10.5px",
                  fontWeight: 750,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--color-text-secondary)",
                  marginBottom: "4px",
                }}
              >
                Recorded Expense Amount
              </span>
              <strong style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-accent-deep)" }}>
                {formatPeso(expense.amount)}
              </strong>
            </div>

            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              >
                {expense.category || "Company Expenses"}
              </span>
            </div>
          </div>

          {/* Metadata Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "12px",
              padding: "14px 16px",
              borderRadius: "12px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div>
              <span style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "3px" }}>
                Expense Date
              </span>
              <strong style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                {formattedDate}
              </strong>
            </div>

            <div>
              <span style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "3px" }}>
                Recorded By
              </span>
              <strong style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                {actorUsername}
              </strong>
            </div>

            <div>
              <span style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "3px" }}>
                Created At
              </span>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {formattedCreated}
              </span>
            </div>

            {formattedUpdated && (
              <div>
                <span style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "3px" }}>
                  Last Modified
                </span>
                <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  {formattedUpdated}
                </span>
              </div>
            )}
          </div>

          {/* Notes & References */}
          <div>
            <span
              style={{
                display: "block",
                fontSize: "10.5px",
                fontWeight: 750,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--color-text-secondary)",
                marginBottom: "6px",
              }}
            >
              Notes &amp; Reference
            </span>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                fontSize: "12.5px",
                lineHeight: 1.5,
                color: expense.notes ? "var(--color-text-primary)" : "var(--color-text-muted)",
                whiteSpace: "pre-wrap",
                minHeight: "48px",
              }}
            >
              {expense.notes || "No additional reference notes recorded."}
            </div>
          </div>
        </div>

        <footer
          className="routex-dialog-footer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 24px 18px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <div>
            {canManage && onDelete ? (
              <button
                type="button"
                className="secondary-button"
                style={{
                  color: "var(--color-danger, #dc2626)",
                  borderColor: "rgba(220, 38, 38, 0.25)",
                }}
                onClick={() => onDelete(expense)}
              >
                Delete Expense
              </button>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Close
            </button>
            {canManage && onEdit ? (
              <button
                type="button"
                className="primary-action-button"
                onClick={() => onEdit(expense)}
              >
                Edit Expense
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
