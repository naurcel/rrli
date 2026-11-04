/**
 * RouteX: Truck Photo Storage & Key Utilities
 * Provides canonical, normalized localStorage key resolution for truck pictures.
 */

export const TRUCK_PHOTO_EVENT = "routex:truck-photo-updated";

/**
 * Resolves the canonical localStorage key for a truck's profile picture.
 * Normalizes by trimming whitespace and capitalizing the plate number.
 */
export function getTruckPhotoStorageKey(plateNumber: string): string {
  return `routex.truck-photo.${plateNumber.trim().toUpperCase()}`;
}

export function storageKey(plateNumber: string): string {
  return getTruckPhotoStorageKey(plateNumber);
}

export function getTruckPhotoFromStorage(plateNumber: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage.getItem(getTruckPhotoStorageKey(plateNumber));
}

