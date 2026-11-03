"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";

import {
  formatDateRange,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import { TruckPhoto } from "@/components/truck-photo";
import { summarizeTruckProfitability } from "@/features/deliveries/delivery-domain";
import { getFleetTrucks } from "@/features/deliveries/truck-registry";
import { readBrowserPreviewTrucks } from "@/features/deliveries/browser-preview-trucks";
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
  const [historySort, setHistorySort] = useState<{ key: string; direction: TableSortDirection }>({ key: "date", direction: "desc" });

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

  const registeredTruck = useMemo(() => {
    const all = [...getFleetTrucks(), ...readBrowserPreviewTrucks()];
    return all.find((candidate) => candidate.plateNumber.toUpperCase() === normalizedPlate) ?? null;
  }, [normalizedPlate]);

  const activeTruck = truck ?? (registeredTruck ? {
    plateNumber: registeredTruck.plateNumber,
    truckType: registeredTruck.truckType,
    completedTrips: 0,
    totalEarnings: 0,
    totalExpenses: 0,
    netProfit: 0,
    marginPercent: null,
    totalStoresServed: 0,
    totalDistanceKm: 0,
  } : null);

  const sortedTruckTrips = useMemo(() => {
    const multiplier = historySort.direction === "asc" ? 1 : -1;
    return [...truckTrips].sort((left, right) => {
      const values: Record<string, [string | number, string | number]> = {
        date: [left.deliveryDate, right.deliveryDate],
        client: [left.clientName, right.clientName],
        dropoffs: [left.dropoffs.length, right.dropoffs.length],
        distance: [left.distanceKm, right.distanceKm],
        revenue: [left.deliveryRate ?? Number.NEGATIVE_INFINITY, right.deliveryRate ?? Number.NEGATIVE_INFINITY],
        expenses: [left.totalExpenses ?? Number.NEGATIVE_INFINITY, right.totalExpenses ?? Number.NEGATIVE_INFINITY],
        netIncome: [left.netIncome ?? Number.NEGATIVE_INFINITY, right.netIncome ?? Number.NEGATIVE_INFINITY],
        pod: [left.podStatus, right.podStatus],
      };
      const [leftValue, rightValue] = values[historySort.key] ?? values.date;
      const compared = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
      return compared * multiplier || left.id.localeCompare(right.id);
    });
  }, [historySort, truckTrips]);

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
        ) : !activeTruck ? (
          <section className="fallback-panel truck-profile-unavailable">
            <h1>Truck profile unavailable</h1>
            <p>No fleet record or finalized deliveries for {normalizedPlate} were found.</p>
            <Link className="fallback-link" href="/truck-profitability">Back to trucks</Link>
          </section>
        ) : (
          <>
            <header className="page-intro truck-profile-page-intro">
              <div>
                <h1>{activeTruck.plateNumber}</h1>
                <p className="subtitle">
                  {activeTruck.truckType} · {formatDateRange(range)}
                </p>
              </div>
            </header>

            <section className="truck-profile-hero" aria-label="Truck profile overview">
              <article className="records-card truck-profile-visual">
                <TruckPhoto plateNumber={activeTruck.plateNumber} editable />
              </article>

              <article className="records-card truck-profile-card truck-profile-availability">
                <div className="records-heading">
                  <div>
                    <h2>Operational Summary</h2>
                    <p>Performance for the selected period.</p>
                  </div>
                </div>
                <div className="truck-performance-kpis" aria-label="Truck performance metrics">
                  <div><span>Total deliveries</span><strong>{activeTruck.completedTrips}</strong></div>
                  <div><span>Revenue</span><strong>{formatPeso(activeTruck.totalEarnings)}</strong></div>
                  <div><span>Total expenses</span><strong>{formatPeso(activeTruck.totalExpenses)}</strong></div>
                  <div><span>Net profit</span><strong className={activeTruck.netProfit < 0 ? "warning" : undefined}>{formatPeso(activeTruck.netProfit)}</strong></div>
                  <div><span>Profit margin</span><strong className={activeTruck.netProfit < 0 ? "warning" : undefined}>{formatPercent(activeTruck.marginPercent)}</strong></div>
                </div>
              </article>

              <article className="records-card truck-profile-card truck-profile-details">
                <div className="records-heading">
                  <div>
                    <h2>Truck Details</h2>
                    <p>Vehicle details from delivery records.</p>
                  </div>
                </div>
                <dl className="truck-profile-list">
                  <div><dt>Plate number</dt><dd>{activeTruck.plateNumber}</dd></div>
                  <div><dt>Vehicle type</dt><dd>{activeTruck.truckType}</dd></div>
                  <div><dt>Store drop-offs</dt><dd>{activeTruck.totalStoresServed}</dd></div>
                  <div><dt>Total distance</dt><dd>{activeTruck.totalDistanceKm} km</dd></div>
                </dl>
              </article>
            </section>

            <section className="records-card truck-profile-deliveries" aria-label="Truck delivery history">
              <div className="records-heading">
                <div>
                  <h2>Delivery History</h2>
                  <p>{truckTrips.length} deliver{truckTrips.length === 1 ? "y" : "ies"} in this period.</p>
                </div>
              </div>
              {sortedTruckTrips.length === 0 ? (
                <div className="empty-state" style={{ padding: "36px 20px" }}>
                  <strong>No completed deliveries in this range</strong>
                  <span>No finalized trips have been recorded for {activeTruck.plateNumber} within the selected date range.</span>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <SortableTableHeader label="Waybill & Date" sortKey="date" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Client" sortKey="client" activeSortKey={historySort.key} direction={historySort.direction} onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Drop-offs" sortKey="dropoffs" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Distance" sortKey="distance" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Revenue" sortKey="revenue" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Expenses" sortKey="expenses" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Net Profit" sortKey="netIncome" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="POD Status" sortKey="pod" activeSortKey={historySort.key} direction={historySort.direction} onSort={(key, direction) => setHistorySort({ key, direction })} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTruckTrips.map((trip) => (
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
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
