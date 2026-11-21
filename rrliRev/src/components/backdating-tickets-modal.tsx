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

  // New ticket form state
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
      toast.error("Failed to load backdating tickets.");
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
          setFormError(data?.message || "Failed to submit backdating ticket.");
          return;
        }

        toast.success(`Backdating ticket ${data.ticket.id} submitted for Admin review.`);
        setReason("");
        setViewTab("queue");
        fetchTickets();
      } catch {
        setFormError("A network error occurred while submitting the ticket.");
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
          toast.error(data?.message || `Failed to ${decision} ticket.`);
          return;
        }

        toast.success(`Ticket ${ticketId} has been ${decision === "approve" ? "approved" : "rejected"}.`);
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

  const pendingCount = tickets.filter((t) => t.status === "pending").length;

  return createPortal(
    <div className="image-viewer-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="records-card"
        style={{
          maxWidth: "760px",
          width: "92%",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              Backdating Approval Tickets
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
              Deliveries dated beyond the rolling 3-working-day window require Admin ticket approval.
            </p>
          </div>
          <button
            type="button"
            className="filter-button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: "6px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Close
          </button>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface-subtle)",
            padding: "0 24px",
            gap: "16px",
          }}
        >
          <button
            type="button"
            onClick={() => setViewTab("queue")}
            style={{
              padding: "12px 4px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              background: "none",
              cursor: "pointer",
              color: viewTab === "queue" ? "var(--color-accent-deep)" : "var(--color-text-muted)",
              borderBottom: viewTab === "queue" ? "2px solid var(--color-accent-deep)" : "2px solid transparent",
            }}
          >
            Ticket Queue ({tickets.length}) {pendingCount > 0 ? `• ${pendingCount} Pending` : ""}
          </button>
          <button
            type="button"
            onClick={() => setViewTab("request")}
            style={{
              padding: "12px 4px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              background: "none",
              cursor: "pointer",
              color: viewTab === "request" ? "var(--color-accent-deep)" : "var(--color-text-muted)",
              borderBottom: viewTab === "request" ? "2px solid var(--color-accent-deep)" : "2px solid transparent",
            }}
          >
            + Request Backdating Approval
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {viewTab === "queue" && (
            <div>
              {/* Filter pills */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 500 }}>Filter:</span>
                {(["all", "pending", "approved", "rejected"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilterStatus(s)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "14px",
                      fontSize: "11px",
                      fontWeight: 600,
                      border: "1px solid",
                      cursor: "pointer",
                      textTransform: "capitalize",
                      backgroundColor: filterStatus === s ? "var(--color-accent-deep)" : "transparent",
                      color: filterStatus === s ? "#fff" : "var(--color-text)",
                      borderColor: filterStatus === s ? "var(--color-accent-deep)" : "var(--color-border)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {loading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)" }}>
                  Loading tickets…
                </div>
              ) : filteredTickets.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "var(--color-text-muted)",
                    border: "1px dashed var(--color-border)",
                    borderRadius: "8px",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "13px" }}>No backdating tickets found.</p>
                  <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                    Tickets requested for historical dates will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {filteredTickets.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        padding: "16px",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface-subtle)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--color-text)" }}>
                              Waybill #{t.waybillNumber}
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                              • Delivery Date: <strong>{t.deliveryDate}</strong>
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                            Requested by {t.requestedBy.fullName} (@{t.requestedBy.username}) on{" "}
                            {new Date(t.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            backgroundColor:
                              t.status === "approved"
                                ? "rgba(16, 185, 129, 0.15)"
                                : t.status === "rejected"
                                ? "rgba(239, 68, 68, 0.15)"
                                : "rgba(245, 158, 11, 0.15)",
                            color:
                              t.status === "approved"
                                ? "#059669"
                                : t.status === "rejected"
                                ? "#dc2626"
                                : "#d97706",
                          }}
                        >
                          {t.status}
                        </span>
                      </div>

                      <div style={{ fontSize: "12px", color: "var(--color-text)", marginTop: "4px", wordBreak: "break-word", lineHeight: 1.45 }}>
                        <span style={{ fontWeight: 600 }}>Reason: </span>
                        {t.reason}
                      </div>

                      {t.clientName && (
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                          Client: {t.clientName} {t.plateNumber ? `| Plate: ${t.plateNumber}` : ""}
                        </div>
                      )}

                      {t.status !== "pending" && t.decidedBy && (
                        <div
                          style={{
                            marginTop: "4px",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            backgroundColor: "var(--color-surface)",
                            fontSize: "12px",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          <div style={{ fontWeight: 600, color: "var(--color-text)" }}>
                            Decision by {t.decidedBy.fullName} (@{t.decidedBy.username}):
                          </div>
                          {t.decisionNotes ? (
                            <p style={{ margin: "2px 0 0", color: "var(--color-text-muted)" }}>{t.decisionNotes}</p>
                          ) : (
                            <span style={{ fontStyle: "italic", color: "var(--color-text-muted)" }}>No notes entered.</span>
                          )}
                        </div>
                      )}

                      {/* Admin Decision Actions */}
                      {isAdmin && t.status === "pending" && (
                        <div style={{ marginTop: "8px", borderTop: "1px solid var(--color-border)", paddingTop: "10px" }}>
                          {activeDecisionId === t.id ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text)" }}>
                                Review Notes (Optional):
                                <input
                                  type="text"
                                  value={decisionNotes}
                                  onChange={(e) => setDecisionNotes(e.target.value)}
                                  placeholder="e.g. Verified paper logsheet with dispatch manager."
                                  style={{
                                    marginTop: "4px",
                                    width: "100%",
                                    padding: "6px 10px",
                                    fontSize: "12px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--color-border)",
                                    backgroundColor: "var(--color-surface)",
                                    color: "var(--color-text)",
                                  }}
                                />
                              </label>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => handleDecideTicket(t.id, "approve")}
                                  style={{
                                    padding: "6px 14px",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor: "#10b981",
                                    color: "#fff",
                                    fontWeight: 600,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                  }}
                                >
                                  {isPending ? "Processing…" : "Confirm Approval"}
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => handleDecideTicket(t.id, "reject")}
                                  style={{
                                    padding: "6px 14px",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor: "#ef4444",
                                    color: "#fff",
                                    fontWeight: 600,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Reject Ticket
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDecisionId(null);
                                    setDecisionNotes("");
                                  }}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--color-border)",
                                    background: "none",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDecisionId(t.id);
                                  setDecisionNotes("");
                                }}
                                style={{
                                  padding: "5px 12px",
                                  borderRadius: "6px",
                                  backgroundColor: "var(--color-accent-deep)",
                                  color: "#fff",
                                  border: "none",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Review & Decide
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
            <form onSubmit={handleCreateTicket} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                Submit a request to authorize recording a delivery dated before the standard 3-working-day window.
              </div>

              {formError && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    color: "#dc2626",
                    fontSize: "12px",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  {formError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
                  Waybill Number *
                  <input
                    type="text"
                    required
                    value={waybillNumber}
                    onChange={(e) => setWaybillNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. WB-2026-9041"
                    style={{
                      width: "100%",
                      marginTop: "4px",
                      padding: "8px 10px",
                      fontSize: "13px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                    }}
                  />
                </label>

                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
                  Delivery Date *
                  <input
                    type="date"
                    required
                    min="2024-01-01"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: "4px",
                      padding: "8px 10px",
                      fontSize: "13px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                    }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
                  Client Name (Optional)
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Jollibee Foods Corp."
                    style={{
                      width: "100%",
                      marginTop: "4px",
                      padding: "8px 10px",
                      fontSize: "13px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                    }}
                  />
                </label>

                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
                  Truck Plate (Optional)
                  <input
                    type="text"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                    placeholder="e.g. NBD-1234"
                    style={{
                      width: "100%",
                      marginTop: "4px",
                      padding: "8px 10px",
                      fontSize: "13px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                    }}
                  />
                </label>
              </div>

              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
                Business Justification / Reason * (min 5 characters)
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this delivery is being recorded beyond the rolling 3-working-day window (e.g. Delayed physical POD return from provincial route, power outage at regional hub)."
                  style={{
                    width: "100%",
                    marginTop: "4px",
                    padding: "8px 10px",
                    fontSize: "13px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text)",
                    fontFamily: "inherit",
                  }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setViewTab("queue")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    background: "none",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "var(--color-accent-deep)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {isPending ? "Submitting…" : "Submit Approval Ticket"}
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
