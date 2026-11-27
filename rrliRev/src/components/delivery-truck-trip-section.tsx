"use client";

import Link from "next/link";
import { TruckPhoto } from "@/components/truck-photo";
import { useFleetTruckMeta } from "@/components/use-fleet-truck-meta";
import {
  getTruckStorageCapability,
  type TruckOwnership,
} from "@/features/deliveries/truck-registry";
import type { TruckType } from "@/features/deliveries/delivery-domain";

export interface DeliveryTruckTripSectionProps {
  plateNumber: string;
  truckType: TruckType;
  truckTemperature: string;
  truckOwnership: TruckOwnership;
  rateBasis?: string | null;
  truckHref?: string;
  clientName: string;
  origin: string;
  distanceKm: number;
  fuelRate: number;
  deliveryDate: string;
  formatPeso: (amount: number | null | undefined) => string;
}

export function DeliveryTruckTripSection({
  plateNumber,
  truckType,
  truckTemperature,
  truckOwnership,
  truckHref,
  clientName,
  origin,
  distanceKm,
  fuelRate,
  deliveryDate,
  formatPeso,
}: DeliveryTruckTripSectionProps) {
  const truckMeta = useFleetTruckMeta(plateNumber);

  const storageCapability = getTruckStorageCapability(
    plateNumber,
    truckMeta?.storageCapability,
  );
  const provider = truckMeta?.provider;
  const isColdChain = storageCapability === "Freezer" || storageCapability === "Chilled";

  return (
    <div className="delivery-truck-trip-combined">
      {/* 1. Left Showcase: Expanded Truck Visual Showcase with High-Contrast Plate Badge */}
      <div className="delivery-truck-showcase">
        <div
          className="delivery-truck-showcase-photo-box"
          aria-label={`Picture of assigned truck ${plateNumber}`}
        >
          <TruckPhoto plateNumber={plateNumber} editable={false} />
        </div>

        <div className="delivery-truck-showcase-bar">
          <div className="delivery-truck-plate-wrap">
            {truckHref && truckOwnership === "Owned" ? (
              <Link
                href={truckHref}
                className="delivery-truck-plate-number"
                title={`View truck profile for ${plateNumber}`}
                style={{ textDecoration: "none" }}
              >
                {plateNumber}
              </Link>
            ) : (
              <span className="delivery-truck-plate-number">{plateNumber}</span>
            )}
            <span
              className={`detail-status ${truckOwnership === "Owned" ? "success" : "warning"}`}
            >
              {truckOwnership}
            </span>
            <span className={`routex-badge ${isColdChain ? "tone-primary" : "tone-neutral"}`}>
              {storageCapability}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Right Pane: Cohesive Trip Context & Vehicle Specifications (Eliminates Empty Space) */}
      <div className="delivery-specs-and-trip-pane">
        {/* Sub-Group A: Trip Routing & Operational Context */}
        <div className="delivery-specs-subgroup">
          <div className="delivery-specs-subgroup-header">
            <h3 className="delivery-specs-group-title">Trip Information</h3>
          </div>
          <div className="detail-meta-grid detail-meta-grid-2">
            <div className="detail-meta-item">
              <span className="meta-label">Client</span>
              <strong className="meta-value">{clientName}</strong>
            </div>
            <div className="detail-meta-item">
              <span className="meta-label">Date</span>
              <strong className="meta-value">{deliveryDate}</strong>
            </div>
            <div className="detail-meta-item" style={{ gridColumn: "1 / -1" }}>
              <span className="meta-label">Origin</span>
              <strong className="meta-value">{origin || "Default Origin"}</strong>
            </div>
            <div className="detail-meta-item">
              <span className="meta-label">Distance</span>
              <strong className="meta-value">{distanceKm} km</strong>
            </div>
            <div className="detail-meta-item">
              <span className="meta-label">Fuel Rate</span>
              <strong className="meta-value">{formatPeso(fuelRate)} / L</strong>
            </div>
          </div>
        </div>

        <div className="delivery-specs-divider" />

        {/* Sub-Group B: Vehicle Technical Specifications */}
        <div className="delivery-specs-subgroup">
          <div className="delivery-specs-subgroup-header">
            <h3 className="delivery-specs-group-title">Truck Specifications</h3>
          </div>
          <div className="detail-meta-grid detail-meta-grid-3">
            <div className="detail-meta-item">
              <span className="meta-label">Type</span>
              <strong className="meta-value">{truckType}</strong>
            </div>
            <div className="detail-meta-item">
              <span className="meta-label">Temperature</span>
              <strong className="meta-value">{truckTemperature}</strong>
            </div>
            <div className="detail-meta-item">
              <span className="meta-label">
                {truckOwnership === "Subcontracted" ? "Trucker" : "Fleet Type"}
              </span>
              <strong className="meta-value">
                {provider || (truckOwnership === "Owned" ? "Company Owned" : "Subcontracted")}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
