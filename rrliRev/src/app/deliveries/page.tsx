"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import {
  RecordDetailDrawer,
  type DetailSection,
} from "@/components/record-detail-drawer";
import { RoundedSelect } from "@/components/rounded-select";
import type { DeliveryTripRecord } from "@/features/deliveries/delivery-domain";
import type {
  DeliveryFilterOption,
  DeliveryLedgerItem,
} from "@/features/deliveries/server/delivery-repository";
import {
  canImportAndReviewExcel,
  canMutateDeliveryRecords,
} from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";
import { selectBrowserPreviewDeliveries } from "@/features/deliveries/browser-preview-deliveries";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DeliveriesPage() {
  const actor = useAuthenticatedActor();
  const { range } = useGlobalDateRange();
  const [deliveries, setDeliveries] = useState<readonly DeliveryLedgerItem[]>([]);
  const [clients, setClients] = useState<DeliveryFilterOption[]>([]);
  const [trucks, setTrucks] = useState<DeliveryFilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedTruck, setSelectedTruck] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPodStatus, setSelectedPodStatus] = useState("");
  const [sort, setSort] = useState("delivery_date:desc");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedTrip, setSelectedTrip] = useState<DeliveryTripRecord | null>(null);
  const [financialActionPending, setFinancialActionPending] = useState(false);
  const [financialActionMessage, setFinancialActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (selectedClient) params.set("clientId", selectedClient);
      if (selectedTruck) params.set("truckId", selectedTruck);
      if (selectedStatus) params.set("status", selectedStatus);
      if (selectedPodStatus) params.set("podStatus", selectedPodStatus);
      if (range.startDate) params.set("dateFrom", toDateKey(range.startDate));
      if (range.endDate) params.set("dateTo", toDateKey(range.endDate));
      const [sortField, direction] = sort.split(":");
      params.set("sort", sortField);
      params.set("direction", direction);

      setLoading(true);
      setLoadError(null);
      fetch(`/api/deliveries?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          const data = (await response.json()) as {
            ok?: boolean;
            message?: string;
            items?: DeliveryLedgerItem[];
            total?: number;
            pageCount?: number;
            filters?: {
              clients?: DeliveryFilterOption[];
              trucks?: DeliveryFilterOption[];
            };
            source?: string;
          };
          if (!response.ok || !data.ok) {
            throw new Error(data.message ?? "Unable to load delivery records.");
          }
          const local = data.source === "bundled-mock" && page === 1
            ? selectBrowserPreviewDeliveries({
                search: searchQuery,
                clientId: selectedClient || undefined,
                truckId: selectedTruck || undefined,
                status: selectedStatus || undefined,
                podStatus: selectedPodStatus || undefined,
                dateFrom: range.startDate ? toDateKey(range.startDate) : undefined,
                dateTo: range.endDate ? toDateKey(range.endDate) : undefined,
              })
            : [];
          const remote = data.items ?? [];
          const remoteIds = new Set(remote.map((item) => item.id));
          setDeliveries([...local.filter((item) => !remoteIds.has(item.id)), ...remote]);
          const combinedTotal = (data.total ?? 0) + local.length;
          setTotal(combinedTotal);
          setPageCount(Math.max(data.pageCount ?? 1, Math.ceil(combinedTotal / 25)));
          setClients(data.filters?.clients ?? []);
          setTrucks(data.filters?.trucks ?? []);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setDeliveries([]);
          setLoadError(error instanceof Error ? error.message : "Unable to load deliveries.");
        })
        .finally(() => setLoading(false));
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [page, range, searchQuery, selectedClient, selectedPodStatus, selectedStatus, selectedTruck, sort]);

  useEffect(() => {
    setPage(1);
  }, [range, searchQuery, selectedClient, selectedPodStatus, selectedStatus, selectedTruck, sort]);

  const filteredDeliveries = deliveries;

  const summary = useMemo(() => {
    const finalized = filteredDeliveries.filter((item) => item.financialState === "finalized");
    const rateTotal = finalized.reduce((sum, item) => sum + (item.deliveryRate ?? 0), 0);
    const expenseTotal = finalized.reduce((sum, item) => sum + (item.totalExpenses ?? 0), 0);
    const netTotal = rateTotal - expenseTotal;
    const stopCount = filteredDeliveries.reduce(
      (sum, item) => sum + item.dropoffs.length,
      0,
    );
    return { rateTotal, expenseTotal, netTotal, stopCount };
  }, [filteredDeliveries]);

  const canWrite = canMutateDeliveryRecords(actor.role);
  const canImport = canImportAndReviewExcel(actor.role);

  async function finalizeFinancials() {
    if (!selectedTrip || financialActionPending) return;
    setFinancialActionPending(true);
    setFinancialActionMessage(null);
    try {
      const response = await fetch("/api/deliveries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "finalize_financials",
          deliveryId: selectedTrip.id,
          expectedVersion: selectedTrip.version,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json() as {
        ok?: boolean;
        message?: string;
        result?: { version?: number };
      };
      if (!response.ok || !payload.ok) throw new Error(payload.message ?? "Unable to finalize financials.");
      const updated = {
        ...selectedTrip,
        financialState: "finalized" as const,
        version: payload.result?.version ?? selectedTrip.version + 1,
      };
      setSelectedTrip(updated);
      setDeliveries((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setFinancialActionMessage("Financials finalized and recorded in the audit history.");
    } catch (reason) {
      setFinancialActionMessage(reason instanceof Error ? reason.message : "Unable to finalize financials.");
    } finally {
      setFinancialActionPending(false);
    }
  }

  const drawerSections: DetailSection[] = useMemo(() => {
    if (!selectedTrip) {
      return [];
    }

    return [
      {
        title: "Daily Trip Report Header",
        rows: [
          { label: "Waybill Number", value: selectedTrip.waybillNumber },
          { label: "Delivery Date", value: selectedTrip.deliveryDate },
          { label: "Client", value: selectedTrip.clientName },
          {
            label: "Truck & Type",
            value: `${selectedTrip.plateNumber} · ${selectedTrip.truckType}`,
          },
          { label: "Truck Temperature", value: selectedTrip.truckTemperature },
          { label: "Origin", value: selectedTrip.origin },
          {
            label: "Distance & Fuel Rate",
            value: `${selectedTrip.distanceKm} km @ ₱${selectedTrip.fuelRate.toFixed(2)}/L`,
          },
        ],
      },
      {
        title: `Store Drop-offs (${selectedTrip.dropoffs.length} stops in this trip)`,
        rows: selectedTrip.dropoffs.map((stop) => ({
          label: `#${stop.sequence} ${stop.storeName} (${stop.destinationArea})`,
          value: `Entry ${formatPeso(stop.entryFee)} · ${
            stop.podSubmitted && stop.supportingDocsComplete
              ? `Verified (${stop.documentRef})`
              : stop.documentRef
          }`,
          tone:
            stop.podSubmitted && stop.supportingDocsComplete
              ? ("success" as const)
              : ("warning" as const),
        })),
      },
      {
        title: "Trip Earnings & Itemized Expenses",
        rows: [
          {
            label: "Delivery Rate (Revenue)",
            value: formatPeso(selectedTrip.deliveryRate),
            tone: "success",
          },
          { label: "Diesel Expenses", value: formatPeso(selectedTrip.expenses.dieselExpenses) },
          {
            label: "Toll Gate Expenses",
            value: `${formatPeso(selectedTrip.expenses.tollGateExpenses)} (${selectedTrip.expenses.tollGateBreakdown || "N/A"})`,
          },
          { label: "Store Entry Fees", value: formatPeso(selectedTrip.expenses.entryFees) },
          {
            label: "Driver Daily Rate + Allowance",
            value: `${formatPeso(selectedTrip.expenses.driverDailyRate)} + ${formatPeso(selectedTrip.expenses.driverAllowance)}`,
          },
          {
            label: "Helper Daily Rate + Allowance",
            value: `${formatPeso(selectedTrip.expenses.helperDailyRate)} + ${formatPeso(selectedTrip.expenses.helperAllowance)}`,
          },
          { label: "Other Expenses", value: formatPeso(selectedTrip.expenses.otherExpenses) },
          { label: "Total Expenses", value: formatPeso(selectedTrip.totalExpenses) },
          {
            label: "Net Income",
            value: `${formatPeso(selectedTrip.netIncome)} (${formatPercent(selectedTrip.marginPercent)})`,
            tone: selectedTrip.netIncome !== null && selectedTrip.netIncome >= 0 ? "success" : "warning",
          },
        ],
      },
      {
        title: "Financial state",
        description: selectedTrip.financialState === "finalized"
          ? "Finalized financials are included in confirmed profitability reporting. Corrections require an audited correction workflow."
          : "Incomplete financials are excluded from confirmed profitability reporting until every unknown expense is resolved.",
        customContent: (
          <div className="financial-state-actions">
            <strong>{selectedTrip.financialState === "finalized" ? "Finalized" : "Incomplete"}</strong>
            {selectedTrip.financialIntegrityIssues.length > 0 ? (
              <ul>{selectedTrip.financialIntegrityIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            ) : null}
            {canWrite && selectedTrip.financialState === "incomplete" ? (
              <button
                type="button"
                className="primary-action"
                disabled={financialActionPending || selectedTrip.financialIntegrityIssues.length > 0}
                onClick={finalizeFinancials}
              >
                {financialActionPending ? "Finalizing…" : "Finalize financials"}
              </button>
            ) : null}
            {financialActionMessage ? <p role="status">{financialActionMessage}</p> : null}
          </div>
        ),
      },
    ];
  }, [canWrite, financialActionMessage, financialActionPending, selectedTrip]);

  return (
    <>
      <OperationalTopbar contextLabel="Completed Deliveries & Multi-Store Trips" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <p className="eyebrow">DELIVERY OPERATIONS</p>
            <h1>Deliveries</h1>
            <p className="subtitle">
              Organize completed deliveries by client, waybill number, truck, and multi-store
              drop-offs with itemized trip expenses from the Daily Trip Report.
            </p>
          </div>
          <div className="fleet-intro-actions">
            {canImport ? (
              <Link className="secondary-button" href="/deliveries/import">
                Import Excel Trip Report
              </Link>
            ) : null}
            {canWrite ? (
              <>
                <Link className="secondary-button" href="/pod-documents">
                  Verify PODs
                </Link>
                <Link className="primary-action-button" href="/deliveries/new">
                  Record completed delivery
                </Link>
              </>
            ) : (
              <span className="settings-readonly-pill">
                View-Only ({actor.roleLabel})
              </span>
            )}
          </div>
        </header>

        <section className="stat-grid" aria-label="Current delivery page totals">
          <article className="stat-card">
            <span className="stat-label">PAGE DELIVERY EARNINGS</span>
            <strong>{formatPeso(summary.rateTotal)}</strong>
            <span className="stat-meta positive">
              {filteredDeliveries.length} trips · {summary.stopCount} store drop-offs
            </span>
          </article>
          <article className="stat-card">
            <span className="stat-label">PAGE TRIP EXPENSES</span>
            <strong>{formatPeso(summary.expenseTotal)}</strong>
            <span className="stat-meta">
              Diesel, toll gates, entry fees & crew costs
            </span>
          </article>
          <article className="stat-card">
            <span className="stat-label">PAGE NET INCOME</span>
            <strong>{formatPeso(summary.netTotal)}</strong>
            <span className="stat-meta positive">
              Net profitability for the records on this page
            </span>
          </article>
        </section>

        <section className={`records-card${loading ? " is-loading" : ""}`} aria-label="Completed deliveries table">
          <div className="records-heading">
            <div>
              <h2>Completed Delivery Ledger</h2>
              <p>
                Filter by client, truck, or POD verification status. Each delivery groups all store
                drop-offs served on that trip.
              </p>
            </div>
          </div>

          <div className="filters">
            <label className="search-box">
              <span className="sr-only">
                Search by waybill number
              </span>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="Search by waybill number…"
                aria-label="Search deliveries"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <RoundedSelect
              value={selectedClient}
              options={[
                { value: "", label: "All Clients" },
                ...clients.map((option) => ({ value: option.id, label: option.label })),
              ]}
              onChange={setSelectedClient}
              ariaLabel="Filter by client"
            />

            <RoundedSelect
              value={selectedTruck}
              options={[
                { value: "", label: "All Trucks" },
                ...trucks.map((option) => ({ value: option.id, label: option.label })),
              ]}
              onChange={setSelectedTruck}
              ariaLabel="Filter by truck"
            />

            <RoundedSelect
              value={selectedStatus}
              options={[
                { value: "", label: "All Delivery Statuses" },
                { value: "Completed", label: "Completed" },
              ]}
              onChange={setSelectedStatus}
              ariaLabel="Filter by delivery status"
            />

            <RoundedSelect
              value={selectedPodStatus}
              options={[
                { value: "", label: "All POD Statuses" },
                "Verified",
                "Incomplete",
                "Pending",
              ]}
              onChange={setSelectedPodStatus}
              ariaLabel="Filter by POD status"
            />

            <RoundedSelect
              value={sort}
              options={[
                { value: "delivery_date:desc", label: "Newest delivery" },
                { value: "delivery_date:asc", label: "Oldest delivery" },
                { value: "client:asc", label: "Client A–Z" },
                { value: "delivery_rate:desc", label: "Highest revenue" },
                { value: "net_income:desc", label: "Highest net income" },
                { value: "profit_margin:desc", label: "Highest profit margin" },
              ]}
              onChange={setSort}
              ariaLabel="Sort deliveries"
            />
          </div>

          {loadError ? (
            <div className="empty-state" role="alert">
              <strong>Delivery database is unavailable</strong>
              <span>{loadError}</span>
            </div>
          ) : loading ? (
            <div className="empty-state" role="status">
              <strong>Loading delivery ledger…</strong>
              <span>Applying the active client, date, truck, and document filters.</span>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="empty-state">
              <strong>No deliveries match the active filters</strong>
              <span>
                Try clearing the waybill search or selecting All Clients / All Trucks.
              </span>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waybill</th>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Truck & Temp</th>
                    <th>Origin & Store Drop-offs</th>
                    <th>Distance</th>
                    <th>Delivery Rate</th>
                    <th>Total Expenses</th>
                    <th>Net Income</th>
                    <th>POD Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.map((trip) => (
                    <tr
                      key={trip.id}
                      className="record-row"
                      tabIndex={0}
                      onClick={() => setSelectedTrip(trip)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedTrip(trip);
                        }
                      }}
                    >
                      <td>
                        <strong>{trip.waybillNumber}</strong>
                      </td>
                      <td>{trip.deliveryDate}</td>
                      <td>
                        <strong>{trip.clientName}</strong>
                      </td>
                      <td className="truck-code">
                        <strong>{trip.plateNumber}</strong> ({trip.truckType})
                        <br />
                        <small>{trip.truckTemperature}</small>
                      </td>
                      <td>
                        <span>{trip.origin} → </span>
                        <span className="dropoff-count-badge">
                          {trip.dropoffs.length} stores
                        </span>
                      </td>
                      <td>{trip.distanceKm} km</td>
                      <td className="money">{formatPeso(trip.deliveryRate)}</td>
                      <td>{formatPeso(trip.totalExpenses)}</td>
                      <td className="money">{formatPeso(trip.netIncome)}</td>
                      <td>
                        <span
                          className={`pod-status ${
                            trip.podStatus === "Verified" ? "attached" : "missing"
                          }`}
                        >
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

          <div className="table-footer">
            <span>
              Showing {filteredDeliveries.length} of {total} completed deliveries
            </span>
            <div className="pagination" aria-label="Delivery pages">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span>
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount || loading}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      <RecordDetailDrawer
        open={Boolean(selectedTrip)}
        eyebrow={selectedTrip ? `WAYBILL ${selectedTrip.waybillNumber}` : ""}
        title={selectedTrip ? selectedTrip.clientName : ""}
        statusLabel={selectedTrip?.podStatus}
        statusTone={selectedTrip?.podStatus === "Verified" ? "success" : "warning"}
        sections={drawerSections}
        onClose={() => setSelectedTrip(null)}
      />
    </>
  );
}

