/**
 * RouteX Dashboard KPI Calculations & Chart Utilities
 *
 * Implements canonical calculations for:
 * 1. Revenue, merged Expenses (delivery + company), and overall Profit.
 * 2. Top Client calculation by actual delivery revenue (not trip count), with tie and empty-range handling.
 * 3. Human-friendly, evenly spaced Y-axis increments for revenue charts.
 */

import {
  type DeliveryTripRecord,
  isDeliveryFinanciallyComplete,
} from "../deliveries/delivery-domain.ts";
import type { CompanyExpense } from "../finance/company-expense-domain.ts";

export type TopClientSummary = {
  name: string;
  revenue: number;
  tripCount: number;
  isTied: boolean;
  tiedCount: number;
  allNames: string;
};

/**
 * Computes the top client by actual delivery revenue within the currently filtered deliveries.
 * Excludes incomplete deliveries and non-positive revenue amounts.
 * Gracefully handles ties and empty date ranges.
 */
export function calculateTopClient(
  deliveries: readonly DeliveryTripRecord[],
): TopClientSummary {
  const clientRevenueMap = new Map<string, { totalRevenue: number; tripCount: number }>();

  for (const trip of deliveries) {
    if (
      isDeliveryFinanciallyComplete(trip) &&
      trip.deliveryRate != null &&
      trip.deliveryRate > 0
    ) {
      const clientName = trip.clientName?.trim() || "Unknown Client";
      const existing = clientRevenueMap.get(clientName) ?? { totalRevenue: 0, tripCount: 0 };
      existing.totalRevenue += trip.deliveryRate;
      existing.tripCount += 1;
      clientRevenueMap.set(clientName, existing);
    }
  }

  if (clientRevenueMap.size === 0) {
    return {
      name: "None",
      revenue: 0,
      tripCount: 0,
      isTied: false,
      tiedCount: 0,
      allNames: "None",
    };
  }

  let maxRevenue = 0;
  for (const item of clientRevenueMap.values()) {
    if (item.totalRevenue > maxRevenue) {
      maxRevenue = item.totalRevenue;
    }
  }

  const topClients = [...clientRevenueMap.entries()]
    .filter(([_, data]) => Math.abs(data.totalRevenue - maxRevenue) < 0.001)
    .map(([name, data]) => ({ name, ...data }));

  if (topClients.length === 1) {
    return {
      name: topClients[0].name,
      revenue: topClients[0].totalRevenue,
      tripCount: topClients[0].tripCount,
      isTied: false,
      tiedCount: 1,
      allNames: topClients[0].name,
    };
  }

  // Handle tie scenario
  const names = topClients.map((c) => c.name);
  const displayNames =
    names.length <= 2 ? names.join(" & ") : `${names[0]} & ${names.length - 1} others`;
  const totalTrips = topClients.reduce((sum, c) => sum + c.tripCount, 0);

  return {
    name: displayNames,
    revenue: maxRevenue,
    tripCount: totalTrips,
    isTied: true,
    tiedCount: topClients.length,
    allNames: names.join(", "),
  };
}

export type NiceYAxisResult = {
  ceiling: number;
  step: number;
  ticks: number[];
};

/**
 * Calculates human-friendly, evenly spaced Y-axis increments based on actual data range.
 * Avoids awkward decimal increments, excessive empty space, or misleading scales.
 */
export function calculateNiceYAxis(maxVal: number, targetTicks = 4): NiceYAxisResult {
  if (maxVal <= 0) {
    return {
      ceiling: 10_000,
      step: 5_000,
      ticks: [0, 5_000, 10_000],
    };
  }

  const roughStep = maxVal / targetTicks;
  const power = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const fraction = roughStep / power;

  let factor = 1;
  if (fraction <= 1) factor = 1;
  else if (fraction <= 2) factor = 2;
  else if (fraction <= 2.5) factor = 2.5;
  else if (fraction <= 5) factor = 5;
  else factor = 10;

  let step = factor * power;
  // Ensure integer step and reasonable minimum benchmark for currency
  step = Math.max(500, Math.round(step));

  const ceiling = Math.ceil(maxVal / step) * step;
  const count = Math.round(ceiling / step);
  const ticks: number[] = [];

  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round(i * step));
  }

  return { ceiling, step, ticks };
}

/**
 * Merges delivery expenses and company operating expenses without double counting.
 */
export function calculateMergedExpenses(
  deliveryExpenses: number,
  companyExpenses: number,
): number {
  return Math.max(0, deliveryExpenses) + Math.max(0, companyExpenses);
}

/**
 * Calculates dashboard profit and margin from delivery revenue and merged expenses.
 */
export function calculateDashboardProfit(
  revenue: number,
  mergedExpenses: number,
): { profit: number; profitMargin: number | null } {
  const safeRevenue = Math.max(0, revenue);
  const profit = safeRevenue - mergedExpenses;
  const profitMargin = safeRevenue > 0 ? (profit / safeRevenue) * 100 : null;
  return { profit, profitMargin };
}

export type NiceYRangeResult = {
  floor: number;
  ceiling: number;
  step: number;
  ticks: number[];
};

/**
 * Calculates human-friendly Y-axis bounds and increments for datasets that may span
 * positive values, zero, and negative values (such as net loss or negative profits).
 */
export function calculateNiceYRange(
  minVal: number,
  maxVal: number,
  targetTicks = 4,
): NiceYRangeResult {
  if (minVal >= 0) {
    const res = calculateNiceYAxis(maxVal, targetTicks);
    return {
      floor: 0,
      ceiling: res.ceiling,
      step: res.step,
      ticks: res.ticks,
    };
  }

  const spread = Math.max(10_000, maxVal - minVal);
  const roughStep = spread / targetTicks;
  const power = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const fraction = roughStep / power;

  let factor = 1;
  if (fraction <= 1) factor = 1;
  else if (fraction <= 2) factor = 2;
  else if (fraction <= 2.5) factor = 2.5;
  else if (fraction <= 5) factor = 5;
  else factor = 10;

  let step = factor * power;
  step = Math.max(500, Math.round(step));

  const floor = Math.floor(minVal / step) * step;
  const ceiling = Math.max(floor + step * 2, Math.ceil(Math.max(0, maxVal) / step) * step);
  const count = Math.round((ceiling - floor) / step);
  const ticks: number[] = [];

  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round(floor + i * step));
  }

  return { floor, ceiling, step, ticks };
}

export type FinancialTimeSeriesPoint = {
  date: string;
  revenue: number;
  deliveryExpenses: number;
  companyExpenses: number;
  expenses: number;
  profit: number;
  tripCount: number;
};

/**
 * Aggregates delivery and company financial records into an aligned daily time series.
 * Only financially complete deliveries are counted towards revenue and delivery expenses.
 */
export function buildFinancialTimeSeries(
  deliveries: readonly DeliveryTripRecord[],
  companyExpenses: readonly CompanyExpense[],
  range: { startDate: Date | null; endDate: Date | null },
): FinancialTimeSeriesPoint[] {
  const deliveryAggregates = new Map<
    string,
    { revenue: number; deliveryExpenses: number; tripCount: number }
  >();

  deliveries.forEach((trip) => {
    if (isDeliveryFinanciallyComplete(trip)) {
      const existing = deliveryAggregates.get(trip.deliveryDate) ?? {
        revenue: 0,
        deliveryExpenses: 0,
        tripCount: 0,
      };
      existing.revenue += trip.deliveryRate ?? 0;
      existing.deliveryExpenses += trip.totalExpenses ?? 0;
      existing.tripCount += 1;
      deliveryAggregates.set(trip.deliveryDate, existing);
    }
  });

  const companyExpenseAggregates = new Map<string, number>();
  companyExpenses.forEach((exp) => {
    companyExpenseAggregates.set(
      exp.expenseDate,
      (companyExpenseAggregates.get(exp.expenseDate) ?? 0) + exp.amount,
    );
  });

  const makePoint = (date: string): FinancialTimeSeriesPoint => {
    const deliv = deliveryAggregates.get(date) ?? {
      revenue: 0,
      deliveryExpenses: 0,
      tripCount: 0,
    };
    const compExp = companyExpenseAggregates.get(date) ?? 0;
    const totalExp = deliv.deliveryExpenses + compExp;
    return {
      date,
      revenue: deliv.revenue,
      deliveryExpenses: deliv.deliveryExpenses,
      companyExpenses: compExp,
      expenses: totalExp,
      profit: deliv.revenue - totalExp,
      tripCount: deliv.tripCount,
    };
  };

  if (range.startDate && range.endDate) {
    const days: FinancialTimeSeriesPoint[] = [];
    const cursor = new Date(range.startDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(range.endDate);
    end.setHours(0, 0, 0, 0);

    let step = 0;
    while (cursor <= end && step < 62) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      const key = `${year}-${month}-${day}`;
      days.push(makePoint(key));
      cursor.setDate(cursor.getDate() + 1);
      step++;
    }
    return days;
  }

  const allDates = new Set<string>([
    ...deliveryAggregates.keys(),
    ...companyExpenseAggregates.keys(),
  ]);

  return Array.from(allDates)
    .sort((a, b) => a.localeCompare(b))
    .map(makePoint);
}
