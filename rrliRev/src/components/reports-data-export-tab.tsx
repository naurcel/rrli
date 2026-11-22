"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Table, FileSpreadsheet, FileCode2, Database, Globe, Download, Send, Check, X, RotateCcw } from "lucide-react";

import type { useAuthenticatedActor } from "@/components/auth-context";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import type { CompanyExpense } from "@/features/finance/company-expense-domain";
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
    themeColor: string;
    themeBg: string;
    themeBorder: string;
    icon: (size?: number) => React.ReactNode;
  }
> = {
  datasets_xlsx: {
    title: "Excel Workbook",
    description: "Deliveries, store drop-offs, truck profitability, and expenses.",
    ext: "xlsx",
    themeColor: "#059669",
    themeBg: "rgba(5, 150, 105, 0.08)",
    themeBorder: "rgba(5, 150, 105, 0.2)",
    icon: (size = 20) => <Table size={size} strokeWidth={2} aria-hidden="true" />,
  },
  datasets_csv: {
    title: "CSV Spreadsheets",
    description: "Deliveries, stores, trucks, and expenses in comma-separated format.",
    ext: "csv",
    themeColor: "#0d9488",
    themeBg: "rgba(13, 148, 136, 0.08)",
    themeBorder: "rgba(13, 148, 136, 0.2)",
    icon: (size = 20) => <FileSpreadsheet size={size} strokeWidth={2} aria-hidden="true" />,
  },
  database_json: {
    title: "JSON Database",
    description: "Structured JSON dump of all records, foreign keys, and tables.",
    ext: "json",
    themeColor: "#d97706",
    themeBg: "rgba(217, 119, 6, 0.08)",
    themeBorder: "rgba(217, 119, 6, 0.2)",
    icon: (size = 20) => <FileCode2 size={size} strokeWidth={2} aria-hidden="true" />,
  },
  database_sql: {
    title: "SQL Database Dump",
    description: "Portable PostgreSQL schema definitions and INSERT statements.",
    ext: "sql",
    themeColor: "#4f46e5",
    themeBg: "rgba(79, 70, 229, 0.08)",
    themeBorder: "rgba(79, 70, 229, 0.2)",
    icon: (size = 20) => <Database size={size} strokeWidth={2} aria-hidden="true" />,
  },
  website_recreation: {
    title: "Offline Web App",
    description: "Standalone interactive dashboard with preloaded data.",
    ext: "html",
    themeColor: "#7c3aed",
    themeBg: "rgba(124, 58, 237, 0.08)",
    themeBorder: "rgba(124, 58, 237, 0.2)",
    icon: (size = 20) => <Globe size={size} strokeWidth={2} aria-hidden="true" />,
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
  const [requests, setRequests] = useState<DataExportRequest[]>(() => readExportRequests());
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [requestingPackage, setRequestingPackage] = useState<DataExportPackageType | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [reviewNoteDrafts, setReviewNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setRequests(readExportRequests());
    const sync = () => setRequests(readExportRequests());
    window.addEventListener(ROUTEX_EXPORT_REQUESTS_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ROUTEX_EXPORT_REQUESTS_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

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
    if (statusFilter === "all") return base;
    return base.filter((r) => r.status === statusFilter);
  }, [requests, isAdmin, actor.role, actor.username, statusFilter]);

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
      <section className="records-card settings-card-section" aria-label="Available Export Formats">
        <div
          className="settings-section-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            padding: "24px 28px 20px",
            borderBottom: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.06))",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--color-text-primary)" }}>Export Data</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--color-text-muted)" }}>Export operational and financial data for the selected period.</p>
          </div>

          <div className="export-header-meta" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {dateRangePicker}
            <span style={{ fontSize: "12.5px", color: "var(--color-text-muted)" }}>
              {activeScopedPayload.summary.totalDeliveries} trips · {activeScopedPayload.companyExpenses.length} expenses
            </span>
          </div>
        </div>

        {/* Package List */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "14px" }}>
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
              <div
                key={pkgId}
                className="export-package-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "20px",
                  padding: "18px 22px",
                  borderRadius: "12px",
                  background: "var(--color-surface, #ffffff)",
                  border: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      background: simple.themeBg,
                      border: `1px solid ${simple.themeBorder}`,
                      color: simple.themeColor,
                    }}
                  >
                    {simple.icon(22)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                      <span style={{ fontSize: "14.5px", fontWeight: 650, color: "var(--color-text-primary)" }}>
                        {simple.title}
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-muted)" }}>
                        .{simple.ext}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12.5px", color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
                      {simple.description}
                    </p>
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {isAdmin ? (
                    <button
                      type="button"
                      className="primary-action-button"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                        minHeight: "36px",
                        padding: "0 18px",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        borderRadius: "8px",
                      }}
                      onClick={() => handleDirectDownload(pkgId)}
                    >
                      <Download size={14} strokeWidth={2.2} aria-hidden="true" />
                      Export
                    </button>
                  ) : matchingApprovedReq ? (
                    <button
                      type="button"
                      className="primary-action-button"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                        background: "var(--color-status-success, #059669)",
                        minHeight: "36px",
                        padding: "0 18px",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        borderRadius: "8px",
                      }}
                      onClick={() => handleDownloadApprovedRequest(matchingApprovedReq)}
                    >
                      <Download size={14} strokeWidth={2.2} aria-hidden="true" />
                      Download
                    </button>
                  ) : matchingPendingReq ? (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled
                      style={{ opacity: 0.7, minHeight: "36px", padding: "0 18px", fontSize: "12.5px", borderRadius: "8px" }}
                    >
                      Pending Approval
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                        minHeight: "36px",
                        padding: "0 18px",
                        fontSize: "12.5px",
                        fontWeight: 500,
                        borderRadius: "8px",
                      }}
                      onClick={() => {
                        setRequestingPackage(pkgId);
                        setRequestError(null);
                      }}
                    >
                      <Send size={14} strokeWidth={2} aria-hidden="true" />
                      Request Export
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Inline Request Form */}
          {requestingPackage && canRequest ? (
            <form
              onSubmit={handleSubmitExportRequest}
              className="export-request-form"
              style={{
                marginTop: "14px",
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
                  className="primary-action-button"
                  style={{ minHeight: "36px", padding: "0 20px", fontSize: "13px", fontWeight: 600, borderRadius: "8px" }}
                >
                  Submit Request
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </section>

      {/* 2. Requests & Approvals Queue Section */}
      <section className="records-card settings-card-section" aria-label="Export Requests Queue">
        <div
          className="settings-section-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            padding: "24px 28px 20px",
            borderBottom: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.06))",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--color-text-primary)" }}>{isAdmin ? "Approval Queue" : "My Requests"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--color-text-muted)" }}>
              {isAdmin
                ? "Review and authorize export requests."
                : "Track authorization status and download approved exports."}
            </p>
          </div>

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
                    No export requests found.
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
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "7px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              background: meta?.themeBg ?? "rgba(0,0,0,0.04)",
                              border: `1px solid ${meta?.themeBorder ?? "rgba(0,0,0,0.1)"}`,
                              color: meta?.themeColor ?? "var(--color-text-secondary)",
                            }}
                          >
                            {meta?.icon ? meta.icon(16) : null}
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
                              className={isAdmin ? "export-btn-download-secondary" : "export-btn-download-primary"}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                height: "30px",
                                padding: "0 13px",
                                fontSize: "12px",
                                fontWeight: 600,
                                borderRadius: "6px",
                                border: "none",
                                background: "var(--color-accent-deep, #1e293b)",
                                color: "#ffffff",
                                cursor: "pointer",
                                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
                              }}
                              onClick={() => handleDownloadApprovedRequest(req)}
                            >
                              <Download size={13} strokeWidth={2.2} aria-hidden="true" />
                              Download
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
