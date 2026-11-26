export function formatPeso(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "N/A";
  const rounded = Math.round(amount * 100) / 100;
  const sign = rounded < 0 ? "-" : "";
  const absFormatted = Math.abs(rounded).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  });
  return `${sign}₱${absFormatted}`;
}

export type CompactFormatResult = {
  display: string;
  full: string;
  isAbbr: boolean;
};

/**
 * Formats a plain number compactly with metric abbreviation (e.g. 12.5M, 1.6B).
 * Returns the abbreviated display string, the full formatted number, and whether it was abbreviated.
 */
export function formatCompactNumber(
  num: number | null | undefined,
  maxDecimals = 2,
): CompactFormatResult {
  if (num == null || !Number.isFinite(num)) {
    return { display: "N/A", full: "N/A", isAbbr: false };
  }
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  const full = `${sign}${abs.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

  const fmt = (val: number, suffix: string) => {
    const formatted = val.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals,
    });
    return `${sign}${formatted}${suffix}`;
  };

  if (abs >= 1e12) return { display: fmt(abs / 1e12, "T"), full, isAbbr: true };
  if (abs >= 1e9) return { display: fmt(abs / 1e9, "B"), full, isAbbr: true };
  if (abs >= 1e6) return { display: fmt(abs / 1e6, "M"), full, isAbbr: true };

  return { display: full, full, isAbbr: false };
}

/**
 * Formats a currency amount compactly with Philippine Peso prefix and abbreviation (e.g. ₱12.5M, ₱1.6B).
 * Returns the abbreviated display string, the full formatted currency, and whether it was abbreviated.
 */
export function formatCompactPeso(
  amount: number | null | undefined,
  maxDecimals = 2,
): CompactFormatResult {
  if (amount == null || !Number.isFinite(amount)) {
    return { display: "N/A", full: "N/A", isAbbr: false };
  }
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const full = `${sign}₱${abs.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

  const fmt = (val: number, suffix: string) => {
    const formatted = val.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals,
    });
    return `${sign}₱${formatted}${suffix}`;
  };

  if (abs >= 1e12) return { display: fmt(abs / 1e12, "T"), full, isAbbr: true };
  if (abs >= 1e9) return { display: fmt(abs / 1e9, "B"), full, isAbbr: true };
  if (abs >= 1e6) return { display: fmt(abs / 1e6, "M"), full, isAbbr: true };

  return { display: full, full, isAbbr: false };
}

/**
 * Returns a compact string for currency (e.g., "₱12.5M", "₱1.6B", or standard "₱87,500").
 */
export function formatPesoCompact(
  amount: number | null | undefined,
  maxDecimals = 2,
): string {
  return formatCompactPeso(amount, maxDecimals).display;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}

/**
 * Normalizes and formats Philippine phone numbers into standard 09XXXXXXXXX (11-digit) format.
 * Strips country code (+63 or 63), non-digits, dashes, spaces, and adds leading 0 to 10-digit 9XXXXXXXXX numbers.
 *
 * Examples:
 * - "+63 917 123 4567" -> "09171234567"
 * - "+639204567890"    -> "09204567890"
 * - "639182345678"     -> "09182345678"
 * - "9193456789"       -> "09193456789"
 * - "0921-567-8901"    -> "09215678901"
 * - "09948795127"      -> "09948795127"
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (cleaned.startsWith("+63")) {
    return "0" + cleaned.slice(3);
  }
  if (cleaned.startsWith("63") && cleaned.length === 12) {
    return "0" + cleaned.slice(2);
  }
  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length === 10 && digitsOnly.startsWith("9")) {
    return "0" + digitsOnly;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith("09")) {
    return digitsOnly;
  }
  return digitsOnly || phone.trim();
}


