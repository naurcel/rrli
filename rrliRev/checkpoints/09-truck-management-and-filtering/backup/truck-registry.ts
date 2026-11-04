import type {
  DeliveryRateBasis,
  TruckOwnership,
  TruckType,
} from "./delivery-domain.ts";

export type { DeliveryRateBasis, TruckOwnership } from "./delivery-domain.ts";

export type FleetTruck = {
  id: string;
  plateNumber: string;
  truckType: TruckType;
  ownershipType: TruckOwnership;
  rateBasis: DeliveryRateBasis;
  provider: string | null;
  contactPerson: string | null;
};

export const OWNED_TRUCKS = [
  { id: "20000000-0000-4000-8000-000000000001", plateNumber: "NGS 4281", truckType: "6-Wheeler", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
  { id: "20000000-0000-4000-8000-000000000002", plateNumber: "DAA 7310", truckType: "6-Wheeler", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
  { id: "20000000-0000-4000-8000-000000000003", plateNumber: "CBZ 1187", truckType: "10-Wheeler", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
  { id: "20000000-0000-4000-8000-000000000004", plateNumber: "NBE 9042", truckType: "4-Wheeler", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
  { id: "20000000-0000-4000-8000-000000000005", plateNumber: "ABX 2201", truckType: "4-Wheeler", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
  { id: "20000000-0000-4000-8000-000000000006", plateNumber: "XCY 6612", truckType: "4-Wheeler", ownershipType: "Owned", rateBasis: "Redeemed Rate", provider: null, contactPerson: null },
] as const satisfies readonly FleetTruck[];

export const SUBCONTRACTED_TRUCKS = [
  { id: "21000000-0000-4000-8000-000000000001", plateNumber: "KLM 4821", truckType: "4-Wheeler", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Northline Hauling", contactPerson: "Adrian Cruz" },
  { id: "21000000-0000-4000-8000-000000000002", plateNumber: "PQR 7156", truckType: "6-Wheeler", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Silverroad Transport", contactPerson: "Maribel Santos" },
  { id: "21000000-0000-4000-8000-000000000003", plateNumber: "TUV 3098", truckType: "10-Wheeler", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Primeway Logistics", contactPerson: "Leo Navarro" },
  { id: "21000000-0000-4000-8000-000000000004", plateNumber: "BCD 8642", truckType: "4-Wheeler", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Eastgate Carriers", contactPerson: "Ramon Lim" },
  { id: "21000000-0000-4000-8000-000000000005", plateNumber: "HJK 2207", truckType: "6-Wheeler", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Roadcrest Freight", contactPerson: "Angela Ramos" },
  { id: "21000000-0000-4000-8000-000000000006", plateNumber: "MNP 5934", truckType: "4-Wheeler", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Metrohaul Services", contactPerson: "Joel Mendoza" },
  { id: "21000000-0000-4000-8000-000000000007", plateNumber: "STX 1479", truckType: "10-Wheeler", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Summit Cargo Lines", contactPerson: "Carla Reyes" },
  { id: "21000000-0000-4000-8000-000000000008", plateNumber: "VWX 6385", truckType: "6-Wheeler", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Harborlink Transport", contactPerson: "Dennis Flores" },
  { id: "21000000-0000-4000-8000-000000000009", plateNumber: "EFG 9013", truckType: "4-Wheeler", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Greenlane Hauling", contactPerson: "Nina Garcia" },
  { id: "21000000-0000-4000-8000-000000000010", plateNumber: "JRS 3760", truckType: "6-Wheeler", ownershipType: "Subcontracted", rateBasis: "Trucker Rate", provider: "Transpeak Logistics", contactPerson: "Victor Aquino" },
] as const satisfies readonly FleetTruck[];

export const FLEET_TRUCKS: readonly FleetTruck[] = [
  ...OWNED_TRUCKS,
  ...SUBCONTRACTED_TRUCKS,
];

export const dynamicFleetTrucks: FleetTruck[] = [];

export function getFleetTrucks(): readonly FleetTruck[] {
  return [...FLEET_TRUCKS, ...dynamicFleetTrucks];
}

export function getOwnedTrucks(): readonly FleetTruck[] {
  return [
    ...OWNED_TRUCKS,
    ...dynamicFleetTrucks.filter((truck) => truck.ownershipType === "Owned"),
  ];
}

export function getSubcontractedTrucks(): readonly FleetTruck[] {
  return [
    ...SUBCONTRACTED_TRUCKS,
    ...dynamicFleetTrucks.filter((truck) => truck.ownershipType === "Subcontracted"),
  ];
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
  return { ok: true, truck: registered };
}

export function resetDynamicFleetTrucks(): void {
  dynamicFleetTrucks.length = 0;
}
