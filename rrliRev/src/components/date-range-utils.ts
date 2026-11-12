/**
 * RouteX Date Range Utilities & Timezone-Safe Calculations
 *
 * Implements pure date manipulation, normalization, formatting,
 * range validation, and preset calculation.
 */

export type DatePreset =
  | "all"
  | "today"
  | "week"
  | "month"
  | "year"
  | "last7"
  | "last15"
  | "last30";

export type DateRange = {
  startDate: Date | null;
  endDate: Date | null;
  /** Identifies picker presets so charts can use an appropriate aggregation. */
  preset?: DatePreset | "custom";
};

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateValue(value: string | Date): Date {
  if (value instanceof Date) {
    return startOfDay(value);
  }
  const str = String(value).trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (isoMatch) {
    return new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3]),
      0,
      0,
      0,
      0,
    );
  }
  const parsed = new Date(str);
  return startOfDay(parsed);
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

export function isBetweenDates(
  date: Date,
  range: { startDate: Date | null; endDate: Date | null },
): boolean {
  if (!range.startDate || !range.endDate) return false;
  const target = startOfDay(date).getTime();
  const start = startOfDay(range.startDate).getTime();
  const end = startOfDay(range.endDate).getTime();
  const [min, max] = start <= end ? [start, end] : [end, start];
  return target >= min && target <= max;
}

export function isDateInRange(
  value: string | Date | null | undefined,
  range: DateRange,
): boolean {
  if (!value) return false;
  if (!range.startDate && !range.endDate) {
    return true;
  }
  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const target = startOfDay(date).getTime();
  const start = range.startDate ? startOfDay(range.startDate).getTime() : null;
  const end = range.endDate ? startOfDay(range.endDate).getTime() : null;

  if (start != null && end != null) {
    const [min, max] = start <= end ? [start, end] : [end, start];
    return target >= min && target <= max;
  }
  if (start != null) {
    return target >= start;
  }
  if (end != null) {
    return target <= end;
  }
  return true;
}

export function formatDateRange(range: DateRange): string {
  if (!range.startDate && !range.endDate) {
    return "All time";
  }
  if (range.startDate && !range.endDate) {
    return `From ${formatShortDate(range.startDate)}`;
  }
  if (!range.startDate && range.endDate) {
    return `Up to ${formatShortDate(range.endDate)}`;
  }
  if (range.startDate && range.endDate) {
    if (dayKey(range.startDate) === dayKey(range.endDate)) {
      return formatShortDate(range.startDate);
    }
    return `${formatShortDate(range.startDate)} – ${formatShortDate(range.endDate)}`;
  }
  return "All time";
}

export const BUSINESS_TIME_ZONE = "Asia/Manila";
export const COMPANY_FOUNDATION_YEAR = 2024;
export const COMPANY_FOUNDATION_DATE = "2024-01-01";

/**
 * Normalizes a reference timestamp into the start-of-day in Asia/Manila.
 */
export function getNowInManila(): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.format(new Date()).split("-").map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? (new Date().getMonth() + 1);
  const day = parts[2] ?? new Date().getDate();
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function presetRange(
  preset: DatePreset,
  referenceDate?: Date,
): DateRange {
  const today = referenceDate ? startOfDay(referenceDate) : startOfDay(getNowInManila());
  if (preset === "all") return { startDate: null, endDate: null };
  if (preset === "today") return { startDate: today, endDate: today };
  let start: Date;
  if (preset === "week") {
    start = addDays(today, -today.getDay());
  } else if (preset === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (preset === "year") {
    start = new Date(today.getFullYear(), 0, 1);
  } else {
    const days = preset === "last15" ? 15 : preset === "last30" ? 30 : 7;
    start = addDays(today, -(days - 1));
  }
  const minAllowed = new Date(COMPANY_FOUNDATION_YEAR, 0, 1);
  if (start.getTime() < minAllowed.getTime()) {
    start = minAllowed;
  }
  return { startDate: start, endDate: today };
}
