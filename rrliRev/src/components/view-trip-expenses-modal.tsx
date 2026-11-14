"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import type { DeliveryTripRecord } from "@/features/deliveries/delivery-domain";
import { formatPeso } from "@/lib/format";

export function ViewTripExpensesModal<T extends DeliveryTripRecord = DeliveryTripRecord>({
  trip,
  onClose,
  onViewDelivery,
}: {
  trip: T | null;
  onClose: () => void;
  onViewDelivery?: (trip: T) => void;
}) {
  useEffect(() => {
    if (!trip) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [trip, onClose]);

  useEffect(() => {
    if (!trip) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [trip]);

  if (!trip || typeof document === "undefined") return null;

  const isComplete = trip.totalExpenses != null && trip.financialIntegrityIssues.length === 0;

  const crewCompensation =
    (trip.expenses.driverDailyRate ?? 0) +
    (trip.expenses.driverAllowance ?? 0) +
    (trip.expenses.helperDailyRate ?? 0) +
    (trip.expenses.helperAllowance ?? 0);

  return createPortal(
    <div
      className="routex-dialog-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-trip-expenses-title"
      style={{ zIndex: 1000 }}
    >
      <div className="routex-dialog-backdrop" onClick={onClose} />
      <div
        className="routex-dialog trip-expenses-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "580px", width: "95%" }}
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
              <span>Waybill #{trip.waybillNumber}</span>
              <span>·</span>
              <span>{trip.clientName}</span>
            </div>
            <h2 id="view-trip-expenses-title" style={{ margin: 0, fontSize: "18px", fontWeight: 750 }}>
              Trip Expenses Breakdown
            </h2>
          </div>
          <button
            type="button"
            className="routex-dialog-close"
            aria-label="Close trip expenses details"
            title="Close dialog (Esc)"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="routex-dialog-body" style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Total Hero Card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderRadius: "14px",
              background: isComplete
                ? "linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%)"
                : "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%)",
              border: `1px solid ${isComplete ? "rgba(217, 119, 6, 0.22)" : "rgba(239, 68, 68, 0.25)"}`,
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
                Total Trip Expenses
              </span>
              <strong
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  color: isComplete ? "var(--color-accent-deep)" : "var(--color-danger, #dc2626)",
                }}
              >
                {trip.totalExpenses != null ? formatPeso(trip.totalExpenses) : "Incomplete"}
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
                  background: isComplete ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  color: isComplete ? "#059669" : "#dc2626",
                  border: `1px solid ${isComplete ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                }}
              >
                {isComplete ? "Finalized" : "Pending Verification"}
              </span>
            </div>
          </div>

          {/* Incomplete warning if needed */}
          {!isComplete && trip.financialIntegrityIssues.length > 0 && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(217, 119, 6, 0.08)",
                border: "1px solid rgba(217, 119, 6, 0.22)",
                fontSize: "11.5px",
                color: "var(--color-text-secondary)",
              }}
            >
              <strong>Incomplete expenses:</strong> {trip.financialIntegrityIssues.join(", ")}.
            </div>
          )}

          {/* Itemized Expenses List */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "14px 16px",
              borderRadius: "12px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: "8px",
                borderBottom: "1px solid var(--color-border)",
                fontSize: "11px",
                fontWeight: 750,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              <span>Expense Category</span>
              <span>Amount</span>
            </div>

            {/* Diesel Fuel */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
              <div>
                <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>Diesel Fuel</strong>
                <span style={{ display: "block", fontSize: "10.5px", color: "var(--color-text-muted)" }}>
                  Transit fuel consumption
                </span>
              </div>
              <strong style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                {trip.expenses.dieselExpenses != null ? formatPeso(trip.expenses.dieselExpenses) : "Incomplete"}
              </strong>
            </div>

            {/* Highway Tolls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
              <div>
                <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>Highway Tolls</strong>
                <span style={{ display: "block", fontSize: "10.5px", color: "var(--color-text-muted)" }}>
                  {trip.expenses.tollGateBreakdown || "Expressway toll fees"}
                </span>
              </div>
              <strong style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                {trip.expenses.tollGateExpenses != null ? formatPeso(trip.expenses.tollGateExpenses) : "Incomplete"}
              </strong>
            </div>

            {/* Store Entry Fees */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
              <div>
                <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>Store Entry Fees</strong>
                <span style={{ display: "block", fontSize: "10.5px", color: "var(--color-text-muted)" }}>
                  {trip.dropoffs.length} {trip.dropoffs.length === 1 ? "drop-off stop" : "drop-off stops"}
                </span>
              </div>
              <strong style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                {trip.expenses.entryFees != null ? formatPeso(trip.expenses.entryFees) : formatPeso(0)}
              </strong>
            </div>

            {/* Crew Compensation */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
              <div>
                <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>Crew Compensation</strong>
                <span style={{ display: "block", fontSize: "10.5px", color: "var(--color-text-muted)" }}>
                  Driver (rate + allowance) &amp; helpers
                </span>
              </div>
              <strong style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                {formatPeso(crewCompensation)}
              </strong>
            </div>

            {/* Other Expenses */}
            {(trip.expenses.otherExpenses ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                <div>
                  <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>Other Expenses</strong>
                  <span style={{ display: "block", fontSize: "10.5px", color: "var(--color-text-muted)" }}>
                    Incidental, parking, permits
                  </span>
                </div>
                <strong style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                  {formatPeso(trip.expenses.otherExpenses)}
                </strong>
              </div>
            )}
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
            {onViewDelivery ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => onViewDelivery(trip)}
              >
                Full Delivery Details →
              </button>
            ) : null}
          </div>

          <div>
            <button
              type="button"
              className="primary-action-button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
