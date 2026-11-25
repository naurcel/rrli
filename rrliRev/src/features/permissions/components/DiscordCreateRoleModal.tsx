"use client";

import { type FormEvent } from "react";
import { createPortal } from "react-dom";

interface DiscordCreateRoleModalProps {
  isOpen: boolean;
  isCreatingRole: boolean;
  newRoleName: string;
  newRoleDesc: string;
  onRoleNameChange: (val: string) => void;
  onRoleDescChange: (val: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function DiscordCreateRoleModal({
  isOpen,
  isCreatingRole,
  newRoleName,
  newRoleDesc,
  onRoleNameChange,
  onRoleDescChange,
  onSubmit,
  onClose,
}: DiscordCreateRoleModalProps) {
  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="routex-dialog-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-role-modal-title"
      style={{ zIndex: 1000 }}
    >
      <div
        className="routex-dialog-backdrop"
        onClick={() => !isCreatingRole && onClose()}
      />
      <div
        className="routex-dialog"
        style={{ maxWidth: "440px", width: "92vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="routex-dialog-header">
          <h3 id="create-role-modal-title" className="routex-dialog-title">
            Create Custom Role
          </h3>
          <button
            type="button"
            className="routex-dialog-close"
            aria-label="Close create role modal"
            title="Close (Esc)"
            disabled={isCreatingRole}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form onSubmit={onSubmit}>
          <div
            className="routex-dialog-body"
            style={{
              padding: "18px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div className="routex-dialog-field">
              <label htmlFor="create-role-name">
                Role Name <span className="required-asterisk" aria-hidden="true">*</span>
              </label>
              <input
                id="create-role-name"
                type="text"
                placeholder="e.g. Fleet Supervisor, Logistics Dispatcher"
                value={newRoleName}
                onChange={(e) => onRoleNameChange(e.target.value)}
                disabled={isCreatingRole}
                required
                autoFocus
              />
            </div>

            <div className="routex-dialog-field">
              <label htmlFor="create-role-desc">
                Description <span className="field-required-tag">(Optional)</span>
              </label>
              <input
                id="create-role-desc"
                type="text"
                placeholder="e.g. Oversees truck maintenance and driver dispatch"
                value={newRoleDesc}
                onChange={(e) => onRoleDescChange(e.target.value)}
                disabled={isCreatingRole}
              />
            </div>
          </div>

          <footer className="routex-dialog-footer">
            <button
              type="button"
              className="secondary-button"
              disabled={isCreatingRole}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-action-button"
              disabled={isCreatingRole}
            >
              {isCreatingRole ? "Creating…" : "Create Role"}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
