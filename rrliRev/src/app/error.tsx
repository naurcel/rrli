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
      <section className="fallback-panel" role="alert">
        <p className="fallback-code">Error</p>
        <p className="eyebrow">APPLICATION BOUNDARY</p>
        <h1>Something interrupted this view</h1>
        <p>
          Your delivery records and truck profitability data remain intact. Retry the action or
          return to the dashboard.
        </p>
        <div className="fallback-actions">
          <button type="button" className="fallback-action" onClick={() => reset()}>
            Try again
          </button>
          <Link className="fallback-link" href="/dashboard">
            Return to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

