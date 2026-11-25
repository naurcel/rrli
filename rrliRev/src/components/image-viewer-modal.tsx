"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isImageDocument, triggerDocumentDownload } from "@/features/deliveries/pod-utils";

export type ImageViewerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  subtitle?: string;
  filename?: string;
  notes?: string | null;
  onSaveNotes?: (notes: string) => Promise<void> | void;
  canEditNotes?: boolean;
  notesPlaceholder?: string;
};

export function ImageViewerModal({
  isOpen,
  onClose,
  imageUrl,
  title,
  subtitle,
  filename,
  notes,
  onSaveNotes,
  canEditNotes = true,
  notesPlaceholder,
}: ImageViewerModalProps) {
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Sync draftNotes whenever notes prop changes or modal opens
  useEffect(() => {
    setDraftNotes(notes ?? "");
    setSavedFeedback(false);
  }, [notes, isOpen]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !imageUrl || typeof document === "undefined") {
    return null;
  }

  const isImg = isImageDocument(imageUrl, filename);
  const showNotesSection = Boolean(onSaveNotes || notes !== undefined);
  const isDirty = draftNotes !== (notes ?? "");

  async function handleSaveNotes() {
    if (!onSaveNotes) return;
    setIsSavingNotes(true);
    try {
      await onSaveNotes(draftNotes);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2800);
    } finally {
      setIsSavingNotes(false);
    }
  }

  return createPortal(
    <div
      className="routex-dialog-layer image-viewer-layer"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ zIndex: 1200 }}
    >
      <div className="routex-dialog-backdrop image-viewer-backdrop" onClick={onClose} />

      <div className="image-viewer-dialog">
        <header className="image-viewer-header">
          <div className="image-viewer-header-info">
            <h3 className="image-viewer-title">{title}</h3>
            {subtitle ? <p className="image-viewer-subtitle">{subtitle}</p> : null}
          </div>

          <div className="image-viewer-header-actions">
            <button
              type="button"
              className="image-viewer-close-btn"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close image preview"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        <div className="image-viewer-canvas">
          {isImg ? (
            <img
              src={imageUrl}
              alt={title}
              className="image-viewer-img"
            />
          ) : (
            <iframe
              src={imageUrl}
              title={title}
              className="image-viewer-iframe"
            />
          )}
        </div>

        {showNotesSection ? (
          <div className="image-viewer-notes-section">
            <div className="image-viewer-notes-header">
              <div className="image-viewer-notes-title-group">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span className="image-viewer-notes-label">POD Notes & Remarks</span>
              </div>

              {savedFeedback ? (
                <span className="image-viewer-notes-saved-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Saved</span>
                </span>
              ) : isSavingNotes ? (
                <span className="image-viewer-notes-saved-hint" style={{ opacity: 0.7 }}>
                  <span>Saving...</span>
                </span>
              ) : null}
            </div>

            {canEditNotes ? (
              <div className="image-viewer-notes-input-wrapper">
                <textarea
                  className="image-viewer-notes-textarea"
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  onBlur={() => {
                    if (draftNotes !== (notes ?? "")) {
                      void handleSaveNotes();
                    }
                  }}
                  placeholder={
                    notesPlaceholder ||
                    "Add drop-off POD remarks (e.g. store receiver signature, stamp verification, condition upon arrival)..."
                  }
                  rows={2}
                />
              </div>
            ) : (
              <p className="image-viewer-notes-readonly">
                {draftNotes || <span className="image-viewer-notes-empty">No notes recorded for this document.</span>}
              </p>
            )}
          </div>
        ) : null}

        <footer className="image-viewer-footer">
          <span className="image-viewer-hint">
            Tip: Right-click image to open in another tab, copy, or save
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="secondary-button"
              style={{ padding: "4px 10px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}
              onClick={() => void triggerDocumentDownload(imageUrl, filename || "document.pdf")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download</span>
            </button>

            <button
              type="button"
              className="secondary-button"
              style={{ padding: "4px 10px", fontSize: "11.5px" }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
