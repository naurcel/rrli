"use client";

import Link from "next/link";

export default function GlobalErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="fallback-page">
      <div className="fallback-ambient-glow" aria-hidden="true" />
      <div className="fallback-content" role="alert">
        <h1 className="fallback-title">Something interrupted this view</h1>
        <p className="fallback-description">
          Your delivery records and truck data remain safe. Try refreshing the view or return to the dashboard.
        </p>
        <div className="fallback-actions">
          <button
            type="button"
            className="fallback-btn fallback-btn-primary"
            onClick={() => reset()}
          >
            Try again
          </button>
          <Link className="fallback-btn fallback-btn-secondary" href="/dashboard">
            Return to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

