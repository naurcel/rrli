"use client";

import Link from "next/link";
import { use, useMemo } from "react";

import {
  formatDateRange,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { summarizeTruckProfitability } from "@/features/deliveries/delivery-domain";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { formatPercent, formatPeso } from "@/lib/format";

export default function TruckProfilePage({
  params,
}: {
  params: Promise<{ plate: string }>;
}) {
  const { plate } = use(params);
  let decodedPlate = plate;
  try {
    decodedPlate = decodeURIComponent(plate);
  } catch {
    // Keep malformed segments unchanged so they resolve to the unavailable state.
  }
  const normalizedPlate = decodedPlate.replace(/\+/g, " ").trim().replace(/\s+/g, " ").toUpperCase();
  const { range } = useGlobalDateRange();
  const { deliveries, loading, error } = usePersistedDeliveries(range);

  const truckTrips = useMemo(
    () =>
      deliveries.filter(
        (trip) => trip.plateNumber.toUpperCase() === normalizedPlate,
      ),
    [deliveries, normalizedPlate],
  );

  const truck = useMemo(
    () =>
      summarizeTruckProfitability(deliveries).find(
        (summary) => summary.plateNumber.toUpperCase() === normalizedPlate,
      ) ?? null,
    [deliveries, normalizedPlate],
  );

  return (
    <>
      <OperationalTopbar contextLabel={`Truck ${normalizedPlate}`} />

      <div className="content-wrap fleet-detail-page truck-profile-page">
        <Link className="back-link" href="/truck-profitability">
          ← Back to Trucks
        </Link>

        {loading ? (
          <section className="notice" role="status">
            <span className="notice-icon" aria-hidden="true">i</span>
            <div><strong>Loading truck profile:</strong><span>Calculating this truck&apos;s delivery performance.</span></div>
          </section>
        ) : error ? (
          <section className="notice" role="alert">
            <span className="notice-icon" aria-hidden="true">!</span>
            <div><strong>Truck profile unavailable:</strong><span>{error}</span></div>
          </section>
        ) : !truck ? (
          <section className="fallback-panel truck-profile-unavailable">
            <h1>Truck profile unavailable</h1>
            <p>No finalized deliveries for {normalizedPlate} are available in the selected date range.</p>
            <Link className="fallback-link" href="/truck-profitability">Back to trucks</Link>
          </section>
        ) : (
          <>
            <header className="page-intro truck-profile-page-intro">
              <div>
                <h1>{truck.plateNumber}</h1>
                <p className="subtitle">
                  {truck.truckType} · {truck.truckTemperature} · {formatDateRange(range)}
                </p>
              </div>
            </header>

            <section className="truck-profile-hero" aria-label="Truck profile overview">
              <article className="records-card truck-profile-visual">
                <div className="fleet-photo"><span>No photo yet</span></div>
                <div className="truck-profile-visual-copy">
                  <strong>{truck.plateNumber}</strong>
                  <p>{truck.truckType} · {truck.truckTemperature}</p>
                </div>
              </article>

              <article className="records-card truck-profile-card">
                <div className="records-heading">
                  <div>
                    <h2>Truck Details</h2>
                    <p>Identity and operational information from current delivery records.</p>
                  </div>
                </div>
                <dl className="truck-profile-list">
                  <div><dt>Plate number</dt><dd>{truck.plateNumber}</dd></div>
                  <div><dt>Vehicle type</dt><dd>{truck.truckType}</dd></div>
                  <div><dt>Temperature</dt><dd>{truck.truckTemperature}</dd></div>
                  <div><dt>Store drop-offs</dt><dd>{truck.totalStoresServed}</dd></div>
                  <div><dt>Total distance</dt><dd>{truck.totalDistanceKm} km</dd></div>
                </dl>
              </article>

              <article className="records-card truck-profile-card truck-profile-availability">
                <div className="records-heading">
                  <div>
                    <h2>Operational Summary</h2>
                    <p>Finalized delivery performance in the selected range.</p>
                  </div>
                </div>
                <div className="truck-performance-kpis" aria-label="Truck performance metrics">
                  <div><span>Total deliveries</span><strong>{truck.completedTrips}</strong></div>
                  <div><span>Revenue</span><strong>{formatPeso(truck.totalEarnings)}</strong></div>
                  <div><span>Total expenses</span><strong>{formatPeso(truck.totalExpenses)}</strong></div>
                  <div><span>Net income</span><strong className={truck.netProfit < 0 ? "warning" : undefined}>{formatPeso(truck.netProfit)}</strong></div>
                  <div><span>Profit margin</span><strong className={truck.netProfit < 0 ? "warning" : undefined}>{formatPercent(truck.marginPercent)}</strong></div>
                </div>
              </article>
            </section>

            <section className="records-card truck-profile-deliveries" aria-label="Truck delivery history">
              <div className="records-heading">
                <div>
                  <h2>Delivery History</h2>
                  <p>{truckTrips.length} record{truckTrips.length === 1 ? "" : "s"} for this truck in the selected range</p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Waybill & Date</th>
                      <th>Client</th>
                      <th>Drop-offs</th>
                      <th>Distance</th>
                      <th>Revenue</th>
                      <th>Expenses</th>
                      <th>Net Income</th>
                      <th>POD Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {truckTrips.map((trip) => (
                      <tr key={trip.id}>
                        <td><strong>{trip.waybillNumber}</strong><br /><small>{trip.deliveryDate}</small></td>
                        <td>{trip.clientName}</td>
                        <td>{trip.dropoffs.length} stores</td>
                        <td>{trip.distanceKm} km</td>
                        <td className="money">{formatPeso(trip.deliveryRate)}</td>
                        <td>{formatPeso(trip.totalExpenses)}</td>
                        <td className="money">{formatPeso(trip.netIncome)}</td>
                        <td>
                          <span className={`pod-status ${trip.podStatus === "Verified" ? "attached" : "missing"}`}>
                            <i aria-hidden="true" />
                            {trip.podStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
