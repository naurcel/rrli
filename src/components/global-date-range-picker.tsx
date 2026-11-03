"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

export type DateRange = { startDate: Date | null; endDate: Date | null };
type Preset = "all" | "today" | "week" | "month" | "year" | "last7" | "last15" | "last30";
type DateRangeContextValue = { range: DateRange; setRange: (range: DateRange) => void };

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

function dayKey(date: Date) { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }
function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function formatShort(date: Date) { return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function addDays(date: Date, amount: number) { const next = new Date(date); next.setDate(next.getDate() + amount); return startOfDay(next); }
function isBetween(date: Date, range: DateRange) { return Boolean(range.startDate && range.endDate && date >= range.startDate && date <= range.endDate); }

export function isDateInRange(value: string | Date, range: DateRange) {
  if (!range.startDate || !range.endDate) return true;
  const date = startOfDay(value instanceof Date ? value : new Date(value));
  return !Number.isNaN(date.getTime()) && date >= range.startDate && date <= range.endDate;
}

export function formatDateRange(range: DateRange) {
  if (!range.startDate) return "All time";
  if (!range.endDate || dayKey(range.startDate) === dayKey(range.endDate)) return formatShort(range.startDate);
  return `${formatShort(range.startDate)} – ${formatShort(range.endDate)}`;
}

function presetRange(preset: Preset): DateRange {
  const today = startOfDay(new Date());
  if (preset === "all") return { startDate: null, endDate: null };
  if (preset === "today") return { startDate: today, endDate: today };
  if (preset === "week") { const start = addDays(today, -today.getDay()); return { startDate: start, endDate: today }; }
  if (preset === "month") return { startDate: new Date(today.getFullYear(), today.getMonth(), 1), endDate: today };
  if (preset === "year") return { startDate: new Date(today.getFullYear(), 0, 1), endDate: today };
  const days = preset === "last15" ? 15 : preset === "last30" ? 30 : 7;
  return { startDate: addDays(today, -(days - 1)), endDate: today };
}

const DATE_RANGE_STORAGE_KEY = "routex.global-date-range.v1";
const DATE_RANGE_CHANGED_EVENT = "routex:date-range-changed";

let memoryCachedRange: DateRange | null = null;
let memoryInitialized = false;

function serializeDateRange(range: DateRange): string {
  return JSON.stringify({
    startDate: range.startDate ? range.startDate.toISOString() : null,
    endDate: range.endDate ? range.endDate.toISOString() : null,
    isAllTime: !range.startDate && !range.endDate,
  });
}

function parseStoredDateRange(raw: string): DateRange | null {
  try {
    const parsed = JSON.parse(raw) as {
      startDate?: string | null;
      endDate?: string | null;
      isAllTime?: boolean;
    };
    if (parsed.isAllTime) {
      return { startDate: null, endDate: null };
    }
    const start = parsed.startDate ? new Date(parsed.startDate) : null;
    const end = parsed.endDate ? new Date(parsed.endDate) : null;
    if (start && isNaN(start.getTime())) return null;
    if (end && isNaN(end.getTime())) return null;
    if (start || end) {
      return { startDate: start, endDate: end };
    }
    return null;
  } catch {
    return null;
  }
}

function getStoredDateRange(): DateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DATE_RANGE_STORAGE_KEY);
    if (!raw) return null;
    return parseStoredDateRange(raw);
  } catch {
    return null;
  }
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function GlobalDateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRangeState] = useState<DateRange>(() => {
    if (memoryCachedRange) {
      return memoryCachedRange;
    }
    const stored = getStoredDateRange();
    if (stored) {
      memoryCachedRange = stored;
      memoryInitialized = true;
      return stored;
    }
    const fallback = presetRange("last7");
    memoryCachedRange = fallback;
    return fallback;
  });

  const setRange = (next: DateRange | ((prev: DateRange) => DateRange)) => {
    setRangeState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      memoryCachedRange = resolved;
      memoryInitialized = true;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(DATE_RANGE_STORAGE_KEY, serializeDateRange(resolved));
          window.dispatchEvent(new CustomEvent(DATE_RANGE_CHANGED_EVENT, { detail: resolved }));
        } catch {
          // Ignore storage errors
        }
      }
      return resolved;
    });
  };

  useEffect(() => {
    if (!memoryInitialized) {
      const stored = getStoredDateRange();
      if (stored) {
        memoryCachedRange = stored;
        memoryInitialized = true;
        setRangeState(stored);
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === DATE_RANGE_STORAGE_KEY && event.newValue) {
        const parsed = parseStoredDateRange(event.newValue);
        if (parsed) {
          memoryCachedRange = parsed;
          setRangeState(parsed);
        }
      }
    };

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<DateRange>;
      if (customEvent.detail) {
        setRangeState(customEvent.detail);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(DATE_RANGE_CHANGED_EVENT, handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(DATE_RANGE_CHANGED_EVENT, handleCustomEvent);
    };
  }, []);

  return <DateRangeContext.Provider value={{ range, setRange }}>{children}</DateRangeContext.Provider>;
}

export function useGlobalDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) throw new Error("useGlobalDateRange must be used within GlobalDateRangeProvider");
  return context;
}

export function GlobalDateRangePicker() {
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [month, setMonth] = useState(() => new Date(2000, 0, 1));
  const [viewMode, setViewMode] = useState<"days" | "months">("days");
  const { range, setRange } = useGlobalDateRange();
  const [draftStart, setDraftStart] = useState<Date | null>(range.startDate);
  const [draftEnd, setDraftEnd] = useState<Date | null>(range.endDate);

  const closePopover = (restoreFocus = false) => {
    setOpen(false);
    setIsClosing(true);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => { setMonth(startOfDay(new Date())); }, []);
  useEffect(() => {
    setDraftStart(range.startDate);
    setDraftEnd(range.endDate);
    if (range.endDate) setMonth(range.endDate);
  }, [range]);

  useEffect(() => {
    if (!isClosing) return;
    const timeout = window.setTimeout(() => setIsClosing(false), 180);
    return () => window.clearTimeout(timeout);
  }, [isClosing]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!(event.target instanceof Element) || !event.target.closest(".global-date-picker")) closePopover(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closePopover(true);
    };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const selectedDate = dialogRef.current?.querySelector<HTMLButtonElement>(".date-picker-grid button.selected");
      (selectedDate ?? dialogRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [month]);

  const chooseDate = (date: Date) => {
    if (!draftStart || (draftStart && draftEnd)) { setDraftStart(date); setDraftEnd(null); return; }
    const nextRange = date < draftStart ? { startDate: date, endDate: draftStart } : { startDate: draftStart, endDate: date };
    setDraftStart(nextRange.startDate); setDraftEnd(nextRange.endDate); setRange(nextRange); closePopover(true);
  };

  const choosePreset = (preset: Preset) => { const next = presetRange(preset); setRange(next); setDraftStart(next.startDate); setDraftEnd(next.endDate); closePopover(true); };
  const chooseMonth = (monthIndex: number) => { setMonth(new Date(month.getFullYear(), monthIndex, 1)); setViewMode("days"); };
  const label = range.startDate && !range.endDate ? `${formatShort(range.startDate)} – Select end` : formatDateRange(range);

  return <div className="global-date-picker">
    <button ref={triggerRef} className="global-date-filter" type="button" aria-label={`Date range: ${label}`} aria-haspopup="dialog" aria-controls={dialogId} aria-expanded={open} onClick={() => { if (open) closePopover(); else { setIsClosing(false); setOpen(true); } }}>
      <svg className="global-date-filter-icon" aria-hidden="true" viewBox="0 0 24 24" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
      <span>{label}</span>
      <span className="dropdown-chevron" aria-hidden="true" />
    </button>
    {(open || isClosing) && <div ref={dialogRef} id={dialogId} className={`date-picker-popover${isClosing ? " is-closing" : ""}`} role="dialog" aria-label="Select date range" tabIndex={-1} onAnimationEnd={() => { if (isClosing) setIsClosing(false); }}>
      {viewMode === "months" ? <div className="date-picker-month-selector"><div className="date-picker-month"><button type="button" aria-label="Previous year" onClick={() => setMonth(new Date(month.getFullYear() - 1, month.getMonth(), 1))}>‹</button><strong aria-live="polite">{month.getFullYear()}</strong><button type="button" aria-label="Next year" onClick={() => setMonth(new Date(month.getFullYear() + 1, month.getMonth(), 1))}>›</button></div><div className="date-picker-months" role="group" aria-label={`Choose a month in ${month.getFullYear()}`}>{monthNames.map((name, index) => <button key={name} className={index === month.getMonth() ? "selected" : ""} type="button" onClick={() => chooseMonth(index)}>{name}</button>)}</div></div> : <>
      <div className="date-picker-month"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong aria-live="polite">{monthNames[month.getMonth()]} {month.getFullYear()}</strong><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
      <button className="date-picker-month-mode-toggle" type="button" aria-label="Choose month and year" onClick={() => setViewMode("months")} />
      <div className="date-picker-weekdays" aria-hidden="true">{weekDays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="date-picker-grid" role="group" aria-label={`${monthNames[month.getMonth()]} ${month.getFullYear()}`}>{days.map((date) => { const current = date.getMonth() === month.getMonth(); const selected = Boolean((draftStart && dayKey(date) === dayKey(draftStart)) || (draftEnd && dayKey(date) === dayKey(draftEnd))); return <button type="button" key={dayKey(date)} className={`${current ? "" : "outside-month "}${selected ? "selected " : ""}${isBetween(date, { startDate: draftStart, endDate: draftEnd }) ? "in-range" : ""}`} aria-label={date.toDateString()} aria-pressed={selected} onClick={() => chooseDate(date)}>{date.getDate()}</button>; })}</div></>}
      <p className="date-picker-summary">{draftStart && !draftEnd ? "Select an end date" : range.startDate ? `${formatShort(range.startDate)}${range.endDate ? ` – ${formatShort(range.endDate)}` : ""}` : "Select a start and end date"}</p>
      <div className="date-picker-presets" aria-label="Date range presets">{(["all", "today", "week", "month", "year", "last7", "last15", "last30"] as Preset[]).map((preset) => <button type="button" key={preset} onClick={() => choosePreset(preset)}>{({ all: "All time", today: "Today", week: "This Week", month: "This Month", year: "This Year", last7: "Last 7 Days", last15: "Last 15 Days", last30: "Last 30 Days" }[preset])}</button>)}</div>
    </div>}
  </div>;
}
