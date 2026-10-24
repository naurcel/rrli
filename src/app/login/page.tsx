"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  return (
    <main className="login-page">
      <section className="login-visual" aria-label="RouteX logistics">
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

          <form onSubmit={(event) => { event.preventDefault(); router.push("/dashboard"); }}>
            <label>
              Email address
              <input type="email" placeholder="you@company.com" autoComplete="email" />
            </label>

            <label>
              Password
              <span className="login-password">
                <input type={showPassword ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button>
              </span>
            </label>

            <div className="login-options">
              <label className="remember-option"><input type="checkbox" /> Remember me</label>
              <button type="button" className="login-link">Forgot password?</button>
            </div>

            <button className="login-submit" type="submit">Sign in</button>
          </form>

          <div className="login-preview-note">
            <span>i</span>
            <p><strong>Preview sign-in</strong> Authentication is not connected yet.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
