"use client";

import { useEffect, useState } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

export { toast };

export function ToasterProvider() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    function detectTheme(): "light" | "dark" | "system" {
      if (typeof document === "undefined") return "system";
      const docTheme = document.documentElement.dataset.theme;
      if (docTheme === "dark" || docTheme === "light") {
        return docTheme;
      }
      const stored = window.localStorage.getItem("routex-theme");
      if (stored === "dark" || stored === "light") {
        return stored;
      }
      return "system";
    }

    setTheme(detectTheme());

    const observer = new MutationObserver(() => {
      setTheme(detectTheme());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      expand={false}
      duration={4000}
      visibleToasts={5}
      gap={10}
      toastOptions={{
        style: {
          fontFamily: "var(--font-readex, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
          borderRadius: "12px",
          fontSize: "13.5px",
          fontWeight: 500,
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.18), 0 4px 12px -2px rgba(0, 0, 0, 0.08)",
        },
      }}
    />
  );
}
