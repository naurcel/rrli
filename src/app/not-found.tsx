import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found | RouteX",
  description: "The requested RouteX page could not be found.",
};

export default function NotFound() {
  return (
    <main className="fallback-page" aria-labelledby="not-found-title">
      <div className="fallback-panel">
        <p className="fallback-code" aria-hidden="true">404</p>
        <p className="eyebrow">ROUTEX OPERATIONS</p>
        <h1 id="not-found-title">This page is not available.</h1>
        <p>
          The address may be incorrect, or this preview page may have moved.
        </p>
        <Link className="fallback-action" href="/">
          Return to deliveries
        </Link>
      </div>
    </main>
  );
}
