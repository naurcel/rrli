"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";

export type RecordDetailField = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
};

export type RecordDetailSection = {
  title: string;
  fields?: readonly RecordDetailField[];
  note?: string;
};

type RecordDetailDrawerProps = {
  record: {
    title: string;
    subtitle: string;
    status?: { label: string; tone?: "success" | "warning" };
    sections: readonly RecordDetailSection[];
    profileHref?: string;
    profileLabel?: string;
  } | null;
  onClose: () => void;
};

export function RecordDetailDrawer({ record, onClose }: RecordDetailDrawerProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!record) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.classList.add("record-detail-open");
    document.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      document.body.classList.remove("record-detail-open");
      document.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, [onClose, record]);

  if (!record) return null;

  return (
    <div className="record-detail-layer">
      <aside className="record-detail-drawer" role="complementary" aria-labelledby={titleId}>
        <header className="record-detail-header">
          <div>
            <p>{record.subtitle}</p>
            <h2 id={titleId}>{record.title}</h2>
          </div>
          <div className="record-detail-header-actions">
            {record.status ? <span className={`detail-status ${record.status.tone ?? "success"}`}>{record.status.label}</span> : null}
            <button ref={closeButtonRef} type="button" className="record-detail-close" aria-label="Close record details" onClick={onClose}>×</button>
          </div>
        </header>
        <div className="record-detail-content">
          {record.profileHref ? <Link className="record-detail-profile-link" href={record.profileHref}>{record.profileLabel ?? "View full profile"} <span aria-hidden="true">›</span></Link> : null}
          {record.sections.map((section) => (
            <section className="record-detail-section" key={section.title}>
              <h3>{section.title}</h3>
              {section.fields?.length ? <dl>{section.fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd className={field.tone ?? "default"}>{field.value}</dd></div>)}</dl> : null}
              {section.note ? <p>{section.note}</p> : null}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
