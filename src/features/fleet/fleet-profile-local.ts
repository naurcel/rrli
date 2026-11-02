"use client";

import { fleetTruckTypes, type FleetTruckStatus, type FleetTruckType } from "@/features/fleet/fleet-preview-data";

const STORAGE_KEY = "routex-fleet-profile-overrides";
export const FLEET_PROFILE_UPDATED_EVENT = "routex-fleet-profile-updated";

export type FleetProfileOverride = {
  truckId: string;
  type: FleetTruckType;
  status: FleetTruckStatus;
};

function isFleetTruckType(value: unknown): value is FleetTruckType {
  return typeof value === "string" && (fleetTruckTypes as readonly string[]).includes(value);
}

function isFleetTruckStatus(value: unknown): value is FleetTruckStatus {
  return value === "Active" || value === "Inactive";
}

function isFleetProfileOverride(value: unknown): value is FleetProfileOverride {
  if (!value || typeof value !== "object") return false;
  const override = value as Record<string, unknown>;
  return typeof override.truckId === "string" && isFleetTruckType(override.type) && isFleetTruckStatus(override.status);
}

export function readFleetProfileOverrides(): Record<string, FleetProfileOverride> {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return {};
    return Object.fromEntries(parsed.filter(isFleetProfileOverride).map((item) => [item.truckId, item]));
  } catch {
    return {};
  }
}

export function saveFleetProfileOverride(override: FleetProfileOverride): void {
  const current = readFleetProfileOverrides();
  current[override.truckId] = override;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.values(current)));
  window.dispatchEvent(new Event(FLEET_PROFILE_UPDATED_EVENT));
}
