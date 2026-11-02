"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  formatDateRange,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import {
  summarizeTruckProfitability,
} from "@/features/deliveries/delivery-domain";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { formatPercent, formatPeso } from "@/lib/format";

type ReportTab = "truck-profitability" | "client-deliveries" | "pod-completeness";

export default function ReportsPage() {
  const actor = useAuthenticatedActor();
  const { range } = useGlobalDateRange();
  const { deliveries: filteredDeliveries, loading, error } = usePersistedDeliveries(range);
  const [activeTab, setActiveTab] = useState<ReportTab>("truck-profitability");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (
        tabParam === "truck-profitability" ||
        tabParam === "client-deliveries" ||
        tabParam === "pod-completeness"
      ) {
        setActiveTab(tabParam);
      }
    } catch {
      // Ignore
    }
  }, []);

  const truckRows = useMemo(
    () => summarizeTruckProfitability(filteredDeliveries),
    [filteredDeliveries],
  );

  const totals = useMemo(() => {
    const finalized = filteredDeliveries.filter((item) => item.financialState === "finalized");
    const earnings = finalized.reduce(
      (sum, item) => sum + (item.deliveryRate ?? 0),
      0,
    );
    const expenses = finalized.reduce(
      (sum, item) => sum + (item.totalExpenses ?? 0),
      0,
    );
    const netIncome = earnings - expenses;
    const totalStops = filteredDeliveries.reduce(
      (sum, item) => sum + item.dropoffs.length,
      0,
    );
    return { earnings, expenses, netIncome, totalStops };
  }, [filteredDeliveries]);

  return (
    <>
      <OperationalTopbar contextLabel="Delivery Operations & Truck Profitability Reports" />

      <div className="content-wrap report-page">
        <header className="page-intro report-intro">
          <div>
            <p className="eyebrow">OPERATIONAL & PROFITABILITY REPORTS</p>
            <h1>Reports</h1>
            <p className="subtitle">
              Generate printable truck profitability, client delivery, and POD verification
              summaries.
            </p>
          </div>
          <div className="report-actions">
            <button
              type="button"
              className="report-print-button"
              onClick={() => window.print()}
            >
              Print Report
            </button>
          </div>
        </header>

        {error ? (
          <section className="notice" role="alert">
            <span className="notice-icon" aria-hidden="true">!</span>
            <div><strong>Report data unavailable:</strong><span>{error}</span></div>
          </section>
        ) : loading ? (
          <section className="notice" role="status">
            <span className="notice-icon" aria-hidden="true">i</span>
            <div><strong>Preparing report:</strong><span>Loading completed deliveries for the selected period.</span></div>
          </section>
        ) : null}

        <div className={`report-workspace${loading ? " is-loading" : ""}`}>
          <div className="report-tabs" role="tablist" aria-label="Report categories">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "truck-profitability"}
              className={activeTab === "truck-profitability" ? "active" : undefined}
              onClick={() => setActiveTab("truck-profitability")}
            >
              Truck Profitability
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "client-deliveries"}
              className={activeTab === "client-deliveries" ? "active" : undefined}
              onClick={() => setActiveTab("client-deliveries")}
            >
              Client Deliveries & Drop-offs
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "pod-completeness"}
              className={activeTab === "pod-completeness" ? "active" : undefined}
              onClick={() => setActiveTab("pod-completeness")}
            >
              POD Verification Summary
            </button>
          </div>

          <article className="report-document" aria-label="Formatted operational report">
            <header className="report-document-header">
              <div>
                <p>REDEEMED ROUTE LOGISTICS INC. · ROUTEX</p>
                <h2>
                  {activeTab === "truck-profitability"
                    ? "Truck Earnings, Expenses & Net Profitability Report"
                    : activeTab === "client-deliveries"
                      ? "Completed Client Deliveries & Multi-Store Drop-off Summary"
                      : "Proof of Delivery (POD) & Supporting Document Verification Report"}
                </h2>
                <span>
                  Prepared for {actor.fullName} ({actor.roleLabel} — {actor.accessLevelLabel})
                </span>
              </div>
              <dl>
                <div>
                  <dt>Period</dt>
                  <dd>{formatDateRange(range)}</dd>
                </div>
                <div>
                  <dt>Trips Included</dt>
                  <dd>{filteredDeliveries.length} trips</dd>
                </div>
                <div>
                  <dt>Store Drop-offs</dt>
                  <dd>{totals.totalStops} stores</dd>
                </div>
              </dl>
            </header>

            <section className="report-summary">
              <div>
                <span>Gross Delivery Earnings</span>
                <strong>{formatPeso(totals.earnings)}</strong>
                <em>Billed delivery rates</em>
              </div>
              <div>
                <span>Total Trip Expenses</span>
                <strong>{formatPeso(totals.expenses)}</strong>
                <em>Diesel, tolls, crew & entry</em>
              </div>
              <div>
                <span>Net Truck Income</span>
                <strong>{formatPeso(totals.netIncome)}</strong>
                <em>
                  {formatPercent(
                    totals.earnings > 0 ? (totals.netIncome / totals.earnings) * 100 : null,
                  )}{" "}
                  net margin
                </em>
              </div>
              <div>
                <span>Active Trucks</span>
                <strong>{truckRows.length} units</strong>
                <em>4W, 6W & 10W fleet</em>
              </div>
            </section>

            <section className="report-table-section">
              <div className="report-table-heading">
                <h3>
                  {activeTab === "truck-profitability"
                    ? "Per-Truck Profitability Breakdown"
                    : activeTab === "client-deliveries"
                      ? "Completed Deliveries by Client & Waybill"
                      : "POD & Supporting Document Status by Waybill"}
                </h3>
                <p>Derived from verified Daily Trip Report records</p>
              </div>

              <div className="report-table-scroll">
                {activeTab === "truck-profitability" ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Truck Plate</th>
                        <th>Type</th>
                        <th>Trips</th>
                        <th>Stores</th>
                        <th>Earnings</th>
                        <th>Expenses</th>
                        <th>Net Profit</th>
                        <th>Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {truckRows.map((row) => (
                        <tr key={row.plateNumber}>
                          <td>{row.plateNumber}</td>
                          <td>{row.truckType}</td>
                          <td>{row.completedTrips}</td>
                          <td>{row.totalStoresServed}</td>
                          <td>{formatPeso(row.totalEarnings)}</td>
                          <td>{formatPeso(row.totalExpenses)}</td>
                          <td>{formatPeso(row.netProfit)}</td>
                          <td>{formatPercent(row.marginPercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : activeTab === "client-deliveries" ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Waybill</th>
                        <th>Client</th>
                        <th>Date</th>
                        <th>Truck</th>
                        <th>Stores</th>
                        <th>Rate</th>
                        <th>Expenses</th>
                        <th>Net Income</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeliveries.map((trip) => (
                        <tr key={trip.id}>
                          <td>{trip.waybillNumber}</td>
                          <td style={{ textAlign: "left" }}>{trip.clientName}</td>
                          <td>{trip.deliveryDate}</td>
                          <td>{trip.plateNumber}</td>
                          <td>{trip.dropoffs.length}</td>
                          <td>{formatPeso(trip.deliveryRate)}</td>
                          <td>{formatPeso(trip.totalExpenses)}</td>
                          <td>{formatPeso(trip.netIncome)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Waybill</th>
                        <th>Client</th>
                        <th>Truck</th>
                        <th>Total Stores</th>
                        <th>Verified Stores</th>
                        <th>POD Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeliveries.map((trip) => {
                        const verifiedStops = trip.dropoffs.filter(
                          (s) => s.podSubmitted && s.supportingDocsComplete,
                        ).length;
                        return (
                          <tr key={trip.id}>
                            <td>{trip.waybillNumber}</td>
                            <td style={{ textAlign: "left" }}>{trip.clientName}</td>
                            <td>{trip.plateNumber}</td>
                            <td>{trip.dropoffs.length}</td>
                            <td>
                              {verifiedStops} / {trip.dropoffs.length}
                            </td>
                            <td>{trip.podStatus}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <footer className="report-document-footer">
              <span>RouteX — Delivery Operations & Truck Profitability</span>
              <span>Redeemed Route Logistics Inc.</span>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
}

