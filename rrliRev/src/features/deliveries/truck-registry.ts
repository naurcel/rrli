import type {
  DeliveryRateBasis,
  TruckOwnership,
  TruckType,
} from "./delivery-domain.ts";

export type { DeliveryRateBasis, TruckOwnership } from "./delivery-domain.ts";

export type TruckStorageCapability = "Refrigerated" | "Dry";

export type FleetTruck = {
  id: string;
  plateNumber: string;
  truckType: TruckType;
  storageCapability?: TruckStorageCapability;
  ownershipType: TruckOwnership;
  rateBasis: DeliveryRateBasis;
  provider: string | null;
  contactPerson: string | null;
};

export const OWNED_TRUCKS = [
  { id: "20000000-0000-4000-8000-000000000001", plateNumber: "NGS 4281", truckType: "6-Wheeler", storageCapability: "Refrigerated", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
  { id: "20000000-0000-4000-8000-000000000002", plateNumber: "DAA 7310", truckType: "6-Wheeler", storageCapability: "Refrigerated", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
  { id: "20000000-0000-4000-8000-000000000003", plateNumber: "CBZ 1187", truckType: "10-Wheeler", storageCapability: "Dry", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
  { id: "20000000-0000-4000-8000-000000000004", plateNumber: "NBE 9042", truckType: "4-Wheeler", storageCapability: "Refrigerated", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
  { id: "20000000-0000-4000-8000-000000000005", plateNumber: "ABX 2201", truckType: "4-Wheeler", storageCapability: "Refrigerated", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
  { id: "20000000-0000-4000-8000-000000000006", plateNumber: "XCY 6612", truckType: "4-Wheeler", storageCapability: "Dry", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
] as const satisfies readonly FleetTruck[];

export const SUBCONTRACTED_TRUCKS = [
  { id: "21000000-0000-4000-8000-000000000001", plateNumber: "KLM 4821", truckType: "4-Wheeler", storageCapability: "Dry", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Northline Hauling", contactPerson: "Adrian Cruz" },
  { id: "21000000-0000-4000-8000-000000000002", plateNumber: "PQR 7156", truckType: "6-Wheeler", storageCapability: "Refrigerated", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Silverroad Transport", contactPerson: "Maribel Santos" },
  { id: "21000000-0000-4000-8000-000000000003", plateNumber: "TUV 3098", truckType: "10-Wheeler", storageCapability: "Dry", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Primeway Logistics", contactPerson: "Leo Navarro" },
  { id: "21000000-0000-4000-8000-000000000004", plateNumber: "BCD 8642", truckType: "4-Wheeler", storageCapability: "Refrigerated", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Eastgate Carriers", contactPerson: "Ramon Lim" },
  { id: "21000000-0000-4000-8000-000000000005", plateNumber: "HJK 2207", truckType: "6-Wheeler", storageCapability: "Refrigerated", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Roadcrest Freight", contactPerson: "Angela Ramos" },
  { id: "21000000-0000-4000-8000-000000000006", plateNumber: "MNP 5934", truckType: "4-Wheeler", storageCapability: "Dry", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Metrohaul Services", contactPerson: "Joel Mendoza" },
  { id: "21000000-0000-4000-8000-000000000007", plateNumber: "STX 1479", truckType: "10-Wheeler", storageCapability: "Dry", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Summit Cargo Lines", contactPerson: "Carla Reyes" },
  { id: "21000000-0000-4000-8000-000000000008", plateNumber: "VWX 6385", truckType: "6-Wheeler", storageCapability: "Refrigerated", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Harborlink Transport", contactPerson: "Dennis Flores" },
  { id: "21000000-0000-4000-8000-000000000009", plateNumber: "EFG 9013", truckType: "4-Wheeler", storageCapability: "Dry", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Greenlane Hauling", contactPerson: "Nina Garcia" },
  { id: "21000000-0000-4000-8000-000000000010", plateNumber: "JRS 3760", truckType: "6-Wheeler", storageCapability: "Refrigerated", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Transpeak Logistics", contactPerson: "Victor Aquino" },
] as const satisfies readonly FleetTruck[];

export const KNOWN_REFRIGERATED_PLATES = new Set([
  "NGS 4281",
  "DAA 7310",
  "NBE 9042",
  "ABX 2201",
  "PQR 7156",
  "BCD 8642",
  "HJK 2207",
  "VWX 6385",
  "JRS 3760",
]);

export function getTruckStorageCapability(
  plateNumber: string,
  explicitCapability?: TruckStorageCapability | null,
): TruckStorageCapability {
  if (explicitCapability) return explicitCapability;
  const normalized = plateNumber.trim().toUpperCase().replace(/\s+/g, " ");
  return KNOWN_REFRIGERATED_PLATES.has(normalized) ? "Refrigerated" : "Dry";
}

export function getTruckClassificationLabel(
  truckType: TruckType,
  capability: TruckStorageCapability,
): string {
  const simplified = capability === "Refrigerated" ? "Cold" : "Dry";
  return `${truckType} · ${simplified}`;
}

export const TRUCK_CLASSIFICATION_FILTER_OPTIONS = [
  { value: "all", label: "All Classifications" },
  { value: "dry", label: "Dry" },
  { value: "cold", label: "Cold" },
] as const;

export type TruckClassificationFilterKey =
  | (typeof TRUCK_CLASSIFICATION_FILTER_OPTIONS)[number]["value"]
  | "refrigerated";

export const TRUCK_PERFORMANCE_FILTER_OPTIONS = [
  { value: "all", label: "All Performance Tiers" },
  { value: "top_performing", label: "Top Performing (Net Profit > ₱0)" },
  { value: "high_value", label: "Highest Value (Revenue ≥ ₱50k)" },
  { value: "active", label: "Active in Period (≥ 1 Trip)" },
] as const;

export type TruckPerformanceFilterKey = (typeof TRUCK_PERFORMANCE_FILTER_OPTIONS)[number]["value"];

export const FLEET_TRUCKS: readonly FleetTruck[] = [
  ...OWNED_TRUCKS,
  ...SUBCONTRACTED_TRUCKS,
];

export const dynamicFleetTrucks: FleetTruck[] = [];
export const deletedTruckPlateNumbers = new Set<string>();

export function getFleetTrucks(): readonly FleetTruck[] {
  const byIdOrPlate = new Map<string, FleetTruck>();
  for (const truck of FLEET_TRUCKS) {
    if (deletedTruckPlateNumbers.has(truck.plateNumber.toUpperCase())) continue;
    byIdOrPlate.set(truck.id, truck);
  }
  for (const truck of dynamicFleetTrucks) {
    if (deletedTruckPlateNumbers.has(truck.plateNumber.toUpperCase())) continue;
    // Remove any existing entry with the same plate number if ID differs
    for (const [key, existing] of byIdOrPlate.entries()) {
      if (existing.plateNumber.toUpperCase() === truck.plateNumber.toUpperCase()) {
        byIdOrPlate.delete(key);
      }
    }
    byIdOrPlate.set(truck.id, truck);
  }
  return [...byIdOrPlate.values()];
}

export function getOwnedTrucks(): readonly FleetTruck[] {
  return getFleetTrucks().filter((truck) => truck.ownershipType === "Owned");
}

export function getSubcontractedTrucks(): readonly FleetTruck[] {
  return getFleetTrucks().filter((truck) => truck.ownershipType === "Subcontracted");
}

export function registerFleetTruck(truck: FleetTruck): { ok: true; truck: FleetTruck } | { ok: false; error: string } {
  const normalizedPlate = truck.plateNumber.trim().toUpperCase();
  if (!normalizedPlate) {
    return { ok: false, error: "Plate number is required." };
  }

  const existing = getFleetTrucks().some(
    (existingTruck) => existingTruck.plateNumber.toUpperCase() === normalizedPlate,
  );
  if (existing) {
    return { ok: false, error: `Truck with plate number "${normalizedPlate}" already exists.` };
  }

  const registered: FleetTruck = {
    ...truck,
    plateNumber: normalizedPlate,
  };
  dynamicFleetTrucks.push(registered);
  deletedTruckPlateNumbers.delete(normalizedPlate);
  return { ok: true, truck: registered };
}

export function updateFleetTruck(
  originalIdentifier: string,
  updates: {
    plateNumber: string;
    truckType: TruckType;
    storageCapability?: TruckStorageCapability;
    ownershipType: TruckOwnership;
    rateBasis?: DeliveryRateBasis;
    provider?: string | null;
    contactPerson?: string | null;
  },
):
  | { ok: true; truck: FleetTruck }
  | { ok: false; code: "NOT_FOUND" | "DUPLICATE_PLATE" | "VALIDATION_ERROR"; error: string } {
  const normalizedOriginal = originalIdentifier.trim().toUpperCase();
  const currentFleet = getFleetTrucks();
  const target = currentFleet.find(
    (t) => t.id === originalIdentifier || t.plateNumber.toUpperCase() === normalizedOriginal,
  );
  if (!target) {
    return { ok: false, code: "NOT_FOUND", error: "Truck not found." };
  }

  const normalizedNextPlate = updates.plateNumber.trim().toUpperCase();
  if (!normalizedNextPlate) {
    return { ok: false, code: "VALIDATION_ERROR", error: "Plate number is required." };
  }

  const duplicate = currentFleet.some(
    (t) =>
      t.id !== target.id &&
      t.plateNumber.toUpperCase() !== target.plateNumber.toUpperCase() &&
      t.plateNumber.toUpperCase() === normalizedNextPlate,
  );
  if (duplicate) {
    return {
      ok: false,
      code: "DUPLICATE_PLATE",
      error: `Truck with plate number "${normalizedNextPlate}" already exists.`,
    };
  }

  const oldPlateUpper = target.plateNumber.toUpperCase();
  if (oldPlateUpper !== normalizedNextPlate) {
    deletedTruckPlateNumbers.add(oldPlateUpper);
  }
  deletedTruckPlateNumbers.delete(normalizedNextPlate);

  const rateBasis =
    updates.rateBasis ??
    (updates.ownershipType === "Owned" ? "Redeemed Rate" : "Trucker Rate");

  const updatedTruck: FleetTruck = {
    ...target,
    plateNumber: normalizedNextPlate,
    truckType: updates.truckType,
    storageCapability: updates.storageCapability ?? target.storageCapability,
    ownershipType: updates.ownershipType,
    rateBasis,
    provider: updates.ownershipType === "Subcontracted" ? (updates.provider?.trim() || null) : null,
    contactPerson: updates.ownershipType === "Subcontracted" ? (updates.contactPerson?.trim() || null) : null,
  };

  const dynIndex = dynamicFleetTrucks.findIndex(
    (t) => t.id === target.id || t.plateNumber.toUpperCase() === oldPlateUpper,
  );
  if (dynIndex >= 0) {
    dynamicFleetTrucks[dynIndex] = updatedTruck;
  } else {
    dynamicFleetTrucks.push(updatedTruck);
  }

  return { ok: true, truck: updatedTruck };
}

export function deleteFleetTruck(identifier: string): { ok: true } | { ok: false; error: string } {
  const normalized = identifier.trim().toUpperCase();
  const all = [...FLEET_TRUCKS, ...dynamicFleetTrucks];
  const target = all.find(
    (t) => t.id === identifier || t.plateNumber.toUpperCase() === normalized,
  );
  if (!target || deletedTruckPlateNumbers.has(target.plateNumber.toUpperCase())) {
    return { ok: false, error: "TRUCK_NOT_FOUND" };
  }
  deletedTruckPlateNumbers.add(target.plateNumber.toUpperCase());
  const dynIndex = dynamicFleetTrucks.findIndex(
    (t) => t.id === target.id || t.plateNumber.toUpperCase() === target.plateNumber.toUpperCase(),
  );
  if (dynIndex >= 0) {
    dynamicFleetTrucks.splice(dynIndex, 1);
  }
  return { ok: true };
}

export function resetDynamicFleetTrucks(): void {
  dynamicFleetTrucks.length = 0;
  deletedTruckPlateNumbers.clear();
}
