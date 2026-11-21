import assert from "node:assert/strict";
import test from "node:test";

import {
  getDeliveryDateWindow,
  validateDeliveryDateWindow,
} from "./delivery-recording-policy.ts";
import {
  createBackdatingTicket,
  decideBackdatingTicket,
} from "./delivery-backdating-ticket-store.ts";

const reference = new Date("2026-11-05T03:00:00.000Z");

test("TC-TIME-003: rolling 3-working-day window skips Philippine holidays and weekends", () => {
  const window = getDeliveryDateWindow(reference);
  // Reference is Thursday 2026-11-05.
  // Working days: 11-04 (Wed, day 1), 11-03 (Tue, day 2).
  // 11-02 (Mon) is All Souls' Day (Philippine Holiday) -> skipped.
  // 11-01 (Sun) and 10-31 (Sat) are weekends -> skipped.
  // 10-30 (Fri, day 3).
  assert.equal(window.max, "2026-11-05");
  assert.equal(window.min, "2026-10-30");
  assert.equal(window.workingDaysCount, 3);
  assert.ok(window.holidaysEncountered.some((h) => h.includes("All Souls' Day")));

  // Today is on time
  assert.deepEqual(validateDeliveryDateWindow("2026-11-05", reference), {
    ok: true,
    isLate: false,
  });

  // Yesterday within working window is late but valid
  assert.deepEqual(validateDeliveryDateWindow("2026-11-04", reference), {
    ok: true,
    isLate: true,
  });

  // Tuesday 11-03 and Friday 10-30 are within rolling 3 working days
  assert.deepEqual(validateDeliveryDateWindow("2026-11-03", reference), {
    ok: true,
    isLate: true,
  });
  assert.deepEqual(validateDeliveryDateWindow("2026-10-30", reference), {
    ok: true,
    isLate: true,
  });
});

test("TC-TIME-003: non-admin without ticket is rejected beyond 3 working days and prompted for approval ticket", () => {
  // 4 working days ago (2026-10-29, Thursday) is outside the rolling 3-working-day window
  const outsideResult = validateDeliveryDateWindow("2026-10-29", reference, "operations");
  assert.equal(outsideResult.ok, false);
  if (!outsideResult.ok) {
    assert.equal(outsideResult.requiresApprovalTicket, true);
    assert.ok(outsideResult.message.includes("Admin Backdating Ticket"));
  }

  // Future date is rejected without approval ticket option
  const futureResult = validateDeliveryDateWindow("2026-11-06", reference, "operations");
  assert.equal(futureResult.ok, false);
  if (!futureResult.ok) {
    assert.equal(futureResult.requiresApprovalTicket, undefined);
  }

  // Pre-company founding date (2023) is rejected
  const ancientResult = validateDeliveryDateWindow("2023-12-31", reference, "operations");
  assert.equal(ancientResult.ok, false);
});

test("TC-TIME-003: backdating ticket queue lifecycle permits non-admin backdated recording upon approval", () => {
  const waybillNumber = "WB-TEST-BACKDATE-999";
  const deliveryDate = "2026-10-20"; // Well beyond 3 working days

  // 1. Without ticket: rejected
  const beforeTicket = validateDeliveryDateWindow(deliveryDate, reference, "operations", {
    waybillNumber,
  });
  assert.equal(beforeTicket.ok, false);
  if (!beforeTicket.ok) {
    assert.equal(beforeTicket.requiresApprovalTicket, true);
  }

  // 2. Request ticket
  const ticketResult = createBackdatingTicket({
    waybillNumber,
    deliveryDate,
    clientName: "Mega Corp",
    plateNumber: "NBD-1234",
    reason: "Delayed paperwork submission from provincial terminal",
    requestedBy: {
      id: "usr-ops-001",
      username: "operations",
      fullName: "Marc Rancel",
      role: "operations",
    },
  });
  assert.equal(ticketResult.ok, true);
  if (!ticketResult.ok) return;

  const ticket = ticketResult.ticket;
  assert.equal(ticket.status, "pending");

  // While pending, delivery is still blocked
  const pendingCheck = validateDeliveryDateWindow(deliveryDate, reference, "operations", {
    waybillNumber,
  });
  assert.equal(pendingCheck.ok, false);

  // 3. Admin approves ticket
  const approveResult = decideBackdatingTicket({
    ticketId: ticket.id,
    decision: "approve",
    decidedBy: {
      id: "usr-adm-001",
      username: "admin",
      fullName: "System Admin",
    },
    decisionNotes: "Approved by Operations Manager after reviewing paper logsheet.",
  });
  assert.equal(approveResult.ok, true);

  // 4. With approved ticket: delivery recording is unlocked!
  const afterApproval = validateDeliveryDateWindow(deliveryDate, reference, "operations", {
    waybillNumber,
  });
  assert.deepEqual(afterApproval, {
    ok: true,
    isLate: true,
    isBackdatedWithApproval: true,
    approvedTicketId: ticket.id,
  });
});

test("TC-TIME-003: admin role can record deliveries across dates back to company founding year (2024)", () => {
  assert.deepEqual(validateDeliveryDateWindow("2024-01-01", reference, "admin"), {
    ok: true,
    isLate: true,
  });
  assert.deepEqual(validateDeliveryDateWindow("2026-01-01", reference, "admin"), {
    ok: true,
    isLate: true,
  });
  assert.deepEqual(validateDeliveryDateWindow("2026-11-05", reference, "admin"), {
    ok: true,
    isLate: false,
  });
  assert.deepEqual(validateDeliveryDateWindow("2026-12-01", reference, "admin"), {
    ok: true,
    isLate: false,
  });
  assert.equal(validateDeliveryDateWindow("2023-12-31", reference, "admin").ok, false);
  assert.equal(validateDeliveryDateWindow("not-a-date", reference, "admin").ok, false);
});
