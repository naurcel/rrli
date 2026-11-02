"use client";

import { fleetTruckTypes, type FleetTruck, type FleetTruckType } from "@/features/fleet/fleet-preview-data";

const STORAGE_KEY = "routex-created-fleet-preview";

export type CreatedFleetTruck = FleetTruck & {
  createdAt: string;
};

function isFleetTruckType(value: unknown): value is FleetTruckType {
  return typeof value === "string" && (fleetTruckTypes as readonly string[]).includes(value);
}

function isCreatedFleetTruck(value: unknown): value is CreatedFleetTruck {
  if (!value || typeof value !== "object") return false;
  const truck = value as Record<string, unknown>;
  return typeof truck.id === "string"
    && isFleetTruckType(truck.type)
    && (truck.status === "Active" || truck.status === "Inactive")
    && typeof truck.revenue === "string"
    && typeof truck.expenses === "string"
    && typeof truck.margin === "string"
    && typeof truck.createdAt === "string";
}

export function readCreatedFleetTrucks(): CreatedFleetTruck[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isCreatedFleetTruck) : [];
  } catch {
    return [];
  }
}

export function saveCreatedFleetTruck(truck: CreatedFleetTruck): void {
  const current = readCreatedFleetTrucks().filter((item) => item.id !== truck.id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, truck]));
  window.dispatchEvent(new Event("routex-fleet-preview-updated"));
}
