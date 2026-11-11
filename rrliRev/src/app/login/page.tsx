"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordCriteriaList } from "@/components/password-criteria-list";
import { RouteXFooter } from "@/components/routex-footer";
import { evaluatePasswordCriteria } from "@/lib/auth/password-policy";
import { isSupabaseConfigured } from "@/lib/config/env";

type AuthViewMode = "login" | "forgot-password";
type ForgotStep = "username" | "security_question" | "reset_password";
type LoginLayoutMode = "split" | "centered";

const ROLE_VERIFICATION_ACCOUNTS = [
  {
    label: "Admin (Full Access)",
    username: "admin",
    password: "admin",
  },
  {
    label: "Operations (Write)",
    username: "operations",
    password: "operations",
  },
  {
    label: "Finance (View-Only)",
    username: "finance",
    password: "finance",
  },
  {
    label: "HR (View-Only)",
    username: "hr",
    password: "humanresources",
  },
  {
    label: "Secretary (View-Only)",
    username: "secretary",
    password: "secretary",
  },
  {
    label: "Customer Rep (View-Only)",
    username: "customerrep",
    password: "customerrep",
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const supabaseConfigured = isSupabaseConfigured();

  const [viewMode, setViewMode] = useState<AuthViewMode>("login");
  const [layoutMode, setLayoutMode] = useState<LoginLayoutMode>("split");
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
  const [resetToken, setResetToken] = useState("");
  const [recoveryMode, setRecoveryMode] = useState<"admin" | "security_question">("security_question");
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

      const savedLayout = window.localStorage.getItem("routex-login-layout");
      if (savedLayout === "split" || savedLayout === "centered") {
        setLayoutMode(savedLayout);
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

  function selectLayout(nextLayout: LoginLayoutMode) {
    setLayoutMode(nextLayout);
    try {
      window.localStorage.setItem("routex-login-layout", nextLayout);
    } catch {
      // Ignore storage restrictions
    }
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setStatus("error");
      setMessage("Enter your username.");
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
          username: trimmedUsername,
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
          window.localStorage.setItem("routex-remembered-username", trimmedUsername);
        } else {
          window.localStorage.removeItem("routex-remembered-username");
        }
      } catch {
        // Ignore storage errors
      }

      setStatus("success");
      setMessage(
        `Authenticated as @${payload.actor?.username ?? trimmedUsername} (${payload.actor?.roleLabel ?? "Authorized"}). Redirecting…`,
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
      setMessage("Enter your RouteX username.");
      return;
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check-user",
          username: trimmed,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        mode?: "admin_authorized" | "security_question";
        question?: string;
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

      if (payload.mode === "admin_authorized") {
        setRecoveryMode("admin");
        setResetToken(payload.recoveryToken || "");
        setForgotStep("reset_password");
        setMessage("Administrator-authorized password reset ready. Please set your new password below.");
      } else if (payload.mode === "security_question") {
        setRecoveryMode("security_question");
        setSecurityQuestion(payload.question || "");
        setForgotStep("security_question");
      }
    } catch {
      setStatus("error");
      setMessage("Unable to verify username. Please try again.");
    }
  }

  // Step 2: Verify security answer
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
      } | null;

      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setMessage(payload?.message ?? "Unable to reset password.");
        return;
      }

      setStatus("success");
      setMessage(payload.message ?? "Password reset successfully. You can now log in.");
      setUsername(recoveryUsername.trim());
      setPassword("");
      setViewMode("login");
      setForgotStep("username");
      setNewPassword("");
      setConfirmNewPassword("");
      setSecurityAnswer("");
    } catch {
      setStatus("error");
      setMessage("Password reset failed. Please try again.");
    }
  }

  function applyRolePreset(presetUsername: string, presetPassword: string) {
    setViewMode("login");
    setUsername(presetUsername);
    setPassword(presetPassword);
    setStatus("idle");
    setMessage("");
  }

  return (
    <main
      className={`login-page login-layout-${layoutMode}${isDark ? " theme-dark" : ""}`}
      aria-busy={status === "submitting"}
    >
      <div className="login-tools" aria-label="Login page tools">
        <div className="login-layout-switch" role="group" aria-label="Login page layout">
          <button
            className={layoutMode === "split" ? "active" : ""}
            type="button"
            aria-pressed={layoutMode === "split"}
            onClick={() => selectLayout("split")}
          >
            Split
          </button>
          <button
            className={layoutMode === "centered" ? "active" : ""}
            type="button"
            aria-pressed={layoutMode === "centered"}
            onClick={() => selectLayout("centered")}
          >
            Center
          </button>
        </div>

        {!supabaseConfigured ? (
          <details className="login-role-access-menu">
            <summary aria-label="Open role verification accounts">
              <span>RBAC</span>
              <svg className="login-dropdown-chevron" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M5.5 7.5L10 12l4.5-4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <div className="login-role-access-popover">
              <div className="login-role-access-header">
                <strong>Server-Verified Roles</strong>
                <span>Quick-fill account</span>
              </div>
              <div className="login-role-presets">
                {ROLE_VERIFICATION_ACCOUNTS.map((item) => (
                  <button
                    key={item.username}
                    type="button"
                    className="login-role-preset-btn"
                    onClick={(event) => {
                      applyRolePreset(item.username, item.password);
                      event.currentTarget.closest("details")?.removeAttribute("open");
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </details>
        ) : null}

        <button
          className="theme-toggle"
          type="button"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {isDark ? "\u2600" : "\u25D0"}
        </button>
      </div>

      <section className="login-visual" aria-label="RouteX logistics">
        <img
          className="login-visual-media"
          src="/branding/login-glow.gif"
          alt=""
          aria-hidden="true"
        />
        <div className="login-visual-overlay" />
        <div className="login-visual-copy">
          <h1>
            Excellence in motion,
            <br />
            your logistics redemption.
          </h1>
          <span>Redeemed Route Logistics Inc.</span>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="sign-in-title">
        <div className="login-form-wrap">
          <img
            className="login-logo"
            src={
              isDark
                ? "/branding/routex-logo-white.png"
                : "/branding/routex-logo-dblue.png"
            }
            alt="RouteX"
          />
          <h2 id="sign-in-title">
            {viewMode === "login" ? "Log in" : "Password Recovery"}
          </h2>

          {viewMode === "login" ? (
            <form onSubmit={handleLoginSubmit} noValidate>
              <label>
                Username
                <input
                  name="username"
                  type="text"
                  placeholder="Enter your username"
                  autoComplete="username"
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
                    RouteX Username
                    <input
                      name="recoveryUsername"
                      type="text"
                      placeholder="Enter your username"
                      autoComplete="username"
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
            </div>
          )}
          <RouteXFooter />
        </div>
      </section>
    </main>
  );
}
