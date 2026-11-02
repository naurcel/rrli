"use client";

import { useMemo, useState } from "react";

import {
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import {
  RecordDetailDrawer,
  type DetailSection,
} from "@/components/record-detail-drawer";
import {
  summarizeTruckProfitability,
  type TruckProfitabilitySummary,
} from "@/features/deliveries/delivery-domain";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { formatPercent, formatPeso } from "@/lib/format";

export default function TruckProfitabilityPage() {
  const { range } = useGlobalDateRange();
  const { deliveries: dateFilteredTrips, loading, error } = usePersistedDeliveries(range);
  const [selectedTruck, setSelectedTruck] = useState<TruckProfitabilitySummary | null>(
    null,
  );

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

  const drawerSections: DetailSection[] = useMemo(() => {
    if (!selectedTruck) {
      return [];
    }

    const truckTrips = dateFilteredTrips.filter(
      (trip) => trip.plateNumber === selectedTruck.plateNumber,
    );

    return [
      {
        title: "Truck Operational Summary",
        rows: [
          { label: "Plate Number", value: selectedTruck.plateNumber },
          { label: "Truck Type", value: selectedTruck.truckType },
          { label: "Temperature Spec", value: selectedTruck.truckTemperature },
          { label: "Completed Deliveries", value: `${selectedTruck.completedTrips} trips` },
          { label: "Total Stores Served", value: `${selectedTruck.totalStoresServed} drop-offs` },
          { label: "Total Distance", value: `${selectedTruck.totalDistanceKm} km` },
        ],
      },
      {
        title: "Earnings vs. Expense Breakdown",
        rows: [
          {
            label: "Gross Delivery Earnings",
            value: formatPeso(selectedTruck.totalEarnings),
            tone: "success",
          },
          {
            label: "Diesel Expenses",
            value: formatPeso(selectedTruck.totalDieselExpenses),
          },
          {
            label: "Toll Gate Expenses",
            value: formatPeso(selectedTruck.totalTollExpenses),
          },
          {
            label: "Driver & Helper Costs (Rates + Allowances)",
            value: formatPeso(selectedTruck.totalCrewCosts),
          },
          {
            label: "Store Entry & Other Expenses",
            value: formatPeso(selectedTruck.totalEntryAndOtherExpenses),
          },
          {
            label: "Total Truck Trip Expenses",
            value: formatPeso(selectedTruck.totalExpenses),
          },
          {
            label: "Net Truck Profit",
            value: `${formatPeso(selectedTruck.netProfit)} (${formatPercent(selectedTruck.marginPercent)})`,
            tone: selectedTruck.netProfit >= 0 ? "success" : "warning",
          },
        ],
      },
      {
        title: "Completed Trips for This Truck",
        rows: truckTrips.map((trip) => ({
          label: `${trip.waybillNumber} · ${trip.clientName} (${trip.dropoffs.length} stores)`,
          value: `Net ${formatPeso(trip.netIncome)}`,
          tone: trip.netIncome !== null && trip.netIncome >= 0 ? ("success" as const) : ("warning" as const),
        })),
      },
    ];
  }, [dateFilteredTrips, selectedTruck]);

  return (
    <>
      <OperationalTopbar contextLabel="Truck Earnings, Expenses & Net Profitability" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <p className="eyebrow">TRUCK PROFITABILITY ANALYSIS</p>
            <h1>Truck Profitability</h1>
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
            <div><strong>Loading truck profitability:</strong><span>Calculating from completed delivery records.</span></div>
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

        <section className={`records-card${loading ? " is-loading" : ""}`} aria-label="Truck profitability table">
          <div className="records-heading">
            <div>
              <h2>Per-Truck Profitability Breakdown</h2>
              <p>Click any truck row to inspect its cost categories and completed client trips</p>
            </div>
          </div>

          {loading || error ? null : truckSummaries.length === 0 ? (
            <div className="empty-state">
              <strong>No completed deliveries in this range</strong>
              <span>Choose another date range to compare truck profitability.</span>
            </div>
          ) : <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plate Number</th>
                  <th>Truck Type & Temp</th>
                  <th>Completed Trips</th>
                  <th>Store Drop-offs</th>
                  <th>Distance</th>
                  <th>Gross Earnings</th>
                  <th>Diesel & Tolls</th>
                  <th>Crew & Entry Costs</th>
                  <th>Total Expenses</th>
                  <th>Net Profit (Margin)</th>
                </tr>
              </thead>
              <tbody>
                {truckSummaries.map((truck) => (
                  <tr
                    key={truck.plateNumber}
                    className="record-row"
                    tabIndex={0}
                    onClick={() => setSelectedTruck(truck)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTruck(truck);
                      }
                    }}
                  >
                    <td className="truck-code">
                      <strong>{truck.plateNumber}</strong>
                    </td>
                    <td>
                      {truck.truckType}
                      <br />
                      <small>{truck.truckTemperature}</small>
                    </td>
                    <td>{truck.completedTrips}</td>
                    <td>
                      <span className="dropoff-count-badge">
                        {truck.totalStoresServed} stores
                      </span>
                    </td>
                    <td>{truck.totalDistanceKm} km</td>
                    <td className="money">{formatPeso(truck.totalEarnings)}</td>
                    <td>
                      {formatPeso(truck.totalDieselExpenses + truck.totalTollExpenses)}
                    </td>
                    <td>
                      {formatPeso(
                        truck.totalCrewCosts + truck.totalEntryAndOtherExpenses,
                      )}
                    </td>
                    <td>{formatPeso(truck.totalExpenses)}</td>
                    <td className="money">
                      {formatPeso(truck.netProfit)} ({formatPercent(truck.marginPercent)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </section>
      </div>

      <RecordDetailDrawer
        open={Boolean(selectedTruck)}
        eyebrow={selectedTruck ? `${selectedTruck.truckType} · ${selectedTruck.truckTemperature}` : ""}
        title={selectedTruck ? `Truck ${selectedTruck.plateNumber}` : ""}
        statusLabel={
          selectedTruck ? `${formatPercent(selectedTruck.marginPercent)} Margin` : undefined
        }
        statusTone="success"
        sections={drawerSections}
        onClose={() => setSelectedTruck(null)}
      />
    </>
  );
}

