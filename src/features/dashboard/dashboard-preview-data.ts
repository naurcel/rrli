import { calculateFinancialPerformance } from "../deliveries/completion/delivery-completion-financials.ts";

export type DashboardDateRange = {
  startDate: Date | null;
  endDate: Date | null;
};

export type DashboardDelivery = {
  id: string;
  client: string;
  completedOn: string;
  truck: string;
  driver: string;
  revenue: number;
  expenses: number;
  pod: "Attached" | "Missing";
};

export type DashboardMetric = "revenue" | "netIncome" | "profitMargin";

export type DashboardRole =
  | "admin"
  | "president"
  | "corporate-secretary"
  | "operations"
  | "finance"
  | "hr";

export type DashboardQuickAction = {
  label: string;
  description: string;
  href: string;
  symbol: string;
  availableTo: readonly DashboardRole[];
};

export type TruckPerformance = {
  truck: string;
  revenue: number;
  totalExpenses: number;
  netIncome: number;
  profitMargin: number | null;
  deliveries: number;
};

export const dashboardPreviewDeliveries: readonly DashboardDelivery[] = [
  { id: "DLV-0312", client: "Northstar Retail", completedOn: "2026-10-29", truck: "NGS 4281", driver: "M. Santos", revenue: 24_800, expenses: 11_200, pod: "Attached" },
  { id: "DLV-0311", client: "Harbor Foods Co.", completedOn: "2026-10-29", truck: "NBE 9042", driver: "J. Rivera", revenue: 21_600, expenses: 10_100, pod: "Attached" },
  { id: "DLV-0310", client: "Evergreen Supply", completedOn: "2026-10-28", truck: "CBZ 1187", driver: "A. Dela Cruz", revenue: 18_400, expenses: 8_800, pod: "Missing" },
  { id: "DLV-0309", client: "Metro Buildworks", completedOn: "2026-10-28", truck: "DAA 7310", driver: "R. Garcia", revenue: 16_700, expenses: 7_600, pod: "Attached" },
  { id: "DLV-0308", client: "Lumen Home Goods", completedOn: "2026-10-27", truck: "NGS 4281", driver: "C. Reyes", revenue: 21_300, expenses: 9_700, pod: "Attached" },
  { id: "DLV-0307", client: "Summit Hardware", completedOn: "2026-10-27", truck: "ABX 2201", driver: "N. Flores", revenue: 14_100, expenses: 7_800, pod: "Attached" },
  { id: "DLV-0306", client: "Pacific Agri Supply", completedOn: "2026-10-26", truck: "NBE 9042", driver: "D. Lim", revenue: 25_400, expenses: 11_800, pod: "Attached" },
  { id: "DLV-0305", client: "Cedar & Stone", completedOn: "2026-10-25", truck: "XCY 6612", driver: "P. Navarro", revenue: 14_600, expenses: 9_100, pod: "Missing" },
  { id: "DLV-0304", client: "Brightline Markets", completedOn: "2026-10-25", truck: "CBZ 1187", driver: "S. Tan", revenue: 20_700, expenses: 10_900, pod: "Attached" },
  { id: "DLV-0303", client: "Oakridge Manufacturing", completedOn: "2026-10-24", truck: "NGS 4281", driver: "L. Bautista", revenue: 20_100, expenses: 9_200, pod: "Attached" },
  { id: "DLV-0302", client: "Atlas Office Supply", completedOn: "2026-10-23", truck: "DAA 7310", driver: "K. Mendoza", revenue: 18_500, expenses: 8_200, pod: "Attached" },
  { id: "DLV-0301", client: "Riverside Packaging", completedOn: "2026-10-23", truck: "NBE 9042", driver: "E. Cruz", revenue: 23_100, expenses: 10_900, pod: "Attached" },
  { id: "DLV-0300", client: "Silverline Imports", completedOn: "2026-10-22", truck: "XCY 6612", driver: "T. Ramos", revenue: 13_800, expenses: 8_700, pod: "Attached" },
  { id: "DLV-0299", client: "Greenway Pharmacy", completedOn: "2026-10-21", truck: "NGS 4281", driver: "B. Aquino", revenue: 22_700, expenses: 10_300, pod: "Attached" },
  { id: "DLV-0298", client: "Meridian Foods", completedOn: "2026-10-20", truck: "CBZ 1187", driver: "M. Santos", revenue: 19_200, expenses: 9_800, pod: "Missing" },
  { id: "DLV-0297", client: "Northstar Retail", completedOn: "2026-10-19", truck: "NBE 9042", driver: "J. Rivera", revenue: 20_900, expenses: 9_900, pod: "Attached" },
  { id: "DLV-0296", client: "Harbor Foods Co.", completedOn: "2026-10-18", truck: "DAA 7310", driver: "A. Dela Cruz", revenue: 17_400, expenses: 7_900, pod: "Attached" },
  { id: "DLV-0295", client: "Evergreen Supply", completedOn: "2026-10-17", truck: "NGS 4281", driver: "R. Garcia", revenue: 23_600, expenses: 10_800, pod: "Attached" },
  { id: "DLV-0294", client: "Metro Buildworks", completedOn: "2026-10-15", truck: "ABX 2201", driver: "C. Reyes", revenue: 15_800, expenses: 8_600, pod: "Attached" },
  { id: "DLV-0293", client: "Lumen Home Goods", completedOn: "2026-10-14", truck: "CBZ 1187", driver: "N. Flores", revenue: 18_900, expenses: 9_600, pod: "Attached" },
  { id: "DLV-0292", client: "Summit Hardware", completedOn: "2026-10-12", truck: "NBE 9042", driver: "D. Lim", revenue: 22_300, expenses: 10_200, pod: "Missing" },
  { id: "DLV-0291", client: "Pacific Agri Supply", completedOn: "2026-10-10", truck: "XCY 6612", driver: "P. Navarro", revenue: 14_300, expenses: 8_900, pod: "Attached" },
  { id: "DLV-0290", client: "Cedar & Stone", completedOn: "2026-10-08", truck: "NGS 4281", driver: "S. Tan", revenue: 21_900, expenses: 10_100, pod: "Attached" },
  { id: "DLV-0289", client: "Brightline Markets", completedOn: "2026-10-06", truck: "DAA 7310", driver: "L. Bautista", revenue: 16_200, expenses: 7_400, pod: "Attached" },
  { id: "DLV-0288", client: "Oakridge Manufacturing", completedOn: "2026-10-03", truck: "CBZ 1187", driver: "K. Mendoza", revenue: 20_400, expenses: 10_400, pod: "Attached" },
  { id: "DLV-0287", client: "Atlas Office Supply", completedOn: "2026-09-30", truck: "NBE 9042", driver: "E. Cruz", revenue: 19_800, expenses: 9_500, pod: "Attached" },
] as const;

const allRoles: readonly DashboardRole[] = ["admin", "president", "corporate-secretary", "operations", "finance", "hr"];

// These remain visible to every preview role until the approved permission matrix exists.
export const dashboardQuickActions: readonly DashboardQuickAction[] = [
  { label: "Review deliveries", description: "Check completed records that still need POD follow-up.", href: "/deliveries?pod=Missing", symbol: "▤", availableTo: allRoles },
  { label: "Review fleet", description: "Compare owned and subcontracted trucks.", href: "/fleet", symbol: "▱", availableTo: allRoles },
  { label: "Review transactions", description: "Inspect local revenue and expense entries.", href: "/transactions", symbol: "₱", availableTo: allRoles },
  { label: "Open reports", description: "View available operational report definitions.", href: "/reports", symbol: "▥", availableTo: allRoles },
  { label: "Workspace access", description: "Review preview members and access readiness.", href: "/administration", symbol: "◎", availableTo: allRoles },
] as const;

function toLocalDate(dateValue: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(dateValue);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatPeso(value: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

export function formatProfitMargin(value: number | null): string {
  return value === null ? "N/A" : `${value.toFixed(1)}%`;
}

export function formatDashboardDate(dateValue: string): string {
  return toLocalDate(dateValue).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function filterDashboardDeliveries(
  deliveries: readonly DashboardDelivery[],
  range: DashboardDateRange,
  canAccess: (delivery: DashboardDelivery) => boolean = () => true,
): DashboardDelivery[] {
  if (!range.startDate || !range.endDate) return deliveries.filter(canAccess);
  const start = startOfDay(range.startDate).getTime();
  const end = startOfDay(range.endDate).getTime();
  return deliveries.filter((delivery) => {
    const completed = toLocalDate(delivery.completedOn).getTime();
    return completed >= start && completed <= end && canAccess(delivery);
  });
}

export function getDashboardMetrics(deliveries: readonly DashboardDelivery[]) {
  return {
    ...calculateFinancialPerformance(
      deliveries.map((delivery) => ({
        revenue: delivery.revenue,
        totalExpenses: delivery.expenses,
      })),
    ),
    deliveries: deliveries.length,
  };
}

export function getPreviousDateRange(range: DashboardDateRange): DashboardDateRange | null {
  if (!range.startDate || !range.endDate) return null;
  const start = startOfDay(range.startDate);
  const end = startOfDay(range.endDate);
  const duration = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (duration - 1));
  return { startDate: previousStart, endDate: previousEnd };
}

export function getTruckTotals(deliveries: readonly DashboardDelivery[]): TruckPerformance[] {
  const grouped = new Map<string, DashboardDelivery[]>();
  for (const delivery of deliveries) {
    const current = grouped.get(delivery.truck) ?? [];
    current.push(delivery);
    grouped.set(delivery.truck, current);
  }
  return [...grouped.entries()].map(([truck, truckDeliveries]) => ({
    truck,
    ...getDashboardMetrics(truckDeliveries),
  }));
}

export function getTopTrucks(deliveries: readonly DashboardDelivery[], metric: DashboardMetric, limit = 3): TruckPerformance[] {
  return getTruckTotals(deliveries).sort((left, right) => {
    const leftValue = left[metric];
    const rightValue = right[metric];
    if (leftValue === null) return rightValue === null ? left.truck.localeCompare(right.truck) : 1;
    if (rightValue === null) return -1;
    return rightValue - leftValue || left.truck.localeCompare(right.truck);
  }).slice(0, limit);
}

export function getRevenueSeries(deliveries: readonly DashboardDelivery[], range: DashboardDateRange): Array<{ date: string; revenue: number }> {
  const filtered = filterDashboardDeliveries(deliveries, range);
  if (filtered.length === 0) return [];
  const amounts = new Map<string, number>();
  filtered.forEach((delivery) => amounts.set(delivery.completedOn, (amounts.get(delivery.completedOn) ?? 0) + delivery.revenue));
  if (!range.startDate || !range.endDate) return [...amounts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, revenue]) => ({ date, revenue }));
  const days: Array<{ date: string; revenue: number }> = [];
  const cursor = startOfDay(range.startDate);
  const end = startOfDay(range.endDate);
  while (cursor <= end) {
    const date = dateKey(cursor);
    days.push({ date, revenue: amounts.get(date) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

