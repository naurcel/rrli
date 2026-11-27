"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BROWSER_PREVIEW_TRUCKS_CHANGED,
  readBrowserPreviewTrucks,
} from "@/features/deliveries/browser-preview-trucks";
import { getFleetTrucks, type FleetTruck } from "@/features/deliveries/truck-registry";

let cachedApiTrucks: FleetTruck[] | null = null;
let inFlightTrucksRequest: Promise<FleetTruck[]> | null = null;

async function fetchFleetTrucksFromApi(): Promise<FleetTruck[]> {
  if (cachedApiTrucks !== null) {
    return cachedApiTrucks;
  }
  if (!inFlightTrucksRequest) {
    inFlightTrucksRequest = fetch("/api/trucks", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return [];
        const data = (await res.json()) as { ok?: boolean; trucks?: FleetTruck[] };
        if (data?.ok && Array.isArray(data.trucks)) {
          cachedApiTrucks = data.trucks;
          return data.trucks;
        }
        return [];
      })
      .catch(() => [])
      .finally(() => {
        inFlightTrucksRequest = null;
      });
  }
  return inFlightTrucksRequest;
}

/**
 * Resolves the live fleet truck record for a plate number by combining
 * browser-preview storage, `/api/trucks`, and the static fallback registry.
 */
export function useFleetTruckMeta(plateNumber: string): FleetTruck | null {
  const [apiTrucks, setApiTrucks] = useState<FleetTruck[]>(() => cachedApiTrucks ?? []);
  const [localTrucks, setLocalTrucks] = useState<FleetTruck[]>([]);

  useEffect(() => {
    let active = true;
    setLocalTrucks(readBrowserPreviewTrucks());

    const handleLocalChange = () => {
      if (active) {
        setLocalTrucks(readBrowserPreviewTrucks());
      }
    };
    window.addEventListener(BROWSER_PREVIEW_TRUCKS_CHANGED, handleLocalChange);

    if (cachedApiTrucks === null) {
      void fetchFleetTrucksFromApi().then((trucks) => {
        if (active && trucks.length > 0) {
          setApiTrucks(trucks);
        }
      });
    }

    return () => {
      active = false;
      window.removeEventListener(BROWSER_PREVIEW_TRUCKS_CHANGED, handleLocalChange);
    };
  }, []);

  return useMemo(() => {
    const normalized = plateNumber.trim().toUpperCase();
    if (!normalized) return null;

    const findMatch = (list: readonly FleetTruck[]) =>
      list.find((truck) => truck.plateNumber.trim().toUpperCase() === normalized);

    return (
      findMatch(localTrucks) ??
      findMatch(apiTrucks) ??
      findMatch(getFleetTrucks()) ??
      null
    );
  }, [plateNumber, localTrucks, apiTrucks]);
}
