"use client";

import React, { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  maxWidth?: string;
  children: ReactNode;
  className?: string;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  maxWidth = "500px",
  children,
  className = "",
  closeOnEscape = true,
  closeOnBackdropClick = true,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && closeOnEscape) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="routex-dialog-layer"
      role="dialog"
      aria-modal="true"
      style={{ zIndex: 1000 }}
    >
      <div
        className="routex-dialog-backdrop"
        onClick={() => closeOnBackdropClick && onClose()}
      />
      <div
        className={`routex-dialog ${className}`}
        style={{ maxWidth }}
      >
        {title ? (
          <header className="routex-dialog-header">
            <div>
              <h2 style={{ fontSize: "17px", margin: 0 }}>{title}</h2>
              {description ? (
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--color-text-muted)" }}>
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="routex-dialog-close"
              aria-label="Close dialog"
              onClick={onClose}
            >
              ×
            </button>
          </header>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({
  title,
  description,
  onClose,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`routex-dialog-header ${className}`}>
      {children ? (
        children
      ) : (
        <>
          <div>
            {typeof title === "string" ? (
              <h2 style={{ fontSize: "17px", margin: 0 }}>{title}</h2>
            ) : (
              title
            )}
            {description ? (
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--color-text-muted)" }}>
                {description}
              </p>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              className="routex-dialog-close"
              aria-label="Close dialog"
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </>
      )}
    </header>
  );
}

export function DialogBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`routex-dialog-body ${className}`}>{children}</div>;
}

export function DialogFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <footer className={`routex-dialog-footer ${className}`}>{children}</footer>;
}

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  error?: string | null;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  pending = false,
  onConfirm,
  onCancel,
  error,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={() => !pending && onCancel()} maxWidth="460px">
      <DialogHeader
        title={<span style={{ color: variant === "danger" ? "var(--color-danger, #dc2626)" : undefined }}>{title}</span>}
        onClose={() => !pending && onCancel()}
      />
      <DialogBody>
        {error ? (
          <div className="notice" role="alert" style={{ marginBottom: "14px" }}>
            <span className="notice-icon" aria-hidden="true">!</span>
            <div><strong>Error:</strong><span>{error}</span></div>
          </div>
        ) : null}
        <div style={{ fontSize: "13px", lineHeight: 1.5, color: "var(--color-text-primary)" }}>
          {message}
        </div>
        {children}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "primary"}
          loading={pending}
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
