"use client";

import { useEffect, useRef, useState } from "react";

type TooltipState = {
  text: string;
  top: number;
  left: number;
  position: "top" | "bottom";
  align: "center" | "right";
  visible: boolean;
};

export function GlobalTooltip() {
  const [state, setState] = useState<TooltipState>({
    text: "",
    top: 0,
    left: 0,
    position: "top",
    align: "center",
    visible: false,
  });

  const activeElementRef = useRef<HTMLElement | null>(null);
  const suppressedElementsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    // Flag body so duplicate pseudo-element CSS tooltips are cleanly suppressed
    document.body.classList.add("has-global-tooltip");

    // Proactively strip redundant title attributes on any element that already specifies data-tooltip
    function stripRedundantTitles() {
      try {
        const redundantElements = document.querySelectorAll<HTMLElement>("[data-tooltip][title]");
        redundantElements.forEach((el) => {
          el.removeAttribute("title");
        });
      } catch {}
    }

    stripRedundantTitles();
    const observer = new MutationObserver(stripRedundantTitles);
    try {
      observer.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ["title", "data-tooltip"],
      });
    } catch {}

    function findTooltipTarget(node: EventTarget | null): HTMLElement | null {
      if (!(node instanceof HTMLElement)) return null;
      // If the node itself or an ancestor has aria-expanded="true", it's an open dropdown/menu trigger - don't show tooltip
      const expandedContainer = node.closest<HTMLElement>('[aria-expanded="true"]');
      if (expandedContainer) return null;

      // Prioritize explicit custom tooltip container
      const dataTooltipEl = node.closest<HTMLElement>("[data-tooltip]");
      if (dataTooltipEl) {
        if (dataTooltipEl.getAttribute("aria-expanded") === "true") return null;
        return dataTooltipEl;
      }
      const titleEl = node.closest<HTMLElement>("[title]");
      if (titleEl && titleEl.getAttribute("aria-expanded") === "true") return null;
      return titleEl;
    }

    function showTooltip(target: HTMLElement) {
      try {
        if (target.getAttribute("aria-expanded") === "true") {
          hideTooltip();
          return;
        }

        let text = target.getAttribute("data-tooltip");
        if (!text || !text.trim()) {
          const title = target.getAttribute("title") || target.getAttribute("data-routex-title");
          if (title && title.trim()) {
            text = title.trim();
          }
        }

        if (!text || !text.trim()) {
          hideTooltip();
          return;
        }

        // Suppress native browser tooltips: remove 'title' from target, descendants, and all ancestors up to body
        const elementsToSuppress: HTMLElement[] = [];
        try {
          target.querySelectorAll<HTMLElement>("[title]").forEach((el) => {
            elementsToSuppress.push(el);
          });
          if (target.hasAttribute("title")) {
            elementsToSuppress.push(target);
          }
          let curr = target.parentElement;
          while (curr && curr !== document.body) {
            if (curr.hasAttribute("title")) {
              elementsToSuppress.push(curr);
            }
            curr = curr.parentElement;
          }
        } catch {}

        for (const el of elementsToSuppress) {
          const originalTitle = el.getAttribute("title");
          if (originalTitle) {
            el.setAttribute("data-routex-title", originalTitle);
            el.removeAttribute("title");
          }
        }
        suppressedElementsRef.current = elementsToSuppress;
        activeElementRef.current = target;

        const rect = target.getBoundingClientRect();
        const isHeaderAction =
          target.classList.contains("page-intro-action") ||
          Boolean(target.closest(".fleet-intro-actions")) ||
          target.classList.contains("tooltip-align-right");

        const align: "center" | "right" = isHeaderAction ? "right" : "center";
        const isBottom = rect.top < 45;
        const position: "top" | "bottom" = isBottom ? "bottom" : "top";
        const top = isBottom ? rect.bottom + 8 : rect.top - 8;

        let left: number;
        if (align === "right") {
          left = Math.min(window.innerWidth - 12, rect.right);
        } else {
          left = Math.max(12, Math.min(window.innerWidth - 12, rect.left + rect.width / 2));
        }

        setState({
          text,
          top,
          left,
          position,
          align,
          visible: true,
        });
      } catch {
        hideTooltip();
      }
    }

    function hideTooltip() {
      try {
        for (const el of suppressedElementsRef.current) {
          const savedTitle = el.getAttribute("data-routex-title");
          if (savedTitle) {
            el.setAttribute("title", savedTitle);
            el.removeAttribute("data-routex-title");
          }
        }
        suppressedElementsRef.current = [];
        activeElementRef.current = null;
      } catch {}

      setState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    }

    function handlePointerOver(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      const target = findTooltipTarget(event.target);
      if (target) {
        showTooltip(target);
      }
    }

    function handlePointerOut(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      const related = findTooltipTarget(event.relatedTarget);
      if (related && related === activeElementRef.current) {
        return;
      }
      hideTooltip();
    }

    function handleFocusIn(event: FocusEvent) {
      const target = findTooltipTarget(event.target);
      if (target) {
        showTooltip(target);
      }
    }

    function handleFocusOut() {
      hideTooltip();
    }

    function handleScroll() {
      hideTooltip();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        hideTooltip();
      }
    }

    document.addEventListener("pointerover", handlePointerOver, { capture: true, passive: true });
    document.addEventListener("pointerout", handlePointerOut, { capture: true, passive: true });
    document.addEventListener("focusin", handleFocusIn, { capture: true, passive: true });
    document.addEventListener("focusout", handleFocusOut, { capture: true, passive: true });
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true, passive: true });

    return () => {
      document.body.classList.remove("has-global-tooltip");
      observer.disconnect();
      document.removeEventListener("pointerover", handlePointerOver, { capture: true });
      document.removeEventListener("pointerout", handlePointerOut, { capture: true });
      document.removeEventListener("focusin", handleFocusIn, { capture: true });
      document.removeEventListener("focusout", handleFocusOut, { capture: true });
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  if (!state.text) return null;

  const classNames = [
    "routex-global-tooltip",
    state.visible ? "is-visible" : "",
    state.position === "bottom" ? "is-bottom" : "",
    state.align === "right" ? "align-right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classNames}
      style={{
        top: `${state.top}px`,
        left: `${state.left}px`,
      }}
      role="tooltip"
      aria-hidden={!state.visible}
    >
      {state.text}
    </div>
  );
}
