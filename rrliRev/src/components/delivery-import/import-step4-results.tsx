"use client";

import Link from "next/link";

interface ImportStep4ResultsProps {
  importResult: {
    batchName: string;
    committedCount: number;
    committedWaybills: string[];
    duplicateCount: number;
    duplicateWaybills: string[];
    errors: { waybill: string; reason: string }[];
  };
  isUndone: boolean;
  undoneCount: number;
  undoing: boolean;
  returnHref?: string;
  onUndoClick: () => void;
  onReset: () => void;
  onDownloadErrorReport: () => void;
}

export function ImportStep4Results({
  importResult,
  isUndone,
  undoneCount,
  undoing,
  returnHref,
  onUndoClick,
  onReset,
  onDownloadErrorReport,
}: ImportStep4ResultsProps) {
  return (
    <section className="records-card" aria-label="Import Batch Results">
      <div className="records-heading">
        <div>
          <h2>Import Batch Completed</h2>
          <p>Batch Reference: {importResult.batchName}</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {!isUndone && importResult.committedCount > 0 ? (
            <button
              type="button"
              className="secondary-button"
              style={{
                color: "#ef4444",
                borderColor: "rgba(239, 68, 68, 0.4)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
              disabled={undoing}
              onClick={onUndoClick}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
              {undoing ? "Undoing Import…" : "Undo Import"}
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onReset}>
            Import Another Batch
          </button>
          <Link
            className="primary-action-button"
            href={returnHref && returnHref.startsWith("/deliveries") ? returnHref : "/deliveries"}
          >
            View in Deliveries →
          </Link>
        </div>
      </div>

      <div style={{ padding: "20px 22px", borderTop: "1px solid var(--line)" }}>
        {isUndone ? (
          <div
            style={{
              padding: "16px 20px",
              marginBottom: "20px",
              borderRadius: "10px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <div>
                <strong
                  style={{
                    display: "block",
                    color: "var(--color-text-primary)",
                    fontSize: "14px",
                  }}
                >
                  Import Batch Undone
                </strong>
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  Successfully rolled back and removed {undoneCount} deliveries from the RouteX ledger.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: "12px", padding: "6px 14px" }}
              onClick={onReset}
            >
              Upload New File
            </button>
          </div>
        ) : null}

        <div className="import-metric-grid">
          <div className="import-metric-card tone-ready">
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
              {isUndone ? "Deliveries Rolled Back" : "Successfully Committed"}
            </span>
            <strong
              style={{
                fontSize: "24px",
                color: isUndone ? "var(--color-text-muted)" : "#10b981",
                marginTop: "4px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {isUndone ? undoneCount : importResult.committedCount} Deliveries
            </strong>
          </div>

          {importResult.duplicateCount > 0 ? (
            <div className="import-metric-card tone-duplicate">
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                Duplicate Waybills Skipped
              </span>
              <strong
                style={{
                  fontSize: "24px",
                  color: "var(--color-text-muted)",
                  marginTop: "4px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {importResult.duplicateCount}
              </strong>
            </div>
          ) : null}

          {importResult.errors.length > 0 ? (
            <div className="import-metric-card tone-attention">
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                Failed Records
              </span>
              <strong
                style={{
                  fontSize: "24px",
                  color: "#ef4444",
                  marginTop: "4px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {importResult.errors.length}
              </strong>
            </div>
          ) : null}
        </div>

        {/* Committed Waybill Chips */}
        {importResult.committedWaybills.length > 0 && !isUndone ? (
          <div style={{ marginBottom: "24px" }}>
            <strong
              style={{
                display: "block",
                fontSize: "13px",
                marginBottom: "10px",
                color: "var(--color-text-primary)",
              }}
            >
              Committed Waybill Records ({importResult.committedWaybills.length}):
            </strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {importResult.committedWaybills.map((wb) => (
                <span key={wb} className="import-waybill-pill">
                  {wb}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Skipped / Duplicates */}
        {importResult.duplicateWaybills.length > 0 ? (
          <div style={{ marginBottom: "24px" }}>
            <strong
              style={{
                display: "block",
                fontSize: "13px",
                marginBottom: "10px",
                color: "var(--color-text-muted)",
              }}
            >
              Skipped Duplicates ({importResult.duplicateWaybills.length}):
            </strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {importResult.duplicateWaybills.map((wb) => (
                <span key={wb} className="import-waybill-pill" style={{ opacity: 0.75 }}>
                  {wb}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Error Report Download */}
        {importResult.duplicateCount > 0 || importResult.errors.length > 0 ? (
          <div style={{ marginTop: "20px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
            <button type="button" className="secondary-button" onClick={onDownloadErrorReport}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Audit / Error Report (CSV)
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
