"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  type DeliveryTripRecord,
  formatFinancialIntegrityIssue,
} from "@/features/deliveries/delivery-domain";
import { formatPeso } from "@/lib/format";
import {
  computeDonutArcs,
  type ExpenseCategorySlice,
} from "@/features/deliveries/delivery-breakdown-model";

export function ViewTripExpensesModal<T extends DeliveryTripRecord = DeliveryTripRecord>({
  trip,
  onClose,
  onViewDelivery,
}: {
  trip: T | null;
  onClose: () => void;
  onViewDelivery?: (trip: T) => void;
}) {
  const [hoveredSliceId, setHoveredSliceId] = useState<string | null>(null);

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

  const crewCompensation = useMemo(() => {
    if (!trip) return 0;
    return (
      (trip.expenses.driverDailyRate ?? 0) +
      (trip.expenses.driverAllowance ?? 0) +
      (trip.expenses.helperDailyRate ?? 0) +
      (trip.expenses.helperAllowance ?? 0)
    );
  }, [trip]);

  const slices = useMemo<ExpenseCategorySlice[]>(() => {
    if (!trip) return [];
    const list: ExpenseCategorySlice[] = [];
    if (trip.expenses.dieselExpenses != null && trip.expenses.dieselExpenses > 0) {
      list.push({
        id: "diesel",
        label: "Diesel",
        amount: trip.expenses.dieselExpenses,
        color: "#f59e0b",
        status: "confirmed",
        details: "Transit fuel consumption",
      });
    }
    if (trip.expenses.tollGateExpenses != null && trip.expenses.tollGateExpenses > 0) {
      list.push({
        id: "toll",
        label: "Toll Gates",
        amount: trip.expenses.tollGateExpenses,
        color: "#6366f1",
        status: "confirmed",
        details: trip.expenses.tollGateBreakdown || "Expressway RFID passes",
      });
    }
    if (trip.expenses.entryFees != null && trip.expenses.entryFees > 0) {
      list.push({
        id: "entry",
        label: "Entry Fees",
        amount: trip.expenses.entryFees,
        color: "#10b981",
        status: "confirmed",
        details: "Mall & supermarket depot entrance charges",
      });
    }
    if (crewCompensation > 0) {
      list.push({
        id: "crew",
        label: "Crew Compensation",
        amount: crewCompensation,
        color: "#0284c7",
        status: "confirmed",
        details: "Driver & helper rates and allowances",
      });
    }
    if ((trip.expenses.otherExpenses ?? 0) > 0) {
      list.push({
        id: "other",
        label: "Other Expenses",
        amount: trip.expenses.otherExpenses ?? 0,
        color: "#8b5cf6",
        status: "confirmed",
        details: "Incidental disbursements",
      });
    }
    return list;
  }, [trip, crewCompensation]);

  const donutArcs = useMemo(() => {
    if (!trip || !trip.totalExpenses) return [];
    return computeDonutArcs(slices, trip.totalExpenses, {
      cx: 100,
      cy: 100,
      outerRadius: 80,
      innerRadius: 54,
    });
  }, [slices, trip]);

  const activeHoveredSlice = useMemo(() => {
    if (!hoveredSliceId) return null;
    return donutArcs.find((a) => a.slice.id === hoveredSliceId) ?? null;
  }, [donutArcs, hoveredSliceId]);

  if (!trip || typeof document === "undefined") return null;

  const isComplete = trip.totalExpenses != null && trip.financialIntegrityIssues.length === 0;

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
        className="routex-dialog trip-expenses-landscape-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "860px",
          width: "min(95vw, 860px)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "18px",
          overflow: "hidden",
        }}
      >
        <header
          className="routex-dialog-header"
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
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
                marginBottom: "2px",
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
            title="Close (Esc)"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {/* Landscape Body: Graph on Left + Breakdown on Right */}
        <div
          className="routex-dialog-body"
          style={{
            padding: "20px 24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
            alignItems: "start",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {/* Left Column: Interactive Visual Donut Chart */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "18px",
              borderRadius: "14px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                marginBottom: "10px",
              }}
            >
              <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>
                Cost Allocation
              </strong>
              <span style={{ fontSize: "11px", fontWeight: 650, color: "var(--color-text-muted)" }}>
                {slices.length} Categories
              </span>
            </div>

            {/* Donut SVG */}
            <div style={{ position: "relative", width: "170px", height: "170px" }}>
              <svg viewBox="0 0 200 200" width="170" height="170" style={{ transform: "rotate(-90deg)" }}>
                <circle
                  cx="100"
                  cy="100"
                  r="67"
                  fill="none"
                  stroke="var(--color-surface-subtle)"
                  strokeWidth="26"
                />
                {donutArcs.map((arc) => {
                  const isHovered = hoveredSliceId === arc.slice.id;
                  return (
                    <path
                      key={arc.slice.id}
                      d={arc.pathD}
                      fill={arc.slice.color}
                      stroke="var(--color-surface)"
                      strokeWidth="2"
                      style={{
                        cursor: "pointer",
                        transition: "transform 0.15s ease, opacity 0.15s ease",
                        transformOrigin: "center",
                        opacity: hoveredSliceId && !isHovered ? 0.45 : 1,
                        transform: isHovered ? "scale(1.04)" : "scale(1)",
                      }}
                      onMouseEnter={() => setHoveredSliceId(arc.slice.id)}
                      onMouseLeave={() => setHoveredSliceId(null)}
                    />
                  );
                })}
              </svg>

              {/* Center Readout */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  pointerEvents: "none",
                  padding: "6px",
                }}
              >
                {activeHoveredSlice ? (
                  <>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: activeHoveredSlice.slice.color,
                        textTransform: "uppercase",
                      }}
                    >
                      {activeHoveredSlice.slice.label}
                    </span>
                    <strong style={{ fontSize: "14px", fontWeight: 800, color: "var(--color-text-primary)" }}>
                      {formatPeso(activeHoveredSlice.slice.amount)}
                    </strong>
                    <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--color-accent-deep)" }}>
                      {activeHoveredSlice.percentage.toFixed(1)}%
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "9.5px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                      Total
                    </span>
                    <strong style={{ fontSize: "15px", fontWeight: 800, color: "var(--color-accent-deep)" }}>
                      {trip.totalExpenses != null ? formatPeso(trip.totalExpenses) : "Incomplete"}
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                      Disbursements
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Legend Chips */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "6px 10px",
                width: "100%",
                marginTop: "14px",
                paddingTop: "12px",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              {slices.map((slice) => {
                const share =
                  trip.totalExpenses && trip.totalExpenses > 0
                    ? ((slice.amount / trip.totalExpenses) * 100).toFixed(1)
                    : "0.0";
                const isHovered = hoveredSliceId === slice.id;
                return (
                  <div
                    key={slice.id}
                    onMouseEnter={() => setHoveredSliceId(slice.id)}
                    onMouseLeave={() => setHoveredSliceId(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "6px",
                      fontSize: "10.5px",
                      cursor: "pointer",
                      padding: "2px 4px",
                      borderRadius: "4px",
                      background: isHovered ? "var(--color-surface-subtle)" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0 }}>
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: slice.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {slice.label}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, color: "var(--color-text-primary)", flexShrink: 0 }}>
                      {share}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Total Hero Card & Itemized Categories */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Total Hero Card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
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
                    fontSize: "10px",
                    fontWeight: 750,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--color-text-secondary)",
                    marginBottom: "2px",
                  }}
                >
                  Total Trip Expenses
                </span>
                <strong
                  style={{
                    fontSize: "22px",
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
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "10.5px",
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
                  fontSize: "11px",
                  color: "var(--color-text-secondary)",
                }}
              >
                <strong>Incomplete expenses:</strong> {trip.financialIntegrityIssues.map(formatFinancialIntegrityIssue).join(", ")}.
              </div>
            )}

            {/* Itemized Expenses List */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "12px 16px",
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
                  paddingBottom: "6px",
                  borderBottom: "1px solid var(--color-border)",
                  fontSize: "10.5px",
                  fontWeight: 750,
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <span>Expense Category</span>
                <span>Amount</span>
              </div>

              {/* Diesel */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "12px", color: "var(--color-text-primary)" }}>Diesel</strong>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--color-text-muted)" }}>
                    Transit fuel consumption
                  </span>
                </div>
                <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>
                  {trip.expenses.dieselExpenses != null ? formatPeso(trip.expenses.dieselExpenses) : "Incomplete"}
                </strong>
              </div>

              {/* Toll Gates */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "12px", color: "var(--color-text-primary)" }}>Toll Gates</strong>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--color-text-muted)" }}>
                    {trip.expenses.tollGateBreakdown || "Expressway toll fees"}
                  </span>
                </div>
                <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>
                  {trip.expenses.tollGateExpenses != null ? formatPeso(trip.expenses.tollGateExpenses) : "Incomplete"}
                </strong>
              </div>

              {/* Entry Fees */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "12px", color: "var(--color-text-primary)" }}>Entry Fees</strong>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--color-text-muted)" }}>
                    {trip.dropoffs.length} {trip.dropoffs.length === 1 ? "drop-off stop" : "drop-off stops"}
                  </span>
                </div>
                <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>
                  {trip.expenses.entryFees != null ? formatPeso(trip.expenses.entryFees) : formatPeso(0)}
                </strong>
              </div>

              {/* Crew Compensation */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "12px", color: "var(--color-text-primary)" }}>Crew Compensation</strong>
                  <span style={{ display: "block", fontSize: "10px", color: "var(--color-text-muted)" }}>
                    Driver &amp; helpers compensation
                  </span>
                </div>
                <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>
                  {formatPeso(crewCompensation)}
                </strong>
              </div>

              {/* Other Expenses */}
              {(trip.expenses.otherExpenses ?? 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "12px", color: "var(--color-text-primary)" }}>Other Expenses</strong>
                    <span style={{ display: "block", fontSize: "10px", color: "var(--color-text-muted)" }}>
                      Incidental, parking, permits
                    </span>
                  </div>
                  <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>
                    {formatPeso(trip.expenses.otherExpenses)}
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer
          className="routex-dialog-footer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 24px 16px",
            borderTop: "1px solid var(--color-border)",
            flexShrink: 0,
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
