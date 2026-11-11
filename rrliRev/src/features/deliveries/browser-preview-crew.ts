import type { FleetCrewMember } from "@/features/deliveries/driver-registry";

const STORAGE_KEY = "routex-browser-crew-status-v1";
const EDITS_STORAGE_KEY = "routex-browser-crew-edits-v1";
const DELETIONS_STORAGE_KEY = "routex-browser-crew-deletions-v1";
export const BROWSER_CREW_STATUS_CHANGED = "routex:browser-crew-status-changed";

export function readBrowserCrewStatuses(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

export function readBrowserCrewEdits(): Record<string, Partial<FleetCrewMember>> {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(EDITS_STORAGE_KEY) ?? "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, Partial<FleetCrewMember>>)
      : {};
  } catch {
    return {};
  }
}

export function saveBrowserCrewEdit(id: string, updates: Partial<FleetCrewMember>): void {
  if (typeof window === "undefined") return;
  const edits = readBrowserCrewEdits();
  window.localStorage.setItem(
    EDITS_STORAGE_KEY,
    JSON.stringify({ ...edits, [id]: { ...(edits[id] ?? {}), ...updates } }),
  );
  window.dispatchEvent(new Event(BROWSER_CREW_STATUS_CHANGED));
}

export function readBrowserCrewDeletions(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(DELETIONS_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? (value as string[]) : [];
  } catch {
    return [];
  }
}

export function saveBrowserCrewDeletion(id: string): void {
  if (typeof window === "undefined") return;
  const deletions = readBrowserCrewDeletions();
  if (!deletions.includes(id)) {
    window.localStorage.setItem(DELETIONS_STORAGE_KEY, JSON.stringify([...deletions, id]));
  }
  window.dispatchEvent(new Event(BROWSER_CREW_STATUS_CHANGED));
}

export function applyBrowserCrewStatuses(crew: readonly FleetCrewMember[]): FleetCrewMember[] {
  const statuses = readBrowserCrewStatuses();
  const edits = readBrowserCrewEdits();
  const deletions = new Set(readBrowserCrewDeletions());

  return crew
    .filter((member) => !deletions.has(member.id))
    .map((member) => {
      const edited = edits[member.id] ?? {};
      return {
        ...member,
        ...edited,
        isActive:
          statuses[member.id] !== undefined
            ? statuses[member.id]
            : (edited.isActive !== undefined ? edited.isActive : member.isActive),
      };
    });
}

export function saveBrowserCrewStatus(crewMemberId: string, isActive: boolean): void {
  if (typeof window === "undefined") return;
  const statuses = readBrowserCrewStatuses();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...statuses, [crewMemberId]: isActive }));
  window.dispatchEvent(new Event(BROWSER_CREW_STATUS_CHANGED));
}
