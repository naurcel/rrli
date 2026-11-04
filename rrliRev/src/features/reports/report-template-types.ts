/**
 * RouteX Customizable Company Report Formats — Domain Types & Schemas
 *
 * Supports flexible report layouts, customizable columns, custom column headings,
 * column ordering, visibility toggling, financial breakdown KPI selection,
 * and persistent report templates for Redeemed Route Logistics Inc.
 */

export type ReportBaseType = "client_summary" | "truck_summary" | "trip_ledger";

export type ColumnDataType = "string" | "currency" | "number" | "percent" | "badge";

export type ColumnCategory = "identity" | "volume" | "financial" | "expense" | "operational";

export type ColumnDefinition = {
  id: string;
  defaultLabel: string;
  dataType: ColumnDataType;
  category: ColumnCategory;
  defaultAlign: "left" | "center" | "right";
  description: string;
};

export type ColumnConfig = {
  id: string;
  customLabel?: string;
  visible: boolean;
  order: number;
  align?: "left" | "center" | "right";
};

export type FinancialBreakdownConfig = {
  showGrossEarnings: boolean;
  showTotalExpenses: boolean;
  showNetProfit: boolean;
  showProfitMargin: boolean;
  showActiveTrucks: boolean;
  showStoreDropoffs: boolean;
  showDieselExpenses: boolean;
  showTollExpenses: boolean;
  showCrewCosts: boolean;
};

export type ReportFilterConfig = {
  financialState: "all" | "finalized_only";
  truckOwnership: "all" | "owned_only" | "subcontracted_only";
};

export type ReportLayoutConfig = {
  title: string;
  sectionHeading: string;
  subtitle?: string;
  documentTitle?: string;
};

export type ReportTemplate = {
  id: string;
  name: string;
  description: string;
  baseType: ReportBaseType;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  layout: ReportLayoutConfig;
  columns: ColumnConfig[];
  breakdown: FinancialBreakdownConfig;
  filters: ReportFilterConfig;
};

// ============================================================================
// Catalog of Available Columns per Report Base Type
// ============================================================================

export const CLIENT_SUMMARY_COLUMNS: readonly ColumnDefinition[] = [
  { id: "clientName", defaultLabel: "Client", dataType: "string", category: "identity", defaultAlign: "left", description: "Client company name" },
  { id: "deliveries", defaultLabel: "Deliveries", dataType: "number", category: "volume", defaultAlign: "right", description: "Total completed delivery trips" },
  { id: "dropoffs", defaultLabel: "Store Drop-offs", dataType: "number", category: "volume", defaultAlign: "right", description: "Total store-level stops served" },
  { id: "revenue", defaultLabel: "Revenue", dataType: "currency", category: "financial", defaultAlign: "right", description: "Billed delivery earnings (PHP)" },
  { id: "expenses", defaultLabel: "Expenses", dataType: "currency", category: "expense", defaultAlign: "right", description: "Total operational trip expenses (PHP)" },
  { id: "netIncome", defaultLabel: "Net Income", dataType: "currency", category: "financial", defaultAlign: "right", description: "Revenue minus total expenses (PHP)" },
  { id: "margin", defaultLabel: "Profit Margin", dataType: "percent", category: "financial", defaultAlign: "right", description: "Net income margin percentage" },
  { id: "share", defaultLabel: "Revenue Share", dataType: "percent", category: "financial", defaultAlign: "right", description: "Share of total company revenue" },
  { id: "attachedPods", defaultLabel: "Attached PODs", dataType: "number", category: "operational", defaultAlign: "right", description: "Count of store drop-offs with attached POD documents" },
];

export const TRUCK_SUMMARY_COLUMNS: readonly ColumnDefinition[] = [
  { id: "plateNumber", defaultLabel: "Truck", dataType: "string", category: "identity", defaultAlign: "left", description: "Vehicle license plate number" },
  { id: "truckType", defaultLabel: "Truck Type", dataType: "string", category: "identity", defaultAlign: "left", description: "Vehicle classification (4W, 6W, 10W)" },
  { id: "completedTrips", defaultLabel: "Deliveries", dataType: "number", category: "volume", defaultAlign: "right", description: "Total completed delivery trips" },
  { id: "storesServed", defaultLabel: "Stores Served", dataType: "number", category: "volume", defaultAlign: "right", description: "Total store destinations visited" },
  { id: "distanceKm", defaultLabel: "Distance", dataType: "number", category: "volume", defaultAlign: "right", description: "Total distance traveled in km" },
  { id: "revenue", defaultLabel: "Revenue", dataType: "currency", category: "financial", defaultAlign: "right", description: "Billed trip revenue (PHP)" },
  { id: "dieselExpenses", defaultLabel: "Diesel Expenses", dataType: "currency", category: "expense", defaultAlign: "right", description: "Fuel and diesel expenses (PHP)" },
  { id: "tollExpenses", defaultLabel: "Toll Expenses", dataType: "currency", category: "expense", defaultAlign: "right", description: "Expressway tollway fees (PHP)" },
  { id: "crewCosts", defaultLabel: "Crew Costs", dataType: "currency", category: "expense", defaultAlign: "right", description: "Driver and helper daily rates and allowances (PHP)" },
  { id: "entryAndOther", defaultLabel: "Entry & Other", dataType: "currency", category: "expense", defaultAlign: "right", description: "Store gate entry and incidental expenses (PHP)" },
  { id: "expenses", defaultLabel: "Expenses", dataType: "currency", category: "expense", defaultAlign: "right", description: "Total trip expenses (PHP)" },
  { id: "netProfit", defaultLabel: "Net Profit", dataType: "currency", category: "financial", defaultAlign: "right", description: "Total earnings minus total expenses (PHP)" },
  { id: "margin", defaultLabel: "Profit Margin", dataType: "percent", category: "financial", defaultAlign: "right", description: "Net profit margin percentage" },
  { id: "share", defaultLabel: "Expense Share", dataType: "percent", category: "financial", defaultAlign: "right", description: "Share of total company fleet expenses" },
];

export const TRIP_LEDGER_COLUMNS: readonly ColumnDefinition[] = [
  { id: "waybillNumber", defaultLabel: "Waybill #", dataType: "string", category: "identity", defaultAlign: "left", description: "Unique delivery waybill tracking identifier" },
  { id: "deliveryDate", defaultLabel: "Date", dataType: "string", category: "identity", defaultAlign: "left", description: "Delivery execution date (YYYY-MM-DD)" },
  { id: "clientName", defaultLabel: "Client", dataType: "string", category: "identity", defaultAlign: "left", description: "Client organization name" },
  { id: "plateNumber", defaultLabel: "Plate #", dataType: "string", category: "identity", defaultAlign: "left", description: "Truck plate number" },
  { id: "truckType", defaultLabel: "Truck Type", dataType: "string", category: "identity", defaultAlign: "left", description: "Truck specification (4W, 6W, 10W)" },
  { id: "truckOwnership", defaultLabel: "Ownership", dataType: "string", category: "identity", defaultAlign: "center", description: "Owned fleet vs Subcontracted" },
  { id: "temperature", defaultLabel: "Temp", dataType: "string", category: "operational", defaultAlign: "center", description: "Reefer container set temperature" },
  { id: "distanceKm", defaultLabel: "Distance (km)", dataType: "number", category: "volume", defaultAlign: "right", description: "Trip distance in kilometers" },
  { id: "fuelRate", defaultLabel: "Fuel Rate", dataType: "currency", category: "expense", defaultAlign: "right", description: "Diesel price per liter (PHP)" },
  { id: "revenue", defaultLabel: "Delivery Rate", dataType: "currency", category: "financial", defaultAlign: "right", description: "Billed trip earnings (PHP)" },
  { id: "diesel", defaultLabel: "Diesel", dataType: "currency", category: "expense", defaultAlign: "right", description: "Diesel expense (PHP)" },
  { id: "toll", defaultLabel: "Toll", dataType: "currency", category: "expense", defaultAlign: "right", description: "Toll fee (PHP)" },
  { id: "entryFee", defaultLabel: "Entry Fee", dataType: "currency", category: "expense", defaultAlign: "right", description: "Store parking / entry fee (PHP)" },
  { id: "crewCost", defaultLabel: "Crew Cost", dataType: "currency", category: "expense", defaultAlign: "right", description: "Crew daily compensation and allowance (PHP)" },
  { id: "expenses", defaultLabel: "Total Expenses", dataType: "currency", category: "expense", defaultAlign: "right", description: "Total consolidated trip costs (PHP)" },
  { id: "netIncome", defaultLabel: "Net Income", dataType: "currency", category: "financial", defaultAlign: "right", description: "Trip net profit (PHP)" },
  { id: "margin", defaultLabel: "Margin", dataType: "percent", category: "financial", defaultAlign: "right", description: "Trip profit margin %" },
  { id: "dropoffCount", defaultLabel: "Stores", dataType: "number", category: "volume", defaultAlign: "right", description: "Count of destination drop-offs" },
  { id: "financialState", defaultLabel: "Financial State", dataType: "badge", category: "operational", defaultAlign: "center", description: "Finalized vs Incomplete" },
  { id: "podStatus", defaultLabel: "POD Status", dataType: "badge", category: "operational", defaultAlign: "center", description: "Document completeness indicator" },
];

export function getColumnCatalog(baseType: ReportBaseType): readonly ColumnDefinition[] {
  switch (baseType) {
    case "client_summary":
      return CLIENT_SUMMARY_COLUMNS;
    case "truck_summary":
      return TRUCK_SUMMARY_COLUMNS;
    case "trip_ledger":
      return TRIP_LEDGER_COLUMNS;
  }
}

// ============================================================================
// Built-in Standard Templates (Preserved as System Defaults)
// ============================================================================

export const DEFAULT_REVENUE_TEMPLATE: ReportTemplate = {
  id: "default-revenue",
  name: "Standard Revenue Report",
  description: "Billed client earnings and revenue share across completed trips.",
  baseType: "client_summary",
  isDefault: true,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  layout: {
    title: "Revenue Report",
    sectionHeading: "Completed-Delivery Revenue by Client",
    subtitle: "Consolidated client billings and percentage share of delivery earnings",
  },
  columns: [
    { id: "clientName", visible: true, order: 0, align: "left" },
    { id: "deliveries", visible: true, order: 1, align: "right" },
    { id: "revenue", visible: true, order: 2, align: "right" },
    { id: "share", visible: true, order: 3, align: "right" },
  ],
  breakdown: {
    showGrossEarnings: true,
    showTotalExpenses: true,
    showNetProfit: true,
    showProfitMargin: true,
    showActiveTrucks: true,
    showStoreDropoffs: true,
    showDieselExpenses: false,
    showTollExpenses: false,
    showCrewCosts: false,
  },
  filters: {
    financialState: "finalized_only",
    truckOwnership: "all",
  },
};

export const DEFAULT_EXPENSES_TEMPLATE: ReportTemplate = {
  id: "default-expenses",
  name: "Standard Expense Report",
  description: "Confirmed operating and trip expenses categorized by truck.",
  baseType: "truck_summary",
  isDefault: true,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  layout: {
    title: "Expense Report",
    sectionHeading: "Confirmed Trip Expenses by Truck",
    subtitle: "Breakdown of operating costs including fuel, tolls, crew, and entry fees",
  },
  columns: [
    { id: "plateNumber", visible: true, order: 0, align: "left" },
    { id: "completedTrips", visible: true, order: 1, align: "right" },
    { id: "expenses", visible: true, order: 2, align: "right" },
    { id: "share", visible: true, order: 3, align: "right" },
  ],
  breakdown: {
    showGrossEarnings: true,
    showTotalExpenses: true,
    showNetProfit: true,
    showProfitMargin: true,
    showActiveTrucks: true,
    showStoreDropoffs: true,
    showDieselExpenses: true,
    showTollExpenses: true,
    showCrewCosts: true,
  },
  filters: {
    financialState: "finalized_only",
    truckOwnership: "all",
  },
};

export const DEFAULT_PROFITABILITY_TEMPLATE: ReportTemplate = {
  id: "default-profitability",
  name: "Standard Profitability Report",
  description: "Revenue, trip expenses, net profit, and profit margin by vehicle.",
  baseType: "truck_summary",
  isDefault: true,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  layout: {
    title: "Profitability Report",
    sectionHeading: "Revenue, Expenses & Net Profit by Truck",
    subtitle: "Comprehensive unit economics across owned and subcontracted fleet vehicles",
  },
  columns: [
    { id: "plateNumber", visible: true, order: 0, align: "left" },
    { id: "completedTrips", visible: true, order: 1, align: "right" },
    { id: "revenue", visible: true, order: 2, align: "right" },
    { id: "expenses", visible: true, order: 3, align: "right" },
    { id: "netProfit", visible: true, order: 4, align: "right" },
    { id: "margin", visible: true, order: 5, align: "right" },
  ],
  breakdown: {
    showGrossEarnings: true,
    showTotalExpenses: true,
    showNetProfit: true,
    showProfitMargin: true,
    showActiveTrucks: true,
    showStoreDropoffs: true,
    showDieselExpenses: true,
    showTollExpenses: true,
    showCrewCosts: true,
  },
  filters: {
    financialState: "finalized_only",
    truckOwnership: "all",
  },
};

export const DEFAULT_ACTIVITY_TEMPLATE: ReportTemplate = {
  id: "default-activity",
  name: "Standard Activity Report",
  description: "Completed deliveries, store drop-off counts, and attached POD documents.",
  baseType: "client_summary",
  isDefault: true,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  layout: {
    title: "Activity Report",
    sectionHeading: "Completed Deliveries & Store Drop-offs by Client",
    subtitle: "Operational delivery activity and proof-of-delivery document attachment rates",
  },
  columns: [
    { id: "clientName", visible: true, order: 0, align: "left" },
    { id: "deliveries", visible: true, order: 1, align: "right" },
    { id: "dropoffs", visible: true, order: 2, align: "right" },
    { id: "attachedPods", visible: true, order: 3, align: "right" },
  ],
  breakdown: {
    showGrossEarnings: false,
    showTotalExpenses: false,
    showNetProfit: false,
    showProfitMargin: false,
    showActiveTrucks: true,
    showStoreDropoffs: true,
    showDieselExpenses: false,
    showTollExpenses: false,
    showCrewCosts: false,
  },
  filters: {
    financialState: "all",
    truckOwnership: "all",
  },
};

export const DEFAULT_TRIP_LEDGER_TEMPLATE: ReportTemplate = {
  id: "default-trip-ledger",
  name: "Delivery Trip Ledger",
  description: "Line-by-line delivery trip records with waybill, route, and financial details.",
  baseType: "trip_ledger",
  isDefault: true,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  layout: {
    title: "Delivery Trip Ledger",
    sectionHeading: "Itemized Completed Deliveries & Financial Breakdown",
    subtitle: "Comprehensive line-item trip audit containing waybill numbers, fleet info, and trip economics",
  },
  columns: [
    { id: "waybillNumber", visible: true, order: 0, align: "left" },
    { id: "deliveryDate", visible: true, order: 1, align: "left" },
    { id: "clientName", visible: true, order: 2, align: "left" },
    { id: "plateNumber", visible: true, order: 3, align: "left" },
    { id: "truckType", visible: true, order: 4, align: "left" },
    { id: "revenue", visible: true, order: 5, align: "right" },
    { id: "expenses", visible: true, order: 6, align: "right" },
    { id: "netIncome", visible: true, order: 7, align: "right" },
    { id: "financialState", visible: true, order: 8, align: "center" },
  ],
  breakdown: {
    showGrossEarnings: true,
    showTotalExpenses: true,
    showNetProfit: true,
    showProfitMargin: true,
    showActiveTrucks: true,
    showStoreDropoffs: true,
    showDieselExpenses: true,
    showTollExpenses: true,
    showCrewCosts: true,
  },
  filters: {
    financialState: "all",
    truckOwnership: "all",
  },
};

export const BUILTIN_REPORT_TEMPLATES: readonly ReportTemplate[] = [
  DEFAULT_REVENUE_TEMPLATE,
  DEFAULT_EXPENSES_TEMPLATE,
  DEFAULT_PROFITABILITY_TEMPLATE,
  DEFAULT_ACTIVITY_TEMPLATE,
  DEFAULT_TRIP_LEDGER_TEMPLATE,
];
