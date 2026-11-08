"use client";

import { useMemo } from "react";
import { TruckPhoto } from "@/components/truck-photo";
import {
  getFleetTrucks,
  getTruckClassificationLabel,
  getTruckStorageCapability,
  type TruckOwnership,
} from "@/features/deliveries/truck-registry";
import type { TruckType } from "@/features/deliveries/delivery-domain";

export function DeliveryTruckInfoSection({
  plateNumber,
  truckType,
  truckTemperature,
  truckOwnership,
  rateBasis,
}: {
  plateNumber: string;
  truckType: TruckType;
  truckTemperature: string;
  truckOwnership: TruckOwnership;
  rateBasis?: string | null;
}) {
  const truckMeta = useMemo(() => {
    const fleet = getFleetTrucks();
    const normalized = plateNumber.trim().toUpperCase();
    return fleet.find((t) => t.plateNumber.toUpperCase() === normalized) ?? null;
  }, [plateNumber]);

  const storageCapability = getTruckStorageCapability(
    plateNumber,
    truckMeta?.storageCapability,
  );
  const classificationLabel = getTruckClassificationLabel(truckType, storageCapability);
  const provider = truckMeta?.provider;

  return (
    <div className="delivery-truck-banner">
      {/* 1. Responsive Truck Picture Box (preserves aspect ratio without distortion) */}
      <div
        className="delivery-truck-photo-box"
        aria-label={`Picture of assigned truck ${plateNumber}`}
      >
        <TruckPhoto plateNumber={plateNumber} editable={false} />
      </div>

      {/* 2. Structured Vehicle Metadata */}
      <div className="delivery-truck-meta">
        <div className="delivery-truck-plate-row">
          <div className="delivery-truck-plate-wrap">
            <span className="delivery-truck-plate-badge">{plateNumber}</span>
            <span
              className={`detail-status ${truckOwnership === "Owned" ? "success" : "warning"}`}
              title={`Ownership: ${truckOwnership}`}
            >
              {truckOwnership}
            </span>
          </div>
          <span
            className={`truck-capability-pill ${storageCapability === "Refrigerated" ? "reefer" : "dry"}`}
            title={`Cargo storage: ${storageCapability}`}
          >
            {storageCapability === "Refrigerated" ? "Cold Storage" : "Dry Cargo"}
          </span>
        </div>

        <div className="delivery-truck-details-grid">
          <div>
            <span>Classification</span>
            <strong title={classificationLabel}>{truckType}</strong>
          </div>
          <div>
            <span>Cargo Temp</span>
            <strong>{truckTemperature}</strong>
          </div>
          <div>
            <span>{truckOwnership === "Subcontracted" ? "Provider" : "Fleet Type"}</span>
            <strong>{provider || (truckOwnership === "Owned" ? "Company Owned" : "Subcontracted")}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
