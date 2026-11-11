"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  addDays,
  dayKey,
  formatShortDate,
  MONTH_NAMES,
  parseDateValue,
  startOfDay,
  toDateKey,
} from "./date-range-utils";

export interface SingleDatePickerProps {
  value: string;
  onChange: (dateStr: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
}

const SHORT_WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export function SingleDatePicker({
  value,
  onChange,
  min = "2024-01-01",
  max,
  required = false,
  disabled = false,
  id,
  ariaLabel = "Select date",
  className = "",
  placeholder = "Select date",
}: SingleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  // Current viewing month
  const initialDate = useMemo(() => {
    if (!value) return new Date();
    const parsed = parseDateValue(value);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [value]);

  const [viewMonth, setViewMonth] = useState<Date>(() => startOfDay(initialDate));

  useEffect(() => {
    if (value) {
      const parsed = parseDateValue(value);
      if (!isNaN(parsed.getTime())) {
        setViewMonth(startOfDay(parsed));
      }
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Grid computation (42 cells)
  const days = useMemo(() => {
    const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const dayOfWeek = firstOfMonth.getDay(); // 0 is Sunday
    const start = addDays(firstOfMonth, -dayOfWeek);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [viewMonth]);

  const minDate = useMemo(() => (min ? parseDateValue(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseDateValue(max) : null), [max]);
  const today = useMemo(() => startOfDay(new Date()), []);

  const isDayDisabled = (d: Date): boolean => {
    const time = d.getTime();
    if (minDate && time < minDate.getTime()) return true;
    if (maxDate && time > maxDate.getTime()) return true;
    return false;
  };

  const handlePrevMonth = () => {
    const prev = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
    if (minDate && new Date(prev.getFullYear(), prev.getMonth() + 1, 0) < minDate) {
      return;
    }
    setViewMonth(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    if (maxDate && new Date(next.getFullYear(), next.getMonth(), 1) > maxDate) {
      return;
    }
    setViewMonth(next);
  };

  const handleSelectDay = (d: Date) => {
    if (isDayDisabled(d)) return;
    onChange(toDateKey(d));
    setIsOpen(false);
  };

  const handleSetToday = () => {
    if (isDayDisabled(today)) return;
    onChange(toDateKey(today));
    setViewMonth(today);
    setIsOpen(false);
  };

  const displayLabel = useMemo(() => {
    if (!value) return placeholder;
    const parsed = parseDateValue(value);
    if (isNaN(parsed.getTime())) return placeholder;
    return formatShortDate(parsed);
  }, [value, placeholder]);

  return (
    <div className={`single-date-picker-wrap ${className}`} ref={containerRef}>
      <button
        id={id}
        type="button"
        className={`single-date-picker-trigger${isOpen ? " is-open" : ""}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={dialogId}
        aria-label={ariaLabel}
      >
        <span className={`single-date-picker-text${!value ? " is-placeholder" : ""}`}>
          {displayLabel}
        </span>
        <svg
          className="single-date-picker-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Hidden input to support native form validation if required */}
      {required && (
        <input
          type="text"
          value={value}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
          onChange={() => {}}
        />
      )}

      {isOpen && (
        <div
          id={dialogId}
          className="single-date-picker-popover"
          role="dialog"
          aria-label={ariaLabel}
          tabIndex={-1}
        >
          {/* Header */}
          <div className="single-date-picker-header">
            <button
              type="button"
              className="single-date-picker-nav-btn"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              title="Previous month"
            >
              ‹
            </button>
            <strong className="single-date-picker-month-title">
              {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </strong>
            <button
              type="button"
              className="single-date-picker-nav-btn"
              onClick={handleNextMonth}
              aria-label="Next month"
              title="Next month"
            >
              ›
            </button>
          </div>

          {/* Weekday Header */}
          <div className="single-date-picker-weekdays" aria-hidden="true">
            {SHORT_WEEK_DAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          {/* Day Grid */}
          <div className="single-date-picker-grid" role="group">
            {days.map((d) => {
              const isCurrentMonth = d.getMonth() === viewMonth.getMonth();
              const isSelected = value ? dayKey(d) === dayKey(parseDateValue(value)) : false;
              const isCurrentDay = dayKey(d) === dayKey(today);
              const disabledDay = isDayDisabled(d);

              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  className={`single-date-picker-day${!isCurrentMonth ? " outside-month" : ""}${
                    isSelected ? " selected" : ""
                  }${isCurrentDay ? " is-today" : ""}`}
                  disabled={disabledDay}
                  onClick={() => handleSelectDay(d)}
                  aria-pressed={isSelected}
                  aria-label={d.toDateString()}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Actions */}
          <div className="single-date-picker-footer">
            <button
              type="button"
              className="single-date-picker-today-btn"
              onClick={handleSetToday}
              disabled={isDayDisabled(today)}
            >
              Today
            </button>
            <button
              type="button"
              className="single-date-picker-close-btn"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
