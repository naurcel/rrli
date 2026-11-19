"use client";

import { useEffect, useMemo, useState } from "react";

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
import { formatPeso } from "@/lib/format";

export interface ReportsDataExportTabProps {
  actor: ReturnType<typeof useAuthenticatedActor>;
  allDeliveries: readonly DeliveryLedgerItem[];
  allCompanyExpenses: readonly CompanyExpense[];
  dateFrom: string | null;
  dateTo: string | null;
  periodLabel: string;
}

const PACKAGE_ORDER: readonly DataExportPackageType[] = [
  "datasets_xlsx",
  "datasets_csv",
  "database_json",
  "database_sql",
  "website_recreation",
];

export function ReportsDataExportTab({
  actor,
  allDeliveries,
  allCompanyExpenses,
  dateFrom,
  dateTo,
  periodLabel,
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
    setFeedbackMessage(
      `Exported "${DATA_EXPORT_PACKAGE_CATALOG[packageType].title}" for ${periodLabel} (${filename}).`,
    );
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
    setFeedbackMessage(
      `Downloaded approved export "${req.packageLabel}" for period ${req.periodLabel} (${filename}).`,
    );
  }

  function handleSubmitExportRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestingPackage) return;
    if (!canRequest) {
      setRequestError("Only Operations and Finance roles can submit export requests.");
      return;
    }
    if (requestReason.trim().length < 5) {
      setRequestError("Please enter a reason of at least 5 characters for Admin review.");
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
    setFeedbackMessage(
      `Submitted request for "${created.packageLabel}" (${created.periodLabel}). Awaiting Admin approval.`,
    );
  }

  function handleAdminDecision(req: DataExportRequest, decision: "approved" | "rejected") {
    if (!isAdmin) return;
    const note =
      reviewNoteDrafts[req.id]?.trim() ||
      (decision === "approved"
        ? "Approved by Admin for operational/financial review."
        : "Export request declined by Admin.");
    reviewDataExportRequest({
      requestId: req.id,
      decision,
      reviewerRole: actor.role,
      reviewerUsername: actor.username,
      reviewNotes: note,
    });
    setRequests(readExportRequests());
    setFeedbackMessage(
      `${decision === "approved" ? "Approved" : "Rejected"} ${req.packageLabel} request from @${req.requestedByUsername} (${req.periodLabel}).`,
    );
  }

  if (!hasAccess) {
    return (
      <article className="report-document" aria-label="Data export access restricted">
        <div className="empty-state" style={{ padding: "48px 24px" }}>
          <strong className="empty-state-title">Data & Website Export Restricted</strong>
          <span className="empty-state-desc">
            Dataset exports, database snapshots, and working website recreations are restricted to Admin, Operations, and Finance personnel.
          </span>
        </div>
      </article>
    );
  }

  return (
    <article className="report-document" aria-label="Date-filtered dataset, database, and website export center">
      <header className="report-document-header">
        <div>
          <p>REDEEMED ROUTE LOGISTICS INC. · ROUTEX DATA GOVERNANCE</p>
          <h2>Data, Database & Website Recreation Export</h2>
          <span>
            {isAdmin
              ? `Admin Export & Approval Console · Prepared for ${actor.fullName} (@${actor.username})`
              : `Export Request Console (${actor.roleLabel}) · Prepared for ${actor.fullName} (@${actor.username})`}
          </span>
          <p style={{ marginTop: "4px", fontSize: "11.5px", color: "var(--color-text-muted)" }}>
            All exported datasets, relational database snapshots, and standalone working website recreations are dynamically filtered to the active date range ({periodLabel}).
            {!isAdmin && " Exports require Admin approval before Operations or Finance can download."}
          </p>
        </div>
        <dl>
          <div>
            <dt>Active Date Filter</dt>
            <dd>{periodLabel}</dd>
          </div>
          <div>
            <dt>Scoped Trips</dt>
            <dd>{activeScopedPayload.summary.totalDeliveries}</dd>
          </div>
          <div>
            <dt>Scoped Drop-offs</dt>
            <dd>{activeScopedPayload.summary.totalDropoffs}</dd>
          </div>
          <div>
            <dt>Authority</dt>
            <dd>{isAdmin ? "Admin (Direct & Approve)" : `${actor.roleLabel} (Request)`}</dd>
          </div>
        </dl>
      </header>

      {feedbackMessage ? (
        <div
          className="notice"
          role="status"
          style={{
            margin: "0 0 18px",
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(16, 185, 129, 0.09)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "8px",
            color: "var(--color-status-success, #047857)",
            fontSize: "12.5px",
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
              fontSize: "14px",
            }}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Scoped Dataset Summary Metrics for Active Date Filter */}
      <section className="report-summary" aria-label="Date-filtered export scope totals">
        <div>
          <span>Deliveries in Range</span>
          <strong>{activeScopedPayload.summary.totalDeliveries}</strong>
        </div>
        <div>
          <span>Finalized / Incomplete</span>
          <strong>
            {activeScopedPayload.summary.finalizedDeliveries} / {activeScopedPayload.summary.incompleteDeliveries}
          </strong>
        </div>
        <div>
          <span>Store Drop-offs</span>
          <strong>{activeScopedPayload.summary.totalDropoffs}</strong>
        </div>
        <div>
          <span>Company Expenses</span>
          <strong>{activeScopedPayload.companyExpenses.length} records</strong>
        </div>
        <div>
          <span>Scoped Revenue</span>
          <strong>{formatPeso(activeScopedPayload.summary.deliveryRevenue)}</strong>
        </div>
        <div>
          <span>Scoped Company Net Profit</span>
          <strong
            style={{
              color:
                activeScopedPayload.summary.companyNetProfit >= 0
                  ? "var(--color-profit, #059669)"
                  : "var(--color-danger, #dc2626)",
            }}
          >
            {formatPeso(activeScopedPayload.summary.companyNetProfit)}
          </strong>
        </div>
      </section>

      {/* Export Packages Grid */}
      <section className="report-table-section" style={{ marginBottom: "24px" }}>
        <div className="report-table-heading">
          <div>
            <h3>Exportable Packages for {periodLabel}</h3>
            <p>
              {isAdmin
                ? "As Admin, you can directly export any date-filtered package below or approve requests from Operations and Finance."
                : "Select a package below to request Admin approval for the currently selected date filter, or download once approved."}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(265px, 1fr))",
            gap: "14px",
            marginTop: "12px",
          }}
        >
          {PACKAGE_ORDER.map((pkgId) => {
            const pkg = DATA_EXPORT_PACKAGE_CATALOG[pkgId];
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
                key={pkg.id}
                style={{
                  border: "1px solid var(--color-border, #e2e8f0)",
                  borderRadius: "12px",
                  padding: "16px 18px",
                  background: "var(--color-surface, #ffffff)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "14px",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: "var(--color-accent-soft, #fffbeb)",
                        color: "var(--color-accent, #b45309)",
                      }}
                    >
                      {pkg.badge}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                      .{pkg.extension.toUpperCase()}
                    </span>
                  </div>
                  <h4 style={{ margin: "0 0 6px", fontSize: "14.5px", fontWeight: 700 }}>
                    {pkg.title}
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      lineHeight: 1.5,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {pkg.description}
                  </p>
                </div>

                <div
                  style={{
                    borderTop: "1px solid var(--color-border-subtle, #edf1ee)",
                    paddingTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--color-text-muted)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Scope: {periodLabel}</span>
                    <span>
                      {activeScopedPayload.summary.totalDeliveries} trips ·{" "}
                      {activeScopedPayload.companyExpenses.length} expenses
                    </span>
                  </div>

                  {isAdmin ? (
                    <button
                      type="button"
                      className="primary-action-button"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => handleDirectDownload(pkg.id)}
                    >
                      ↓ Export {pkg.extension.toUpperCase()} ({periodLabel})
                    </button>
                  ) : matchingApprovedReq ? (
                    <button
                      type="button"
                      className="primary-action-button"
                      style={{
                        width: "100%",
                        justifyContent: "center",
                        background: "var(--color-status-success, #059669)",
                      }}
                      onClick={() => handleDownloadApprovedRequest(matchingApprovedReq)}
                    >
                      ↓ Download Approved .{pkg.extension.toUpperCase()}
                    </button>
                  ) : matchingPendingReq ? (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled
                      style={{ width: "100%", justifyContent: "center", opacity: 0.75 }}
                    >
                      ⏳ Pending Admin Approval ({periodLabel})
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => {
                        setRequestingPackage(pkg.id);
                        setRequestError(null);
                      }}
                    >
                      Request Admin Approval ({periodLabel})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Inline Request Form for Operations & Finance */}
        {requestingPackage && canRequest ? (
          <form
            onSubmit={handleSubmitExportRequest}
            style={{
              marginTop: "16px",
              padding: "16px 18px",
              borderRadius: "12px",
              border: "1px solid var(--color-accent, #b45309)",
              background: "var(--color-accent-soft, #fffbeb)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: "13.5px" }}>
                  Request Admin Approval: {DATA_EXPORT_PACKAGE_CATALOG[requestingPackage].title}
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  Date Filter Scope: <strong>{periodLabel}</strong> ({activeScopedPayload.summary.totalDeliveries} deliveries, {activeScopedPayload.companyExpenses.length} company expenses)
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
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

            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600 }}>
                Purpose / Reason for Export Request <span style={{ color: "#dc2626" }}>*</span>
              </span>
              <input
                type="text"
                required
                minLength={5}
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="e.g., Monthly financial reconciliation or offline operations review for selected period"
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  background: "var(--color-surface, #ffffff)",
                  fontSize: "13px",
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="submit" className="primary-action-button">
                Submit Request to Admin
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {/* Approval Queue (Admin) / My Export Requests (Operations & Finance) */}
      <section className="report-table-section">
        <div
          className="report-table-heading"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h3>
              {isAdmin
                ? "Admin Export Approval Queue (Operations & Finance Requests)"
                : `My Export Requests (${actor.roleLabel})`}
            </h3>
            <p>
              {isAdmin
                ? "Review and approve or reject export requests from Operations and Finance. Once approved, the requester can download the date-filtered package."
                : "Track your submitted export requests. Approved packages can be downloaded immediately."}
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

        <div className="report-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Requested By</th>
                <th>Export Package</th>
                <th>Date Filter Scope</th>
                <th>Reason / Review Notes</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty-cell">
                    <div className="empty-state minimal">
                      <strong className="empty-state-title">No export requests in this view</strong>
                      <span className="empty-state-desc">
                        {isAdmin
                          ? "No export requests from Operations or Finance match the selected status filter."
                          : "Use the cards above to request Admin approval for a dataset, database snapshot, or website recreation."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleRequests.map((req) => {
                  const pkg = DATA_EXPORT_PACKAGE_CATALOG[req.packageType];
                  const canDownloadThis = canDownloadExportRequest(req, {
                    role: actor.role,
                    username: actor.username,
                  });
                  return (
                    <tr key={req.id}>
                      <td>
                        <strong>@{req.requestedByUsername}</strong>
                        <br />
                        <small style={{ color: "var(--color-text-muted)", textTransform: "capitalize" }}>
                          {req.requestedByRole} · {req.requestedAt.slice(0, 10)}
                        </small>
                      </td>
                      <td>
                        <strong>{req.packageLabel}</strong>
                        <br />
                        <small style={{ color: "var(--color-text-muted)" }}>
                          {pkg?.badge} (.{pkg?.extension.toUpperCase()})
                        </small>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: "var(--color-surface-subtle, #f1f5f9)",
                            fontSize: "11.5px",
                            fontWeight: 600,
                          }}
                        >
                          {req.periodLabel}
                        </span>
                      </td>
                      <td style={{ maxWidth: "280px" }}>
                        <div style={{ fontSize: "12.5px" }}>{req.reason}</div>
                        {req.reviewNotes ? (
                          <small style={{ display: "block", marginTop: "3px", color: "var(--color-text-muted)" }}>
                            Admin (@{req.reviewedByUsername}): {req.reviewNotes}
                          </small>
                        ) : null}
                        {isAdmin && req.status === "pending" ? (
                          <input
                            type="text"
                            value={reviewNoteDrafts[req.id] ?? ""}
                            onChange={(e) =>
                              setReviewNoteDrafts((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                            placeholder="Optional admin review note…"
                            aria-label={`Review note for ${req.id}`}
                            style={{
                              marginTop: "6px",
                              width: "100%",
                              padding: "4px 8px",
                              fontSize: "11.5px",
                              borderRadius: "6px",
                              border: "1px solid var(--color-border, #cbd5e1)",
                              background: "var(--color-surface, #ffffff)",
                            }}
                          />
                        ) : null}
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 9px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background:
                              req.status === "approved"
                                ? "rgba(16, 185, 129, 0.14)"
                                : req.status === "rejected"
                                  ? "rgba(239, 68, 68, 0.14)"
                                  : "rgba(245, 158, 11, 0.16)",
                            color:
                              req.status === "approved"
                                ? "var(--color-status-success, #059669)"
                                : req.status === "rejected"
                                  ? "var(--color-danger, #dc2626)"
                                  : "var(--color-status-warning, #b45309)",
                          }}
                        >
                          {req.status === "approved"
                            ? "Approved"
                            : req.status === "rejected"
                              ? "Rejected"
                              : "Pending Admin"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                          {isAdmin && req.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                className="primary-action-button"
                                style={{ padding: "5px 11px", fontSize: "11.5px" }}
                                onClick={() => handleAdminDecision(req, "approved")}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                style={{ padding: "5px 11px", fontSize: "11.5px", color: "#dc2626" }}
                                onClick={() => handleAdminDecision(req, "rejected")}
                              >
                                Reject
                              </button>
                            </>
                          ) : null}

                          {isAdmin && req.status === "approved" ? (
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "5px 10px", fontSize: "11.5px", color: "#dc2626" }}
                              onClick={() => handleAdminDecision(req, "rejected")}
                            >
                              Revoke
                            </button>
                          ) : null}

                          {isAdmin && req.status === "rejected" ? (
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ padding: "5px 10px", fontSize: "11.5px" }}
                              onClick={() => handleAdminDecision(req, "approved")}
                            >
                              Approve
                            </button>
                          ) : null}

                          {canDownloadThis ? (
                            <button
                              type="button"
                              className={isAdmin ? "secondary-button" : "primary-action-button"}
                              style={{ padding: "5px 11px", fontSize: "11.5px" }}
                              onClick={() => handleDownloadApprovedRequest(req)}
                            >
                              ↓ Download .{pkg?.extension.toUpperCase()}
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

      <footer className="report-document-footer">
        <span>RouteX — Data, Database & Website Recreation Export</span>
        <span>Redeemed Route Logistics Inc.</span>
      </footer>
    </article>
  );
}
