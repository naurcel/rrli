/**
 * Delivery Crew Utilities
 * Pure helper functions for parsing driver/helper assignments and initials.
 */

export function parsePersonnelNames(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0 && item.toLowerCase() !== "not recorded" && item.toLowerCase() !== "none" && item.toLowerCase() !== "n/a");
  }

  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "not recorded" || trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "n/a") {
    return [];
  }

  // Handle delimiter splitting: comma, semicolon, slash, or ampersand
  const parts = trimmed
    .split(/[,;/&]|\band\b/i)
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name.toLowerCase() !== "not recorded" && name.toLowerCase() !== "none" && name.toLowerCase() !== "n/a");

  return parts.length > 0 ? parts : [trimmed];
}

export function getPersonnelInitials(name: string): string {
  const clean = name.replace(/^(lead|relief|driver|helper)\s*:\s*/i, "").trim();
  if (!clean) return "—";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
