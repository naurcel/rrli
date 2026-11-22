/**
 * RouteX: Delivery Recording Policy & Backdating Validation
 *
 * Implements the rolling 3-working-day backdating window with Philippine calendar
 * working-day arithmetic, weekend & holiday exclusion, and Admin approval ticket integration (TC-TIME-003).
 */

import {
  getRollingWorkingDayWindow,
  parseDateKey,
} from "./philippine-calendar.ts";
import { findApprovedTicketForDelivery } from "./delivery-backdating-ticket-store.ts";

export const COMPANY_FOUNDATION_YEAR = 2024;
export const COMPANY_FOUNDATION_DATE = "2024-01-01";

export type DeliveryDateWindowResult = {
  min: string;
  max: string;
  workingDaysCount: number;
  holidaysEncountered: string[];
};

/**
 * Returns the rolling 3-working-day delivery date window (today + 3 past working days).
 * Excludes weekends (Saturday & Sunday) and official Philippine Holidays.
 */
export function getDeliveryDateWindow(
  reference: Date = new Date(),
  workingDaysBack: number = 3,
): DeliveryDateWindowResult {
  const window = getRollingWorkingDayWindow(reference, workingDaysBack);
  return {
    min: window.min,
    max: window.max,
    workingDaysCount: window.workingDaysCount,
    holidaysEncountered: window.holidaysEncountered,
  };
}

export type DeliveryDateValidationResult =
  | {
      ok: true;
      isLate: boolean;
      isBackdatedWithApproval?: boolean;
      approvedTicketId?: string;
    }
  | {
      ok: false;
      message: string;
      requiresApprovalTicket?: boolean;
      minAllowedDate?: string;
      maxAllowedDate?: string;
    };

/**
 * Validates whether a delivery date is permissible for recording.
 * - Admin role can record across any date back to company foundation year (2024).
 * - Operations / normal users are permitted within the rolling 3-working-day window.
 * - Deliveries older than the rolling 3-working-day window require an approved Admin Backdating Ticket.
 */
export function validateDeliveryDateWindow(
  deliveryDate: string,
  reference: Date = new Date(),
  userRole?: string,
  options?: {
    waybillNumber?: string;
    ticketId?: string;
    workingDaysBack?: number;
  },
): DeliveryDateValidationResult {
  if (!parseDateKey(deliveryDate)) {
    return { ok: false, message: "Enter a valid delivery date." };
  }

  const window = getDeliveryDateWindow(reference, options?.workingDaysBack ?? 3);

  // 1. Admin & Superadmin can record deliveries back to company foundation year
  if (userRole === "admin" || userRole === "superadmin") {
    if (deliveryDate < COMPANY_FOUNDATION_DATE) {
      return {
        ok: false,
        message: "Delivery date cannot be earlier than company foundation year (2024).",
      };
    }
    return { ok: true, isLate: deliveryDate < window.max };
  }

  // 2. Future dates are strictly prohibited for non-admins
  if (deliveryDate > window.max) {
    return {
      ok: false,
      message: `Delivery date cannot be in the future. Today in Manila is ${window.max}.`,
      minAllowedDate: window.min,
      maxAllowedDate: window.max,
    };
  }

  // 3. Pre-company foundation dates are prohibited
  if (deliveryDate < COMPANY_FOUNDATION_DATE) {
    return {
      ok: false,
      message: "Delivery date cannot be earlier than company foundation year (2024).",
    };
  }

  // 4. Inside the rolling 3-working-day window: permitted (marked late if before today)
  if (deliveryDate >= window.min && deliveryDate <= window.max) {
    return { ok: true, isLate: deliveryDate < window.max };
  }

  // 5. Older than the 3-working-day window: check for an approved Admin Backdating Ticket
  const approvedTicket =
    (options?.waybillNumber ? findApprovedTicketForDelivery(options.waybillNumber, deliveryDate) : null) ||
    null;

  if (approvedTicket || options?.ticketId) {
    return {
      ok: true,
      isLate: true,
      isBackdatedWithApproval: true,
      approvedTicketId: approvedTicket?.id || options?.ticketId,
    };
  }

  return {
    ok: false,
    requiresApprovalTicket: true,
    minAllowedDate: window.min,
    maxAllowedDate: window.max,
    message: `Delivery date must be between ${window.min} and ${window.max} (rolling 3 working days). Older dates require an approved Admin Backdating Ticket.`,
  };
}
