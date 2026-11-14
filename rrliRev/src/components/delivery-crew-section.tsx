"use client";

import { useMemo } from "react";
import { parsePersonnelNames, getPersonnelInitials } from "@/features/deliveries/crew-utils";

export { parsePersonnelNames, getPersonnelInitials };

type DeliveryCrewSectionProps = {
  driverName?: string | null;
  helperName?: string | null;
  driverRateText?: string;
  helperRateText?: string;
};

export function DeliveryCrewSection({
  driverName,
  helperName,
  driverRateText,
  helperRateText,
}: DeliveryCrewSectionProps) {
  const drivers = useMemo(() => parsePersonnelNames(driverName), [driverName]);
  const helpers = useMemo(() => parsePersonnelNames(helperName), [helperName]);

  return (
    <div className="delivery-crew-grid" aria-label="Assigned delivery crew">
      {/* Drivers Column */}
      <div className="crew-column">
        <div className="crew-column-header">
          <strong className="crew-column-title">Drivers</strong>
        </div>

        {drivers.length === 0 ? (
          <div className="crew-empty-card" title="No driver recorded for this delivery run">
            <span className="crew-empty-text">No driver recorded for this delivery</span>
          </div>
        ) : (
          <div className="crew-list">
            {drivers.map((driver, index) => (
              <div className="crew-member-card" key={`${driver}-${index}`}>
                <div className="crew-avatar driver" aria-hidden="true">
                  {getPersonnelInitials(driver)}
                </div>
                <div className="crew-member-info">
                  <strong className="crew-member-name">{driver}</strong>
                </div>
              </div>
            ))}
          </div>
        )}

        {driverRateText ? (
          <div className="crew-rate-row">
            <span>Daily Rate + Allowance</span>
            <strong>{driverRateText}</strong>
          </div>
        ) : null}
      </div>

      {/* Helpers Column */}
      <div className="crew-column">
        <div className="crew-column-header">
          <strong className="crew-column-title">Helpers</strong>
        </div>

        {helpers.length === 0 ? (
          <div className="crew-empty-card" title="Solo driver run — no helper assigned for this delivery">
            <span className="crew-empty-text">No helper assigned for this delivery</span>
          </div>
        ) : (
          <div className="crew-list">
            {helpers.map((helper, index) => (
              <div className="crew-member-card" key={`${helper}-${index}`}>
                <div className="crew-avatar helper" aria-hidden="true">
                  {getPersonnelInitials(helper)}
                </div>
                <div className="crew-member-info">
                  <strong className="crew-member-name">{helper}</strong>
                </div>
              </div>
            ))}
          </div>
        )}

        {helperRateText ? (
          <div className="crew-rate-row">
            <span>Daily Rate + Allowance</span>
            <strong>{helperRateText}</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}