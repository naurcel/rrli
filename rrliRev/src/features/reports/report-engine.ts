/**
 * RouteX Customizable Company Report Formats — Data Processing & Export Engine
 *
 * Implements report generation, filtering, dynamic column projection,
 * financial totals calculation, and CSV / Excel export generation without
 * altering or duplicating source delivery records.
 */

import * as XLSX from "xlsx";
import {
  type DeliveryTripRecord,
  getTripTotalDropoffs,
  isDeliveryFinanciallyComplete,
  summarizeTruckProfitability,
} from "../deliveries/delivery-domain.ts";
import { formatPercent, formatPeso } from "../../lib/format.ts";
import {
  type ColumnConfig,
  type ColumnDefinition,
  getColumnCatalog,
  type ReportBaseType,
  type ReportTemplate,
} from "./report-template-types.ts";

export type ResolvedReportColumn = {
  id: string;
  label: string;
  dataType: ColumnDefinition["dataType"];
  category: ColumnDefinition["category"];
  align: "left" | "center" | "right";
  order: number;
};

export type ReportRowData = Record<string, unknown>;

export type ReportSummaryTotals = {
  grossEarnings: number;
  totalExpenses: number;
  netProfit: number;
  marginPercent: number | null;
  activeTruckCount: number;
  totalStoreDropoffs: number;
  totalDieselExpenses: number;
  totalTollExpenses: number;
  totalCrewCosts: number;
  totalTrips: number;
  totalCompanyExpenses?: number;
  companyNetProfit?: number;
  companyIncoming?: number;
  companyOutgoing?: number;
  companyNetActivity?: number;
  totalInflow?: number;
  totalOutflow?: number;
  companyMarginPercent?: number | null;
};

export type CompanyFinanceInput =
  | number
  | {
      incoming?: number;
      outgoing?: number;
    };

export type ProcessedReportResult = {
  template: ReportTemplate;
  columns: ResolvedReportColumn[];
  rows: ReportRowData[];
  totals: ReportSummaryTotals;
  filteredDeliveryCount: number;
};

/**
 * Resolves the ordered, visible columns for a given template.
 */
export function resolveTemplateColumns(
  baseType: ReportBaseType,
  columnConfigs: readonly ColumnConfig[],
): ResolvedReportColumn[] {
  const catalog = getColumnCatalog(baseType);
  const catalogMap = new Map(catalog.map((col) => [col.id, col]));

  // Combine catalog with template config
  const resolved: ResolvedReportColumn[] = [];

  for (const cfg of columnConfigs) {
    if (!cfg.visible) continue;
    const def = catalogMap.get(cfg.id);
    if (!def) continue;

    resolved.push({
      id: cfg.id,
      label: cfg.customLabel?.trim() || def.defaultLabel,
      dataType: def.dataType,
      category: def.category,
      align: cfg.align || def.defaultAlign,
      order: cfg.order,
    });
  }

  return resolved.sort((a, b) => a.order - b.order);
}

/**
 * Executes a complete report processing pipeline: resolves columns, filters
 * source deliveries according to template filters, and generates data rows and totals.
 */
export function processReport(
  deliveries: readonly DeliveryTripRecord[],
  template: ReportTemplate,
  companyExpenses?: CompanyFinanceInput,
): ProcessedReportResult {
  const columns = resolveTemplateColumns(template.baseType, template.columns);
  const { rows, totals } = generateReportRows(deliveries, template, companyExpenses);
  return {
    template,
    columns,
    rows,
    totals,
    filteredDeliveryCount: totals.totalTrips,
  };
}

/**
 * Filters source deliveries based on template filter rules.
 */
export function filterDeliveriesForTemplate(
  deliveries: readonly DeliveryTripRecord[],
  template: ReportTemplate,
): DeliveryTripRecord[] {
  return deliveries.filter((item) => {
    // 1. Financial state filter
    if (template.filters.financialState === "finalized_only") {
      if (!isDeliveryFinanciallyComplete(item)) {
        return false;
      }
    }

    // 2. Truck ownership filter
    if (template.filters.truckOwnership === "owned_only") {
      if (item.truckOwnership !== "Owned") return false;
    } else if (template.filters.truckOwnership === "subcontracted_only") {
      if (item.truckOwnership !== "Subcontracted") return false;
    }

    return true;
  });
}

/**
 * Generates aggregated or itemized report rows based on template baseType.
 */
export function generateReportRows(
  deliveries: readonly DeliveryTripRecord[],
  template: ReportTemplate,
  companyExpenses?: CompanyFinanceInput,
): { rows: ReportRowData[]; totals: ReportSummaryTotals } {
  const filtered = filterDeliveriesForTemplate(deliveries, template);

  // Compute overall summary totals
  let grossEarnings = 0;
  let totalExpenses = 0;
  let totalStoreDropoffs = 0;
  let totalDieselExpenses = 0;
  let totalTollExpenses = 0;
  let totalCrewCosts = 0;
  const activeTruckPlates = new Set<string>();

  for (const delivery of filtered) {
    const isFinalized = delivery.financialState === "finalized";
    if (isFinalized) {
      grossEarnings += delivery.deliveryRate ?? 0;
      totalExpenses += delivery.totalExpenses ?? 0;
      totalDieselExpenses += delivery.expenses.dieselExpenses ?? 0;
      totalTollExpenses += delivery.expenses.tollGateExpenses ?? 0;

      const crewCost =
        (delivery.expenses.driverDailyRate ?? 0) +
        (delivery.expenses.driverAllowance ?? 0) +
        (delivery.expenses.helperDailyRate ?? 0) +
        (delivery.expenses.helperAllowance ?? 0);
      totalCrewCosts += crewCost;
    }

    totalStoreDropoffs += getTripTotalDropoffs(delivery.dropoffs);

    if (delivery.plateNumber) {
      activeTruckPlates.add(delivery.plateNumber);
    }
  }

  const netProfit = grossEarnings - totalExpenses;
  const marginPercent = grossEarnings > 0 ? (netProfit / grossEarnings) * 100 : null;

  // Extract company incoming and outgoing
  const companyIncoming =
    typeof companyExpenses === "object" && companyExpenses !== null
      ? (companyExpenses.incoming ?? 0)
      : 0;
  const companyOutgoing =
    typeof companyExpenses === "object" && companyExpenses !== null
      ? (companyExpenses.outgoing ?? 0)
      : typeof companyExpenses === "number"
        ? companyExpenses
        : 0;

  // Truck summary reports are strictly isolated from company-wide operating expenses
  const companyInc = template.baseType === "truck_summary" ? 0 : companyIncoming;
  const companyExp = template.baseType === "truck_summary" ? 0 : companyOutgoing;
  const totalInflow = grossEarnings + companyInc;
  const totalOutflow = totalExpenses + companyExp;
  const companyNetProfit = totalInflow - totalOutflow;
  const companyMarginPercent = totalInflow > 0 ? (companyNetProfit / totalInflow) * 100 : null;

  const totals: ReportSummaryTotals = {
    grossEarnings,
    totalExpenses,
    netProfit,
    marginPercent,
    activeTruckCount: activeTruckPlates.size,
    totalStoreDropoffs,
    totalDieselExpenses,
    totalTollExpenses,
    totalCrewCosts,
    totalTrips: filtered.length,
    totalCompanyExpenses: companyExp,
    companyIncoming: companyInc,
    companyOutgoing: companyExp,
    companyNetActivity: companyInc - companyExp,
    totalInflow,
    totalOutflow,
    companyNetProfit,
    companyMarginPercent,
  };

  // Generate rows by baseType
  if (template.baseType === "client_summary") {
    const clientMap = new Map<
      string,
      {
        clientName: string;
        deliveries: number;
        dropoffs: number;
        revenue: number;
        expenses: number;
        netIncome: number;
        attachedPods: number;
      }
    >();

    for (const d of filtered) {
      const existing = clientMap.get(d.clientName) ?? {
        clientName: d.clientName,
        deliveries: 0,
        dropoffs: 0,
        revenue: 0,
        expenses: 0,
        netIncome: 0,
        attachedPods: 0,
      };

      const financiallyComplete = isDeliveryFinanciallyComplete(d);
      existing.deliveries += 1;
      existing.dropoffs += getTripTotalDropoffs(d.dropoffs);
      if (financiallyComplete) {
        existing.revenue += d.deliveryRate ?? 0;
        existing.expenses += d.totalExpenses ?? 0;
        existing.netIncome += d.netIncome ?? 0;
      }
      existing.attachedPods += d.dropoffs.filter((dropoff) => dropoff.podSubmitted).length;

      clientMap.set(d.clientName, existing);
    }

    const rows: ReportRowData[] = Array.from(clientMap.values()).map((c) => {
      const margin = c.revenue > 0 ? (c.netIncome / c.revenue) * 100 : null;
      const share = grossEarnings > 0 ? (c.revenue / grossEarnings) * 100 : null;

      return {
        clientName: c.clientName,
        deliveries: c.deliveries,
        dropoffs: c.dropoffs,
        revenue: c.revenue,
        expenses: c.expenses,
        netIncome: c.netIncome,
        margin,
        share,
        attachedPods: c.attachedPods,
      };
    });

    return { rows, totals };
  }

  if (template.baseType === "truck_summary") {
    const summaries = summarizeTruckProfitability(filtered);
    const rows: ReportRowData[] = summaries.map((s) => {
      const share = totalExpenses > 0 ? (s.totalExpenses / totalExpenses) * 100 : null;
      return {
        plateNumber: s.plateNumber,
        truckType: s.truckType,
        completedTrips: s.completedTrips,
        storesServed: s.totalStoresServed,
        distanceKm: s.totalDistanceKm,
        revenue: s.totalEarnings,
        dieselExpenses: s.totalDieselExpenses,
        tollExpenses: s.totalTollExpenses,
        crewCosts: s.totalCrewCosts,
        entryAndOther: s.totalEntryAndOtherExpenses,
        expenses: s.totalExpenses,
        netProfit: s.netProfit,
        margin: s.marginPercent,
        share,
      };
    });

    return { rows, totals };
  }

  // baseType === "trip_ledger"
  const rows: ReportRowData[] = filtered.map((d) => {
    const crewCost =
      (d.expenses.driverDailyRate ?? 0) +
      (d.expenses.driverAllowance ?? 0) +
      (d.expenses.helperDailyRate ?? 0) +
      (d.expenses.helperAllowance ?? 0);
    const storeNames = d.dropoffs.map((s) => s.storeName).filter(Boolean).join("\n") || "—";

    return {
      waybillNumber: d.waybillNumber,
      deliveryDate: d.deliveryDate,
      clientName: d.clientName,
      plateNumber: d.plateNumber,
      truckType: d.truckType,
      truckOwnership: d.truckOwnership,
      temperature: d.truckTemperature,
      origin: d.origin,
      store: storeNames,
      distanceKm: d.distanceKm,
      fuelRate: d.fuelRate,
      revenue: d.deliveryRate ?? 0,
      diesel: d.expenses.dieselExpenses,
      toll: d.expenses.tollGateExpenses,
      tollGateBreakdown: d.expenses.tollGateBreakdown ?? "",
      entryFee: d.expenses.entryFees,
      otherExpenses: d.expenses.otherExpenses,
      driverAllowance: d.expenses.driverAllowance,
      driverDailyRate: d.expenses.driverDailyRate,
      helperAllowance: d.expenses.helperAllowance,
      helperDailyRate: d.expenses.helperDailyRate,
      crewCost,
      expenses: d.totalExpenses,
      netIncome: d.netIncome,
      margin: d.marginPercent,
      dropoffCount: getTripTotalDropoffs(d.dropoffs),
      financialState: d.financialState === "finalized" ? "Finalized" : "Incomplete",
      podStatus: d.podStatus,
    };
  });

  return { rows, totals };
}

function formatDtrTruckType(truckType: unknown): string {
  const raw = String(truckType ?? "").trim().toUpperCase();
  if (!raw) return "2T";
  if (raw === "10W" || raw === "4T" || raw === "2T") return raw;
  if (raw.includes("10")) return "10W";
  if (raw.includes("6")) return "4T";
  if (raw.includes("4")) return "2T";
  return raw;
}

function formatDtrTemp(temp: unknown): string {
  const raw = String(temp ?? "").trim();
  if (!raw) return "-";
  if (raw.toUpperCase() === "DRY" || raw.toUpperCase() === "AMBIENT") return "DRY";
  const cleaned = raw.replace(/°?[Cc]$/i, "").trim();
  const num = Number(cleaned);
  if (Number.isFinite(num) && num > 0 && !cleaned.startsWith("+")) {
    return `+${cleaned}`;
  }
  return cleaned || raw;
}

function formatDtrBannerDate(isoDate: string, fallbackLabel: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return fallbackLabel.toUpperCase();
  const months = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];
  const monthIdx = Number(match[2]) - 1;
  const monthName = months[monthIdx] || "JANUARY";
  return `${monthName} ${match[3]}, ${match[1]}`;
}

/**
 * Builds the 2D array of rows matching the exact RRLI Daily Trip Report spreadsheet layout
 * (daily section groupings, client carry-down, and summary totals).
 */
export function buildDtrBlockAoaFromRows(
  rows: readonly ReportRowData[],
  dateRangeLabel: string,
): Array<Array<string | number>> {
  const aoa: Array<Array<string | number>> = [];

  // Group rows by deliveryDate (preserving chronological or existing order per day)
  const byDate = new Map<string, ReportRowData[]>();
  const sorted = [...rows].sort((a, b) =>
    String(a.deliveryDate ?? "").localeCompare(String(b.deliveryDate ?? "")),
  );
  for (const r of sorted) {
    const dt = String(r.deliveryDate ?? "").slice(0, 10) || "UNKNOWN";
    const list = byDate.get(dt) ?? [];
    list.push(r);
    byDate.set(dt, list);
  }

  if (byDate.size === 0) {
    byDate.set("", []);
  }

  for (const [dateKey, dayRows] of byDate.entries()) {
    const totalCols = 23;

    const padRow = (arr: Array<string | number>): Array<string | number> => {
      const copy = [...arr];
      while (copy.length < totalCols) copy.push("");
      return copy;
    };

    const bannerDate = dateKey ? formatDtrBannerDate(dateKey, dateRangeLabel) : dateRangeLabel.toUpperCase();

    const row0: Array<string | number> = new Array(23).fill("");
    row0[0] = 3961;
    row0[1] = "REDEEMED ROUTE LOGSITICS INC.";
    aoa.push(padRow(row0));

    aoa.push(padRow(["", `${bannerDate} - DAILY TRIP REPORT`]));
    aoa.push(padRow([]));
    aoa.push(
      padRow([
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
      ]),
    );
    aoa.push(
      padRow([
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "ALLOWANCE",
        "DAILY RATE",
        "ALLOWANCE",
        "DAILY RATE",
      ]),
    );

    let driverAllowanceSum = 0;
    let helperAllowanceSum = 0;
    let totalExpenseSum = 0;
    let rateSum = 0;
    let netIncomeSum = 0;
    let prevClient = "";

    dayRows.forEach((row, i) => {
      const isOwned = row.truckOwnership === "Owned";
      const totalExp = typeof row.expenses === "number" ? row.expenses : (Number(row.expenses) || 0);
      const rev = typeof row.revenue === "number" ? row.revenue : (Number(row.revenue) || 0);
      const net = typeof row.netIncome === "number" ? row.netIncome : (rev - totalExp);

      const numOrDash = (val: unknown): number | string => {
        if (!isOwned || val == null || val === "" || val === "-") return "-";
        const n = typeof val === "number" ? val : Number(val);
        return Number.isFinite(n) && n > 0 ? n : "-";
      };

      const toll = numOrDash(row.toll);
      const other = numOrDash(row.otherExpenses);
      const entry = numOrDash(row.entryFee);
      const drvAllow = numOrDash(row.driverAllowance);
      const drvRate = numOrDash(row.driverDailyRate);
      const hlpAllow = numOrDash(row.helperAllowance);
      const hlpRate = numOrDash(row.helperDailyRate);
      const diesel = numOrDash(row.diesel);
      const fuelRate = numOrDash(row.fuelRate);
      const km = numOrDash(row.distanceKm);

      if (typeof drvAllow === "number") driverAllowanceSum += drvAllow;
      if (typeof hlpAllow === "number") helperAllowanceSum += hlpAllow;
      totalExpenseSum += totalExp;
      rateSum += rev;
      netIncomeSum += net;

      const rawClient = String(row.clientName ?? "").trim();
      const displayClient =
        rawClient && rawClient.toUpperCase() !== prevClient.toUpperCase() ? rawClient : "";
      if (rawClient) prevClient = rawClient;

      aoa.push(
        padRow([
          "",
          i + 1,
          displayClient,
          String(row.deliveryDate ?? ""),
          String(row.waybillNumber ?? ""),
          String(row.plateNumber ?? ""),
          formatDtrTruckType(row.truckType),
          formatDtrTemp(row.temperature),
          String(row.origin ?? "ARCA LANDERS STORE"),
          String(row.store ?? row.destination ?? "—"),
          toll,
          other,
          entry,
          drvAllow,
          drvRate,
          hlpAllow,
          hlpRate,
          diesel,
          Math.round(totalExp * 100) / 100,
          Math.round(rev * 100) / 100,
          Math.round(net * 100) / 100,
          fuelRate,
          km,
        ]),
      );
    });

    aoa.push(
      padRow([
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        Math.round(driverAllowanceSum * 100) / 100,
        "",
        Math.round(helperAllowanceSum * 100) / 100,
        "",
        "",
        Math.round(totalExpenseSum * 100) / 100,
        Math.round(rateSum * 100) / 100,
        Math.round(netIncomeSum * 100) / 100,
      ]),
    );
  }

  return aoa;
}

/**
 * Formats a single cell value for rendering or CSV export.
 */
export function formatCellValue(value: unknown, dataType: ColumnDefinition["dataType"]): string {
  if (value == null) return "—";

  switch (dataType) {
    case "currency":
      return typeof value === "number" ? formatPeso(value) : String(value);
    case "percent":
      return typeof value === "number" ? formatPercent(value) : "—";
    case "number":
      return typeof value === "number" ? value.toLocaleString("en-US") : String(value);
    case "badge":
    case "string":
    default:
      return String(value);
  }
}

/**
 * Formats a raw cell value specifically for clean numeric CSV spreadsheets.
 */
function formatCsvRawValue(value: unknown, dataType: ColumnDefinition["dataType"]): string {
  if (value == null) return "";
  if (dataType === "currency" || dataType === "number") {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value.toFixed(2) : "";
    }
  }
  if (dataType === "percent") {
    if (typeof value === "number") {
      return Number.isFinite(value) ? `${value.toFixed(1)}%` : "";
    }
  }
  return String(value);
}

/**
 * Escapes text for RFC 4180 CSV export.
 */
function escapeCsvCell(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Generates an Excel-compatible CSV string using custom headers and ordered columns.
 */
export function generateReportCsv(
  processed: ProcessedReportResult,
  dateRangeLabel: string,
): string {
  // If this is the Daily Trip Report or default Trip Ledger, format according to the reference DTR spreadsheet layout
  if (
    processed.template.id === "default-daily-trip" ||
    processed.template.id === "default-trip-ledger"
  ) {
    const dtrAoa = buildDtrBlockAoaFromRows(processed.rows, dateRangeLabel);
    return dtrAoa
      .map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ""))).join(","))
      .join("\r\n");
  }

  const lines: string[] = [];

  // Header metadata block
  lines.push(escapeCsvCell("REDEEMED ROUTE LOGISTICS INC. · ROUTEX"));
  lines.push(escapeCsvCell(processed.template.layout.title.toUpperCase()));
  if (processed.template.layout.subtitle) {
    lines.push(escapeCsvCell(processed.template.layout.subtitle));
  }
  lines.push(escapeCsvCell(`Period: ${dateRangeLabel}`));
  lines.push(escapeCsvCell(`Generated: ${new Date().toLocaleString()}`));
  lines.push("");

  // Summary Metrics Header
  const summaryHeaders: string[] = [];
  const summaryValues: string[] = [];

  if (processed.template.breakdown.showGrossEarnings) {
    summaryHeaders.push("Delivery Revenue (PHP)");
    summaryValues.push(processed.totals.grossEarnings.toFixed(2));
  }
  if (processed.template.breakdown.showTotalExpenses) {
    summaryHeaders.push("Trip Expenses (PHP)");
    summaryValues.push(processed.totals.totalExpenses.toFixed(2));
  }
  if (processed.template.breakdown.showNetProfit) {
    summaryHeaders.push("Net Profit (PHP)");
    summaryValues.push(processed.totals.netProfit.toFixed(2));
  }
  if (processed.template.breakdown.showProfitMargin) {
    summaryHeaders.push("Profit Margin");
    summaryValues.push(processed.totals.marginPercent != null ? `${processed.totals.marginPercent.toFixed(1)}%` : "N/A");
  }
  if (processed.template.breakdown.showActiveTrucks) {
    summaryHeaders.push("Active Trucks");
    summaryValues.push(String(processed.totals.activeTruckCount));
  }
  if (processed.template.breakdown.showStoreDropoffs) {
    summaryHeaders.push("Store Drop-offs");
    summaryValues.push(String(processed.totals.totalStoreDropoffs));
  }
  if ((processed.totals.totalCompanyExpenses ?? 0) > 0) {
    summaryHeaders.push("Company Expenses (PHP)");
    summaryValues.push((processed.totals.totalCompanyExpenses ?? 0).toFixed(2));
    summaryHeaders.push("Company Net Profit (PHP)");
    summaryValues.push((processed.totals.companyNetProfit ?? 0).toFixed(2));
  }

  if (summaryHeaders.length > 0) {
    lines.push(summaryHeaders.map(escapeCsvCell).join(","));
    lines.push(summaryValues.map(escapeCsvCell).join(","));
    lines.push("");
  }

  // Column Headers using Custom Labels
  const columnHeaders = processed.columns.map((c) => escapeCsvCell(c.label));
  lines.push(columnHeaders.join(","));

  // Data Rows
  for (const row of processed.rows) {
    const rowValues = processed.columns.map((c) => {
      const rawVal = row[c.id];
      const formatted = formatCsvRawValue(rawVal, c.dataType);
      return escapeCsvCell(formatted);
    });
    lines.push(rowValues.join(","));
  }

  // Summary Totals Row if applicable
  const totalsRow = processed.columns.map((c, index) => {
    if (index === 0) return escapeCsvCell("TOTALS");
    if (c.id === "revenue" || c.id === "grossEarnings") {
      return escapeCsvCell(processed.totals.grossEarnings.toFixed(2));
    }
    if (c.id === "expenses" || c.id === "totalExpenses") {
      return escapeCsvCell(processed.totals.totalExpenses.toFixed(2));
    }
    if (c.id === "netProfit" || c.id === "netIncome") {
      return escapeCsvCell(processed.totals.netProfit.toFixed(2));
    }
    if (c.id === "margin") {
      return escapeCsvCell(
        processed.totals.marginPercent != null ? `${processed.totals.marginPercent.toFixed(1)}%` : "—",
      );
    }
    if (c.id === "deliveries" || c.id === "completedTrips") {
      return escapeCsvCell(String(processed.totals.totalTrips));
    }
    if (c.id === "dropoffs" || c.id === "storesServed" || c.id === "dropoffCount") {
      return escapeCsvCell(String(processed.totals.totalStoreDropoffs));
    }
    if (c.id === "diesel" || c.id === "dieselExpenses") {
      return escapeCsvCell(processed.totals.totalDieselExpenses.toFixed(2));
    }
    if (c.id === "toll" || c.id === "tollExpenses") {
      return escapeCsvCell(processed.totals.totalTollExpenses.toFixed(2));
    }
    if (c.id === "crewCost" || c.id === "crewCosts") {
      return escapeCsvCell(processed.totals.totalCrewCosts.toFixed(2));
    }
    return "";
  });

  lines.push(totalsRow.join(","));

  return lines.join("\r\n");
}

/**
 * Triggers an immediate browser download of the report in CSV format.
 */
export function downloadReportCsvFile(
  processed: ProcessedReportResult,
  dateRangeLabel: string,
): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const csvContent = generateReportCsv(processed, dateRangeLabel);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const cleanName = processed.template.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", `routex_${cleanName}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates an Excel workbook (.xlsx binary buffer) from a processed report.
 */
export function generateReportXlsx(
  processed: ProcessedReportResult,
  dateRangeLabel: string,
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // If this is the Daily Trip Report or default Trip Ledger, format according to the reference DTR spreadsheet layout
  if (
    processed.template.id === "default-daily-trip" ||
    processed.template.id === "default-trip-ledger"
  ) {
    const dtrRows = buildDtrBlockAoaFromRows(processed.rows, dateRangeLabel);
    const dtrWs = XLSX.utils.aoa_to_sheet(dtrRows);
    XLSX.utils.book_append_sheet(wb, dtrWs, "DAILY TRIP REPORT");
    const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Uint8Array(wbOut);
  }

  // Header metadata block
  const rows: Array<Array<string | number>> = [
    ["REDEEMED ROUTE LOGISTICS INC. · ROUTEX"],
    [processed.template.layout.title.toUpperCase()],
  ];
  if (processed.template.layout.subtitle) {
    rows.push([processed.template.layout.subtitle]);
  }
  rows.push([`Period: ${dateRangeLabel}`]);
  rows.push([`Generated: ${new Date().toLocaleString()}`]);
  rows.push([]);

  // Summary Metrics Block
  const summaryHeaders: string[] = [];
  const summaryValues: Array<string | number> = [];

  if (processed.template.breakdown.showGrossEarnings) {
    summaryHeaders.push("Delivery Revenue (PHP)");
    summaryValues.push(processed.totals.grossEarnings);
  }
  if (processed.template.breakdown.showTotalExpenses) {
    summaryHeaders.push("Trip Expenses (PHP)");
    summaryValues.push(processed.totals.totalExpenses);
  }
  if (processed.template.breakdown.showNetProfit) {
    summaryHeaders.push("Net Profit (PHP)");
    summaryValues.push(processed.totals.netProfit);
  }
  if (processed.template.breakdown.showProfitMargin) {
    summaryHeaders.push("Profit Margin");
    summaryValues.push(
      processed.totals.marginPercent != null ? `${processed.totals.marginPercent.toFixed(1)}%` : "N/A",
    );
  }
  if (processed.template.breakdown.showActiveTrucks) {
    summaryHeaders.push("Active Trucks");
    summaryValues.push(processed.totals.activeTruckCount);
  }
  if (processed.template.breakdown.showStoreDropoffs) {
    summaryHeaders.push("Store Drop-offs");
    summaryValues.push(processed.totals.totalStoreDropoffs);
  }
  if ((processed.totals.totalCompanyExpenses ?? 0) > 0) {
    summaryHeaders.push("Company Expenses (PHP)");
    summaryValues.push(processed.totals.totalCompanyExpenses ?? 0);
    summaryHeaders.push("Company Net Profit (PHP)");
    summaryValues.push(processed.totals.companyNetProfit ?? 0);
  }

  if (summaryHeaders.length > 0) {
    rows.push(summaryHeaders);
    rows.push(summaryValues);
    rows.push([]);
  }

  // Column Headers using Custom Labels
  rows.push(processed.columns.map((c) => c.label));

  // Data Rows
  for (const row of processed.rows) {
    const rowValues = processed.columns.map((c) => {
      const rawVal = row[c.id];
      if (typeof rawVal === "number") return rawVal;
      return String(rawVal ?? "");
    });
    rows.push(rowValues);
  }

  // Summary Totals Row if applicable
  const totalsRow: Array<string | number> = processed.columns.map((c, index) => {
    if (index === 0) return "TOTALS";
    if (c.id === "revenue" || c.id === "grossEarnings") {
      return processed.totals.grossEarnings;
    }
    if (c.id === "expenses" || c.id === "totalExpenses") {
      return processed.totals.totalExpenses;
    }
    if (c.id === "netProfit" || c.id === "netIncome") {
      return processed.totals.netProfit;
    }
    if (c.id === "margin") {
      return processed.totals.marginPercent != null ? `${processed.totals.marginPercent.toFixed(1)}%` : "—";
    }
    if (c.id === "deliveries" || c.id === "completedTrips") {
      return processed.totals.totalTrips;
    }
    if (c.id === "dropoffs" || c.id === "storesServed" || c.id === "dropoffCount") {
      return processed.totals.totalStoreDropoffs;
    }
    if (c.id === "diesel" || c.id === "dieselExpenses") {
      return processed.totals.totalDieselExpenses;
    }
    if (c.id === "toll" || c.id === "tollExpenses") {
      return processed.totals.totalTollExpenses;
    }
    if (c.id === "crewCost" || c.id === "crewCosts") {
      return processed.totals.totalCrewCosts;
    }
    return "";
  });

  rows.push(totalsRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbOut);
}

/**
 * Triggers an immediate browser download of the report in Excel (.xlsx) format.
 */
export function downloadReportXlsxFile(
  processed: ProcessedReportResult,
  dateRangeLabel: string,
): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const xlsxBytes = generateReportXlsx(processed, dateRangeLabel);
  const blob = new Blob([xlsxBytes as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const cleanName = processed.template.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", `routex_${cleanName}_${dateStr}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
