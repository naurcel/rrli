"use client";

import { usePathname } from "next/navigation";

// Form workflows and focused data-entry pages where a footer would cause distraction or interference
const EXCLUDED_WORKFLOW_PATHS = new Set([
  "/deliveries/new",
  "/deliveries/import",
]);

export function RouteXFooter() {
  const pathname = usePathname();

  if (EXCLUDED_WORKFLOW_PATHS.has(pathname)) {
    return null;
  }

  return (
    <footer className="routex-footer" aria-label="RouteX Application Footer">
      <div className="routex-footer-content">
        <p className="routex-footer-brand">
          Developed by RouteX for Redeemed Route Logistics Inc.
        </p>
        <p className="routex-footer-copyright">
          &copy; 2026 Redeemed Route Logistics Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
