import {
  FLEET_TRUCKS,
  type FleetTruck,
} from "./truck-registry.ts";

export const BROWSER_PREVIEW_TRUCKS_KEY = "routex-browser-preview-trucks-v1";
export const BROWSER_PREVIEW_TRUCKS_CHANGED = "routex:browser-preview-trucks-changed";

export function readBrowserPreviewTrucks(): FleetTruck[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BROWSER_PREVIEW_TRUCKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FleetTruck[]) : [];
  } catch {
    return [];
  }
}

export function saveBrowserPreviewTruck(truck: FleetTruck): void {
  if (typeof window === "undefined") return;
  const current = readBrowserPreviewTrucks();
  const normalized = truck.plateNumber.trim().toUpperCase();

  const isDuplicate =
    FLEET_TRUCKS.some((candidate) => candidate.plateNumber.toUpperCase() === normalized) ||
    current.some((candidate) => candidate.plateNumber.toUpperCase() === normalized);

  if (isDuplicate) {
    throw new Error(`Truck with plate number "${normalized}" already exists in this browser.`);
  }

  const updated = [...current, { ...truck, plateNumber: normalized }];
  window.localStorage.setItem(BROWSER_PREVIEW_TRUCKS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event(BROWSER_PREVIEW_TRUCKS_CHANGED));
}

export function clearBrowserPreviewTrucks(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BROWSER_PREVIEW_TRUCKS_KEY);
  window.dispatchEvent(new Event(BROWSER_PREVIEW_TRUCKS_CHANGED));
}

export function mergeRegisteredTrucks(baseTrucks: readonly FleetTruck[]): FleetTruck[] {
  const local = readBrowserPreviewTrucks();
  if (local.length === 0) return [...baseTrucks];

  const seen = new Set(baseTrucks.map((truck) => truck.plateNumber.toUpperCase()));
  const extra = local.filter((truck) => !seen.has(truck.plateNumber.toUpperCase()));
  return [...baseTrucks, ...extra];
}

