"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  readonly value: string;
  readonly label: string;
  readonly group?: string;
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
  allowCustomValue = false,
  searchPlaceholder = "Type to search...",
  customValueLabel,
  inputFilter,
}: {
  value: string;
  options: readonly (string | SelectOption)[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
  emptyMessage?: string;
  searchable?: boolean;
  allowCustomValue?: boolean;
  searchPlaceholder?: string;
  customValueLabel?: (query: string) => React.ReactNode;
  inputFilter?: (raw: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [opensAbove, setOpensAbove] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    minWidth: number;
    maxWidth: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const normalizedOptions = useMemo<SelectOption[]>(
    () =>
      options
        .map((option) =>
          typeof option === "string" ? { value: option, label: option } : option,
        )
        .filter((option) => option.label.trim().length > 0),
    [options],
  );

  const matchedOption = normalizedOptions.find((option) => option.value === value);
  const selectedOption = matchedOption ?? (!allowCustomValue ? normalizedOptions[0] : undefined);
  const triggerLabel = matchedOption?.label ?? (value.trim() || selectedOption?.label || placeholder);
  const trimmedQuery = query.trim();
  const canUseCustomValue = Boolean(
    allowCustomValue &&
    trimmedQuery &&
    !normalizedOptions.some(
      (option) => option.label.toLocaleLowerCase() === trimmedQuery.toLocaleLowerCase(),
    ),
  );
  const visibleOptions =
    searchable && query.trim()
      ? normalizedOptions.filter((option) =>
          option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
        )
      : normalizedOptions;

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (searchable) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent | MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        containerRef.current?.querySelector<HTMLButtonElement>("button.rounded-select-trigger")?.focus();
      } else if (event.key === "Tab") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Position the menu in a body-level portal so modal dialogs, footers, tables, and
  // scrollable containers can never clip or trap it.
  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }

    const GAP = 5;
    const MARGIN = 8;

    const updatePosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Close dropdown if the trigger is completely scrolled off screen
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
        return;
      }

      const menuEl = menuRef.current;
      const estimatedHeight = Math.min(320, normalizedOptions.length * 38 + (searchable ? 52 : 20));
      const menuHeight = menuEl?.offsetHeight || estimatedHeight;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const above = spaceBelow < menuHeight + GAP + MARGIN && spaceAbove > spaceBelow;

      let top = above ? rect.top - menuHeight - GAP : rect.bottom + GAP;
      top = Math.max(MARGIN, Math.min(top, window.innerHeight - menuHeight - MARGIN));

      const minWidth = rect.width;
      const maxWidth = Math.max(rect.width, Math.min(380, window.innerWidth - MARGIN * 2));
      const menuWidth = menuEl?.offsetWidth || rect.width;

      let left = rect.left;
      const right = left + menuWidth > window.innerWidth - MARGIN;
      if (right) {
        left = Math.max(MARGIN, rect.right - menuWidth);
      }
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - menuWidth - MARGIN));

      setOpensAbove(above);
      setAlignRight(right);
      setMenuPos({ top, left, minWidth, maxWidth });
    };

    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, normalizedOptions.length, visibleOptions.length, canUseCustomValue, searchable]);

  return (
    <div
      ref={containerRef}
      className={`rounded-select${open ? " is-open" : ""}${opensAbove ? " opens-above" : ""}${alignRight ? " align-right" : ""}${className ? ` ${className}` : ""}`}
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
        <span className={!selectedOption && !value ? "rounded-select-placeholder" : undefined}>
          {triggerLabel}
        </span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className={`rounded-select-portal-wrapper ${className}`}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            zIndex: 99999,
            pointerEvents: "none",
          }}
        >
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            className={`rounded-select-menu is-portaled${opensAbove ? " opens-above" : ""}${alignRight ? " align-right" : ""}`}
            style={{
              position: "fixed",
              top: menuPos?.top ?? -9999,
              left: menuPos?.left ?? -9999,
              minWidth: menuPos?.minWidth,
              maxWidth: menuPos?.maxWidth,
              right: "auto",
              bottom: "auto",
              margin: 0,
              zIndex: 99999,
              visibility: menuPos ? "visible" : "hidden",
              pointerEvents: "auto",
              transformOrigin: `${opensAbove ? "bottom" : "top"} ${alignRight ? "right" : "left"}`,
            }}
          >
            {searchable ? (
              <div className="rounded-select-search-wrap">
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => {
                    const next = inputFilter
                      ? inputFilter(event.target.value)
                      : event.target.value;
                    setQuery(next);
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={`Search ${ariaLabel.toLocaleLowerCase()}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      if (canUseCustomValue) {
                        event.preventDefault();
                        onChange(trimmedQuery);
                        setOpen(false);
                      } else if (visibleOptions.length > 0) {
                        event.preventDefault();
                        onChange(visibleOptions[0].value);
                        setOpen(false);
                      }
                    }
                  }}
                />
              </div>
            ) : null}
            {visibleOptions.length === 0 && !canUseCustomValue ? (
              <p className="rounded-select-empty">{query ? "No matching options" : emptyMessage}</p>
            ) : (
              <>
                {visibleOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const showGroup =
                    option.group && option.group !== visibleOptions[index - 1]?.group;
                  return (
                    <div
                      className="rounded-select-option-group"
                      key={`${option.group ?? "default"}:${option.value}:${index}`}
                    >
                      {showGroup ? (
                        <span className="rounded-select-group-label">{option.group}</span>
                      ) : null}
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
                {canUseCustomValue ? (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="rounded-select-custom-option"
                    onClick={() => {
                      onChange(trimmedQuery);
                      setOpen(false);
                    }}
                  >
                    {customValueLabel ? (
                      customValueLabel(trimmedQuery)
                    ) : (
                      <>
                        <span>Add </span>
                        <strong>{trimmedQuery}</strong>
                      </>
                    )}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
