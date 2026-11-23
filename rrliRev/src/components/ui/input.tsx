"use client";

import React, {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

export type InputSize = "sm" | "md" | "lg";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: InputSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  error?: string | boolean;
  clearable?: boolean;
  onClear?: () => void;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = "md",
    icon,
    iconRight,
    error,
    clearable,
    onClear,
    className = "",
    disabled,
    value,
    type = "text",
    ...rest
  },
  ref,
) {
  const hasValue = value !== undefined && value !== null && String(value).length > 0;

  return (
    <div
      className={`routex-input-wrapper size-${size}${error ? " has-error" : ""}${disabled ? " is-disabled" : ""}`}
    >
      {icon ? (
        <span className="routex-input-icon left" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        value={value}
        className={`routex-input ${className}`}
        {...rest}
      />
      {clearable && hasValue && onClear && !disabled ? (
        <button
          type="button"
          className="routex-input-clear-btn"
          aria-label="Clear input"
          onClick={onClear}
        >
          ×
        </button>
      ) : iconRight ? (
        <span className="routex-input-icon right" aria-hidden="true">
          {iconRight}
        </span>
      ) : null}
    </div>
  );
});

export type SearchInputProps = Omit<InputProps, "type">;

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ icon, onClear, ...rest }, ref) {
    const searchIcon = icon ?? (
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    );

    return (
      <Input
        ref={ref}
        type="search"
        icon={searchIcon}
        clearable
        onClear={onClear}
        {...rest}
      />
    );
  },
);
