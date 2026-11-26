"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, FileSpreadsheet, FileCode2, Database, Globe, Download, Send, Check, X, RotateCcw, Archive, Upload } from "lucide-react";

import { useSearchBuffer } from "@/components/search-buffer";
import {
  parseDateValue,
  presetRange,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import type { useAuthenticatedActor } from "@/components/auth-context";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import type { CompanyExpense } from "@/features/finance/company-expense-domain";
import {
  activateArchiveMachineSnapshot,
  type ArchiveMachineSnapshot,
  clearArchiveMachineSnapshot,
  parseArchiveMachineText,
  parseArchiveMachineWorkbook,
  readArchiveMachineSnapshot,
  ROUTEX_ARCHIVE_MACHINE_CHANGED,
} from "@/features/archive/archive-machine";
import {
  buildScopedExportPayload,
  canAccessDataExportTab,
  canApproveDataExports,
  canDownloadExportRequest,
  canRequestDataExports,
  createDataExportRequest,
  readExportRequests,
  reviewDataExportRequest,
  ROUTEX_EXPORT_REQUESTS_CHANGED,
  triggerExportPackageDownload,
  type DataExportPackageType,
  type DataExportRequest,
} from "@/features/reports/data-export-engine";

export interface ReportsDataExportTabProps {
  actor: ReturnType<typeof useAuthenticatedActor>;
  allDeliveries: readonly DeliveryLedgerItem[];
  allCompanyExpenses: readonly CompanyExpense[];
  dateFrom: string | null;
  dateTo: string | null;
  periodLabel: string;
  dateRangePicker?: React.ReactNode;
}

const PACKAGE_ORDER: readonly DataExportPackageType[] = [
  "datasets_xlsx",
  "datasets_csv",
  "database_json",
  "database_sql",
  "website_recreation",
];

const SIMPLIFIED_PACKAGES: Record<
  DataExportPackageType,
  {
    title: string;
    description: string;
    ext: string;
    icon: (size?: number) => React.ReactNode;
  }
> = {
  datasets_xlsx: {
    title: "Excel Workbook",
    description: "Deliveries, store drop-offs, truck profitability, and expenses.",
    ext: "xlsx",
    icon: (size = 18) => <Table size={size} strokeWidth={1.8} aria-hidden="true" />,
  },
  datasets_csv: {
    title: "CSV Spreadsheets",
    description: "Deliveries, stores, trucks, and expenses in comma-separated format.",
    ext: "csv",
    icon: (size = 18) => <FileSpreadsheet size={size} strokeWidth={1.8} aria-hidden="true" />,
  },
  database_json: {
    title: "JSON Database",
    description: "Structured JSON dump of all records, foreign keys, and tables.",
    ext: "json",
    icon: (size = 18) => <FileCode2 size={size} strokeWidth={1.8} aria-hidden="true" />,
  },
  database_sql: {
    title: "SQL Database Dump",
    description: "Portable PostgreSQL schema definitions and INSERT statements.",
    ext: "sql",
    icon: (size = 18) => <Database size={size} strokeWidth={1.8} aria-hidden="true" />,
  },
  website_recreation: {
    title: "Offline Web App",
    description: "Standalone interactive dashboard with preloaded data.",
    ext: "html",
    icon: (size = 18) => <Globe size={size} strokeWidth={1.8} aria-hidden="true" />,
  },
};

export function ReportsDataExportTab({
  actor,
  allDeliveries,
  allCompanyExpenses,
  dateFrom,
  dateTo,
  periodLabel,
  dateRangePicker,
}: ReportsDataExportTabProps) {
  const router = useRouter();
  const { setRange } = useGlobalDateRange();
  const [requests, setRequests] = useState<DataExportRequest[]>(() => readExportRequests());
  const [archiveSnapshot, setArchiveSnapshot] = useState<ArchiveMachineSnapshot | null>(() =>
    readArchiveMachineSnapshot(),
  );
  const archiveFileInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const {
    value: exportSearch,
    setValue: setExportSearch,
    bufferedQuery: debouncedExportSearch,
    isBuffering: isExportSearchBuffering,
    clear: clearExportSearch,
  } = useSearchBuffer({ delay: 500 });
  const [requestingPackage, setRequestingPackage] = useState<DataExportPackageType | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [reviewNoteDrafts, setReviewNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setRequests(readExportRequests());
    setArchiveSnapshot(readArchiveMachineSnapshot());
    const sync = () => {
      setRequests(readExportRequests());
      setArchiveSnapshot(readArchiveMachineSnapshot());
    };
    window.addEventListener(ROUTEX_EXPORT_REQUESTS_CHANGED, sync);
    window.addEventListener(ROUTEX_ARCHIVE_MACHINE_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ROUTEX_EXPORT_REQUESTS_CHANGED, sync);
      window.removeEventListener(ROUTEX_ARCHIVE_MACHINE_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function applyLoadedArchiveSnapshot(next: ArchiveMachineSnapshot, jumpToDashboard = false) {
    activateArchiveMachineSnapshot(next);
    setArchiveSnapshot(next);
    if (next.dateFrom && next.dateTo) {
      setRange({
        startDate: parseDateValue(next.dateFrom),
        endDate: parseDateValue(next.dateTo),
        preset: "custom",
      });
    } else {
      const refDate = parseDateValue(next.referenceDate);
      setRange({
        ...presetRange("year", refDate),
        preset: "year",
      });
    }
    setFeedbackMessage(
      `Archive Machine loaded "${next.fileName}" (${next.archiveYear} · ${next.deliveries.length} trips · ${next.companyExpenses.length} finance records).`,
    );
    toast.success(`Archive Machine Active (${next.archiveYear})`, {
      description: `Website is now displaying ${next.deliveries.length} trips and ${next.companyExpenses.length} finance records from ${next.periodLabel}.`,
    });
    if (jumpToDashboard) {
      router.push("/dashboard");
    }
  }

  function handleArchiveFileUpload(file: File) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buf = e.target?.result;
          if (buf instanceof ArrayBuffer) {
            const parsed = parseArchiveMachineWorkbook(buf, file.name);
            applyLoadedArchiveSnapshot(parsed, false);
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to parse archive workbook.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result;
          if (typeof text === "string") {
            const parsed = parseArchiveMachineText(text, file.name);
            applyLoadedArchiveSnapshot(parsed, false);
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to parse archive file.");
        }
      };
      reader.readAsText(file);
    }
  }

  function handleExitArchiveMachine() {
    clearArchiveMachineSnapshot();
    setArchiveSnapshot(null);
    setRange({ ...presetRange("month"), preset: "month" });
    setFeedbackMessage("Exited Archive Machine and restored live workspace records.");
    toast.info("Returned to Live Workspace");
  }

  const isAdmin = canApproveDataExports(actor.role);
  const canRequest = canRequestDataExports(actor.role);
  const hasAccess = canAccessDataExportTab(actor.role);

  const activeScopedPayload = useMemo(
    () =>
      buildScopedExportPayload({
        deliveries: allDeliveries,
        companyExpenses: allCompanyExpenses,
        dateFrom,
        dateTo,
        periodLabel,
        generatedBy: actor.username,
      }),
    [allDeliveries, allCompanyExpenses, dateFrom, dateTo, periodLabel, actor.username],
  );

  const visibleRequests = useMemo(() => {
    const base = isAdmin
      ? requests
      : requests.filter(
          (r) =>
            r.requestedByRole === actor.role ||
            r.requestedByUsername.toLowerCase() === actor.username.toLowerCase(),
        );
    const filteredByStatus = statusFilter === "all" ? base : base.filter((r) => r.status === statusFilter);
    const q = debouncedExportSearch.trim().toLowerCase();
    if (!q) return filteredByStatus;
    return filteredByStatus.filter((r) =>
      r.requestedByUsername.toLowerCase().includes(q) ||
      r.requestedByFullName.toLowerCase().includes(q) ||
      r.packageLabel.toLowerCase().includes(q) ||
      r.periodLabel.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      (r.reviewNotes && r.reviewNotes.toLowerCase().includes(q)) ||
      r.status.toLowerCase().includes(q)
    );
  }, [requests, isAdmin, actor.role, actor.username, statusFilter, debouncedExportSearch]);

  const counts = useMemo(() => {
    const base = isAdmin
      ? requests
      : requests.filter(
          (r) =>
            r.requestedByRole === actor.role ||
            r.requestedByUsername.toLowerCase() === actor.username.toLowerCase(),
        );
    return {
      all: base.length,
      pending: base.filter((r) => r.status === "pending").length,
      approved: base.filter((r) => r.status === "approved").length,
      rejected: base.filter((r) => r.status === "rejected").length,
    };
  }, [requests, isAdmin, actor.role, actor.username]);

  function handleDirectDownload(packageType: DataExportPackageType) {
    const filename = triggerExportPackageDownload(packageType, activeScopedPayload);
    const meta = SIMPLIFIED_PACKAGES[packageType];
    setFeedbackMessage(`Exported ${meta.title} (${filename}).`);
    toast.success("Export downloaded", {
      description: `${meta.title} (${filename})`,
    });
  }

  function handleDownloadApprovedRequest(req: DataExportRequest) {
    if (!canDownloadExportRequest(req, { role: actor.role, username: actor.username })) {
      return;
    }
    const payload = buildScopedExportPayload({
      deliveries: allDeliveries,
      companyExpenses: allCompanyExpenses,
      dateFrom: req.dateFrom,
      dateTo: req.dateTo,
      periodLabel: req.periodLabel,
      generatedBy: actor.username,
    });
    const filename = triggerExportPackageDownload(req.packageType, payload);
    const meta = SIMPLIFIED_PACKAGES[req.packageType];
    setFeedbackMessage(`Downloaded ${meta?.title ?? req.packageLabel} (${filename}).`);
    toast.success("Export downloaded", {
      description: `${meta?.title ?? req.packageLabel} (${filename})`,
    });
  }

  function handleSubmitExportRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestingPackage) return;
    if (!canRequest) {
      const err = "Only Operations and Finance accounts can request data exports.";
      setRequestError(err);
      toast.error(err);
      return;
    }
    if (requestReason.trim().length < 5) {
      const err = "Please enter a reason of at least 5 characters.";
      setRequestError(err);
      toast.error(err);
      return;
    }

    const created = createDataExportRequest({
      packageType: requestingPackage,
      requestedByUsername: actor.username,
      requestedByFullName: actor.fullName,
      requestedByRole: actor.role as "operations" | "finance",
      reason: requestReason.trim(),
      dateFrom,
      dateTo,
      periodLabel,
    });
    setRequests(readExportRequests());
    setRequestingPackage(null);
    setRequestReason("");
    setRequestError(null);
    const meta = SIMPLIFIED_PACKAGES[created.packageType];
    setFeedbackMessage(`Submitted export request for ${meta.title}. Awaiting Admin review.`);
    toast.success("Request submitted", {
      description: `${meta.title} submitted for Admin review.`,
    });
  }

  function handleAdminDecision(req: DataExportRequest, decision: "approved" | "rejected") {
    if (!isAdmin) return;
    const note =
      reviewNoteDrafts[req.id]?.trim() ||
      (decision === "approved"
        ? "Approved by Admin."
        : "Declined by Admin.");
    reviewDataExportRequest({
      requestId: req.id,
      decision,
      reviewerRole: actor.role,
      reviewerUsername: actor.username,
      reviewNotes: note,
    });
    setRequests(readExportRequests());
    const meta = SIMPLIFIED_PACKAGES[req.packageType];
    const label = meta?.title ?? req.packageLabel;
    setFeedbackMessage(
      `${decision === "approved" ? "Approved" : "Rejected"} ${label} for @${req.requestedByUsername}.`,
    );
    if (decision === "approved") {
      toast.success("Request approved", {
        description: `Approved ${label} for @${req.requestedByUsername}.`,
      });
    } else {
      toast.info("Request rejected", {
        description: `Rejected ${label} for @${req.requestedByUsername}.`,
      });
    }
  }

  if (!hasAccess) {
    return (
      <div className="empty-state" style={{ padding: "48px 24px", textAlign: "center" }}>
        <strong className="empty-state-title" style={{ fontSize: "16px", color: "var(--color-text-primary)" }}>
          Access Restricted
        </strong>
        <p className="empty-state-desc" style={{ marginTop: "6px", color: "var(--color-text-muted)", fontSize: "13px" }}>
          Data exports are restricted to Admin, Operations, and Finance personnel.
        </p>
      </div>
    );
  }

  return (
    <div className="settings-tab-panel" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {feedbackMessage ? (
        <div
          role="status"
          style={{
            padding: "12px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "10px",
            color: "var(--color-status-success, #047857)",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              fontWeight: 700,
              fontSize: "16px",
              lineHeight: 1,
              padding: "2px 6px",
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* 1. Export Data Formats Section */}
      <section className="records-card" aria-label="Available Export Formats">
        <div
          className="records-heading"
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <h2>Export Data</h2>
            <p>Export operational and financial data for the selected period.</p>
          </div>

          <div className="export-header-meta" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {dateRangePicker}
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
              {activeScopedPayload.summary.totalDeliveries} trips · {activeScopedPayload.companyExpenses.length} expenses
            </span>
          </div>
        </div>

        {/* Package List */}
        <div className="export-package-list">
          {PACKAGE_ORDER.map((pkgId) => {
            const simple = SIMPLIFIED_PACKAGES[pkgId];
            const matchingApprovedReq = !isAdmin
              ? requests.find(
                  (r) =>
                    r.packageType === pkgId &&
                    r.dateFrom === dateFrom &&
                    r.dateTo === dateTo &&
                    r.status === "approved" &&
                    canDownloadExportRequest(r, { role: actor.role, username: actor.username }),
                )
              : null;
            const matchingPendingReq = !isAdmin
              ? requests.find(
                  (r) =>
                    r.packageType === pkgId &&
                    r.dateFrom === dateFrom &&
                    r.dateTo === dateTo &&
                    r.status === "pending" &&
                    (r.requestedByRole === actor.role ||
                      r.requestedByUsername.toLowerCase() === actor.username.toLowerCase()),
                )
              : null;

            return (
              <div key={pkgId} className="export-package-row">
                <div className="export-package-info-wrap">
                  <div className="export-package-icon">
                    {simple.icon(18)}
                  </div>
                  <div className="export-package-text">
                    <div className="export-package-title-line">
                      <span className="export-package-title">
                        {simple.title}
                      </span>
                      <span className="export-package-ext">
                        .{simple.ext}
                      </span>
                    </div>
                    <p className="export-package-desc">
                      {simple.description}
                    </p>
                  </div>
                </div>

                <div className="export-package-action">
                  {isAdmin ? (
                    <button
                      type="button"
                      className="export-action-btn"
                      onClick={() => handleDirectDownload(pkgId)}
                    >
                      <Download size={13} strokeWidth={2} aria-hidden="true" />
                      <span>Export</span>
                    </button>
                  ) : matchingApprovedReq ? (
                    <button
                      type="button"
                      className="export-action-btn is-approved"
                      onClick={() => handleDownloadApprovedRequest(matchingApprovedReq)}
                    >
                      <Download size={13} strokeWidth={2} aria-hidden="true" />
                      <span>Download</span>
                    </button>
                  ) : matchingPendingReq ? (
                    <span className="export-status-pending-text">
                      Pending Approval
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="export-action-btn"
                      onClick={() => {
                        setRequestingPackage(pkgId);
                        setRequestError(null);
                      }}
                    >
                      <Send size={13} strokeWidth={2} aria-hidden="true" />
                      <span>Request</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Inline Request Form */}
        {requestingPackage && canRequest ? (
          <div style={{ padding: "0 28px 24px" }}>
            <form
              onSubmit={handleSubmitExportRequest}
              className="export-request-form"
              style={{
                padding: "22px 24px",
                borderRadius: "12px",
                background: "var(--color-surface-subtle, #f8fafc)",
                border: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.1))",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                className="export-request-form-header"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ fontSize: "14px", fontWeight: 650, color: "var(--color-text-primary)" }}>
                    Request Export: {SIMPLIFIED_PACKAGES[requestingPackage].title}
                  </strong>
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)", marginLeft: "8px" }}>
                    · {periodLabel} ({activeScopedPayload.summary.totalDeliveries} trips)
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ minHeight: "30px", padding: "0 12px", fontSize: "12px", borderRadius: "6px" }}
                  onClick={() => {
                    setRequestingPackage(null);
                    setRequestError(null);
                  }}
                >
                  Cancel
                </button>
              </div>

              {requestError ? (
                <div className="delivery-form-alert" role="alert" style={{ margin: 0 }}>
                  {requestError}
                </div>
              ) : null}

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="export-reason-input" style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  Reason for export
                </label>
                <input
                  id="export-reason-input"
                  type="text"
                  required
                  minLength={5}
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="e.g. Monthly financial audit or offline operations backup"
                  className="settings-input"
                  style={{
                    height: "38px",
                    padding: "0 14px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border, #d1d5db)",
                    background: "var(--color-surface, #ffffff)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  className="export-action-btn is-approved"
                  style={{ minHeight: "34px", padding: "0 18px", fontSize: "12.5px" }}
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>

      {/* 2. Archive Machine Section — View Exported Data in the Live Website */}
      <section className="records-card" aria-label="Archive Machine Time-Travel Viewer">
        <div
          className="records-heading"
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <h2 style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <Archive size={17} strokeWidth={2} aria-hidden="true" style={{ color: "var(--color-accent)" }} />
              Archive Machine
            </h2>
            <p>
              Import any exported RouteX file (.xlsx, .csv, .json, .sql, or .html) to browse the entire website as if you were in that year and period.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <input
              ref={archiveFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.json,.sql,.html"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleArchiveFileUpload(file);
                e.target.value = "";
              }}
            />
            {archiveSnapshot ? (
              <>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ minHeight: "34px", padding: "0 14px", fontSize: "12.5px" }}
                  onClick={() => router.push("/dashboard")}
                >
                  Open {archiveSnapshot.archiveYear} Dashboard →
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ minHeight: "34px", padding: "0 14px", fontSize: "12.5px" }}
                  onClick={() => archiveFileInputRef.current?.click()}
                >
                  <Upload size={13} strokeWidth={2} aria-hidden="true" style={{ marginRight: "6px" }} />
                  Load Another Export
                </button>
                <button
                  type="button"
                  className="primary-action-button"
                  style={{ minHeight: "34px", padding: "0 14px", fontSize: "12.5px" }}
                  onClick={handleExitArchiveMachine}
                >
                  <RotateCcw size={13} strokeWidth={2} aria-hidden="true" style={{ marginRight: "6px" }} />
                  Return to Live Data
                </button>
              </>
            ) : (
              <button
                type="button"
                className="primary-action-button"
                style={{ minHeight: "34px", padding: "0 16px", fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => archiveFileInputRef.current?.click()}
              >
                <Upload size={13} strokeWidth={2.2} aria-hidden="true" />
                Load Exported File into Website
              </button>
            )}
          </div>
        </div>

        <div className="export-package-list">
          {archiveSnapshot ? (
            <div className="export-package-row">
              <div className="export-package-info-wrap">
                <div className="export-package-icon" style={{ color: "var(--color-accent)" }}>
                  <Archive size={18} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="export-package-text">
                  <div className="export-package-title-line">
                    <span className="export-package-title">
                      Active Archive: {archiveSnapshot.fileName}
                    </span>
                    <span className="export-package-ext">
                      Year {archiveSnapshot.archiveYear} · {archiveSnapshot.periodLabel}
                    </span>
                  </div>
                  <p className="export-package-desc">
                    Loaded {archiveSnapshot.deliveries.length} delivery trips, {archiveSnapshot.companyExpenses.length} company finance records, and {archiveSnapshot.trucks.length} fleet trucks. All website pages (Dashboard, Deliveries, Trucks, Finance, PODs, Reports) are currently displaying this historical snapshot.
                  </p>
                </div>
              </div>
              <div className="export-package-action" style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="export-action-btn is-approved"
                  onClick={() => router.push("/dashboard")}
                >
                  <span>Browse Website in {archiveSnapshot.archiveYear} →</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="export-package-row">
              <div className="export-package-info-wrap">
                <div className="export-package-icon">
                  <Archive size={18} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <div className="export-package-text">
                  <div className="export-package-title-line">
                    <span className="export-package-title">
                      Time-Travel Snapshot Loader
                    </span>
                    <span className="export-package-ext">
                      .xlsx · .csv · .json · .sql · .html
                    </span>
                  </div>
                  <p className="export-package-desc">
                    Upload any previously exported Excel workbook, CSV dataset bundle, JSON database snapshot, SQL dump, or Offline Web App HTML file. RouteX will set the workspace calendar to that archive&apos;s year and populate Dashboard, Deliveries, Trucks, Finance, and Reports with the archived records without overwriting your live database.
                  </p>
                </div>
              </div>
              <div className="export-package-action">
                <button
                  type="button"
                  className="export-action-btn"
                  onClick={() => archiveFileInputRef.current?.click()}
                >
                  <Upload size={13} strokeWidth={2} aria-hidden="true" />
                  <span>Import &amp; View Archive</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Requests & Approvals Queue Section */}
      <section className="records-card" aria-label="Export Requests Queue">
        <div
          className="records-heading"
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <h2>{isAdmin ? "Approval Queue" : "My Requests"}</h2>
            <p>
              {isAdmin
                ? "Review and authorize export requests."
                : "Track authorization status and download approved exports."}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <label className={`search-box${isExportSearchBuffering ? " is-buffering" : ""}`} style={{ maxWidth: "260px", minWidth: "180px", minHeight: "32px", height: "32px", padding: "0 10px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Search requests..."
                value={exportSearch}
                onChange={(e) => setExportSearch(e.target.value)}
                aria-label="Search export requests"
              />
              {exportSearch ? (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={clearExportSearch}
                  aria-label="Clear search"
                >
                  ×
                </button>
              ) : null}
            </label>

            <div className="metric-tabs" role="tablist" aria-label="Filter export requests by status">
              {(
                [
                  { id: "all", label: `All (${counts.all})` },
                  { id: "pending", label: `Pending (${counts.pending})` },
                  { id: "approved", label: `Approved (${counts.approved})` },
                  { id: "rejected", label: `Rejected (${counts.rejected})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === tab.id}
                  className={statusFilter === tab.id ? "active" : ""}
                  onClick={() => setStatusFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Wrap */}
        <div className="table-wrap" style={{ overflowX: "auto" }}>
          <table className="export-queue-table" style={{ width: "100%", minWidth: "880px", borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: "var(--color-surface-subtle, #f8fafc)" }}>
                <th className="export-th-requester" style={{ width: "18%", textAlign: "left", padding: "14px 18px", paddingLeft: "28px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))" }}>Requester</th>
                <th className="export-th-package" style={{ width: "19%", textAlign: "left", padding: "14px 18px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))" }}>Package</th>
                <th className="export-th-period" style={{ width: "14%", textAlign: "left", padding: "14px 18px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))" }}>Period</th>
                <th className="export-th-reason" style={{ width: "23%", textAlign: "left", padding: "14px 18px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))" }}>Reason &amp; Notes</th>
                <th className="export-th-status" style={{ width: "11%", textAlign: "left", padding: "14px 18px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))" }}>Status</th>
                <th className="export-th-actions" style={{ width: "15%", textAlign: "right", padding: "14px 18px", paddingRight: "28px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="export-empty-cell" style={{ textAlign: "center", padding: "36px 20px", color: "var(--color-text-muted)", fontSize: "13px" }}>
                    {debouncedExportSearch.trim()
                      ? `No export requests match "${exportSearch.trim()}".`
                      : "No export requests found."}
                  </td>
                </tr>
              ) : (
                visibleRequests.map((req) => {
                  const meta = SIMPLIFIED_PACKAGES[req.packageType];
                  const canDownloadThis = canDownloadExportRequest(req, {
                    role: actor.role,
                    username: actor.username,
                  });
                  return (
                    <tr key={req.id} style={{ borderBottom: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.06))", transition: "background-color 0.15s ease" }}>
                      <td className="export-td-requester" style={{ padding: "16px 18px", paddingLeft: "28px", verticalAlign: "middle" }}>
                        <strong className="export-user-name" style={{ fontSize: "13.5px", fontWeight: 650, color: "var(--color-text-primary)", display: "block" }}>
                          @{req.requestedByUsername}
                        </strong>
                        <div className="export-user-meta" style={{ fontSize: "11.5px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                          {req.requestedByRole} · {req.requestedAt.slice(0, 10)}
                        </div>
                      </td>
                      <td className="export-td-package" style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            className="export-package-icon"
                            style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "6px",
                            }}
                          >
                            {meta?.icon ? meta.icon(15) : null}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <strong className="export-pkg-title" style={{ fontSize: "13.5px", fontWeight: 650, color: "var(--color-text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {meta?.title ?? req.packageLabel}
                            </strong>
                            <span className="export-pkg-ext" style={{ fontSize: "11.5px", color: "var(--color-text-muted)" }}>
                              .{meta?.ext ?? ""}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="export-td-period" style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <span style={{ fontSize: "12.5px", color: "var(--color-text-secondary)" }}>
                          {req.periodLabel}
                        </span>
                      </td>
                      <td className="export-td-reason" style={{ padding: "16px 18px", verticalAlign: "middle", whiteSpace: "normal" }}>
                        <div className="export-reason-text" style={{ fontSize: "12.5px", color: "var(--color-text-primary)", lineHeight: 1.45 }}>
                          {req.reason}
                        </div>
                        {req.reviewNotes ? (
                          <div className="export-reason-admin-note" style={{ fontSize: "11.5px", color: "var(--color-text-muted)", marginTop: "4px", fontStyle: "italic" }}>
                            Admin note: {req.reviewNotes}
                          </div>
                        ) : null}
                        {isAdmin && req.status === "pending" ? (
                          <input
                            type="text"
                            value={reviewNoteDrafts[req.id] ?? ""}
                            onChange={(e) =>
                              setReviewNoteDrafts((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                            placeholder="Optional review note…"
                            aria-label={`Review note for ${req.id}`}
                            className="export-review-input"
                            style={{
                              marginTop: "8px",
                              width: "100%",
                              boxSizing: "border-box",
                              height: "30px",
                              padding: "0 10px",
                              fontSize: "12px",
                              borderRadius: "6px",
                              border: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.15))",
                              background: "var(--color-surface, #ffffff)",
                              color: "var(--color-text-primary)",
                            }}
                          />
                        ) : null}
                      </td>
                      <td className="export-td-status" style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "12px",
                            fontWeight: 650,
                            color:
                              req.status === "approved"
                                ? "var(--color-status-success, #059669)"
                                : req.status === "rejected"
                                  ? "var(--color-status-danger, #dc2626)"
                                  : "var(--color-status-warning, #d97706)",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              backgroundColor: "currentColor",
                              flexShrink: 0,
                            }}
                          />
                          {req.status === "approved"
                            ? "Approved"
                            : req.status === "rejected"
                              ? "Rejected"
                              : "Pending"}
                        </span>
                      </td>
                      <td className="export-td-actions" style={{ padding: "16px 18px", paddingRight: "28px", verticalAlign: "middle", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {isAdmin && req.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                className="export-btn-approve"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  height: "30px",
                                  padding: "0 12px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  borderRadius: "6px",
                                  border: "none",
                                  background: "var(--color-status-success, #059669)",
                                  color: "#ffffff",
                                  cursor: "pointer",
                                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
                                  transition: "opacity 0.15s ease",
                                }}
                                onClick={() => handleAdminDecision(req, "approved")}
                              >
                                <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                                Approve
                              </button>
                              <button
                                type="button"
                                className="export-btn-reject"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  height: "30px",
                                  padding: "0 11px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  borderRadius: "6px",
                                  border: "1px solid rgba(220, 38, 38, 0.25)",
                                  background: "rgba(220, 38, 38, 0.06)",
                                  color: "var(--color-status-danger, #dc2626)",
                                  cursor: "pointer",
                                  transition: "background-color 0.15s ease",
                                }}
                                onClick={() => handleAdminDecision(req, "rejected")}
                              >
                                <X size={12} strokeWidth={2.2} aria-hidden="true" />
                                Reject
                              </button>
                            </>
                          ) : null}

                          {isAdmin && req.status === "approved" ? (
                            <button
                              type="button"
                              className="export-btn-revoke"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                height: "28px",
                                padding: "0 10px",
                                fontSize: "11.5px",
                                fontWeight: 500,
                                borderRadius: "6px",
                                border: "1px solid rgba(220, 38, 38, 0.25)",
                                background: "transparent",
                                color: "var(--color-status-danger, #dc2626)",
                                cursor: "pointer",
                              }}
                              onClick={() => handleAdminDecision(req, "rejected")}
                            >
                              Revoke
                            </button>
                          ) : null}

                          {isAdmin && req.status === "rejected" ? (
                            <button
                              type="button"
                              className="export-btn-approve-secondary"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                height: "28px",
                                padding: "0 10px",
                                fontSize: "11.5px",
                                fontWeight: 600,
                                borderRadius: "6px",
                                border: "1px solid rgba(5, 150, 105, 0.3)",
                                background: "rgba(5, 150, 105, 0.08)",
                                color: "var(--color-status-success, #059669)",
                                cursor: "pointer",
                              }}
                              onClick={() => handleAdminDecision(req, "approved")}
                            >
                              Approve
                            </button>
                          ) : null}

                          {canDownloadThis ? (
                            <button
                              type="button"
                              className="export-action-btn is-approved"
                              style={{ minHeight: "28px", padding: "0 11px", fontSize: "11.5px" }}
                              onClick={() => handleDownloadApprovedRequest(req)}
                            >
                              <Download size={12} strokeWidth={2} aria-hidden="true" />
                              <span>Download</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
