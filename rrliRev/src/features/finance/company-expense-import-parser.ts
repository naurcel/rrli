import * as XLSX from "xlsx";
import {
  COMPANY_FOUNDATION_DATE,
  type CompanyExpense,
  type FinanceTransactionType,
} from "./company-expense-domain.ts";

export type StagedExpenseValidationIssue = {
  field: string;
  message: string;
};

export type StagedExpenseRow = {
  id: string;
  rowNumber: number;
  expenseDate: string; // YYYY-MM-DD
  description: string;
  amount: number;
  category: string;
  notes: string;
  transactionType?: FinanceTransactionType; // "Incoming" | "Outgoing"
  sourceSheet?: string;
  sourceRow?: number;
  sourceRef?: string | null;
  status: "ready" | "needs_attention" | "duplicate";
  issues: StagedExpenseValidationIssue[];
  duplicateReason?: string | null;
  duplicateMatchedWith?: {
    source: string;
    description: string;
    amount: number;
    date: string;
  } | null;
};

export type ExpenseImportParseResult = {
  rows: StagedExpenseRow[];
  totalRawRows: number;
  readyCount: number;
  attentionCount: number;
  duplicateCount: number;
  incomingCount: number;
  outgoingCount: number;
  incomingTotal: number;
  outgoingTotal: number;
  errors: string[];
  sheetNames?: string[];
  activeSheet?: string;
  detectedSheets?: string[];
};

export const COMMON_EXPENSE_CATEGORIES = [
  "General",
  "Operations",
  "Utilities",
  "Office Supplies",
  "Facility & Rent",
  "Maintenance & Repairs",
  "Administrative",
  "Taxes & Licenses",
  "Insurance",
  "Marketing & Client Relations",
  "Miscellaneous",
] as const;

export const KNOWN_FINANCE_SHEET_NAMES = [
  "SERVICE INVOICE (BILLINGS)",
  "DISBURSEMENT (DAILY EXPENSE)",
  "COLLECTION (REVENUE)",
  "PAYABLES (CREDITED_PAID)",
  "PAYABLES (NOT CREDITED)",
  "RECEIVABLES",
] as const;

/**
 * Standard RFC 4180 Delimited Text Parser.
 */
export function parseDelimitedText(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  if (!clean.trim()) return [];

  const firstLine = clean.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  let delimiter = ",";
  if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = "\t";
  } else if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ";";
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else if (char === "\n") {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes Excel dates (serial numbers or strings) to ISO YYYY-MM-DD.
 */
export function normalizeExpenseDate(raw: unknown): string {
  if (raw == null) return "";

  // 1. Excel serial number (e.g. 45500)
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    if (raw > 25569) {
      const utcDays = Math.floor(raw - 25569);
      const utcValue = utcDays * 86400 * 1000;
      const dateInfo = new Date(utcValue);
      return dateInfo.toISOString().slice(0, 10);
    }
  }

  let str = String(raw).trim();
  if (!str) return "";

  // Remove leading day names (e.g. "Friday, October 02, 2026" -> "October 02, 2026")
  str = str.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]*/i, "").trim();

  // 2. YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 3. MM/DD/YYYY or M/D/YYYY
  const mdy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdy) {
    const month = mdy[1].padStart(2, "0");
    const day = mdy[2].padStart(2, "0");
    const year = mdy[3];
    return `${year}-${month}-${day}`;
  }

  // 4. Fallback Date parsing (e.g. "September 9, 2026", "October 05, 2026")
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return str;
}

/**
 * Normalizes numeric monetary strings.
 */
export function parseExpenseAmount(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const clean = String(raw).replace(/[₱PHP$,\s]/gi, "").trim();
  if (!clean || clean === "-") return null;
  const num = Number(clean);
  return Number.isFinite(num) ? num : null;
}

type ColumnMap = {
  dateCol: number;
  descriptionCol: number;
  amountCol: number;
  categoryCol: number;
  notesCol: number;
};

function detectExpenseHeaders(grid: unknown[][]): { headerRowIndex: number; map: ColumnMap } | null {
  for (let r = 0; r < Math.min(15, grid.length); r++) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;

    let dateCol = -1;
    let descriptionCol = -1;
    let amountCol = -1;
    let categoryCol = -1;
    let notesCol = -1;

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim().toLowerCase();
      if (!cell) continue;

      if (dateCol === -1 && (cell === "date" || cell.includes("expense date") || cell.includes("date of") || cell === "trans date")) {
        dateCol = c;
      } else if (
        descriptionCol === -1 &&
        (cell === "description" || cell === "particulars" || cell === "item" || cell === "details" || cell === "expense" || cell.includes("description"))
      ) {
        descriptionCol = c;
      } else if (
        amountCol === -1 &&
        (cell === "amount" || cell === "total" || cell === "cost" || cell === "price" || cell === "expense amount" || cell.includes("amount"))
      ) {
        amountCol = c;
      } else if (
        categoryCol === -1 &&
        (cell === "category" || cell === "classification" || cell === "type" || cell.includes("category"))
      ) {
        categoryCol = c;
      } else if (
        notesCol === -1 &&
        (cell === "notes" || cell === "remarks" || cell === "comments" || cell === "memo")
      ) {
        notesCol = c;
      }
    }

    // A valid expense table must at least have Amount and either Date or Description
    if (amountCol !== -1 && (dateCol !== -1 || descriptionCol !== -1)) {
      if (dateCol === -1 && amountCol !== 0 && descriptionCol !== 0) dateCol = 0;
      if (descriptionCol === -1) {
        for (let c = 0; c < row.length; c++) {
          if (c !== dateCol && c !== amountCol && c !== categoryCol && c !== notesCol) {
            descriptionCol = c;
            break;
          }
        }
      }

      return {
        headerRowIndex: r,
        map: { dateCol, descriptionCol, amountCol, categoryCol, notesCol },
      };
    }
  }

  return null;
}

export function validateStagedExpenseRow(
  row: StagedExpenseRow,
  existingKeys: Set<string>,
  seenKeysInBatch: Set<string>,
): { status: "ready" | "needs_attention" | "duplicate"; issues: StagedExpenseValidationIssue[] } {
  const issues: StagedExpenseValidationIssue[] = [];

  // 1. Date validation
  if (!row.expenseDate) {
    issues.push({ field: "expenseDate", message: "Date is required." });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.expenseDate)) {
    issues.push({ field: "expenseDate", message: "Date must follow YYYY-MM-DD format." });
  } else if (row.expenseDate < COMPANY_FOUNDATION_DATE) {
    issues.push({
      field: "expenseDate",
      message: `Date cannot precede company foundation (${COMPANY_FOUNDATION_DATE}).`,
    });
  }

  // 2. Amount validation
  if (row.amount == null || Number.isNaN(row.amount)) {
    issues.push({ field: "amount", message: "A valid positive amount is required." });
  } else if (row.amount <= 0) {
    issues.push({ field: "amount", message: "Amount must be strictly greater than 0." });
  }

  // 3. Description validation
  if (!row.description.trim()) {
    issues.push({ field: "description", message: "Description is required." });
  } else if (row.description.length > 200) {
    issues.push({ field: "description", message: "Description cannot exceed 200 characters." });
  }

  // Check duplicate against existing system records
  const amtFormatted = typeof row.amount === "number" && !isNaN(row.amount) ? row.amount.toFixed(2) : "0.00";
  const dedupeKey = `${row.expenseDate}_${amtFormatted}_${row.description.toLowerCase().trim()}`;
  if (existingKeys.has(dedupeKey)) {
    return { status: "duplicate", issues: [{ field: "duplicate", message: "Matches an existing recorded company transaction." }] };
  }

  // Check duplicate within the same batch
  if (seenKeysInBatch.has(dedupeKey)) {
    return { status: "duplicate", issues: [{ field: "duplicate", message: "Duplicate entry within this import batch." }] };
  }

  seenKeysInBatch.add(dedupeKey);

  if (issues.length > 0) {
    return { status: "needs_attention", issues };
  }

  return { status: "ready", issues: [] };
}

// =========================================================================
// Specialized Sheet Parsers for the 6 FINANCE REF. Sheets
// =========================================================================

/**
 * 1. SERVICE INVOICE (BILLINGS) -> Incoming
 * Columns: B (REF. RRLI), C (DATE), D (COMPANY NAME), L (AMOUNT DUE)
 */
export function parseServiceInvoiceSheet(grid: unknown[][]): StagedExpenseRow[] {
  const rows: StagedExpenseRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r];
    if (!Array.isArray(raw)) continue;
    const invNo = String(raw[0] ?? "").trim();
    const ref = String(raw[1] ?? "").trim();
    const dateRaw = raw[2];
    const company = String(raw[3] ?? "").trim();
    const amountRaw = raw[11];

    const expenseDate = normalizeExpenseDate(dateRaw);
    const amount = parseExpenseAmount(amountRaw);
    if (!expenseDate && amount === null && !company) continue;

    const desc = company
      ? (ref ? `${company} (Ref: ${ref})` : company)
      : (ref ? `Billing Ref: ${ref}` : "Service Invoice Billing");

    const issues: StagedExpenseValidationIssue[] = [];
    if (!expenseDate) issues.push({ field: "expenseDate", message: "Missing or invalid invoice date." });
    if (!amount || amount <= 0) issues.push({ field: "amount", message: "Missing or invalid amount due." });
    if (!company && !ref) issues.push({ field: "description", message: "Missing company name." });

    rows.push({
      id: `si-${r}-${crypto.randomUUID()}`,
      rowNumber: r + 1,
      expenseDate: expenseDate || "",
      description: desc,
      amount: amount ?? 0,
      category: "Billing Revenue",
      notes: invNo ? `Invoice #${invNo}` : "",
      transactionType: "Incoming",
      sourceSheet: "SERVICE INVOICE (BILLINGS)",
      sourceRow: r + 1,
      sourceRef: ref || invNo || null,
      status: issues.length > 0 ? "needs_attention" : "ready",
      issues,
    });
  }
  return rows;
}

/**
 * 2. DISBURSEMENT (DAILY EXPENSE) -> Outgoing
 * Columns: A (DATE), B (DESCRIPTION), Expense columns E through Y (indices 4 to 24)
 * Sum of all numeric expense values per row = ONE outgoing transaction.
 */
export function parseDisbursementSheet(grid: unknown[][]): StagedExpenseRow[] {
  const rows: StagedExpenseRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r];
    if (!Array.isArray(raw)) continue;
    const dateRaw = raw[0];
    const descRaw = String(raw[1] ?? "").trim();
    const expenseDate = normalizeExpenseDate(dateRaw);

    let rowSum = 0;
    let foundExpense = false;
    for (let c = 4; c <= 24 && c < raw.length; c++) {
      const val = parseExpenseAmount(raw[c]);
      if (val !== null && val > 0) {
        rowSum += val;
        foundExpense = true;
      }
    }

    if (!expenseDate && !descRaw && !foundExpense) continue;

    const desc = descRaw || "Daily Operating Expense";
    const amount = Math.round(rowSum * 100) / 100;

    const issues: StagedExpenseValidationIssue[] = [];
    if (!expenseDate) issues.push({ field: "expenseDate", message: "Missing or invalid disbursement date." });
    if (amount <= 0) issues.push({ field: "amount", message: "No expense amounts recorded across disbursement columns." });

    rows.push({
      id: `disb-${r}-${crypto.randomUUID()}`,
      rowNumber: r + 1,
      expenseDate: expenseDate || "",
      description: desc,
      amount,
      category: "Operations",
      notes: "Daily disbursement expense",
      transactionType: "Outgoing",
      sourceSheet: "DISBURSEMENT (DAILY EXPENSE)",
      sourceRow: r + 1,
      sourceRef: null,
      status: issues.length > 0 ? "needs_attention" : "ready",
      issues,
    });
  }
  return rows;
}

/**
 * 3. COLLECTION (REVENUE) -> Incoming
 * Columns: B (DATE), C (TRUCKER/CLIENT), I (AMOUNT DUE, fallback F AMOUNT), K (SI REFERENCE)
 */
export function parseCollectionSheet(grid: unknown[][]): StagedExpenseRow[] {
  const rows: StagedExpenseRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r];
    if (!Array.isArray(raw)) continue;
    const dateRaw = raw[1];
    const client = String(raw[2] ?? "").trim();
    const amountDueRaw = raw[8];
    const amountRaw = raw[5];
    const siRef = String(raw[10] ?? "").trim();

    const expenseDate = normalizeExpenseDate(dateRaw);
    const amount = parseExpenseAmount(amountDueRaw) ?? parseExpenseAmount(amountRaw);
    if (!expenseDate && amount === null && !client) continue;

    const desc = client
      ? (siRef ? `${client} (SI: ${siRef})` : client)
      : (siRef ? `Collection SI: ${siRef}` : "Collection Revenue");

    const issues: StagedExpenseValidationIssue[] = [];
    if (!expenseDate) issues.push({ field: "expenseDate", message: "Missing or invalid collection date." });
    if (!amount || amount <= 0) issues.push({ field: "amount", message: "Missing or invalid collection amount." });
    if (!client && !siRef) issues.push({ field: "description", message: "Missing client/description." });

    rows.push({
      id: `col-${r}-${crypto.randomUUID()}`,
      rowNumber: r + 1,
      expenseDate: expenseDate || "",
      description: desc,
      amount: amount ?? 0,
      category: "Billing Revenue",
      notes: siRef ? `SI Reference #${siRef}` : "",
      transactionType: "Incoming",
      sourceSheet: "COLLECTION (REVENUE)",
      sourceRow: r + 1,
      sourceRef: siRef || null,
      status: issues.length > 0 ? "needs_attention" : "ready",
      issues,
    });
  }
  return rows;
}

/**
 * 4. PAYABLES (CREDITED_PAID) -> Outgoing
 * Columns: A (DATE OF BILLING), B (DATE OF PAYMENT), C (SI NO.), D (TRUCKER NAME), K (AMOUNT DUE), L (REMARKS)
 * Trucker carryover: If trucker name is empty, carry over from previous row.
 */
export function parsePayablesPaidSheet(grid: unknown[][]): StagedExpenseRow[] {
  const rows: StagedExpenseRow[] = [];
  let carriedTrucker = "";

  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r];
    if (!Array.isArray(raw)) continue;
    const billingDateRaw = raw[0];
    const paymentDateRaw = raw[1];
    const siNo = String(raw[2] ?? "").trim();
    const truckerRaw = String(raw[3] ?? "").trim();
    const amountDueRaw = raw[10];
    const remarks = String(raw[11] ?? "").trim();

    if (truckerRaw) carriedTrucker = truckerRaw;
    const trucker = carriedTrucker;

    const expenseDate = normalizeExpenseDate(paymentDateRaw) || normalizeExpenseDate(billingDateRaw);
    const amount = parseExpenseAmount(amountDueRaw);
    if (!expenseDate && amount === null && !trucker) continue;

    let desc = trucker || "Subcontracted Trucker Payable";
    if (siNo) desc += ` (SI: ${siNo})`;
    if (remarks) desc += ` - ${remarks}`;

    const issues: StagedExpenseValidationIssue[] = [];
    if (!expenseDate) issues.push({ field: "expenseDate", message: "Missing payment and billing date." });
    if (!amount || amount <= 0) issues.push({ field: "amount", message: "Missing or invalid payable amount." });
    if (!trucker) issues.push({ field: "description", message: "Missing trucker name." });

    rows.push({
      id: `pay-paid-${r}-${crypto.randomUUID()}`,
      rowNumber: r + 1,
      expenseDate: expenseDate || "",
      description: desc,
      amount: amount ?? 0,
      category: "Trucking Service",
      notes: remarks || (siNo ? `SI #${siNo}` : ""),
      transactionType: "Outgoing",
      sourceSheet: "PAYABLES (CREDITED_PAID)",
      sourceRow: r + 1,
      sourceRef: siNo || null,
      status: issues.length > 0 ? "needs_attention" : "ready",
      issues,
    });
  }
  return rows;
}

/**
 * 5. PAYABLES (NOT CREDITED) -> Outgoing
 * Title row at index 0 (["PAYABLES"]), Header row at index 1.
 * Columns: A (TRUCKER), B (DATE RECEIVED), D (DUE DATE), J (AMOUNT DUE), K (SI #), L (REMARKS)
 * Trucker carryover supported.
 */
export function parsePayablesNotCreditedSheet(grid: unknown[][]): StagedExpenseRow[] {
  const rows: StagedExpenseRow[] = [];
  let carriedTrucker = "";

  // Data starts at row index 2
  for (let r = 2; r < grid.length; r++) {
    const raw = grid[r];
    if (!Array.isArray(raw)) continue;
    const truckerRaw = String(raw[0] ?? "").trim();
    const dateReceivedRaw = raw[1];
    const dueDateRaw = raw[3];
    const amountDueRaw = raw[9];
    const siNo = String(raw[10] ?? "").trim();
    const remarks = String(raw[11] ?? "").trim();

    if (truckerRaw) carriedTrucker = truckerRaw;
    const trucker = carriedTrucker;

    const expenseDate = normalizeExpenseDate(dateReceivedRaw) || normalizeExpenseDate(dueDateRaw);
    const amount = parseExpenseAmount(amountDueRaw);
    if (!expenseDate && amount === null && !trucker) continue;

    let desc = trucker || "Subcontracted Trucker Payable";
    if (siNo) desc += ` (SI: ${siNo})`;
    if (remarks) desc += ` - ${remarks}`;

    const issues: StagedExpenseValidationIssue[] = [];
    if (!expenseDate) issues.push({ field: "expenseDate", message: "Missing received and due date." });
    if (!amount || amount <= 0) issues.push({ field: "amount", message: "Missing or invalid payable amount." });
    if (!trucker) issues.push({ field: "description", message: "Missing trucker name." });

    rows.push({
      id: `pay-nc-${r}-${crypto.randomUUID()}`,
      rowNumber: r + 1,
      expenseDate: expenseDate || "",
      description: desc,
      amount: amount ?? 0,
      category: "Trucking Service",
      notes: remarks || (siNo ? `SI #${siNo}` : ""),
      transactionType: "Outgoing",
      sourceSheet: "PAYABLES (NOT CREDITED)",
      sourceRow: r + 1,
      sourceRef: siNo || null,
      status: issues.length > 0 ? "needs_attention" : "ready",
      issues,
    });
  }
  return rows;
}

/**
 * 6. RECEIVABLES -> Incoming
 * Columns: A (BILLING REF), B (BILLING DATE), F (CLIENT), G (INVOICE NO.), L (AMOUNT DUE)
 */
export function parseReceivablesSheet(grid: unknown[][]): StagedExpenseRow[] {
  const rows: StagedExpenseRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r];
    if (!Array.isArray(raw)) continue;
    const billingRef = String(raw[0] ?? "").trim();
    const dateRaw = raw[1];
    const client = String(raw[5] ?? "").trim();
    const invNo = String(raw[6] ?? "").trim();
    const amountDueRaw = raw[11];

    const expenseDate = normalizeExpenseDate(dateRaw);
    const amount = parseExpenseAmount(amountDueRaw);
    if (!expenseDate && amount === null && !client) continue;

    let desc = client || "Receivable Customer";
    if (invNo) desc += ` (Inv: ${invNo})`;
    if (billingRef) desc += ` [${billingRef}]`;

    const issues: StagedExpenseValidationIssue[] = [];
    if (!expenseDate) issues.push({ field: "expenseDate", message: "Missing or invalid billing date." });
    if (!amount || amount <= 0) issues.push({ field: "amount", message: "Missing or invalid receivable amount." });
    if (!client) issues.push({ field: "description", message: "Missing client name." });

    rows.push({
      id: `rec-${r}-${crypto.randomUUID()}`,
      rowNumber: r + 1,
      expenseDate: expenseDate || "",
      description: desc,
      amount: amount ?? 0,
      category: "Billing Revenue",
      notes: billingRef || (invNo ? `Invoice #${invNo}` : ""),
      transactionType: "Incoming",
      sourceSheet: "RECEIVABLES",
      sourceRow: r + 1,
      sourceRef: invNo || billingRef || null,
      status: issues.length > 0 ? "needs_attention" : "ready",
      issues,
    });
  }
  return rows;
}

// =========================================================================
// Cross-Sheet & Cross-Batch Duplicate Detection
// =========================================================================

/**
 * Cross-sheet duplicate resolver:
 * Matches identical or linked records across sheets:
 * - Service Invoice vs Receivables on Invoice # / Ref and amount
 * - Service Invoice vs Collection on Invoice / SI Ref and amount
 * - Receivables vs Collection on Invoice # and amount
 * - Payables Paid vs Not Credited on SI # / Trucker and amount
 * - Payables vs Disbursement on date / amount
 * - Same-sheet duplicates (same date, amount, description)
 * - Existing RouteX system records (same date, amount, description)
 */
export function applyDuplicateDetection(
  stagedRows: StagedExpenseRow[],
  existingExpenses: readonly CompanyExpense[] = [],
): StagedExpenseRow[] {
  // 1. Existing RouteX record lookup
  const existingSet = new Set<string>();
  const existingRecordMap = new Map<string, CompanyExpense>();
  for (const exp of existingExpenses) {
    const key = `${exp.expenseDate}_${exp.amount.toFixed(2)}_${exp.description.toLowerCase().trim()}`;
    existingSet.add(key);
    existingRecordMap.set(key, exp);
  }

  // 2. Intra-batch duplicate tracking
  const seenExactKeys = new Map<string, StagedExpenseRow>();

  // Process rows
  for (const row of stagedRows) {
    if (row.status === "needs_attention") continue;

    const amtFormatted = typeof row.amount === "number" && !isNaN(row.amount) ? row.amount.toFixed(2) : "0.00";
    const exactKey = `${row.expenseDate}_${amtFormatted}_${row.description.toLowerCase().trim()}`;

    // A. Check against existing RouteX database records
    if (existingSet.has(exactKey)) {
      const match = existingRecordMap.get(exactKey);
      row.status = "duplicate";
      row.duplicateReason = "Matches an existing recorded transaction in RouteX.";
      row.duplicateMatchedWith = {
        source: "Existing RouteX Ledger",
        description: match?.description ?? row.description,
        amount: match?.amount ?? row.amount,
        date: match?.expenseDate ?? row.expenseDate,
      };
      row.issues.push({ field: "duplicate", message: row.duplicateReason });
      continue;
    }

    // B. Check against exact same row earlier in batch (same sheet or across sheets)
    if (seenExactKeys.has(exactKey)) {
      const earlier = seenExactKeys.get(exactKey)!;
      row.status = "duplicate";
      row.duplicateReason = `Identical transaction to Row ${earlier.rowNumber} (${earlier.sourceSheet ?? "this import"}).`;
      row.duplicateMatchedWith = {
        source: earlier.sourceSheet ?? `Row ${earlier.rowNumber}`,
        description: earlier.description,
        amount: earlier.amount,
        date: earlier.expenseDate,
      };
      row.issues.push({ field: "duplicate", message: row.duplicateReason });
      continue;
    }

    seenExactKeys.set(exactKey, row);
  }

  // 3. Cross-sheet business duplicate checks (SI vs Receivables vs Collection, Payables Paid vs Not Credited)
  for (let i = 0; i < stagedRows.length; i++) {
    const rowA = stagedRows[i];
    if (rowA.status === "duplicate" || rowA.status === "needs_attention") continue;

    for (let j = i + 1; j < stagedRows.length; j++) {
      const rowB = stagedRows[j];
      if (rowB.status === "duplicate" || rowB.status === "needs_attention") continue;
      if (rowA.sourceSheet === rowB.sourceSheet) continue;

      // Check matching amount
      const amountMatches = Math.abs(rowA.amount - rowB.amount) < 0.01;
      if (!amountMatches) continue;

      // Extract cleaned refs/inv
      const cleanRefA = (rowA.sourceRef || "").replace(/^RRLI2026-|^0+/i, "").trim().toLowerCase();
      const cleanRefB = (rowB.sourceRef || "").replace(/^RRLI2026-|^0+/i, "").trim().toLowerCase();
      const textA = `${rowA.sourceRef ?? ""} ${rowA.notes ?? ""} ${rowA.description ?? ""}`.toLowerCase();
      const textB = `${rowB.sourceRef ?? ""} ${rowB.notes ?? ""} ${rowB.description ?? ""}`.toLowerCase();

      let isCrossDuplicate = false;
      let reason = "";

      // Match A: Incoming billing cross-sheet match (Service Invoice vs Receivables vs Collection)
      if (rowA.transactionType === "Incoming" && rowB.transactionType === "Incoming") {
        const refMatches =
          (cleanRefA && cleanRefB && (cleanRefA === cleanRefB || cleanRefA.includes(cleanRefB) || cleanRefB.includes(cleanRefA))) ||
          (cleanRefA && textB.includes(cleanRefA)) ||
          (cleanRefB && textA.includes(cleanRefB));

        if (refMatches) {
          isCrossDuplicate = true;
          reason = `Linked billing invoice #${rowB.sourceRef ?? "ref"} matches ${rowA.sourceSheet} (Row ${rowA.rowNumber}).`;
        }
      }

      // Match B: Outgoing payables cross-sheet match (Payables Paid vs Payables Not Credited)
      if (rowA.transactionType === "Outgoing" && rowB.transactionType === "Outgoing") {
        const refMatches =
          (cleanRefA && cleanRefB && (cleanRefA === cleanRefB || cleanRefA.includes(cleanRefB) || cleanRefB.includes(cleanRefA))) ||
          (cleanRefA && textB.includes(cleanRefA)) ||
          (cleanRefB && textA.includes(cleanRefB));

        if (
          (rowA.sourceSheet?.includes("PAYABLES") && rowB.sourceSheet?.includes("PAYABLES")) &&
          refMatches
        ) {
          isCrossDuplicate = true;
          reason = `Subcontractor payable SI #${rowB.sourceRef ?? "ref"} already recorded in ${rowA.sourceSheet} (Row ${rowA.rowNumber}).`;
        }
      }

      if (isCrossDuplicate) {
        // Flag rowB as duplicate of rowA
        rowB.status = "duplicate";
        rowB.duplicateReason = reason;
        rowB.duplicateMatchedWith = {
          source: `${rowA.sourceSheet} (Row ${rowA.rowNumber})`,
          description: rowA.description,
          amount: rowA.amount,
          date: rowA.expenseDate,
        };
        rowB.issues.push({ field: "duplicate", message: reason });
      }
    }
  }

  return stagedRows;
}

/**
 * Master parser for Excel workbooks containing any or all 6 sheets.
 */
export function parseXlsxCompanyExpenseImport(
  buffer: ArrayBuffer | ArrayBufferLike | Uint8Array,
  existingExpenses: readonly CompanyExpense[] = [],
  sheetName?: string,
): ExpenseImportParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      return {
        rows: [],
        totalRawRows: 0,
        readyCount: 0,
        attentionCount: 0,
        duplicateCount: 0,
        incomingCount: 0,
        outgoingCount: 0,
        incomingTotal: 0,
        outgoingTotal: 0,
        errors: ["Excel workbook contains no sheets."],
        sheetNames: [],
      };
    }

    const detectedSheets = sheetNames.filter((s) =>
      KNOWN_FINANCE_SHEET_NAMES.some((k) => k.toLowerCase() === s.trim().toLowerCase()),
    );

    // If sheetName is "all" or omitted and workbook contains multiple known sheets, parse all
    const parseAll = sheetName === "all" || (!sheetName && detectedSheets.length > 1);

    let stagedRows: StagedExpenseRow[] = [];
    let totalRawRows = 0;

    if (parseAll) {
      // Parse all sheets in order
      for (const name of sheetNames) {
        const ws = workbook.Sheets[name];
        const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as unknown[][];
        totalRawRows += Math.max(0, grid.length - 1);

        const upper = name.trim().toUpperCase();
        if (upper.includes("SERVICE INVOICE")) {
          stagedRows.push(...parseServiceInvoiceSheet(grid));
        } else if (upper.includes("DISBURSEMENT")) {
          stagedRows.push(...parseDisbursementSheet(grid));
        } else if (upper.includes("COLLECTION")) {
          stagedRows.push(...parseCollectionSheet(grid));
        } else if (upper.includes("PAYABLES") && upper.includes("NOT CREDITED")) {
          stagedRows.push(...parsePayablesNotCreditedSheet(grid));
        } else if (upper.includes("PAYABLES")) {
          stagedRows.push(...parsePayablesPaidSheet(grid));
        } else if (upper.includes("RECEIVABLES")) {
          stagedRows.push(...parseReceivablesSheet(grid));
        } else {
          // Standard single-sheet fallback
          const standardResult = parseGridToStagedExpenses(grid, existingExpenses);
          stagedRows.push(
            ...standardResult.rows.map((r) => ({
              ...r,
              sourceSheet: name,
              transactionType: "Outgoing" as FinanceTransactionType,
            })),
          );
        }
      }
    } else {
      // Parse single selected sheet
      const targetSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
      const ws = workbook.Sheets[targetSheet];
      const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as unknown[][];
      totalRawRows = Math.max(0, grid.length - 1);

      const upper = targetSheet.trim().toUpperCase();
      if (upper.includes("SERVICE INVOICE")) {
        stagedRows = parseServiceInvoiceSheet(grid);
      } else if (upper.includes("DISBURSEMENT")) {
        stagedRows = parseDisbursementSheet(grid);
      } else if (upper.includes("COLLECTION")) {
        stagedRows = parseCollectionSheet(grid);
      } else if (upper.includes("PAYABLES") && upper.includes("NOT CREDITED")) {
        stagedRows = parsePayablesNotCreditedSheet(grid);
      } else if (upper.includes("PAYABLES")) {
        stagedRows = parsePayablesPaidSheet(grid);
      } else if (upper.includes("RECEIVABLES")) {
        stagedRows = parseReceivablesSheet(grid);
      } else {
        const standardResult = parseGridToStagedExpenses(grid, existingExpenses);
        stagedRows = standardResult.rows.map((r) => ({
          ...r,
          sourceSheet: targetSheet,
          transactionType: "Outgoing" as FinanceTransactionType,
        }));
      }
    }

    // Apply duplicate detection
    stagedRows = applyDuplicateDetection(stagedRows, existingExpenses);

    // Compute totals and counts
    let readyCount = 0;
    let attentionCount = 0;
    let duplicateCount = 0;
    let incomingCount = 0;
    let outgoingCount = 0;
    let incomingTotal = 0;
    let outgoingTotal = 0;

    for (const r of stagedRows) {
      if (r.status === "ready") readyCount++;
      else if (r.status === "needs_attention") attentionCount++;
      else if (r.status === "duplicate") duplicateCount++;

      if (r.transactionType === "Incoming") {
        incomingCount++;
        incomingTotal += r.amount;
      } else {
        outgoingCount++;
        outgoingTotal += r.amount;
      }
    }

    return {
      rows: stagedRows,
      totalRawRows,
      readyCount,
      attentionCount,
      duplicateCount,
      incomingCount,
      outgoingCount,
      incomingTotal: Math.round(incomingTotal * 100) / 100,
      outgoingTotal: Math.round(outgoingTotal * 100) / 100,
      errors: [],
      sheetNames,
      activeSheet: parseAll ? "all" : (sheetName || sheetNames[0]),
      detectedSheets,
    };
  } catch (error) {
    return {
      rows: [],
      totalRawRows: 0,
      readyCount: 0,
      attentionCount: 0,
      duplicateCount: 0,
      incomingCount: 0,
      outgoingCount: 0,
      incomingTotal: 0,
      outgoingTotal: 0,
      errors: [error instanceof Error ? error.message : "Failed to parse Excel workbook."],
      sheetNames: [],
    };
  }
}

/**
 * Parses grid rows into staged expenses (used by CSV and generic fallbacks).
 */
export function parseGridToStagedExpenses(
  grid: unknown[][],
  existingExpenses: readonly CompanyExpense[] = [],
): ExpenseImportParseResult {
  const errors: string[] = [];
  if (grid.length === 0) {
    return {
      rows: [],
      totalRawRows: 0,
      readyCount: 0,
      attentionCount: 0,
      duplicateCount: 0,
      incomingCount: 0,
      outgoingCount: 0,
      incomingTotal: 0,
      outgoingTotal: 0,
      errors: ["The uploaded file contains no data rows."],
    };
  }

  const detected = detectExpenseHeaders(grid);
  if (!detected) {
    return {
      rows: [],
      totalRawRows: grid.length,
      readyCount: 0,
      attentionCount: 0,
      duplicateCount: 0,
      incomingCount: 0,
      outgoingCount: 0,
      incomingTotal: 0,
      outgoingTotal: 0,
      errors: [
        "Could not detect expense headers. Please include columns for 'Date', 'Description', and 'Amount'.",
      ],
    };
  }

  const { headerRowIndex, map } = detected;
  const existingKeys = new Set(
    existingExpenses.map(
      (e) => `${e.expenseDate}_${e.amount.toFixed(2)}_${e.description.toLowerCase().trim()}`,
    ),
  );
  const seenKeysInBatch = new Set<string>();

  const stagedRows: StagedExpenseRow[] = [];

  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const rawRow = grid[r];
    if (!Array.isArray(rawRow) || rawRow.every((c) => c == null || String(c).trim() === "")) {
      continue;
    }

    const rawDate = map.dateCol >= 0 ? rawRow[map.dateCol] : "";
    const rawDesc = map.descriptionCol >= 0 ? rawRow[map.descriptionCol] : "";
    const rawAmount = map.amountCol >= 0 ? rawRow[map.amountCol] : null;
    const rawCategory = map.categoryCol >= 0 ? rawRow[map.categoryCol] : "";
    const rawNotes = map.notesCol >= 0 ? rawRow[map.notesCol] : "";

    const expenseDate = normalizeExpenseDate(rawDate);
    const description = String(rawDesc ?? "").trim() || "Total Company Expenses";
    const amount = parseExpenseAmount(rawAmount) ?? 0;
    const category = String(rawCategory ?? "").trim() || "General";
    const notes = String(rawNotes ?? "").trim();

    const rowItem: StagedExpenseRow = {
      id: `staged-${r}-${crypto.randomUUID()}`,
      rowNumber: r + 1,
      expenseDate,
      description,
      amount,
      category,
      notes,
      transactionType: "Outgoing",
      status: "ready",
      issues: [],
    };

    const validation = validateStagedExpenseRow(rowItem, existingKeys, seenKeysInBatch);
    rowItem.status = validation.status;
    rowItem.issues = validation.issues;

    stagedRows.push(rowItem);
  }

  const readyCount = stagedRows.filter((r) => r.status === "ready").length;
  const attentionCount = stagedRows.filter((r) => r.status === "needs_attention").length;
  const duplicateCount = stagedRows.filter((r) => r.status === "duplicate").length;
  const outgoingTotal = stagedRows.reduce((sum, r) => sum + r.amount, 0);

  return {
    rows: stagedRows,
    totalRawRows: grid.length - (headerRowIndex + 1),
    readyCount,
    attentionCount,
    duplicateCount,
    incomingCount: 0,
    outgoingCount: stagedRows.length,
    incomingTotal: 0,
    outgoingTotal: Math.round(outgoingTotal * 100) / 100,
    errors,
  };
}

/**
 * Parses a CSV / delimited text string.
 */
export function parseCsvCompanyExpenseImport(
  content: string,
  existingExpenses: readonly CompanyExpense[] = [],
): ExpenseImportParseResult {
  const grid = parseDelimitedText(content);
  return parseGridToStagedExpenses(grid, existingExpenses);
}

/**
 * Generates a clean Sample CSV template for company expenses.
 */
export function generateCompanyExpenseSampleCsv(): string {
  const headers = ["Date", "Description", "Amount", "Category", "Notes"];
  const rows = [
    ["2026-11-01", "Office Rent - Biñan Headquarters", "35000", "Facility & Rent", "Paid via bank transfer"],
    ["2026-11-03", "Depot Electricity & Utilities", "18450.75", "Utilities", "Meralco bill for October"],
    ["2026-11-05", "Warehouse Forklift Maintenance", "8200", "Maintenance & Repairs", "Periodic hydraulic service"],
    ["2026-11-10", "Quarterly Business Permits & Licenses", "12500", "Taxes & Licenses", "City Hall assessment fee"],
    ["2026-11-15", "Internet & Telecommunications", "4500", "Utilities", "Depot fiber connection"],
  ];

  return [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\r\n");
}

/**
 * Generates a clean Sample Excel workbook for company expenses.
 */
export function generateCompanyExpenseSampleXlsx(): Uint8Array {
  const headers = ["Date", "Description", "Amount", "Category", "Notes"];
  const data = [
    headers,
    ["2026-11-01", "Office Rent - Biñan Headquarters", 35000, "Facility & Rent", "Paid via bank transfer"],
    ["2026-11-03", "Depot Electricity & Utilities", 18450.75, "Utilities", "Meralco bill for October"],
    ["2026-11-05", "Warehouse Forklift Maintenance", 8200, "Maintenance & Repairs", "Periodic hydraulic service"],
    ["2026-11-10", "Quarterly Business Permits & Licenses", 12500, "Taxes & Licenses", "City Hall assessment fee"],
    ["2026-11-15", "Internet & Telecommunications", 4500, "Utilities", "Depot fiber connection"],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Company Expenses");

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbout);
}

/**
 * Generates an error report CSV for rejected rows.
 */
export function generateExpenseImportErrorReport(rows: StagedExpenseRow[]): string {
  const headers = ["Row", "Date", "Description", "Amount", "Type", "Sheet", "Status", "Issues"];
  const lines = [headers.join(",")];

  for (const r of rows) {
    if (r.status === "ready") continue;
    const issueList = r.issues.map((i) => `${i.field}: ${i.message}`).join("; ");
    lines.push(
      [
        r.rowNumber,
        `"${r.expenseDate}"`,
        `"${r.description.replace(/"/g, '""')}"`,
        r.amount,
        r.transactionType,
        `"${r.sourceSheet ?? ""}"`,
        r.status,
        `"${issueList.replace(/"/g, '""')}"`,
      ].join(","),
    );
  }

  return lines.join("\r\n");
}
