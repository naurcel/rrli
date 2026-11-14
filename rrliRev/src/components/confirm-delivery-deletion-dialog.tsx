"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import { formatPeso } from "@/lib/format";

export function ConfirmDeliveryDeletionDialog({
  delivery,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  delivery: DeliveryLedgerItem | null;
  pending: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!delivery) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [delivery, pending, onCancel]);

  useEffect(() => {
    if (!delivery) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [delivery]);

  if (!delivery || typeof document === "undefined") return null;

  return createPortal(
    <div className="routex-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="delete-delivery-dialog-title" style={{ zIndex: 1000 }}>
      <div className="routex-dialog-backdrop" onClick={() => !pending && onCancel()} />
      <div className="routex-dialog" style={{ maxWidth: "460px" }}>
        <header className="routex-dialog-header" style={{ flexShrink: 0 }}>
          <div>
            <h2 id="delete-delivery-dialog-title" style={{ fontSize: "17px", color: "var(--color-danger, #dc2626)" }}>
              Delete Delivery
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "11px" }}>Action is audited and logged.</p>
          </div>
          <button
            type="button"
            className="routex-dialog-close"
            aria-label="Close dialog"
            title="Close dialog (Esc)"
            disabled={pending}
            onClick={onCancel}
          >
            ×
          </button>
        </header>

        <div className="routex-dialog-body" style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {error ? <div className="notice" role="alert"><span className="notice-icon" aria-hidden="true">!</span><div><strong>Error:</strong><span>{error}</span></div></div> : null}
          <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--color-text-primary)" }}>
            Delete waybill <strong>{delivery.waybillNumber}</strong> ({delivery.clientName})?
          </p>
          <div className="delete-delivery-summary">
            <div><span>Delivery Date</span><strong>{delivery.deliveryDate}</strong></div>
            <div><span>Plate Number</span><strong>{delivery.plateNumber}</strong></div>
            <div><span>Revenue</span><strong>{formatPeso(delivery.deliveryRate)}</strong></div>
            <div><span>Drop-offs</span><strong>{delivery.dropoffs.length}</strong></div>
          </div>
          <div className="delete-delivery-warning"><strong>Warning:</strong> This removes the record from operational and financial calculations.</div>
        </div>

        <footer className="routex-dialog-footer" style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" className="secondary-button" disabled={pending} onClick={onCancel} title="Cancel deletion and close dialog">Cancel</button>
          <button type="button" className="danger-confirm-button" disabled={pending} onClick={onConfirm} title="Permanently delete this delivery record">
            {pending ? "Deleting…" : "Delete"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
