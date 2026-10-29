"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";

type Theme = "light" | "dark";

const STORAGE_KEY = "routex-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function storedTheme(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }
}

function ThemeIcon({ theme }: { theme: Theme }) {
  return theme === "dark" ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z" />
    </svg>
  );
}

export function ThemeToggle() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const floating = pathname === "/login" || target?.classList.contains("fallback-page");

  useEffect(() => {
    const selectedTheme = storedTheme();
    applyTheme(selectedTheme);
    setTheme(selectedTheme);
  }, []);

  useEffect(() => {
    const selector = pathname === "/login" ? ".login-page" : ".topbar-actions, .fallback-page";
    setTarget(document.querySelector<HTMLElement>(selector));
  }, [pathname]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // A blocked storage area should not prevent a local theme change.
    }
    setTheme(nextTheme);
  };

  if (!target) return null;

  const nextTheme = theme === "dark" ? "light" : "dark";
  return createPortal(
    <button
      className={`theme-toggle${floating ? " theme-toggle-floating" : ""}`}
      type="button"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      onClick={toggleTheme}
    >
      <ThemeIcon theme={theme} />
      <span className="sr-only">Switch to {nextTheme} mode</span>
    </button>,
    target,
  );
}
