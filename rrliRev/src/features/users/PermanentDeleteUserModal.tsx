"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type TargetUser = {
  id: string;
  username: string;
  fullName: string;
  roleLabel: string;
};

type Props = {
  user: TargetUser | null;
  onClose: () => void;
  onSuccess: (deletedUserId: string, message: string) => void;
};

export function PermanentDeleteUserModal({ user, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setReason("");
    setError(null);
    setIsDeleting(false);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isDeleting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user, onClose, isDeleting]);

  if (!user) return null;

  async function handleConfirmDelete() {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError("A documented deletion reason of at least 5 characters is required.");
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/users?userId=${user!.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.message ?? "Unable to permanently delete account.");
        setIsDeleting(false);
        return;
      }

      onSuccess(user!.id, payload.message ?? `Account @${user!.username} permanently deleted.`);
      onClose();
    } catch {
      setError("Network error while processing permanent account deletion.");
      setIsDeleting(false);
    }
  }

  return createPortal(
    <div
      className="routex-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-del-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        className="routex-dialog-panel"
        style={{
          background: "var(--color-surface, #ffffff)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: "16px",
          boxShadow: "0 20px 45px -10px rgba(0, 0, 0, 0.3)",
          maxWidth: "480px",
          width: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--color-border, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(239, 68, 68, 0.12)",
                color: "#dc2626",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-hidden="true"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <div>
              <h2
                id="perm-del-title"
                style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--color-text, #0f172a)" }}
              >
                Permanently Delete Account
              </h2>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary, #64748b)" }}>
                Executive Superadmin Action
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "var(--color-text-muted, #94a3b8)",
            }}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#dc2626",
                fontSize: "12.5px",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              padding: "12px 16px",
              background: "var(--color-surface-subtle, #f8fafc)",
              borderRadius: "10px",
              border: "1px solid var(--color-border, #e2e8f0)",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text, #0f172a)" }}>
              {user.fullName} <span style={{ color: "var(--color-text-secondary, #64748b)", fontWeight: 500 }}>(@{user.username})</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted, #94a3b8)", marginTop: "2px" }}>
              Designation: {user.roleLabel}
            </div>
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "var(--color-text-secondary, #64748b)",
              lineHeight: 1.5,
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              padding: "12px 14px",
              borderRadius: "8px",
            }}
          >
            <strong>Preservation Notice:</strong> Permanent deletion removes this account from all active employee directories and permanently revokes access. To safeguard regulatory compliance, past deliveries, financial transactions, and audit records created by this employee remain intact under their original name.
          </div>

          <div>
            <label
              htmlFor="deletion-reason"
              style={{ display: "block", fontSize: "12.5px", fontWeight: 650, marginBottom: "6px" }}
            >
              Permanent Deletion Reason <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <textarea
              id="deletion-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g., Resignation completed; clearance issued; data archived per corporate retention policy."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--color-border, #cbd5e1)",
                fontSize: "13px",
                fontFamily: "inherit",
                background: "var(--color-surface, #ffffff)",
                color: "inherit",
                resize: "vertical",
              }}
              disabled={isDeleting}
            />
            <span style={{ fontSize: "11px", color: "var(--color-text-muted, #94a3b8)" }}>
              Minimum 5 characters required for executive audit documentation.
            </span>
          </div>
        </div>

        <footer
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--color-border, #e2e8f0)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            background: "var(--color-surface-subtle, #f8fafc)",
          }}
        >
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={isDeleting}
            style={{ minHeight: "36px", padding: "0 16px", fontSize: "12.5px" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={isDeleting || reason.trim().length < 5}
            style={{
              minHeight: "36px",
              padding: "0 18px",
              fontSize: "12.5px",
              fontWeight: 650,
              background: "#dc2626",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              cursor: isDeleting || reason.trim().length < 5 ? "not-allowed" : "pointer",
              opacity: isDeleting || reason.trim().length < 5 ? 0.6 : 1,
            }}
          >
            {isDeleting ? "Deleting..." : "Permanently Delete"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
