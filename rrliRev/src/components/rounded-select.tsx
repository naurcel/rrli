"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  readonly value: string;
  readonly label: string;
  readonly group?: string;
};

type MenuPosition = {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
};

export function RoundedSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  placeholder = "Select an option",
  emptyMessage = "No options available",
  searchable = false,
}: {
  value: string;
  options: readonly (string | SelectOption)[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
  emptyMessage?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const normalizedOptions = useMemo<SelectOption[]>(() => options
    .map((option) => typeof option === "string" ? { value: option, label: option } : option)
    .filter((option) => option.label.trim().length > 0), [options]);
  const selectedOption =
    normalizedOptions.find((option) => option.value === value) ??
    normalizedOptions[0];
  const triggerLabel = selectedOption?.label ?? (value.trim() || placeholder);
  const visibleOptions = searchable && query.trim()
    ? normalizedOptions.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    : normalizedOptions;

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (searchable) window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open, searchable]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    function positionMenu() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const estimatedHeight = Math.min(320, normalizedOptions.length * 42 + 12 + (searchable ? 50 : 0));
      const openAbove = window.innerHeight - rect.bottom < estimatedHeight + 16 && rect.top > estimatedHeight;
      setMenuPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: rect.width,
        ...(openAbove
          ? { bottom: window.innerHeight - rect.top + 7 }
          : { top: rect.bottom + 7 }),
      });
    }

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [normalizedOptions.length, open, searchable]);

  return (
    <div
      ref={containerRef}
      className={`rounded-select${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className="rounded-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={!selectedOption && !value ? "rounded-select-placeholder" : undefined}>{triggerLabel}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && menuPosition && typeof document !== "undefined" ? createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="rounded-select-menu rounded-select-menu-portal"
          style={menuPosition}
        >
          {searchable ? (
            <div className="rounded-select-search-wrap">
              <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type to search…" aria-label={`Search ${ariaLabel.toLocaleLowerCase()}`} />
            </div>
          ) : null}
          {visibleOptions.length === 0 ? <p className="rounded-select-empty">{query ? "No matching options" : emptyMessage}</p> : visibleOptions.map((option, index) => {
            const isSelected = option.value === value;
            const showGroup = option.group && option.group !== visibleOptions[index - 1]?.group;
            return (
              <div className="rounded-select-option-group" key={`${option.group ?? "default"}:${option.value}:${index}`}>
                {showGroup ? <span className="rounded-select-group-label">{option.group}</span> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={isSelected ? "selected" : undefined}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </div>
            );
          })}
        </div>
      , document.body) : null}
    </div>
  );
}

