/**
 * RouteX Date Range Utilities & Timezone-Safe Calculations
 *
 * Implements pure date manipulation, normalization, formatting,
 * range validation, and preset calculation.
 */

export type DateRange = { startDate: Date | null; endDate: Date | null };

export type DatePreset =
  | "all"
  | "today"
  | "week"
  | "month"
  | "year"
  | "last7"
  | "last15"
  | "last30";

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

export function presetRange(
  preset: DatePreset,
  referenceDate: Date = new Date(),
): DateRange {
  const today = startOfDay(referenceDate);
  if (preset === "all") return { startDate: null, endDate: null };
  if (preset === "today") return { startDate: today, endDate: today };
  if (preset === "week") {
    const start = addDays(today, -today.getDay());
    return { startDate: start, endDate: today };
  }
  if (preset === "month") {
    return {
      startDate: new Date(today.getFullYear(), today.getMonth(), 1),
      endDate: today,
    };
  }
  if (preset === "year") {
    return {
      startDate: new Date(today.getFullYear(), 0, 1),
      endDate: today,
    };
  }
  const days = preset === "last15" ? 15 : preset === "last30" ? 30 : 7;
  return { startDate: addDays(today, -(days - 1)), endDate: today };
}
