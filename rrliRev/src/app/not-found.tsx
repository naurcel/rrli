import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFoundPage() {
  return (
    <main className="fallback-page">
      <div className="fallback-ambient-glow" aria-hidden="true" />
      <div className="fallback-content" role="alert">
        <h1 className="fallback-title">Page Not Found</h1>
        <p className="fallback-description">
          The requested RouteX route does not exist or has been retired.
        </p>
        <div className="fallback-actions">
          <Link href="/dashboard" className="fallback-btn fallback-btn-primary">
            Return to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
