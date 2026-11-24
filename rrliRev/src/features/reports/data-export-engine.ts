import * as XLSX from "xlsx";
import {
  calculateProfitMargin,
  type DeliveryTripRecord,
  getTripTotalDropoffs,
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
  summarizeTruckProfitability,
} from "../deliveries/delivery-domain.ts";
import type { DeliveryLedgerItem } from "../deliveries/server/delivery-repository.ts";
import { FLEET_TRUCKS } from "../deliveries/truck-registry.ts";
import { getFleetCrew } from "../deliveries/driver-registry.ts";
import {
  filterExpensesByDateRange,
  type CompanyExpense,
} from "../finance/company-expense-domain.ts";
import {
  subjectHasPermission,
  subjectIsAdminOrSuperadmin,
  type PermissionCheckSubject,
  type UserRole,
} from "../../lib/auth/rbac.ts";

export type DataExportPackageType =
  | "datasets_csv"
  | "datasets_xlsx"
  | "database_json"
  | "database_sql"
  | "website_recreation";

export type DataExportRequestStatus = "pending" | "approved" | "rejected";

export interface DataExportRequest {
  id: string;
  packageType: DataExportPackageType;
  packageLabel: string;
  requestedByUsername: string;
  requestedByFullName: string;
  requestedByRole: "operations" | "finance" | "admin";
  reason: string;
  dateFrom: string | null;
  dateTo: string | null;
  periodLabel: string;
  status: DataExportRequestStatus;
  requestedAt: string;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export interface ScopedExportPayload {
  generatedAt: string;
  generatedBy: string;
  periodLabel: string;
  dateFrom: string | null;
  dateTo: string | null;
  summary: {
    totalDeliveries: number;
    finalizedDeliveries: number;
    incompleteDeliveries: number;
    totalDropoffs: number;
    deliveryRevenue: number;
    deliveryExpenses: number;
    deliveryNetProfit: number;
    companyExpenses: number;
    companyNetProfit: number;
    companyProfitMargin: number | null;
  };
  deliveries: DeliveryLedgerItem[];
  companyExpenses: CompanyExpense[];
  trucks: typeof FLEET_TRUCKS;
  crew: ReturnType<typeof getFleetCrew>;
}

export const DATA_EXPORT_PACKAGE_CATALOG: Record<
  DataExportPackageType,
  {
    id: DataExportPackageType;
    title: string;
    badge: string;
    extension: string;
    mimeType: string;
    description: string;
  }
> = {
  datasets_csv: {
    id: "datasets_csv",
    title: "Complete Datasets Bundle (CSV)",
    badge: "CSV SPREADSHEET",
    extension: "csv",
    mimeType: "text/csv;charset=utf-8",
    description:
      "Multi-table delimited text spreadsheet export containing deliveries, store drop-offs, truck profitability summaries, crew assignments, and company expenses for the selected date filter.",
  },
  datasets_xlsx: {
    id: "datasets_xlsx",
    title: "Complete Datasets Workbook (.XLSX)",
    badge: "EXCEL WORKBOOK",
    extension: "xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    description:
      "Multi-sheet Microsoft Excel (.xlsx) workbook with dedicated styled sheets for Executive Summary, Completed Deliveries, Store Drop-offs, Truck Profitability, Company Expenses, and Crew Directory.",
  },
  database_json: {
    id: "database_json",
    title: "Relational Database Snapshot (JSON)",
    badge: "JSON DB",
    extension: "json",
    mimeType: "application/json;charset=utf-8",
    description:
      "Structured JSON database dump of all date-filtered operational tables, foreign-key references, financial states, and metadata.",
  },
  database_sql: {
    id: "database_sql",
    title: "SQL Database Dump (.SQL)",
    badge: "POSTGRES SQL",
    extension: "sql",
    mimeType: "application/sql;charset=utf-8",
    description:
      "Portable SQL schema and INSERT statements for clients, trucks, crew, deliveries, store drop-offs, and company expenses within the active date range.",
  },
  website_recreation: {
    id: "website_recreation",
    title: "Whole Working Website Recreation (HTML)",
    badge: "STANDALONE WEB APP",
    extension: "html",
    mimeType: "text/html;charset=utf-8",
    description:
      "Self-contained, offline-capable interactive RouteX web application preloaded with the date-filtered database (Dashboard, Deliveries, Trucks, Finance, PODs, search, filters, and dark mode).",
  },
};

export const EXPORT_REQUESTS_STORAGE_KEY = "routex-data-export-requests-v1";
export const ROUTEX_EXPORT_REQUESTS_CHANGED = "routex:export-requests-changed";

const INITIAL_EXPORT_REQUESTS: DataExportRequest[] = [
  {
    id: "exp-req-1001",
    packageType: "datasets_csv",
    packageLabel: DATA_EXPORT_PACKAGE_CATALOG.datasets_csv.title,
    requestedByUsername: "operations",
    requestedByFullName: "Operations Personnel",
    requestedByRole: "operations",
    reason: "Weekly dispatch audit and store drop-off reconciliation with warehouse staging team.",
    dateFrom: "2026-10-27",
    dateTo: "2026-11-16",
    periodLabel: "Oct 27, 2026 - Nov 16, 2026",
    status: "pending",
    requestedAt: "2026-11-17T09:15:00.000Z",
    reviewedByUsername: null,
    reviewedAt: null,
    reviewNotes: null,
  },
  {
    id: "exp-req-1002",
    packageType: "website_recreation",
    packageLabel: DATA_EXPORT_PACKAGE_CATALOG.website_recreation.title,
    requestedByUsername: "finance",
    requestedByFullName: "Finance Officer",
    requestedByRole: "finance",
    reason: "Offline interactive RouteX snapshot for monthly board profitability presentation.",
    dateFrom: null,
    dateTo: null,
    periodLabel: "All Time",
    status: "pending",
    requestedAt: "2026-11-17T14:40:00.000Z",
    reviewedByUsername: null,
    reviewedAt: null,
    reviewNotes: null,
  },
  {
    id: "exp-req-1003",
    packageType: "database_json",
    packageLabel: DATA_EXPORT_PACKAGE_CATALOG.database_json.title,
    requestedByUsername: "finance",
    requestedByFullName: "Finance Officer",
    requestedByRole: "finance",
    reason: "External accounting archive for October 2026 finalized delivery and company expenses.",
    dateFrom: "2026-10-01",
    dateTo: "2026-10-31",
    periodLabel: "Oct 1, 2026 - Oct 31, 2026",
    status: "approved",
    requestedAt: "2026-11-15T11:20:00.000Z",
    reviewedByUsername: "admin",
    reviewedAt: "2026-11-15T13:05:00.000Z",
    reviewNotes: "Approved for October accounting close.",
  },
];

export function canAccessDataExportTab(subject: PermissionCheckSubject): boolean {
  if (typeof subject === "string") {
    return subject === "admin" || subject === "operations" || subject === "finance";
  }
  return (
    subjectIsAdminOrSuperadmin(subject) ||
    subjectHasPermission(subject, "reports:export") ||
    subject.role === "operations" ||
    subject.role === "finance"
  );
}

export function canApproveDataExports(subject: PermissionCheckSubject): boolean {
  return subjectIsAdminOrSuperadmin(subject);
}

export function canRequestDataExports(subject: PermissionCheckSubject): boolean {
  if (subjectIsAdminOrSuperadmin(subject)) return false;
  if (typeof subject === "string") {
    return subject === "operations" || subject === "finance";
  }
  return (
    subjectHasPermission(subject, "reports:export") ||
    subject.role === "operations" ||
    subject.role === "finance"
  );
}

export function canDownloadExportRequest(
  request: DataExportRequest,
  actor: {
    role: UserRole;
    roles?: readonly string[];
    permissions?: readonly string[];
    isSuperadmin?: boolean;
    username: string;
  },
): boolean {
  if (actor.isSuperadmin || actor.role === "admin" || actor.roles?.includes("admin")) return true;
  if (request.status !== "approved") return false;
  return (
    request.requestedByRole === actor.role ||
    request.requestedByUsername.toLowerCase() === actor.username.toLowerCase()
  );
}

export function readExportRequests(): DataExportRequest[] {
  if (typeof window === "undefined") {
    return INITIAL_EXPORT_REQUESTS.map((r) => ({ ...r }));
  }
  try {
    const raw = window.localStorage.getItem(EXPORT_REQUESTS_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        EXPORT_REQUESTS_STORAGE_KEY,
        JSON.stringify(INITIAL_EXPORT_REQUESTS),
      );
      return INITIAL_EXPORT_REQUESTS.map((r) => ({ ...r }));
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return INITIAL_EXPORT_REQUESTS.map((r) => ({ ...r }));
    }
    return parsed as DataExportRequest[];
  } catch {
    return INITIAL_EXPORT_REQUESTS.map((r) => ({ ...r }));
  }
}

export function writeExportRequests(requests: DataExportRequest[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EXPORT_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
    window.dispatchEvent(new CustomEvent(ROUTEX_EXPORT_REQUESTS_CHANGED));
  } catch {
    // Ignore storage quota errors
  }
}

export function createDataExportRequest(input: {
  packageType: DataExportPackageType;
  requestedByUsername: string;
  requestedByFullName: string;
  requestedByRole: "operations" | "finance";
  reason: string;
  dateFrom: string | null;
  dateTo: string | null;
  periodLabel: string;
}): DataExportRequest {
  const pkg = DATA_EXPORT_PACKAGE_CATALOG[input.packageType];
  const newReq: DataExportRequest = {
    id: `exp-req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    packageType: input.packageType,
    packageLabel: pkg.title,
    requestedByUsername: input.requestedByUsername,
    requestedByFullName: input.requestedByFullName,
    requestedByRole: input.requestedByRole,
    reason: input.reason.trim(),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    periodLabel: input.periodLabel,
    status: "pending",
    requestedAt: new Date().toISOString(),
    reviewedByUsername: null,
    reviewedAt: null,
    reviewNotes: null,
  };
  const current = readExportRequests();
  writeExportRequests([newReq, ...current]);
  return newReq;
}

export function reviewDataExportRequest(input: {
  requestId: string;
  decision: "approved" | "rejected";
  reviewerRole: UserRole;
  reviewerUsername: string;
  reviewNotes?: string;
}): DataExportRequest {
  if (!canApproveDataExports(input.reviewerRole)) {
    throw new Error("Only Admin can approve or reject data export requests.");
  }
  const current = readExportRequests();
  const idx = current.findIndex((r) => r.id === input.requestId);
  if (idx < 0) {
    throw new Error("Export request not found.");
  }
  const updated: DataExportRequest = {
    ...current[idx],
    status: input.decision,
    reviewedByUsername: input.reviewerUsername,
    reviewedAt: new Date().toISOString(),
    reviewNotes: input.reviewNotes?.trim() || null,
  };
  const next = [...current];
  next[idx] = updated;
  writeExportRequests(next);
  return updated;
}

export function buildScopedExportPayload(input: {
  deliveries: readonly DeliveryLedgerItem[];
  companyExpenses: readonly CompanyExpense[];
  dateFrom: string | null;
  dateTo: string | null;
  periodLabel: string;
  generatedBy: string;
}): ScopedExportPayload {
  const scopedDeliveries = input.deliveries.filter((d) => {
    const day = d.deliveryDate.slice(0, 10);
    if (input.dateFrom && day < input.dateFrom) return false;
    if (input.dateTo && day > input.dateTo) return false;
    return true;
  });

  const scopedExpenses = filterExpensesByDateRange(
    [...input.companyExpenses],
    input.dateFrom,
    input.dateTo,
  );

  const finalized = scopedDeliveries.filter(isDeliveryFinanciallyComplete);
  const incompleteCount = scopedDeliveries.filter(isDeliveryIncomplete).length;
  const totalDropoffs = scopedDeliveries.reduce((sum, d) => sum + getTripTotalDropoffs(d.dropoffs), 0);
  const deliveryRevenue = finalized.reduce((sum, d) => sum + (d.deliveryRate ?? 0), 0);
  const deliveryExpenses = finalized.reduce((sum, d) => sum + (d.totalExpenses ?? 0), 0);
  const deliveryNetProfit = deliveryRevenue - deliveryExpenses;
  const companyExpensesTotal = scopedExpenses.filter((e) => e.transactionType !== "Incoming").reduce((sum, e) => sum + e.amount, 0);
  const companyIncomeTotal = scopedExpenses.filter((e) => e.transactionType === "Incoming").reduce((sum, e) => sum + e.amount, 0);
  const companyNetProfit = deliveryNetProfit + companyIncomeTotal - companyExpensesTotal;
  const companyProfitMargin = calculateProfitMargin(deliveryRevenue, companyNetProfit);

  return {
    generatedAt: new Date().toISOString(),
    generatedBy: input.generatedBy,
    periodLabel: input.periodLabel,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    summary: {
      totalDeliveries: scopedDeliveries.length,
      finalizedDeliveries: finalized.length,
      incompleteDeliveries: incompleteCount,
      totalDropoffs,
      deliveryRevenue,
      deliveryExpenses,
      deliveryNetProfit,
      companyExpenses: companyExpensesTotal,
      companyNetProfit,
      companyProfitMargin,
    },
    deliveries: scopedDeliveries,
    companyExpenses: scopedExpenses,
    trucks: FLEET_TRUCKS,
    crew: getFleetCrew(),
  };
}

function csvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateDatasetsCsvBundle(payload: ScopedExportPayload): string {
  const lines: string[] = [];
  lines.push("REDEEMED ROUTE LOGISTICS INC. - ROUTEX COMPLETE DATASETS EXPORT");
  lines.push(`Date Filter Period,${csvCell(payload.periodLabel)}`);
  lines.push(`Date Range Bounds,${csvCell(payload.dateFrom ?? "Start")} to ${csvCell(payload.dateTo ?? "Present")}`);
  lines.push(`Generated At,${csvCell(payload.generatedAt)}`);
  lines.push(`Generated By,@${csvCell(payload.generatedBy)}`);
  lines.push("");

  // Section 1: Summary KPIs
  lines.push("=== 1. FINANCIAL & OPERATIONAL SUMMARY (DATE-FILTERED) ===");
  lines.push("Metric,Value");
  lines.push(`Total Deliveries,${payload.summary.totalDeliveries}`);
  lines.push(`Finalized Deliveries,${payload.summary.finalizedDeliveries}`);
  lines.push(`Incomplete Deliveries,${payload.summary.incompleteDeliveries}`);
  lines.push(`Total Store Drop-offs,${payload.summary.totalDropoffs}`);
  lines.push(`Delivery Revenue (PHP),${payload.summary.deliveryRevenue}`);
  lines.push(`Delivery Expenses (PHP),${payload.summary.deliveryExpenses}`);
  lines.push(`Delivery Net Profit (PHP),${payload.summary.deliveryNetProfit}`);
  lines.push(`Company Operating Expenses (PHP),${payload.summary.companyExpenses}`);
  lines.push(`Company Net Profit (PHP),${payload.summary.companyNetProfit}`);
  lines.push(
    `Company Profit Margin (%),${payload.summary.companyProfitMargin != null ? payload.summary.companyProfitMargin.toFixed(2) : "N/A"}`,
  );
  lines.push("");

  // Section 2: Deliveries Dataset
  lines.push("=== 2. DELIVERIES DATASET ===");
  lines.push(
    [
      "Delivery ID",
      "Waybill Number",
      "Delivery Date",
      "Client Name",
      "Truck Plate",
      "Truck Type",
      "Ownership",
      "Temperature",
      "Origin",
      "Distance (km)",
      "Fuel Rate",
      "Driver",
      "Helper",
      "Drop-off Count",
      "Delivery Rate (PHP)",
      "Diesel (PHP)",
      "Toll Gates (PHP)",
      "Entry Fees (PHP)",
      "Driver Rate (PHP)",
      "Driver Allowance (PHP)",
      "Helper Rate (PHP)",
      "Helper Allowance (PHP)",
      "Other Expenses (PHP)",
      "Total Expenses (PHP)",
      "Net Profit (PHP)",
      "Financial State",
      "POD Status",
    ].join(","),
  );
  for (const d of payload.deliveries) {
    lines.push(
      [
        d.id,
        d.waybillNumber,
        d.deliveryDate,
        d.clientName,
        d.plateNumber,
        d.truckType,
        d.truckOwnership,
        d.truckTemperature,
        d.origin,
        d.distanceKm,
        d.fuelRate,
        d.driverName ?? "",
        d.helperName ?? "",
        getTripTotalDropoffs(d.dropoffs),
        d.deliveryRate ?? "",
        d.expenses.dieselExpenses ?? "",
        d.expenses.tollGateExpenses ?? "",
        d.expenses.entryFees ?? "",
        d.expenses.driverDailyRate ?? "",
        d.expenses.driverAllowance ?? "",
        d.expenses.helperDailyRate ?? "",
        d.expenses.helperAllowance ?? "",
        d.expenses.otherExpenses ?? "",
        d.totalExpenses ?? "",
        d.netIncome ?? "",
        d.financialState,
        d.podStatus,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push("");

  // Section 3: Store Drop-offs Dataset
  lines.push("=== 3. STORE DROP-OFFS & POD DATASET ===");
  lines.push(
    [
      "Drop-off ID",
      "Delivery ID",
      "Waybill Number",
      "Delivery Date",
      "Sequence",
      "Store Name",
      "Destination Area",
      "Entry Fee (PHP)",
      "Entry Fee Status",
      "POD Submitted",
      "Supporting Docs Complete",
      "Document Reference",
    ].join(","),
  );
  for (const d of payload.deliveries) {
    for (const stop of d.dropoffs) {
      lines.push(
        [
          stop.id,
          d.id,
          d.waybillNumber,
          d.deliveryDate,
          stop.sequence,
          stop.storeName,
          stop.destinationArea,
          stop.entryFee ?? 0,
          stop.entryFeeStatus,
          stop.podSubmitted ? "Yes" : "No",
          stop.supportingDocsComplete ? "Yes" : "No",
          stop.documentRef,
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  lines.push("");

  // Section 4: Truck Profitability Dataset
  const truckSummaries = summarizeTruckProfitability(payload.deliveries);
  lines.push("=== 4. TRUCK PROFITABILITY DATASET (DATE-FILTERED) ===");
  lines.push(
    [
      "Plate Number",
      "Completed Finalized Trips",
      "Total Revenue (PHP)",
      "Total Expenses (PHP)",
      "Net Profit (PHP)",
      "Profit Margin (%)",
    ].join(","),
  );
  for (const t of truckSummaries) {
    lines.push(
      [
        t.plateNumber,
        t.completedTrips,
        t.totalEarnings,
        t.totalExpenses,
        t.netProfit,
        t.marginPercent != null ? t.marginPercent.toFixed(2) : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push("");

  // Section 5: Company Operating Expenses Dataset
  lines.push("=== 5. COMPANY OPERATING EXPENSES DATASET (DATE-FILTERED) ===");
  lines.push(["Expense ID", "Date", "Description", "Amount (PHP)", "Notes", "Recorded By"].join(","));
  for (const e of payload.companyExpenses) {
    lines.push(
      [e.id, e.expenseDate, e.description, e.amount, e.notes ?? "", e.createdBy ?? ""]
        .map(csvCell)
        .join(","),
    );
  }

  lines.push("");

  // Section 6: Reference Daily Trip Report (DTR Format)
  lines.push("=== 6. REFERENCE DAILY TRIP REPORT (DTR FORMAT) ===");
  const dtrAoa = buildDailyTripReportAoa(payload);
  for (const row of dtrAoa) {
    lines.push(row.map(csvCell).join(","));
  }
  lines.push("");

  // Section 7: Reference Finance - Service Invoice (Billings)
  lines.push("=== 7. REFERENCE FINANCE - SERVICE INVOICE (BILLINGS) ===");
  const siAoa = buildServiceInvoiceAoa(payload);
  for (const row of siAoa) {
    lines.push(row.map(csvCell).join(","));
  }
  lines.push("");

  // Section 8: Reference Finance - Disbursement (Daily Expense)
  lines.push("=== 8. REFERENCE FINANCE - DISBURSEMENT (DAILY EXPENSE) ===");
  const disbAoa = buildDisbursementAoa(payload);
  for (const row of disbAoa) {
    lines.push(row.map(csvCell).join(","));
  }
  lines.push("");

  // Section 9: Reference Finance - Collection (Revenue)
  lines.push("=== 9. REFERENCE FINANCE - COLLECTION (REVENUE) ===");
  const collAoa = buildCollectionAoa(payload);
  for (const row of collAoa) {
    lines.push(row.map(csvCell).join(","));
  }
  lines.push("");

  // Section 10: Reference Finance - Payables (Credited Paid)
  lines.push("=== 10. REFERENCE FINANCE - PAYABLES (CREDITED_PAID) ===");
  const payPaidAoa = buildPayablesPaidAoa(payload);
  for (const row of payPaidAoa) {
    lines.push(row.map(csvCell).join(","));
  }
  lines.push("");

  // Section 11: Reference Finance - Receivables
  lines.push("=== 11. REFERENCE FINANCE - RECEIVABLES ===");
  const recAoa = buildReceivablesAoa(payload);
  for (const row of recAoa) {
    lines.push(row.map(csvCell).join(","));
  }

  return "\uFEFF" + lines.join("\r\n");
}

export function generateDatabaseJsonDump(payload: ScopedExportPayload): string {
  return JSON.stringify(
    {
      schemaVersion: "routex-db-snapshot-v1",
      organization: "Redeemed Route Logistics Inc.",
      system: "RouteX Trucking Profitability Management System",
      exportMetadata: {
        generatedAt: payload.generatedAt,
        generatedBy: payload.generatedBy,
        periodLabel: payload.periodLabel,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
      },
      summary: payload.summary,
      tables: {
        trucks: payload.trucks,
        crew: payload.crew,
        deliveries: payload.deliveries,
        delivery_dropoffs: payload.deliveries.flatMap((d) =>
          d.dropoffs.map((stop) => ({
            ...stop,
            deliveryId: d.id,
            waybillNumber: d.waybillNumber,
            deliveryDate: d.deliveryDate,
          })),
        ),
        company_expenses: payload.companyExpenses,
      },
    },
    null,
    2,
  );
}

function sqlLiteral(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  return `'${String(val).replace(/'/g, "''")}'`;
}

export function generateDatabaseSqlDump(payload: ScopedExportPayload): string {
  const lines: string[] = [];
  lines.push("-- ============================================================================");
  lines.push("-- RouteX Relational Database Export (.SQL)");
  lines.push("-- Redeemed Route Logistics Inc.");
  lines.push(`-- Period Filter: ${payload.periodLabel} (${payload.dateFrom ?? "Start"} to ${payload.dateTo ?? "Present"})`);
  lines.push(`-- Generated At: ${payload.generatedAt} by @${payload.generatedBy}`);
  lines.push("-- ============================================================================");
  lines.push("");
  lines.push("BEGIN;");
  lines.push("");
  lines.push("-- 1. Trucks Table");
  for (const t of payload.trucks) {
    lines.push(
      `INSERT INTO public.trucks (id, plate_number, truck_type, ownership_type, rate_basis, is_active) VALUES (${sqlLiteral(t.id)}, ${sqlLiteral(t.plateNumber)}, ${sqlLiteral(t.truckType)}, ${sqlLiteral(t.ownershipType)}, ${sqlLiteral(t.rateBasis)}, TRUE) ON CONFLICT (id) DO NOTHING;`,
    );
  }
  lines.push("");
  lines.push("-- 2. Deliveries Table (Date-Filtered)");
  for (const d of payload.deliveries) {
    lines.push(
      `INSERT INTO public.deliveries (id, waybill_number, delivery_date, client_name, plate_number, truck_type_snapshot, truck_temperature_snapshot, origin, distance_km, fuel_rate, delivery_rate, diesel_expenses, toll_gate_expenses, entry_fees, driver_daily_rate, driver_allowance, helper_daily_rate, helper_allowance, other_expenses, total_expenses, net_income, driver_name, helper_name, financial_state, pod_status, version) VALUES (${sqlLiteral(d.id)}, ${sqlLiteral(d.waybillNumber)}, ${sqlLiteral(d.deliveryDate)}, ${sqlLiteral(d.clientName)}, ${sqlLiteral(d.plateNumber)}, ${sqlLiteral(d.truckType)}, ${sqlLiteral(d.truckTemperature)}, ${sqlLiteral(d.origin)}, ${sqlLiteral(d.distanceKm)}, ${sqlLiteral(d.fuelRate)}, ${sqlLiteral(d.deliveryRate)}, ${sqlLiteral(d.expenses.dieselExpenses)}, ${sqlLiteral(d.expenses.tollGateExpenses)}, ${sqlLiteral(d.expenses.entryFees)}, ${sqlLiteral(d.expenses.driverDailyRate)}, ${sqlLiteral(d.expenses.driverAllowance)}, ${sqlLiteral(d.expenses.helperDailyRate)}, ${sqlLiteral(d.expenses.helperAllowance)}, ${sqlLiteral(d.expenses.otherExpenses)}, ${sqlLiteral(d.totalExpenses)}, ${sqlLiteral(d.netIncome)}, ${sqlLiteral(d.driverName)}, ${sqlLiteral(d.helperName)}, ${sqlLiteral(d.financialState)}, ${sqlLiteral(d.podStatus)}, ${sqlLiteral(d.version)}) ON CONFLICT (id) DO UPDATE SET delivery_rate = EXCLUDED.delivery_rate, total_expenses = EXCLUDED.total_expenses, net_income = EXCLUDED.net_income, financial_state = EXCLUDED.financial_state;`,
    );
  }
  lines.push("");
  lines.push("-- 3. Delivery Store Drop-offs Table (Date-Filtered)");
  for (const d of payload.deliveries) {
    for (const stop of d.dropoffs) {
      lines.push(
        `INSERT INTO public.delivery_dropoffs (id, delivery_id, sequence_number, store_name, destination_area, entry_fee, entry_fee_status, pod_submitted, supporting_docs_complete, document_ref) VALUES (${sqlLiteral(stop.id)}, ${sqlLiteral(d.id)}, ${sqlLiteral(stop.sequence)}, ${sqlLiteral(stop.storeName)}, ${sqlLiteral(stop.destinationArea)}, ${sqlLiteral(stop.entryFee)}, ${sqlLiteral(stop.entryFeeStatus)}, ${sqlLiteral(stop.podSubmitted)}, ${sqlLiteral(stop.supportingDocsComplete)}, ${sqlLiteral(stop.documentRef)}) ON CONFLICT (id) DO NOTHING;`,
      );
    }
  }
  lines.push("");
  lines.push("-- 4. Company Operating Expenses Table (Date-Filtered)");
  for (const e of payload.companyExpenses) {
    lines.push(
      `INSERT INTO public.company_expenses (id, expense_date, description, amount, notes, created_by) VALUES (${sqlLiteral(e.id)}, ${sqlLiteral(e.expenseDate)}, ${sqlLiteral(e.description)}, ${sqlLiteral(e.amount)}, ${sqlLiteral(e.notes)}, ${sqlLiteral(e.createdBy)}) ON CONFLICT (id) DO NOTHING;`,
    );
  }
  lines.push("");
  lines.push("COMMIT;");
  return lines.join("\n");
}

export function generateWorkingWebsiteHtml(payload: ScopedExportPayload): string {
  const safeJson = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RouteX Working Website Snapshot · ${payload.periodLabel}</title>
  <style>
    :root {
      --bg: #f6f7f9;
      --surface: #ffffff;
      --surface-subtle: #f8fafc;
      --text: #15201d;
      --muted: #64748b;
      --border: #e2e8f0;
      --accent: #b45309;
      --accent-soft: #fffbeb;
      --success: #059669;
      --warning: #d97706;
      --danger: #dc2626;
    }
    html[data-theme="dark"] {
      --bg: #0b0f17;
      --surface: #131a26;
      --surface-subtle: #1a2333;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --border: #263246;
      --accent: #f59e0b;
      --accent-soft: rgba(245, 158, 11, 0.14);
      --success: #10b981;
      --warning: #fbbf24;
      --danger: #f87171;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Readex Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      min-height: 100vh;
    }
    .sidebar {
      width: 240px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      padding: 20px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex-shrink: 0;
    }
    .brand {
      padding: 8px 10px 16px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 10px;
    }
    .brand strong { display: block; font-size: 16px; color: var(--accent); letter-spacing: -0.02em; }
    .brand small { font-size: 11px; color: var(--muted); }
    .nav-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 10px 12px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
    }
    .nav-btn:hover { background: var(--surface-subtle); }
    .nav-btn.active { background: var(--accent-soft); color: var(--accent); }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .topbar {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .period-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
    }
    .theme-btn {
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface-subtle);
      color: var(--text);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .content { padding: 24px 28px; max-width: 1280px; width: 100%; margin: 0 auto; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
      margin-bottom: 22px;
    }
    .kpi-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 18px;
    }
    .kpi-card span { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; }
    .kpi-card strong { display: block; font-size: 22px; margin: 6px 0 4px; }
    .kpi-card small { font-size: 11.5px; color: var(--muted); }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 20px;
      margin-bottom: 20px;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .search-input, .select-input {
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface-subtle);
      color: var(--text);
      font-size: 13px;
    }
    .search-input { min-width: 260px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; }
    th { font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 700; }
    tr.clickable-row { cursor: pointer; }
    tr.clickable-row:hover { background: var(--surface-subtle); }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }
    .badge.success { background: rgba(16, 185, 129, 0.14); color: var(--success); }
    .badge.warning { background: rgba(245, 158, 11, 0.16); color: var(--warning); }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 100;
    }
    .modal-backdrop.open { display: flex; }
    .modal {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      max-width: 720px;
      width: 100%;
      max-height: 85vh;
      overflow-y: auto;
      padding: 22px;
    }
    .view-section { display: none; }
    .view-section.active { display: block; }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="brand">
      <strong>RouteX Snapshot</strong>
      <small>Redeemed Route Logistics Inc.</small>
    </div>
    <button class="nav-btn active" onclick="switchView('dashboard', this)">Dashboard</button>
    <button class="nav-btn" onclick="switchView('deliveries', this)">Deliveries (<span id="nav-deliv-count">0</span>)</button>
    <button class="nav-btn" onclick="switchView('trucks', this)">Trucks & Crew</button>
    <button class="nav-btn" onclick="switchView('finance', this)">Company Finance</button>
    <button class="nav-btn" onclick="switchView('pods', this)">POD Documents</button>
  </aside>

  <div class="main">
    <header class="topbar">
      <div>
        <strong>Interactive Website Recreation</strong>
        <span style="color: var(--muted); font-size: 12px; margin-left: 8px;">Exported by @${payload.generatedBy}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="period-pill">Date Filter: ${payload.periodLabel}</span>
        <button class="theme-btn" onclick="toggleTheme()">Toggle Dark / Light</button>
      </div>
    </header>

    <div class="content">
      <!-- DASHBOARD VIEW -->
      <section id="view-dashboard" class="view-section active">
        <h2 style="margin-top: 0;">Executive Overview (${payload.periodLabel})</h2>
        <div class="kpi-grid" id="dashboard-kpis"></div>
        <div class="card">
          <h3 style="margin-top: 0;">Recent Deliveries in Period</h3>
          <div style="overflow-x: auto;">
            <table id="dashboard-recent-table">
              <thead>
                <tr>
                  <th>Waybill</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Truck</th>
                  <th>Drop-offs</th>
                  <th>Revenue</th>
                  <th>Expenses</th>
                  <th>Net Profit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- DELIVERIES VIEW -->
      <section id="view-deliveries" class="view-section">
        <h2 style="margin-top: 0;">Deliveries Ledger (${payload.periodLabel})</h2>
        <div class="card">
          <div class="toolbar">
            <input type="text" id="deliv-search" class="search-input" placeholder="Search waybill, client, truck, driver, store…" oninput="renderDeliveries()" />
            <select id="deliv-status" class="select-input" onchange="renderDeliveries()">
              <option value="all">All Statuses</option>
              <option value="finalized">Finalized Only</option>
              <option value="incomplete">Incomplete Only</option>
            </select>
          </div>
          <div style="overflow-x: auto;">
            <table id="deliveries-table">
              <thead>
                <tr>
                  <th>Waybill</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Truck</th>
                  <th>Driver / Helper</th>
                  <th>Drop-offs</th>
                  <th>Revenue</th>
                  <th>Expenses</th>
                  <th>Net Profit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TRUCKS VIEW -->
      <section id="view-trucks" class="view-section">
        <h2 style="margin-top: 0;">Truck Profitability (${payload.periodLabel})</h2>
        <div class="card">
          <div style="overflow-x: auto;">
            <table id="trucks-table">
              <thead>
                <tr>
                  <th>Plate Number</th>
                  <th>Finalized Trips</th>
                  <th>Revenue</th>
                  <th>Delivery Expenses</th>
                  <th>Net Profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- FINANCE VIEW -->
      <section id="view-finance" class="view-section">
        <h2 style="margin-top: 0;">Company Operating Expenses (${payload.periodLabel})</h2>
        <div class="card">
          <div style="overflow-x: auto;">
            <table id="finance-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Notes</th>
                  <th>Recorded By</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- PODS VIEW -->
      <section id="view-pods" class="view-section">
        <h2 style="margin-top: 0;">Store Drop-offs & POD Status (${payload.periodLabel})</h2>
        <div class="card">
          <div style="overflow-x: auto;">
            <table id="pods-table">
              <thead>
                <tr>
                  <th>Waybill</th>
                  <th>Date</th>
                  <th>Stop #</th>
                  <th>Store Name</th>
                  <th>Destination Area</th>
                  <th>Entry Fee</th>
                  <th>POD Status</th>
                  <th>Document Ref</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  </div>

  <!-- DELIVERY DETAIL MODAL -->
  <div id="detail-modal-backdrop" class="modal-backdrop" onclick="closeModal(event)">
    <div class="modal" onclick="event.stopPropagation()">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 14px;">
        <div>
          <h3 id="modal-title" style="margin: 0;">Delivery Details</h3>
          <small id="modal-subtitle" style="color: var(--muted);"></small>
        </div>
        <button class="theme-btn" onclick="document.getElementById('detail-modal-backdrop').classList.remove('open')">Close ×</button>
      </div>
      <div id="modal-body"></div>
    </div>
  </div>

  <script>
    const SNAPSHOT = ${safeJson};
    const peso = (n) => n == null ? "—" : "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    function toggleTheme() {
      const html = document.documentElement;
      html.setAttribute("data-theme", html.getAttribute("data-theme") === "dark" ? "light" : "dark");
    }

    function switchView(viewId, btn) {
      document.querySelectorAll(".view-section").forEach((el) => el.classList.remove("active"));
      document.getElementById("view-" + viewId).classList.add("active");
      document.querySelectorAll(".nav-btn").forEach((el) => el.classList.remove("active"));
      if (btn) btn.classList.add("active");
    }

    function openDeliveryModal(id) {
      const d = SNAPSHOT.deliveries.find((item) => item.id === id);
      if (!d) return;
      document.getElementById("modal-title").textContent = d.waybillNumber + " · " + d.clientName;
      document.getElementById("modal-subtitle").textContent = d.deliveryDate + " · Truck " + d.plateNumber + " (" + d.truckType + ", " + d.truckTemperature + ")";
      const stopsHtml = d.dropoffs.map((s) =>
        "<li><strong>#" + s.sequence + " " + s.storeName + "</strong> (" + s.destinationArea + ") — Entry Fee: " + peso(s.entryFee || 0) + " · POD: " + (s.podSubmitted ? s.documentRef : "Missing") + "</li>"
      ).join("");
      document.getElementById("modal-body").innerHTML =
        "<p><strong>Origin:</strong> " + d.origin + " (" + d.distanceKm + " km · Fuel Rate: " + peso(d.fuelRate) + "/L)</p>" +
        "<p><strong>Crew:</strong> Driver: " + (d.driverName || "—") + " · Helper: " + (d.helperName || "—") + "</p>" +
        "<p><strong>Financials:</strong> Revenue: " + peso(d.deliveryRate) + " · Total Expenses: " + peso(d.totalExpenses) + " · Net Profit: <strong>" + peso(d.netIncome) + "</strong></p>" +
        "<p><strong>Expense Breakdown:</strong> Diesel: " + peso(d.expenses.dieselExpenses) + ", Tolls: " + peso(d.expenses.tollGateExpenses) + ", Entry Fees: " + peso(d.expenses.entryFees) + ", Driver: " + peso((d.expenses.driverDailyRate || 0) + (d.expenses.driverAllowance || 0)) + ", Helper: " + peso((d.expenses.helperDailyRate || 0) + (d.expenses.helperAllowance || 0)) + ", Other: " + peso(d.expenses.otherExpenses) + "</p>" +
        "<h4>Store Drop-offs (" + d.dropoffs.length + ")</h4><ul>" + stopsHtml + "</ul>";
      document.getElementById("detail-modal-backdrop").classList.add("open");
    }

    function closeModal(e) {
      document.getElementById("detail-modal-backdrop").classList.remove("open");
    }

    function renderDeliveries() {
      const q = (document.getElementById("deliv-search").value || "").toLowerCase().trim();
      const status = document.getElementById("deliv-status").value;
      const rows = SNAPSHOT.deliveries.filter((d) => {
        if (status === "finalized" && d.financialState !== "finalized") return false;
        if (status === "incomplete" && d.financialState === "finalized") return false;
        if (!q) return true;
        const hay = [d.waybillNumber, d.clientName, d.plateNumber, d.driverName, d.helperName, ...d.dropoffs.map((s) => s.storeName)].join(" ").toLowerCase();
        return hay.includes(q);
      });
      const tbody = document.querySelector("#deliveries-table tbody");
      tbody.innerHTML = rows.map((d) =>
        "<tr class='clickable-row' onclick=\\"openDeliveryModal('" + d.id + "')\\">" +
        "<td><strong>" + d.waybillNumber + "</strong></td>" +
        "<td>" + d.deliveryDate + "</td>" +
        "<td>" + d.clientName + "</td>" +
        "<td>" + d.plateNumber + "</td>" +
        "<td>" + (d.driverName || "—") + "<br/><small style='color:var(--muted)'>" + (d.helperName || "—") + "</small></td>" +
        "<td>" + getTripTotalDropoffs(d.dropoffs) + "</td>" +
        "<td>" + peso(d.deliveryRate) + "</td>" +
        "<td>" + peso(d.totalExpenses) + "</td>" +
        "<td><strong>" + peso(d.netIncome) + "</strong></td>" +
        "<td><span class='badge " + (d.financialState === "finalized" ? "success" : "warning") + "'>" + d.financialState + "</span></td>" +
        "</tr>"
      ).join("");
    }

    function init() {
      document.getElementById("nav-deliv-count").textContent = SNAPSHOT.deliveries.length;
      const s = SNAPSHOT.summary;
      document.getElementById("dashboard-kpis").innerHTML = [
        { label: "Delivery Revenue", val: peso(s.deliveryRevenue), sub: s.finalizedDeliveries + " finalized trips · " + s.totalDropoffs + " stops" },
        { label: "Delivery Expenses", val: peso(s.deliveryExpenses), sub: "Direct trip operating costs" },
        { label: "Company Expenses", val: peso(s.companyExpenses), sub: SNAPSHOT.companyExpenses.length + " company expense records" },
        { label: "Company Net Profit", val: peso(s.companyNetProfit), sub: s.companyProfitMargin != null ? s.companyProfitMargin.toFixed(1) + "% net margin" : "—" }
      ].map((k) => "<div class='kpi-card'><span>" + k.label + "</span><strong>" + k.val + "</strong><small>" + k.sub + "</small></div>").join("");

      document.querySelector("#dashboard-recent-table tbody").innerHTML = SNAPSHOT.deliveries.slice(0, 10).map((d) =>
        "<tr class='clickable-row' onclick=\\"openDeliveryModal('" + d.id + "')\\">" +
        "<td><strong>" + d.waybillNumber + "</strong></td><td>" + d.deliveryDate + "</td><td>" + d.clientName + "</td><td>" + d.plateNumber + "</td><td>" + getTripTotalDropoffs(d.dropoffs) + "</td><td>" + peso(d.deliveryRate) + "</td><td>" + peso(d.totalExpenses) + "</td><td><strong>" + peso(d.netIncome) + "</strong></td><td><span class='badge " + (d.financialState === "finalized" ? "success" : "warning") + "'>" + d.financialState + "</span></td></tr>"
      ).join("");

      renderDeliveries();

      const truckMap = {};
      SNAPSHOT.deliveries.filter((d) => d.financialState === "finalized").forEach((d) => {
        if (!truckMap[d.plateNumber]) truckMap[d.plateNumber] = { plate: d.plateNumber, trips: 0, rev: 0, exp: 0 };
        truckMap[d.plateNumber].trips += 1;
        truckMap[d.plateNumber].rev += d.deliveryRate || 0;
        truckMap[d.plateNumber].exp += d.totalExpenses || 0;
      });
      document.querySelector("#trucks-table tbody").innerHTML = Object.values(truckMap).map((t) => {
        const net = t.rev - t.exp;
        const margin = t.rev > 0 ? ((net / t.rev) * 100).toFixed(1) + "%" : "—";
        return "<tr><td><strong>" + t.plate + "</strong></td><td>" + t.trips + "</td><td>" + peso(t.rev) + "</td><td>" + peso(t.exp) + "</td><td><strong>" + peso(net) + "</strong></td><td>" + margin + "</td></tr>";
      }).join("");

      document.querySelector("#finance-table tbody").innerHTML = SNAPSHOT.companyExpenses.map((e) =>
        "<tr><td>" + e.expenseDate + "</td><td><strong>" + e.description + "</strong></td><td>" + (e.notes || "—") + "</td><td>@" + (e.createdBy || "system") + "</td><td><strong>" + peso(e.amount) + "</strong></td></tr>"
      ).join("");

      document.querySelector("#pods-table tbody").innerHTML = SNAPSHOT.deliveries.flatMap((d) =>
        d.dropoffs.map((stop) =>
          "<tr><td><strong>" + d.waybillNumber + "</strong></td><td>" + d.deliveryDate + "</td><td>#" + stop.sequence + "</td><td>" + stop.storeName + "</td><td>" + stop.destinationArea + "</td><td>" + peso(stop.entryFee || 0) + "</td><td><span class='badge " + (stop.podSubmitted ? "success" : "warning") + "'>" + (stop.podSubmitted ? "Attached" : "Missing") + "</span></td><td>" + (stop.documentRef || "—") + "</td></tr>"
        )
      ).join("");
    }
    init();
  </script>
</body>
</html>`;
}

/**
 * Builds the DAILY TRIP REPORT sheet matching the reference Delivery .xlsx layout.
 */
function buildDailyTripReportAoa(payload: ScopedExportPayload): Array<Array<string | number>> {
  const aoa: Array<Array<string | number>> = [
    ["3961", "REDEEMED ROUTE LOGSITICS INC.", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "TOLL GATES"],
    ["", `${payload.periodLabel.toUpperCase()} - DAILY TRIP REPORT`],
    [],
    [
      "",
      "NO.",
      "CLIENT",
      "DATE",
      "WAYBILL \nNUMBER",
      "PLATE NUMBER",
      "TRUCK \n TYPE",
      "TRUCK TEMP",
      "ORIGIN",
      "STORE",
      "TOLL GATE",
      "OTHER \n EXPENSES",
      "ENTRY\nFEES",
      "DRIVER",
      "",
      "HELPER",
      "",
      "DIESEL",
      "TOTAL \nEXPENSE",
      "RATE",
      "NET INCOME",
      "FUEL\nRATE",
      "KM",
      "TOLL GATES",
    ],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "ALLOWANCE", "DAILY RATE", "ALLOWANCE", "DAILY RATE"],
  ];

  let sumDriverAllow = 0;
  let sumHelperAllow = 0;
  let sumDiesel = 0;
  let sumTotalExp = 0;
  let sumRate = 0;
  let sumNet = 0;

  payload.deliveries.forEach((d, idx) => {
    const isOwned = d.truckOwnership === "Owned";
    const store = d.dropoffs.map((s) => s.storeName).filter(Boolean).join("\n") || "—";
    const totalExp = d.totalExpenses ?? 0;
    const rate = d.deliveryRate ?? 0;
    const net = d.netIncome ?? (rate - totalExp);

    const toll = isOwned && d.expenses.tollGateExpenses != null ? d.expenses.tollGateExpenses : "-";
    const other = isOwned && d.expenses.otherExpenses != null ? d.expenses.otherExpenses : "-";
    const entry = isOwned && d.expenses.entryFees != null ? d.expenses.entryFees : "-";
    const drvAllow = isOwned && d.expenses.driverAllowance != null ? d.expenses.driverAllowance : "-";
    const drvRate = isOwned && d.expenses.driverDailyRate != null ? d.expenses.driverDailyRate : "-";
    const hlpAllow = isOwned && d.expenses.helperAllowance != null ? d.expenses.helperAllowance : "-";
    const hlpRate = isOwned && d.expenses.helperDailyRate != null ? d.expenses.helperDailyRate : "-";
    const diesel = isOwned && d.expenses.dieselExpenses != null ? d.expenses.dieselExpenses : "-";
    const fuelRate = isOwned && d.fuelRate != null ? d.fuelRate : "-";
    const km = isOwned && d.distanceKm != null ? d.distanceKm : "-";
    const tollGates = isOwned ? (d.expenses.tollGateBreakdown || "") : "";

    if (typeof drvAllow === "number") sumDriverAllow += drvAllow;
    if (typeof hlpAllow === "number") sumHelperAllow += hlpAllow;
    if (typeof diesel === "number") sumDiesel += diesel;
    sumTotalExp += totalExp;
    sumRate += rate;
    sumNet += net;

    aoa.push([
      "",
      idx + 1,
      d.clientName,
      d.deliveryDate,
      d.waybillNumber,
      d.plateNumber,
      d.truckType,
      d.truckTemperature,
      d.origin,
      store,
      toll,
      other,
      entry,
      drvAllow,
      drvRate,
      hlpAllow,
      hlpRate,
      diesel,
      totalExp,
      rate,
      net,
      fuelRate,
      km,
      tollGates,
    ]);
  });

  // Reference footer totals row
  aoa.push([
    "", "", "", "", "", "", "", "", "", "", "", "", "",
    sumDriverAllow || "",
    "",
    sumHelperAllow || "",
    "",
    sumDiesel || "",
    sumTotalExp,
    sumRate,
    sumNet,
    "", "", ""
  ]);

  return aoa;
}

/**
 * Builds SERVICE INVOICE (BILLINGS) sheet matching Reference Sheet 1 layout.
 * Columns: NO., REF. RRLI, DATE, COMPANY NAME, TIN NO., , AMOUNT, TOTAL SALES (VAT INC.), 12% VAT, DUE, EWT, AMOUNT DUE, DUE DATE, AGING, REMARKS
 */
function buildServiceInvoiceAoa(payload: ScopedExportPayload): Array<Array<string | number>> {
  const headers = [
    "NO.",
    "REF. RRLI",
    "DATE",
    "COMPANY NAME",
    "TIN NO.",
    "",
    "AMOUNT",
    "TOTAL SALES (VAT INC.)",
    "12% VAT",
    "DUE",
    "EWT",
    "AMOUNT DUE",
    "DUE DATE",
    "AGING",
    "REMARKS",
  ];
  const aoa: Array<Array<string | number>> = [headers];

  const incomingExpenses = payload.companyExpenses.filter((e) => e.transactionType === "Incoming");
  let rowNo = 1000;

  incomingExpenses.forEach((e) => {
    rowNo++;
    const amtDue = e.amount;
    const baseAmt = Math.round((amtDue / 1.12) * 100) / 100;
    const vat = Math.round((amtDue - baseAmt) * 100) / 100;
    const ewt = Math.round((baseAmt * 0.02) * 100) / 100;
    aoa.push([
      rowNo,
      e.sourceRef || `010-${rowNo - 100}`,
      e.expenseDate,
      e.description,
      "008-909-992-000",
      "",
      baseAmt,
      amtDue,
      vat,
      baseAmt,
      ewt,
      amtDue,
      e.expenseDate,
      14,
      e.notes || "",
    ]);
  });

  payload.deliveries.forEach((d) => {
    if (!d.deliveryRate || d.deliveryRate <= 0) return;
    rowNo++;
    const amtDue = d.deliveryRate;
    const baseAmt = Math.round((amtDue / 1.12) * 100) / 100;
    const vat = Math.round((amtDue - baseAmt) * 100) / 100;
    const ewt = Math.round((baseAmt * 0.02) * 100) / 100;
    aoa.push([
      rowNo,
      `010-${d.waybillNumber.slice(-3).padStart(3, "0")}`,
      d.deliveryDate,
      d.clientName,
      "008-909-992-000",
      "",
      baseAmt,
      amtDue,
      vat,
      baseAmt,
      ewt,
      amtDue,
      d.deliveryDate,
      7,
      "",
    ]);
  });

  return aoa;
}

/**
 * Builds DISBURSEMENT (DAILY EXPENSE) sheet matching Reference Sheet 2 layout.
 * Columns: DATE, DESCRIPTION, TIN NO., , (TRUCK) GASOLINE EXPENSES, TRUCK RFID/ENTRY PASS/PARKING, ALLOWANCE,
 * TRUCK EXPENSE, TRUCKING SERVICE, TRANSPORTATION EXPENSE, COURIER & MESSENGER FEE, , CASH ADVANCE, SALARY,
 * OFFICE SUPPLIES, FURNITURE & FIXTURES, SPACE RENTAL, UTILITIES, , BIR EXPENSE, PERMIT, CONTRIBUTION,
 * FOOD EXPENSE, SERVICES, INCENTIVES
 */
function buildDisbursementAoa(payload: ScopedExportPayload): Array<Array<string | number>> {
  const headers = [
    "DATE",
    "DESCRIPTION",
    "TIN NO.",
    "",
    "(TRUCK) GASOLINE EXPENSES",
    "TRUCK RFID/ENTRY PASS/PARKING",
    "ALLOWANCE",
    "TRUCK EXPENSE",
    "TRUCKING SERVICE",
    "TRANSPORTATION EXPENSE",
    "COURIER & MESSENGER FEE",
    "",
    "CASH ADVANCE",
    "SALARY",
    "OFFICE SUPPLIES",
    "FURNITURE & FIXTURES",
    "SPACE RENTAL",
    "UTILITIES",
    "",
    "BIR EXPENSE",
    "PERMIT",
    "CONTRIBUTION",
    "FOOD EXPENSE",
    "SERVICES",
    "INCENTIVES",
  ];
  const aoa: Array<Array<string | number>> = [headers];

  const outgoingExpenses = payload.companyExpenses.filter((e) => e.transactionType !== "Incoming");

  outgoingExpenses.forEach((e) => {
    const row: Array<string | number> = new Array(25).fill("");
    row[0] = e.expenseDate;
    row[1] = e.description;

    const cat = (e.category || "").toLowerCase();
    const desc = (e.description || "").toLowerCase();

    if (/gas|fuel|diesel/i.test(cat) || /gas|fuel|diesel/i.test(desc)) {
      row[4] = e.amount;
    } else if (/rfid|toll|parking|pass|entry/i.test(cat) || /rfid|toll|parking/i.test(desc)) {
      row[5] = e.amount;
    } else if (/allowance/i.test(cat) || /allowance/i.test(desc)) {
      row[6] = e.amount;
    } else if (/truck|repair|maintenance|rebuilder/i.test(cat) || /truck|repair/i.test(desc)) {
      row[7] = e.amount;
    } else if (/subcon|trucking/i.test(cat) || /trucking/i.test(desc)) {
      row[8] = e.amount;
    } else if (/transport/i.test(cat) || /transport/i.test(desc)) {
      row[9] = e.amount;
    } else if (/courier|messenger/i.test(cat) || /courier/i.test(desc)) {
      row[10] = e.amount;
    } else if (/advance/i.test(cat) || /advance/i.test(desc)) {
      row[12] = e.amount;
    } else if (/salary|payroll/i.test(cat) || /salary/i.test(desc)) {
      row[13] = e.amount;
    } else if (/office|supplies/i.test(cat) || /supplies/i.test(desc)) {
      row[14] = e.amount;
    } else if (/furniture|fixture/i.test(cat)) {
      row[15] = e.amount;
    } else if (/rent|space/i.test(cat) || /rental/i.test(desc)) {
      row[16] = e.amount;
    } else if (/utilit|electric|water|internet/i.test(cat) || /utilit/i.test(desc)) {
      row[17] = e.amount;
    } else if (/bir|tax/i.test(cat) || /bir/i.test(desc)) {
      row[19] = e.amount;
    } else if (/permit|license/i.test(cat) || /permit/i.test(desc)) {
      row[20] = e.amount;
    } else if (/contribution|sss|philhealth|pagibig/i.test(cat)) {
      row[21] = e.amount;
    } else if (/food|meal/i.test(cat) || /food/i.test(desc)) {
      row[22] = e.amount;
    } else if (/incentive|bonus/i.test(cat)) {
      row[24] = e.amount;
    } else {
      row[23] = e.amount;
    }

    aoa.push(row);
  });

  return aoa;
}

/**
 * Builds COLLECTION (REVENUE) sheet matching Reference Sheet 3 layout.
 * Columns:  , DATE, TRUCKER NAME, TIN NO., , AMOUNT, 12% VAT OUTPUT, EWT, AMOUNT DUE, , SI REFERENCE, ,
 */
function buildCollectionAoa(payload: ScopedExportPayload): Array<Array<string | number>> {
  const headers = [
    "  ",
    "DATE",
    "TRUCKER NAME",
    "TIN NO.",
    "",
    "AMOUNT",
    "12% VAT OUTPUT",
    "EWT",
    "AMOUNT DUE",
    "",
    "SI REFERENCE",
    "",
    "",
  ];
  const aoa: Array<Array<string | number>> = [headers];

  let seq = 286;
  payload.deliveries.forEach((d) => {
    if (!d.deliveryRate || d.deliveryRate <= 0) return;
    seq++;
    const amtDue = d.deliveryRate;
    const baseAmt = Math.round((amtDue / 1.12) * 100) / 100;
    const vat = Math.round((amtDue - baseAmt) * 100) / 100;
    const ewt = Math.round((baseAmt * 0.02) * 100) / 100;
    aoa.push([
      seq,
      d.deliveryDate,
      d.clientName,
      "008-909-992-000",
      "",
      baseAmt,
      vat,
      ewt,
      amtDue,
      "",
      d.waybillNumber,
      "",
      "",
    ]);
  });

  return aoa;
}

/**
 * Builds PAYABLES (CREDITED_PAID) sheet matching Reference Sheet 4 layout.
 * Columns: DATE OF BILLING, DATE OF PAYMENT, SI NO., TRUCKER NAME, TIN NO., , AMOUNT, 12% VAT, VAT AMOUNT, EWT, AMOUNT DUE, REMARKS
 */
function buildPayablesPaidAoa(payload: ScopedExportPayload): Array<Array<string | number>> {
  const headers = [
    "DATE OF BILLING",
    "DATE OF PAYMENT",
    "SI NO.",
    "TRUCKER NAME",
    "TIN NO.",
    "",
    "AMOUNT",
    "12% VAT",
    "VAT AMOUNT",
    "EWT",
    "AMOUNT DUE",
    "REMARKS",
  ];
  const aoa: Array<Array<string | number>> = [headers];

  const subconDeliveries = payload.deliveries.filter((d) => d.truckOwnership === "Subcontracted");
  subconDeliveries.forEach((d, idx) => {
    const amt = d.totalExpenses ?? 0;
    const vatBase = Math.round((amt / 1.12) * 100) / 100;
    const vatAmt = Math.round((amt - vatBase) * 100) / 100;
    const ewt = Math.round((vatBase * 0.02) * 100) / 100;
    const amtDue = amt - ewt;

    aoa.push([
      d.deliveryDate,
      d.deliveryDate,
      135 + idx,
      d.plateNumber + " Trucking",
      "103-109-770-00000",
      "",
      amt,
      vatAmt,
      vatBase,
      ewt,
      amtDue,
      d.waybillNumber,
    ]);
  });

  return aoa;
}

/**
 * Builds PAYABLES (NOT CREDITED) sheet matching Reference Sheet 5 layout.
 * Row 0: PAYABLES
 * Row 1: TRUCKER, DATE RECEIVED, DATE COVERED, DUE DATE, AGING, AMOUNT, 12% VAT, AMOUNT VAT, EWT, AMOUNT DUE, SI #, REMARKS, ACCOUNT NO, ACCOUNT NAME
 */
function buildPayablesNotCreditedAoa(payload: ScopedExportPayload): Array<Array<string | number>> {
  const aoa: Array<Array<string | number>> = [
    ["PAYABLES"],
    [
      "TRUCKER",
      "DATE RECEIVED",
      "DATE COVERED",
      "DUE DATE",
      "AGING",
      "AMOUNT",
      "12% VAT",
      "AMOUNT VAT",
      "EWT",
      "AMOUNT DUE",
      "SI #",
      "REMARKS",
      "ACCOUNT NO",
      "ACCOUNT NAME",
    ],
  ];

  const subconDeliveries = payload.deliveries.filter((d) => d.truckOwnership === "Subcontracted" && d.financialState !== "finalized");
  subconDeliveries.forEach((d, idx) => {
    const amt = d.totalExpenses ?? 0;
    const vatBase = Math.round((amt / 1.12) * 100) / 100;
    const vatAmt = Math.round((amt - vatBase) * 100) / 100;
    const ewt = Math.round((vatBase * 0.02) * 100) / 100;
    const amtDue = amt - ewt;

    aoa.push([
      d.plateNumber + " TRUCKING SERVICES",
      d.deliveryDate,
      d.deliveryDate,
      d.deliveryDate,
      14,
      amt,
      vatAmt,
      vatBase,
      ewt,
      amtDue,
      `0000${528 + idx}`,
      d.waybillNumber,
      "",
      d.plateNumber + " TRUCKING SERVICES",
    ]);
  });

  return aoa;
}

/**
 * Builds RECEIVABLES sheet matching Reference Sheet 6 layout.
 * Columns: BILLING, BILLING DATE, DATE COVERED, DUE DATE, AGING, CLIENT, INVOICE NO., AMOUNT , 12%VAT, W/12% VAT, EWT, AMOUNT DUE, STATUS, CR NO.
 */
function buildReceivablesAoa(payload: ScopedExportPayload): Array<Array<string | number>> {
  const headers = [
    "BILLING",
    "BILLING DATE",
    "DATE COVERED",
    "DUE DATE",
    "AGING",
    "CLIENT",
    "INVOICE NO.",
    "AMOUNT ",
    "12%VAT",
    "W/12% VAT",
    "EWT",
    "AMOUNT DUE",
    "STATUS",
    "CR NO.",
  ];
  const aoa: Array<Array<string | number>> = [headers];

  payload.deliveries.forEach((d, idx) => {
    const amt = d.deliveryRate ?? 0;
    if (amt <= 0) return;
    const vat = Math.round((amt * 0.12) * 100) / 100;
    const withVat = amt + vat;
    const ewt = Math.round((amt * 0.02) * 100) / 100;
    const amtDue = withVat - ewt;

    aoa.push([
      `RRLI2026-010-${916 + idx}`,
      d.deliveryDate,
      d.deliveryDate,
      d.deliveryDate,
      0,
      d.clientName,
      1030 + idx,
      amt,
      vat,
      withVat,
      ewt,
      amtDue,
      d.financialState === "finalized" ? "PAID" : "NOT PAID",
      "",
    ]);
  });

  return aoa;
}

/**
 * Generates a comprehensive multi-sheet Microsoft Excel (.xlsx) workbook
 * with layouts directly matching the reference spreadsheets for Delivery and Finance.
 */
export function generateDatasetsXlsxWorkbook(payload: ScopedExportPayload): Uint8Array {
  const wb = XLSX.utils.book_new();

  // 1. Executive Summary Sheet
  const summaryRows: Array<Array<string | number>> = [
    ["REDEEMED ROUTE LOGISTICS INC. · ROUTEX DATASET EXPORT"],
    ["EXECUTIVE PROFITABILITY & VOLUME SUMMARY"],
    [`Period: ${payload.periodLabel}`],
    [`Date Range: ${payload.dateFrom || "Earliest"} to ${payload.dateTo || "Latest"}`],
    [`Export Generated: ${payload.generatedAt} by @${payload.generatedBy}`],
    [],
    ["Metric", "Value", "Unit"],
    ["Total Deliveries", payload.summary.totalDeliveries, "Trips"],
    ["Finalized Financial Trips", payload.summary.finalizedDeliveries, "Trips"],
    ["Incomplete Trips Pending Audit", payload.summary.incompleteDeliveries, "Trips"],
    ["Total Store Drop-offs", payload.summary.totalDropoffs, "Stops"],
    ["Delivery Gross Revenue", payload.summary.deliveryRevenue, "PHP"],
    ["Direct Delivery Expenses", payload.summary.deliveryExpenses, "PHP"],
    ["Delivery Net Profit", payload.summary.deliveryNetProfit, "PHP"],
    ["Company Operating Expenses", payload.summary.companyExpenses, "PHP"],
    ["Company Net Profit", payload.summary.companyNetProfit, "PHP"],
    [
      "Company Profit Margin",
      payload.summary.companyProfitMargin != null ? `${payload.summary.companyProfitMargin.toFixed(1)}%` : "N/A",
      "Ratio",
    ],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Executive Summary");

  // 2. DAILY TRIP REPORT (Reference Delivery Excel Format)
  const dtrWs = XLSX.utils.aoa_to_sheet(buildDailyTripReportAoa(payload));
  XLSX.utils.book_append_sheet(wb, dtrWs, "DAILY TRIP REPORT");

  // 3. SERVICE INVOICE (BILLINGS) (Reference Finance Sheet 1)
  const siWs = XLSX.utils.aoa_to_sheet(buildServiceInvoiceAoa(payload));
  XLSX.utils.book_append_sheet(wb, siWs, "SERVICE INVOICE (BILLINGS)");

  // 4. DISBURSEMENT (DAILY EXPENSE) (Reference Finance Sheet 2)
  const disbWs = XLSX.utils.aoa_to_sheet(buildDisbursementAoa(payload));
  XLSX.utils.book_append_sheet(wb, disbWs, "DISBURSEMENT (DAILY EXPENSE)");

  // 5. COLLECTION (REVENUE) (Reference Finance Sheet 3)
  const collWs = XLSX.utils.aoa_to_sheet(buildCollectionAoa(payload));
  XLSX.utils.book_append_sheet(wb, collWs, "COLLECTION (REVENUE)");

  // 6. PAYABLES (CREDITED_PAID) (Reference Finance Sheet 4)
  const payPaidWs = XLSX.utils.aoa_to_sheet(buildPayablesPaidAoa(payload));
  XLSX.utils.book_append_sheet(wb, payPaidWs, "PAYABLES (CREDITED_PAID)");

  // 7. PAYABLES (NOT CREDITED) (Reference Finance Sheet 5)
  const payNotCredWs = XLSX.utils.aoa_to_sheet(buildPayablesNotCreditedAoa(payload));
  XLSX.utils.book_append_sheet(wb, payNotCredWs, "PAYABLES (NOT CREDITED)");

  // 8. RECEIVABLES (Reference Finance Sheet 6)
  const recWs = XLSX.utils.aoa_to_sheet(buildReceivablesAoa(payload));
  XLSX.utils.book_append_sheet(wb, recWs, "RECEIVABLES");

  // 2. Deliveries Sheet
  const deliveryHeaders = [
    "Waybill Number",
    "Delivery Date",
    "Client",
    "Truck Plate",
    "Temperature",
    "Origin",
    "Distance (KM)",
    "Fuel Rate (PHP/L)",
    "Delivery Revenue (PHP)",
    "Diesel Expense (PHP)",
    "Toll Gate Expense (PHP)",
    "Driver Name",
    "Driver Daily Rate (PHP)",
    "Driver Allowance (PHP)",
    "Helper Name",
    "Helper Daily Rate (PHP)",
    "Helper Allowance (PHP)",
    "Other Expenses (PHP)",
    "Total Expenses (PHP)",
    "Net Income (PHP)",
    "Profit Margin",
    "Financial State",
    "POD Status",
    "Drop-offs Count",
  ];
  const deliveryRows: Array<Array<string | number>> = [deliveryHeaders];
  for (const d of payload.deliveries) {
    deliveryRows.push([
      d.waybillNumber,
      d.deliveryDate,
      d.clientName,
      d.plateNumber,
      d.truckTemperature,
      d.origin,
      d.distanceKm ?? 0,
      d.fuelRate ?? 0,
      d.deliveryRate ?? 0,
      d.expenses.dieselExpenses ?? 0,
      d.expenses.tollGateExpenses ?? 0,
      d.driverName || "—",
      d.expenses.driverDailyRate ?? 0,
      d.expenses.driverAllowance ?? 0,
      d.helperName || "—",
      d.expenses.helperDailyRate ?? 0,
      d.expenses.helperAllowance ?? 0,
      d.expenses.otherExpenses ?? 0,
      d.totalExpenses ?? 0,
      d.netIncome ?? 0,
      d.marginPercent != null ? `${d.marginPercent.toFixed(1)}%` : "N/A",
      d.financialState,
      d.podStatus,
      getTripTotalDropoffs(d.dropoffs),
    ]);
  }
  const deliveriesWs = XLSX.utils.aoa_to_sheet(deliveryRows);
  XLSX.utils.book_append_sheet(wb, deliveriesWs, "Deliveries");

  // 3. Store Drop-offs Sheet
  const dropoffHeaders = [
    "Waybill Number",
    "Delivery Date",
    "Client",
    "Stop Sequence",
    "Store Name",
    "Destination Area",
    "Entry Fee (PHP)",
    "Entry Fee Status",
    "POD Submitted",
    "Supporting Docs Complete",
    "Document Ref",
  ];
  const dropoffRows: Array<Array<string | number>> = [dropoffHeaders];
  for (const d of payload.deliveries) {
    for (const s of d.dropoffs) {
      dropoffRows.push([
        d.waybillNumber,
        d.deliveryDate,
        d.clientName,
        s.sequence,
        s.storeName,
        s.destinationArea,
        s.entryFee ?? 0,
        s.entryFeeStatus,
        s.podSubmitted ? "YES" : "NO",
        s.supportingDocsComplete ? "YES" : "NO",
        s.documentRef || "—",
      ]);
    }
  }
  const dropoffsWs = XLSX.utils.aoa_to_sheet(dropoffRows);
  XLSX.utils.book_append_sheet(wb, dropoffsWs, "Store Drop-offs");

  // 4. Truck Profitability Sheet
  const truckSummaries = summarizeTruckProfitability(
    payload.deliveries.map((item) => ({
      ...item,
      items: item.dropoffs,
    })) as unknown as readonly DeliveryTripRecord[],
  );
  const truckHeaders = [
    "Plate Number",
    "Truck Type",
    "Ownership",
    "Rate Basis",
    "Trucker",
    "Trips",
    "Total Distance (KM)",
    "Total Revenue (PHP)",
    "Total Expenses (PHP)",
    "Net Profit (PHP)",
    "Profit Margin",
  ];
  const truckRows: Array<Array<string | number>> = [truckHeaders];
  for (const t of truckSummaries) {
    const regTruck = payload.trucks.find(
      (tk) => tk.plateNumber.toUpperCase() === t.plateNumber.toUpperCase(),
    );
    truckRows.push([
      t.plateNumber,
      t.truckType,
      regTruck?.ownershipType || "Owned",
      regTruck?.rateBasis || "Redeemed Rate",
      regTruck?.provider || "Internal Fleet",
      t.completedTrips,
      t.totalDistanceKm,
      t.totalEarnings,
      t.totalExpenses,
      t.netProfit,
      t.marginPercent != null ? `${t.marginPercent.toFixed(1)}%` : "N/A",
    ]);
  }
  const trucksWs = XLSX.utils.aoa_to_sheet(truckRows);
  XLSX.utils.book_append_sheet(wb, trucksWs, "Truck Profitability");

  // 5. Company Expenses Sheet
  const expenseHeaders = [
    "Expense ID",
    "Expense Date",
    "Category",
    "Description",
    "Amount (PHP)",
    "Created By",
    "Notes",
  ];
  const expenseRows: Array<Array<string | number>> = [expenseHeaders];
  for (const e of payload.companyExpenses) {
    expenseRows.push([
      e.id,
      e.expenseDate,
      e.category || "General",
      e.description,
      e.amount,
      e.createdBy || "system",
      e.notes || "—",
    ]);
  }
  const expensesWs = XLSX.utils.aoa_to_sheet(expenseRows);
  XLSX.utils.book_append_sheet(wb, expensesWs, "Company Expenses");

  // 6. Crew Directory Sheet
  const crewHeaders = [
    "Member ID",
    "Employee Code",
    "Full Name",
    "Assignment Type",
    "Contact Number",
    "Status",
  ];
  const crewRows: Array<Array<string | number>> = [crewHeaders];
  for (const c of payload.crew) {
    crewRows.push([
      c.id,
      c.employeeCode,
      c.fullName,
      c.assignmentType,
      c.contactNumber || "—",
      c.isActive ? "Active" : "Inactive",
    ]);
  }
  const crewWs = XLSX.utils.aoa_to_sheet(crewRows);
  XLSX.utils.book_append_sheet(wb, crewWs, "Crew Directory");

  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbOut);
}

export function triggerExportPackageDownload(
  packageType: DataExportPackageType,
  payload: ScopedExportPayload,
): string {
  const pkg = DATA_EXPORT_PACKAGE_CATALOG[packageType];
  const safePeriod = payload.periodLabel
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const filename = `routex-${packageType.replace(/_/g, "-")}-${safePeriod || "all-time"}.${pkg.extension}`;

  if (packageType === "datasets_xlsx") {
    const bytes = generateDatasetsXlsxWorkbook(payload);
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const blob = new Blob([bytes as unknown as BlobPart], { type: pkg.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return filename;
  }

  let content = "";
  if (packageType === "datasets_csv") {
    content = generateDatasetsCsvBundle(payload);
  } else if (packageType === "database_json") {
    content = generateDatabaseJsonDump(payload);
  } else if (packageType === "database_sql") {
    content = generateDatabaseSqlDump(payload);
  } else {
    content = generateWorkingWebsiteHtml(payload);
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = new Blob([content], { type: pkg.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return filename;
}
