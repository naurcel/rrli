"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatPercent, formatPeso } from "@/lib/format";
import { CompactMoney } from "@/components/compact-money";
import {
  computeDonutArcs,
  type ExpenseCategorySlice,
} from "@/features/deliveries/delivery-breakdown-model";

export type FinancialBreakdownTab = "earnings" | "expenses" | "profit";

export type FinancialBreakdownModalProps = {
  open: boolean;
  activeTab: FinancialBreakdownTab;
  onTabChange: (tab: FinancialBreakdownTab) => void;
  onClose: () => void;
  summary: {
    rateTotal: number;
    expenseTotal: number;
    netTotal: number;
    stopCount: number;
  };
  kpiBreakdown: {
    diesel: number;
    toll: number;
    entryFees: number;
    crewTotal: number;
    driverTotal: number;
    helperTotal: number;
    otherExpenses: number;
    finalizedCount: number;
    incompleteCount: number;
    totalTrips: number;
    totalStops: number;
    avgRevenuePerTrip: number;
    avgExpensePerTrip: number;
    avgExpensePerStop: number;
    avgProfitPerTrip: number;
    marginPercent: number | null;
    profitableTrips: number;
    lossOrEvenTrips: number;
    clientRevenue: Record<string, { total: number; trips: number }>;
    ownershipRevenue: Record<string, { total: number; trips: number }>;
  };
};

export function FinancialBreakdownModal({
  open,
  activeTab,
  onTabChange,
  onClose,
  summary,
  kpiBreakdown,
}: FinancialBreakdownModalProps) {
  const headingId = useId();
  const [hoveredSliceId, setHoveredSliceId] = useState<string | null>(null);
  const [showAllClients, setShowAllClients] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");

  // Reset internal states on modal close
  useEffect(() => {
    if (!open) {
      setShowAllClients(false);
      setClientSearchQuery("");
      setHoveredSliceId(null);
    }
  }, [open]);

  // Close on Escape & trap focus
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Expenses Donut Slices
  const expenseSlices = useMemo<ExpenseCategorySlice[]>(() => {
    return [
      {
        id: "diesel",
        label: "Diesel",
        amount: kpiBreakdown.diesel,
        color: "#f59e0b",
        status: "confirmed",
        details: "Fleet transit fuel consumption",
      },
      {
        id: "tolls",
        label: "Toll Gates",
        amount: kpiBreakdown.toll,
        color: "#6366f1",
        status: "confirmed",
        details: "Expressway RFID & transit passes",
      },
      {
        id: "entry_fees",
        label: "Entry Fees",
        amount: kpiBreakdown.entryFees,
        color: "#10b981",
        status: "confirmed",
        details: "Mall & supermarket depot entrance charges",
      },
      {
        id: "driver",
        label: "Driver",
        amount: kpiBreakdown.driverTotal,
        color: "#0284c7",
        status: "confirmed",
        details: "Assigned vehicle drivers pay & allowances",
      },
      {
        id: "helper",
        label: "Helper",
        amount: kpiBreakdown.helperTotal,
        color: "#0d9488",
        status: "confirmed",
        details: "Logistics assistants & helper crew compensation",
      },
      {
        id: "other",
        label: "Other Expenses",
        amount: kpiBreakdown.otherExpenses,
        color: "#8b5cf6",
        status: "confirmed",
        details: "Incidental trip disbursements",
      },
    ];
  }, [kpiBreakdown]);

  const expenseArcs = useMemo(() => {
    return computeDonutArcs(expenseSlices, summary.expenseTotal, {
      cx: 100,
      cy: 100,
      outerRadius: 82,
      innerRadius: 0,
    });
  }, [expenseSlices, summary.expenseTotal]);

  const activeHoveredSlice = useMemo(() => {
    if (!hoveredSliceId) return null;
    return expenseArcs.find((a) => a.slice.id === hoveredSliceId) ?? null;
  }, [expenseArcs, hoveredSliceId]);

  // Client Revenue Slices
  const clientRevenueList = useMemo(() => {
    return Object.entries(kpiBreakdown.clientRevenue)
      .map(([client, data]) => ({
        client,
        total: data.total,
        trips: data.trips,
        share: summary.rateTotal > 0 ? (data.total / summary.rateTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [kpiBreakdown.clientRevenue, summary.rateTotal]);

  const TOP_CLIENTS_LIMIT = 4;

  const filteredClientList = useMemo(() => {
    if (!showAllClients) {
      return clientRevenueList.slice(0, TOP_CLIENTS_LIMIT);
    }
    if (!clientSearchQuery.trim()) {
      return clientRevenueList;
    }
    const q = clientSearchQuery.toLowerCase().trim();
    return clientRevenueList.filter((c) => c.client.toLowerCase().includes(q));
  }, [clientRevenueList, showAllClients, clientSearchQuery]);

  // Ownership Shares
  const ownedTotal = kpiBreakdown.ownershipRevenue?.Owned?.total ?? 0;
  const ownedShare = summary.rateTotal > 0 ? (ownedTotal / summary.rateTotal) * 100 : 0;
  const subTotal = kpiBreakdown.ownershipRevenue?.Subcontracted?.total ?? 0;
  const subShare = summary.rateTotal > 0 ? (subTotal / summary.rateTotal) * 100 : 0;

  // Profit Metrics
  const expenseRatio = summary.rateTotal > 0 ? Math.min(100, (summary.expenseTotal / summary.rateTotal) * 100) : 0;
  const profitRatio = summary.rateTotal > 0 && summary.netTotal > 0 ? Math.min(100, (summary.netTotal / summary.rateTotal) * 100) : 0;

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="routex-dialog-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      style={{ zIndex: 1000 }}
    >
      <div className="routex-dialog-backdrop" onClick={onClose} />
      <div
        className="routex-dialog financial-breakdown-landscape-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(96vw, 980px)",
          minWidth: "min(96vw, 980px)",
          maxWidth: "980px",
          height: "min(88vh, 670px)",
          minHeight: "min(88vh, 670px)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "18px",
          overflow: "hidden",
        }}
      >
        {/* Header with Segmented Navigation Tabs */}
        <header
          className="routex-dialog-header"
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "nowrap",
            gap: "16px",
            flexShrink: 0,
            height: "72px",
            minHeight: "72px",
            maxHeight: "72px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <span
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 750,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-accent-deep)",
                marginBottom: "2px",
              }}
            >
              FINANCIAL BREAKDOWN &amp; ANALYTICS
            </span>
            <h2
              id={headingId}
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 750,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {activeTab === "earnings"
                ? "Revenue & Client Contribution"
                : activeTab === "expenses"
                ? "Trip Expenses Distribution"
                : "Operating Profitability & Margins"}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            {/* Tab Controls */}
            <div
              className="breakdown-tab-controls"
              role="tablist"
              aria-label="Breakdown views"
              style={{
                display: "inline-flex",
                background: "var(--color-surface-subtle)",
                padding: "3px",
                borderRadius: "10px",
                border: "1px solid var(--color-border)",
                gap: "2px",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "earnings"}
                onClick={() => onTabChange("earnings")}
                className={`breakdown-tab-btn ${activeTab === "earnings" ? "active" : ""}`}
                style={{
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "7px",
                  fontSize: "12px",
                  fontWeight: 650,
                  cursor: "pointer",
                  background: activeTab === "earnings" ? "var(--color-surface)" : "transparent",
                  color: activeTab === "earnings" ? "var(--color-accent-deep)" : "var(--color-text-secondary)",
                  boxShadow: activeTab === "earnings" ? "var(--shadow-soft, 0 1px 3px rgba(0,0,0,0.08))" : "none",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                Revenue
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "expenses"}
                onClick={() => onTabChange("expenses")}
                className={`breakdown-tab-btn ${activeTab === "expenses" ? "active" : ""}`}
                style={{
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "7px",
                  fontSize: "12px",
                  fontWeight: 650,
                  cursor: "pointer",
                  background: activeTab === "expenses" ? "var(--color-surface)" : "transparent",
                  color: activeTab === "expenses" ? "var(--color-accent-deep)" : "var(--color-text-secondary)",
                  boxShadow: activeTab === "expenses" ? "var(--shadow-soft, 0 1px 3px rgba(0,0,0,0.08))" : "none",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                Expenses
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "profit"}
                onClick={() => onTabChange("profit")}
                className={`breakdown-tab-btn ${activeTab === "profit" ? "active" : ""}`}
                style={{
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "7px",
                  fontSize: "12px",
                  fontWeight: 650,
                  cursor: "pointer",
                  background: activeTab === "profit" ? "var(--color-surface)" : "transparent",
                  color: activeTab === "profit" ? "var(--color-accent-deep)" : "var(--color-text-secondary)",
                  boxShadow: activeTab === "profit" ? "var(--shadow-soft, 0 1px 3px rgba(0,0,0,0.08))" : "none",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                Net Profit
              </button>
            </div>

            <button
              type="button"
              className="routex-dialog-close"
              aria-label="Close breakdown dialog"
              title="Close (Esc)"
              onClick={onClose}
              style={{ flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        </header>

        {/* Landscape 2-Column Body */}
        <div
          className="routex-dialog-body breakdown-landscape-body"
          style={{
            padding: "20px 24px",
            flex: 1,
            height: "calc(100% - 72px)",
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "24px",
            alignItems: "start",
            boxSizing: "border-box",
          }}
        >
          {/* ========================================================================= */}
          {/* 1. EXPENSES VIEW: Interactive Donut Graph (Left) + Itemized Breakdown (Right) */}
          {/* ========================================================================= */}
          {activeTab === "expenses" && (
            <>
              {/* Left Column: Visual Donut Chart */}
              <div
                className="breakdown-graph-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "20px",
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
                    marginBottom: "12px",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                    Expense Distribution
                  </strong>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 650,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {kpiBreakdown.finalizedCount} Verified Trips
                  </span>
                </div>

                {/* Whole Circle Pie SVG */}
                <div style={{ position: "relative", width: "184px", height: "184px" }}>
                  <svg viewBox="0 0 200 200" width="184" height="184">
                    {/* Background Circle */}
                    <circle
                      cx="100"
                      cy="100"
                      r="82"
                      fill="var(--color-surface-subtle)"
                      stroke="var(--color-border, rgba(148, 163, 184, 0.25))"
                      strokeWidth="1"
                    />

                    {/* Pie Slices */}
                    {expenseArcs.map((arc) => {
                      const isHovered = hoveredSliceId === arc.slice.id;
                      return (
                        <path
                          key={arc.slice.id}
                          d={arc.pathD}
                          fill={arc.slice.color}
                          stroke="var(--color-surface)"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                          tabIndex={0}
                          role="graphics-symbol"
                          aria-label={`${arc.slice.label}: ${formatPeso(arc.slice.amount)} (${arc.percentage.toFixed(1)}%)`}
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
                </div>

                {/* Readout Below Circle */}
                <div className="breakdown-pie-readout" aria-live="polite" style={{ marginTop: "6px" }}>
                  <div className="breakdown-pie-amount">
                    {activeHoveredSlice
                      ? formatPeso(activeHoveredSlice.slice.amount)
                      : formatPeso(summary.expenseTotal)}
                  </div>
                  <div className="breakdown-pie-label">
                    {activeHoveredSlice ? (
                      <>
                        <span className="pie-share-pill">{activeHoveredSlice.percentage.toFixed(1)}%</span>
                        <span className="pie-category-name">{activeHoveredSlice.slice.label}</span>
                      </>
                    ) : (
                      <>
                        <span className="pie-share-pill">100%</span>
                        <span className="pie-category-name">Total Costs</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Legend Chips Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "8px 12px",
                    width: "100%",
                    marginTop: "16px",
                    paddingTop: "14px",
                    borderTop: "1px solid var(--color-border)",
                  }}
                >
                  {expenseSlices.map((slice) => {
                    const share =
                      summary.expenseTotal > 0 ? ((slice.amount / summary.expenseTotal) * 100).toFixed(1) : "0.0";
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
                          fontSize: "11px",
                          cursor: "pointer",
                          padding: "3px 6px",
                          borderRadius: "6px",
                          background: isHovered ? "var(--color-surface-subtle)" : "transparent",
                          transition: "background-color 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: slice.color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontWeight: 600,
                              color: "var(--color-text-secondary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
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

              {/* Right Column: Key Averages & Itemized List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* 3 Metric Tiles */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)" }}>
                      TOTAL COSTS
                    </span>
                    <strong style={{ display: "block", fontSize: "15px", fontWeight: 800, color: "var(--color-accent-deep)", marginTop: "2px" }}>
                      <CompactMoney amount={summary.expenseTotal} />
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>All disbursements</span>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)" }}>
                      AVG PER TRIP
                    </span>
                    <strong style={{ display: "block", fontSize: "15px", fontWeight: 800, color: "var(--color-text-primary)", marginTop: "2px" }}>
                      {formatPeso(kpiBreakdown.avgExpensePerTrip)}
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>Per completed route</span>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)" }}>
                      AVG PER DROP-OFF
                    </span>
                    <strong style={{ display: "block", fontSize: "15px", fontWeight: 800, color: "var(--color-text-primary)", marginTop: "2px" }}>
                      {formatPeso(kpiBreakdown.avgExpensePerStop)}
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>{kpiBreakdown.totalStops} stops served</span>
                  </div>
                </div>

                {/* Itemized Categories List with Progress Bars */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: "14px",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)", paddingBottom: "6px", borderBottom: "1px solid var(--color-border)" }}>
                    Itemized Cost Categories
                  </strong>

                  {expenseSlices.map((slice) => {
                    const share =
                      summary.expenseTotal > 0 ? (slice.amount / summary.expenseTotal) * 100 : 0;
                    return (
                      <div key={slice.id} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                          <div>
                            <strong style={{ color: "var(--color-text-primary)" }}>{slice.label}</strong>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <strong style={{ color: "var(--color-text-primary)" }}>{formatPeso(slice.amount)}</strong>
                            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-accent-deep)" }}>
                              {share.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        {/* Mini Progress Track */}
                        <div
                          style={{
                            height: "4px",
                            borderRadius: "2px",
                            background: "var(--color-surface-subtle)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, share))}%`,
                              height: "100%",
                              backgroundColor: slice.color,
                              borderRadius: "2px",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* 2. REVENUE VIEW: Client Share Horizontal Bars (Left) + Revenue Stats (Right) */}
          {/* ========================================================================= */}
          {activeTab === "earnings" && (
            <>
              {/* Left Column: Client Share Horizontal Chart */}
              <div
                className="breakdown-graph-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  padding: "18px 20px",
                  borderRadius: "14px",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <strong style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                      Client Contribution Share
                    </strong>
                    {clientRevenueList.length > TOP_CLIENTS_LIMIT && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: showAllClients ? "var(--color-accent-soft)" : "var(--color-surface-subtle)",
                          color: showAllClients ? "var(--color-accent-deep)" : "var(--color-text-muted)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {showAllClients ? "All" : `Top ${TOP_CLIENTS_LIMIT}`}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 650, color: "var(--color-text-muted)" }}>
                    {clientRevenueList.length} {clientRevenueList.length === 1 ? "Client" : "Clients"}
                  </span>
                </div>

                {/* Filter search when expanded with more than 5 clients */}
                {showAllClients && clientRevenueList.length > 5 && (
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      placeholder="Filter client accounts..."
                      aria-label="Filter client accounts"
                      style={{
                        width: "100%",
                        padding: "5px 28px 5px 9px",
                        fontSize: "11.5px",
                        borderRadius: "6px",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface-subtle)",
                        color: "var(--color-text-primary)",
                        outline: "none",
                      }}
                    />
                    {clientSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setClientSearchQuery("")}
                        style={{
                          position: "absolute",
                          right: "6px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "13px",
                          color: "var(--color-text-muted)",
                          padding: "2px 4px",
                          lineHeight: 1,
                        }}
                        aria-label="Clear client filter"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}

                {/* Scrollable list of clients (capped at 220px when expanded for future proofing) */}
                <div
                  className="custom-client-scroll"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    maxHeight: showAllClients ? "220px" : "none",
                    overflowY: showAllClients ? "auto" : "visible",
                    paddingRight: showAllClients ? "6px" : "0",
                  }}
                >
                  {filteredClientList.length === 0 ? (
                    <div style={{ padding: "16px 8px", textAlign: "center", fontSize: "12px", color: "var(--color-text-muted)" }}>
                      {clientSearchQuery ? `No clients found matching "${clientSearchQuery}"` : "No client revenue records"}
                    </div>
                  ) : (
                    filteredClientList.map((c) => (
                      <div key={c.client} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                              }}
                            />
                            <strong style={{ color: "var(--color-text-primary)" }}>{c.client}</strong>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: "4px",
                                background: "var(--color-surface-subtle)",
                                color: "var(--color-text-muted)",
                              }}
                            >
                              {c.trips} {c.trips === 1 ? "trip" : "trips"}
                            </span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <strong style={{ color: "var(--color-text-primary)" }}>{formatPeso(c.total)}</strong>
                            <span style={{ marginLeft: "6px", fontSize: "10.5px", fontWeight: 700, color: "var(--color-accent-deep)" }}>
                              {c.share.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Horizontal progress bar */}
                        <div
                          style={{
                            height: "6px",
                            borderRadius: "3px",
                            background: "var(--color-surface-subtle)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, c.share))}%`,
                              height: "100%",
                              background: "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
                              borderRadius: "3px",
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* View More / View Less Toggle Button for Future Proofing */}
                {clientRevenueList.length > TOP_CLIENTS_LIMIT && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAllClients((prev) => !prev);
                      if (showAllClients) {
                        setClientSearchQuery("");
                      }
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      width: "100%",
                      padding: "7px 12px",
                      fontSize: "11px",
                      fontWeight: 650,
                      color: "var(--color-accent-deep)",
                      background: "var(--color-accent-soft)",
                      border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {showAllClients ? (
                      <>
                        <span>Show top {TOP_CLIENTS_LIMIT} clients only</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </>
                    ) : (
                      <>
                        <span>View all {clientRevenueList.length} clients (+{clientRevenueList.length - TOP_CLIENTS_LIMIT} more)</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </>
                    )}
                  </button>
                )}

                {/* Fleet Share Split Graph */}
                <div
                  style={{
                    marginTop: "6px",
                    paddingTop: "14px",
                    borderTop: "1px solid var(--color-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                    <strong style={{ color: "var(--color-text-secondary)" }}>Fleet Allocation</strong>
                    <span style={{ color: "var(--color-text-muted)", fontSize: "10.5px" }}>
                      Owned vs Subcontracted
                    </span>
                  </div>

                  {/* Dual Split Bar */}
                  <div
                    style={{
                      height: "8px",
                      borderRadius: "4px",
                      background: "var(--color-surface-subtle)",
                      display: "flex",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${ownedShare}%`,
                        background: "#0284c7",
                      }}
                      title={`Company-Owned: ${ownedShare.toFixed(1)}%`}
                    />
                    <div
                      style={{
                        width: `${subShare}%`,
                        background: "#d97706",
                      }}
                      title={`Subcontracted: ${subShare.toFixed(1)}%`}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px" }}>
                    <span style={{ color: "#0284c7", fontWeight: 650 }}>
                      ● Company-Owned: {ownedShare.toFixed(1)}% ({formatPeso(ownedTotal)})
                    </span>
                    <span style={{ color: "#d97706", fontWeight: 650 }}>
                      ● Subcontracted: {subShare.toFixed(1)}% ({formatPeso(subTotal)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Revenue Metrics */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)" }}>
                      GROSS REVENUE
                    </span>
                    <strong style={{ display: "block", fontSize: "15px", fontWeight: 800, color: "var(--color-status-success, #059669)", marginTop: "2px" }}>
                      <CompactMoney amount={summary.rateTotal} />
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>Agreed billing</span>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)" }}>
                      AVG PER TRIP
                    </span>
                    <strong style={{ display: "block", fontSize: "15px", fontWeight: 800, color: "var(--color-text-primary)", marginTop: "2px" }}>
                      {formatPeso(kpiBreakdown.avgRevenuePerTrip)}
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>Per waybill</span>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)" }}>
                      FULFILLMENT
                    </span>
                    <strong style={{ display: "block", fontSize: "15px", fontWeight: 800, color: "var(--color-text-primary)", marginTop: "2px" }}>
                      {kpiBreakdown.finalizedCount} / {kpiBreakdown.totalTrips}
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>Finalized records</span>
                  </div>
                </div>

                {/* Fleet Breakdown Card */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: "14px",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)", paddingBottom: "6px", borderBottom: "1px solid var(--color-border)" }}>
                    Fleet Ownership Distribution
                  </strong>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: "12px", color: "var(--color-text-primary)" }}>Company-Owned Fleet</strong>
                      <span style={{ display: "block", fontSize: "10.5px", color: "var(--color-text-muted)" }}>
                        {kpiBreakdown.ownershipRevenue?.Owned?.trips ?? 0} completed trips
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>{formatPeso(ownedTotal)}</strong>
                      <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#0284c7" }}>
                        {ownedShare.toFixed(1)}% of Revenue
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: "12px", color: "var(--color-text-primary)" }}>Subcontracted Fleet</strong>
                      <span style={{ display: "block", fontSize: "10.5px", color: "var(--color-text-muted)" }}>
                        {kpiBreakdown.ownershipRevenue?.Subcontracted?.trips ?? 0} completed trips
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)" }}>{formatPeso(subTotal)}</strong>
                      <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#d97706" }}>
                        {subShare.toFixed(1)}% of Revenue
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* 3. NET PROFIT VIEW: Profit Flow Comparison Bar (Left) + Margins (Right) */}
          {/* ========================================================================= */}
          {activeTab === "profit" && (
            <>
              {/* Left Column: Revenue Realization & Profit Flow Chart */}
              <div
                className="breakdown-graph-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  padding: "18px 20px",
                  borderRadius: "14px",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                    Revenue Realization &amp; Retention
                  </strong>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: (kpiBreakdown.marginPercent ?? 0) >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                      color: (kpiBreakdown.marginPercent ?? 0) >= 0 ? "#059669" : "#dc2626",
                    }}
                  >
                    {formatPercent(kpiBreakdown.marginPercent)} Margin
                  </span>
                </div>

                {/* Comparison Waterfall Bars */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Revenue Bar */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                      <span style={{ fontWeight: 650, color: "var(--color-text-secondary)" }}>Revenue</span>
                      <strong style={{ color: "var(--color-text-primary)" }}>{formatPeso(summary.rateTotal)} (100%)</strong>
                    </div>
                    <div style={{ height: "10px", borderRadius: "5px", background: "var(--color-surface-subtle)", overflow: "hidden" }}>
                      <div style={{ width: "100%", height: "100%", background: "#0284c7", borderRadius: "5px" }} />
                    </div>
                  </div>

                  {/* Expenses Bar */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                      <span style={{ fontWeight: 650, color: "var(--color-text-secondary)" }}>Expenses</span>
                      <strong style={{ color: "#d97706" }}>{formatPeso(summary.expenseTotal)} ({expenseRatio.toFixed(1)}%)</strong>
                    </div>
                    <div style={{ height: "10px", borderRadius: "5px", background: "var(--color-surface-subtle)", overflow: "hidden" }}>
                      <div style={{ width: `${expenseRatio}%`, height: "100%", background: "#d97706", borderRadius: "5px" }} />
                    </div>
                  </div>

                  {/* Net Profit Bar */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                      <span style={{ fontWeight: 650, color: "var(--color-text-secondary)" }}>Net Profit</span>
                      <strong style={{ color: summary.netTotal >= 0 ? "#059669" : "#dc2626" }}>
                        {formatPeso(summary.netTotal)} ({profitRatio.toFixed(1)}%)
                      </strong>
                    </div>
                    <div style={{ height: "10px", borderRadius: "5px", background: "var(--color-surface-subtle)", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${profitRatio}%`,
                          height: "100%",
                          background: summary.netTotal >= 0 ? "#10b981" : "#ef4444",
                          borderRadius: "5px",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Retention Metric Callout */}
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "var(--color-surface-subtle)",
                    border: "1px dashed var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "11.5px",
                  }}
                >
                  <span style={{ color: "var(--color-text-muted)" }}>Profit per ₱100 Revenue:</span>
                  <strong style={{ fontSize: "13px", color: summary.netTotal >= 0 ? "#059669" : "#dc2626" }}>
                    {kpiBreakdown.marginPercent != null ? `₱${kpiBreakdown.marginPercent.toFixed(2)}` : "—"}
                  </strong>
                </div>
              </div>

              {/* Right Column: Profit Performance Metrics */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)" }}>
                      NET PROFIT
                    </span>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "15px",
                        fontWeight: 800,
                        color: summary.netTotal >= 0 ? "var(--color-status-success, #059669)" : "var(--color-danger, #dc2626)",
                        marginTop: "2px",
                      }}
                    >
                      <CompactMoney amount={summary.netTotal} />
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>After all expenses</span>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)" }}>
                      AVG PROFIT/TRIP
                    </span>
                    <strong style={{ display: "block", fontSize: "15px", fontWeight: 800, color: "var(--color-text-primary)", marginTop: "2px" }}>
                      {formatPeso(kpiBreakdown.avgProfitPerTrip)}
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>Per completed route</span>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)" }}>
                      PROFITABLE TRIPS
                    </span>
                    <strong style={{ display: "block", fontSize: "15px", fontWeight: 800, color: "#059669", marginTop: "2px" }}>
                      {kpiBreakdown.profitableTrips} trips
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                      {kpiBreakdown.lossOrEvenTrips > 0 ? `${kpiBreakdown.lossOrEvenTrips} loss/even` : "100% positive"}
                    </span>
                  </div>
                </div>

                {/* Accounting Reconciliation Summary */}
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: "14px",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <strong style={{ fontSize: "12.5px", color: "var(--color-text-primary)", paddingBottom: "6px", borderBottom: "1px solid var(--color-border)" }}>
                    Accounting Reconciliation
                  </strong>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span style={{ color: "var(--color-text-secondary)" }}>Revenue (+)</span>
                    <strong style={{ color: "var(--color-text-primary)" }}>{formatPeso(summary.rateTotal)}</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span style={{ color: "var(--color-text-secondary)" }}>Expenses (−)</span>
                    <strong style={{ color: "#d97706" }}>− {formatPeso(summary.expenseTotal)}</strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      paddingTop: "6px",
                      borderTop: "1px dashed var(--color-border)",
                      marginTop: "2px",
                    }}
                  >
                    <strong style={{ color: "var(--color-text-primary)" }}>Net Profit (=)</strong>
                    <strong style={{ color: summary.netTotal >= 0 ? "#059669" : "#dc2626" }}>
                      {formatPeso(summary.netTotal)}
                    </strong>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
