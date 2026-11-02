export function createPreviewRecordId(prefix: "DLV" | "TXN", timestamp = Date.now()): string {
  return `${prefix}-LOCAL-${timestamp.toString(36).toUpperCase()}`;
}

export function formatPreviewPeso(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatPreviewDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
