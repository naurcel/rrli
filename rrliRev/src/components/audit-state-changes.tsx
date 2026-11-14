"use client";

import { useMemo } from "react";
import {
  extractStateChanges,
  formatAuditValue,
} from "@/features/audit/audit-formatters";

type AuditStateChangesProps = {
  summary?: string;
  changes?: Record<string, unknown> | null;
};

export function AuditStateChanges({ summary, changes }: AuditStateChangesProps) {
  const { transitions, attributes, hasChanges } = useMemo(
    () => extractStateChanges(changes),
    [changes],
  );

  return (
    <div className="audit-detail-cell">
      {summary ? <div className="audit-detail-summary">{summary}</div> : null}

      {hasChanges ? (
        <div className="audit-state-changes-block">
          {transitions.length > 0 ? (
            <div className="audit-transitions-list" aria-label="State transitions">
              {transitions.map((t) => (
                <div key={t.field} className="audit-transition-row">
                  <span className="audit-transition-label">{t.label}</span>
                  <div className="audit-transition-values">
                    <span className="audit-val-old" title="Previous value">
                      {formatAuditValue(t.field, t.oldValue)}
                    </span>
                    <span className="audit-change-arrow" aria-hidden="true">
                      →
                    </span>
                    <span className="audit-val-new" title="New value">
                      {formatAuditValue(t.field, t.newValue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {attributes.length > 0 ? (
            <div className="audit-attributes-wrap" aria-label="Modified attributes">
              {attributes.map((a) => (
                <span key={a.field} className="audit-attribute-pill">
                  <strong className="audit-attr-name">{a.label}:</strong>{" "}
                  <span className="audit-attr-val">{formatAuditValue(a.field, a.value)}</span>
                </span>
              ))}
            </div>
          ) : null}

          <details className="audit-raw-json-details">
            <summary>Raw event data</summary>
            <pre>{JSON.stringify(changes, null, 2)}</pre>
          </details>
        </div>
      ) : (
        <div style={{ fontSize: "11.5px", color: "var(--color-text-muted)", fontStyle: "italic", padding: "4px 0" }}>
          No additional state transitions or attribute diffs recorded for this event.
        </div>
      )}
    </div>
  );
}
