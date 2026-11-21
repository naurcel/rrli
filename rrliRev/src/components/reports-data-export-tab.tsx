"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
  DATA_EXPORT_PACKAGE_CATALOG,
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
    badge: string;
    ext: string;
  }
> = {
  datasets_xlsx: {
    title: "Excel Workbook",
    description: "Deliveries, store drop-offs, truck profitability, and expenses.",
    badge: "XLSX",
    ext: "xlsx",
  },
  datasets_csv: {
    title: "CSV Spreadsheets",
    description: "Deliveries, stores, trucks, and expenses in comma-separated format.",
    badge: "CSV",
    ext: "csv",
  },
  database_json: {
    title: "JSON Database",
    description: "Structured JSON dump of all records, foreign keys, and tables.",
    badge: "JSON",
    ext: "json",
  },
  database_sql: {
    title: "SQL Database Dump",
    description: "Portable PostgreSQL schema definitions and INSERT statements.",
    badge: "SQL",
    ext: "sql",
  },
  website_recreation: {
    title: "Offline Web App",
    description: "Standalone interactive dashboard with preloaded data.",
    badge: "HTML",
    ext: "html",
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
    <div className="export-unboxed-container">
      {feedbackMessage ? (
        <div
          role="status"
          style={{
            padding: "9px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "8px",
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

      {/* 1. Export Data Formats Section (Unboxed) */}
      <section className="export-section" aria-label="Available Export Formats">
        <div className="export-section-header">
          <div>
            <h2>Export Data</h2>
            <p>Export operational and financial data for the selected period.</p>
          </div>

          <div className="export-header-meta">
            {dateRangePicker}
            <span
              className="routex-badge tone-primary"
              style={{
                fontSize: "11px",
                fontWeight: 650,
                padding: "3px 9px",
                borderRadius: "6px",
                background: "var(--color-accent-soft, #fffbeb)",
                color: "var(--color-accent-deep, #7c2d12)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: "4px", verticalAlign: "-1px" }}
                aria-hidden="true"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              {periodLabel}
            </span>
            <span
              className="routex-badge tone-neutral"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: "6px",
                background: "var(--color-surface-subtle, #f1f5f9)",
                color: "var(--color-text-secondary)",
              }}
            >
              {activeScopedPayload.summary.totalDeliveries} trips · {activeScopedPayload.companyExpenses.length} expenses
            </span>
          </div>
        </div>

        {/* Unboxed Package List */}
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
                <div className="export-package-left">
                  <span className="export-format-tag">{simple.badge}</span>
                  <div className="export-package-meta">
                    <div className="export-package-title-line">
                      <span className="export-package-name">{simple.title}</span>
                      <span className="export-package-ext">.{simple.ext}</span>
                    </div>
                    <p className="export-package-desc">{simple.description}</p>
                  </div>
                </div>

                <div className="export-package-action">
                  {isAdmin ? (
                    <button
                      type="button"
                      className="primary-action-button"
                      onClick={() => handleDirectDownload(pkgId)}
                    >
                      Export .{simple.ext}
                    </button>
                  ) : matchingApprovedReq ? (
                    <button
                      type="button"
                      className="primary-action-button"
                      style={{ background: "var(--color-status-success, #059669)" }}
                      onClick={() => handleDownloadApprovedRequest(matchingApprovedReq)}
                    >
                      Download .{simple.ext}
                    </button>
                  ) : matchingPendingReq ? (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled
                      style={{ opacity: 0.7 }}
                    >
                      Pending Approval
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setRequestingPackage(pkgId);
                        setRequestError(null);
                      }}
                    >
                      Request Export
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Inline Request Form */}
        {requestingPackage && canRequest ? (
          <form onSubmit={handleSubmitExportRequest} className="export-request-form">
            <div className="export-request-form-header">
              <div>
                <strong className="export-request-form-title">
                  Request Export: {SIMPLIFIED_PACKAGES[requestingPackage].title}
                </strong>
                <span className="export-request-scope-badge">
                  {periodLabel} ({activeScopedPayload.summary.totalDeliveries} trips)
                </span>
              </div>
              <button
                type="button"
                className="secondary-button"
                style={{ padding: "4px 10px", fontSize: "12px" }}
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

            <div className="export-request-field">
              <label htmlFor="export-reason-input">Reason for export</label>
              <input
                id="export-reason-input"
                type="text"
                required
                minLength={5}
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="e.g. Monthly financial audit or offline operations backup"
                className="settings-input"
                style={{ padding: "8px 12px", fontSize: "13px" }}
              />
            </div>

            <div className="export-request-actions">
              <button
                type="submit"
                className="primary-action-button"
                style={{ padding: "6px 16px", fontSize: "12.5px" }}
              >
                Submit Request
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {/* 2. Requests & Approvals Queue Section (Unboxed) */}
      <section className="export-section" aria-label="Export Requests Queue">
        <div className="export-section-header">
          <div>
            <h2>{isAdmin ? "Approval Queue" : "My Requests"}</h2>
            <p>
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

        {/* Unboxed Table */}
        <div className="export-unboxed-table-wrap">
          <table className="export-queue-table">
            <thead>
              <tr>
                <th className="export-th-requester">Requester</th>
                <th className="export-th-package">Package</th>
                <th className="export-th-period">Period</th>
                <th className="export-th-reason">Reason</th>
                <th className="export-th-status">Status</th>
                <th className="export-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="export-empty-cell">
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
                    <tr key={req.id}>
                      <td className="export-td-requester">
                        <strong className="export-user-name">@{req.requestedByUsername}</strong>
                        <div className="export-user-meta">
                          {req.requestedByRole} · {req.requestedAt.slice(0, 10)}
                        </div>
                      </td>
                      <td className="export-td-package">
                        <strong className="export-pkg-title">{meta?.title ?? req.packageLabel}</strong>
                        <div className="export-pkg-ext">.{meta?.ext ?? ""}</div>
                      </td>
                      <td className="export-td-period">
                        <span className="export-period-tag">{req.periodLabel}</span>
                      </td>
                      <td className="export-td-reason">
                        <div className="export-reason-text">{req.reason}</div>
                        {req.reviewNotes ? (
                          <div className="export-reason-admin-note">
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
                          />
                        ) : null}
                      </td>
                      <td className="export-td-status">
                        <span className={`export-status-pill status-${req.status}`}>
                          {req.status === "approved"
                            ? "Approved"
                            : req.status === "rejected"
                              ? "Rejected"
                              : "Pending"}
                        </span>
                      </td>
                      <td className="export-td-actions">
                        <div className="export-actions-group">
                          {isAdmin && req.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                className="export-btn-approve"
                                onClick={() => handleAdminDecision(req, "approved")}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="export-btn-reject"
                                onClick={() => handleAdminDecision(req, "rejected")}
                              >
                                Reject
                              </button>
                            </>
                          ) : null}

                          {isAdmin && req.status === "approved" ? (
                            <button
                              type="button"
                              className="export-btn-revoke"
                              onClick={() => handleAdminDecision(req, "rejected")}
                            >
                              Revoke
                            </button>
                          ) : null}

                          {isAdmin && req.status === "rejected" ? (
                            <button
                              type="button"
                              className="export-btn-approve-secondary"
                              onClick={() => handleAdminDecision(req, "approved")}
                            >
                              Approve
                            </button>
                          ) : null}

                          {canDownloadThis ? (
                            <button
                              type="button"
                              className={isAdmin ? "export-btn-download-secondary" : "export-btn-download-primary"}
                              onClick={() => handleDownloadApprovedRequest(req)}
                            >
                              Download .{meta?.ext ?? ""}
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
