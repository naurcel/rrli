"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordCriteriaList } from "@/components/password-criteria-list";
import { RouteXFooter } from "@/components/routex-footer";
import { LoginVisualCarousel } from "@/components/login-visual-carousel";
import { evaluatePasswordCriteria } from "@/lib/auth/password-policy";
import { toast } from "sonner";

type AuthViewMode = "login" | "forgot-password";
type ForgotStep = "username" | "security_question" | "backup_key" | "reset_password" | "replacement_key";

export default function LoginPage() {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<AuthViewMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<ForgotStep>("username");
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [hasBackupKey, setHasBackupKey] = useState(false);
  const [hasSecurityQuestion, setHasSecurityQuestion] = useState(false);
  const [backupKeyInput, setBackupKeyInput] = useState("");
  const [replacementKey, setReplacementKey] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [recoveryMode, setRecoveryMode] = useState<"admin" | "security_question" | "backup_key">("security_question");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    try {
      const currentTheme =
        document.documentElement.dataset.theme ??
        window.localStorage.getItem("routex-theme");
      setIsDark(currentTheme === "dark");

      const rememberedUser = window.localStorage.getItem("routex-remembered-username");
      if (rememberedUser) {
        setUsername(rememberedUser);
      }
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      const themeValue = next ? "dark" : "light";
      document.documentElement.dataset.theme = themeValue;
      try {
        window.localStorage.setItem("routex-theme", themeValue);
      } catch {
        // Ignore storage restrictions
      }
      return next;
    });
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const trimmedIdentifier = username.trim();
    if (!trimmedIdentifier) {
      setStatus("error");
      setMessage("Enter your email address.");
      return;
    }

    if (!password) {
      setStatus("error");
      setMessage("Enter your password.");
      return;
    }

    const nextParam =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next")
        : null;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedIdentifier,
          username: trimmedIdentifier,
          password,
          rememberMe,
          next: nextParam,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        redirectTo?: string;
        actor?: { fullName?: string; username?: string; roleLabel?: string; accessLevelLabel?: string };
      } | null;

      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setMessage(
          payload?.message ?? "The username or password you entered is incorrect.",
        );
        return;
      }

      try {
        if (rememberMe) {
          window.localStorage.setItem("routex-remembered-username", trimmedIdentifier);
        } else {
          window.localStorage.removeItem("routex-remembered-username");
        }
      } catch {
        // Ignore storage errors
      }

      setStatus("success");
      setMessage(
        `Authenticated as ${payload.actor?.username ?? trimmedIdentifier} (${payload.actor?.roleLabel ?? "Authorized"}). Redirecting…`,
      );

      const destination = payload.redirectTo ?? "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Authentication could not be completed. Please try again.");
    }
  }

  // Step 1: Check username for recovery options
  async function handleRecoveryCheckUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const trimmed = recoveryUsername.trim();
    if (!trimmed) {
      setStatus("error");
      setMessage("Enter your registered RouteX email.");
      return;
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check-user",
          email: trimmed,
          username: trimmed,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        mode?: "admin_authorized" | "security_question";
        question?: string;
        hasBackupKey?: boolean;
        hasSecurityQuestion?: boolean;
        recoveryToken?: string;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setMessage(payload?.message ?? "No recovery options available. Contact an Administrator.");
        return;
      }

      setStatus("idle");
      setMessage("");
      setHasBackupKey(Boolean(payload.hasBackupKey));
      setHasSecurityQuestion(Boolean(payload.hasSecurityQuestion));

      if (payload.mode === "admin_authorized") {
        setRecoveryMode("admin");
        setResetToken(payload.recoveryToken || "");
        setForgotStep("reset_password");
        setMessage("Administrator-authorized password reset ready. Please set your new password below.");
      } else if (payload.hasSecurityQuestion && payload.question) {
        setRecoveryMode("security_question");
        setSecurityQuestion(payload.question || "");
        setForgotStep("security_question");
      } else if (payload.hasBackupKey) {
        setRecoveryMode("backup_key");
        setForgotStep("backup_key");
      }
    } catch {
      setStatus("error");
      setMessage("Unable to verify username. Please try again.");
    }
  }

  // Step 2a: Verify emergency backup key
  async function handleVerifyBackupKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const trimmedKey = backupKeyInput.trim();
    if (!trimmedKey) {
      setStatus("error");
      setMessage("Enter your emergency backup key.");
      return;
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify-backup-key",
          username: recoveryUsername.trim(),
          backupKey: trimmedKey,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        resetToken?: string;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setMessage(payload?.message ?? "The emergency backup key you entered is incorrect or already consumed.");
        return;
      }

      setStatus("idle");
      setMessage("");
      setRecoveryMode("backup_key");
      setResetToken(payload.resetToken || "");
      setForgotStep("reset_password");
    } catch {
      setStatus("error");
      setMessage("Unable to verify emergency backup key. Please try again.");
    }
  }

  // Step 2b: Verify security answer
  async function handleVerifySecurityAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const trimmedAnswer = securityAnswer.trim();
    if (!trimmedAnswer) {
      setStatus("error");
      setMessage("Enter your security answer.");
      return;
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify-answer",
          username: recoveryUsername.trim(),
          answer: trimmedAnswer,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        resetToken?: string;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setMessage(payload?.message ?? "The security answer you entered is incorrect.");
        return;
      }

      setStatus("idle");
      setMessage("");
      setResetToken(payload.resetToken || "");
      setForgotStep("reset_password");
    } catch {
      setStatus("error");
      setMessage("Unable to verify security answer. Please try again.");
    }
  }

  // Step 3: Set new permanent password
  async function handleResetPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const validation = evaluatePasswordCriteria(newPassword);
    if (!validation.isValid) {
      setStatus("error");
      setMessage(validation.errors[0] || "Password does not meet required criteria.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setStatus("error");
      setMessage("New passwords do not match.");
      return;
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          username: recoveryUsername.trim(),
          token: resetToken,
          mode: recoveryMode,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        replacementBackupKey?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setMessage(payload?.message ?? "Unable to reset password.");
        return;
      }

      if (payload.replacementBackupKey) {
        setReplacementKey(payload.replacementBackupKey);
        setForgotStep("replacement_key");
        setStatus("idle");
        setMessage("");
        setNewPassword("");
        setConfirmNewPassword("");
        setSecurityAnswer("");
        setBackupKeyInput("");
        return;
      }

      setStatus("success");
      setMessage(payload.message ?? "Password reset successfully. You can now log in.");
      toast.success("Password reset successfully!", {
        description: "You can now log in with your new password.",
      });
      setUsername(recoveryUsername.trim());
      setPassword("");
      setViewMode("login");
      setForgotStep("username");
      setNewPassword("");
      setConfirmNewPassword("");
      setSecurityAnswer("");
      setBackupKeyInput("");
    } catch {
      setStatus("error");
      setMessage("Password reset failed. Please try again.");
    }
  }

  return (
    <main
      className={`login-page login-layout-split${isDark ? " theme-dark" : ""}`}
      aria-busy={status === "submitting"}
    >
      <div className="login-tools" aria-label="Login page tools">
        <button
          className="theme-toggle"
          type="button"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
          onClick={toggleTheme}
        >
          {isDark ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>

      <LoginVisualCarousel />

      <section className="login-panel" aria-labelledby="sign-in-title">
        <div className="login-form-wrap">
          <img
            className="login-logo"
            src="/branding/redeemed-route-emblem.png"
            alt="Redeemed Route Logistics Inc."
          />
          <h2 id="sign-in-title">
            {viewMode === "login" ? "Log in" : "Password Recovery"}
          </h2>

          {viewMode === "login" ? (
            <form onSubmit={handleLoginSubmit} noValidate>
              <label>
                Email Address
                <input
                  name="email"
                  type="email"
                  placeholder="Enter your email address"
                  autoComplete="email"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </label>

              <label>
                Password
                <span className="password-control">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {showPassword ? (
                        <>
                          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z" />
                          <circle cx="12" cy="12" r="2.7" />
                          <line x1="3" y1="3" x2="21" y2="21" />
                        </>
                      ) : (
                        <>
                          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z" />
                          <circle cx="12" cy="12" r="2.7" />
                        </>
                      )}
                    </svg>
                  </button>
                </span>
              </label>

              <div className="login-options">
                <label className="remember-option">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />{" "}
                  Remember me
                </label>
              </div>

              {status === "error" && message ? (
                <p className="login-note error" role="alert">
                  <span>!</span>
                  {message}
                </p>
              ) : null}

              {status === "success" && message ? (
                <p className="login-note success" role="status">
                  <span>i</span>
                  {message}
                </p>
              ) : null}

              <button
                className="sign-in-button"
                type="submit"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Logging in…" : "Log in"}
              </button>

              <div className="login-forgot-wrap">
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => {
                    setViewMode("forgot-password");
                    setForgotStep("username");
                    setRecoveryUsername(username);
                    setStatus("idle");
                    setMessage("");
                  }}
                >
                  Forgot password?
                </button>
              </div>
            </form>
          ) : (
            <div className="forgot-password-flow">
              {forgotStep === "username" && (
                <form onSubmit={handleRecoveryCheckUsername} noValidate>
                  <label>
                    Registered Email Address
                    <input
                      name="recoveryEmail"
                      type="email"
                      placeholder="Enter your registered email"
                      autoComplete="email"
                      value={recoveryUsername}
                      onChange={(event) => setRecoveryUsername(event.target.value)}
                      required
                    />
                  </label>

                  <div className="login-options">
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                      Step 1 of 3: Identify Account
                    </span>
                  </div>

                  {status === "error" && message ? (
                    <p className="login-note error" role="alert">
                      <span>!</span>
                      {message}
                    </p>
                  ) : null}

                  <button
                    className="sign-in-button"
                    type="submit"
                    disabled={status === "submitting"}
                  >
                    {status === "submitting" ? "Verifying…" : "Continue →"}
                  </button>

                  <div className="login-forgot-wrap">
                    <button
                      type="button"
                      className="forgot-password-link"
                      onClick={() => {
                        setViewMode("login");
                        setStatus("idle");
                        setMessage("");
                      }}
                    >
                      ← Back to log in
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === "security_question" && (
                <form onSubmit={handleVerifySecurityAnswer} noValidate>
                  <div style={{ marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-accent-deep)" }}>
                      Security Question for @{recoveryUsername}:
                    </span>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", fontWeight: 600 }}>
                      {securityQuestion}
                    </p>
                  </div>

                  <label>
                    Your Answer (Case-sensitive)
                    <input
                      name="securityAnswer"
                      type="text"
                      placeholder="Enter your security answer"
                      value={securityAnswer}
                      onChange={(event) => setSecurityAnswer(event.target.value)}
                      required
                    />
                  </label>

                  <div className="login-options">
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                      Step 2 of 3: Security Verification
                    </span>
                  </div>

                  {status === "error" && message ? (
                    <p className="login-note error" role="alert">
                      <span>!</span>
                      {message}
                    </p>
                  ) : null}

                  <button
                    className="sign-in-button"
                    type="submit"
                    disabled={status === "submitting"}
                  >
                    {status === "submitting" ? "Verifying Answer…" : "Verify & Continue →"}
                  </button>

                  {hasBackupKey && (
                    <div style={{ marginTop: "12px", textAlign: "center" }}>
                      <button
                        type="button"
                        className="forgot-password-link"
                        style={{ fontSize: "12px", color: "var(--color-accent-deep)", display: "inline-flex", alignItems: "center", gap: "5px" }}
                        onClick={() => {
                          setForgotStep("backup_key");
                          setStatus("idle");
                          setMessage("");
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="7.5" cy="15.5" r="5.5" />
                          <path d="m21 2-9.6 9.6" />
                          <path d="m15.5 7.5 3 3L22 7l-3-3" />
                        </svg>
                        Use Emergency Backup Key instead
                      </button>
                    </div>
                  )}

                  <div className="login-forgot-wrap">
                    <button
                      type="button"
                      className="forgot-password-link"
                      onClick={() => {
                        setForgotStep("username");
                        setStatus("idle");
                        setMessage("");
                      }}
                    >
                      ← Change username
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === "backup_key" && (
                <form onSubmit={handleVerifyBackupKey} noValidate>
                  <div style={{ marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-accent-deep)" }}>
                      Emergency Recovery for @{recoveryUsername}:
                    </span>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
                      Enter your 12-character emergency backup key (e.g. ROUTEX-XXXX-XXXX-XXXX).
                      Note: Using this key will permanently consume and invalidate it.
                    </p>
                  </div>

                  <label>
                    Emergency Backup Key
                    <input
                      name="backupKeyInput"
                      type="text"
                      placeholder="ROUTEX-XXXX-XXXX-XXXX"
                      value={backupKeyInput}
                      onChange={(event) => setBackupKeyInput(event.target.value.toUpperCase())}
                      style={{ fontFamily: "monospace", letterSpacing: "1px" }}
                      required
                    />
                  </label>

                  <div className="login-options">
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                      Step 2 of 3: Single-Use Key Verification
                    </span>
                  </div>

                  {status === "error" && message ? (
                    <p className="login-note error" role="alert">
                      <span>!</span>
                      {message}
                    </p>
                  ) : null}

                  <button
                    className="sign-in-button"
                    type="submit"
                    disabled={status === "submitting"}
                  >
                    {status === "submitting" ? "Verifying Backup Key…" : "Verify Key & Continue →"}
                  </button>

                  <div className="login-forgot-wrap" style={{ display: "flex", justifyContent: "space-between" }}>
                    <button
                      type="button"
                      className="forgot-password-link"
                      onClick={() => {
                        setForgotStep("username");
                        setStatus("idle");
                        setMessage("");
                      }}
                    >
                      ← Change username
                    </button>
                    {hasSecurityQuestion && (
                      <button
                        type="button"
                        className="forgot-password-link"
                        onClick={() => {
                          setForgotStep("security_question");
                          setStatus("idle");
                          setMessage("");
                        }}
                      >
                        Answer question instead →
                      </button>
                    )}
                  </div>
                </form>
              )}

              {forgotStep === "reset_password" && (
                <form onSubmit={handleResetPasswordSubmit} noValidate>
                  <label>
                    New Password
                    <span className="password-control">
                      <input
                        name="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter your new password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        required
                      />
                      <button
                        type="button"
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowNewPassword((value) => !value)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          {showNewPassword ? (
                            <>
                              <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z" />
                              <circle cx="12" cy="12" r="2.7" />
                              <line x1="3" y1="3" x2="21" y2="21" />
                            </>
                          ) : (
                            <>
                              <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z" />
                              <circle cx="12" cy="12" r="2.7" />
                            </>
                          )}
                        </svg>
                      </button>
                    </span>
                  </label>

                  <PasswordCriteriaList password={newPassword} />

                  <label style={{ marginTop: "12px" }}>
                    Confirm New Password
                    <input
                      name="confirmNewPassword"
                      type="password"
                      placeholder="Re-enter your new password"
                      value={confirmNewPassword}
                      onChange={(event) => setConfirmNewPassword(event.target.value)}
                      required
                    />
                  </label>

                  <div className="login-options">
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                      Step 3 of 3: Set Permanent Password
                    </span>
                  </div>

                  {status === "error" && message ? (
                    <p className="login-note error" role="alert">
                      <span>!</span>
                      {message}
                    </p>
                  ) : null}

                  {status === "success" && message ? (
                    <p className="login-note success" role="status">
                      <span>i</span>
                      {message}
                    </p>
                  ) : null}

                  <button
                    className="sign-in-button"
                    type="submit"
                    disabled={status === "submitting"}
                  >
                    {status === "submitting" ? "Updating Password…" : "Reset Password & Log In"}
                  </button>

                  <div className="login-forgot-wrap">
                    <button
                      type="button"
                      className="forgot-password-link"
                      onClick={() => {
                        setViewMode("login");
                        setStatus("idle");
                        setMessage("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === "replacement_key" && (
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "var(--color-accent-soft, #fef3c7)",
                      color: "var(--color-accent-deep, #92400e)",
                      marginBottom: "12px",
                    }}
                    aria-hidden="true"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="7.5" cy="15.5" r="5.5" />
                      <path d="m21 2-9.6 9.6" />
                      <path d="m15.5 7.5 3 3L22 7l-3-3" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px", color: "var(--color-text)" }}>
                    New Emergency Backup Key Provisioned
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
                    Your previous emergency backup key has been consumed and invalidated. A new single-use emergency backup key has been automatically generated for @{recoveryUsername}:
                  </p>

                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "8px",
                      backgroundColor: "var(--color-surface-subtle)",
                      border: "1px dashed var(--color-border)",
                      fontFamily: "monospace",
                      fontSize: "16px",
                      fontWeight: 700,
                      letterSpacing: "1.5px",
                      color: "var(--color-accent-deep)",
                      marginBottom: "16px",
                      userSelect: "all",
                    }}
                  >
                    {replacementKey}
                  </div>

                  <p
                    style={{
                      fontSize: "11px",
                      color: "var(--color-text-muted)",
                      margin: "0 0 16px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                      aria-hidden="true"
                    >
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>Save this key in a secure location (e.g. password manager, safe). It will never be displayed again.</span>
                  </p>

                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ flex: 1, padding: "8px", fontSize: "12px", fontWeight: 600 }}
                      onClick={() => {
                        navigator.clipboard.writeText(replacementKey || "");
                        toast.success("Backup key copied to clipboard!");
                      }}
                    >
                      Copy Key
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ flex: 1, padding: "8px", fontSize: "12px", fontWeight: 600 }}
                      onClick={() => {
                        const content = `ROUTEX EMERGENCY BACKUP KEY\nAccount: ${recoveryUsername}\nKey: ${replacementKey}\nGenerated: ${new Date().toISOString()}\n\nNote: This is a single-use emergency backup key. Store offline in a secure location.`;
                        const blob = new Blob([content], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `routex-backup-key-${recoveryUsername}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Backup key downloaded!");
                      }}
                    >
                      Download .txt
                    </button>
                  </div>

                  <button
                    type="button"
                    className="sign-in-button"
                    onClick={() => {
                      setUsername(recoveryUsername.trim());
                      setPassword("");
                      setViewMode("login");
                      setForgotStep("username");
                      toast.success("Account recovered! You may now sign in with your new password.");
                    }}
                  >
                    I Have Saved My Key → Continue to Login
                  </button>
                </div>
              )}
            </div>
          )}
          <RouteXFooter />
        </div>
      </section>
    </main>
  );
}
