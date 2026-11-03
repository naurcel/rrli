"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { summarizeTruckProfitability } from "@/features/deliveries/delivery-domain";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { formatPercent, formatPeso } from "@/lib/format";

export default function TruckProfitabilityPage() {
  const { range } = useGlobalDateRange();
  const { deliveries: dateFilteredTrips, loading, error } = usePersistedDeliveries(range);

  const truckSummaries = useMemo(
    () => summarizeTruckProfitability(dateFilteredTrips),
    [dateFilteredTrips],
  );

  const fleetTotals = useMemo(() => {
    const earnings = truckSummaries.reduce((sum, t) => sum + t.totalEarnings, 0);
    const expenses = truckSummaries.reduce((sum, t) => sum + t.totalExpenses, 0);
    const netProfit = earnings - expenses;
    return { earnings, expenses, netProfit };
  }, [truckSummaries]);

  return (
    <>
      <OperationalTopbar contextLabel="Truck Earnings, Expenses & Net Profitability" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <h1>Trucks</h1>
            <p className="subtitle">
              Evaluate how much each truck earns from completed deliveries against its diesel,
              toll gate, store entry, and driver/helper costs.
            </p>
          </div>
        </header>

        {error ? (
          <section className="notice" role="alert">
            <span className="notice-icon" aria-hidden="true">!</span>
            <div><strong>Profitability data unavailable:</strong><span>{error}</span></div>
          </section>
        ) : loading ? (
          <section className="notice" role="status">
            <span className="notice-icon" aria-hidden="true">i</span>
            <div><strong>Loading trucks:</strong><span>Calculating performance from completed delivery records.</span></div>
          </section>
        ) : null}

        <section className={`stat-grid${loading ? " is-loading" : ""}`} aria-label="Fleet profitability totals">
          <article className="stat-card">
            <span className="stat-label">TOTAL TRUCK EARNINGS</span>
            <strong>{formatPeso(fleetTotals.earnings)}</strong>
            <span className="stat-meta positive">
              Across {truckSummaries.length} active delivery trucks
            </span>
          </article>
          <article className="stat-card">
            <span className="stat-label">TOTAL TRUCK EXPENSES</span>
            <strong>{formatPeso(fleetTotals.expenses)}</strong>
            <span className="stat-meta">
              Direct trip expenses from Daily Trip Reports
            </span>
          </article>
          <article className="stat-card">
            <span className="stat-label">NET FLEET CONTRIBUTION</span>
            <strong>{formatPeso(fleetTotals.netProfit)}</strong>
            <span className="stat-meta positive">
              {formatPercent(
                fleetTotals.earnings > 0
                  ? (fleetTotals.netProfit / fleetTotals.earnings) * 100
                  : 0,
              )}{" "}
              overall truck profit margin
            </span>
          </article>
        </section>

        <section
          className={`truck-profitability-card-section${loading ? " is-loading" : ""}`}
          aria-label="Truck profitability cards"
        >
          <div className="records-heading">
            <div>
              <h2>Truck Performance</h2>
              <p>Choose a truck to inspect its cost categories and completed client trips</p>
            </div>
          </div>

          {loading || error ? null : truckSummaries.length === 0 ? (
            <div className="empty-state">
              <strong>No completed deliveries in this range</strong>
              <span>Choose another date range to compare truck performance.</span>
            </div>
          ) : (
            <div className="fleet-card-grid truck-profitability-card-grid">
              {truckSummaries.map((truck) => (
                <Link
                  className="fleet-card fleet-card-link truck-profitability-card"
                  href={`/truck-profitability/${truck.plateNumber}`}
                  key={truck.plateNumber}
                >
                  <div className="fleet-photo">No photo yet</div>
                  <div className="fleet-card-body">
                    <div className="fleet-card-title">
                      <div>
                        <h2>{truck.plateNumber}</h2>
                        <p>{truck.truckType} · {truck.truckTemperature}</p>
                      </div>
                      <span className="fleet-status">
                        {truck.completedTrips} trip{truck.completedTrips === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="truck-card-operational-meta">
                      <span>{truck.totalStoresServed} store drop-offs</span>
                      <span>{truck.totalDistanceKm} km</span>
                    </div>
                    <dl>
                      <div><dt>Revenue</dt><dd>{formatPeso(truck.totalEarnings)}</dd></div>
                      <div><dt>Total expenses</dt><dd>{formatPeso(truck.totalExpenses)}</dd></div>
                      <div><dt>Net income</dt><dd>{formatPeso(truck.netProfit)}</dd></div>
                      <div><dt>Profit margin</dt><dd>{formatPercent(truck.marginPercent)}</dd></div>
                    </dl>
                    <span className="fleet-card-detail-link">View details <b>›</b></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

    </>
  );
}

