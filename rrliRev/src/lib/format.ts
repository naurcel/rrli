export function formatPeso(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "N/A";
  const rounded = Math.round(amount);
  const absFormatted = Math.abs(rounded).toLocaleString("en-PH");
  return rounded < 0 ? `-₱${absFormatted}` : `₱${absFormatted}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}

