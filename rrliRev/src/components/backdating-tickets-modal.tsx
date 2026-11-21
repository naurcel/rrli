"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import type { BackdatingApprovalTicket, BackdatingTicketStatus } from "@/features/deliveries/delivery-backdating-ticket-store";

export function BackdatingTicketsModal({
  isOpen,
  onClose,
  currentUserRole,
  currentUsername,
  initialWaybill,
  initialDeliveryDate,
  onTicketApproved,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: string;
  currentUsername?: string;
  initialWaybill?: string;
  initialDeliveryDate?: string;
  onTicketApproved?: (ticket: BackdatingApprovalTicket) => void;
}) {
  const [tickets, setTickets] = useState<BackdatingApprovalTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | BackdatingTicketStatus>("all");
  const [viewTab, setViewTab] = useState<"queue" | "request">("queue");

  // New request form state
  const [waybillNumber, setWaybillNumber] = useState(initialWaybill || "");
  const [deliveryDate, setDeliveryDate] = useState(initialDeliveryDate || "");
  const [clientName, setClientName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Decision state for Admin
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const isAdmin = currentUserRole === "admin";

  useEffect(() => {
    if (initialWaybill) setWaybillNumber(initialWaybill);
    if (initialDeliveryDate) setDeliveryDate(initialDeliveryDate);
  }, [initialWaybill, initialDeliveryDate]);

  async function fetchTickets() {
    try {
      setLoading(true);
      const res = await fetch("/api/deliveries/backdating-tickets");
      const data = await res.json().catch(() => null);
      if (data?.ok && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
      }
    } catch {
      toast.error("Failed to load backdating requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchTickets();
      if (initialWaybill && !isAdmin) {
        setViewTab("request");
      }
    }
  }, [isOpen, initialWaybill, isAdmin]);

  // Escape key handler & scroll lock
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!waybillNumber.trim()) {
      setFormError("Waybill number is required.");
      return;
    }
    if (!deliveryDate) {
      setFormError("Delivery date is required.");
      return;
    }
    if (reason.trim().length < 5) {
      setFormError("A business reason of at least 5 characters is required.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/deliveries/backdating-tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            waybillNumber: waybillNumber.trim().toUpperCase(),
            deliveryDate,
            clientName: clientName.trim() || undefined,
            plateNumber: plateNumber.trim() || undefined,
            reason: reason.trim(),
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setFormError(data?.message || "Failed to submit backdating request.");
          return;
        }

        toast.success(`Request for Waybill #${waybillNumber.trim().toUpperCase()} submitted for Admin review.`);
        setReason("");
        setViewTab("queue");
        fetchTickets();
      } catch {
        setFormError("A network error occurred while submitting the request.");
      }
    });
  }

  async function handleDecideTicket(ticketId: string, decision: "approve" | "reject") {
    startTransition(async () => {
      try {
        const res = await fetch("/api/deliveries/backdating-tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "decide",
            ticketId,
            decision,
            decisionNotes: decisionNotes.trim() || undefined,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          toast.error(data?.message || `Failed to ${decision} request.`);
          return;
        }

        toast.success(`Request ${ticketId} has been ${decision === "approve" ? "approved" : "rejected"}.`);
        setActiveDecisionId(null);
        setDecisionNotes("");
        fetchTickets();

        if (decision === "approve" && onTicketApproved) {
          onTicketApproved(data.ticket);
        }
      } catch {
        toast.error("Network error processing decision.");
      }
    });
  }

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus === "all") return true;
    return t.status === filterStatus;
  });

  const counts = {
    all: tickets.length,
    pending: tickets.filter((t) => t.status === "pending").length,
    approved: tickets.filter((t) => t.status === "approved").length,
    rejected: tickets.filter((t) => t.status === "rejected").length,
  };

  return createPortal(
    <div
      className="routex-dialog-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backdating-modal-title"
      style={{ zIndex: 1100 }}
    >
      <div className="routex-dialog-backdrop" onClick={onClose} />
      <div
        className="routex-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(94vw, 760px)",
          maxWidth: "760px",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header className="routex-dialog-header">
          <div>
            <h2 id="backdating-modal-title" style={{ fontSize: "18px", fontWeight: 750 }}>
              Backdating Requests
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
              Deliveries dated beyond the rolling 3-working-day window require Administrator approval.
            </p>
          </div>
          <button
            type="button"
            className="routex-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close (Esc)"
          >
            ×
          </button>
        </header>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 24px",
            borderBottom: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface-subtle)",
            gap: "8px",
          }}
        >
          <div
            role="tablist"
            aria-label="Request views"
            style={{
              display: "inline-flex",
              background: "var(--color-surface)",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              gap: "3px",
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === "queue"}
              onClick={() => setViewTab("queue")}
              style={{
                border: "none",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 650,
                cursor: "pointer",
                background: viewTab === "queue" ? "var(--color-surface-subtle)" : "transparent",
                color: viewTab === "queue" ? "var(--color-accent-deep)" : "var(--color-text-secondary)",
                boxShadow: viewTab === "queue" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>Requests Queue ({counts.all})</span>
              {counts.pending > 0 ? (
                <span
                  style={{
                    display: "inline-block",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontSize: "10px",
                    fontWeight: 700,
                    backgroundColor: "#fffbeb",
                    color: "#92400e",
                    border: "1px solid #fef3c7",
                  }}
                >
                  {counts.pending} Pending
                </span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === "request"}
              onClick={() => setViewTab("request")}
              style={{
                border: "none",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 650,
                cursor: "pointer",
                background: viewTab === "request" ? "var(--color-surface-subtle)" : "transparent",
                color: viewTab === "request" ? "var(--color-accent-deep)" : "var(--color-text-secondary)",
                boxShadow: viewTab === "request" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              + New Request
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="routex-dialog-body" style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {viewTab === "queue" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Filter pills */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11.5px", color: "var(--color-text-muted)", fontWeight: 600, marginRight: "4px" }}>
                  Filter:
                </span>
                {(
                  [
                    { id: "all", label: `All (${counts.all})` },
                    { id: "pending", label: `Pending (${counts.pending})` },
                    { id: "approved", label: `Approved (${counts.approved})` },
                    { id: "rejected", label: `Rejected (${counts.rejected})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterStatus(tab.id)}
                    style={{
                      padding: "4px 11px",
                      borderRadius: "6px",
                      fontSize: "11.5px",
                      fontWeight: filterStatus === tab.id ? 650 : 500,
                      border: "1px solid",
                      cursor: "pointer",
                      backgroundColor: filterStatus === tab.id ? "var(--color-surface-subtle)" : "transparent",
                      color: filterStatus === tab.id ? "var(--color-accent-deep)" : "var(--color-text-secondary)",
                      borderColor: filterStatus === tab.id ? "var(--color-accent)" : "var(--color-border)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--color-text-muted)", fontSize: "13px" }}>
                  Loading requests…
                </div>
              ) : filteredTickets.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "44px 24px",
                    color: "var(--color-text-muted)",
                    border: "1px dashed var(--color-border)",
                    borderRadius: "10px",
                    backgroundColor: "var(--color-surface-subtle)",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 650, fontSize: "13.5px", color: "var(--color-text-primary)" }}>
                    No requests found
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                    Backdating requests submitted for historical delivery dates will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {filteredTickets.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        padding: "16px 18px",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
                        transition: "border-color 0.15s ease",
                      }}
                    >
                      {/* Top Header Row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <strong style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text-primary)", fontFamily: "var(--font-mono, monospace)" }}>
                              Waybill #{t.waybillNumber}
                            </strong>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11.5px",
                                fontWeight: 600,
                                padding: "2px 7px",
                                borderRadius: "5px",
                                background: "var(--color-surface-subtle)",
                                color: "var(--color-text-secondary)",
                                border: "1px solid var(--color-border)",
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                                <line x1="16" x2="16" y1="2" y2="6" />
                                <line x1="8" x2="8" y1="2" y2="6" />
                                <line x1="3" x2="21" y1="10" y2="10" />
                              </svg>
                              {t.deliveryDate}
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "3px" }}>
                            Requested by {t.requestedBy.fullName} (@{t.requestedBy.username}) · {new Date(t.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Status badge */}
                        <span
                          className={`export-status-pill status-${t.status}`}
                          style={{ flexShrink: 0 }}
                        >
                          {t.status === "approved" ? "Approved" : t.status === "rejected" ? "Rejected" : "Pending"}
                        </span>
                      </div>

                      {/* Client / Plate tags */}
                      {(t.clientName || t.plateNumber) && (
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                          {t.clientName ? (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 550,
                                padding: "1px 7px",
                                borderRadius: "4px",
                                background: "var(--color-surface-subtle)",
                                color: "var(--color-text-secondary)",
                                border: "1px solid var(--color-border)",
                              }}
                            >
                              Client: {t.clientName}
                            </span>
                          ) : null}
                          {t.plateNumber ? (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "1px 7px",
                                borderRadius: "4px",
                                background: "var(--color-surface-subtle)",
                                color: "var(--color-text-secondary)",
                                border: "1px solid var(--color-border)",
                                fontFamily: "var(--font-mono, monospace)",
                              }}
                            >
                              Plate: {t.plateNumber}
                            </span>
                          ) : null}
                        </div>
                      )}

                      {/* Reason callout */}
                      <div
                        style={{
                          fontSize: "12.5px",
                          lineHeight: 1.45,
                          color: "var(--color-text-primary)",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          backgroundColor: "var(--color-surface-subtle)",
                          borderLeft: "3px solid var(--color-accent)",
                          wordBreak: "break-word",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "var(--color-text-secondary)", marginRight: "4px" }}>
                          Reason:
                        </span>
                        {t.reason}
                      </div>

                      {/* Admin Decision note */}
                      {t.status !== "pending" && t.decidedBy && (
                        <div
                          style={{
                            padding: "8px 12px",
                            borderRadius: "6px",
                            backgroundColor: "var(--color-surface-subtle)",
                            fontSize: "12px",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          <div style={{ fontWeight: 600, color: "var(--color-text-primary)", fontSize: "11.5px" }}>
                            Decision by {t.decidedBy.fullName} (@{t.decidedBy.username}):
                          </div>
                          {t.decisionNotes ? (
                            <p style={{ margin: "3px 0 0", color: "var(--color-text-secondary)", fontSize: "12px", fontStyle: "italic" }}>
                              {t.decisionNotes}
                            </p>
                          ) : (
                            <span style={{ fontStyle: "italic", color: "var(--color-text-muted)", fontSize: "11.5px" }}>
                              No review note provided.
                            </span>
                          )}
                        </div>
                      )}

                      {/* Admin Decision Actions */}
                      {isAdmin && t.status === "pending" && (
                        <div style={{ marginTop: "4px", borderTop: "1px solid var(--color-border)", paddingTop: "10px" }}>
                          {activeDecisionId === t.id ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                                Review Notes (Optional):
                                <input
                                  type="text"
                                  value={decisionNotes}
                                  onChange={(e) => setDecisionNotes(e.target.value)}
                                  placeholder="e.g. Verified paper logsheet with dispatch manager."
                                  className="export-review-input"
                                  style={{
                                    marginTop: "4px",
                                    width: "100%",
                                    maxWidth: "100%",
                                  }}
                                />
                              </label>
                              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "2px" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDecisionId(null);
                                    setDecisionNotes("");
                                  }}
                                  className="secondary-button"
                                  style={{ padding: "4px 12px", fontSize: "12px" }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => handleDecideTicket(t.id, "reject")}
                                  className="export-btn-reject"
                                  style={{ height: "30px", fontSize: "12px" }}
                                >
                                  Reject Request
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => handleDecideTicket(t.id, "approve")}
                                  className="export-btn-approve"
                                  style={{ height: "30px", fontSize: "12px" }}
                                >
                                  {isPending ? "Processing…" : "Confirm Approval"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDecisionId(t.id);
                                  setDecisionNotes("");
                                }}
                                className="primary-action-button"
                                style={{ minHeight: "30px", padding: "0 14px", fontSize: "12px" }}
                              >
                                Review &amp; Decide
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewTab === "request" && (
            <form onSubmit={handleCreateTicket} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "var(--color-surface-subtle)",
                  border: "1px solid var(--color-border)",
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.45,
                }}
              >
                <strong>Backdating Policy:</strong> Recording deliveries older than the rolling 3-working-day window requires an Administrator review and approved justification.
              </div>

              {formError && (
                <div
                  style={{
                    padding: "9px 13px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    color: "#dc2626",
                    fontSize: "12px",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    fontWeight: 500,
                  }}
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  Waybill Number <span style={{ color: "var(--color-accent)" }}>*</span>
                  <input
                    type="text"
                    required
                    value={waybillNumber}
                    onChange={(e) => setWaybillNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. WB-2026-9041"
                    style={{
                      width: "100%",
                      marginTop: "5px",
                      padding: "8px 11px",
                      fontSize: "13px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text-primary)",
                      outline: "none",
                    }}
                  />
                </label>

                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  Delivery Date <span style={{ color: "var(--color-accent)" }}>*</span>
                  <input
                    type="date"
                    required
                    min="2024-01-01"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: "5px",
                      padding: "8px 11px",
                      fontSize: "13px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text-primary)",
                      outline: "none",
                    }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  Client Name (Optional)
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Jollibee Foods Corp."
                    style={{
                      width: "100%",
                      marginTop: "5px",
                      padding: "8px 11px",
                      fontSize: "13px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text-primary)",
                      outline: "none",
                    }}
                  />
                </label>

                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  Truck Plate (Optional)
                  <input
                    type="text"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                    placeholder="e.g. NBD-1234"
                    style={{
                      width: "100%",
                      marginTop: "5px",
                      padding: "8px 11px",
                      fontSize: "13px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text-primary)",
                      outline: "none",
                    }}
                  />
                </label>
              </div>

              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                Business Justification / Reason <span style={{ color: "var(--color-accent)" }}>*</span> (min 5 characters)
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this delivery is being recorded beyond the rolling 3-working-day window (e.g. Delayed physical POD return from provincial route, power outage at regional hub)."
                  style={{
                    width: "100%",
                    marginTop: "5px",
                    padding: "8px 11px",
                    fontSize: "13px",
                    lineHeight: 1.45,
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setViewTab("queue")}
                  className="secondary-button"
                  style={{ padding: "7px 16px", fontSize: "12.5px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="primary-action-button"
                  style={{ minHeight: "36px", padding: "0 18px", fontSize: "12.5px" }}
                >
                  {isPending ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
