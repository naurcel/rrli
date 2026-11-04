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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20M2 12h20" />
            </svg>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
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