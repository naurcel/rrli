import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFoundPage() {
  return (
    <main className="rx-page" style={{ padding: "48px 24px", maxWidth: 560, margin: "0 auto" }}>
      <section className="rx-surface" style={{ padding: 28 }}>
        <div className="rx-kicker">RouteX Navigation</div>
        <h1 className="rx-title" style={{ marginTop: 6 }}>
          Page Not Found
        </h1>
        <p className="rx-subtitle" style={{ marginTop: 8 }}>
          The requested RouteX route does not exist or has been retired under the Delivery Operations & Truck Profitability scope.
        </p>
        <div style={{ marginTop: 18 }}>
          <Link href="/dashboard" className="rx-btn rx-btn-primary">
            Return to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
