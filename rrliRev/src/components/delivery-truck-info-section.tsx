"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TruckPhoto } from "@/components/truck-photo";
import {
  getFleetTrucks,
  getTruckStorageCapability,
  type TruckOwnership,
} from "@/features/deliveries/truck-registry";
import type { TruckType } from "@/features/deliveries/delivery-domain";

export function DeliveryTruckInfoSection({
  plateNumber,
  truckType,
  truckTemperature,
  truckOwnership,
  rateBasis: _rateBasis,
  truckHref,
}: {
  plateNumber: string;
  truckType: TruckType;
  truckTemperature: string;
  truckOwnership: TruckOwnership;
  rateBasis?: string | null;
  truckHref?: string;
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
            {truckHref && truckOwnership === "Owned" ? (
              <Link
                href={truckHref}
                className="delivery-truck-plate-badge"
                title={`View truck profile for ${plateNumber}`}
                style={{ textDecoration: "none" }}
              >
                {plateNumber}
              </Link>
            ) : (
              <span className="delivery-truck-plate-badge">{plateNumber}</span>
            )}
            <span
              className={`detail-status ${truckOwnership === "Owned" ? "success" : "warning"}`}
            >
              {truckOwnership}
            </span>
          </div>
        </div>

        <div className="delivery-truck-details-grid">
          <div>
            <span>Classification</span>
            <strong>{storageCapability === "Refrigerated" ? "Cold" : "Dry"}</strong>
          </div>
          <div>
            <span>Type</span>
            <strong>{truckType}</strong>
          </div>
          <div>
            <span>Temperature</span>
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
