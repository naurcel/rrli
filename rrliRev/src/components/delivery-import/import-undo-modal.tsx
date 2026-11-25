import { type FormEvent } from "react";

export interface ImportUndoModalProps {
  isOpen: boolean;
  batchName: string;
  committedCount: number;
  undoing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ImportUndoModal({
  isOpen,
  batchName,
  committedCount,
  undoing,
  onCancel,
  onConfirm,
}: ImportUndoModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="undo-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "var(--color-surface, #ffffff)",
          border: "1px solid var(--line)",
          borderRadius: "14px",
          maxWidth: "480px",
          width: "100%",
          padding: "24px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "18px",
            }}
          >
            !
          </div>
          <h3 id="undo-modal-title" style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>
            Undo Batch Import?
          </h3>
        </div>
        <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.5, margin: "0 0 14px" }}>
          This will delete all <strong>{committedCount} deliveries</strong> imported in this batch (<em>{batchName}</em>) from the RouteX ledger, including associated drop-offs and audit records.
        </p>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 20px" }}>
          Are you sure you want to roll back this import batch?
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            className="secondary-button"
            disabled={undoing}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-action-button"
            style={{ background: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }}
            disabled={undoing}
            onClick={onConfirm}
          >
            {undoing ? "Undoing…" : "Yes, Undo Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
