"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  getAuthenticationMode,
  signInSchema,
} from "@/features/auth/auth-model";
import { sanitizeReturnPath } from "@/lib/auth/route-policy";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const SIGN_IN_TRANSITION_MS = 420;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const authenticationMode = getAuthenticationMode({
    isSupabaseConfigured: isSupabaseConfigured(),
    nodeEnvironment: process.env.NODE_ENV,
  });

  async function finishSignIn(destination: string) {
    setIsLeaving(true);

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await new Promise((resolve) => window.setTimeout(resolve, SIGN_IN_TRANSITION_MS));
    }

    router.replace(destination);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (authenticationMode === "preview") {
      const returnPath = sanitizeReturnPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      await finishSignIn(returnPath);
      return;
    }

    if (authenticationMode === "unavailable") {
      setErrorMessage(
        "Authentication is unavailable because the server is not configured.",
      );
      return;
    }

    const formData = new FormData(event.currentTarget);
    const parsed = signInSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Review your details.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword(parsed.data);

      if (error) {
        setErrorMessage("The email address or password is incorrect.");
        return;
      }

      const returnPath = sanitizeReturnPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      await finishSignIn(returnPath);
    } catch {
      setErrorMessage("Sign-in could not be completed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={`login-page${isLeaving ? " login-exiting" : ""}`} aria-busy={isSubmitting || isLeaving}>
      <section className="login-visual" aria-label="RouteX logistics">
        <img className="login-visual-media" src="/branding/login-glow.gif" alt="" aria-hidden="true" />
        <div className="login-visual-overlay" />
        <div className="login-visual-content">
          <p className="login-visual-kicker">ROUTEX OPERATIONS</p>
          <h1>Excellence in motion,<br />your logistics redemption.</h1>
          <p>Redeemed Route Logistics Inc.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <img className="login-logo" src="/branding/routex-logo-dblue.png" alt="RouteX" />
          <p className="login-panel-kicker">WELCOME BACK</p>
          <h2>Sign in</h2>
          <p className="login-subtitle">See how the business is doing today.</p>

          <form onSubmit={handleSubmit} noValidate>
            <label>
              Email address
              <input name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
            </label>

            <label>
              Password
              <span className="login-password">
                <input name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button>
              </span>
            </label>

            <div className="login-options">
              <label className="remember-option" title="Session policy is pending approval.">
                <input type="checkbox" disabled /> Remember me
              </label>
              <button type="button" className="login-link" disabled title="Password recovery is not connected yet.">
                Forgot password?
              </button>
            </div>

            {errorMessage ? (
              <p className="login-error" role="alert">{errorMessage}</p>
            ) : null}

            <button className="login-submit" type="submit" disabled={isSubmitting || isLeaving}>
              {isSubmitting || isLeaving ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="login-preview-note">
            <span>i</span>
            <p>
              <strong>
                {authenticationMode === "supabase" ? "Secure sign-in" : "Preview sign-in"}
              </strong>
              {authenticationMode === "supabase"
                ? " Use your authorized RouteX account."
                : authenticationMode === "preview"
                  ? " Local development access is enabled."
                  : " Authentication configuration is required."}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
