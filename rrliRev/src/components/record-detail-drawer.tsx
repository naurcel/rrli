"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type DetailSection = {
  title: string;
  eyebrow?: string;
  fullWidth?: boolean;
  rowSpan?: 1 | 2;
  className?: string;
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
  footer,
  onClose,
}: {
  open: boolean;
  eyebrow: string;
  title: string;
  statusLabel?: string;
  statusTone?: "success" | "warning";
  sections: readonly DetailSection[];
  footer?: ReactNode;
  onClose: () => void;
}) {
  const headingId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      document.body.classList.remove("record-detail-open");
      return;
    }

    document.body.classList.add("record-detail-open");
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("record-detail-open");
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="record-detail-layer">
      <button
        type="button"
        className="record-detail-backdrop"
        aria-label="Close record details"
        onClick={onClose}
      />
      <article
        ref={dialogRef}
        className="record-detail-drawer"
        role="dialog"
        aria-modal="true"
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
              ref={closeButtonRef}
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
            <section
              className={`record-detail-section${section.fullWidth ? " full-width" : ""}${section.rowSpan === 2 ? " row-span-2" : ""}${section.className ? ` ${section.className}` : ""}`}
              key={section.title}
            >
              {section.eyebrow ? <p className="record-detail-section-eyebrow">{section.eyebrow}</p> : null}
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
        {footer ? (
          <footer className="record-detail-footer">
            <div className="record-detail-footer-actions">{footer}</div>
          </footer>
        ) : null}
      </article>
    </div>,
    document.body,
  );
}

