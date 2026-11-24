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

    return {
      waybillNumber: d.waybillNumber,
      deliveryDate: d.deliveryDate,
      clientName: d.clientName,
      plateNumber: d.plateNumber,
      truckType: d.truckType,
      truckOwnership: d.truckOwnership,
      temperature: d.truckTemperature,
      origin: d.origin,
      distanceKm: d.distanceKm,
      fuelRate: d.fuelRate,
      revenue: d.deliveryRate ?? 0,
      diesel: d.expenses.dieselExpenses ?? 0,
      toll: d.expenses.tollGateExpenses,
      entryFee: d.expenses.entryFees ?? 0,
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
  // If this is the Daily Trip Report, format according to the reference DTR spreadsheet layout
  if (processed.template.id === "default-daily-trip") {
    const dtrLines: string[] = [
      "3961,REDEEMED ROUTE LOGSITICS INC.,,,,,,,,,,,,,,,,,,,,,,TOLL GATES,,,,,,",
      `,"${dateRangeLabel.toUpperCase()} - DAILY TRIP REPORT",,,,,,,,,,,,,,,,,,,,,,,,,,,`,
      ",,,,,,,,,,,,,,,,,,,,,,,,,,,,",
      ',NO.,CLIENT,DATE,"WAYBILL \nNUMBER",PLATE NUMBER,"TRUCK \n TYPE",TRUCK TEMP,ORIGIN,STORE,TOLL GATE,"OTHER \n EXPENSES","ENTRY\nFEES",DRIVER,,HELPER,,DIESEL,"TOTAL \nEXPENSE",RATE,NET INCOME,"FUEL\nRATE",KM,,,,,,',
      ",,,,,,,,,,,,,ALLOWANCE,DAILY RATE,ALLOWANCE,DAILY RATE,,,,,,,,,,,,",
    ];

    let driverAllowanceSum = 0;
    let helperAllowanceSum = 0;
    let dieselSum = 0;
    let totalExpenseSum = 0;
    let rateSum = 0;
    let netIncomeSum = 0;

    processed.rows.forEach((row, i) => {
      const isOwned = row.truckOwnership === "Owned";
      const totalExp = typeof row.expenses === "number" ? row.expenses : (Number(row.expenses) || 0);
      const rev = typeof row.revenue === "number" ? row.revenue : (Number(row.revenue) || 0);
      const net = typeof row.netIncome === "number" ? row.netIncome : (rev - totalExp);

      const toll = isOwned && row.toll != null ? String(row.toll) : "-";
      const other = isOwned && row.otherExpenses != null ? String(row.otherExpenses) : "-";
      const entry = isOwned && row.entryFee != null ? String(row.entryFee) : "-";
      const drvAllow = isOwned && row.driverAllowance != null ? Number(row.driverAllowance) : (isOwned && row.crewCost ? 350 : "-");
      const drvRate = isOwned && row.driverDailyRate != null ? Number(row.driverDailyRate) : (isOwned && row.crewCost ? 745 : "-");
      const hlpAllow = isOwned && row.helperAllowance != null ? Number(row.helperAllowance) : (isOwned && row.crewCost ? 200 : "-");
      const hlpRate = isOwned && row.helperDailyRate != null ? Number(row.helperDailyRate) : (isOwned && row.crewCost ? 645 : "-");
      const diesel = isOwned && row.diesel != null ? Number(row.diesel) : "-";
      const fuelRate = isOwned && row.fuelRate != null ? String(row.fuelRate) : "-";
      const km = isOwned && row.distanceKm != null ? String(row.distanceKm) : "-";
      const tollGates = isOwned && row.tollGateBreakdown ? escapeCsvCell(String(row.tollGateBreakdown)) : "";

      if (typeof drvAllow === "number") driverAllowanceSum += drvAllow;
      if (typeof hlpAllow === "number") helperAllowanceSum += hlpAllow;
      if (typeof diesel === "number") dieselSum += diesel;
      totalExpenseSum += totalExp;
      rateSum += rev;
      netIncomeSum += net;

      dtrLines.push(
        [
          "",
          i + 1,
          escapeCsvCell(String(row.clientName ?? "")),
          escapeCsvCell(String(row.deliveryDate ?? "")),
          escapeCsvCell(String(row.waybillNumber ?? "")),
          escapeCsvCell(String(row.plateNumber ?? "")),
          escapeCsvCell(String(row.truckType ?? "2T")),
          escapeCsvCell(String(row.temperature ?? "+18")),
          escapeCsvCell(String(row.origin ?? "ARCA LANDERS STORE")),
          escapeCsvCell(String(row.store ?? row.destination ?? "—")),
          toll,
          other,
          entry,
          drvAllow,
          drvRate,
          hlpAllow,
          hlpRate,
          diesel,
          totalExp,
          rev,
          net,
          fuelRate,
          km,
          tollGates,
        ].join(",")
      );
    });

    dtrLines.push(
      [
        "", "", "", "", "", "", "", "", "", "", "", "", "",
        driverAllowanceSum || "",
        "",
        helperAllowanceSum || "",
        "",
        dieselSum || "",
        totalExpenseSum,
        rateSum,
        netIncomeSum,
        "", "", ""
      ].join(",")
    );

    return dtrLines.join("\r\n");
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

  // If this is the Daily Trip Report, format according to the reference DTR spreadsheet layout
  if (processed.template.id === "default-daily-trip") {
    const dtrRows: Array<Array<string | number>> = [
      ["3961", "REDEEMED ROUTE LOGSITICS INC.", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "TOLL GATES"],
      ["", `${dateRangeLabel.toUpperCase()} - DAILY TRIP REPORT`],
      [],
      ["", "NO.", "CLIENT", "DATE", "WAYBILL \nNUMBER", "PLATE NUMBER", "TRUCK \n TYPE", "TRUCK TEMP", "ORIGIN", "STORE", "TOLL GATE", "OTHER \n EXPENSES", "ENTRY\nFEES", "DRIVER", "", "HELPER", "", "DIESEL", "TOTAL \nEXPENSE", "RATE", "NET INCOME", "FUEL\nRATE", "KM", "TOLL GATES"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "ALLOWANCE", "DAILY RATE", "ALLOWANCE", "DAILY RATE"],
    ];

    let driverAllowanceSum = 0;
    let helperAllowanceSum = 0;
    let dieselSum = 0;
    let totalExpenseSum = 0;
    let rateSum = 0;
    let netIncomeSum = 0;

    processed.rows.forEach((row, i) => {
      const isOwned = row.truckOwnership === "Owned";
      const totalExp = typeof row.expenses === "number" ? row.expenses : (Number(row.expenses) || 0);
      const rev = typeof row.revenue === "number" ? row.revenue : (Number(row.revenue) || 0);
      const net = typeof row.netIncome === "number" ? row.netIncome : (rev - totalExp);

      const toll = isOwned && row.toll != null ? Number(row.toll) : "-";
      const other = isOwned && row.otherExpenses != null ? Number(row.otherExpenses) : "-";
      const entry = isOwned && row.entryFee != null ? Number(row.entryFee) : "-";
      const drvAllow = isOwned && row.driverAllowance != null ? Number(row.driverAllowance) : (isOwned && row.crewCost ? 350 : "-");
      const drvRate = isOwned && row.driverDailyRate != null ? Number(row.driverDailyRate) : (isOwned && row.crewCost ? 745 : "-");
      const hlpAllow = isOwned && row.helperAllowance != null ? Number(row.helperAllowance) : (isOwned && row.crewCost ? 200 : "-");
      const hlpRate = isOwned && row.helperDailyRate != null ? Number(row.helperDailyRate) : (isOwned && row.crewCost ? 645 : "-");
      const diesel = isOwned && row.diesel != null ? Number(row.diesel) : "-";
      const fuelRate = isOwned && row.fuelRate != null ? Number(row.fuelRate) : "-";
      const km = isOwned && row.distanceKm != null ? Number(row.distanceKm) : "-";
      const tollGates = isOwned && row.tollGateBreakdown ? String(row.tollGateBreakdown) : "";

      if (typeof drvAllow === "number") driverAllowanceSum += drvAllow;
      if (typeof hlpAllow === "number") helperAllowanceSum += hlpAllow;
      if (typeof diesel === "number") dieselSum += diesel;
      totalExpenseSum += totalExp;
      rateSum += rev;
      netIncomeSum += net;

      dtrRows.push([
        "",
        i + 1,
        String(row.clientName ?? ""),
        String(row.deliveryDate ?? ""),
        String(row.waybillNumber ?? ""),
        String(row.plateNumber ?? ""),
        String(row.truckType ?? "2T"),
        String(row.temperature ?? "+18"),
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
        totalExp,
        rev,
        net,
        fuelRate,
        km,
        tollGates,
      ]);
    });

    dtrRows.push([
      "", "", "", "", "", "", "", "", "", "", "", "", "",
      driverAllowanceSum || "",
      "",
      helperAllowanceSum || "",
      "",
      dieselSum || "",
      totalExpenseSum,
      rateSum,
      netIncomeSum,
      "", "", ""
    ]);

    const dtrWs = XLSX.utils.aoa_to_sheet(dtrRows);
    XLSX.utils.book_append_sheet(wb, dtrWs, "Daily Trip Report");
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
