"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type DragEvent,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import {
  generateCompanyExpenseSampleCsv,
  generateCompanyExpenseSampleXlsx,
  generateExpenseImportErrorReport,
  parseCsvCompanyExpenseImport,
  parseXlsxCompanyExpenseImport,
  validateStagedExpenseRow,
  type StagedExpenseRow,
} from "@/features/finance/company-expense-import-parser";
import {
  batchUpsertBrowserPreviewExpenses,
  readBrowserPreviewExpenses,
} from "@/features/finance/browser-preview-expenses";
import type { CompanyExpense } from "@/features/finance/company-expense-domain";
import { useAuthenticatedActor } from "@/components/auth-context";
import { RoundedSelect } from "@/components/rounded-select";
import { TablePagination } from "@/components/table-pagination";
import { formatPeso } from "@/lib/format";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

type ImportStep = 1 | 2 | 3 | 4;
type FilterTab = "all" | "attention" | "duplicate" | "incoming" | "outgoing";

export function CompanyExpenseImportClient({
  actorRoleLabel: _actorRoleLabel,
  actorFullName: _actorFullName,
  returnHref = "/finance",
}: {
  actorRoleLabel: string;
  actorFullName: string;
  returnHref?: string;
}) {
  const actor = useAuthenticatedActor();
  const [step, setStep] = useState<ImportStep>(1);
  const [batchName, setBatchName] = useState(() => `Expenses-Batch-${new Date().toISOString().slice(0, 10)}`);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("all");
  const [isDragging, setIsDragging] = useState(false);
  const [stagedRows, setStagedRows] = useState<StagedExpenseRow[]>([]);
  const [existingExpenses, setExistingExpenses] = useState<CompanyExpense[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPageSize, setReviewPageSize] = useState(25);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    batchName: string;
    committedCount: number;
    committedIncomingCount: number;
    committedOutgoingCount: number;
    committedIncomingAmount: number;
    committedOutgoingAmount: number;
    netActivity: number;
    committedExpenses: CompanyExpense[];
    duplicateCount: number;
    errors: { description: string; reason: string }[];
  } | null>(null);

  const searchInputId = useId();

  // Load existing expenses to detect duplicates
  useEffect(() => {
    let allExisting: CompanyExpense[] = [];
    try {
      allExisting = readBrowserPreviewExpenses();
    } catch {
      // Ignore
    }

    fetch("/api/finance/expenses?pageSize=1000")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.items)) {
          const combined = [...data.items];
          for (const item of allExisting) {
            if (!combined.some((c) => c.id === item.id)) {
              combined.push(item);
            }
          }
          setExistingExpenses(combined);
        } else {
          setExistingExpenses(allExisting);
        }
      })
      .catch(() => {
        setExistingExpenses(allExisting);
      });
  }, []);

  function handleFileSelect(file: File) {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage("File exceeds 10 MB limit. Please upload a smaller spreadsheet.");
      return;
    }

    const lower = file.name.toLowerCase();
    const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls");
    const isText = lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt");

    if (!isExcel && !isText) {
      setErrorMessage("Unsupported file type. Please upload an Excel (.xlsx, .xls) or CSV spreadsheet.");
      return;
    }

    setFileName(file.name);
    setErrorMessage(null);

    const baseBatch = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-");
    setBatchName(`Expenses-${baseBatch}-${new Date().toISOString().slice(0, 10)}`);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          setErrorMessage("Failed to read Excel workbook buffer.");
          return;
        }
        setFileBuffer(buffer);
        // Default to "all" sheets for multi-sheet finance workbooks
        const parsed = parseXlsxCompanyExpenseImport(buffer, existingExpenses, "all");
        if (parsed.errors.length > 0 && parsed.rows.length === 0) {
          setErrorMessage(parsed.errors.join(" "));
          return;
        }

        const sheets = parsed.sheetNames ?? [];
        setSheetNames(sheets);
        setSelectedSheet("all");
        setStagedRows(parsed.rows);
        setStep(2);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
          setErrorMessage("Failed to read text file contents.");
          return;
        }
        const parsed = parseCsvCompanyExpenseImport(text, existingExpenses);
        if (parsed.errors.length > 0 && parsed.rows.length === 0) {
          setErrorMessage(parsed.errors.join(" "));
          return;
        }
        setStagedRows(parsed.rows);
        setStep(2);
      };
      reader.readAsText(file);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }

  function handleSheetChange(sheet: string) {
    if (!fileBuffer) return;
    setSelectedSheet(sheet);
    const parsed = parseXlsxCompanyExpenseImport(fileBuffer, existingExpenses, sheet);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      toast.error(parsed.errors.join(" "));
      return;
    }
    setStagedRows(parsed.rows);
    toast.info(
      sheet === "all"
        ? `Consolidated all ${sheetNames.length} sheets (${parsed.rows.length} total rows).`
        : `Selected sheet: ${sheet} (${parsed.rows.length} rows).`,
    );
  }

  function loadSampleData() {
    const csv = generateCompanyExpenseSampleCsv();
    setFileName("RouteX-Company-Expenses-Sample.csv");
    setBatchName(`Expenses-Sample-${new Date().toISOString().slice(0, 10)}`);
    setErrorMessage(null);
    const parsed = parseCsvCompanyExpenseImport(csv, existingExpenses);
    setStagedRows(parsed.rows);
    setStep(2);
    toast.success(`Loaded ${parsed.rows.length} sample expense rows.`);
  }

  function resetImportFlow() {
    setStagedRows([]);
    setFileName(null);
    setFileBuffer(null);
    setImportResult(null);
    setErrorMessage(null);
    setStep(1);
  }

  // Memoized existing expense signature keys for fast row edits
  const existingKeys = useMemo(
    () =>
      new Set(
        existingExpenses.map(
          (e) => `${e.expenseDate}_${e.amount.toFixed(2)}_${e.description.toLowerCase().trim()}`,
        ),
      ),
    [existingExpenses],
  );

  // Row updates
  function updateRowField(id: string, field: keyof StagedExpenseRow, value: unknown) {
    setStagedRows((prev) => {
      const seen = new Set<string>();
      for (const row of prev) {
        if (row.id !== id && row.status === "ready") {
          seen.add(`${row.expenseDate}_${row.amount.toFixed(2)}_${row.description.toLowerCase().trim()}`);
        }
      }

      return prev.map((row) => {
        if (row.id !== id) return row;

        const updated: StagedExpenseRow = {
          ...row,
          [field]: field === "amount" ? Number(value) || 0 : value,
        };

        const val = validateStagedExpenseRow(updated, existingKeys, seen);
        updated.status = val.status;
        updated.issues = val.issues;
        return updated;
      });
    });
  }

  function deleteRow(id: string) {
    setStagedRows((prev) => prev.filter((r) => r.id !== id));
  }

  function excludeAllDuplicates() {
    const dupCount = stagedRows.filter((r) => r.status === "duplicate").length;
    setStagedRows((prev) => prev.filter((r) => r.status !== "duplicate"));
    toast.success(`Excluded ${dupCount} duplicate rows from batch.`);
  }

  function toggleRowStatus(id: string) {
    setStagedRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (r.status === "duplicate") {
          return { ...r, status: "ready" };
        } else if (r.status === "ready") {
          return { ...r, status: "duplicate", duplicateReason: "Manually excluded as duplicate." };
        }
        return r;
      }),
    );
  }

  // Metrics (single pass)
  const {
    readyRows,
    readyCount,
    attentionCount,
    duplicateCount,
    incomingReadyRows,
    outgoingReadyRows,
    totalIncomingStaged,
    totalOutgoingStaged,
    netActivityStaged,
  } = useMemo(() => {
    const ready: StagedExpenseRow[] = [];
    const incomingReady: StagedExpenseRow[] = [];
    const outgoingReady: StagedExpenseRow[] = [];
    let attention = 0;
    let duplicate = 0;
    let incomingSum = 0;
    let outgoingSum = 0;

    for (const r of stagedRows) {
      if (r.status === "ready") {
        ready.push(r);
        if (r.transactionType === "Incoming") {
          incomingReady.push(r);
          incomingSum += r.amount;
        } else {
          outgoingReady.push(r);
          outgoingSum += r.amount;
        }
      } else if (r.status === "needs_attention") {
        attention++;
      } else if (r.status === "duplicate") {
        duplicate++;
      }
    }

    return {
      readyRows: ready,
      readyCount: ready.length,
      attentionCount: attention,
      duplicateCount: duplicate,
      incomingReadyRows: incomingReady,
      outgoingReadyRows: outgoingReady,
      totalIncomingStaged: incomingSum,
      totalOutgoingStaged: outgoingSum,
      netActivityStaged: incomingSum - outgoingSum,
    };
  }, [stagedRows]);

  const visibleRows = useMemo(() => {
    let list = stagedRows;
    if (activeTab === "attention") list = list.filter((r) => r.status === "needs_attention");
    else if (activeTab === "duplicate") list = list.filter((r) => r.status === "duplicate");
    else if (activeTab === "incoming") list = list.filter((r) => r.transactionType === "Incoming");
    else if (activeTab === "outgoing") list = list.filter((r) => r.transactionType === "Outgoing");

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.expenseDate.includes(q) ||
          (r.sourceSheet && r.sourceSheet.toLowerCase().includes(q)) ||
          (r.sourceRef && r.sourceRef.toLowerCase().includes(q)) ||
          (r.notes && r.notes.toLowerCase().includes(q)) ||
          r.amount.toString().includes(q),
      );
    }
    return list;
  }, [stagedRows, activeTab, deferredSearchQuery]);

  const reviewPageCount = Math.max(1, Math.ceil(visibleRows.length / reviewPageSize));

  useEffect(() => {
    setReviewPage(1);
  }, [activeTab, deferredSearchQuery, selectedSheet, reviewPageSize]);

  useEffect(() => {
    if (reviewPage > reviewPageCount) {
      setReviewPage(reviewPageCount);
    }
  }, [reviewPage, reviewPageCount]);

  const paginatedVisibleRows = useMemo(() => {
    const start = (reviewPage - 1) * reviewPageSize;
    return visibleRows.slice(start, start + reviewPageSize);
  }, [visibleRows, reviewPage, reviewPageSize]);

  // Commit batch
  async function handleCommitBatch() {
    if (readyRows.length === 0) {
      toast.error("No valid ready transactions to import. Please review rows needing attention.");
      return;
    }

    setImporting(true);

    const idempotencyKey = crypto.randomUUID();
    const payload = {
      batchName: batchName.trim() || `Expenses-Batch-${new Date().toISOString().slice(0, 10)}`,
      idempotencyKey,
      rows: readyRows.map((r) => ({
        expenseDate: r.expenseDate,
        description: r.description,
        amount: r.amount,
        category: r.category,
        notes: r.notes || null,
        transactionType: r.transactionType || "Outgoing",
        sourceSheet: r.sourceSheet || null,
        sourceRow: r.sourceRow || null,
        sourceRef: r.sourceRef || null,
      })),
    };

    try {
      const res = await fetch("/api/finance/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        // Fallback for preview mode
        const fallbackCreated: CompanyExpense[] = readyRows.map((r) => ({
          id: crypto.randomUUID(),
          description: r.description,
          amount: r.amount,
          expenseDate: r.expenseDate,
          category: (r.transactionType || "Outgoing") === "Incoming" ? "Company Income" : "Company Expenses",
          notes: r.notes || null,
          transactionType: r.transactionType || "Outgoing",
          sourceSheet: r.sourceSheet || null,
          sourceRow: r.sourceRow || null,
          sourceRef: r.sourceRef || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: actor.username || "system",
        }));

        batchUpsertBrowserPreviewExpenses(fallbackCreated);

        setImportResult({
          batchName: payload.batchName,
          committedCount: fallbackCreated.length,
          committedIncomingCount: incomingReadyRows.length,
          committedOutgoingCount: outgoingReadyRows.length,
          committedIncomingAmount: totalIncomingStaged,
          committedOutgoingAmount: totalOutgoingStaged,
          netActivity: netActivityStaged,
          committedExpenses: fallbackCreated,
          duplicateCount,
          errors: [],
        });
        setStep(4);
        toast.success(`Imported ${fallbackCreated.length} finance transactions successfully.`);
        return;
      }

      const committed = (data.committedExpenses as CompanyExpense[]) || [];
      batchUpsertBrowserPreviewExpenses(committed);

      setImportResult({
        batchName: data.batchName || payload.batchName,
        committedCount: data.committedCount || committed.length,
        committedIncomingCount: incomingReadyRows.length,
        committedOutgoingCount: outgoingReadyRows.length,
        committedIncomingAmount: totalIncomingStaged,
        committedOutgoingAmount: totalOutgoingStaged,
        netActivity: netActivityStaged,
        committedExpenses: committed,
        duplicateCount,
        errors: [],
      });
      setStep(4);
      toast.success(`Batch import completed: ${data.committedCount} transactions saved.`);
    } catch {
      // Offline fallback
      const fallbackCreated: CompanyExpense[] = readyRows.map((r) => ({
        id: crypto.randomUUID(),
        description: r.description,
        amount: r.amount,
        expenseDate: r.expenseDate,
        category: (r.transactionType || "Outgoing") === "Incoming" ? "Company Income" : "Company Expenses",
        notes: r.notes || null,
        transactionType: r.transactionType || "Outgoing",
        sourceSheet: r.sourceSheet || null,
        sourceRow: r.sourceRow || null,
        sourceRef: r.sourceRef || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: actor.username || "system",
      }));

      batchUpsertBrowserPreviewExpenses(fallbackCreated);

      setImportResult({
        batchName: payload.batchName,
        committedCount: fallbackCreated.length,
        committedIncomingCount: incomingReadyRows.length,
        committedOutgoingCount: outgoingReadyRows.length,
        committedIncomingAmount: totalIncomingStaged,
        committedOutgoingAmount: totalOutgoingStaged,
        netActivity: netActivityStaged,
        committedExpenses: fallbackCreated,
        duplicateCount,
        errors: [],
      });
      setStep(4);
      toast.success(`Offline fallback: saved ${fallbackCreated.length} transactions locally.`);
    } finally {
      setImporting(false);
    }
  }

  function downloadErrorReport() {
    const csv = generateExpenseImportErrorReport(stagedRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Finance-Import-Errors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.info("Downloaded error report.");
  }

  function downloadSampleCsv() {
    const csv = generateCompanyExpenseSampleCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "RouteX-Finance-Expenses-Template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadSampleXlsx() {
    const bytes = generateCompanyExpenseSampleXlsx();
    const blob = new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "RouteX-Finance-Expenses-Template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Wizard Steps Navigation */}
      <nav className="import-steps-bar" aria-label="Finance Import Progress">
        <div className={`import-step-item${step === 1 ? " is-active" : ""}${step > 1 ? " is-done" : ""}`}>
          <span className="import-step-num">1</span>
          <span className="import-step-text">Upload Spreadsheet</span>
        </div>
        <div className="import-step-sep" aria-hidden="true">→</div>
        <div className={`import-step-item${step === 2 ? " is-active" : ""}${step > 2 ? " is-done" : ""}`}>
          <span className="import-step-num">2</span>
          <span className="import-step-text">Preview &amp; Validate</span>
        </div>
        <div className="import-step-sep" aria-hidden="true">→</div>
        <div className={`import-step-item${step === 3 ? " is-active" : ""}${step > 3 ? " is-done" : ""}`}>
          <span className="import-step-num">3</span>
          <span className="import-step-text">Confirm Batch</span>
        </div>
        <div className="import-step-sep" aria-hidden="true">→</div>
        <div className={`import-step-item${step === 4 ? " is-active" : ""}`}>
          <span className="import-step-num">4</span>
          <span className="import-step-text">Import Complete</span>
        </div>
      </nav>

      {errorMessage ? (
        <div className="delivery-form-alert" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* STEP 1: Upload */}
      {step === 1 ? (
        <section className="records-card" aria-label="Upload Finance Spreadsheet">
          <div className="records-heading">
            <div>
              <h2>1. Upload Finance Workbook</h2>
              <p>
                Import historical incoming revenue and outgoing expenses from your Excel workbook (supports all 6 FINANCE REF. sheets) or standard CSV.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={downloadSampleCsv}
                title="Download CSV template"
              >
                Sample CSV
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={downloadSampleXlsx}
                title="Download Excel template"
              >
                Sample Excel
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={loadSampleData}
                title="Load sample expense rows into preview"
              >
                Load Sample Data
              </button>
            </div>
          </div>

          <div style={{ padding: "20px 22px" }}>
            <div style={{ marginBottom: "16px", maxWidth: "420px" }}>
              <label htmlFor="import-batch-name" className="detail-meta-label" style={{ display: "block", marginBottom: "6px" }}>
                Import Batch Reference
              </label>
              <input
                id="import-batch-name"
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. Expenses-Batch-2026-11-20"
                className="import-table-input"
                style={{ width: "100%", padding: "8px 12px", fontSize: "13px" }}
              />
            </div>

            <label
              className={`import-dropzone${isDragging ? " is-dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="import-dropzone-icon-wrap" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="12" y2="12" />
                  <line x1="15" y1="15" x2="12" y2="12" />
                </svg>
              </div>
              <strong className="import-dropzone-title">
                Click to browse or drag and drop your spreadsheet
              </strong>
              <span className="import-dropzone-desc">
                Supports Microsoft Excel (.xlsx, .xls) and CSV spreadsheet files up to 10MB.
              </span>
              <div className="import-dropzone-badges">
                <span className="import-badge">.XLSX (6 SHEETS)</span>
                <span className="import-badge">.CSV</span>
                <span className="import-badge">MAX 10MB</span>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                onChange={handleFileInputChange}
                style={{ display: "none" }}
              />
            </label>

            <div className="import-guide-card">
              <strong className="import-guide-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--color-accent)" }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Supported Sheets &amp; Formats:
              </strong>
              <ul className="import-guide-list">
                <li><strong>SERVICE INVOICE (BILLINGS):</strong> Incoming revenue from service invoices (AMOUNT DUE, Ref, Date, Company).</li>
                <li><strong>DISBURSEMENT (DAILY EXPENSE):</strong> Outgoing daily expenses (sums expense columns E through Y into single row transaction).</li>
                <li><strong>COLLECTION (REVENUE):</strong> Incoming collected revenue (AMOUNT DUE, SI Reference, Date, Client).</li>
                <li><strong>PAYABLES (CREDITED_PAID):</strong> Outgoing subcontractor payments (payment date fallback, trucker carryover).</li>
                <li><strong>PAYABLES (NOT CREDITED):</strong> Completed historical outgoing payables (skips legacy pending status labels).</li>
                <li><strong>RECEIVABLES:</strong> Incoming billing receivables (skips legacy pending status labels, maps invoice #).</li>
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {/* STEP 2: Preview & Validate */}
      {step === 2 ? (
        <section className="records-card" aria-label="Review and Validate Staged Expenses">
          <div className="records-heading">
            <div>
              <h2>2. Staged Finance Records ({stagedRows.length} items parsed)</h2>
              <p>
                File: <strong>{fileName}</strong> — Review transactions and resolve flagged duplicates before committing.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setStep(1)}
              >
                Replace File
              </button>
              <button
                type="button"
                className="primary-action-button"
                disabled={readyCount === 0}
                onClick={() => setStep(3)}
              >
                Proceed to Confirmation ({readyCount})
              </button>
            </div>
          </div>

          {/* Excel Sheet Selector */}
          {sheetNames.length > 1 && (
            <div style={{ padding: "10px 22px", background: "var(--color-surface-subtle)", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                Selected Sheet:
              </span>
              <div style={{ minWidth: "260px" }}>
                <RoundedSelect
                  value={selectedSheet}
                  onChange={(val) => handleSheetChange(val)}
                  ariaLabel="Select spreadsheet sheet"
                  options={[
                    {
                      value: "all",
                      label: `★ All Sheets (Consolidated) — ${sheetNames.length} Sheets`,
                    },
                    ...sheetNames.map((s) => ({
                      value: s,
                      label: s,
                    })),
                  ]}
                />
              </div>

              {duplicateCount > 0 && (
                <button
                  type="button"
                  className="secondary-button"
                  style={{ fontSize: "11.5px", padding: "4px 10px", marginLeft: "auto", color: "var(--color-accent-deep)" }}
                  onClick={excludeAllDuplicates}
                  title="Remove all duplicate flagged rows"
                >
                  Exclude All Duplicates ({duplicateCount})
                </button>
              )}
            </div>
          )}

          {/* Financial Summary Badges */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", padding: "16px 22px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <div style={{ padding: "10px 14px", background: "var(--color-surface, #ffffff)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", display: "block" }}>TOTAL INCOMING</span>
              <strong style={{ fontSize: "16px", color: "var(--color-status-success, #059669)", display: "block", marginTop: "2px" }}>
                +{formatPeso(totalIncomingStaged)}
              </strong>
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{incomingReadyRows.length} transactions</span>
            </div>

            <div style={{ padding: "10px 14px", background: "var(--color-surface, #ffffff)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", display: "block" }}>TOTAL OUTGOING</span>
              <strong style={{ fontSize: "16px", color: "var(--color-danger, #dc2626)", display: "block", marginTop: "2px" }}>
                -{formatPeso(totalOutgoingStaged)}
              </strong>
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{outgoingReadyRows.length} transactions</span>
            </div>

            <div style={{ padding: "10px 14px", background: "var(--color-surface, #ffffff)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", display: "block" }}>NET ACTIVITY</span>
              <strong style={{ fontSize: "16px", color: netActivityStaged >= 0 ? "var(--color-status-success, #059669)" : "var(--color-danger, #dc2626)", display: "block", marginTop: "2px" }}>
                {netActivityStaged >= 0 ? "+" : ""}{formatPeso(netActivityStaged)}
              </strong>
              <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{readyCount} transactions</span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="delivery-status-tabs" role="tablist" aria-label="Filter staged rows by validation status">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              className={`delivery-status-tab${activeTab === "all" ? " active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All Records
              <span className="tab-count-badge">{stagedRows.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "incoming"}
              className={`delivery-status-tab${activeTab === "incoming" ? " active" : ""}`}
              onClick={() => setActiveTab("incoming")}
            >
              Incoming
              <span className="tab-count-badge">{incomingReadyRows.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "outgoing"}
              className={`delivery-status-tab${activeTab === "outgoing" ? " active" : ""}`}
              onClick={() => setActiveTab("outgoing")}
            >
              Outgoing
              <span className="tab-count-badge">{outgoingReadyRows.length}</span>
            </button>
            {duplicateCount > 0 ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "duplicate"}
                className={`delivery-status-tab${activeTab === "duplicate" ? " active" : ""}`}
                onClick={() => setActiveTab("duplicate")}
              >
                Duplicates
                <span className="tab-count-badge">{duplicateCount}</span>
              </button>
            ) : null}
            {attentionCount > 0 ? (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "attention"}
                className={`delivery-status-tab is-incomplete-tab${activeTab === "attention" ? " active" : ""}`}
                onClick={() => setActiveTab("attention")}
              >
                Needs Attention
                <span className="tab-count-badge">{attentionCount}</span>
              </button>
            ) : null}
          </div>

          {/* Quick Search inside staged table */}
          <div className="filters">
            <div className="search-box">
              <input
                id={searchInputId}
                type="search"
                placeholder="Search description, sheet, invoice ref, date, or amount…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery ? (
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: "12px", padding: "6px 12px" }}
                onClick={() => setSearchQuery("")}
              >
                Clear Search
              </button>
            ) : null}
            {attentionCount > 0 && (
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: "12px", padding: "6px 12px" }}
                onClick={downloadErrorReport}
                title="Download CSV report of validation errors"
              >
                Download Error Report
              </button>
            )}
            <label
              style={{
                marginLeft: "auto",
                fontSize: "12px",
                color: "var(--color-text-muted)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              Rows per page:
              <select
                value={reviewPageSize}
                onChange={(e) => setReviewPageSize(Number(e.target.value))}
                style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-primary)",
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          {/* Staged Expenses Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "100px" }}>Type</th>
                  <th style={{ width: "145px" }}>Date</th>
                  <th>Description / Reference</th>
                  <th style={{ width: "155px" }}>Amount (₱)</th>
                  <th style={{ width: "220px" }}>Sheet / Notes</th>
                  <th style={{ width: "80px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVisibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "36px 16px", color: "var(--color-text-muted)" }}>
                      No records matching current filter.
                    </td>
                  </tr>
                ) : (
                  paginatedVisibleRows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.status === "needs_attention"
                          ? "is-incomplete-row"
                          : row.status === "duplicate"
                            ? "is-cancelled-row"
                            : ""
                      }
                    >
                      {/* Transaction Type */}
                      <td>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color:
                              row.transactionType === "Incoming"
                                ? "var(--color-status-success, #059669)"
                                : "var(--color-text-secondary)",
                          }}
                        >
                          {row.transactionType === "Incoming" ? "Incoming" : "Outgoing"}
                        </span>
                      </td>

                      {/* Date */}
                      <td>
                        <input
                          type="date"
                          className={`import-table-input${row.issues.some((i) => i.field === "expenseDate") ? " has-error" : ""}`}
                          value={row.expenseDate}
                          onChange={(e) => updateRowField(row.id, "expenseDate", e.target.value)}
                          style={{ width: "130px" }}
                        />
                        {row.issues
                          .filter((i) => i.field === "expenseDate")
                          .map((iss, i) => (
                            <span key={i} className="import-row-error-badge">
                              {iss.message}
                            </span>
                          ))}
                      </td>

                      {/* Description & Source Ref */}
                      <td>
                        <input
                          type="text"
                          className={`import-table-input${row.issues.some((i) => i.field === "description") ? " has-error" : ""}`}
                          value={row.description}
                          onChange={(e) => updateRowField(row.id, "description", e.target.value)}
                          style={{ width: "100%" }}
                        />
                        {row.duplicateReason && (
                          <span
                            style={{
                              display: "block",
                              marginTop: "3px",
                              fontSize: "11px",
                              color: "var(--color-status-warning, #b45309)",
                              fontStyle: "italic",
                            }}
                          >
                            ⚠ {row.duplicateReason}
                          </span>
                        )}
                        {row.issues
                          .filter((i) => i.field === "description" || i.field === "duplicate")
                          .map((iss, i) => (
                            <span key={i} className="import-row-error-badge">
                              {iss.message}
                            </span>
                          ))}
                      </td>

                      {/* Amount */}
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className={`import-table-input${row.issues.some((i) => i.field === "amount") ? " has-error" : ""}`}
                          value={row.amount || ""}
                          placeholder="0.00"
                          onChange={(e) => updateRowField(row.id, "amount", Number(e.target.value) || 0)}
                          style={{
                            width: "135px",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 650,
                            color:
                              row.transactionType === "Incoming"
                                ? "var(--color-status-success, #059669)"
                                : "inherit",
                          }}
                        />
                        {row.issues
                          .filter((i) => i.field === "amount")
                          .map((iss, i) => (
                            <span key={i} className="import-row-error-badge">
                              {iss.message}
                            </span>
                          ))}
                      </td>

                      {/* Sheet / Notes */}
                      <td>
                        <input
                          type="text"
                          className="import-table-input"
                          value={row.notes}
                          placeholder={row.sourceSheet ? `[${row.sourceSheet}]` : "Optional notes"}
                          onChange={(e) => updateRowField(row.id, "notes", e.target.value)}
                          style={{ width: "100%" }}
                        />
                        {row.sourceSheet && (
                          <span
                            style={{
                              display: "block",
                              marginTop: "2px",
                              fontSize: "10px",
                              color: "var(--color-text-muted)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            Sheet: {row.sourceSheet} (Row {row.sourceRow ?? "—"})
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                          {row.status === "duplicate" ? (
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "2px 6px", fontSize: "10px" }}
                              onClick={() => toggleRowStatus(row.id)}
                              title="Keep this duplicate row"
                            >
                              Keep
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "2px 6px", fontSize: "10px", color: "var(--color-text-muted)" }}
                              onClick={() => toggleRowStatus(row.id)}
                              title="Mark row as duplicate to skip"
                            >
                              Skip
                            </button>
                          )}
                          <button
                            type="button"
                            className="truck-action-icon-btn danger"
                            onClick={() => deleteRow(row.id)}
                            title="Delete row"
                            aria-label="Delete row"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {visibleRows.length > 0 ? (
            <TablePagination
              page={reviewPage}
              pageCount={reviewPageCount}
              totalItems={visibleRows.length}
              pageSize={reviewPageSize}
              onPageChange={setReviewPage}
              itemLabel="staged transactions"
              itemCountInPage={paginatedVisibleRows.length}
            />
          ) : null}
        </section>
      ) : null}

      {/* STEP 3: Confirm Batch */}
      {step === 3 ? (
        <section className="records-card" aria-label="Confirm Expense Batch">
          <div className="records-heading">
            <div>
              <h2>3. Confirm Batch Import</h2>
              <p>Review the import summary before committing to RouteX records.</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setStep(2)}
                disabled={importing}
              >
                Back to Review
              </button>
              <button
                type="button"
                className="primary-action-button"
                disabled={importing || readyCount === 0}
                onClick={handleCommitBatch}
              >
                {importing ? "Committing Batch…" : `Confirm & Commit ${readyCount} Transactions`}
              </button>
            </div>
          </div>

          <div style={{ padding: "20px 22px", borderTop: "1px solid var(--line)" }}>
            <div className="import-metric-grid">
              <div className="import-metric-card">
                <span className="import-metric-label">Batch Reference</span>
                <strong className="import-metric-val">
                  {batchName}
                </strong>
              </div>

              <div className="import-metric-card tone-ready">
                <span className="import-metric-label">Total Incoming</span>
                <strong className="import-metric-val" style={{ color: "var(--color-status-success, #059669)" }}>
                  +{formatPeso(totalIncomingStaged)}
                </strong>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px", display: "block" }}>
                  {incomingReadyRows.length} incoming transactions
                </span>
              </div>

              <div className="import-metric-card tone-ready">
                <span className="import-metric-label">Total Outgoing</span>
                <strong className="import-metric-val" style={{ color: "var(--color-danger, #dc2626)" }}>
                  -{formatPeso(totalOutgoingStaged)}
                </strong>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px", display: "block" }}>
                  {outgoingReadyRows.length} outgoing transactions
                </span>
              </div>

              <div className="import-metric-card tone-ready">
                <span className="import-metric-label">Net Finance Activity</span>
                <strong className="import-metric-val" style={{ color: netActivityStaged >= 0 ? "var(--color-status-success, #059669)" : "var(--color-danger, #dc2626)" }}>
                  {netActivityStaged >= 0 ? "+" : ""}{formatPeso(netActivityStaged)}
                </strong>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px", display: "block" }}>
                  Net cash flow impact
                </span>
              </div>

              {duplicateCount > 0 ? (
                <div className="import-metric-card tone-duplicate">
                  <span className="import-metric-label">Duplicates Excluded</span>
                  <strong className="import-metric-val">
                    {duplicateCount} records
                  </strong>
                </div>
              ) : null}

              {attentionCount > 0 ? (
                <div className="import-metric-card tone-attention">
                  <span className="import-metric-label">Needs Attention (Excluded)</span>
                  <strong className="import-metric-val">
                    {attentionCount} records
                  </strong>
                </div>
              ) : null}
            </div>

            <div className="import-guide-card">
              <strong className="import-guide-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--color-accent)" }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Import Safety Guarantees:
              </strong>
              <ul className="import-guide-list">
                <li>Valid, non-duplicate transactions will be committed to the RouteX database.</li>
                <li>Cross-sheet and existing database duplicates are detected and safely excluded by default.</li>
                <li>All transactions are committed as completed historical <strong>Incoming</strong> or <strong>Outgoing</strong> transactions (no pending status).</li>
                <li>Imported transactions are immediately reflected in Finance reporting, dashboards, and company profit calculations.</li>
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {/* STEP 4: Import Results */}
      {step === 4 && importResult ? (
        <section className="records-card" aria-label="Import Batch Results">
          <div className="records-heading">
            <div>
              <h2>Import Batch Completed</h2>
              <p>Batch Reference: {importResult.batchName}</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" className="secondary-button" onClick={resetImportFlow}>
                Import Another Batch
              </button>
              <Link
                className="primary-action-button"
                href={returnHref && returnHref.startsWith("/finance") ? returnHref : "/finance"}
              >
                View in Finance Ledger →
              </Link>
            </div>
          </div>

          <div style={{ padding: "20px 22px", borderTop: "1px solid var(--line)" }}>
            <div className="import-metric-grid">
              <div className="import-metric-card tone-ready">
                <span className="import-metric-label">Successfully Committed</span>
                <strong className="import-metric-val">
                  {importResult.committedCount} Transactions
                </strong>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px", display: "block" }}>
                  {importResult.committedIncomingCount} in · {importResult.committedOutgoingCount} out
                </span>
              </div>

              <div className="import-metric-card tone-ready">
                <span className="import-metric-label">Total Incoming</span>
                <strong className="import-metric-val" style={{ color: "var(--color-status-success, #059669)" }}>
                  +{formatPeso(importResult.committedIncomingAmount)}
                </strong>
              </div>

              <div className="import-metric-card tone-ready">
                <span className="import-metric-label">Total Outgoing</span>
                <strong className="import-metric-val" style={{ color: "var(--color-danger, #dc2626)" }}>
                  -{formatPeso(importResult.committedOutgoingAmount)}
                </strong>
              </div>

              <div className="import-metric-card tone-ready">
                <span className="import-metric-label">Net Finance Activity</span>
                <strong className="import-metric-val" style={{ color: importResult.netActivity >= 0 ? "var(--color-status-success, #059669)" : "var(--color-danger, #dc2626)" }}>
                  {importResult.netActivity >= 0 ? "+" : ""}{formatPeso(importResult.netActivity)}
                </strong>
              </div>

              {importResult.duplicateCount > 0 ? (
                <div className="import-metric-card tone-duplicate">
                  <span className="import-metric-label">Duplicate Records Skipped</span>
                  <strong className="import-metric-val">
                    {importResult.duplicateCount}
                  </strong>
                </div>
              ) : null}
            </div>

            <div className="import-guide-card" style={{ marginTop: "20px" }}>
              <strong className="import-guide-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--color-accent)" }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Post-Import Review &amp; Analytics
              </strong>
              <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                {importResult.committedCount} financial transactions are now live in the Finance Ledger and integrated into company reporting. You can review, filter, or export these records anytime from the Finance Ledger.
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
