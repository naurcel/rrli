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

export function upsertBrowserPreviewTruck(truck: FleetTruck): void {
  if (typeof window === "undefined") return;
  const normalized = truck.plateNumber.trim().toUpperCase();
  const current = readBrowserPreviewTrucks();
  const updated = [
    { ...truck, plateNumber: normalized },
    ...current.filter(
      (candidate) =>
        candidate.plateNumber.toUpperCase() !== normalized &&
        candidate.id !== truck.id,
    ),
  ];
  window.localStorage.setItem(BROWSER_PREVIEW_TRUCKS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event(BROWSER_PREVIEW_TRUCKS_CHANGED));
}

export function updateBrowserPreviewTruck(originalPlateNumber: string, truck: FleetTruck): void {
  if (typeof window === "undefined") return;
  const origNorm = originalPlateNumber.trim().toUpperCase();
  const nextNorm = truck.plateNumber.trim().toUpperCase();
  const current = readBrowserPreviewTrucks();
  const updated = [
    { ...truck, plateNumber: nextNorm },
    ...current.filter(
      (candidate) =>
        candidate.plateNumber.toUpperCase() !== origNorm &&
        candidate.plateNumber.toUpperCase() !== nextNorm &&
        candidate.id !== truck.id,
    ),
  ];
  window.localStorage.setItem(BROWSER_PREVIEW_TRUCKS_KEY, JSON.stringify(updated));

  const deleted = readBrowserDeletedTrucks().map((p) => p.toUpperCase());
  const nextDeleted = new Set(deleted);
  if (origNorm !== nextNorm) {
    nextDeleted.add(origNorm);
  }
  nextDeleted.delete(nextNorm);
  window.localStorage.setItem(BROWSER_DELETED_TRUCKS_KEY, JSON.stringify([...nextDeleted]));

  window.dispatchEvent(new Event(BROWSER_PREVIEW_TRUCKS_CHANGED));
}

export function clearBrowserPreviewTrucks(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BROWSER_PREVIEW_TRUCKS_KEY);
  window.localStorage.removeItem(BROWSER_DELETED_TRUCKS_KEY);
  window.dispatchEvent(new Event(BROWSER_PREVIEW_TRUCKS_CHANGED));
}

export const BROWSER_DELETED_TRUCKS_KEY = "routex-browser-deleted-trucks-v1";

export function readBrowserDeletedTrucks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BROWSER_DELETED_TRUCKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function deleteBrowserPreviewTruck(plateNumber: string): void {
  if (typeof window === "undefined") return;
  const normalized = plateNumber.trim().toUpperCase();
  const current = readBrowserPreviewTrucks();
  const updated = current.filter((candidate) => candidate.plateNumber.toUpperCase() !== normalized);
  window.localStorage.setItem(BROWSER_PREVIEW_TRUCKS_KEY, JSON.stringify(updated));

  const deleted = readBrowserDeletedTrucks();
  if (!deleted.includes(normalized)) {
    window.localStorage.setItem(BROWSER_DELETED_TRUCKS_KEY, JSON.stringify([...deleted, normalized]));
  }
  window.dispatchEvent(new Event(BROWSER_PREVIEW_TRUCKS_CHANGED));
}

export function mergeRegisteredTrucks(baseTrucks: readonly FleetTruck[]): FleetTruck[] {
  const local = readBrowserPreviewTrucks();
  const deleted = new Set(readBrowserDeletedTrucks().map((p) => p.toUpperCase()));
  const activeBase = baseTrucks.filter((truck) => !deleted.has(truck.plateNumber.toUpperCase()));
  if (local.length === 0) return activeBase;

  const byKey = new Map<string, FleetTruck>();
  for (const truck of activeBase) {
    byKey.set(truck.plateNumber.toUpperCase(), truck);
  }
  for (const truck of local) {
    if (deleted.has(truck.plateNumber.toUpperCase())) continue;
    for (const [key, existing] of byKey.entries()) {
      if (existing.id === truck.id) {
        byKey.delete(key);
      }
    }
    byKey.set(truck.plateNumber.toUpperCase(), truck);
  }
  return [...byKey.values()];
}

