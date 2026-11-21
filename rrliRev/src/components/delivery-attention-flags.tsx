"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addDeliveryAttentionFlag,
  deleteDeliveryAttentionFlag,
  DELIVERY_FLAGS_CHANGED_EVENT,
  getDeliveryAttentionFlags,
  PRESET_FLAG_SUGGESTIONS,
  toggleDeliveryAttentionFlag,
  type DeliveryAttentionFlag,
  type DeliveryFlagCategory,
} from "@/features/deliveries/delivery-attention-flags";

interface DeliveryAttentionFlagsProps {
  deliveryId: string;
  waybillNumber: string;
  canManage: boolean;
  currentUser?: string;
}

export function DeliveryAttentionFlags({
  deliveryId,
  waybillNumber,
  canManage,
  currentUser = "Operations",
}: DeliveryAttentionFlagsProps) {
  const [flags, setFlags] = useState<DeliveryAttentionFlag[]>([]);
  const [inputText, setInputText] = useState("");
  const [category, setCategory] = useState<DeliveryFlagCategory>("missing_document");
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    function loadFlags() {
      setFlags(getDeliveryAttentionFlags(deliveryId));
    }

    loadFlags();

    function handleFlagsChanged() {
      loadFlags();
    }

    window.addEventListener(DELIVERY_FLAGS_CHANGED_EVENT, handleFlagsChanged);
    window.addEventListener("storage", handleFlagsChanged);
    return () => {
      window.removeEventListener(DELIVERY_FLAGS_CHANGED_EVENT, handleFlagsChanged);
      window.removeEventListener("storage", handleFlagsChanged);
    };
  }, [deliveryId]);

  const unresolvedFlags = flags.filter((f) => !f.resolved);
  const resolvedFlags = flags.filter((f) => f.resolved);

  function handleAddFlag(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    try {
      addDeliveryAttentionFlag(deliveryId, text, {
        category,
        createdBy: currentUser,
      });
      setInputText("");
      toast.success("Attention flag added", {
        description: `Flag added to Waybill #${waybillNumber}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to add attention flag.");
    }
  }

  function handleToggle(flagId: string) {
    const updated = toggleDeliveryAttentionFlag(deliveryId, flagId, currentUser);
    if (!updated) return;
    if (updated.resolved) {
      toast.success("Flag marked as resolved", {
        description: updated.text,
      });
    } else {
      toast.info("Flag reopened", {
        description: updated.text,
      });
    }
  }

  function handleDelete(flagId: string, text: string) {
    const ok = deleteDeliveryAttentionFlag(deliveryId, flagId);
    if (ok) {
      toast.success("Flag removed", {
        description: text,
      });
    }
  }

  function formatTimestamp(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  const categoryLabels: Record<
    DeliveryFlagCategory,
    { label: string; tone: string; renderIcon: () => React.ReactNode }
  > = {
    missing_document: {
      label: "Missing Document",
      tone: "tone-warning",
      renderIcon: () => (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
    },
    attention_needed: {
      label: "Attention Needed",
      tone: "tone-danger",
      renderIcon: () => (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    general_note: {
      label: "Note",
      tone: "tone-primary",
      renderIcon: () => (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
  };

  return (
    <section
      id="delivery-attention-flags-card"
      className="records-card delivery-section-card delivery-attention-card"
      aria-label="Attention and Missing Items"
      style={{ scrollMarginTop: "90px" }}
    >
      <div className="section-card-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h2 className="section-card-title">Attention &amp; Missing Items</h2>
            {unresolvedFlags.length > 0 ? (
              <span
                className="routex-badge tone-warning"
                style={{
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: "rgba(245, 158, 11, 0.14)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
                {unresolvedFlags.length} {unresolvedFlags.length === 1 ? "OPEN FLAG" : "OPEN FLAGS"}
              </span>
            ) : flags.length > 0 ? (
              <span
                className="routex-badge tone-success"
                style={{
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: "rgba(16, 185, 129, 0.12)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                ALL RESOLVED
              </span>
            ) : null}
          </div>
          <p className="section-card-subtitle">
            Custom operational notes for missing documents, required slips, or follow-ups known to you
          </p>
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        {/* Quick Add Form */}
        {canManage ? (
          <form
            onSubmit={handleAddFlag}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "14px 16px",
              borderRadius: "10px",
              border: "1px dashed var(--color-border, #e2e8f0)",
              background: "var(--color-surface-subtle, #f8fafc)",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <select
                aria-label="Flag category"
                value={category}
                onChange={(e) => setCategory(e.target.value as DeliveryFlagCategory)}
                style={{
                  height: "38px",
                  padding: "0 10px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--color-border, #cbd5e1)",
                  background: "var(--color-surface, #ffffff)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-primary, #0f172a)",
                  cursor: "pointer",
                }}
              >
                <option value="missing_document">Missing Document</option>
                <option value="attention_needed">Attention Needed</option>
                <option value="general_note">General Note</option>
              </select>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="e.g. Awaiting client-signed receiving copy, Need gate pass from security..."
                aria-label="Attention item description"
                style={{
                  flex: 1,
                  minWidth: "220px",
                  height: "38px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--color-border, #cbd5e1)",
                  background: "var(--color-surface, #ffffff)",
                  fontSize: "13px",
                  color: "var(--color-text-primary, #0f172a)",
                }}
              />

              <button
                type="submit"
                className="primary-action-button"
                disabled={!inputText.trim()}
                style={{
                  height: "38px",
                  padding: "0 16px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
                <span>Flag Item</span>
              </button>
            </div>

            {/* Quick Suggestions Pills */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted, #94a3b8)" }}>
                Quick flag:
              </span>
              {PRESET_FLAG_SUGGESTIONS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setInputText(preset.text);
                    setCategory(preset.category);
                  }}
                  style={{
                    background: "var(--color-surface, #ffffff)",
                    border: "1px solid var(--color-border, #cbd5e1)",
                    borderRadius: "6px",
                    padding: "3px 8px",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "var(--color-text-secondary, #475569)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title={preset.text}
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </form>
        ) : null}

        {/* Unresolved Active Flags List */}
        {unresolvedFlags.length === 0 && resolvedFlags.length === 0 ? (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              borderRadius: "8px",
              background: "var(--color-surface-subtle, #f8fafc)",
              border: "1px dashed var(--color-border, #e2e8f0)",
              color: "var(--color-text-muted, #94a3b8)",
              fontSize: "12.5px",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-border, #e2e8f0)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 8px",
                color: "var(--color-text-muted)",
              }}
              aria-hidden="true"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </div>
            <div>No custom attention flags. All known documentation and items are clear.</div>
          </div>
        ) : null}

        {unresolvedFlags.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
            {unresolvedFlags.map((flag) => {
              const catInfo = categoryLabels[flag.category] ?? categoryLabels.missing_document;
              return (
                <div
                  key={flag.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "rgba(245, 158, 11, 0.06)",
                    border: "1.5px solid rgba(245, 158, 11, 0.32)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, minWidth: 0 }}>
                    {canManage ? (
                      <input
                        type="checkbox"
                        checked={flag.resolved}
                        onChange={() => handleToggle(flag.id)}
                        aria-label={`Mark "${flag.text}" as resolved`}
                        title="Click when document/item is received"
                        style={{
                          marginTop: "3px",
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                          accentColor: "var(--color-status-success, #059669)",
                        }}
                      />
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", marginTop: "3px", color: "var(--color-accent-deep)" }} aria-hidden="true">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" y1="22" x2="4" y2="15" />
                        </svg>
                      </span>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span
                          className={`routex-badge ${catInfo.tone}`}
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {catInfo.renderIcon()} {catInfo.label}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--color-text-muted, #94a3b8)" }}>
                          Added {formatTimestamp(flag.createdAt)} by @{flag.createdBy}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--color-text-primary, #0f172a)",
                          lineHeight: 1.45,
                          wordBreak: "break-word",
                        }}
                      >
                        {flag.text}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleToggle(flag.id)}
                          style={{ fontSize: "11px", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: "3px" }}
                          title="Mark resolved"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Settle
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(flag.id, flag.text)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--color-text-muted, #94a3b8)",
                            cursor: "pointer",
                            padding: "4px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          aria-label="Delete flag"
                          title="Remove flag"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Resolved / Cleared Items */}
        {resolvedFlags.length > 0 ? (
          <div style={{ marginTop: unresolvedFlags.length > 0 ? "10px" : "0" }}>
            <button
              type="button"
              onClick={() => setShowResolved(!showResolved)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-text-secondary, #64748b)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 0",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>{showResolved ? "▾ Hide" : "▸ Show"} settled items ({resolvedFlags.length})</span>
            </button>

            {showResolved ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                {resolvedFlags.map((flag) => (
                  <div
                    key={flag.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "var(--color-surface-subtle, #f8fafc)",
                      border: "1px solid var(--color-border-subtle, #e2e8f0)",
                      opacity: 0.75,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      {canManage ? (
                        <input
                          type="checkbox"
                          checked={flag.resolved}
                          onChange={() => handleToggle(flag.id)}
                          aria-label={`Uncheck "${flag.text}"`}
                          title="Click to reopen"
                          style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#059669" }}
                        />
                      ) : (
                        <span style={{ color: "#059669", display: "inline-flex", alignItems: "center" }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--color-text-muted, #64748b)",
                          textDecoration: "line-through",
                        }}
                      >
                        {flag.text}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "10.5px", color: "var(--color-text-muted, #94a3b8)" }}>
                        Settled {flag.resolvedAt ? formatTimestamp(flag.resolvedAt) : ""}
                      </span>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(flag.id, flag.text)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--color-text-muted, #94a3b8)",
                            cursor: "pointer",
                            padding: "2px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          aria-label="Delete settled flag"
                          title="Remove"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
