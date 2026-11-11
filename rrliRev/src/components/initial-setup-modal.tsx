"use client";

import { useState, type FormEvent } from "react";
import { PasswordCriteriaList } from "./password-criteria-list";
import { RoundedSelect, type SelectOption } from "./rounded-select";
import { PREDEFINED_SECURITY_QUESTIONS } from "@/lib/auth/password-policy";
import { evaluatePasswordCriteria } from "@/lib/auth/password-policy";

const SECURITY_QUESTION_OPTIONS: readonly SelectOption[] = [
  ...PREDEFINED_SECURITY_QUESTIONS.map((q) => ({
    value: q,
    label: q,
  })),
  {
    value: "custom",
    label: "Enter a custom question…",
  },
];

export function InitialSetupModal({ username }: { username: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [question, setQuestion] = useState<string>(PREDEFINED_SECURITY_QUESTIONS[0]);
  const [isCustomQuestion, setIsCustomQuestion] = useState(false);
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [answer, setAnswer] = useState("");
  const [confirmAnswer, setConfirmAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwdValidation = evaluatePasswordCriteria(newPassword);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!pwdValidation.isValid) {
      setError(pwdValidation.errors[0] || "Password does not satisfy all criteria.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    const selectedQuestion = isCustomQuestion ? customQuestionText.trim() : question;
    if (!selectedQuestion) {
      setError("Please select or enter a security question.");
      return;
    }

    if (!answer.trim() || answer.trim().length < 2) {
      setError("Security answer must be at least 2 characters long.");
      return;
    }

    if (answer.trim() !== confirmAnswer.trim()) {
      setError("Security answers do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initial-setup",
          newPassword,
          confirmPassword,
          question: selectedQuestion,
          answer: answer.trim(),
          confirmAnswer: confirmAnswer.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? "Unable to complete initial setup.");
      }

      // Reload so the layout receives the updated mustChangePassword: false status
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 21, 0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-modal-title"
    >
      <div
        className="records-card"
        style={{
          width: "min(100%, 520px)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "28px 24px",
          background: "var(--color-surface)",
          boxShadow: "0 24px 64px rgba(15, 23, 21, 0.3)",
          borderRadius: "16px",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "18px",
              padding: "2px 6px",
              borderRadius: "4px",
              background: "rgba(245, 158, 11, 0.12)",
              color: "var(--color-accent-deep)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            First-Login Setup
          </span>
          <h2 id="setup-modal-title" style={{ margin: "0 0 6px", fontSize: "20px" }}>
            Complete Account Setup
          </h2>
          <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "12px", lineHeight: 1.5 }}>
            Set a permanent password and security question for <strong>@{username}</strong>.
          </p>
        </div>

        {error ? (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(220, 38, 38, 0.08)",
              border: "1px solid rgba(220, 38, 38, 0.2)",
              color: "#991b1b",
              fontSize: "12px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700 }}>
              New Permanent Password
            </label>
            <input
              type="password"
              required
              placeholder="Enter at least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                minHeight: "42px",
                padding: "0 12px",
                borderRadius: "10px",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            />
            <PasswordCriteriaList password={newPassword} />
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700 }}>
              Confirm New Permanent Password
            </label>
            <input
              type="password"
              required
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                minHeight: "42px",
                padding: "0 12px",
                borderRadius: "10px",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            />
          </div>

          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "8px 0" }} />

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700 }}>
              Security Question
            </label>
            <RoundedSelect
              value={isCustomQuestion ? "custom" : question}
              options={SECURITY_QUESTION_OPTIONS}
              onChange={(val) => {
                if (val === "custom") {
                  setIsCustomQuestion(true);
                } else {
                  setIsCustomQuestion(false);
                  setQuestion(val);
                }
              }}
              ariaLabel="Security Question"
              className="is-form-select"
            />

            {isCustomQuestion ? (
              <input
                type="text"
                required
                placeholder="Enter your custom question"
                value={customQuestionText}
                onChange={(e) => setCustomQuestionText(e.target.value)}
                style={{
                  minHeight: "42px",
                  padding: "0 12px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  marginTop: "6px",
                }}
              />
            ) : null}
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700 }}>
              Security Answer (Case-sensitive)
            </label>
            <input
              type="text"
              required
              placeholder="Enter your answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              style={{
                minHeight: "42px",
                padding: "0 12px",
                borderRadius: "10px",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700 }}>
              Confirm Security Answer
            </label>
            <input
              type="text"
              required
              placeholder="Confirm your answer"
              value={confirmAnswer}
              onChange={(e) => setConfirmAnswer(e.target.value)}
              style={{
                minHeight: "42px",
                padding: "0 12px",
                borderRadius: "10px",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            />
            <small style={{ color: "var(--color-text-muted)", fontSize: "10.5px" }}>
              Answers are case-sensitive and hashed securely with Argon2id.
            </small>
          </div>

          <button
            type="submit"
            className="primary-action-button"
            disabled={submitting}
            style={{ minHeight: "44px", marginTop: "12px", width: "100%", justifyContent: "center" }}
          >
            {submitting ? "Saving credentials…" : "Save & Continue to RouteX →"}
          </button>
        </form>
      </div>
    </div>
  );
}

