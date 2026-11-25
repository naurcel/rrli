import React from "react";
import type { StagedDeliveryRow } from "@/features/deliveries/delivery-import-parser";

export interface ImportStep3ConfirmProps {
  batchName: string;
  readyCount: number;
  readyOwnedCount: number;
  readySubconCount: number;
  readyMatchedTrucksCount: number;
  readyNewTrucksCount: number;
  readyAutoCompletedCount: number;
  duplicateCount: number;
  attentionCount: number;
  importing: boolean;
  onBack: () => void;
  onCommit: () => void;
  filteredReadyRows: StagedDeliveryRow[];
  paginatedReadyRows: StagedDeliveryRow[];
  previewSearch: string;
  onPreviewSearchChange: (val: string) => void;
  previewPage: number;
  onPreviewPageChange: (updater: (prev: number) => number) => void;
  previewPageSize: number;
  onPreviewPageSizeChange: (val: number) => void;
  totalPreviewPages: number;
}

export function ImportStep3Confirm({
  batchName,
  readyCount,
  readyOwnedCount,
  readySubconCount,
  readyMatchedTrucksCount,
  readyNewTrucksCount,
  readyAutoCompletedCount,
  duplicateCount,
  attentionCount,
  importing,
  onBack,
  onCommit,
  filteredReadyRows,
  paginatedReadyRows,
  previewSearch,
  onPreviewSearchChange,
  previewPage,
  onPreviewPageChange,
  previewPageSize,
  onPreviewPageSizeChange,
  totalPreviewPages,
}: ImportStep3ConfirmProps) {
  return (
    <section className="records-card" aria-label="Confirm Batch Import">
      <div className="records-heading">
        <div>
          <h2>3. Confirm Batch Import</h2>
          <p>Review the import summary before committing to RouteX records.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={onBack}
            disabled={importing}
          >
            Back to Review
          </button>
          <button
            type="button"
            className="primary-action-button"
            disabled={importing || readyCount === 0}
            onClick={onCommit}
          >
            {importing ? "Committing Batch…" : `Confirm & Commit ${readyCount} Deliveries`}
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 22px", borderTop: "1px solid var(--line)" }}>
        <div className="import-metric-grid">
          <div className="import-metric-card">
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Batch Reference</span>
            <strong style={{ fontSize: "16px", color: "var(--color-text-primary)", marginTop: "4px" }}>
              {batchName}
            </strong>
          </div>

          <div className="import-metric-card tone-ready">
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Ready to Commit</span>
            <strong style={{ fontSize: "22px", color: "#10b981", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
              {readyCount} trips
            </strong>
            <span style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
              {readyOwnedCount} Owned · {readySubconCount} Subcon
            </span>
          </div>

          <div className="import-metric-card">
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Trucks Breakdown</span>
            <strong style={{ fontSize: "16px", color: "var(--color-text-primary)", marginTop: "4px" }}>
              {readyMatchedTrucksCount} matched · {readyNewTrucksCount} new
            </strong>
            <span style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
              {readyAutoCompletedCount} will auto-complete
            </span>
          </div>

          {duplicateCount > 0 ? (
            <div className="import-metric-card tone-duplicate">
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Duplicates (Will be Skipped)</span>
              <strong style={{ fontSize: "22px", color: "var(--color-text-muted)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                {duplicateCount} trips
              </strong>
            </div>
          ) : null}

          {attentionCount > 0 ? (
            <div className="import-metric-card tone-attention">
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Needs Attention (Excluded)</span>
              <strong style={{ fontSize: "22px", color: "#ef4444", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                {attentionCount} trips
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
            <li>Only rows marked as <strong>Ready</strong> will be committed to the database.</li>
            <li>Duplicate waybills are never overwritten, protecting existing historical delivery trips.</li>
            <li>All import events are written to the audit log under entity ID for this batch.</li>
            <li>Created delivery records are immediately reflected across RouteX dashboards, ledgers, and profitability summaries.</li>
          </ul>
        </div>

        {/* Batch Import Preview Table */}
        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>
                Ready for Import Preview ({filteredReadyRows.length}{filteredReadyRows.length !== readyCount ? ` of ${readyCount}` : ""})
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
                Examine all records ready to be written to the database before confirming.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <div className="search-box" style={{ width: "260px" }}>
                <input
                  type="search"
                  placeholder="Search preview rows…"
                  value={previewSearch}
                  onChange={(e) => onPreviewSearchChange(e.target.value)}
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                />
              </div>
              <label style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                Rows:
                <select
                  value={previewPageSize}
                  onChange={(e) => onPreviewPageSizeChange(Number(e.target.value))}
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
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>#</th>
                  <th>Date</th>
                  <th>Waybill</th>
                  <th>Client</th>
                  <th>Plate &amp; Ownership</th>
                  <th>Crew (Driver / Helper)</th>
                  <th style={{ textAlign: "right" }}>Revenue</th>
                  <th style={{ textAlign: "right" }}>Expenses</th>
                  <th style={{ textAlign: "right" }}>Net Profit</th>
                  <th>Drop-offs</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReadyRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "28px 16px", color: "var(--color-text-muted)" }}>
                      No ready rows match your preview search.
                    </td>
                  </tr>
                ) : (
                  paginatedReadyRows.map((row, idx) => {
                    const revenue = row.deliveryRate ?? 0;
                    const totalExp = row.totalExpenses ?? 0;
                    const netProfit = revenue - totalExp;
                    const rowNum = (previewPage - 1) * previewPageSize + idx + 1;
                    const dropCount = row.dropoffs.reduce((sum, d) => sum + (d.dropoffCount ?? 1), 0);
                    return (
                      <tr key={row.waybillNumber || row.rowNumber}>
                        <td style={{ color: "var(--color-text-muted)", fontSize: "12px", fontVariantNumeric: "tabular-nums" }}>
                          {rowNum}
                        </td>
                        <td style={{ whiteSpace: "nowrap", fontSize: "13px" }}>
                          {row.deliveryDate}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, fontFamily: "var(--font-mono, monospace)", fontSize: "13px" }}>
                            {row.waybillNumber}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500, fontSize: "13px" }}>{row.clientName}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontWeight: 600, fontSize: "13px" }}>{row.plateNumber}</span>
                            <span
                              className={`pod-status ${row.truckOwnership === "Subcontracted" ? "pending" : "attached"}`}
                              style={{ fontSize: "10px", padding: "1px 6px" }}
                            >
                              {row.truckOwnership === "Subcontracted" ? "Subcon" : "Owned"}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: "12px" }}>
                          <div style={{ color: "var(--color-text-primary)" }}>{row.driverName || "—"}</div>
                          {row.helperName ? (
                            <div style={{ color: "var(--color-text-muted)", fontSize: "11px" }}>+ {row.helperName}</div>
                          ) : null}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                          ₱{revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--color-text-muted)" }}>
                          ₱{totalExp.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: netProfit >= 0 ? "#10b981" : "#ef4444" }}>
                          ₱{netProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ fontSize: "12px" }}>
                          {row.dropoffs.length > 0 ? (
                            <span title={row.dropoffs.map(d => `${d.storeName} (${d.dropoffCount ?? 1})`).join(", ")}>
                              {row.dropoffs.length} {row.dropoffs.length === 1 ? "stop" : "stops"} ({dropCount} drops)
                            </span>
                          ) : (
                            <span style={{ color: "var(--color-text-muted)" }}>0 drops</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Preview Pagination */}
          {totalPreviewPages > 1 ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", fontSize: "12px", color: "var(--color-text-muted)" }}>
              <span>
                Showing {Math.min((previewPage - 1) * previewPageSize + 1, filteredReadyRows.length)} to {Math.min(previewPage * previewPageSize, filteredReadyRows.length)} of {filteredReadyRows.length} trips
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={previewPage <= 1}
                  onClick={() => onPreviewPageChange((p) => Math.max(1, p - 1))}
                  style={{ fontSize: "12px", padding: "4px 10px" }}
                >
                  Previous
                </button>
                <span style={{ display: "flex", alignItems: "center", padding: "0 8px", fontWeight: 500 }}>
                  Page {previewPage} of {totalPreviewPages}
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={previewPage >= totalPreviewPages}
                  onClick={() => onPreviewPageChange((p) => Math.min(totalPreviewPages, p + 1))}
                  style={{ fontSize: "12px", padding: "4px 10px" }}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
