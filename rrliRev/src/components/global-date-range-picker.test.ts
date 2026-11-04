import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDateRange,
  isDateInRange,
  parseDateValue,
  presetRange,
  toDateKey,
  type DateRange,
} from "./date-range-utils.ts";

// ============================================================================
// 1. toDateKey & parseDateValue (Timezone Safety & Formatting)
// ============================================================================

test("toDateKey formats Date to YYYY-MM-DD with zero padding", () => {
  const d1 = new Date(2026, 0, 5); // Jan 5, 2026
  assert.equal(toDateKey(d1), "2026-01-05");

  const d2 = new Date(2026, 10, 25); // Nov 25, 2026
  assert.equal(toDateKey(d2), "2026-11-25");
});

test("parseDateValue parses YYYY-MM-DD into local midnight with zero timezone drift", () => {
  const parsed = parseDateValue("2026-11-02");
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 10); // November (0-indexed)
  assert.equal(parsed.getDate(), 2);
  assert.equal(parsed.getHours(), 0);
  assert.equal(parsed.getMinutes(), 0);
  assert.equal(parsed.getSeconds(), 0);
  assert.equal(parsed.getMilliseconds(), 0);
});

test("parseDateValue handles Date objects and ISO strings", () => {
  const now = new Date(2026, 10, 2, 14, 30, 45);
  const normalized = parseDateValue(now);
  assert.equal(normalized.getFullYear(), 2026);
  assert.equal(normalized.getMonth(), 10);
  assert.equal(normalized.getDate(), 2);
  assert.equal(normalized.getHours(), 0);

  const iso = parseDateValue("2026-11-02T08:15:00.000Z");
  assert.equal(iso.getFullYear(), 2026);
  assert.equal(iso.getMonth(), 10);
  assert.equal(iso.getDate(), 2);
});

// ============================================================================
// 2. isDateInRange (Filtering Consistency Across All Pages)
// ============================================================================

test("isDateInRange returns true for All Time range (startDate: null, endDate: null)", () => {
  const allTimeRange: DateRange = { startDate: null, endDate: null };
  assert.equal(isDateInRange("2020-01-01", allTimeRange), true);
  assert.equal(isDateInRange("2026-11-02", allTimeRange), true);
  assert.equal(isDateInRange("2030-12-31", allTimeRange), true);
});

test("isDateInRange correctly includes records within start and end bounds", () => {
  const range: DateRange = {
    startDate: new Date(2026, 9, 27), // Oct 27, 2026
    endDate: new Date(2026, 10, 2),   // Nov 2, 2026
  };

  assert.equal(isDateInRange("2026-10-27", range), true, "Start date itself must be included");
  assert.equal(isDateInRange("2026-10-30", range), true, "Mid-range date must be included");
  assert.equal(isDateInRange("2026-11-02", range), true, "End date itself must be included");

  assert.equal(isDateInRange("2026-10-26", range), false, "Date before start must be excluded");
  assert.equal(isDateInRange("2026-11-03", range), false, "Date after end must be excluded");
});

test("isDateInRange correctly filters single-day ranges (startDate === endDate)", () => {
  const singleDayRange: DateRange = {
    startDate: new Date(2026, 10, 2),
    endDate: new Date(2026, 10, 2),
  };

  assert.equal(isDateInRange("2026-11-02", singleDayRange), true, "Matching day must pass");
  assert.equal(isDateInRange("2026-11-01", singleDayRange), false, "Previous day must fail");
  assert.equal(isDateInRange("2026-11-03", singleDayRange), false, "Next day must fail");
});

test("isDateInRange handles open-ended ranges (only startDate or only endDate)", () => {
  const startOnlyRange: DateRange = {
    startDate: new Date(2026, 10, 1),
    endDate: null,
  };
  assert.equal(isDateInRange("2026-11-01", startOnlyRange), true);
  assert.equal(isDateInRange("2026-11-15", startOnlyRange), true);
  assert.equal(isDateInRange("2026-10-31", startOnlyRange), false);

  const endOnlyRange: DateRange = {
    startDate: null,
    endDate: new Date(2026, 10, 1),
  };
  assert.equal(isDateInRange("2026-10-15", endOnlyRange), true);
  assert.equal(isDateInRange("2026-11-01", endOnlyRange), true);
  assert.equal(isDateInRange("2026-11-02", endOnlyRange), false);
});

test("isDateInRange normalizes inverted ranges where startDate > endDate", () => {
  const invertedRange: DateRange = {
    startDate: new Date(2026, 10, 10),
    endDate: new Date(2026, 10, 2),
  };
  assert.equal(isDateInRange("2026-11-02", invertedRange), true);
  assert.equal(isDateInRange("2026-11-05", invertedRange), true);
  assert.equal(isDateInRange("2026-11-10", invertedRange), true);
  assert.equal(isDateInRange("2026-11-01", invertedRange), false);
  assert.equal(isDateInRange("2026-11-11", invertedRange), false);
});

// ============================================================================
// 3. formatDateRange (Human-Readable UI Range Formatting)
// ============================================================================

test("formatDateRange renders All Time, single day, and range intervals cleanly", () => {
  assert.equal(formatDateRange({ startDate: null, endDate: null }), "All time");

  const singleDay: DateRange = {
    startDate: new Date(2026, 10, 2),
    endDate: new Date(2026, 10, 2),
  };
  assert.equal(formatDateRange(singleDay), "Nov 2, 2026");

  const multiDay: DateRange = {
    startDate: new Date(2026, 9, 27),
    endDate: new Date(2026, 10, 2),
  };
  assert.equal(formatDateRange(multiDay), "Oct 27, 2026 – Nov 2, 2026");

  const openStart: DateRange = {
    startDate: new Date(2026, 10, 2),
    endDate: null,
  };
  assert.equal(formatDateRange(openStart), "From Nov 2, 2026");

  const openEnd: DateRange = {
    startDate: null,
    endDate: new Date(2026, 10, 2),
  };
  assert.equal(formatDateRange(openEnd), "Up to Nov 2, 2026");
});

// ============================================================================
// 4. presetRange (Standard RouteX Presets)
// ============================================================================

test("presetRange calculates all standard presets correctly relative to reference date", () => {
  const ref = new Date(2026, 10, 4); // Wednesday, Nov 4, 2026

  const all = presetRange("all", ref);
  assert.equal(all.startDate, null);
  assert.equal(all.endDate, null);

  const today = presetRange("today", ref);
  assert.equal(toDateKey(today.startDate!), "2026-11-04");
  assert.equal(toDateKey(today.endDate!), "2026-11-04");

  const last7 = presetRange("last7", ref);
  assert.equal(toDateKey(last7.endDate!), "2026-11-04");
  assert.equal(toDateKey(last7.startDate!), "2026-10-29");

  const last15 = presetRange("last15", ref);
  assert.equal(toDateKey(last15.endDate!), "2026-11-04");
  assert.equal(toDateKey(last15.startDate!), "2026-10-21");

  const last30 = presetRange("last30", ref);
  assert.equal(toDateKey(last30.endDate!), "2026-11-04");
  assert.equal(toDateKey(last30.startDate!), "2026-10-06");

  const thisMonth = presetRange("month", ref);
  assert.equal(toDateKey(thisMonth.startDate!), "2026-11-01");
  assert.equal(toDateKey(thisMonth.endDate!), "2026-11-04");

  const thisYear = presetRange("year", ref);
  assert.equal(toDateKey(thisYear.startDate!), "2026-01-01");
  assert.equal(toDateKey(thisYear.endDate!), "2026-11-04");
});
