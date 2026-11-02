"use client";

import { useEffect, useId, type ReactNode } from "react";

export type DetailSection = {
  title: string;
  rows?: readonly {
    label: string;
    value: string;
    tone?: "success" | "warning";
  }[];
  description?: string;
  customContent?: ReactNode;
};

export function RecordDetailDrawer({
  open,
  eyebrow,
  title,
  statusLabel,
  statusTone = "success",
  sections,
  onClose,
}: {
  open: boolean;
  eyebrow: string;
  title: string;
  statusLabel?: string;
  statusTone?: "success" | "warning";
  sections: readonly DetailSection[];
  onClose: () => void;
}) {
  const headingId = useId();

  useEffect(() => {
    if (!open) {
      document.body.classList.remove("record-detail-open");
      return;
    }

    document.body.classList.add("record-detail-open");

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("record-detail-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="record-detail-layer">
      <button
        type="button"
        className="record-detail-backdrop"
        aria-label="Close record details"
        onClick={onClose}
      />
      <aside
        className="record-detail-drawer"
        role="dialog"
        aria-modal="false"
        aria-labelledby={headingId}
      >
        <header className="record-detail-header">
          <div>
            <p>{eyebrow}</p>
            <h2 id={headingId}>{title}</h2>
          </div>
          <div className="record-detail-header-actions">
            {statusLabel ? (
              <span className={`detail-status ${statusTone}`}>
                {statusLabel}
              </span>
            ) : null}
            <button
              type="button"
              className="record-detail-close"
              aria-label="Close details"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        <div className="record-detail-content">
          {sections.map((section) => (
            <section className="record-detail-section" key={section.title}>
              <h3>{section.title}</h3>
              {section.rows ? (
                <dl>
                  {section.rows.map((row) => (
                    <div key={row.label}>
                      <dt>{row.label}</dt>
                      <dd className={row.tone}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {section.description ? <p>{section.description}</p> : null}
              {section.customContent ?? null}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

