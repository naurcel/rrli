import { TruckProfilePage } from "@/components/truck-profile-page";
import { ownedFleetTrucks, subcontractedFleetTrucks } from "@/features/fleet/fleet-preview-data";

export function generateStaticParams() {
  return [...ownedFleetTrucks.map((truck) => truck.id), ...subcontractedFleetTrucks.map((truck) => truck.truck)].map((truckId) => ({ truckId }));
}

export default async function FleetTruckDetailPage({ params }: { params: Promise<{ truckId: string }> }) {
  const { truckId } = await params;
  // Next may preserve an encoded dynamic segment in the route value. Plate
  // numbers contain spaces, so normalize it before looking up local fixtures.
  let decodedTruckId = truckId;
  try {
    decodedTruckId = decodeURIComponent(truckId);
  } catch {
    // Leave malformed URLs to the profile's unavailable state.
  }
  return <TruckProfilePage truckId={decodedTruckId} />;
}
