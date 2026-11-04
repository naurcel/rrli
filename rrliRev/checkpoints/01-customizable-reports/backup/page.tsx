"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  formatDateRange,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import {
  summarizeTruckProfitability,
} from "@/features/deliveries/delivery-domain";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { formatPercent, formatPeso } from "@/lib/format";

type ReportTab = "revenue" | "expenses" | "profitability" | "activity";

type FinancialReportRow = {
  label: string;
  deliveries: number;
  revenue: number;
  expenses: number;
  netIncome: number;
};

type ActivityReportRow = {
  label: string;
  deliveries: number;
  totalDropoffs: number;
  attachedPods: number;
};

const REPORT_TABS: readonly { id: ReportTab; label: string }[] = [
  { id: "revenue", label: "Revenue" },
  { id: "expenses", label: "Expenses" },
  { id: "profitability", label: "Profitability" },
  { id: "activity", label: "Activity" },
];

function financialShare(value: number, total: number): string {
  return formatPercent(total === 0 ? null : (value / total) * 100);
}

function sortRows<T>(rows: readonly T[], key: string, direction: TableSortDirection, valueFor: (row: T, key: string) => string | number): T[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = valueFor(left, key);
    const rightValue = valueFor(right, key);
    const compared = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue));
    return compared * multiplier;
  });
}

export default function ReportsPage() {
  const actor = useAuthenticatedActor();
  const { range } = useGlobalDateRange();
  const { deliveries: filteredDeliveries, loading, error } = usePersistedDeliveries(range);
  const [activeTab, setActiveTab] = useState<ReportTab>("revenue");
  const [reportSort, setReportSort] = useState<{ key: string; direction: TableSortDirection }>({ key: "revenue", direction: "desc" });

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (REPORT_TABS.some((tab) => tab.id === tabParam)) {
        setActiveTab(tabParam as ReportTab);
      } else if (tabParam === "truck-profitability") {
        setActiveTab("profitability");
      } else if (tabParam === "client-deliveries") {
        setActiveTab("revenue");
      } else if (tabParam === "pod-completeness") {
        setActiveTab("activity");
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const defaultKeys: Record<ReportTab, string> = { revenue: "revenue", expenses: "expenses", profitability: "netIncome", activity: "deliveries" };
    setReportSort({ key: defaultKeys[activeTab], direction: "desc" });
  }, [activeTab]);

  const truckRows = useMemo(
    () => summarizeTruckProfitability(filteredDeliveries),
    [filteredDeliveries],
  );

  const financialDeliveries = useMemo(
    () => filteredDeliveries.filter(
      (item) =>
        item.financialState === "finalized" &&
        item.deliveryRate != null &&
        item.totalExpenses != null &&
        item.netIncome != null,
    ),
    [filteredDeliveries],
  );

  const clientFinancialRows = useMemo(() => {
    const groups = new Map<string, FinancialReportRow>();
    for (const delivery of financialDeliveries) {
      const row = groups.get(delivery.clientName) ?? {
        label: delivery.clientName,
        deliveries: 0,
        revenue: 0,
        expenses: 0,
        netIncome: 0,
      };
      row.deliveries += 1;
      row.revenue += delivery.deliveryRate ?? 0;
      row.expenses += delivery.totalExpenses ?? 0;
      row.netIncome += delivery.netIncome ?? 0;
      groups.set(delivery.clientName, row);
    }
    return [...groups.values()].sort(
      (left, right) => right.revenue - left.revenue || left.label.localeCompare(right.label),
    );
  }, [financialDeliveries]);

  const expenseRows = useMemo(
    () => [...truckRows].sort(
      (left, right) => right.totalExpenses - left.totalExpenses || left.plateNumber.localeCompare(right.plateNumber),
    ),
    [truckRows],
  );

  const activityRows = useMemo(() => {
    const groups = new Map<string, ActivityReportRow>();
    for (const delivery of filteredDeliveries) {
      const row = groups.get(delivery.clientName) ?? {
        label: delivery.clientName,
        deliveries: 0,
        totalDropoffs: 0,
        attachedPods: 0,
      };
      const attached = delivery.dropoffs.filter((dropoff) => dropoff.podSubmitted).length;
      row.deliveries += 1;
      row.totalDropoffs += delivery.dropoffs.length;
      row.attachedPods += attached;
      groups.set(delivery.clientName, row);
    }
    return [...groups.values()].sort(
      (left, right) => right.deliveries - left.deliveries || left.label.localeCompare(right.label),
    );
  }, [filteredDeliveries]);

  const totals = useMemo(() => {
    const earnings = financialDeliveries.reduce(
      (sum, item) => sum + (item.deliveryRate ?? 0),
      0,
    );
    const expenses = financialDeliveries.reduce(
      (sum, item) => sum + (item.totalExpenses ?? 0),
      0,
    );
    const netIncome = earnings - expenses;
    const totalStops = filteredDeliveries.reduce(
      (sum, item) => sum + item.dropoffs.length,
      0,
    );
    return { earnings, expenses, netIncome, totalStops };
  }, [filteredDeliveries, financialDeliveries]);

  const displayedClientRows = sortRows(clientFinancialRows, reportSort.key, reportSort.direction, (row, key) => key === "label" ? row.label : key === "deliveries" ? row.deliveries : row.revenue);
  const displayedExpenseRows = sortRows(expenseRows, reportSort.key, reportSort.direction, (row, key) => key === "label" ? row.plateNumber : key === "deliveries" ? row.completedTrips : row.totalExpenses);
  const displayedTruckRows = sortRows(truckRows, reportSort.key, reportSort.direction, (row, key) => key === "label" ? row.plateNumber : key === "deliveries" ? row.completedTrips : key === "revenue" ? row.totalEarnings : key === "expenses" ? row.totalExpenses : key === "margin" ? row.marginPercent ?? Number.NEGATIVE_INFINITY : row.netProfit);
  const displayedActivityRows = sortRows(
    activityRows,
    reportSort.key,
    reportSort.direction,
    (row, key) =>
      key === "label"
        ? row.label
        : key === "dropoffs"
          ? row.totalDropoffs
          : key === "attached"
            ? row.attachedPods
            : row.deliveries,
  );
  const changeReportSort = (key: string, direction: TableSortDirection) => setReportSort({ key, direction });

  const activeReport = {
    revenue: {
      title: "Revenue Report",
      heading: "Completed-Delivery Revenue by Client",
      rowCount: clientFinancialRows.length,
    },
    expenses: {
      title: "Expense Report",
      heading: "Confirmed Trip Expenses by Truck",
      rowCount: expenseRows.length,
    },
    profitability: {
      title: "Profitability Report",
      heading: "Revenue, Expenses & Net Profit by Truck",
      rowCount: truckRows.length,
    },
    activity: {
      title: "Activity Report",
      heading: "Completed Deliveries & Store Drop-offs by Client",
      rowCount: activityRows.length,
    },
  }[activeTab];

  return (
    <>
      <OperationalTopbar contextLabel="Delivery Operations & Truck Reports" />

      <div className="content-wrap report-page">
        <header className="page-intro report-intro">
          <div>
            <h1>Reports</h1>
            <p className="subtitle">
              Create printable delivery and financial reports.
            </p>
          </div>
          <div className="report-actions">
            <button
              type="button"
              className="report-print-button page-intro-action"
              aria-label="Print the report or save it as a PDF"
              data-tooltip="Print the report or save it as a PDF"
              onClick={() => window.print()}
            >
              Print
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
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? "active" : undefined}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <article className="report-document" aria-label="Formatted operational report">
            <header className="report-document-header">
              <div>
                <p>REDEEMED ROUTE LOGISTICS INC. · ROUTEX</p>
                <h2>{activeReport.title}</h2>
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
                <span>Net Profit</span>
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
                  {activeReport.heading}
                </h3>
                <p>{activeReport.rowCount} group{activeReport.rowCount === 1 ? "" : "s"} in the selected range</p>
              </div>

              <div className="report-table-scroll">
                {activeTab === "revenue" ? (
                  <table>
                    <thead>
                      <tr>
                        <SortableTableHeader label="Client" sortKey="label" activeSortKey={reportSort.key} direction={reportSort.direction} onSort={changeReportSort} />
                        <SortableTableHeader label="Deliveries" sortKey="deliveries" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                        <SortableTableHeader label="Revenue" sortKey="revenue" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                        <SortableTableHeader label="Share" sortKey="share" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {displayedClientRows.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.deliveries}</td>
                          <td>{formatPeso(row.revenue)}</td>
                          <td>{financialShare(row.revenue, totals.earnings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : activeTab === "expenses" ? (
                  <table>
                    <thead>
                      <tr>
                        <SortableTableHeader label="Truck" sortKey="label" activeSortKey={reportSort.key} direction={reportSort.direction} onSort={changeReportSort} />
                        <SortableTableHeader label="Deliveries" sortKey="deliveries" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                        <SortableTableHeader label="Expenses" sortKey="expenses" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                        <SortableTableHeader label="Share" sortKey="share" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {displayedExpenseRows.map((row) => (
                        <tr key={row.plateNumber}>
                          <td>{row.plateNumber}</td>
                          <td>{row.completedTrips}</td>
                          <td>{formatPeso(row.totalExpenses)}</td>
                          <td>{financialShare(row.totalExpenses, totals.expenses)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : activeTab === "profitability" ? (
                  <table>
                    <thead>
                      <tr>
                        <SortableTableHeader label="Truck" sortKey="label" activeSortKey={reportSort.key} direction={reportSort.direction} onSort={changeReportSort} />
                        <SortableTableHeader label="Deliveries" sortKey="deliveries" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                        <SortableTableHeader label="Revenue" sortKey="revenue" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                        <SortableTableHeader label="Expenses" sortKey="expenses" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                        <SortableTableHeader label="Net Profit" sortKey="netIncome" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                        <SortableTableHeader label="Profit Margin" sortKey="margin" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTruckRows.map((row) => (
                        <tr key={row.plateNumber}>
                          <td>{row.plateNumber}</td>
                          <td>{row.completedTrips}</td>
                          <td>{formatPeso(row.totalEarnings)}</td>
                          <td>{formatPeso(row.totalExpenses)}</td>
                          <td>{formatPeso(row.netProfit)}</td>
                          <td>{formatPercent(row.marginPercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <SortableTableHeader label="Client" sortKey="label" activeSortKey={reportSort.key} direction={reportSort.direction} onSort={changeReportSort} />
                        <SortableTableHeader label="Deliveries" sortKey="deliveries" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                        <SortableTableHeader label="Store Drop-offs" sortKey="dropoffs" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                        <SortableTableHeader label="Attached PODs" sortKey="attached" activeSortKey={reportSort.key} direction={reportSort.direction} defaultDirection="desc" onSort={changeReportSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {displayedActivityRows.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{row.deliveries}</td>
                          <td>{row.totalDropoffs}</td>
                          <td>{row.attachedPods}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {activeReport.rowCount === 0 ? (
                <div className="empty-state report-empty-state">
                  <strong>No records in this range</strong>
                  <span>Choose a wider date range to populate this report.</span>
                </div>
              ) : null}
            </section>

            <footer className="report-document-footer">
              <span>RouteX — Delivery Operations & Trucks</span>
              <span>Redeemed Route Logistics Inc.</span>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
}

