"use client";

import { useEffect, useId, useRef, useState } from "react";

type RoundedSelectProps = {
  ariaLabel: string;
  className?: string;
  onChange: (value: string) => void;
  options: readonly string[];
  value: string;
};

const EXIT_DURATION_MS = 160;

export function RoundedSelect({ ariaLabel, className = "", onChange, options, value }: RoundedSelectProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const closeMenu = () => {
    if (!open || closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, EXIT_DURATION_MS);
  };

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) closeMenu();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  });

  const toggleMenu = () => {
    if (open) {
      closeMenu();
      return;
    }
    setClosing(false);
    setOpen(true);
  };

  const selectOption = (option: string) => {
    onChange(option);
    closeMenu();
  };

  return (
    <div className={`rounded-select${className ? ` ${className}` : ""}`} ref={dropdownRef}>
      <button
        type="button"
        className="rounded-select-trigger"
        aria-label={`${ariaLabel}: ${value}`}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-expanded={open && !closing}
        onClick={toggleMenu}
      >
        <span>{value}</span>
        <span className="dropdown-chevron" aria-hidden="true" />
      </button>
      {(open || closing) && (
        <div
          id={menuId}
          className={`rounded-select-menu${closing ? " closing" : ""}`}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option === value}
              className={option === value ? "selected" : ""}
              key={option}
              onClick={() => selectOption(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
