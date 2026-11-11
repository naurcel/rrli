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
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                fontSize: "10px",
                background: item.valid
                  ? "color-mix(in srgb, var(--color-status-success) 14%, transparent)"
                  : "color-mix(in srgb, var(--color-border) 60%, transparent)",
                color: item.valid ? "var(--color-status-success)" : "var(--color-text-muted)",
              }}
            >
              {item.valid ? "✓" : "•"}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

