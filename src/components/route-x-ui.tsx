import type { ReactNode } from "react";

const navigationGlyphs: Record<string, ReactNode> = {
  "\u2302": <><path d="m4 10.5 8-6.5 8 6.5" /><path d="M6 9v10h12V9" /></>,
  "\u25a4": <><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  "\u25b1": <><path d="M3.5 7h11v9h-11zM14.5 10h3.25L21 13v3h-6.5z" /><circle cx="7" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></>,
  "\u20b1": <><path d="M7 7h11l-3-3M18 7l-3 3M17 17H6l3 3M6 17l3-3" /></>,
  "\u25a5": <><path d="M6 3.5h9l3 3V20H6z" /><path d="M15 3.5V7h3M9 16v-3M12 16v-6M15 16v-4" /></>,
  "\u25ce": <><path d="M12 3.5 19 6v5.25c0 4.25-2.8 7.55-7 9.25-4.2-1.7-7-5-7-9.25V6z" /><path d="m9 12 2 2 4-4" /></>,
  "\u2699": <><circle cx="12" cy="12" r="3.25" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.65 5.65l1.4 1.4M16.95 16.95l1.4 1.4M18.35 5.65l-1.4 1.4M7.05 16.95l-1.4 1.4" /></>,
};

export function Icon({ children }: { children: string }) {
  const navigationGlyph = navigationGlyphs[children];

  return (
    <span className="icon" aria-hidden="true">
      {navigationGlyph ? (
        <svg className="icon-vector" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
          {navigationGlyph}
        </svg>
      ) : children}
    </span>
  );
}
