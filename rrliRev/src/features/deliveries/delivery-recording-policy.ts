const BUSINESS_TIME_ZONE = "Asia/Manila";

function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKeyInTimeZone(reference: Date, timeZone = BUSINESS_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDateKey(value: string, days: number): string {
  const parsed = parseDateKey(value);
  if (!parsed) return value;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function getDeliveryDateWindow(reference = new Date()): {
  min: string;
  max: string;
} {
  const max = dateKeyInTimeZone(reference);
  return { min: shiftDateKey(max, -2), max };
}

export function validateDeliveryDateWindow(
  deliveryDate: string,
  reference = new Date(),
  userRole?: string,
): { ok: true; isLate: boolean } | { ok: false; message: string } {
  if (!parseDateKey(deliveryDate)) {
    return { ok: false, message: "Enter a valid delivery date." };
  }
  const window = getDeliveryDateWindow(reference);

  // Admin role is permitted to record deliveries with no date range restrictions
  if (userRole === "admin") {
    return { ok: true, isLate: deliveryDate < window.max };
  }

  if (deliveryDate < window.min || deliveryDate > window.max) {
    return {
      ok: false,
      message: `Delivery date must be between ${window.min} and ${window.max}.`,
    };
  }
  return { ok: true, isLate: deliveryDate < window.max };
}

