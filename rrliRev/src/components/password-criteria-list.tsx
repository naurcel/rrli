"use client";

import { evaluatePasswordCriteria } from "@/lib/auth/password-policy";

export function PasswordCriteriaList({ password }: { password: string }) {
  const { checks } = evaluatePasswordCriteria(password);

  const items = [
    { label: "At least 8 characters", valid: checks.minLength && checks.maxLength },
    { label: "At least one letter", valid: checks.hasLetter },
    { label: "At least one number", valid: checks.hasNumber },
  ];

  return (
    <div className="password-criteria-checklist" style={{ marginTop: "8px", fontSize: "11px" }}>
      <div style={{ color: "var(--color-text-muted)", marginBottom: "4px", fontWeight: 600 }}>
        Password requirements:
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "4px" }}>
        {items.map((item, idx) => (
          <li
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: item.valid ? "var(--color-status-success)" : "var(--color-text-muted)",
              fontWeight: item.valid ? 600 : 400,
              transition: "color .15s ease",
            }}
          >
            <span
              style={{
                display: "inline-grid",
                placeItems: "center",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                flexShrink: 0,
                background: item.valid
                  ? "rgba(16, 185, 129, 0.14)"
                  : "rgba(0, 0, 0, 0.05)",
                color: item.valid ? "var(--color-status-success)" : "var(--color-text-muted)",
                transition: "all .2s ease",
              }}
            >
              {item.valid ? (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "currentColor", opacity: 0.6 }} />
              )}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

