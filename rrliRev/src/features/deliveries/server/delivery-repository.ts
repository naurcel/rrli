import "server-only";

import type {
  DeliveryStoreDropoff,
  DeliveryTripRecord,
  ExpenseResolutionStatus,
  FinancialState,
  PodVerificationStatus,
  TruckTemperature,
  TruckType,
} from "@/features/deliveries/delivery-domain";
import {
  getDeliveryPageRange,
  type DeliveryListQuery,
} from "@/features/deliveries/delivery-query";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type DeliveryLedgerItem = DeliveryTripRecord & {
  clientId: string;
  truckId: string;
  deliveryStatus: string;
  driverName: string | null;
  helperName: string | null;
};

export type DeliveryFilterOption = {
  id: string;
  label: string;
  ownershipType?: "Owned" | "Subcontracted";
};

export type DeliveryListResult = {
  items: DeliveryLedgerItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: {
    clients: DeliveryFilterOption[];
    trucks: DeliveryFilterOption[];
    statuses: string[];
    podStatuses: PodVerificationStatus[];
  };
};

type LedgerRow = Record<string, unknown>;
type DropoffRow = Record<string, unknown>;

function asNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asFinancialNumber(
  value: unknown,
  field: string,
  issues: string[],
): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    issues.push(`${field} contains an invalid numeric value.`);
    return null;
  }
  return parsed;
}

function asExpenseStatus(value: unknown, field: string, issues: string[]): ExpenseResolutionStatus {
  if (value === "confirmed" || value === "not_applicable" || value === "unknown") return value;
  issues.push(`${field} has an invalid expense resolution state.`);
  return "unknown";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mapDropoff(row: DropoffRow): DeliveryStoreDropoff {
  const issues: string[] = [];
  return {
    id: asString(row.id),
    sequence: asNumber(row.sequence_number),
    storeName: asString(row.store_name),
    destinationArea: asString(row.destination_area),
    entryFee: asFinancialNumber(row.entry_fee, "entry_fee", issues),
    entryFeeStatus: asExpenseStatus(row.entry_fee_status, "entry_fee_status", issues),
    podSubmitted: row.pod_submitted === true,
    supportingDocsComplete: row.supporting_docs_complete === true,
    documentRef: asString(row.document_ref) || "No document submitted",
  };
}

function mapLedgerRow(
  row: LedgerRow,
  dropoffs: readonly DeliveryStoreDropoff[],
): DeliveryLedgerItem {
  const financialIntegrityIssues: string[] = [];
  const deliveryRate = asFinancialNumber(row.delivery_rate, "delivery_rate", financialIntegrityIssues);
  const totalExpenses = asFinancialNumber(row.total_expenses, "total_expenses", financialIntegrityIssues);
  const netIncome = asFinancialNumber(row.net_income, "net_income", financialIntegrityIssues);
  const expenses = {
    dieselExpenses: asFinancialNumber(row.diesel_expenses, "diesel_expenses", financialIntegrityIssues),
    tollGateExpenses: asFinancialNumber(row.toll_gate_expenses, "toll_gate_expenses", financialIntegrityIssues),
    tollGateBreakdown: asString(row.toll_gate_breakdown),
    entryFees: asFinancialNumber(row.entry_fees, "entry_fees", financialIntegrityIssues),
    driverAllowance: asFinancialNumber(row.driver_allowance, "driver_allowance", financialIntegrityIssues),
    driverDailyRate: asFinancialNumber(row.driver_daily_rate, "driver_daily_rate", financialIntegrityIssues),
    helperAllowance: asFinancialNumber(row.helper_allowance, "helper_allowance", financialIntegrityIssues),
    helperDailyRate: asFinancialNumber(row.helper_daily_rate, "helper_daily_rate", financialIntegrityIssues),
    otherExpenses: asFinancialNumber(row.other_expenses, "other_expenses", financialIntegrityIssues),
  };
  const expenseStates = {
    dieselExpenses: asExpenseStatus(row.diesel_expenses_status, "diesel_expenses_status", financialIntegrityIssues),
    tollGateExpenses: asExpenseStatus(row.toll_gate_expenses_status, "toll_gate_expenses_status", financialIntegrityIssues),
    entryFees: asExpenseStatus(row.entry_fees_status, "entry_fees_status", financialIntegrityIssues),
    driverAllowance: asExpenseStatus(row.driver_allowance_status, "driver_allowance_status", financialIntegrityIssues),
    driverDailyRate: asExpenseStatus(row.driver_daily_rate_status, "driver_daily_rate_status", financialIntegrityIssues),
    helperAllowance: asExpenseStatus(row.helper_allowance_status, "helper_allowance_status", financialIntegrityIssues),
    helperDailyRate: asExpenseStatus(row.helper_daily_rate_status, "helper_daily_rate_status", financialIntegrityIssues),
    otherExpenses: asExpenseStatus(row.other_expenses_status, "other_expenses_status", financialIntegrityIssues),
  };
  for (const [field, status] of Object.entries(expenseStates)) {
    if (status === "unknown") financialIntegrityIssues.push(`${field} is unresolved.`);
  }

  return {
    id: asString(row.id),
    clientId: asString(row.client_id),
    truckId: asString(row.truck_id),
    waybillNumber: asString(row.waybill_number),
    deliveryDate: asString(row.delivery_date),
    clientName: asString(row.client_name),
    plateNumber: asString(row.plate_number),
    truckType: asString(row.truck_type_snapshot || row.truck_type) as TruckType,
    truckTemperature: asString(
      row.truck_temperature_snapshot || row.truck_temperature,
    ) as TruckTemperature,
    truckOwnership:
      row.truck_ownership_snapshot === "Subcontracted" ? "Subcontracted" : "Owned",
    rateBasis:
      row.rate_basis === "Trucker Rate" ? "Trucker Rate" : "Redeemed Rate",
    origin: asString(row.origin),
    distanceKm: asNumber(row.distance_km),
    fuelRate: asNumber(row.fuel_rate),
    deliveryRate,
    expenses,
    expenseStates,
    totalExpenses,
    netIncome,
    marginPercent:
      asFinancialNumber(row.profit_margin, "profit_margin", financialIntegrityIssues),
    financialState:
      row.financial_state === "finalized" ? "finalized" : "incomplete" as FinancialState,
    financialIntegrityIssues: [...new Set(financialIntegrityIssues)],
    version: asNumber(row.version) || 1,
    dropoffs,
    podStatus: asString(row.pod_status) as PodVerificationStatus,
    deliveryStatus: asString(row.delivery_status) || "Completed",
    driverName: asString(row.driver_name) || null,
    helperName: asString(row.helper_name) || null,
  };
}

export async function listDeliveryRecords(
  input: DeliveryListQuery,
): Promise<DeliveryListResult> {
  const supabase = await createServerSupabaseClient();
  const { from, to } = getDeliveryPageRange(input);

  let query = supabase
    .from("delivery_ledger")
    .select("*", { count: "exact" });

  if (input.search) {
    query = query.or(
      `waybill_number.ilike.%${input.search}%,plate_number.ilike.%${input.search}%,client_name.ilike.%${input.search}%`,
    );
  }
  if (input.clientIds && input.clientIds.length > 0) {
    query = query.in("client_id", input.clientIds);
  } else if (input.clientId) {
    query = query.eq("client_id", input.clientId);
  }
  if (input.truckIds && input.truckIds.length > 0) {
    const isUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const uuids = input.truckIds.filter(isUuid);
    const plates = input.truckIds.filter((t) => !isUuid(t));
    if (uuids.length > 0 && plates.length > 0) {
      query = query.or(
        `truck_id.in.(${uuids.join(",")}),plate_number.in.(${plates.join(",")})`,
      );
    } else if (uuids.length > 0) {
      query = query.in("truck_id", uuids);
    } else if (plates.length > 0) {
      query = query.in("plate_number", plates);
    }
  } else if (input.truckId) {
    query = query.eq("truck_id", input.truckId);
  }
  if (input.status) query = query.eq("delivery_status", input.status);
  if (input.podStatus) query = query.eq("pod_status", input.podStatus);
  if (input.dateFrom) query = query.gte("delivery_date", input.dateFrom);
  if (input.dateTo) query = query.lte("delivery_date", input.dateTo);

  const sortColumn = {
    waybill: "waybill_number",
    client: "client_name",
    truck: "plate_number",
    temperature: "truck_temperature_snapshot",
    origin: "origin",
    dropoffs: "delivery_date",
    distance: "distance_km",
    delivery_date: "delivery_date",
    delivery_rate: "delivery_rate",
    total_expenses: "total_expenses",
    net_income: "net_income",
    profit_margin: "profit_margin",
    pod_status: "pod_status",
  }[input.sort];
  const response = await query
    .order(sortColumn, {
      ascending: input.direction === "asc",
      nullsFirst: input.direction === "asc",
    })
    .order("id", { ascending: true })
    .range(from, to);

  if (response.error) {
    throw new Error(`Unable to load deliveries: ${response.error.message}`);
  }

  const rows = (response.data ?? []) as LedgerRow[];
  const deliveryIds = rows.map((row) => asString(row.id)).filter(Boolean);
  const dropoffsByDelivery = new Map<string, DeliveryStoreDropoff[]>();

  if (deliveryIds.length > 0) {
    const dropoffResponse = await supabase
      .from("delivery_dropoffs")
      .select(
        "id, delivery_id, sequence_number, store_name, destination_area, entry_fee, entry_fee_status, pod_submitted, supporting_docs_complete, document_ref",
      )
      .in("delivery_id", deliveryIds)
      .order("sequence_number", { ascending: true });

    if (dropoffResponse.error) {
      throw new Error(`Unable to load delivery stores: ${dropoffResponse.error.message}`);
    }

    for (const raw of (dropoffResponse.data ?? []) as DropoffRow[]) {
      const deliveryId = asString(raw.delivery_id);
      const current = dropoffsByDelivery.get(deliveryId) ?? [];
      current.push(mapDropoff(raw));
      dropoffsByDelivery.set(deliveryId, current);
    }
  }

  const [clientsResponse, trucksResponse] = await Promise.all([
    supabase.from("clients").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("trucks")
      .select("id, plate_number")
      .eq("is_active", true)
      .order("plate_number"),
  ]);

  if (clientsResponse.error || trucksResponse.error) {
    throw new Error(
      `Unable to load delivery filters: ${
        clientsResponse.error?.message ?? trucksResponse.error?.message
      }`,
    );
  }

  const total = response.count ?? 0;
  return {
    items: rows.map((row) =>
      mapLedgerRow(row, dropoffsByDelivery.get(asString(row.id)) ?? []),
    ),
    total,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
    filters: {
      clients: (clientsResponse.data ?? []).map((row) => ({
        id: row.id,
        label: row.name,
      })),
      trucks: (trucksResponse.data ?? []).map((row) => ({
        id: row.id,
        label: row.plate_number,
        ownershipType: "Owned" as const,
      })),
      statuses: ["Completed"],
      podStatuses: ["Verified", "Incomplete", "Pending"],
    },
  };
}
