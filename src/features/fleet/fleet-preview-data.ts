export const fleetTruckTypes = ["4-wheeler", "6-wheeler", "10-wheeler"] as const;
export type FleetTruckType = (typeof fleetTruckTypes)[number];
export type FleetTruckStatus = "Active" | "Inactive";
export type FleetOwnership = "Owned" | "Subcontracted";

export type FleetTruck = {
  id: string;
  type: FleetTruckType;
  status: FleetTruckStatus;
  revenue: string;
  expenses: string;
  margin: string;
};

export type SubcontractedTruck = {
  truck: string;
  company: string;
  type: FleetTruckType;
  status: FleetTruckStatus;
  margin: string;
};

export type FleetProfileTruck = {
  id: string;
  type: FleetTruckType;
  ownership: FleetOwnership;
  status: FleetTruckStatus;
  provider?: string;
  assignmentMargin?: string;
};

export const ownedFleetTrucks: readonly FleetTruck[] = [
  { id: "NGS 4281", type: "6-wheeler", status: "Active", revenue: "₱158,300", expenses: "₱70,600", margin: "₱87,700" },
  { id: "DAA 7310", type: "6-wheeler", status: "Active", revenue: "₱46,800", expenses: "₱18,800", margin: "₱28,000" },
  { id: "CBZ 1187", type: "10-wheeler", status: "Active", revenue: "₱48,100", expenses: "₱22,100", margin: "₱26,000" },
  { id: "NBE 9042", type: "6-wheeler", status: "Active", revenue: "₱155,600", expenses: "₱70,400", margin: "₱85,200" },
  { id: "ABX 2201", type: "6-wheeler", status: "Active", revenue: "₱57,000", expenses: "₱27,200", margin: "₱29,800" },
  { id: "XCY 6612", type: "4-wheeler", status: "Active", revenue: "₱44,100", expenses: "₱26,200", margin: "₱17,900" },
] as const;

const subcontractorCompanies = ["AXL", "KMV", "TQX", "RLP", "VNT", "GDX", "HBR", "LNS", "QRS", "MTR"] as const;
const subcontractedStatuses: SubcontractedTruck["status"][] = ["Active"];

// Sample assignments only. These stay deterministic so filters, sorting, and pagination
// can be exercised without representing a connected subcontractor data source.
export const subcontractedFleetTrucks: readonly SubcontractedTruck[] = Array.from({ length: 50 }, (_, index) => {
  const sequence = index + 1;
  const firstLetter = String.fromCharCode(65 + (index % 26));
  const secondLetter = String.fromCharCode(65 + ((index * 7) % 26));
  const thirdLetter = String.fromCharCode(65 + ((index * 11) % 26));
  const truckType = fleetTruckTypes[index % fleetTruckTypes.length];
  const status = subcontractedStatuses[index % subcontractedStatuses.length];
  const margin = 18_000 + ((index * 3_700) % 29_000);

  return {
    truck: `${firstLetter}${secondLetter}${thirdLetter} ${String(3400 + sequence).padStart(4, "0")}`,
    company: subcontractorCompanies[index % subcontractorCompanies.length],
    type: truckType,
    status,
    margin: `₱${margin.toLocaleString("en-PH")}`,
  };
});

export function findOwnedFleetTruck(truckId: string): FleetTruck | undefined {
  return ownedFleetTrucks.find((truck) => truck.id === truckId);
}

/**
 * Resolve either kind of truck using the plate number shown throughout Fleet.
 * The profile intentionally does not manufacture financial figures for a
 * subcontracted assignment; those records currently expose a net-income
 * amount only, with no revenue or expense breakdown from which to derive a
 * profit margin.
 */
export function findFleetProfileTruck(truckId: string): FleetProfileTruck | undefined {
  const normalizedId = truckId.trim().replace(/\s+/g, " ");
  const ownedTruck = findOwnedFleetTruck(normalizedId);
  if (ownedTruck) return { ...ownedTruck, ownership: "Owned" };

  const subcontractedTruck = subcontractedFleetTrucks.find((truck) => truck.truck === normalizedId);
  if (!subcontractedTruck) return undefined;
  return {
    id: subcontractedTruck.truck,
    type: subcontractedTruck.type,
    ownership: "Subcontracted",
    status: subcontractedTruck.status,
    provider: subcontractedTruck.company,
    assignmentMargin: subcontractedTruck.margin,
  };
}
