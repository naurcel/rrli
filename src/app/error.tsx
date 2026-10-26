"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="fallback-page" aria-labelledby="error-title">
      <div className="fallback-panel">
        <p className="fallback-code" aria-hidden="true">!</p>
        <p className="eyebrow">ROUTEX OPERATIONS</p>
        <h1 id="error-title">Something interrupted this page.</h1>
        <p>
          You can try loading this page again, or return to the deliveries preview.
        </p>
        <div className="fallback-actions">
          <button className="fallback-action" type="button" onClick={retry}>
            Try again
          </button>
          <Link className="fallback-link" href="/">
            Return to deliveries
          </Link>
        </div>
      </div>
    </main>
  );
}
