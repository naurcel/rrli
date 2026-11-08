import type { FleetCrewMember } from "@/features/deliveries/driver-registry";

const STORAGE_KEY = "routex-browser-crew-status-v1";
export const BROWSER_CREW_STATUS_CHANGED = "routex:browser-crew-status-changed";

export function readBrowserCrewStatuses(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, boolean>
      : {};
  } catch {
    return {};
  }
}

export function applyBrowserCrewStatuses(crew: readonly FleetCrewMember[]): FleetCrewMember[] {
  const statuses = readBrowserCrewStatuses();
  return crew.map((member) => ({
    ...member,
    isActive: statuses[member.id] ?? member.isActive,
  }));
}

export function saveBrowserCrewStatus(crewMemberId: string, isActive: boolean): void {
  if (typeof window === "undefined") return;
  const statuses = readBrowserCrewStatuses();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...statuses, [crewMemberId]: isActive }));
  window.dispatchEvent(new Event(BROWSER_CREW_STATUS_CHANGED));
}
