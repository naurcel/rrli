"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Resets all active RouteX scroll containers to the top.
 * - `.main-content`: The primary scrolling container of the RouteX application shell.
 * - `window`, `document.documentElement`, `document.body`: The global viewport containers.
 * - Nested scrollable containers: `.content-wrap`, `.route-template`, etc.
 */
export function resetAllScrollPositions(behavior: ScrollBehavior = "instant") {
  if (typeof window === "undefined") return;

  // 1. Primary RouteX workspace scroll container (.main-content)
  const mainContent = document.querySelector(".main-content");
  if (mainContent) {
    mainContent.scrollTo({ top: 0, left: 0, behavior });
    mainContent.scrollTop = 0;
  }

  // 2. Standard window and root documents
  window.scrollTo({ top: 0, left: 0, behavior });
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;

  // 3. Any nested content scroll containers
  const scrollables = document.querySelectorAll<HTMLElement>(
    ".content-wrap, .route-template, .delivery-entry-page, .record-detail-content, .settings-tab-content-area, .settings-tab-panel, .discord-perms-body"
  );
  scrollables.forEach((el) => {
    el.scrollTo({ top: 0, left: 0, behavior });
    el.scrollTop = 0;
  });
}

/**
 * Global RouteScrollToTop component.
 * Automatically scrolls back to the top whenever the user switches to a new page or route.
 */
export function RouteScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevRouteKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Generate route identifier based on pathname, tab, and pagination page
    const pageParam = searchParams?.get("page") ?? "";
    const tabParam = searchParams?.get("tab") ?? "";
    const currentRouteKey = `${pathname}:${pageParam}:${tabParam}`;

    if (prevRouteKeyRef.current !== currentRouteKey) {
      prevRouteKeyRef.current = currentRouteKey;

      // Reset scroll position immediately
      resetAllScrollPositions("instant");

      // Follow-up after layout paint to guarantee scroll position after dynamic rendering
      const frameId = requestAnimationFrame(() => {
        resetAllScrollPositions("instant");
      });
      const timerId = setTimeout(() => {
        resetAllScrollPositions("instant");
      }, 50);

      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(timerId);
      };
    }
  }, [pathname, searchParams]);

  // Ensure browser history transitions (Back/Forward) also reset to top
  useEffect(() => {
    const handlePopState = () => {
      resetAllScrollPositions("instant");
      setTimeout(() => resetAllScrollPositions("instant"), 30);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return null;
}
