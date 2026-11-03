/**
 * RouteX Domain Model — Revised Scope: Delivery Operations & Truck Profitability
 *
 * Structured around the company's Daily Trip Report:
 * -Separates delivery-level trip information, truck attributes, employee trip costs
 *  (driver/helper daily rates and allowances), itemized trip expenses, and
 *  multi-store drop-off stops within a single delivery.
 */

export type TruckType = "4-Wheeler" | "6-Wheeler" | "10-Wheeler";
export type TruckTemperature = "-18°C" | "2°C–4°C" | "18°C–25°C" | "-18°C / 2°C–4°C";
export type PodVerificationStatus = "Verified" | "Incomplete" | "Pending";
export const EXPENSE_KEYS = [
  "dieselExpenses",
  "tollGateExpenses",
  "entryFees",
  "driverAllowance",
  "driverDailyRate",
  "helperAllowance",
  "helperDailyRate",
  "otherExpenses",
] as const;
export type ExpenseKey = (typeof EXPENSE_KEYS)[number];
export type ExpenseResolutionStatus = "confirmed" | "not_applicable" | "unknown";
export type FinancialState = "incomplete" | "finalized";
export type TruckOwnership = "Owned" | "Subcontracted";
export type DeliveryRateBasis = "Redeemed Rate" | "Trucker Rate";

export type DeliveryStoreDropoff = {
  id: string;
  sequence: number;
  storeName: string;
  destinationArea: string;
  entryFee: number | null;
  entryFeeStatus: ExpenseResolutionStatus;
  podSubmitted: boolean;
  supportingDocsComplete: boolean;
  documentRef: string;
};

export type TripExpenseBreakdown = {
  dieselExpenses: number | null;
  tollGateExpenses: number | null;
  tollGateBreakdown: string;
  entryFees: number | null;
  driverAllowance: number | null;
  driverDailyRate: number | null;
  helperAllowance: number | null;
  helperDailyRate: number | null;
  otherExpenses: number | null;
};

export type TripExpenseStates = Record<ExpenseKey, ExpenseResolutionStatus>;

export type DeliveryTripRecord = {
  id: string;
  waybillNumber: string;
  deliveryDate: string; // YYYY-MM-DD
  clientName: string;
  plateNumber: string;
  truckType: TruckType;
  truckTemperature: TruckTemperature;
  truckOwnership: TruckOwnership;
  rateBasis: DeliveryRateBasis;
  origin: string;
  distanceKm: number;
  fuelRate: number;
  deliveryRate: number | null;
  expenses: TripExpenseBreakdown;
  expenseStates: TripExpenseStates;
  totalExpenses: number | null;
  netIncome: number | null;
  marginPercent: number | null;
  financialState: FinancialState;
  financialIntegrityIssues: readonly string[];
  version: number;
  dropoffs: readonly DeliveryStoreDropoff[];
  podStatus: PodVerificationStatus;
};

export type TruckProfitabilitySummary = {
  plateNumber: string;
  truckType: TruckType;
  completedTrips: number;
  totalStoresServed: number;
  totalDistanceKm: number;
  totalEarnings: number;
  totalDieselExpenses: number;
  totalTollExpenses: number;
  totalCrewCosts: number;
  totalEntryAndOtherExpenses: number;
  totalExpenses: number;
  netProfit: number;
  marginPercent: number | null;
};

export function calculateTripExpenseTotal(
  expenses: TripExpenseBreakdown,
  states: TripExpenseStates,
): number | null {
  let total = 0;
  for (const key of EXPENSE_KEYS) {
    const state = states[key];
    const value = expenses[key];
    if (state === "unknown") return null;
    if (state === "not_applicable") continue;
    if (value == null || !Number.isFinite(value) || value < 0) return null;
    total += value;
  }
  return total;
}

export function calculateProfitMargin(revenue: number | null, netIncome: number | null): number | null {
  if (revenue == null || !Number.isFinite(revenue) || revenue === 0 || netIncome == null) return null;
  return (netIncome / revenue) * 100;
}

export function createConfirmedExpenseStates(): TripExpenseStates {
  return Object.fromEntries(EXPENSE_KEYS.map((key) => [key, "confirmed"])) as TripExpenseStates;
}

export function derivePodVerificationStatus(
  dropoffs: readonly DeliveryStoreDropoff[],
): PodVerificationStatus {
  if (dropoffs.length === 0) {
    return "Pending";
  }

  const allComplete = dropoffs.every(
    (stop) => stop.podSubmitted && stop.supportingDocsComplete,
  );
  if (allComplete) {
    return "Verified";
  }

  const anySubmitted = dropoffs.some(
    (stop) => stop.podSubmitted || stop.supportingDocsComplete,
  );
  return anySubmitted ? "Incomplete" : "Pending";
}

export function buildDeliveryTripRecord(input: {
  id: string;
  waybillNumber: string;
  deliveryDate: string;
  clientName: string;
  plateNumber: string;
  truckType: TruckType;
  truckTemperature: TruckTemperature;
  truckOwnership?: TruckOwnership;
  rateBasis?: DeliveryRateBasis;
  origin: string;
  distanceKm: number;
  fuelRate: number;
  deliveryRate: number;
  expenses: Omit<TripExpenseBreakdown, "entryFees"> & { entryFees?: number | null };
  expenseStates?: Partial<TripExpenseStates>;
  financialState?: FinancialState;
  version?: number;
  dropoffs: readonly (Omit<DeliveryStoreDropoff, "entryFeeStatus"> & {
    entryFeeStatus?: ExpenseResolutionStatus;
  })[];
}): DeliveryTripRecord {
  const normalizedDropoffs: DeliveryStoreDropoff[] = input.dropoffs.map((stop) => ({
    ...stop,
    entryFeeStatus: stop.entryFeeStatus ?? "confirmed",
  }));
  const allEntryFeesNotApplicable = normalizedDropoffs.every(
    (stop) => stop.entryFeeStatus === "not_applicable",
  );
  const dropoffEntryFees =
    normalizedDropoffs.some((stop) => stop.entryFeeStatus === "unknown") ||
    allEntryFeesNotApplicable
      ? null
      : normalizedDropoffs.reduce(
          (sum, stop) =>
            stop.entryFeeStatus === "confirmed" ? sum + (stop.entryFee ?? 0) : sum,
          0,
        );
  const entryFees = input.expenses.entryFees ?? dropoffEntryFees;
  const fullExpenses: TripExpenseBreakdown = {
    ...input.expenses,
    entryFees,
  };
  const expenseStates = {
    ...createConfirmedExpenseStates(),
    ...input.expenseStates,
    entryFees: normalizedDropoffs.some((stop) => stop.entryFeeStatus === "unknown")
      ? "unknown"
      : allEntryFeesNotApplicable
        ? "not_applicable"
        : input.expenseStates?.entryFees ?? "confirmed",
  } satisfies TripExpenseStates;
  const totalExpenses = calculateTripExpenseTotal(fullExpenses, expenseStates);
  const netIncome = totalExpenses == null ? null : input.deliveryRate - totalExpenses;
  const marginPercent = calculateProfitMargin(input.deliveryRate, netIncome);
  const financialIntegrityIssues = EXPENSE_KEYS.flatMap((key) => {
    if (expenseStates[key] === "unknown") return [`${key} is unknown`];
    if (expenseStates[key] === "confirmed" && fullExpenses[key] == null) {
      return [`${key} has no confirmed amount`];
    }
    return [];
  });

  return {
    id: input.id,
    waybillNumber: input.waybillNumber,
    deliveryDate: input.deliveryDate,
    clientName: input.clientName,
    plateNumber: input.plateNumber,
    truckType: input.truckType,
    truckTemperature: input.truckTemperature,
    truckOwnership: input.truckOwnership ?? "Owned",
    rateBasis: input.rateBasis ?? "Redeemed Rate",
    origin: input.origin,
    distanceKm: input.distanceKm,
    fuelRate: input.fuelRate,
    deliveryRate: input.deliveryRate,
    expenses: fullExpenses,
    expenseStates,
    totalExpenses,
    netIncome,
    marginPercent,
    financialState:
      input.financialState ?? (financialIntegrityIssues.length === 0 ? "finalized" : "incomplete"),
    financialIntegrityIssues,
    version: input.version ?? 1,
    dropoffs: normalizedDropoffs,
    podStatus: derivePodVerificationStatus(normalizedDropoffs),
  };
}

export const INITIAL_DELIVERY_TRIP_RECORDS: readonly DeliveryTripRecord[] = [
  buildDeliveryTripRecord({
    id: "dlv-2026-101",
    waybillNumber: "WB-2610-4401",
    deliveryDate: "2026-10-30",
    clientName: "Jollibee Foods Corp. (Commissary)",
    plateNumber: "NGS 4281",
    truckType: "10-Wheeler",
    truckTemperature: "-18°C",
    origin: "Marilao Cold Chain Hub",
    distanceKm: 94,
    fuelRate: 61.5,
    deliveryRate: 24500,
    expenses: {
      dieselExpenses: 4120,
      tollGateExpenses: 1180,
      tollGateBreakdown: "NLEX Marilao-Balintawak ₱390 + Skyway Stage 3 ₱790",
      driverAllowance: 350,
      driverDailyRate: 950,
      helperAllowance: 250,
      helperDailyRate: 700,
      otherExpenses: 200,
    },
    dropoffs: [
      {
        id: "stop-101-1",
        sequence: 1,
        storeName: "JB Quezon Ave. Store #104",
        destinationArea: "Quezon City",
        entryFee: 150,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "POD-JB-4401A.pdf",
      },
      {
        id: "stop-101-2",
        sequence: 2,
        storeName: "JB Timog Hub #118",
        destinationArea: "Quezon City",
        entryFee: 150,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "POD-JB-4401B.pdf",
      },
      {
        id: "stop-101-3",
        sequence: 3,
        storeName: "JB Katipunan North #142",
        destinationArea: "Quezon City",
        entryFee: 200,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "POD-JB-4401C.pdf",
      },
    ],
  }),
  buildDeliveryTripRecord({
    id: "dlv-2026-102",
    waybillNumber: "WB-2610-4402",
    deliveryDate: "2026-10-30",
    clientName: "Puregold Price Club Inc.",
    plateNumber: "DAA 7310",
    truckType: "6-Wheeler",
    truckTemperature: "2°C–4°C",
    origin: "Meycauayan Consolidation Depot",
    distanceKm: 78,
    fuelRate: 61.5,
    deliveryRate: 18800,
    expenses: {
      dieselExpenses: 3180,
      tollGateExpenses: 840,
      tollGateBreakdown: "NLEX Meycauayan-Mindanao Ave ₱420 × 2",
      driverAllowance: 300,
      driverDailyRate: 850,
      helperAllowance: 200,
      helperDailyRate: 650,
      otherExpenses: 150,
    },
    dropoffs: [
      {
        id: "stop-102-1",
        sequence: 1,
        storeName: "Puregold Balintawak Cloverleaf",
        destinationArea: "Quezon City",
        entryFee: 250,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "POD-PG-4402A.pdf",
      },
      {
        id: "stop-102-2",
        sequence: 2,
        storeName: "Puregold Monumento South",
        destinationArea: "Caloocan",
        entryFee: 200,
        podSubmitted: true,
        supportingDocsComplete: false,
        documentRef: "Missing stamped receiving slip",
      },
    ],
  }),
  buildDeliveryTripRecord({
    id: "dlv-2026-103",
    waybillNumber: "WB-2610-4403",
    deliveryDate: "2026-10-29",
    clientName: "San Miguel Pure Foods",
    plateNumber: "CBZ 1187",
    truckType: "10-Wheeler",
    truckTemperature: "-18°C",
    origin: "Santa Rosa Cold Storage",
    distanceKm: 112,
    fuelRate: 62.0,
    deliveryRate: 26800,
    expenses: {
      dieselExpenses: 4860,
      tollGateExpenses: 1460,
      tollGateBreakdown: "SLEX Mamplasan-Nichols ₱730 × 2",
      driverAllowance: 400,
      driverDailyRate: 950,
      helperAllowance: 250,
      helperDailyRate: 700,
      otherExpenses: 300,
    },
    dropoffs: [
      {
        id: "stop-103-1",
        sequence: 1,
        storeName: "SMPF Pasig Distribution Hub",
        destinationArea: "Pasig City",
        entryFee: 300,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "POD-SM-4403A.pdf",
      },
      {
        id: "stop-103-2",
        sequence: 2,
        storeName: "SMPF Shaw Cold Annex",
        destinationArea: "Mandaluyong",
        entryFee: 200,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "POD-SM-4403B.pdf",
      },
    ],
  }),
  buildDeliveryTripRecord({
    id: "dlv-2026-104",
    waybillNumber: "WB-2610-4404",
    deliveryDate: "2026-10-29",
    clientName: "Robinsons Supermarket Corp.",
    plateNumber: "NBE 9042",
    truckType: "6-Wheeler",
    truckTemperature: "-18°C / 2°C–4°C",
    origin: "Marilao Cold Chain Hub",
    distanceKm: 64,
    fuelRate: 61.2,
    deliveryRate: 16400,
    expenses: {
      dieselExpenses: 2740,
      tollGateExpenses: 620,
      tollGateBreakdown: "NLEX Marilao-Karuhatan ₱310 × 2",
      driverAllowance: 300,
      driverDailyRate: 850,
      helperAllowance: 200,
      helperDailyRate: 650,
      otherExpenses: 100,
    },
    dropoffs: [
      {
        id: "stop-104-1",
        sequence: 1,
        storeName: "Robinsons Place Malolos",
        destinationArea: "Bulacan",
        entryFee: 150,
        podSubmitted: false,
        supportingDocsComplete: false,
        documentRef: "Awaiting driver turn-in",
      },
      {
        id: "stop-104-2",
        sequence: 2,
        storeName: "Robinsons Supermarket Pulilan",
        destinationArea: "Bulacan",
        entryFee: 150,
        podSubmitted: false,
        supportingDocsComplete: false,
        documentRef: "Awaiting driver turn-in",
      },
    ],
  }),
  buildDeliveryTripRecord({
    id: "dlv-2026-105",
    waybillNumber: "WB-2610-4405",
    deliveryDate: "2026-10-28",
    clientName: "Jollibee Foods Corp. (Commissary)",
    plateNumber: "ABX 2201",
    truckType: "4-Wheeler",
    truckTemperature: "2°C–4°C",
    origin: "Meycauayan Consolidation Depot",
    distanceKm: 52,
    fuelRate: 61.0,
    deliveryRate: 13200,
    expenses: {
      dieselExpenses: 2150,
      tollGateExpenses: 540,
      tollGateBreakdown: "NLEX Meycauayan-Balintawak ₱270 × 2",
      driverAllowance: 250,
      driverDailyRate: 800,
      helperAllowance: 200,
      helperDailyRate: 600,
      otherExpenses: 120,
    },
    dropoffs: [
      {
        id: "stop-105-1",
        sequence: 1,
        storeName: "JB Valenzuela MacArthur #088",
        destinationArea: "Valenzuela",
        entryFee: 100,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "POD-JB-4405A.pdf",
      },
      {
        id: "stop-105-2",
        sequence: 2,
        storeName: "JB Malabon Centro #093",
        destinationArea: "Malabon",
        entryFee: 100,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "POD-JB-4405B.pdf",
      },
    ],
  }),
] as const;

export function summarizeTruckProfitability(
  deliveries: readonly DeliveryTripRecord[],
): TruckProfitabilitySummary[] {
  const byPlate = new Map<string, TruckProfitabilitySummary>();

  for (const trip of deliveries) {
    if (
      trip.financialState !== "finalized" ||
      trip.deliveryRate == null ||
      trip.totalExpenses == null ||
      trip.netIncome == null
    ) {
      continue;
    }
    const existing = byPlate.get(trip.plateNumber);
    const crewCosts =
      (trip.expenses.driverAllowance ?? 0) +
      (trip.expenses.driverDailyRate ?? 0) +
      (trip.expenses.helperAllowance ?? 0) +
      (trip.expenses.helperDailyRate ?? 0);
    const entryAndOther =
      (trip.expenses.entryFees ?? 0) + (trip.expenses.otherExpenses ?? 0);

    if (!existing) {
      const netProfit = trip.deliveryRate - trip.totalExpenses;
      byPlate.set(trip.plateNumber, {
        plateNumber: trip.plateNumber,
        truckType: trip.truckType,
        completedTrips: 1,
        totalStoresServed: trip.dropoffs.length,
        totalDistanceKm: trip.distanceKm,
        totalEarnings: trip.deliveryRate,
        totalDieselExpenses: trip.expenses.dieselExpenses ?? 0,
        totalTollExpenses: trip.expenses.tollGateExpenses ?? 0,
        totalCrewCosts: crewCosts,
        totalEntryAndOtherExpenses: entryAndOther,
        totalExpenses: trip.totalExpenses,
        netProfit,
        marginPercent: calculateProfitMargin(trip.deliveryRate, netProfit),
      });
    } else {
      const totalEarnings = existing.totalEarnings + trip.deliveryRate;
      const totalExpenses = existing.totalExpenses + trip.totalExpenses;
      const netProfit = totalEarnings - totalExpenses;

      byPlate.set(trip.plateNumber, {
        ...existing,
        completedTrips: existing.completedTrips + 1,
        totalStoresServed: existing.totalStoresServed + trip.dropoffs.length,
        totalDistanceKm: existing.totalDistanceKm + trip.distanceKm,
        totalEarnings,
        totalDieselExpenses: existing.totalDieselExpenses + (trip.expenses.dieselExpenses ?? 0),
        totalTollExpenses: existing.totalTollExpenses + (trip.expenses.tollGateExpenses ?? 0),
        totalCrewCosts: existing.totalCrewCosts + crewCosts,
        totalEntryAndOtherExpenses:
          existing.totalEntryAndOtherExpenses + entryAndOther,
        totalExpenses,
        netProfit,
        marginPercent: calculateProfitMargin(totalEarnings, netProfit),
      });
    }
  }

  return Array.from(byPlate.values()).sort((a, b) => b.netProfit - a.netProfit);
}

