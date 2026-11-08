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
          <span className="crew-role-badge driver">
            Drivers
          </span>
          <span className="crew-count-pill" title={`${drivers.length} driver(s) assigned`}>
            {drivers.length}
          </span>
        </div>

        {drivers.length === 0 ? (
          <div className="crew-empty-card">
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
                  <span className="crew-member-title">
                    {drivers.length > 1
                      ? index === 0
                        ? "Lead Driver"
                        : `Relief Driver #${index}`
                      : "Assigned Driver"}
                  </span>
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
          <span className="crew-role-badge helper">
            Helpers
          </span>
          <span className="crew-count-pill" title={`${helpers.length} helper(s) assigned`}>
            {helpers.length}
          </span>
        </div>

        {helpers.length === 0 ? (
          <div className="crew-empty-card">
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
                  <span className="crew-member-title">
                    {helpers.length > 1 ? `Delivery Helper #${index + 1}` : "Assigned Helper"}
                  </span>
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