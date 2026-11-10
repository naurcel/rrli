/**
 * RouteX Customizable Company Report Formats — Data Processing & Export Engine
 *
 * Implements report generation, filtering, dynamic column projection,
 * financial totals calculation, and CSV / Excel export generation without
 * altering or duplicating source delivery records.
 */

import {
  type DeliveryTripRecord,
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
  companyExpenses?: number,
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
  companyExpenses?: number,
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

    totalStoreDropoffs += delivery.dropoffs.length;

    if (delivery.plateNumber) {
      activeTruckPlates.add(delivery.plateNumber);
    }
  }

  const netProfit = grossEarnings - totalExpenses;
  const marginPercent = grossEarnings > 0 ? (netProfit / grossEarnings) * 100 : null;
  // Truck summary reports are strictly isolated from company-wide operating expenses
  const companyExp = template.baseType === "truck_summary" ? 0 : (companyExpenses ?? 0);
  const companyNetProfit = grossEarnings - totalExpenses - companyExp;

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
    companyNetProfit,
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

      existing.deliveries += 1;
      existing.dropoffs += d.dropoffs.length;
      existing.revenue += d.deliveryRate ?? 0;
      existing.expenses += d.totalExpenses ?? 0;
      existing.netIncome += d.netIncome ?? 0;
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
      dropoffCount: d.dropoffs.length,
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
