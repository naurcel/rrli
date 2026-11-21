import { NextResponse } from "next/server";

import { verifyServerPermission } from "@/lib/auth/server-session";
import {
  createBackdatingTicket,
  decideBackdatingTicket,
  listBackdatingTickets,
  type BackdatingTicketStatus,
} from "@/features/deliveries/delivery-backdating-ticket-store";

export async function GET(request: Request) {
  const auth = await verifyServerPermission("deliveries:view");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, message: auth.message }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status") as BackdatingTicketStatus | null;
  const waybillParam = searchParams.get("waybillNumber");

  const tickets = listBackdatingTickets({
    status: statusParam || undefined,
    waybillNumber: waybillParam || undefined,
    username: auth.actor.role === "admin" ? undefined : auth.actor.username,
  });

  return NextResponse.json({ ok: true, tickets });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "create";

  if (action === "create") {
    const auth = await verifyServerPermission("deliveries:create");
    if (!auth.ok) {
      return NextResponse.json({ ok: false, code: auth.code, message: auth.message }, { status: auth.status });
    }

    const { waybillNumber, deliveryDate, clientName, plateNumber, reason } = body ?? {};
    if (!waybillNumber || !deliveryDate || !reason) {
      return NextResponse.json(
        { ok: false, message: "Waybill number, delivery date, and documented reason are required." },
        { status: 400 },
      );
    }

    const result = createBackdatingTicket({
      waybillNumber,
      deliveryDate,
      clientName,
      plateNumber,
      reason,
      requestedBy: {
        id: auth.actor.id,
        username: auth.actor.username,
        fullName: auth.actor.fullName,
        role: auth.actor.role,
      },
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ticket: result.ticket }, { status: 201 });
  }

  if (action === "decide") {
    const auth = await verifyServerPermission("users:manage");
    if (!auth.ok || auth.actor.role !== "admin") {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Only System Administrators can approve or reject backdating requests." },
        { status: 403 },
      );
    }

    const { ticketId, decision, decisionNotes } = body ?? {};
    if (!ticketId || (decision !== "approve" && decision !== "reject")) {
      return NextResponse.json(
        { ok: false, message: "Request ID and decision ('approve' or 'reject') are required." },
        { status: 400 },
      );
    }

    const result = decideBackdatingTicket({
      ticketId,
      decision,
      decisionNotes,
      decidedBy: {
        id: auth.actor.id,
        username: auth.actor.username,
        fullName: auth.actor.fullName,
      },
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ticket: result.ticket });
  }

  return NextResponse.json({ ok: false, message: "Unsupported action." }, { status: 400 });
}
