/**
 * RouteX Domain Model — Revised Scope: Delivery Operations & Truck Profitability
 *
 * Structured around the company's Daily Trip Report:
 * -Separates delivery-level trip information, truck attributes, employee trip costs
 *  (driver/helper daily rates and allowances), itemized trip expenses, and
 *  multi-store drop-off stops within a single delivery.
 */

export type TruckType = "4-Wheeler" | "6-Wheeler" | "10-Wheeler";
export type TruckTemperature = `${number}°C`;
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
  dropoffCount?: number;
  entryFee: number | null;
  entryFeeStatus: ExpenseResolutionStatus;
  podSubmitted: boolean;
  supportingDocsComplete: boolean;
  documentRef: string;
};

export function getTripTotalDropoffs(
  dropoffs: readonly DeliveryStoreDropoff[] | undefined | null,
): number {
  if (!dropoffs || dropoffs.length === 0) return 0;
  return dropoffs.reduce((sum, stop) => sum + Math.max(1, stop.dropoffCount ?? 1), 0);
}

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

export type SupportingDocumentRecord = {
  id?: string;
  name: string;
  dropoffId?: string | null;
  storeName?: string | null;
  fileUrl?: string | null;
  uploadedAt?: string;
};

export type SupportingDocumentItem = string | SupportingDocumentRecord;

export function getSupportingDocName(doc: SupportingDocumentItem): string {
  return typeof doc === "string" ? doc : doc.name;
}

export function getSupportingDocDropoffId(doc: SupportingDocumentItem): string | null {
  return typeof doc === "string" ? null : (doc.dropoffId ?? null);
}

export function normalizeSupportingDocument(
  doc: SupportingDocumentItem,
  index: number = 0,
): SupportingDocumentRecord {
  if (typeof doc === "string") {
    return {
      id: `doc-${index}-${doc}`,
      name: doc,
      dropoffId: null,
      storeName: null,
    };
  }
  return {
    id: doc.id || `doc-${index}-${doc.name}`,
    name: doc.name,
    dropoffId: doc.dropoffId ?? null,
    storeName: doc.storeName ?? null,
    fileUrl: doc.fileUrl,
    uploadedAt: doc.uploadedAt,
  };
}

export type DeliveryTripRecord = {
  id: string;
  waybillNumber: string;
  deliveryDate: string; // YYYY-MM-DD
  recordingDelayed?: boolean;
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
  supportingDocuments?: readonly SupportingDocumentItem[];
  notes?: string | null;
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

/**
 * Returns any missing operational or financial issues for a delivery.
 * Rule: As long as something is missing (apart from optional supporting documents), it is incomplete.
 * Missing items: missing POD, unknown expenses, unconfirmed amounts, missing revenue, unresolved entry fees, missing driver.
 * Supporting documents (supportingDocsComplete, supportingDocuments) are NOT required for completeness.
 */
export const HUMAN_FRIENDLY_EXPENSE_ISSUES: Record<string, string> = {
  dieselExpenses: "Pending fuel receipt",
  tollGateExpenses: "Pending toll receipts",
  entryFees: "Pending store entry fee",
  driverAllowance: "Pending driver allowance",
  driverDailyRate: "Pending driver rate",
  helperAllowance: "Pending helper allowance",
  helperDailyRate: "Pending helper rate",
  otherExpenses: "Pending other expenses",
};

export function formatFinancialIntegrityIssue(raw: string): string {
  const camelMatch = raw.match(
    /^(dieselExpenses|tollGateExpenses|entryFees|driverAllowance|driverDailyRate|helperAllowance|helperDailyRate|otherExpenses)\s+(.*)$/i,
  );
  if (camelMatch) {
    const key = camelMatch[1] as keyof typeof HUMAN_FRIENDLY_EXPENSE_ISSUES;
    const rest = camelMatch[2].toLowerCase();
    const friendlyName = HUMAN_FRIENDLY_EXPENSE_ISSUES[key] || "Trip expense";
    if (rest.includes("unresolved") || rest.includes("unknown")) {
      return friendlyName;
    }
    if (rest.includes("no amount") || rest.includes("missing")) {
      const nounMap: Record<string, string> = {
        dieselExpenses: "fuel receipt",
        tollGateExpenses: "toll receipts",
        entryFees: "store entry fee",
        driverAllowance: "driver allowance",
        driverDailyRate: "driver rate",
        helperAllowance: "helper allowance",
        helperDailyRate: "helper rate",
        otherExpenses: "other expenses",
      };
      return `Missing ${nounMap[key] ?? "expense"} amount`;
    }
  }
  return raw;
}

export function getDeliveryIncompleteIssues(delivery: DeliveryTripRecord): string[] {
  const issues: string[] = [];

  // 1. Missing Proof of Delivery (POD) for any store drop-off
  const missingPods = (delivery.dropoffs ?? []).filter((d) => !d.podSubmitted);
  if (missingPods.length > 0) {
    if (missingPods.length === 1) {
      const fullStoreName = missingPods[0].storeName.trim();
      const primaryStore = fullStoreName.split(/\s*[-–—@/(]\s*/)[0].trim();
      const conciseName = primaryStore.length > 0 && primaryStore.length <= 14 ? primaryStore : "";
      issues.push(conciseName ? `Missing POD: ${conciseName}` : "Missing POD");
    } else {
      issues.push(`Missing PODs (${missingPods.length})`);
    }
  }

  // 2. Pending or unconfirmed expenses
  const unknownKeys = Object.entries(delivery.expenseStates ?? {})
    .filter(([_, status]) => status === "unknown")
    .map(([key]) => key);

  if (unknownKeys.length > 0) {
    if (unknownKeys.length <= 2) {
      for (const key of unknownKeys) {
        issues.push(HUMAN_FRIENDLY_EXPENSE_ISSUES[key] ?? `Pending ${key}`);
      }
    } else {
      issues.push(`Pending expenses (${unknownKeys.length})`);
    }
  }

  // 3. Pending store entry fees
  const unknownEntryFees = (delivery.dropoffs ?? []).filter((d) => d.entryFeeStatus === "unknown");
  if (unknownEntryFees.length > 0 && !unknownKeys.includes("entryFees")) {
    issues.push(unknownEntryFees.length === 1 ? "Pending store entry fee" : `Pending store entry fees (${unknownEntryFees.length})`);
  }

  // 4. Missing agreed delivery rate
  if (delivery.deliveryRate == null || delivery.deliveryRate <= 0) {
    issues.push("Missing delivery rate");
  }

  // 5. Explicit financial integrity issues (sanitized into clean operational text)
  if (delivery.financialIntegrityIssues && delivery.financialIntegrityIssues.length > 0) {
    for (const rawIssue of delivery.financialIntegrityIssues) {
      const clean = formatFinancialIntegrityIssue(rawIssue);
      if (!issues.includes(clean)) {
        issues.push(clean);
      }
    }
  }

  // 6. Missing core operational personnel (driver)
  const dName = (delivery as unknown as { driverName?: string | null }).driverName;
  if (dName !== undefined && (!dName || dName.trim() === "")) {
    issues.push("No driver assigned");
  }

  return issues;
}

/**
 * Returns true if the delivery is incomplete (i.e. has any missing operational or financial details apart from supporting docs).
 */
export function isDeliveryIncomplete(delivery: DeliveryTripRecord): boolean {
  return getDeliveryIncompleteIssues(delivery).length > 0;
}

/**
 * Checks whether a delivery's finances are 100% complete and confirmed.
 * Once finances are complete, the record's revenue, expenses, and net profit are included in calculations.
 */
export function isDeliveryFinanciallyComplete(delivery: DeliveryTripRecord): boolean {
  if (delivery.deliveryRate == null || delivery.deliveryRate <= 0) return false;
  if (delivery.totalExpenses == null || !Number.isFinite(delivery.totalExpenses)) return false;
  if (delivery.netIncome == null || !Number.isFinite(delivery.netIncome)) return false;

  const states = Object.values(delivery.expenseStates ?? {});
  if (states.length > 0 && states.some((s) => s === "unknown")) return false;

  if ((delivery.dropoffs ?? []).some((d) => d.entryFeeStatus === "unknown")) return false;

  if ((delivery.financialIntegrityIssues?.length ?? 0) > 0) return false;

  return delivery.financialState === "finalized";
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
  recordingDelayed?: boolean;
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
  supportingDocuments?: readonly SupportingDocumentItem[];
  notes?: string | null;
  dropoffs: readonly (Omit<DeliveryStoreDropoff, "entryFeeStatus"> & {
    entryFeeStatus?: ExpenseResolutionStatus;
  })[];
}): DeliveryTripRecord {
  const normalizedDropoffs: DeliveryStoreDropoff[] = input.dropoffs.map((stop) => ({
    ...stop,
    dropoffCount: Math.max(1, Number(stop.dropoffCount) || 1),
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
    recordingDelayed: input.recordingDelayed ?? false,
    clientName: input.clientName,
    plateNumber: input.plateNumber,
    truckType: input.truckType,
    truckTemperature: input.truckTemperature,
    truckOwnership: input.truckOwnership ?? "Owned",
    rateBasis:
      input.rateBasis ??
      ((input.truckOwnership ?? "Owned") === "Subcontracted"
        ? "Trucker Rate"
        : "Redeemed Rate"),
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
    supportingDocuments: input.supportingDocuments ?? [],
    notes: input.notes ?? null,
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
    fuelRate: 85.5,
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
    truckTemperature: "4°C",
    origin: "Meycauayan Consolidation Depot",
    distanceKm: 78,
    fuelRate: 84.5,
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
    fuelRate: 88.0,
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
    truckTemperature: "-18°C",
    origin: "Marilao Cold Chain Hub",
    distanceKm: 64,
    fuelRate: 83.5,
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
    truckTemperature: "4°C",
    origin: "Meycauayan Consolidation Depot",
    distanceKm: 52,
    fuelRate: 82.5,
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
    const plateKey = trip.plateNumber.trim().toUpperCase();
    const existing = byPlate.get(plateKey);
    const crewCosts =
      (trip.expenses.driverAllowance ?? 0) +
      (trip.expenses.driverDailyRate ?? 0) +
      (trip.expenses.helperAllowance ?? 0) +
      (trip.expenses.helperDailyRate ?? 0);
    const entryAndOther =
      (trip.expenses.entryFees ?? 0) + (trip.expenses.otherExpenses ?? 0);

    if (!existing) {
      const netProfit = trip.deliveryRate - trip.totalExpenses;
      byPlate.set(plateKey, {
        plateNumber: trip.plateNumber,
        truckType: trip.truckType,
        completedTrips: 1,
        totalStoresServed: getTripTotalDropoffs(trip.dropoffs),
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

      byPlate.set(plateKey, {
        ...existing,
        completedTrips: existing.completedTrips + 1,
        totalStoresServed: existing.totalStoresServed + getTripTotalDropoffs(trip.dropoffs),
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

