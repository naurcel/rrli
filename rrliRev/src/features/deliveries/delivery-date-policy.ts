/**
 * RouteX: Delivery Date Window & Calendar Arithmetic
 *
 * Client-safe date policy providing company founding bounds and rolling working-day windows.
 */

import { getRollingWorkingDayWindow } from "./philippine-calendar.ts";

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
