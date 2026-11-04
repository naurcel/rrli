import type {
  DeliveryTripRecord,
  ExpenseResolutionStatus,
} from "./delivery-domain.ts";
import { formatPercent, formatPeso } from "../../lib/format.ts";

export type ExpenseCategorySlice = {
  id: string;
  label: string;
  amount: number;
  color: string;
  status: ExpenseResolutionStatus;
  details?: string;
};

export type CalculatedDonutArc = {
  slice: ExpenseCategorySlice;
  percentage: number;
  startAngle: number;
  endAngle: number;
  pathD: string;
  isFullCircle?: boolean;
};

/**
 * Pure trigonometric function to compute SVG donut arc paths.
 * Accessible, deterministic, and free of divide-by-zero or NaN artifacts.
 */
export function computeDonutArcs(
  slices: readonly ExpenseCategorySlice[],
  totalAmount: number | null,
  options: {
    cx?: number;
    cy?: number;
    outerRadius?: number;
    innerRadius?: number;
  } = {},
): CalculatedDonutArc[] {
  if (totalAmount == null || totalAmount <= 0) {
    return [];
  }

  const cx = options.cx ?? 100;
  const cy = options.cy ?? 100;
  const R = options.outerRadius ?? 78;
  const r = options.innerRadius ?? 50;

  // Only slices with valid confirmed amounts > 0 contribute to SVG geometry
  const validSlices = slices.filter(
    (s) => s.status === "confirmed" && Number.isFinite(s.amount) && s.amount > 0,
  );

  if (validSlices.length === 0) {
    return [];
  }

  // If there is only 1 category that makes up 100% of the total
  if (validSlices.length === 1) {
    const single = validSlices[0];
    const percentage = 100;
    // Draw two 180-degree arcs to form a complete donut ring without degenerate SVG arc errors
    const topOuter = `${cx} ${cy - R}`;
    const bottomOuter = `${cx} ${cy + R}`;
    const topInner = `${cx} ${cy - r}`;
    const bottomInner = `${cx} ${cy + r}`;
    const pathD = [
      `M ${topOuter}`,
      `A ${R} ${R} 0 1 1 ${bottomOuter}`,
      `A ${R} ${R} 0 1 1 ${topOuter}`,
      `M ${topInner}`,
      `A ${r} ${r} 0 1 0 ${bottomInner}`,
      `A ${r} ${r} 0 1 0 ${topInner}`,
      "Z",
    ].join(" ");

    return [
      {
        slice: single,
        percentage,
        startAngle: -Math.PI / 2,
        endAngle: (3 * Math.PI) / 2,
        pathD,
        isFullCircle: true,
      },
    ];
  }

  let currentAngle = -Math.PI / 2; // Start at 12 o'clock
  const arcs: CalculatedDonutArc[] = [];

  for (const slice of validSlices) {
    const percentage = (slice.amount / totalAmount) * 100;
    const sliceAngle = (slice.amount / totalAmount) * (2 * Math.PI);
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);

    const x3 = cx + r * Math.cos(endAngle);
    const y3 = cy + r * Math.sin(endAngle);
    const x4 = cx + r * Math.cos(startAngle);
    const y4 = cy + r * Math.sin(startAngle);

    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

    const pathD = [
      `M ${x1.toFixed(3)} ${y1.toFixed(3)}`,
      `A ${R} ${R} 0 ${largeArcFlag} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`,
      `L ${x3.toFixed(3)} ${y3.toFixed(3)}`,
      `A ${r} ${r} 0 ${largeArcFlag} 0 ${x4.toFixed(3)} ${y4.toFixed(3)}`,
      "Z",
    ].join(" ");

    arcs.push({
      slice,
      percentage,
      startAngle,
      endAngle,
      pathD,
      isFullCircle: false,
    });
  }

  return arcs;
}

export function formatExpenseResolutionStatus(
  value: number | null,
  status: ExpenseResolutionStatus,
): { text: string; isUnknown: boolean; isNotApplicable: boolean } {
  if (status === "unknown") {
    return { text: "Unconfirmed", isUnknown: true, isNotApplicable: false };
  }
  if (status === "not_applicable") {
    return { text: "Not applicable", isUnknown: false, isNotApplicable: true };
  }
  if (value == null || !Number.isFinite(value)) {
    return { text: "₱0", isUnknown: false, isNotApplicable: false };
  }
  return { text: formatPeso(value), isUnknown: false, isNotApplicable: false };
}

export type TripFinancialResolution = {
  isFinanciallyComplete: boolean;
  unknownList: string[];
  grossRevenue: number | null;
  totalExpenses: number | null;
  netIncome: number | null;
  marginPercent: number | null;
  transitSubtotal: number | null;
  isTransitComplete: boolean;
  crewSubtotal: number | null;
  isCrewComplete: boolean;
  driverTotal: number | null;
  isDriverComplete: boolean;
  helperTotal: number | null;
  isHelperComplete: boolean;
  expenseSlices: ExpenseCategorySlice[];
};

/**
 * Organizes raw trip financial data into structured, validated logical groups
 * without converting unknown values to zero or misrepresenting incomplete records.
 */
export function resolveTripFinancialGroups(
  trip: DeliveryTripRecord & {
    driverName?: string | null;
    helperName?: string | null;
  },
): TripFinancialResolution {
  const unknownList: string[] = [];

  if (trip.expenseStates.dieselExpenses === "unknown") unknownList.push("Diesel Fuel");
  if (trip.expenseStates.tollGateExpenses === "unknown") unknownList.push("Highway Tolls");
  if (trip.expenseStates.entryFees === "unknown") unknownList.push("Store Entry Fees");
  if (trip.expenseStates.driverDailyRate === "unknown" || trip.expenseStates.driverAllowance === "unknown") {
    unknownList.push("Driver Compensation");
  }
  if (trip.expenseStates.helperDailyRate === "unknown" || trip.expenseStates.helperAllowance === "unknown") {
    unknownList.push("Helper Compensation");
  }
  if (trip.expenseStates.otherExpenses === "unknown") unknownList.push("Other Trip Expenses");

  const isFinanciallyComplete = trip.financialState === "finalized" && unknownList.length === 0;

  // Driver computation
  const isDriverUnknown =
    trip.expenseStates.driverDailyRate === "unknown" || trip.expenseStates.driverAllowance === "unknown";
  const isDriverNA =
    trip.expenseStates.driverDailyRate === "not_applicable" &&
    trip.expenseStates.driverAllowance === "not_applicable";
  const driverRate = trip.expenses.driverDailyRate ?? 0;
  const driverAllowance = trip.expenses.driverAllowance ?? 0;
  const driverTotal = isDriverUnknown ? null : isDriverNA ? 0 : driverRate + driverAllowance;

  // Helper computation
  const isHelperUnknown =
    trip.expenseStates.helperDailyRate === "unknown" || trip.expenseStates.helperAllowance === "unknown";
  const isHelperNA =
    trip.expenseStates.helperDailyRate === "not_applicable" &&
    trip.expenseStates.helperAllowance === "not_applicable";
  const helperRate = trip.expenses.helperDailyRate ?? 0;
  const helperAllowance = trip.expenses.helperAllowance ?? 0;
  const helperTotal = isHelperUnknown ? null : isHelperNA ? 0 : helperRate + helperAllowance;

  // Crew subtotal
  const isCrewComplete = !isDriverUnknown && !isHelperUnknown;
  const crewSubtotal = isCrewComplete ? (driverTotal ?? 0) + (helperTotal ?? 0) : null;

  // Direct transit items
  const dieselVal = trip.expenses.dieselExpenses ?? 0;
  const tollVal = trip.expenses.tollGateExpenses ?? 0;
  const entryVal = trip.expenses.entryFees ?? 0;
  const otherVal = trip.expenses.otherExpenses ?? 0;

  const isTransitComplete =
    trip.expenseStates.dieselExpenses !== "unknown" &&
    trip.expenseStates.tollGateExpenses !== "unknown" &&
    trip.expenseStates.entryFees !== "unknown" &&
    trip.expenseStates.otherExpenses !== "unknown";

  const transitSubtotal = isTransitComplete
    ? (trip.expenseStates.dieselExpenses === "not_applicable" ? 0 : dieselVal) +
      (trip.expenseStates.tollGateExpenses === "not_applicable" ? 0 : tollVal) +
      (trip.expenseStates.entryFees === "not_applicable" ? 0 : entryVal) +
      (trip.expenseStates.otherExpenses === "not_applicable" ? 0 : otherVal)
    : null;

  // 6 Categorical Slices for Expense Donut Chart
  const expenseSlices: ExpenseCategorySlice[] = [
    {
      id: "diesel",
      label: "Diesel Fuel",
      amount: trip.expenseStates.dieselExpenses === "not_applicable" ? 0 : dieselVal,
      color: "#f59e0b",
      status: trip.expenseStates.dieselExpenses,
    },
    {
      id: "tolls",
      label: "Highway Tolls",
      amount: trip.expenseStates.tollGateExpenses === "not_applicable" ? 0 : tollVal,
      color: "#6366f1",
      status: trip.expenseStates.tollGateExpenses,
    },
    {
      id: "entry_fees",
      label: "Store Entry Fees",
      amount: trip.expenseStates.entryFees === "not_applicable" ? 0 : entryVal,
      color: "#10b981",
      status: trip.expenseStates.entryFees,
    },
    {
      id: "driver",
      label: "Driver Labor",
      amount: driverTotal ?? 0,
      color: "#0284c7",
      status: isDriverUnknown ? "unknown" : isDriverNA ? "not_applicable" : "confirmed",
    },
    {
      id: "helper",
      label: "Helper Labor",
      amount: helperTotal ?? 0,
      color: "#0d9488",
      status: isHelperUnknown ? "unknown" : isHelperNA ? "not_applicable" : "confirmed",
    },
    {
      id: "other",
      label: "Other Expenses",
      amount: trip.expenseStates.otherExpenses === "not_applicable" ? 0 : otherVal,
      color: "#8b5cf6",
      status: trip.expenseStates.otherExpenses,
    },
  ];

  return {
    isFinanciallyComplete,
    unknownList,
    grossRevenue: trip.deliveryRate,
    totalExpenses: isFinanciallyComplete ? trip.totalExpenses : null,
    netIncome: isFinanciallyComplete ? trip.netIncome : null,
    marginPercent: isFinanciallyComplete ? trip.marginPercent : null,
    transitSubtotal,
    isTransitComplete,
    crewSubtotal,
    isCrewComplete,
    driverTotal,
    isDriverComplete: !isDriverUnknown,
    helperTotal,
    isHelperComplete: !isHelperUnknown,
    expenseSlices,
  };
}
