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
const COMPANY_FOUNDATION_YEAR = 2024;

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
    const fallback = presetRange("all");
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
  const [month, setMonth] = useState(() => new Date(2026, 10, 1));
  const [viewMode, setViewMode] = useState<"days" | "months">("days");

  const { range, setRange } = useGlobalDateRange();
  const [draftStart, setDraftStart] = useState<Date | null>(range.startDate);
  const [draftEnd, setDraftEnd] = useState<Date | null>(range.endDate);

  const closePopover = (restoreFocus = false) => {
    setOpen(false);
    setIsClosing(true);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  useEffect(() => {
    setMonth(startOfDay(new Date()));
  }, []);

  useEffect(() => {
    setDraftStart(range.startDate);
    setDraftEnd(range.endDate);
    if (range.endDate) {
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
    if (date.getFullYear() < COMPANY_FOUNDATION_YEAR) return;
    const normalized = startOfDay(date);

    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(normalized);
      setDraftEnd(null);
      return;
    }

    const start = startOfDay(draftStart);
    const nextRange =
      normalized.getTime() < start.getTime()
        ? { startDate: normalized, endDate: start }
        : { startDate: start, endDate: normalized };

    setDraftStart(nextRange.startDate);
    setDraftEnd(nextRange.endDate);
    setRange(nextRange);
    closePopover(true);
  };

  const choosePreset = (preset: DatePreset) => {
    const next = presetRange(preset);
    setRange(next);
    setDraftStart(next.startDate);
    setDraftEnd(next.endDate);
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

  const label =
    range.startDate && !range.endDate
      ? `${formatShort(range.startDate)} – Select end`
      : formatDateRange(range);

  return (
    <div className="global-date-picker">
      <button
        ref={triggerRef}
        className={`global-date-filter${range.startDate || range.endDate ? " has-active" : ""}`}
        type="button"
        aria-label={`Date range: ${label}`}
        title={`Filter workspace by date: ${label}`}
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
          {viewMode === "months" ? (
            <div className="date-picker-month-selector">
              <div className="date-picker-month">
                <button
                  type="button"
                  aria-label="Previous year"
                  title="Previous year"
                  disabled={month.getFullYear() <= COMPANY_FOUNDATION_YEAR}
                  onClick={() => {
                    if (month.getFullYear() > COMPANY_FOUNDATION_YEAR) {
                      setMonth(new Date(month.getFullYear() - 1, month.getMonth(), 1));
                    }
                  }}
                >
                  ‹
                </button>
                <strong aria-live="polite">{month.getFullYear()}</strong>
                <button
                  type="button"
                  aria-label="Next year"
                  title="Next year"
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
            </div>
          ) : (
            <>
              <div className="date-picker-month">
                <button
                  type="button"
                  aria-label="Previous month"
                  title="Previous month"
                  disabled={month.getFullYear() <= COMPANY_FOUNDATION_YEAR && month.getMonth() <= 0}
                  onClick={() => {
                    const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
                    if (prev.getFullYear() >= COMPANY_FOUNDATION_YEAR) {
                      setMonth(prev);
                    }
                  }}
                >
                  ‹
                </button>
                <strong
                  aria-live="polite"
                  style={{ cursor: "pointer" }}
                  onClick={() => setViewMode("months")}
                  title="Click to select month"
                >
                  {monthNames[month.getMonth()]} {month.getFullYear()}
                </strong>
                <button
                  type="button"
                  aria-label="Next month"
                  title="Next month"
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
                title="Choose month and year"
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
              >
                {days.map((date) => {
                  const current = date.getMonth() === month.getMonth();
                  const isBeforeFoundation = date.getFullYear() < COMPANY_FOUNDATION_YEAR;
                  const selected = Boolean(
                    (draftStart && dayKey(date) === dayKey(draftStart)) ||
                      (draftEnd && dayKey(date) === dayKey(draftEnd)),
                  );
                  const inRange = isBetween(date, {
                    startDate: draftStart,
                    endDate: draftEnd,
                  });
                  return (
                    <button
                      type="button"
                      key={dayKey(date)}
                      className={`${current ? "" : "outside-month "}${
                        selected ? "selected " : ""
                      }${inRange ? "in-range" : ""}`}
                      aria-label={date.toDateString()}
                      aria-pressed={selected}
                      disabled={isBeforeFoundation}
                      onClick={() => !isBeforeFoundation && chooseDate(date)}
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
                    range.endDate && dayKey(range.startDate) !== dayKey(range.endDate)
                      ? ` – ${formatShort(range.endDate)}`
                      : ""
                  }`
                : "All time records"}
          </p>

          <div className="date-picker-presets" aria-label="Date range presets">
            {(
              [
                "all",
                "today",
                "week",
                "month",
                "year",
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
                  }[preset as "all" | "today" | "week" | "month" | "year"]
                }
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
