"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  addDays,
  dayKey,
  formatDateRange,
  formatShortDate,
  isBetweenDates,
  isDateInRange,
  MONTH_NAMES,
  parseDateValue,
  presetRange,
  startOfDay,
  toDateKey,
  type DatePreset,
  type DateRange,
  WEEK_DAYS,
} from "./date-range-utils";

export {
  addDays,
  dayKey,
  formatDateRange,
  formatShortDate,
  isBetweenDates,
  isDateInRange,
  MONTH_NAMES,
  parseDateValue,
  presetRange,
  startOfDay,
  toDateKey,
  type DatePreset,
  type DateRange,
  WEEK_DAYS,
};

type DateRangeContextValue = {
  range: DateRange;
  setRange: (range: DateRange) => void;
};

const monthNames = MONTH_NAMES;
const weekDays = WEEK_DAYS;
const formatShort = formatShortDate;
const isBetween = isBetweenDates;

const DATE_RANGE_STORAGE_KEY = "routex.global-date-range.v1";
const DATE_RANGE_CHANGED_EVENT = "routex:date-range-changed";

let memoryCachedRange: DateRange | null = null;
let memoryInitialized = false;

function serializeDateRange(range: DateRange): string {
  return JSON.stringify({
    startDate: range.startDate ? toDateKey(range.startDate) : null,
    endDate: range.endDate ? toDateKey(range.endDate) : null,
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
    if (parsed.isAllTime || (!parsed.startDate && !parsed.endDate)) {
      return { startDate: null, endDate: null };
    }
    const start = parsed.startDate ? parseDateValue(parsed.startDate) : null;
    const end = parsed.endDate ? parseDateValue(parsed.endDate) : null;
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

  return (
    <DateRangeContext.Provider value={{ range, setRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useGlobalDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error(
      "useGlobalDateRange must be used within GlobalDateRangeProvider",
    );
  }
  return context;
}

export function GlobalDateRangePicker() {
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  // Calendar month state
  const [month, setMonth] = useState(() => new Date(2026, 10, 1)); // Default to Nov 2026
  const [viewMode, setViewMode] = useState<"days" | "months" | "years">("days");

  const { range, setRange } = useGlobalDateRange();
  const [draftStart, setDraftStart] = useState<Date | null>(range.startDate);
  const [draftEnd, setDraftEnd] = useState<Date | null>(range.endDate);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Available years for dropdown selection
  const yearOptions = useMemo(() => {
    const current = month.getFullYear();
    const min = Math.min(2020, current);
    const max = Math.max(2032, current);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [month]);

  // Year decade block for years view
  const decadeStart = Math.floor(month.getFullYear() / 12) * 12;
  const decadeYears = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => decadeStart + i);
  }, [decadeStart]);

  const closePopover = (restoreFocus = false) => {
    setOpen(false);
    setIsClosing(true);
    setHoverDate(null);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  // Sync draft states when range changes
  useEffect(() => {
    setMonth(startOfDay(new Date()));
  }, []);

  useEffect(() => {
    setDraftStart(range.startDate);
    setDraftEnd(range.endDate);
    if (range.endDate) {
      setMonth(range.endDate);
      setMonth(new Date(range.endDate.getFullYear(), range.endDate.getMonth(), 1));
    } else if (range.startDate) {
      setMonth(new Date(range.startDate.getFullYear(), range.startDate.getMonth(), 1));
    }
  }, [range]);

  useEffect(() => {
    if (!isClosing) return;
    const timeout = window.setTimeout(() => setIsClosing(false), 180);
    return () => window.clearTimeout(timeout);
  }, [isClosing]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(".global-date-picker")
      ) {
        closePopover();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closePopover(true);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const selectedDate =
        dialogRef.current?.querySelector<HTMLButtonElement>(
          ".date-picker-grid button.selected",
        );
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
    const normalized = startOfDay(date);

    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(date);
      setDraftStart(normalized);
      setDraftEnd(null);
      setHoverDate(null);
      return;
    }

    // Second click: finalize range selection
    const start = startOfDay(draftStart);
    const end = normalized;
    const nextRange =
      date < draftStart
        ? { startDate: date, endDate: draftStart }
        : { startDate: draftStart, endDate: date };
      end.getTime() < start.getTime()
        ? { startDate: end, endDate: start }
        : { startDate: start, endDate: end };

    setDraftStart(nextRange.startDate);
    setDraftEnd(nextRange.endDate);
    setHoverDate(null);
    setRange(nextRange);
    closePopover(true);
  };

  const applySingleDay = (targetDate: Date) => {
    const normalized = startOfDay(targetDate);
    const singleRange: DateRange = { startDate: normalized, endDate: normalized };
    setDraftStart(normalized);
    setDraftEnd(normalized);
    setHoverDate(null);
    setRange(singleRange);
    closePopover(true);
  };

  const choosePreset = (preset: DatePreset) => {
    const next = presetRange(preset);
    setRange(next);
    setDraftStart(next.startDate);
    setDraftEnd(next.endDate);
    setHoverDate(null);
    if (next.endDate) {
      setMonth(new Date(next.endDate.getFullYear(), next.endDate.getMonth(), 1));
    } else if (next.startDate) {
      setMonth(new Date(next.startDate.getFullYear(), next.startDate.getMonth(), 1));
    }
    closePopover(true);
  };

  const chooseMonth = (monthIndex: number) => {
    setMonth(new Date(month.getFullYear(), monthIndex, 1));
    setViewMode("days");
  };

  const chooseYear = (year: number) => {
    setMonth(new Date(year, month.getMonth(), 1));
    setViewMode("days");
  };

  const label =
    range.startDate && !range.endDate
      ? `${formatShort(range.startDate)} – Select end`
      : formatDateRange(range);

  return (
    <div className="global-date-picker">
      <button
        ref={triggerRef}
        className="global-date-filter"
        type="button"
        aria-label={`Date range: ${label}`}
        aria-haspopup="dialog"
        aria-controls={dialogId}
        aria-expanded={open}
        onClick={() => {
          if (open) {
            closePopover();
          } else {
            setIsClosing(false);
            setOpen(true);
          }
        }}
      >
        <svg
          className="global-date-filter-icon"
          aria-hidden="true"
          viewBox="0 0 24 24"
          focusable="false"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
        <span>{label}</span>
        <span className="dropdown-chevron" aria-hidden="true" />
      </button>

      {(open || isClosing) && (
        <div
          ref={dialogRef}
          id={dialogId}
          className={`date-picker-popover${isClosing ? " is-closing" : ""}`}
          role="dialog"
          aria-label="Select date range"
          tabIndex={-1}
          onAnimationEnd={() => {
            if (isClosing) setIsClosing(false);
          }}
        >
          {/* View Mode 1: Month Grid Selector */}
          {viewMode === "months" ? (
            <div className="date-picker-month-selector">
              <div className="date-picker-month">
                <button
                  type="button"
                  aria-label="Previous year"
                  onClick={() =>
                    setMonth(new Date(month.getFullYear() - 1, month.getMonth(), 1))
                  }
                >
                  ‹
                </button>
                <strong aria-live="polite">{month.getFullYear()}</strong>
                <div className="date-picker-month-year-labels">
                  <select
                    className="date-picker-year-dropdown"
                    aria-label="Select year"
                    value={month.getFullYear()}
                    onChange={(e) => {
                      const yr = Number(e.target.value);
                      setMonth(new Date(yr, month.getMonth(), 1));
                    }}
                  >
                    {yearOptions.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  aria-label="Next year"
                  onClick={() =>
                    setMonth(new Date(month.getFullYear() + 1, month.getMonth(), 1))
                  }
                >
                  ›
                </button>
              </div>
              <div
                className="date-picker-months"
                role="group"
                aria-label={`Choose a month in ${month.getFullYear()}`}
              >
                {monthNames.map((name, index) => (
                  <button
                    key={name}
                    className={index === month.getMonth() ? "selected" : ""}
                    type="button"
                    onClick={() => chooseMonth(index)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                <button
                  type="button"
                  className="date-picker-back-btn"
                  onClick={() => setViewMode("years")}
                >
                  Browse Years »
                </button>
                <button
                  type="button"
                  className="date-picker-back-btn"
                  onClick={() => setViewMode("days")}
                >
                  ← Back to Days
                </button>
              </div>
            </div>
          ) : viewMode === "years" ? (
            /* View Mode 2: Multi-Year Grid Selector */
            <div className="date-picker-year-selector">
              <div className="date-picker-month">
                <button
                  type="button"
                  aria-label="Previous 12 years"
                  onClick={() =>
                    setMonth(new Date(month.getFullYear() - 12, month.getMonth(), 1))
                  }
                >
                  ‹
                </button>
                <strong aria-live="polite">
                  {decadeYears[0]} – {decadeYears[decadeYears.length - 1]}
                </strong>
                <button
                  type="button"
                  aria-label="Next 12 years"
                  onClick={() =>
                    setMonth(new Date(month.getFullYear() + 12, month.getMonth(), 1))
                  }
                >
                  ›
                </button>
              </div>
              <div
                className="date-picker-months"
                role="group"
                aria-label={`Choose a year between ${decadeYears[0]} and ${decadeYears[decadeYears.length - 1]}`}
              >
                {decadeYears.map((yr) => (
                  <button
                    key={yr}
                    className={yr === month.getFullYear() ? "selected" : ""}
                    type="button"
                    onClick={() => chooseYear(yr)}
                  >
                    {yr}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  className="date-picker-back-btn"
                  onClick={() => setViewMode("days")}
                >
                  ← Back to Days
                </button>
              </div>
            </div>
          ) : (
            /* View Mode 3: Standard Days Calendar */
            <>
              <div className="date-picker-month">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
                  }
                >
                  ‹
                </button>
                <strong aria-live="polite">
                  {monthNames[month.getMonth()]} {month.getFullYear()}
                </strong>
                <div className="date-picker-month-year-labels">
                  <button
                    type="button"
                    className="date-picker-mode-btn"
                    aria-label="Choose month"
                    onClick={() => setViewMode("months")}
                  >
                    {monthNames[month.getMonth()]} ▾
                  </button>
                  <select
                    className="date-picker-year-dropdown"
                    aria-label="Select year"
                    value={month.getFullYear()}
                    onChange={(e) => {
                      const yr = Number(e.target.value);
                      setMonth(new Date(yr, month.getMonth(), 1));
                    }}
                  >
                    {yearOptions.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
                  }
                >
                  ›
                </button>
              </div>
              <button
                className="date-picker-month-mode-toggle"
                type="button"
                aria-label="Choose month and year"
                onClick={() => setViewMode("months")}
              />

              <div className="date-picker-weekdays" aria-hidden="true">
                {weekDays.map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
              </div>

              <div
                className="date-picker-grid"
                role="group"
                aria-label={`${monthNames[month.getMonth()]} ${month.getFullYear()}`}
                onMouseLeave={() => setHoverDate(null)}
              >
                {days.map((date) => {
                  const current = date.getMonth() === month.getMonth();
                  const selected = Boolean(
                    (draftStart && dayKey(date) === dayKey(draftStart)) ||
                      (draftEnd && dayKey(date) === dayKey(draftEnd)),
                  );
                  const inConfirmedRange = isBetween(date, {
                    startDate: draftStart,
                    endDate: draftEnd,
                  });
                  const inHoverPreview = Boolean(
                    draftStart &&
                      !draftEnd &&
                      hoverDate &&
                      isBetween(date, {
                        startDate: draftStart,
                        endDate: hoverDate,
                      }),
                  );

                  return (
                    <button
                      type="button"
                      key={dayKey(date)}
                      className={`${current ? "" : "outside-month "}${
                        selected ? "selected " : ""
                      }${
                        isBetween(date, {
                          startDate: draftStart,
                          endDate: draftEnd,
                        })
                          ? "in-range"
                          : ""
                      }${inConfirmedRange ? "in-range " : ""}${
                        inHoverPreview ? "in-range-preview " : ""
                      }`}
                      aria-label={date.toDateString()}
                      aria-pressed={selected}
                      onClick={() => chooseDate(date)}
                      onMouseEnter={() => {
                        if (draftStart && !draftEnd) {
                          setHoverDate(date);
                        }
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <p className="date-picker-summary">
            {draftStart && !draftEnd
              ? "Select an end date"
              : range.startDate
                ? `${formatShort(range.startDate)}${
                    range.endDate ? ` – ${formatShort(range.endDate)}` : ""
                  }`
                : "Select a start and end date"}
          </p>

          {/* Interactive Date Selection Summary & Single-Day Apply */}
          <div className="date-picker-summary-container">
            {draftStart && !draftEnd ? (
              <div className="date-picker-pending-selection">
                <span className="date-picker-pending-text">
                  Start: <strong>{formatShort(draftStart)}</strong> · Select end date
                </span>
                <div className="date-picker-pending-actions">
                  <button
                    type="button"
                    className="date-picker-action-btn"
                    onClick={() => applySingleDay(draftStart)}
                  >
                    Filter Just This Day
                  </button>
                  <button
                    type="button"
                    className="date-picker-cancel-btn"
                    onClick={() => {
                      setDraftStart(null);
                      setDraftEnd(null);
                      setHoverDate(null);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <p className="date-picker-summary">
                {range.startDate
                  ? `${formatShort(range.startDate)}${
                      range.endDate && dayKey(range.startDate) !== dayKey(range.endDate)
                        ? ` – ${formatShort(range.endDate)}`
                        : ""
                    }`
                  : "All time records"}
              </p>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="date-picker-presets" aria-label="Date range presets">
            {(
              [
                "all",
                "today",
                "week",
                "month",
                "year",
                "last7",
                "last15",
                "last30",
              ] as DatePreset[]
            ).map((preset) => (
              <button
                type="button"
                key={preset}
                onClick={() => choosePreset(preset)}
              >
                {
                  {
                    all: "All time",
                    today: "Today",
                    week: "This Week",
                    month: "This Month",
                    year: "This Year",
                    last7: "Last 7 Days",
                    last15: "Last 15 Days",
                    last30: "Last 30 Days",
                  }[preset]
                }
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

