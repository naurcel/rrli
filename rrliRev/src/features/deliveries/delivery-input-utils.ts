import type { KeyboardEvent } from "react";

const NAVIGATION_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Enter",
  "Escape",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

/**
 * Sanitizes a positive decimal string (currency, distance, fuel rate, etc.).
 * Strips letters, signs (+ / -), scientific notation (e / E), and extra decimal points.
 */
export function sanitizePositiveDecimalInput(
  raw: string,
  maxDecimals = 2,
): string {
  if (!raw) return "";
  // Keep only digits and dots
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";

  const firstDotIndex = cleaned.indexOf(".");
  if (firstDotIndex === -1) {
    return cleaned;
  }

  const integerPart = cleaned.slice(0, firstDotIndex);
  const fractionPart = cleaned
    .slice(firstDotIndex + 1)
    .replace(/\./g, "")
    .slice(0, maxDecimals);

  return maxDecimals > 0 ? `${integerPart}.${fractionPart}` : integerPart;
}

/**
 * Sanitizes a signed decimal string (e.g., truck temperature in °C which may be negative).
 * Strips letters, '+', scientific notation (e / E), and extra '-' or '.' characters.
 */
export function sanitizeSignedDecimalInput(
  raw: string,
  maxDecimals = 1,
): string {
  if (!raw) return "";
  const isNegative = raw.trimStart().startsWith("-");
  const unsigned = sanitizePositiveDecimalInput(raw.replace(/-/g, ""), maxDecimals);
  if (!unsigned) {
    return isNegative ? "-" : "";
  }
  return isNegative ? `-${unsigned}` : unsigned;
}

/**
 * Sanitizes a person's name (Driver / Helper) by stripping numeric digits.
 */
export function sanitizePersonNameInput(raw: string): string {
  if (!raw) return "";
  return raw.replace(/[0-9]/g, "");
}

/**
 * KeyDown guard for positive decimal inputs. Blocks letters (including 'e'/'E') and signs.
 */
export function handlePositiveDecimalKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (NAVIGATION_KEYS.has(event.key)) return;

  if (event.key === ".") {
    const target = event.currentTarget;
    const selectionStart = target.selectionStart ?? 0;
    const selectionEnd = target.selectionEnd ?? 0;
    const currentVal = target.value;
    const remainingVal =
      currentVal.slice(0, selectionStart) + currentVal.slice(selectionEnd);
    if (remainingVal.includes(".")) {
      event.preventDefault();
    }
    return;
  }

  if (!/^[0-9]$/.test(event.key)) {
    event.preventDefault();
  }
}

/**
 * KeyDown guard for signed decimal inputs (e.g. temperature). Allows leading '-' only.
 */
export function handleSignedDecimalKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (NAVIGATION_KEYS.has(event.key)) return;

  const target = event.currentTarget;
  const selectionStart = target.selectionStart ?? 0;
  const selectionEnd = target.selectionEnd ?? 0;
  const currentVal = target.value;
  const remainingVal =
    currentVal.slice(0, selectionStart) + currentVal.slice(selectionEnd);

  if (event.key === "-") {
    if (selectionStart !== 0 || remainingVal.includes("-")) {
      event.preventDefault();
    }
    return;
  }

  if (event.key === ".") {
    if (remainingVal.includes(".")) {
      event.preventDefault();
    }
    return;
  }

  if (!/^[0-9]$/.test(event.key)) {
    event.preventDefault();
  }
}
