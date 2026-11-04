"use client";

import { type FormEvent, useEffect, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { OperationalTopbar } from "@/components/operational-topbar";
import { PasswordCriteriaList } from "@/components/password-criteria-list";
import {
  evaluatePasswordCriteria,
  PREDEFINED_SECURITY_QUESTIONS,
  validateUsernameFormat,
} from "@/lib/auth/password-policy";
import { ROLE_METADATA, USER_ROLES } from "@/lib/auth/rbac";

export default function SettingsPage() {
  const actor = useAuthenticatedActor();
  const [currentUsername, setCurrentUsername] = useState(actor.username);

  // Change Username form
  const [newUsername, setNewUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameFeedback, setUsernameFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [usernameSubmitting, setUsernameSubmitting] = useState(false);

  // Change Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Security Question form
  const [currentQuestion, setCurrentQuestion] = useState<string>("Not yet configured");
  const [selectedQuestion, setSelectedQuestion] = useState<string>(PREDEFINED_SECURITY_QUESTIONS[0]);
  const [isCustomQuestion, setIsCustomQuestion] = useState(false);
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [confirmSecurityAnswer, setConfirmSecurityAnswer] = useState("");
  const [securityPassword, setSecurityPassword] = useState("");
  const [securityFeedback, setSecurityFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [securitySubmitting, setSecuritySubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && data.actor) {
          if (data.actor.username) setCurrentUsername(data.actor.username);
          if (data.actor.securityQuestion) setCurrentQuestion(data.actor.securityQuestion);
        }
      })
      .catch(() => {});
  }, []);

  async function handleUsernameSubmit(e: FormEvent) {
    e.preventDefault();
    setUsernameFeedback(null);

    const check = validateUsernameFormat(newUsername);
    if (!check.isValid) {
      setUsernameFeedback({ tone: "error", text: check.message || "Invalid username format." });
      return;
    }

    if (!usernamePassword) {
      setUsernameFeedback({ tone: "error", text: "Enter your current password to confirm username change." });
      return;
    }

    setUsernameSubmitting(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-username",
          newUsername: newUsername.trim(),
          currentPassword: usernamePassword,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Failed to update username.");
      }

      setCurrentUsername(data.profile?.username || newUsername.trim());
      setNewUsername("");
      setUsernamePassword("");
      setUsernameFeedback({ tone: "success", text: data.message ?? "Username updated successfully." });
    } catch (err) {
      setUsernameFeedback({ tone: "error", text: err instanceof Error ? err.message : "Error updating username." });
    } finally {
      setUsernameSubmitting(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordFeedback(null);

    const criteria = evaluatePasswordCriteria(newPassword);
    if (!criteria.isValid) {
      setPasswordFeedback({ tone: "error", text: criteria.errors[0] || "Password does not meet criteria." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ tone: "error", text: "New passwords do not match." });
      return;
    }

    if (!currentPassword) {
      setPasswordFeedback({ tone: "error", text: "Enter your current password." });
      return;
    }

    setPasswordSubmitting(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-password",
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Failed to update password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback({ tone: "success", text: "Password changed successfully." });
    } catch (err) {
      setPasswordFeedback({ tone: "error", text: err instanceof Error ? err.message : "Error updating password." });
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function handleSecurityQuestionSubmit(e: FormEvent) {
    e.preventDefault();
    setSecurityFeedback(null);

    const finalQuestion = isCustomQuestion ? customQuestionText.trim() : selectedQuestion;
    if (!finalQuestion) {
      setSecurityFeedback({ tone: "error", text: "Select or enter a security question." });
      return;
    }

    if (!securityAnswer.trim() || securityAnswer.trim().length < 2) {
      setSecurityFeedback({ tone: "error", text: "Security answer must be at least 2 characters long." });
      return;
    }

    if (securityAnswer.trim() !== confirmSecurityAnswer.trim()) {
      setSecurityFeedback({ tone: "error", text: "Security answers do not match." });
      return;
    }

    if (!securityPassword) {
      setSecurityFeedback({ tone: "error", text: "Enter your current password to save security question." });
      return;
    }

    setSecuritySubmitting(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-security-question",
          question: finalQuestion,
          answer: securityAnswer.trim(),
          confirmAnswer: confirmSecurityAnswer.trim(),
          currentPassword: securityPassword,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Failed to update security question.");
      }

      setCurrentQuestion(finalQuestion);
      setSecurityAnswer("");
      setConfirmSecurityAnswer("");
      setSecurityPassword("");
      setSecurityFeedback({ tone: "success", text: "Security question and answer saved." });
    } catch (err) {
      setSecurityFeedback({ tone: "error", text: err instanceof Error ? err.message : "Error updating security question." });
    } finally {
      setSecuritySubmitting(false);
    }
  }

  return (
    <>
      <OperationalTopbar contextLabel="Settings" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <h1>Account Settings</h1>
            <p className="subtitle">
              Manage your RouteX credentials, username, and security settings.
            </p>
          </div>
          <span className={`access-pill ${actor.accessLevel}`}>
            {actor.roleLabel} · {actor.accessLevelLabel}
          </span>
        </header>

        {/* 1. Account Information */}
        <section className="records-card" style={{ marginTop: "24px" }} aria-label="Account Information">
          <div className="records-heading">
            <div>
              <h2>Account Information</h2>
              <p>Your current profile and role assignments.</p>
            </div>
          </div>
          <div style={{ padding: "0 23px 22px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <span style={{ display: "block", color: "var(--color-text-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                Username
              </span>
              <strong style={{ fontSize: "16px", color: "var(--color-accent-deep)" }}>
                @{currentUsername}
              </strong>
            </div>
            <div>
              <span style={{ display: "block", color: "var(--color-text-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                Full Name
              </span>
              <strong style={{ fontSize: "16px" }}>{actor.fullName}</strong>
            </div>
            <div>
              <span style={{ display: "block", color: "var(--color-text-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                Assigned Role (Non-Editable)
              </span>
              <div style={{ marginTop: "4px" }}>
                <span className={`access-pill ${actor.accessLevel}`}>
                  {actor.roleLabel} ({actor.accessLevelLabel})
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Change Username */}
        <section className="records-card" style={{ marginTop: "24px" }} aria-label="Change Username">
          <div className="records-heading">
            <div>
              <h2>Change Username</h2>
              <p>Update your primary login identifier. Preserves your user ID, role, and history.</p>
            </div>
          </div>

          <form onSubmit={handleUsernameSubmit} style={{ padding: "0 23px 22px", display: "grid", gap: "14px", maxWidth: "560px" }}>
            {usernameFeedback ? (
              <div
                style={{
                  padding: "9px 13px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  background: usernameFeedback.tone === "success" ? "rgba(15, 138, 79, 0.08)" : "rgba(220, 38, 38, 0.08)",
                  border: `1px solid ${usernameFeedback.tone === "success" ? "rgba(15, 138, 79, 0.25)" : "rgba(220, 38, 38, 0.25)"}`,
                  color: usernameFeedback.tone === "success" ? "var(--color-status-success)" : "#991b1b",
                }}
              >
                {usernameFeedback.text}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700 }}>Current Username</label>
              <input
                type="text"
                disabled
                value={`@${currentUsername}`}
                style={{ minHeight: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-page)", color: "var(--color-text-muted)" }}
              />
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700 }}>New Username</label>
              <input
                type="text"
                required
                placeholder="e.g. shinryu"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                style={{ minHeight: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
              />
              <small style={{ color: "var(--color-text-muted)", fontSize: "10.5px" }}>
                3-30 characters, letters, numbers, underscores, dots, and hyphens. Case-insensitive unique.
              </small>
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700 }}>Confirm Current Password</label>
              <input
                type="password"
                required
                placeholder="Enter current password"
                value={usernamePassword}
                onChange={(e) => setUsernamePassword(e.target.value)}
                style={{ minHeight: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
              />
            </div>

            <button
              type="submit"
              className="primary-action-button"
              disabled={usernameSubmitting}
              style={{ minHeight: "42px", justifySelf: "start", padding: "0 18px" }}
            >
              {usernameSubmitting ? "Updating…" : "Save Username"}
            </button>
          </form>
        </section>

        {/* 3. Change Password */}
        <section className="records-card" style={{ marginTop: "24px" }} aria-label="Change Password">
          <div className="records-heading">
            <div>
              <h2>Change Password</h2>
              <p>Update your permanent login password. Secured using Argon2id.</p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} style={{ padding: "0 23px 22px", display: "grid", gap: "14px", maxWidth: "560px" }}>
            {passwordFeedback ? (
              <div
                style={{
                  padding: "9px 13px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  background: passwordFeedback.tone === "success" ? "rgba(15, 138, 79, 0.08)" : "rgba(220, 38, 38, 0.08)",
                  border: `1px solid ${passwordFeedback.tone === "success" ? "rgba(15, 138, 79, 0.25)" : "rgba(220, 38, 38, 0.25)"}`,
                  color: passwordFeedback.tone === "success" ? "var(--color-status-success)" : "#991b1b",
                }}
              >
                {passwordFeedback.text}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700 }}>Current Password</label>
              <input
                type="password"
                required
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{ minHeight: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
              />
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700 }}>New Password</label>
              <input
                type="password"
                required
                placeholder="Enter new password (min. 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ minHeight: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
              />
              <PasswordCriteriaList password={newPassword} />
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700 }}>Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ minHeight: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
              />
            </div>

            <button
              type="submit"
              className="primary-action-button"
              disabled={passwordSubmitting}
              style={{ minHeight: "42px", justifySelf: "start", padding: "0 18px" }}
            >
              {passwordSubmitting ? "Updating…" : "Update Password"}
            </button>
          </form>
        </section>

        {/* 4. Security Question */}
        <section className="records-card" style={{ marginTop: "24px" }} aria-label="Security Question">
          <div className="records-heading">
            <div>
              <h2>Security Question & Password Recovery</h2>
              <p>Configure the security question used for self-service password recovery.</p>
            </div>
          </div>

          <form onSubmit={handleSecurityQuestionSubmit} style={{ padding: "0 23px 22px", display: "grid", gap: "14px", maxWidth: "560px" }}>
            {securityFeedback ? (
              <div
                style={{
                  padding: "9px 13px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  background: securityFeedback.tone === "success" ? "rgba(15, 138, 79, 0.08)" : "rgba(220, 38, 38, 0.08)",
                  border: `1px solid ${securityFeedback.tone === "success" ? "rgba(15, 138, 79, 0.25)" : "rgba(220, 38, 38, 0.25)"}`,
                  color: securityFeedback.tone === "success" ? "var(--color-status-success)" : "#991b1b",
                }}
              >
                {securityFeedback.text}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                Active Question
              </span>
              <div style={{ fontSize: "13px", fontWeight: 600, padding: "8px 12px", borderRadius: "8px", background: "var(--color-accent-soft)", color: "var(--color-accent-deep)" }}>
                {currentQuestion}
              </div>
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700 }}>Choose New Question</label>
              <select
                value={isCustomQuestion ? "custom" : selectedQuestion}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    setIsCustomQuestion(true);
                  } else {
                    setIsCustomQuestion(false);
                    setSelectedQuestion(e.target.value);
                  }
                }}
                style={{
                  minHeight: "42px",
                  padding: "0 12px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  fontSize: "12px",
                }}
              >
                {PREDEFINED_SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
                <option value="custom">Enter custom question…</option>
              </select>

              {isCustomQuestion ? (
                <input
                  type="text"
                  required
                  placeholder="Enter your custom security question"
                  value={customQuestionText}
                  onChange={(e) => setCustomQuestionText(e.target.value)}
                  style={{ minHeight: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-surface)", marginTop: "4px" }}
                />
              ) : null}
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700 }}>Security Answer (Case-sensitive)</label>
              <input
                type="text"
                required
                placeholder="Enter your security answer"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                style={{ minHeight: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
              />
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700 }}>Confirm Security Answer</label>
              <input
                type="text"
                required
                placeholder="Confirm your security answer"
                value={confirmSecurityAnswer}
                onChange={(e) => setConfirmSecurityAnswer(e.target.value)}
                style={{ minHeight: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
              />
              <small style={{ color: "var(--color-text-muted)", fontSize: "10.5px" }}>
                Answers are case-sensitive and hashed using Argon2id. Stored answers are never revealed.
              </small>
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700 }}>Confirm Current Password</label>
              <input
                type="password"
                required
                placeholder="Enter current password"
                value={securityPassword}
                onChange={(e) => setSecurityPassword(e.target.value)}
                style={{ minHeight: "42px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
              />
            </div>

            <button
              type="submit"
              className="primary-action-button"
              disabled={securitySubmitting}
              style={{ minHeight: "42px", justifySelf: "start", padding: "0 18px" }}
            >
              {securitySubmitting ? "Saving…" : "Save Security Question"}
            </button>
          </form>
        </section>

        {/* 5. Role & Permission Matrix Reference */}
        <section
          className="records-card"
          style={{ marginTop: "34px" }}
          aria-label="Role and permission matrix"
        >
          <div className="records-heading">
            <div>
              <h2>Role & Access Level Reference</h2>
              <p>Access for six company roles.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Access Level</th>
                  <th>Deliveries & Drop-offs</th>
                  <th>Excel Import & Review</th>
                  <th>POD & Documents</th>
                  <th>User Management</th>
                </tr>
              </thead>
              <tbody>
                {USER_ROLES.map((roleKey) => {
                  const meta = ROLE_METADATA[roleKey];
                  const canWrite = meta.accessLevel !== "view_only";
                  const isAdmin = meta.accessLevel === "admin";
                  return (
                    <tr key={roleKey}>
                      <td>
                        <strong>{meta.label}</strong>
                      </td>
                      <td>
                        <span className={`access-pill ${meta.accessLevel}`}>
                          {meta.accessLevelLabel}
                        </span>
                      </td>
                      <td>{canWrite ? "Create, Edit & View" : "View-Only"}</td>
                      <td>{canWrite ? "Upload, Review & Confirm" : "No Access"}</td>
                      <td>{canWrite ? "Upload & Manage" : "View-Only"}</td>
                      <td>{isAdmin ? "Full Admin Control" : "Restricted"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
