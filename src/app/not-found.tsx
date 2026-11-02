import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found | RouteX",
  description: "The requested RouteX page could not be found.",
};

export default function NotFound() {
  return (
    <main className="fallback-page minimal-not-found" aria-labelledby="not-found-title">
      <div className="minimal-not-found-copy">
        <h1 id="not-found-title">Uh-oh!</h1>
        <p>This route took a wrong turn.</p>
        <Link href="/dashboard">Head back to the dashboard</Link>
      </div>
    </main>
  );
}
