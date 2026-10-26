"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const targets = ".login-form-wrap input, .search-box, .global-search, .global-date-filter, .stat-card, .fleet-card, .report-card, .settings-card";

export function MouseReactiveShadows() {
  const pathname = usePathname();

  useEffect(() => {
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    if (!sidebar) return;
    sidebar.classList.remove("sidebar-ready");
    let settle = 0;
    const frame = requestAnimationFrame(() => { settle = requestAnimationFrame(() => sidebar.classList.add("sidebar-ready")); });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(settle); };
  }, [pathname]);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    let frame = 0;
    let active: HTMLElement | null = null;
    let activeBounds: DOMRect | null = null;
    let pointerX = 0;
    let pointerY = 0;
    let renderedX = Number.NaN;
    let renderedY = Number.NaN;

    const clearActive = () => {
      if (!active) return;
      active.style.setProperty("--mouse-shadow-x", "0px");
      active.style.setProperty("--mouse-shadow-y", "2px");
      active = null;
      activeBounds = null;
      renderedX = Number.NaN;
      renderedY = Number.NaN;
    };

    const render = () => {
      frame = 0;
      if (!active) return;

      const box = activeBounds ?? active.getBoundingClientRect();
      activeBounds = box;
      const x = Math.max(-8, Math.min(8, ((pointerX - (box.left + box.width / 2)) / Math.max(box.width, 1)) * 16));
      const y = Math.max(-8, Math.min(8, ((pointerY - (box.top + box.height / 2)) / Math.max(box.height, 1)) * 16));

      if (Math.abs(x - renderedX) < .25 && Math.abs(y - renderedY) < .25) return;
      renderedX = x;
      renderedY = y;
      active.style.setProperty("--mouse-shadow-x", `${x.toFixed(1)}px`);
      active.style.setProperty("--mouse-shadow-y", `${y.toFixed(1)}px`);
    };

    const move = (event: PointerEvent) => {
      const eventTarget = event.target instanceof Element ? event.target : null;
      const next = eventTarget?.closest<HTMLElement>(targets) ?? null;
      if (!next) { clearActive(); return; }
      if (active !== next) {
        clearActive();
        active = next;
        activeBounds = next.getBoundingClientRect();
      }

      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(render);
    };

    const invalidateBounds = () => { activeBounds = null; };
    const leaveWindow = (event: PointerEvent) => { if (!event.relatedTarget) clearActive(); };
    const handleVisibility = () => { if (document.hidden) clearActive(); };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", leaveWindow, { passive: true });
    window.addEventListener("resize", invalidateBounds, { passive: true });
    window.addEventListener("scroll", invalidateBounds, { passive: true, capture: true });
    window.addEventListener("blur", clearActive);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leaveWindow);
      window.removeEventListener("resize", invalidateBounds);
      window.removeEventListener("scroll", invalidateBounds, true);
      window.removeEventListener("blur", clearActive);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearActive();
    };
  }, []);

  return null;
}
