"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { isImageDocument, triggerDocumentDownload } from "@/features/deliveries/pod-utils";

export type ImageViewerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  subtitle?: string;
  filename?: string;
};

export function ImageViewerModal({
  isOpen,
  onClose,
  imageUrl,
  title,
  subtitle,
  filename,
}: ImageViewerModalProps) {
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
              title="Close image preview (Escape)"
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
              title="Right-click to copy or open image in new tab"
            />
          ) : (
            <iframe
              src={imageUrl}
              title={title}
              className="image-viewer-iframe"
            />
          )}
        </div>

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
              title="Download file to device"
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
