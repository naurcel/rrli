/**
 * RouteX: Philippine Calendar & Working Day Engine
 *
 * Implements Philippine working-day arithmetic, weekend exclusion (Saturday & Sunday),
 * and official Philippine Regular and Special Non-Working Holidays.
 *
 * Used for calculating the rolling 3-working-day delivery backdating window (TC-TIME-003).
 */

const BUSINESS_TIME_ZONE = "Asia/Manila";

export type PhilippineHoliday = {
  date: string; // YYYY-MM-DD
  name: string;
  type: "regular" | "special_non_working";
};

/**
 * Official Philippine Holidays (2024 - 2028).
 * Covers both fixed annual holidays and declared movable holidays (Holy Week, National Heroes Day, Eid).
 */
export const PHILIPPINE_HOLIDAYS: Record<string, string> = {
  // 2024
  "2024-01-01": "New Year's Day",
  "2024-02-10": "Chinese New Year",
  "2024-03-28": "Maundy Thursday",
  "2024-03-29": "Good Friday",
  "2024-03-30": "Black Saturday",
  "2024-04-09": "Araw ng Kagitingan",
  "2024-04-10": "Eid'l Fitr",
  "2024-05-01": "Labor Day",
  "2024-06-12": "Independence Day",
  "2024-06-17": "Eid'l Adha",
  "2024-08-21": "Ninoy Aquino Day",
  "2024-08-26": "National Heroes Day",
  "2024-11-01": "All Saints' Day",
  "2024-11-02": "All Souls' Day",
  "2024-11-30": "Bonifacio Day",
  "2024-12-08": "Feast of the Immaculate Conception",
  "2024-12-24": "Christmas Eve",
  "2024-12-25": "Christmas Day",
  "2024-12-30": "Rizal Day",
  "2024-12-31": "Last Day of the Year",

  // 2025
  "2025-01-01": "New Year's Day",
  "2025-01-29": "Chinese New Year",
  "2025-04-09": "Araw ng Kagitingan",
  "2025-04-17": "Maundy Thursday",
  "2025-04-18": "Good Friday",
  "2025-04-19": "Black Saturday",
  "2025-05-01": "Labor Day",
  "2025-06-06": "Eid'l Adha",
  "2025-06-12": "Independence Day",
  "2025-08-21": "Ninoy Aquino Day",
  "2025-08-25": "National Heroes Day",
  "2025-11-01": "All Saints' Day",
  "2025-11-02": "All Souls' Day",
  "2025-11-30": "Bonifacio Day",
  "2025-12-08": "Feast of the Immaculate Conception",
  "2025-12-24": "Christmas Eve",
  "2025-12-25": "Christmas Day",
  "2025-12-30": "Rizal Day",
  "2025-12-31": "Last Day of the Year",

  // 2026
  "2026-01-01": "New Year's Day",
  "2026-02-17": "Chinese New Year",
  "2026-04-02": "Maundy Thursday",
  "2026-04-03": "Good Friday",
  "2026-04-04": "Black Saturday",
  "2026-04-09": "Araw ng Kagitingan",
  "2026-05-01": "Labor Day",
  "2026-05-27": "Eid'l Adha",
  "2026-06-12": "Independence Day",
  "2026-08-21": "Ninoy Aquino Day",
  "2026-08-31": "National Heroes Day",
  "2026-11-01": "All Saints' Day",
  "2026-11-02": "All Souls' Day",
  "2026-11-30": "Bonifacio Day",
  "2026-12-08": "Feast of the Immaculate Conception",
  "2026-12-24": "Christmas Eve",
  "2026-12-25": "Christmas Day",
  "2026-12-30": "Rizal Day",
  "2026-12-31": "Last Day of the Year",

  // 2027
  "2027-01-01": "New Year's Day",
  "2027-03-25": "Maundy Thursday",
  "2027-03-26": "Good Friday",
  "2027-04-09": "Araw ng Kagitingan",
  "2027-05-01": "Labor Day",
  "2027-06-12": "Independence Day",
  "2027-08-21": "Ninoy Aquino Day",
  "2027-08-30": "National Heroes Day",
  "2027-11-01": "All Saints' Day",
  "2027-11-30": "Bonifacio Day",
  "2027-12-08": "Feast of the Immaculate Conception",
  "2027-12-25": "Christmas Day",
  "2027-12-30": "Rizal Day",
  "2027-12-31": "Last Day of the Year",
};

/**
 * Formats a Date instance into YYYY-MM-DD string in Manila timezone.
 */
export function formatManilaDateKey(reference: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Parses YYYY-MM-DD string into a UTC Date instance.
 */
export function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Shifts a YYYY-MM-DD key by N calendar days.
 */
export function shiftDateKey(value: string, days: number): string {
  const parsed = parseDateKey(value);
  if (!parsed) return value;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Checks whether a given date is an official Philippine Holiday.
 */
export function isPhilippineHoliday(dateKey: string): { isHoliday: boolean; name?: string } {
  const name = PHILIPPINE_HOLIDAYS[dateKey];
  return { isHoliday: Boolean(name), name };
}

/**
 * Checks whether a date is a standard Philippine Working Day:
 * Returns FALSE for Saturdays (day 6), Sundays (day 0), and Philippine Holidays.
 * Returns TRUE for standard Monday-Friday business days.
 */
export function isPhilippineWorkingDay(dateInput: string | Date): boolean {
  const dateKey = typeof dateInput === "string" ? dateInput : formatManilaDateKey(dateInput);
  const parsed = parseDateKey(dateKey);
  if (!parsed) return false;

  const dayOfWeek = parsed.getUTCDay();
  // Saturday = 6, Sunday = 0
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Check Philippine official holiday
  if (PHILIPPINE_HOLIDAYS[dateKey]) {
    return false;
  }

  return true;
}

/**
 * Moves backward from `dateKey` to find the immediately preceding working day.
 */
export function getPreviousWorkingDay(dateKey: string): string {
  let current = shiftDateKey(dateKey, -1);
  while (!isPhilippineWorkingDay(current)) {
    current = shiftDateKey(current, -1);
  }
  return current;
}

/**
 * Computes the rolling N-working-day window (excluding weekends and official Philippine holidays).
 *
 * For rolling 3 working days:
 * Starting from `max` (today), steps backwards counting only working days until 3 working days are covered.
 * Returns { min, max, workingDaysCount, holidaysEncountered }.
 *
 * Example:
 * If today is Thursday Nov 5, 2026:
 * - Working day 1 back: Wednesday Nov 4
 * - Working day 2 back: Tuesday Nov 3
 * - Working day 3 back: Monday Nov 2
 * Result: min = "2026-11-02", max = "2026-11-05"
 *
 * If today is Monday Nov 9, 2026:
 * - Weekend (Sat Nov 7 & Sun Nov 8) skipped
 * - Working day 1 back: Friday Nov 6
 * - Working day 2 back: Thursday Nov 5
 * - Working day 3 back: Wednesday Nov 4
 * Result: min = "2026-11-04", max = "2026-11-09"
 */
export function getRollingWorkingDayWindow(
  reference: Date = new Date(),
  workingDaysBack: number = 3,
): {
  min: string;
  max: string;
  workingDaysCount: number;
  holidaysEncountered: string[];
} {
  const max = formatManilaDateKey(reference);
  const holidaysEncountered: string[] = [];

  let count = 0;
  let cursor = max;

  while (count < workingDaysBack) {
    cursor = shiftDateKey(cursor, -1);
    const holiday = PHILIPPINE_HOLIDAYS[cursor];
    if (holiday) {
      holidaysEncountered.push(`${cursor}: ${holiday}`);
    }
    if (isPhilippineWorkingDay(cursor)) {
      count++;
    }
  }

  return {
    min: cursor,
    max,
    workingDaysCount: workingDaysBack,
    holidaysEncountered,
  };
}
