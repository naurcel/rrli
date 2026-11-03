"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { DeliveryPodDocuments } from "@/components/delivery-pod-documents";
import {
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import {
  RecordDetailDrawer,
  type DetailSection,
} from "@/components/record-detail-drawer";
import { RoundedSelect } from "@/components/rounded-select";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import type {
  ExpenseResolutionStatus,
} from "@/features/deliveries/delivery-domain";
import type {
  DeliveryFilterOption,
  DeliveryLedgerItem,
} from "@/features/deliveries/server/delivery-repository";
import {
  canImportAndReviewExcel,
  canMutateDeliveryRecords,
  canVerifyPodDocuments,
} from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";
import { selectBrowserPreviewDeliveries } from "@/features/deliveries/browser-preview-deliveries";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatExpenseResolution(
  value: number | null,
  state: ExpenseResolutionStatus,
): string {
  if (state === "unknown") return "Unknown · requires confirmation";
  if (state === "not_applicable") return "Not applicable";
  return `${formatPeso(value)} · Confirmed`;
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
  const [selectedTrip, setSelectedTrip] = useState<DeliveryLedgerItem | null>(null);
  const [financialActionPending, setFinancialActionPending] = useState(false);
  const [financialActionMessage, setFinancialActionMessage] = useState<string | null>(null);

  const [correctingTrip, setCorrectingTrip] = useState<DeliveryLedgerItem | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionDeliveryRate, setCorrectionDeliveryRate] = useState<string>("");
  const [correctionExpenses, setCorrectionExpenses] = useState<{ [key: string]: string }>({});
  const [correctionStatuses, setCorrectionStatuses] = useState<{ [key: string]: "confirmed" | "not_applicable" | "unknown" }>({});
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  function openCorrectionModal(trip: DeliveryLedgerItem) {
    setCorrectingTrip(trip);
    setCorrectionReason("");
    setCorrectionDeliveryRate(trip.deliveryRate != null ? String(trip.deliveryRate) : "");
    setCorrectionExpenses({
      dieselExpenses: trip.expenses.dieselExpenses != null ? String(trip.expenses.dieselExpenses) : "",
      tollGateExpenses: trip.expenses.tollGateExpenses != null ? String(trip.expenses.tollGateExpenses) : "",
      driverAllowance: trip.expenses.driverAllowance != null ? String(trip.expenses.driverAllowance) : "",
      driverDailyRate: trip.expenses.driverDailyRate != null ? String(trip.expenses.driverDailyRate) : "",
      helperAllowance: trip.expenses.helperAllowance != null ? String(trip.expenses.helperAllowance) : "",
      helperDailyRate: trip.expenses.helperDailyRate != null ? String(trip.expenses.helperDailyRate) : "",
      otherExpenses: trip.expenses.otherExpenses != null ? String(trip.expenses.otherExpenses) : "",
    });
    setCorrectionStatuses({
      dieselExpenses: trip.expenseStates.dieselExpenses,
      tollGateExpenses: trip.expenseStates.tollGateExpenses,
      driverAllowance: trip.expenseStates.driverAllowance,
      driverDailyRate: trip.expenseStates.driverDailyRate,
      helperAllowance: trip.expenseStates.helperAllowance,
      helperDailyRate: trip.expenseStates.helperDailyRate,
      otherExpenses: trip.expenseStates.otherExpenses,
    });
    setCorrectionSubmitting(false);
    setCorrectionError(null);
  }

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!correctingTrip || correctionSubmitting) return;

    if (correctionReason.trim().length < 5) {
      setCorrectionError("A correction reason of at least 5 characters is required for audit integrity.");
      return;
    }

    const numRate = Number(correctionDeliveryRate);
    if (!Number.isFinite(numRate) || numRate <= 0) {
      setCorrectionError("Please enter a valid positive delivery rate.");
      return;
    }

    setCorrectionSubmitting(true);
    setCorrectionError(null);

    const expensesPayload: Record<string, number | null> = {};
    for (const [key, val] of Object.entries(correctionExpenses)) {
      const status = correctionStatuses[key];
      if (status === "confirmed") {
        const num = val === "" ? null : Number(val);
        if (num !== null && (!Number.isFinite(num) || num < 0)) {
          setCorrectionError(`Please enter a valid amount for ${key}.`);
          setCorrectionSubmitting(false);
          return;
        }
        expensesPayload[key] = num;
      } else {
        expensesPayload[key] = null;
      }
    }

    try {
      const response = await fetch("/api/deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "correct_financials",
          deliveryId: correctingTrip.id,
          expectedVersion: correctingTrip.version,
          idempotencyKey: crypto.randomUUID(),
          reason: correctionReason.trim(),
          changes: {
            deliveryRate: numRate,
            expenses: expensesPayload,
            expenseStates: correctionStatuses,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        if (response.status === 409 || data.code === "VERSION_CONFLICT") {
          setCorrectionError(
            "Version Conflict: This delivery record was modified concurrently by another user. Your inputs have been preserved. Please review and retry.",
          );
        } else {
          setCorrectionError(data.message ?? "Failed to save correction.");
        }
        return;
      }

      const newVersion = data.result?.version ?? correctingTrip.version + 1;
      const totalExp = Object.values(expensesPayload).reduce<number>((a, b) => a + (b ?? 0), 0);
      const net = numRate - totalExp;
      const margin = numRate > 0 ? (net / numRate) * 100 : null;

      const updated = {
        ...correctingTrip,
        deliveryRate: numRate,
        expenses: { ...correctingTrip.expenses, ...expensesPayload },
        expenseStates: { ...correctingTrip.expenseStates, ...correctionStatuses },
        totalExpenses: totalExp,
        netIncome: net,
        marginPercent: margin,
        version: newVersion,
      };

      setFinancialActionMessage(
        `Financial correction successfully recorded (Version ${newVersion}). Reason: "${correctionReason.trim()}".`,
      );
      setSelectedTrip(updated);
      setDeliveries((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );
      setCorrectingTrip(null);
    } catch (err) {
      setCorrectionError(err instanceof Error ? err.message : "Network error while saving correction.");
    } finally {
      setCorrectionSubmitting(false);
    }
  }

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
  const [activeSortKey, activeSortDirection] = sort.split(":") as [string, TableSortDirection];
  const updateTableSort = (key: string, direction: TableSortDirection) => setSort(`${key}:${direction}`);

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
        title: "Delivery Overview",
        eyebrow: "Trip details",
        rows: [
          { label: "Waybill Number", value: selectedTrip.waybillNumber },
          { label: "Delivery Date", value: selectedTrip.deliveryDate },
          { label: "Client", value: selectedTrip.clientName },
          { label: "Origin", value: selectedTrip.origin },
          {
            label: "Distance & Fuel Rate",
            value: `${selectedTrip.distanceKm} km @ ₱${selectedTrip.fuelRate.toFixed(2)}/L`,
          },
        ],
      },
      {
        title: "Truck & Personnel",
        eyebrow: "Assignment",
        rows: [
          { label: "Truck", value: selectedTrip.plateNumber },
          { label: "Truck Type", value: selectedTrip.truckType },
          { label: "Ownership", value: selectedTrip.truckOwnership },
          { label: "Rate Basis", value: selectedTrip.rateBasis },
          { label: "Temperature", value: selectedTrip.truckTemperature },
          { label: "Driver", value: selectedTrip.driverName || "Not recorded" },
          { label: "Helper", value: selectedTrip.helperName || "Not recorded" },
          { label: "Delivery Status", value: selectedTrip.deliveryStatus || "Completed" },
        ],
      },
      {
        title: `Route & Drop-offs (${selectedTrip.dropoffs.length} stops)`,
        eyebrow: "Stop sequence and documents",
        fullWidth: true,
        rows: selectedTrip.dropoffs.map((stop) => ({
          label: `#${stop.sequence} ${stop.storeName} (${stop.destinationArea})`,
          value: `Entry fee: ${formatExpenseResolution(stop.entryFee, stop.entryFeeStatus)} · ${
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
        title: "POD & Supporting Documents",
        eyebrow: "Stop-level files and review status",
        fullWidth: true,
        description: "Select a drop-off to inspect its document, upload a replacement, or perform an authorized review action.",
        customContent: (
          <DeliveryPodDocuments
            trip={selectedTrip}
            canVerify={canVerifyPodDocuments(actor.role)}
            roleLabel={actor.roleLabel}
            onTripChange={(nextTrip) => {
              const updated = { ...selectedTrip, ...nextTrip };
              setSelectedTrip(updated);
              setDeliveries((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
            }}
          />
        ),
      },
      {
        title: "Financial Breakdown",
        eyebrow: "Revenue, expenses, and profitability",
        rows: [
          {
            label: "Delivery Rate (Revenue)",
            value: formatPeso(selectedTrip.deliveryRate),
            tone: "success",
          },
          {
            label: "Diesel Expenses",
            value: formatExpenseResolution(
              selectedTrip.expenses.dieselExpenses,
              selectedTrip.expenseStates.dieselExpenses,
            ),
            tone: selectedTrip.expenseStates.dieselExpenses === "unknown" ? "warning" : undefined,
          },
          {
            label: "Toll Gate Expenses",
            value: `${formatExpenseResolution(
              selectedTrip.expenses.tollGateExpenses,
              selectedTrip.expenseStates.tollGateExpenses,
            )}${selectedTrip.expenses.tollGateBreakdown ? ` · ${selectedTrip.expenses.tollGateBreakdown}` : ""}`,
            tone: selectedTrip.expenseStates.tollGateExpenses === "unknown" ? "warning" : undefined,
          },
          {
            label: "Store Entry Fees",
            value: formatExpenseResolution(
              selectedTrip.expenses.entryFees,
              selectedTrip.expenseStates.entryFees,
            ),
            tone: selectedTrip.expenseStates.entryFees === "unknown" ? "warning" : undefined,
          },
          {
            label: "Driver Daily Rate + Allowance",
            value: `${formatExpenseResolution(selectedTrip.expenses.driverDailyRate, selectedTrip.expenseStates.driverDailyRate)} + ${formatExpenseResolution(selectedTrip.expenses.driverAllowance, selectedTrip.expenseStates.driverAllowance)}`,
            tone: selectedTrip.expenseStates.driverDailyRate === "unknown" || selectedTrip.expenseStates.driverAllowance === "unknown" ? "warning" : undefined,
          },
          {
            label: "Helper Daily Rate + Allowance",
            value: `${formatExpenseResolution(selectedTrip.expenses.helperDailyRate, selectedTrip.expenseStates.helperDailyRate)} + ${formatExpenseResolution(selectedTrip.expenses.helperAllowance, selectedTrip.expenseStates.helperAllowance)}`,
            tone: selectedTrip.expenseStates.helperDailyRate === "unknown" || selectedTrip.expenseStates.helperAllowance === "unknown" ? "warning" : undefined,
          },
          {
            label: "Other Expenses",
            value: formatExpenseResolution(
              selectedTrip.expenses.otherExpenses,
              selectedTrip.expenseStates.otherExpenses,
            ),
            tone: selectedTrip.expenseStates.otherExpenses === "unknown" ? "warning" : undefined,
          },
          { label: "Total Expenses", value: formatPeso(selectedTrip.totalExpenses) },
          {
            label: "Net Profit",
            value: `${formatPeso(selectedTrip.netIncome)} (${formatPercent(selectedTrip.marginPercent)})`,
            tone: selectedTrip.netIncome !== null && selectedTrip.netIncome >= 0 ? "success" : "warning",
          },
        ],
      },
      {
        title: "Financial state",
        eyebrow: "Integrity and audit",
        rows: [
          { label: "Record Version", value: String(selectedTrip.version) },
          {
            label: "Correction Policy",
            value: selectedTrip.financialState === "finalized"
              ? "Audited correction required"
              : "Finalize after all unknown expenses are resolved",
          },
        ],
        description: selectedTrip.financialState === "finalized"
          ? "Finalized financials are included in confirmed profitability reporting. Corrections require an audited correction workflow."
          : "Incomplete financials are excluded from confirmed profitability reporting until every unknown expense is resolved.",
        customContent: (
          <div className="financial-state-actions">
            <strong>{selectedTrip.financialState === "finalized" ? "Finalized" : "Incomplete"}</strong>
            {selectedTrip.financialIntegrityIssues.length > 0 ? (
              <ul>{selectedTrip.financialIntegrityIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            ) : null}
            {financialActionMessage ? <p role="status">{financialActionMessage}</p> : null}
          </div>
        ),
      },
    ];
  }, [actor.role, actor.roleLabel, canWrite, financialActionMessage, financialActionPending, selectedTrip]);

  return (
    <>
      <OperationalTopbar contextLabel="Completed Deliveries & Multi-Store Trips" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <h1>Deliveries</h1>
            <p className="subtitle">
              Review completed trips, costs, drop-offs, and POD status.
            </p>
          </div>
          <div className="fleet-intro-actions">
            {canImport ? (
              <Link
                className="secondary-button page-intro-action"
                href="/deliveries/import"
                aria-label="Import an Excel trip report"
                data-tooltip="Import an Excel trip report"
              >
                Import
              </Link>
            ) : null}
            {canWrite ? (
              <Link
                className="primary-action-button page-intro-action"
                href="/deliveries/new"
                aria-label="Record a completed delivery and its trip details"
                data-tooltip="Record a completed delivery and its trip details"
              >
                Record delivery
              </Link>
            ) : (
              <span className="settings-readonly-pill">
                View-Only ({actor.roleLabel})
              </span>
            )}
          </div>
        </header>

        <section className="stat-grid" aria-label="Current delivery page totals">
          <article className="stat-card">
            <span className="stat-label">DELIVERY EARNINGS</span>
            <strong>{formatPeso(summary.rateTotal)}</strong>
            <span className="stat-meta positive">
              {filteredDeliveries.length} trips · {summary.stopCount} store drop-offs
            </span>
          </article>
          <article className="stat-card">
            <span className="stat-label">TRIP EXPENSES</span>
            <strong>{formatPeso(summary.expenseTotal)}</strong>
            <span className="stat-meta">
              Diesel, toll gates, entry fees & crew costs
            </span>
          </article>
          <article className="stat-card">
            <span className="stat-label">NET PROFIT</span>
            <strong>{formatPeso(summary.netTotal)}</strong>
            <span className="stat-meta positive">
              Profit for the records shown below
            </span>
          </article>
        </section>
        <p className="delivery-summary-scope">
          Totals reflect only the delivery records shown below.
        </p>

        <section className={`records-card${loading ? " is-loading" : ""}`} aria-label="Completed deliveries table">
          <div className="records-heading">
            <div>
              <h2>Completed Delivery Ledger</h2>
              <p>Filter and open completed delivery records.</p>
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
                { value: "net_income:desc", label: "Highest net profit" },
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
                    <SortableTableHeader label="Waybill" sortKey="waybill" activeSortKey={activeSortKey} direction={activeSortDirection} onSort={updateTableSort} />
                    <SortableTableHeader label="Date" sortKey="delivery_date" activeSortKey={activeSortKey} direction={activeSortDirection} defaultDirection="desc" onSort={updateTableSort} />
                    <SortableTableHeader label="Client" sortKey="client" activeSortKey={activeSortKey} direction={activeSortDirection} onSort={updateTableSort} />
                    <SortableTableHeader label="Truck" sortKey="truck" activeSortKey={activeSortKey} direction={activeSortDirection} onSort={updateTableSort} />
                    <SortableTableHeader label="Temperature" sortKey="temperature" activeSortKey={activeSortKey} direction={activeSortDirection} onSort={updateTableSort} />
                    <SortableTableHeader label="Origin & Store Drop-offs" sortKey="origin" activeSortKey={activeSortKey} direction={activeSortDirection} onSort={updateTableSort} />
                    <SortableTableHeader label="Distance" sortKey="distance" activeSortKey={activeSortKey} direction={activeSortDirection} defaultDirection="desc" onSort={updateTableSort} />
                    <SortableTableHeader label="Delivery Rate" sortKey="delivery_rate" activeSortKey={activeSortKey} direction={activeSortDirection} defaultDirection="desc" onSort={updateTableSort} />
                    <SortableTableHeader label="Total Expenses" sortKey="total_expenses" activeSortKey={activeSortKey} direction={activeSortDirection} defaultDirection="desc" onSort={updateTableSort} />
                    <SortableTableHeader label="Net Profit" sortKey="net_income" activeSortKey={activeSortKey} direction={activeSortDirection} defaultDirection="desc" onSort={updateTableSort} />
                    <SortableTableHeader label="POD Status" sortKey="pod_status" activeSortKey={activeSortKey} direction={activeSortDirection} onSort={updateTableSort} />
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
                        <span className={`truck-ownership-label ${trip.truckOwnership.toLowerCase()}`}>
                          {trip.truckOwnership} · {trip.rateBasis}
                        </span>
                      </td>
                      <td>{trip.truckTemperature}</td>
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
        footer={selectedTrip && canWrite ? (
          selectedTrip.financialState === "incomplete" ? (
            <button
              type="button"
              className="primary-action"
              disabled={financialActionPending || selectedTrip.financialIntegrityIssues.length > 0}
              onClick={finalizeFinancials}
            >
              {financialActionPending ? "Finalizing…" : "Finalize financials"}
            </button>
          ) : (
            <button
              type="button"
              className="primary-action"
              onClick={() => openCorrectionModal(selectedTrip)}
            >
              Correct financials
            </button>
          )
        ) : null}
        onClose={() => setSelectedTrip(null)}
      />

      {correctingTrip ? (
        <div className="routex-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="correction-dialog-title">
          <div className="routex-dialog-backdrop" onClick={() => !correctionSubmitting && setCorrectingTrip(null)} />
          <div className="routex-dialog">
            <header className="routex-dialog-header">
              <div>
                <h2 id="correction-dialog-title">Audited Financial Correction</h2>
                <p>Waybill: {correctingTrip.waybillNumber} · Current Version: {correctingTrip.version}</p>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                onClick={() => !correctionSubmitting && setCorrectingTrip(null)}
                aria-label="Close correction modal"
              >
                ×
              </button>
            </header>

            <form onSubmit={submitCorrection}>
              <div className="routex-dialog-body">
                {correctionError ? (
                  <div className="delivery-form-alert" role="alert">
                    {correctionError}
                  </div>
                ) : null}

                <div className="routex-dialog-field">
                  <label htmlFor="corr-rate">Delivery Rate / Revenue (₱)</label>
                  <input
                    id="corr-rate"
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={correctionDeliveryRate}
                    onChange={(e) => setCorrectionDeliveryRate(e.target.value)}
                  />
                </div>

                <div className="routex-dialog-grid-2">
                  <div className="routex-dialog-field">
                    <label htmlFor="corr-diesel">Diesel Expenses (₱)</label>
                    <input
                      id="corr-diesel"
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={correctionStatuses.dieselExpenses !== "confirmed"}
                      value={correctionExpenses.dieselExpenses ?? ""}
                      onChange={(e) => setCorrectionExpenses((prev) => ({ ...prev, dieselExpenses: e.target.value }))}
                    />
                    <select
                      value={correctionStatuses.dieselExpenses ?? "confirmed"}
                      onChange={(e) => {
                        const st = e.target.value as "confirmed" | "not_applicable" | "unknown";
                        setCorrectionStatuses((prev) => ({ ...prev, dieselExpenses: st }));
                        if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, dieselExpenses: "" }));
                      }}
                    >
                      <option value="confirmed">Confirmed Amount</option>
                      <option value="not_applicable">Not Applicable</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="corr-toll">Toll Gate Expenses (₱)</label>
                    <input
                      id="corr-toll"
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={correctionStatuses.tollGateExpenses !== "confirmed"}
                      value={correctionExpenses.tollGateExpenses ?? ""}
                      onChange={(e) => setCorrectionExpenses((prev) => ({ ...prev, tollGateExpenses: e.target.value }))}
                    />
                    <select
                      value={correctionStatuses.tollGateExpenses ?? "confirmed"}
                      onChange={(e) => {
                        const st = e.target.value as "confirmed" | "not_applicable" | "unknown";
                        setCorrectionStatuses((prev) => ({ ...prev, tollGateExpenses: st }));
                        if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, tollGateExpenses: "" }));
                      }}
                    >
                      <option value="confirmed">Confirmed Amount</option>
                      <option value="not_applicable">Not Applicable</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="corr-driver-rate">Driver Daily Rate (₱)</label>
                    <input
                      id="corr-driver-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={correctionStatuses.driverDailyRate !== "confirmed"}
                      value={correctionExpenses.driverDailyRate ?? ""}
                      onChange={(e) => setCorrectionExpenses((prev) => ({ ...prev, driverDailyRate: e.target.value }))}
                    />
                    <select
                      value={correctionStatuses.driverDailyRate ?? "confirmed"}
                      onChange={(e) => {
                        const st = e.target.value as "confirmed" | "not_applicable" | "unknown";
                        setCorrectionStatuses((prev) => ({ ...prev, driverDailyRate: st }));
                        if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, driverDailyRate: "" }));
                      }}
                    >
                      <option value="confirmed">Confirmed Amount</option>
                      <option value="not_applicable">Not Applicable</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="corr-driver-allow">Driver Allowance (₱)</label>
                    <input
                      id="corr-driver-allow"
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={correctionStatuses.driverAllowance !== "confirmed"}
                      value={correctionExpenses.driverAllowance ?? ""}
                      onChange={(e) => setCorrectionExpenses((prev) => ({ ...prev, driverAllowance: e.target.value }))}
                    />
                    <select
                      value={correctionStatuses.driverAllowance ?? "confirmed"}
                      onChange={(e) => {
                        const st = e.target.value as "confirmed" | "not_applicable" | "unknown";
                        setCorrectionStatuses((prev) => ({ ...prev, driverAllowance: st }));
                        if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, driverAllowance: "" }));
                      }}
                    >
                      <option value="confirmed">Confirmed Amount</option>
                      <option value="not_applicable">Not Applicable</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="corr-helper-rate">Helper Daily Rate (₱)</label>
                    <input
                      id="corr-helper-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={correctionStatuses.helperDailyRate !== "confirmed"}
                      value={correctionExpenses.helperDailyRate ?? ""}
                      onChange={(e) => setCorrectionExpenses((prev) => ({ ...prev, helperDailyRate: e.target.value }))}
                    />
                    <select
                      value={correctionStatuses.helperDailyRate ?? "confirmed"}
                      onChange={(e) => {
                        const st = e.target.value as "confirmed" | "not_applicable" | "unknown";
                        setCorrectionStatuses((prev) => ({ ...prev, helperDailyRate: st }));
                        if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, helperDailyRate: "" }));
                      }}
                    >
                      <option value="confirmed">Confirmed Amount</option>
                      <option value="not_applicable">Not Applicable</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="corr-helper-allow">Helper Allowance (₱)</label>
                    <input
                      id="corr-helper-allow"
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={correctionStatuses.helperAllowance !== "confirmed"}
                      value={correctionExpenses.helperAllowance ?? ""}
                      onChange={(e) => setCorrectionExpenses((prev) => ({ ...prev, helperAllowance: e.target.value }))}
                    />
                    <select
                      value={correctionStatuses.helperAllowance ?? "confirmed"}
                      onChange={(e) => {
                        const st = e.target.value as "confirmed" | "not_applicable" | "unknown";
                        setCorrectionStatuses((prev) => ({ ...prev, helperAllowance: st }));
                        if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, helperAllowance: "" }));
                      }}
                    >
                      <option value="confirmed">Confirmed Amount</option>
                      <option value="not_applicable">Not Applicable</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                </div>

                <div className="routex-dialog-field">
                  <label htmlFor="corr-other">Other Expenses (₱)</label>
                  <input
                    id="corr-other"
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={correctionStatuses.otherExpenses !== "confirmed"}
                    value={correctionExpenses.otherExpenses ?? ""}
                    onChange={(e) => setCorrectionExpenses((prev) => ({ ...prev, otherExpenses: e.target.value }))}
                  />
                  <select
                    value={correctionStatuses.otherExpenses ?? "confirmed"}
                    onChange={(e) => {
                      const st = e.target.value as "confirmed" | "not_applicable" | "unknown";
                      setCorrectionStatuses((prev) => ({ ...prev, otherExpenses: st }));
                      if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, otherExpenses: "" }));
                    }}
                  >
                    <option value="confirmed">Confirmed Amount</option>
                    <option value="not_applicable">Not Applicable</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <div className="routex-dialog-field">
                  <label htmlFor="corr-reason">
                    Correction Reason (Required for audit history · min 5 chars)
                  </label>
                  <textarea
                    id="corr-reason"
                    rows={3}
                    required
                    placeholder="e.g. Fuel receipt adjustment after monthly reconciliation"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                  />
                </div>
              </div>

              <footer className="routex-dialog-footer">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={correctionSubmitting}
                  onClick={() => setCorrectingTrip(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={correctionSubmitting || correctionReason.trim().length < 5}
                >
                  {correctionSubmitting ? "Saving correction…" : "Save Audited Correction"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

