"use client";

import type { CSSProperties, ReactNode } from "react";
import { formatCompactPeso, formatCompactNumber } from "@/lib/format";

export interface CompactMoneyProps {
  value?: number | null | undefined;
  amount?: number | null | undefined;
  maxDecimals?: number;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
}

/**
 * Renders a monetary figure compactly (e.g., ₱12.5M, ₱1.6B) when large,
 * with a tooltip displaying the exact full amount (e.g., ₱12,500,000.00).
 */
export function CompactMoney({
  value,
  amount,
  maxDecimals = 2,
  className,
  style,
  fallback = "—",
}: CompactMoneyProps) {
  const numericValue = value !== undefined ? value : amount;
  if (numericValue == null || !Number.isFinite(numericValue)) {
    return <span className={className} style={style}>{fallback}</span>;
  }

  const { display, full, isAbbr } = formatCompactPeso(numericValue, maxDecimals);

  if (!isAbbr) {
    return (
      <span className={className} style={style}>
        {display}
      </span>
    );
  }

  return (
    <span
      className={`compact-number-abbr ${className || ""}`}
      title={full}
      aria-label={`${display} (Exact: ${full})`}
      style={style}
    >
      {display}
    </span>
  );
}

export interface CompactNumberProps {
  value: number | null | undefined;
  maxDecimals?: number;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
}

/**
 * Renders a large numeric count compactly (e.g., 12.5M, 1.6B)
 * with a tooltip displaying the exact un-abbreviated number.
 */
export function CompactNumber({
  value,
  maxDecimals = 2,
  className,
  style,
  fallback = "—",
}: CompactNumberProps) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={className} style={style}>{fallback}</span>;
  }

  const { display, full, isAbbr } = formatCompactNumber(value, maxDecimals);

  if (!isAbbr) {
    return (
      <span className={className} style={style}>
        {display}
      </span>
    );
  }

  return (
    <span
      className={`compact-number-abbr ${className || ""}`}
      title={full}
      aria-label={`${display} (Exact: ${full})`}
      style={style}
    >
      {display}
    </span>
  );
}
