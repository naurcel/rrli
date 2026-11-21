/**
 * RouteX: Delivery Backdating Approval Ticket Queue
 *
 * Implements formal ticket request and approval workflow for deliveries dated older
 * than the rolling 3-working-day window (TC-TIME-003).
 */

import { recordAuditEntry } from "../../lib/audit/server-audit-store.ts";

export type BackdatingTicketStatus = "pending" | "approved" | "rejected";

export type BackdatingApprovalTicket = {
  id: string; // e.g. TKT-2026-1042
  waybillNumber: string;
  deliveryDate: string;
  clientName?: string;
  plateNumber?: string;
  reason: string;
  requestedBy: {
    id: string;
    username: string;
    fullName: string;
    role: string;
  };
  status: BackdatingTicketStatus;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedBy?: {
    id: string;
    username: string;
    fullName: string;
  };
  decisionNotes?: string;
};

// Seeded / in-memory tickets
const ticketsMap = new Map<string, BackdatingApprovalTicket>();

export function clearBackdatingTicketsForTesting(): void {
  ticketsMap.clear();
}

/**
 * Creates a new backdating approval request ticket.
 */
export function createBackdatingTicket(input: {
  waybillNumber: string;
  deliveryDate: string;
  clientName?: string;
  plateNumber?: string;
  reason: string;
  requestedBy: {
    id: string;
    username: string;
    fullName: string;
    role: string;
  };
}): { ok: true; ticket: BackdatingApprovalTicket } | { ok: false; message: string } {
  const waybill = input.waybillNumber.trim();
  if (!waybill) {
    return { ok: false, message: "Waybill number is required." };
  }

  const reason = input.reason.trim();
  if (reason.length < 5) {
    return { ok: false, message: "A documented backdating reason of at least 5 characters is required." };
  }

  if (input.deliveryDate < "2024-01-01") {
    return { ok: false, message: "Delivery date cannot be earlier than company foundation year (2024)." };
  }

  // Prevent duplicate pending ticket for the same waybill
  for (const t of ticketsMap.values()) {
    if (t.waybillNumber.toUpperCase() === waybill.toUpperCase() && t.status === "pending") {
      return { ok: false, message: `A pending backdating request already exists for Waybill #${waybill}.` };
    }
  }

  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const id = `TKT-${year}-${randomSuffix}`;
  const now = new Date().toISOString();

  const ticket: BackdatingApprovalTicket = {
    id,
    waybillNumber: waybill,
    deliveryDate: input.deliveryDate,
    clientName: input.clientName?.trim() || undefined,
    plateNumber: input.plateNumber?.trim() || undefined,
    reason,
    requestedBy: input.requestedBy,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  ticketsMap.set(id, ticket);

  recordAuditEntry({
    actorId: input.requestedBy.id,
    actorEmail: `${input.requestedBy.username.toLowerCase()}@routex.local`,
    action: "delivery.backdating_ticket_created",
    entityType: "delivery",
    entityId: id,
    summary: `Backdating approval ticket ${id} created for Waybill #${waybill} (Date: ${input.deliveryDate}).`,
    changes: {
      ticketId: id,
      waybillNumber: waybill,
      deliveryDate: input.deliveryDate,
      reason,
      requestedBy: input.requestedBy.username,
    },
  });

  return { ok: true, ticket };
}

/**
 * Lists tickets with optional filters.
 */
export function listBackdatingTickets(filter?: {
  status?: BackdatingTicketStatus;
  waybillNumber?: string;
  username?: string;
}): BackdatingApprovalTicket[] {
  let list = Array.from(ticketsMap.values());

  if (filter?.status) {
    list = list.filter((t) => t.status === filter.status);
  }
  if (filter?.waybillNumber) {
    const wb = filter.waybillNumber.trim().toUpperCase();
    list = list.filter((t) => t.waybillNumber.toUpperCase().includes(wb));
  }
  if (filter?.username) {
    const un = filter.username.trim().toLowerCase();
    list = list.filter((t) => t.requestedBy.username.toLowerCase() === un);
  }

  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Retrieves a single backdating ticket.
 */
export function getBackdatingTicket(id: string): BackdatingApprovalTicket | null {
  return ticketsMap.get(id) || null;
}

/**
 * Admin action: approves or rejects a backdating ticket.
 */
export function decideBackdatingTicket(input: {
  ticketId: string;
  decision: "approve" | "reject";
  decisionNotes?: string;
  decidedBy: {
    id: string;
    username: string;
    fullName: string;
  };
}): { ok: true; ticket: BackdatingApprovalTicket } | { ok: false; message: string } {
  const ticket = ticketsMap.get(input.ticketId);
  if (!ticket) {
    return { ok: false, message: "Backdating ticket not found." };
  }

  if (ticket.status !== "pending") {
    return { ok: false, message: `Ticket is already ${ticket.status}.` };
  }

  const now = new Date().toISOString();
  const nextStatus: BackdatingTicketStatus = input.decision === "approve" ? "approved" : "rejected";

  ticket.status = nextStatus;
  ticket.decidedAt = now;
  ticket.updatedAt = now;
  ticket.decidedBy = input.decidedBy;
  if (input.decisionNotes?.trim()) {
    ticket.decisionNotes = input.decisionNotes.trim();
  }

  recordAuditEntry({
    actorId: input.decidedBy.id,
    actorEmail: `${input.decidedBy.username.toLowerCase()}@routex.local`,
    action: input.decision === "approve" ? "delivery.backdating_ticket_approved" : "delivery.backdating_ticket_rejected",
    entityType: "delivery",
    entityId: ticket.id,
    summary: `Backdating ticket ${ticket.id} for Waybill #${ticket.waybillNumber} was ${nextStatus} by ${input.decidedBy.username}.`,
    changes: {
      ticketId: ticket.id,
      waybillNumber: ticket.waybillNumber,
      deliveryDate: ticket.deliveryDate,
      decision: nextStatus,
      decisionNotes: input.decisionNotes?.trim() || null,
      decidedBy: input.decidedBy.username,
    },
  });

  return { ok: true, ticket };
}

/**
 * Checks whether an approved ticket exists allowing backdating for the given waybill & date.
 */
export function findApprovedTicketForDelivery(
  waybillNumber?: string | null,
  deliveryDate?: string | null,
): BackdatingApprovalTicket | null {
  if (!waybillNumber || !deliveryDate) return null;
  const cleanWb = waybillNumber.trim().toUpperCase();

  for (const t of ticketsMap.values()) {
    if (
      t.status === "approved" &&
      t.waybillNumber.toUpperCase() === cleanWb &&
      t.deliveryDate === deliveryDate
    ) {
      return t;
    }
  }

  return null;
}
