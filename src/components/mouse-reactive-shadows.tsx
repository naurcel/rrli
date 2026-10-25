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
    let frame = 0;
    let active: HTMLElement | null = null;

    const clearActive = () => {
      if (!active) return;
      active.style.setProperty("--mouse-shadow-x", "0px");
      active.style.setProperty("--mouse-shadow-y", "2px");
      active = null;
    };

    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>(targets);
        if (!next) { clearActive(); return; }
        if (active && active !== next) clearActive();
        active = next;
        const box = next.getBoundingClientRect();
        const x = Math.max(-8, Math.min(8, ((event.clientX - (box.left + box.width / 2)) / Math.max(box.width, 1)) * 16));
        const y = Math.max(-8, Math.min(8, ((event.clientY - (box.top + box.height / 2)) / Math.max(box.height, 1)) * 16));
        next.style.setProperty("--mouse-shadow-x", `${x.toFixed(2)}px`);
        next.style.setProperty("--mouse-shadow-y", `${y.toFixed(2)}px`);
      });
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", clearActive);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("pointermove", move); window.removeEventListener("blur", clearActive); clearActive(); };
  }, []);

  return null;
}
