"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

type DateRange = { startDate: Date | null; endDate: Date | null };
type Preset = "all" | "today" | "week" | "month" | "last7" | "last15" | "last30";

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

function dayKey(date: Date) { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }
function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function formatShort(date: Date) { return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function addDays(date: Date, amount: number) { const next = new Date(date); next.setDate(next.getDate() + amount); return startOfDay(next); }
function isBetween(date: Date, range: DateRange) { return Boolean(range.startDate && range.endDate && date >= range.startDate && date <= range.endDate); }

function presetRange(preset: Preset): DateRange {
  const today = startOfDay(new Date());
  if (preset === "all") return { startDate: null, endDate: null };
  if (preset === "today") return { startDate: today, endDate: today };
  if (preset === "week") { const start = addDays(today, -today.getDay()); return { startDate: start, endDate: today }; }
  if (preset === "month") return { startDate: new Date(today.getFullYear(), today.getMonth(), 1), endDate: today };
  const days = preset === "last15" ? 15 : preset === "last30" ? 30 : 7;
  return { startDate: addDays(today, -(days - 1)), endDate: today };
}

function DateRangePicker() {
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [range, setRange] = useState<DateRange>(presetRange("last7"));
  const [draftStart, setDraftStart] = useState<Date | null>(range.startDate);
  const [draftEnd, setDraftEnd] = useState<Date | null>(range.endDate);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!(event.target instanceof Element) || !event.target.closest(".global-date-picker")) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
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
    setDraftStart(nextRange.startDate); setDraftEnd(nextRange.endDate); setRange(nextRange); setOpen(false); triggerRef.current?.focus();
  };

  const choosePreset = (preset: Preset) => { const next = presetRange(preset); setRange(next); setDraftStart(next.startDate); setDraftEnd(next.endDate); setOpen(false); triggerRef.current?.focus(); };
  const label = !range.startDate ? "All time" : range.startDate && range.endDate && dayKey(range.startDate) === dayKey(range.endDate) ? formatShort(range.startDate) : range.startDate && range.endDate ? `${formatShort(range.startDate)} – ${formatShort(range.endDate)}` : `${formatShort(range.startDate)} – Select end`;

  return <div className="global-date-picker">
    <button ref={triggerRef} className="global-date-filter" type="button" aria-label={`Date range: ${label}`} aria-haspopup="dialog" aria-controls={dialogId} aria-expanded={open} onClick={() => setOpen((value) => !value)}>▣&nbsp;&nbsp; {label}&nbsp;&nbsp;⌄</button>
    {open && <div ref={dialogRef} id={dialogId} className="date-picker-popover" role="dialog" aria-label="Select date range" tabIndex={-1}>
      <div className="date-picker-month"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong aria-live="polite">{monthNames[month.getMonth()]} {month.getFullYear()}</strong><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
      <div className="date-picker-weekdays" aria-hidden="true">{weekDays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="date-picker-grid" role="group" aria-label={`${monthNames[month.getMonth()]} ${month.getFullYear()}`}>{days.map((date) => { const current = date.getMonth() === month.getMonth(); const selected = Boolean((draftStart && dayKey(date) === dayKey(draftStart)) || (draftEnd && dayKey(date) === dayKey(draftEnd))); return <button type="button" key={dayKey(date)} className={`${current ? "" : "outside-month "}${selected ? "selected " : ""}${isBetween(date, { startDate: draftStart, endDate: draftEnd }) ? "in-range" : ""}`} aria-label={date.toDateString()} aria-pressed={selected} onClick={() => chooseDate(date)}>{date.getDate()}</button>; })}</div>
      <p className="date-picker-summary">{draftStart && !draftEnd ? "Select an end date" : range.startDate ? `${formatShort(range.startDate)}${range.endDate ? ` – ${formatShort(range.endDate)}` : ""}` : "Select a start and end date"}</p>
      <div className="date-picker-presets" aria-label="Date range presets">{(["all", "today", "week", "month", "last7", "last15", "last30"] as Preset[]).map((preset) => <button type="button" key={preset} onClick={() => choosePreset(preset)}>{({ all: "All time", today: "Today", week: "This Week", month: "This Month", last7: "Last 7 Days", last15: "Last 15 Days", last30: "Last 30 Days" }[preset])}</button>)}</div>
    </div>}
  </div>;
}

export function GlobalDateRangePicker() {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setTarget(document.querySelector<HTMLElement>(".topbar")); }, [pathname]);
  if (!target || pathname === "/login") return null;
  return createPortal(<DateRangePicker />, target);
}
