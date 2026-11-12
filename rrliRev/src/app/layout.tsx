import type { Metadata } from "next";
import { GlobalTooltip } from "@/components/global-tooltip";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RouteX | Delivery Operations & Trucks",
  description:
    "RouteX delivery operations, multi-store drop-off tracking, POD documents, and truck performance system for Redeemed Route Logistics Inc.",
};

const themeInitScript = `
(function () {
  try {
    var storedTheme = window.localStorage.getItem("routex-theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      document.documentElement.dataset.theme = storedTheme;
    }
    for (var i = 0; i < window.localStorage.length; i++) {
      var k = window.localStorage.key(i);
      if (k && k.indexOf("routex.design-preferences.") === 0) {
        var raw = window.localStorage.getItem(k);
        if (raw) {
          var p = JSON.parse(raw);
          if (p.fontSize) document.documentElement.dataset.fontSize = p.fontSize;
          if (p.compactness) document.documentElement.dataset.compactness = p.compactness;
          if (typeof p.reduceMotion === "boolean") document.documentElement.dataset.reduceMotion = String(p.reduceMotion);
          break;
        }
      }
    }
    if (!document.documentElement.dataset.reduceMotion && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.dataset.reduceMotion = "true";
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <GlobalTooltip />
      </body>
    </html>
  );
}
