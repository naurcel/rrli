"use client";

import { evaluatePasswordCriteria } from "@/lib/auth/password-policy";

export function PasswordCriteriaList({ password }: { password: string }) {
  const { checks } = evaluatePasswordCriteria(password);

  const items = [
    { label: "At least 8 characters (max 128)", valid: checks.minLength && checks.maxLength },
    { label: "Contains at least one letter (a-z, A-Z)", valid: checks.hasLetter },
    { label: "Contains at least one number (0-9)", valid: checks.hasNumber },
    { label: "Not commonly used or easily guessed", valid: checks.notCommon && checks.notWhitespaceOnly },
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

