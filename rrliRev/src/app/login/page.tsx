"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/config/env";

type AuthViewMode = "login" | "forgot-password";
type LoginLayoutMode = "split" | "centered";

const ROLE_VERIFICATION_ACCOUNTS = [
  {
    label: "Admin (Full Access)",
    email: "admin@routex.local",
    password: "admin",
  },
  {
    label: "Operations (Write)",
    email: "operations@routex.local",
    password: "operations",
  },
  {
    label: "Finance (View-Only)",
    email: "finance@routex.local",
    password: "finance",
  },
  {
    label: "HR (View-Only)",
    email: "hr@routex.local",
    password: "humanresources",
  },
  {
    label: "Secretary (View-Only)",
    email: "secretary@routex.local",
    password: "secretary",
  },
  {
    label: "Customer Rep (View-Only)",
    email: "csrep@routex.local",
    password: "customerrep",
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const supabaseConfigured = isSupabaseConfigured();

  const [viewMode, setViewMode] = useState<AuthViewMode>("login");
  const [layoutMode, setLayoutMode] = useState<LoginLayoutMode>("split");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const currentTheme =
        document.documentElement.dataset.theme ??
        window.localStorage.getItem("routex-theme");
      setIsDark(currentTheme === "dark");

      const rememberedEmail = window.localStorage.getItem("routex-remembered-email");
      if (rememberedEmail) {
        setEmail(rememberedEmail);
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

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setStatus("error");
      setMessage("Enter a valid email address.");
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
          email: trimmedEmail,
          password,
          rememberMe,
          next: nextParam,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        redirectTo?: string;
        actor?: { fullName?: string; roleLabel?: string; accessLevelLabel?: string };
      } | null;

      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setMessage(
          payload?.message ?? "The email address or password you entered is incorrect.",
        );
        return;
      }

      try {
        if (rememberMe) {
          window.localStorage.setItem("routex-remembered-email", trimmedEmail);
        } else {
          window.localStorage.removeItem("routex-remembered-email");
        }
      } catch {
        // Ignore storage errors
      }

      setStatus("success");
      setMessage(
        `Authenticated as ${payload.actor?.fullName ?? trimmedEmail} (${payload.actor?.roleLabel ?? "Authorized"} — ${payload.actor?.accessLevelLabel ?? "Active"}). Redirecting…`,
      );

      const destination = payload.redirectTo ?? "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Authentication could not be completed. Please try again.");
    }
  }

  async function handleForgotPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setStatus("error");
      setMessage("Enter the email address associated with your RouteX account.");
      return;
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setMessage(payload?.message ?? "Unable to process password recovery request.");
        return;
      }

      setStatus("success");
      setMessage(
        payload.message ??
          "If an active RouteX account matches that email, recovery instructions have been sent.",
      );
    } catch {
      setStatus("error");
      setMessage("Password recovery request failed. Please try again.");
    }
  }

  function applyRolePreset(presetEmail: string, presetPassword: string) {
    setViewMode("login");
    setEmail(presetEmail);
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
                    key={item.email}
                    type="button"
                    className="login-role-preset-btn"
                    onClick={(event) => {
                      applyRolePreset(item.email, item.password);
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
            {viewMode === "login" ? "Sign in" : "Forgot password"}
          </h2>

          {viewMode === "login" ? (
            <form onSubmit={handleLoginSubmit} noValidate>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  placeholder="name@routex.local"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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
                      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z" />
                      <circle cx="12" cy="12" r="2.7" />
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
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setViewMode("forgot-password");
                    setStatus("idle");
                    setMessage("");
                  }}
                >
                  Forgot password?
                </button>
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
                {status === "submitting" ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} noValidate>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  placeholder="Enter your RouteX email address"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <div className="login-options">
                <span>Accounts are managed by RouteX Admins.</span>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setViewMode("login");
                    setStatus("idle");
                    setMessage("");
                  }}
                >
                  Back to sign in
                </button>
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
                {status === "submitting"
                  ? "Sending instructions…"
                  : "Send reset instructions"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
