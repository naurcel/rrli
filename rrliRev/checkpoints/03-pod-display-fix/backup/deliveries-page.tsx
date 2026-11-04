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
import { DeliveryFilterDropdown } from "@/components/delivery-filter-dropdown";
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
  canManageDocuments,
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
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedTrucks, setSelectedTrucks] = useState<string[]>([]);
  const [sort, setSort] = useState("delivery_date:desc");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedTrip, setSelectedTrip] = useState<DeliveryLedgerItem | null>(null);
  const [activeKpi, setActiveKpi] = useState<"earnings" | "expenses" | "profit" | null>(null);
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

  function closeCorrectionModal() {
    if (correctionSubmitting) return;
    const initialExpenses = correctingTrip ? {
      dieselExpenses: correctingTrip.expenses.dieselExpenses != null ? String(correctingTrip.expenses.dieselExpenses) : "",
      tollGateExpenses: correctingTrip.expenses.tollGateExpenses != null ? String(correctingTrip.expenses.tollGateExpenses) : "",
      driverAllowance: correctingTrip.expenses.driverAllowance != null ? String(correctingTrip.expenses.driverAllowance) : "",
      driverDailyRate: correctingTrip.expenses.driverDailyRate != null ? String(correctingTrip.expenses.driverDailyRate) : "",
      helperAllowance: correctingTrip.expenses.helperAllowance != null ? String(correctingTrip.expenses.helperAllowance) : "",
      helperDailyRate: correctingTrip.expenses.helperDailyRate != null ? String(correctingTrip.expenses.helperDailyRate) : "",
      otherExpenses: correctingTrip.expenses.otherExpenses != null ? String(correctingTrip.expenses.otherExpenses) : "",
    } : {};
    const dirty = Boolean(correctingTrip) && (
      correctionReason.trim().length > 0 ||
      correctionDeliveryRate !== (correctingTrip?.deliveryRate != null ? String(correctingTrip.deliveryRate) : "") ||
      JSON.stringify(correctionExpenses) !== JSON.stringify(initialExpenses) ||
      Object.entries(correctionStatuses).some(([key, value]) => value !== correctingTrip?.expenseStates[key as keyof DeliveryLedgerItem["expenseStates"]])
    );
    if (dirty && !window.confirm("Discard the unsaved delivery correction?")) return;
    setCorrectingTrip(null);
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
      if (selectedClients.length > 0) params.set("clientIds", selectedClients.join(","));
      if (selectedTrucks.length > 0) params.set("truckIds", selectedTrucks.join(","));
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
                clientIds: selectedClients.length > 0 ? selectedClients : undefined,
                truckIds: selectedTrucks.length > 0 ? selectedTrucks : undefined,
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
          const remoteClients = data.filters?.clients ?? [];
          const existingClientIds = new Set(remoteClients.map((c) => c.id));
          const extraPreviewClients: DeliveryFilterOption[] = [];
          for (const item of local) {
            if (item.clientId && !existingClientIds.has(item.clientId)) {
              existingClientIds.add(item.clientId);
              extraPreviewClients.push({ id: item.clientId, label: item.clientName });
            }
          }
          setClients([...remoteClients, ...extraPreviewClients]);
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
  }, [page, range, searchQuery, selectedClients, selectedTrucks, sort]);

  useEffect(() => {
    setPage(1);
  }, [range, searchQuery, selectedClients, selectedTrucks, sort]);

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

  const kpiBreakdown = useMemo(() => {
    const finalized = filteredDeliveries.filter((d) => d.financialState === "finalized");
    const incomplete = filteredDeliveries.filter((d) => d.financialState === "incomplete");
    const totalTrips = filteredDeliveries.length;
    const finalizedCount = finalized.length;
    const incompleteCount = incomplete.length;
    const totalStops = summary.stopCount;

    let diesel = 0;
    let toll = 0;
    let entryFees = 0;
    let driverDailyRate = 0;
    let driverAllowance = 0;
    let helperDailyRate = 0;
    let helperAllowance = 0;
    let otherExpenses = 0;

    const clientRevenue: Record<string, { total: number; trips: number; stops: number }> = {};
    const ownershipRevenue: Record<string, { total: number; trips: number }> = {
      Owned: { total: 0, trips: 0 },
      Subcontracted: { total: 0, trips: 0 },
    };
    let profitableTrips = 0;
    let lossOrEvenTrips = 0;

    for (const trip of finalized) {
      const rate = trip.deliveryRate ?? 0;
      diesel += trip.expenses.dieselExpenses ?? 0;
      toll += trip.expenses.tollGateExpenses ?? 0;
      entryFees += trip.expenses.entryFees ?? 0;
      driverDailyRate += trip.expenses.driverDailyRate ?? 0;
      driverAllowance += trip.expenses.driverAllowance ?? 0;
      helperDailyRate += trip.expenses.helperDailyRate ?? 0;
      helperAllowance += trip.expenses.helperAllowance ?? 0;
      otherExpenses += trip.expenses.otherExpenses ?? 0;

      const client = trip.clientName || "Unknown Client";
      if (!clientRevenue[client]) {
        clientRevenue[client] = { total: 0, trips: 0, stops: 0 };
      }
      clientRevenue[client].total += rate;
      clientRevenue[client].trips += 1;
      clientRevenue[client].stops += trip.dropoffs.length;

      const ownership = trip.truckOwnership === "Subcontracted" ? "Subcontracted" : "Owned";
      ownershipRevenue[ownership].total += rate;
      ownershipRevenue[ownership].trips += 1;

      if (trip.netIncome !== null && trip.netIncome > 0) {
        profitableTrips += 1;
      } else {
        lossOrEvenTrips += 1;
      }
    }

    const driverTotal = driverDailyRate + driverAllowance;
    const helperTotal = helperDailyRate + helperAllowance;
    const crewTotal = driverTotal + helperTotal;
    const computedExpenseTotal = diesel + toll + entryFees + crewTotal + otherExpenses;
    const marginPercent = summary.rateTotal > 0 ? (summary.netTotal / summary.rateTotal) * 100 : null;

    const avgRevenuePerTrip = finalizedCount > 0 ? summary.rateTotal / finalizedCount : 0;
    const avgRevenuePerStop = totalStops > 0 ? summary.rateTotal / totalStops : 0;
    const avgExpensePerTrip = finalizedCount > 0 ? summary.expenseTotal / finalizedCount : 0;
    const avgExpensePerStop = totalStops > 0 ? summary.expenseTotal / totalStops : 0;
    const avgProfitPerTrip = finalizedCount > 0 ? summary.netTotal / finalizedCount : 0;

    return {
      totalTrips,
      finalizedCount,
      incompleteCount,
      totalStops,
      diesel,
      toll,
      entryFees,
      driverDailyRate,
      driverAllowance,
      driverTotal,
      helperDailyRate,
      helperAllowance,
      helperTotal,
      crewTotal,
      otherExpenses,
      computedExpenseTotal,
      clientRevenue,
      ownershipRevenue,
      profitableTrips,
      lossOrEvenTrips,
      marginPercent,
      avgRevenuePerTrip,
      avgRevenuePerStop,
      avgExpensePerTrip,
      avgExpensePerStop,
      avgProfitPerTrip,
    };
  }, [filteredDeliveries, summary]);

  const kpiDrawerSections = useMemo<DetailSection[]>(() => {
    if (!activeKpi) return [];

    const sharePercent = (amount: number, total: number) =>
      total > 0 ? `${((amount / total) * 100).toFixed(1)}%` : "0.0%";

    if (activeKpi === "earnings") {
      const clientRows = Object.entries(kpiBreakdown.clientRevenue)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([client, data]) => ({
          label: client,
          value: `${formatPeso(data.total)} (${sharePercent(data.total, summary.rateTotal)}) · ${data.trips} ${data.trips === 1 ? "trip" : "trips"}`,
        }));

      return [
        {
          eyebrow: "CALCULATION FORMULA",
          title: "Total Delivery Earnings",
          description:
            "Delivery earnings represent the gross contracted revenue across all finalized delivery trips currently displayed. Incomplete or pending trips are excluded from earnings until finalized.",
          rows: [
            { label: "Formula", value: "∑ (Delivery Rate for all Finalized Trips)" },
            { label: "Total Finalized Earnings", value: formatPeso(summary.rateTotal), tone: "success" },
            { label: "Finalized Trips", value: `${kpiBreakdown.finalizedCount} of ${kpiBreakdown.totalTrips} records` },
            {
              label: "Incomplete Financials",
              value: `${kpiBreakdown.incompleteCount} ${kpiBreakdown.incompleteCount === 1 ? "trip" : "trips"} (excluded until finalized)`,
              tone: kpiBreakdown.incompleteCount > 0 ? "warning" : undefined,
            },
          ],
        },
        {
          eyebrow: "UNIT REVENUE ECONOMICS",
          title: "Trip & Drop-off Averages",
          rows: [
            { label: "Average per Finalized Trip", value: formatPeso(kpiBreakdown.avgRevenuePerTrip) },
            { label: "Average per Store Drop-off", value: formatPeso(kpiBreakdown.avgRevenuePerStop) },
            { label: "Total Store Stops Served", value: `${kpiBreakdown.totalStops} stops` },
          ],
        },
        ...(clientRows.length > 0
          ? [
              {
                eyebrow: "CLIENT REVENUE BREAKDOWN",
                title: "Contribution by Client Account",
                rows: clientRows,
              },
            ]
          : []),
        {
          eyebrow: "FLEET CONTRIBUTION",
          title: "Owned vs. Subcontracted Revenue",
          rows: [
            {
              label: "Owned Fleet",
              value: `${formatPeso(kpiBreakdown.ownershipRevenue.Owned.total)} (${sharePercent(kpiBreakdown.ownershipRevenue.Owned.total, summary.rateTotal)}) · ${kpiBreakdown.ownershipRevenue.Owned.trips} trips`,
            },
            {
              label: "Subcontracted Fleet",
              value: `${formatPeso(kpiBreakdown.ownershipRevenue.Subcontracted.total)} (${sharePercent(kpiBreakdown.ownershipRevenue.Subcontracted.total, summary.rateTotal)}) · ${kpiBreakdown.ownershipRevenue.Subcontracted.trips} trips`,
            },
          ],
        },
      ];
    }

    if (activeKpi === "expenses") {
      const expTotal = summary.expenseTotal;
      return [
        {
          eyebrow: "CALCULATION FORMULA",
          title: "Total Operational Expenses",
          description:
            "Trip expenses aggregate all disbursements incurred during delivery runs, including fuel, highway tolls, client store entry fees, crew wages/allowances, and miscellaneous charges across finalized trips.",
          rows: [
            { label: "Formula", value: "Diesel + Tolls + Entry Fees + Crew Costs + Other" },
            { label: "Total Trip Expenses", value: formatPeso(expTotal), tone: "warning" },
            { label: "Finalized Trips Included", value: `${kpiBreakdown.finalizedCount} trips` },
            { label: "Average Cost per Trip", value: formatPeso(kpiBreakdown.avgExpensePerTrip) },
            { label: "Average Cost per Store Drop-off", value: formatPeso(kpiBreakdown.avgExpensePerStop) },
          ],
        },
        {
          eyebrow: "ITEMIZED EXPENSE BREAKDOWN",
          title: "Cost Categories",
          rows: [
            { label: "Diesel Fuel Expenses", value: `${formatPeso(kpiBreakdown.diesel)} (${sharePercent(kpiBreakdown.diesel, expTotal)})` },
            { label: "Toll Gate Charges", value: `${formatPeso(kpiBreakdown.toll)} (${sharePercent(kpiBreakdown.toll, expTotal)})` },
            { label: "Store Entry Fees", value: `${formatPeso(kpiBreakdown.entryFees)} (${sharePercent(kpiBreakdown.entryFees, expTotal)})` },
            { label: "Crew Payroll & Allowances", value: `${formatPeso(kpiBreakdown.crewTotal)} (${sharePercent(kpiBreakdown.crewTotal, expTotal)})` },
            { label: "Other Trip Expenses", value: `${formatPeso(kpiBreakdown.otherExpenses)} (${sharePercent(kpiBreakdown.otherExpenses, expTotal)})` },
          ],
        },
        {
          eyebrow: "CREW COMPENSATION BREAKDOWN",
          title: "Driver & Helper Payroll",
          rows: [
            { label: "Driver Daily Rates", value: formatPeso(kpiBreakdown.driverDailyRate) },
            { label: "Driver Allowances", value: formatPeso(kpiBreakdown.driverAllowance) },
            { label: "Driver Total", value: `${formatPeso(kpiBreakdown.driverTotal)} (${sharePercent(kpiBreakdown.driverTotal, expTotal)} of all expenses)` },
            { label: "Helper Daily Rates", value: formatPeso(kpiBreakdown.helperDailyRate) },
            { label: "Helper Allowances", value: formatPeso(kpiBreakdown.helperAllowance) },
            { label: "Helper Total", value: `${formatPeso(kpiBreakdown.helperTotal)} (${sharePercent(kpiBreakdown.helperTotal, expTotal)} of all expenses)` },
          ],
        },
      ];
    }

    if (activeKpi === "profit") {
      const margin = kpiBreakdown.marginPercent;
      return [
        {
          eyebrow: "CALCULATION FORMULA",
          title: "Net Operating Margin Equation",
          description:
            "Net profit is the net operating contribution derived by deducting all verified operational expenses from gross finalized delivery earnings.",
          rows: [
            { label: "Profit Equation", value: "Delivery Earnings − Total Trip Expenses" },
            { label: "Delivery Earnings (+)", value: formatPeso(summary.rateTotal), tone: "success" },
            { label: "Trip Expenses (−)", value: formatPeso(summary.expenseTotal), tone: "warning" },
            {
              label: "Net Profit (=)",
              value: formatPeso(summary.netTotal),
              tone: summary.netTotal >= 0 ? "success" : "warning",
            },
          ],
        },
        {
          eyebrow: "MARGIN PERFORMANCE",
          title: "Profitability Metrics",
          rows: [
            {
              label: "Operating Profit Margin",
              value: formatPercent(margin),
              tone: margin != null && margin >= 15 ? "success" : margin != null && margin < 0 ? "warning" : undefined,
            },
            {
              label: "Average Net Profit per Trip",
              value: formatPeso(kpiBreakdown.avgProfitPerTrip),
              tone: kpiBreakdown.avgProfitPerTrip >= 0 ? "success" : "warning",
            },
            { label: "Profitable Deliveries", value: `${kpiBreakdown.profitableTrips} trips`, tone: "success" },
            {
              label: "Loss or Break-Even Deliveries",
              value: `${kpiBreakdown.lossOrEvenTrips} trips`,
              tone: kpiBreakdown.lossOrEvenTrips > 0 ? "warning" : undefined,
            },
          ],
        },
        {
          eyebrow: "LEDGER AUDIT COMPLIANCE",
          title: "Scope & Status Notes",
          rows: [
            { label: "Finalized Deliveries in Calculation", value: `${kpiBreakdown.finalizedCount} records` },
            {
              label: "Pending Deliveries Excluded",
              value: `${kpiBreakdown.incompleteCount} records`,
              tone: kpiBreakdown.incompleteCount > 0 ? "warning" : undefined,
            },
            { label: "Audit Standard", value: "Version-controlled ledger with tamper-resistant audit logs" },
          ],
        },
      ];
    }

    return [];
  }, [activeKpi, kpiBreakdown, summary]);

  const activeKpiMeta = useMemo(() => {
    switch (activeKpi) {
      case "earnings":
        return {
          eyebrow: "METRIC BREAKDOWN & CALCULATION",
          title: "Delivery Earnings",
          statusLabel: formatPeso(summary.rateTotal),
          statusTone: "success" as const,
        };
      case "expenses":
        return {
          eyebrow: "METRIC BREAKDOWN & CALCULATION",
          title: "Trip Expenses",
          statusLabel: formatPeso(summary.expenseTotal),
          statusTone: "warning" as const,
        };
      case "profit":
        return {
          eyebrow: "METRIC BREAKDOWN & CALCULATION",
          title: "Net Operating Profit",
          statusLabel: formatPeso(summary.netTotal),
          statusTone: summary.netTotal >= 0 ? ("success" as const) : ("warning" as const),
        };
      default:
        return null;
    }
  }, [activeKpi, summary]);

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
          { label: "Delivery Status", value: selectedTrip.deliveryStatus || "Completed" },
          { label: "Financial Status", value: selectedTrip.financialState === "finalized" ? "Finalized" : "Incomplete", tone: selectedTrip.financialState === "finalized" ? "success" : "warning" },
          { label: "Truck / Plate Number", value: selectedTrip.plateNumber },
        ],
      },
      {
        title: "Truck & Personnel",
        eyebrow: "Assignment",
        rows: [
          { label: "Truck", value: selectedTrip.plateNumber },
          { label: "Truck Type", value: selectedTrip.truckType },
          { label: "Ownership", value: selectedTrip.truckOwnership },
          { label: "Temperature", value: selectedTrip.truckTemperature },
          { label: "Driver", value: selectedTrip.driverName || "Not recorded" },
          { label: "Helper", value: selectedTrip.helperName || "Not recorded" },
        ],
      },
      {
        title: `Route & Drop-offs (${selectedTrip.dropoffs.length} stops)`,
        eyebrow: "Stop sequence and documents",
        fullWidth: true,
        rows: [
          { label: "Origin", value: selectedTrip.origin },
          { label: "Distance", value: `${selectedTrip.distanceKm} km` },
          { label: "Fuel Rate", value: `${formatPeso(selectedTrip.fuelRate)} / L` },
          ...selectedTrip.dropoffs.map((stop) => ({
          label: `#${stop.sequence} ${stop.storeName} (${stop.destinationArea})`,
          value: `Entry fee: ${formatExpenseResolution(stop.entryFee, stop.entryFeeStatus)} · ${
            stop.podSubmitted ? `Attached (${stop.documentRef})` : stop.documentRef
          }`,
          tone:
            stop.podSubmitted
              ? ("success" as const)
              : ("warning" as const),
          })),
        ],
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
            value: formatExpenseResolution(
              selectedTrip.expenses.tollGateExpenses,
              selectedTrip.expenseStates.tollGateExpenses,
            ),
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
            label: "Net Income",
            value: formatPeso(selectedTrip.netIncome),
            tone: selectedTrip.netIncome !== null && selectedTrip.netIncome >= 0 ? "success" : "warning",
          },
          { label: "Profit Margin", value: formatPercent(selectedTrip.marginPercent), tone: selectedTrip.netIncome !== null && selectedTrip.netIncome >= 0 ? "success" : "warning" },
        ],
      },
      {
        title: "POD & Supporting Documents",
        eyebrow: "Stop-level files",
        fullWidth: true,
        description: "Select a drop-off to view its POD or upload a replacement when authorized.",
        customContent: (
          <DeliveryPodDocuments
            trip={selectedTrip}
            canVerify={canManageDocuments(actor.role)}
            roleLabel={actor.roleLabel}
            onTripChange={(nextTrip) => {
              const updated = { ...selectedTrip, ...nextTrip };
              setSelectedTrip(updated);
              setDeliveries((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
            }}
          />
        ),
      },
    ];
  }, [actor.role, actor.roleLabel, canWrite, selectedTrip]);

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
          <button
            type="button"
            className={`stat-card is-interactive${activeKpi === "earnings" ? " is-active" : ""}`}
            onClick={() => {
              setSelectedTrip(null);
              setActiveKpi((curr) => (curr === "earnings" ? null : "earnings"));
            }}
            aria-expanded={activeKpi === "earnings"}
            aria-label="Delivery earnings breakdown and calculation"
          >
            <div className="stat-card-header">
              <span className="stat-label">DELIVERY EARNINGS</span>
              <span className="kpi-click-pill">Breakdown ›</span>
            </div>
            <strong>{formatPeso(summary.rateTotal)}</strong>
            <span className="stat-meta positive">
              {filteredDeliveries.length} trips · {summary.stopCount} store drop-offs
            </span>
          </button>
          <button
            type="button"
            className={`stat-card is-interactive${activeKpi === "expenses" ? " is-active" : ""}`}
            onClick={() => {
              setSelectedTrip(null);
              setActiveKpi((curr) => (curr === "expenses" ? null : "expenses"));
            }}
            aria-expanded={activeKpi === "expenses"}
            aria-label="Trip expenses breakdown and calculation"
          >
            <div className="stat-card-header">
              <span className="stat-label">TRIP EXPENSES</span>
              <span className="kpi-click-pill">Breakdown ›</span>
            </div>
            <strong>{formatPeso(summary.expenseTotal)}</strong>
            <span className="stat-meta">
              Diesel, toll gates, entry fees & crew costs
            </span>
          </button>
          <button
            type="button"
            className={`stat-card is-interactive${activeKpi === "profit" ? " is-active" : ""}`}
            onClick={() => {
              setSelectedTrip(null);
              setActiveKpi((curr) => (curr === "profit" ? null : "profit"));
            }}
            aria-expanded={activeKpi === "profit"}
            aria-label="Net profit breakdown and calculation"
          >
            <div className="stat-card-header">
              <span className="stat-label">NET PROFIT</span>
              <span className="kpi-click-pill">Breakdown ›</span>
            </div>
            <strong>{formatPeso(summary.netTotal)}</strong>
            <span className={`stat-meta ${summary.netTotal >= 0 ? "positive" : "warning"}`}>
              {kpiBreakdown.marginPercent !== null ? `${formatPercent(kpiBreakdown.marginPercent)} margin · ` : ""}Profit for shown records
            </span>
          </button>
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
                Search by waybill or truck plate number
              </span>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="Search by waybill or plate number…"
                aria-label="Search deliveries by waybill or plate number"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <DeliveryFilterDropdown
              clients={clients}
              trucks={trucks}
              selectedClients={selectedClients}
              selectedTrucks={selectedTrucks}
              onClientsChange={setSelectedClients}
              onTrucksChange={setSelectedTrucks}
              onClearAll={() => {
                setSelectedClients([]);
                setSelectedTrucks([]);
              }}
            />

            {searchQuery || selectedClients.length > 0 || selectedTrucks.length > 0 ? (
              <button
                type="button"
                className="filter-button filter-clear"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedClients([]);
                  setSelectedTrucks([]);
                }}
              >
                Clear filters
              </button>
            ) : null}

          </div>

          {(selectedClients.length > 0 || selectedTrucks.length > 0) && (
            <div className="active-filter-chips" aria-label="Active filters">
              <span className="active-chips-label">Active filters:</span>
              {selectedClients.map((id) => {
                const client = clients.find((c) => c.id === id);
                const label = client?.label ?? id;
                return (
                  <span key={`client-${id}`} className="filter-chip">
                    <span className="filter-chip-category">Client:</span> {label}
                    <button
                      type="button"
                      className="filter-chip-remove"
                      aria-label={`Remove filter for ${label}`}
                      onClick={() => setSelectedClients((prev) => prev.filter((item) => item !== id))}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              {selectedTrucks.map((id) => {
                const truck = trucks.find(
                  (t) =>
                    t.id === id ||
                    t.label.toUpperCase() === id.toUpperCase() ||
                    t.label.replace(/\s+/g, "").toUpperCase() ===
                      id.replace(/\s+/g, "").toUpperCase(),
                );
                const label = truck?.label ?? id;
                return (
                  <span key={`truck-${id}`} className="filter-chip">
                    <span className="filter-chip-category">Truck:</span> {label}
                    <button
                      type="button"
                      className="filter-chip-remove"
                      aria-label={`Remove filter for ${label}`}
                      onClick={() => setSelectedTrucks((prev) => prev.filter((item) => item !== id))}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                className="filter-chip-clear-all"
                onClick={() => {
                  setSelectedClients([]);
                  setSelectedTrucks([]);
                }}
              >
                Clear all
              </button>
            </div>
          )}

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
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.map((trip) => (
                    <tr
                      key={trip.id}
                      className="record-row"
                      tabIndex={0}
                      onClick={() => {
                        setActiveKpi(null);
                        setSelectedTrip(trip);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setActiveKpi(null);
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
                          {trip.truckOwnership}
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
        open={Boolean(activeKpi && activeKpiMeta)}
        eyebrow={activeKpiMeta?.eyebrow ?? ""}
        title={activeKpiMeta?.title ?? ""}
        statusLabel={activeKpiMeta?.statusLabel}
        statusTone={activeKpiMeta?.statusTone}
        sections={kpiDrawerSections}
        onClose={() => setActiveKpi(null)}
        footer={(
          <button
            type="button"
            className="secondary-button"
            onClick={() => setActiveKpi(null)}
          >
            Close breakdown
          </button>
        )}
      />

      <RecordDetailDrawer
        open={Boolean(selectedTrip)}
        eyebrow={selectedTrip ? `WAYBILL ${selectedTrip.waybillNumber}` : ""}
        title={selectedTrip ? selectedTrip.clientName : ""}
        statusLabel={selectedTrip?.deliveryStatus || "Completed"}
        statusTone="success"
        sections={drawerSections}
        footer={selectedTrip && canWrite ? (
          <>
            {financialActionMessage ? <span className="financial-action-status">{financialActionMessage}</span> : null}
            <button type="button" className="secondary-button" onClick={() => openCorrectionModal(selectedTrip)}>
              Edit delivery
            </button>
            {selectedTrip.financialState === "incomplete" ? (
            <button
              type="button"
              className="primary-action"
              disabled={financialActionPending || selectedTrip.financialIntegrityIssues.length > 0}
              onClick={finalizeFinancials}
            >
              {financialActionPending ? "Finalizing…" : "Finalize financials"}
            </button>
            ) : null}
          </>
        ) : null}
        onClose={() => setSelectedTrip(null)}
      />

      {correctingTrip ? (
        <div className="routex-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="correction-dialog-title">
          <div className="routex-dialog-backdrop" onClick={closeCorrectionModal} />
          <div className="routex-dialog">
            <header className="routex-dialog-header">
              <div>
                <h2 id="correction-dialog-title">Edit Delivery Financials</h2>
                <p>Waybill: {correctingTrip.waybillNumber} · Current Version: {correctingTrip.version}</p>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                onClick={closeCorrectionModal}
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
                    className="no-spin-stepper"
                    style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
                    placeholder="₱ 0.00"
                    value={correctionDeliveryRate}
                    onChange={(e) => setCorrectionDeliveryRate(e.target.value)}
                  />
                </div>

                <div className="routex-dialog-grid-2">
                  <div className="routex-dialog-field">
                    <label htmlFor="corr-diesel">Diesel (₱)</label>
                    <input
                      id="corr-diesel"
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={correctionStatuses.dieselExpenses !== "confirmed"}
                      className="no-spin-stepper"
                      style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
                      placeholder="₱ 0.00"
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
                    <label htmlFor="corr-toll">Tolls (₱)</label>
                    <input
                      id="corr-toll"
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={correctionStatuses.tollGateExpenses !== "confirmed"}
                      className="no-spin-stepper"
                      style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
                      placeholder="₱ 0.00"
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

                </div>

                <div className="routex-dialog-field-group">
                  <span className="routex-dialog-group-title">Driver</span>
                  <div className="routex-dialog-grid-2">
                    <div className="routex-dialog-field">
                      <label htmlFor="corr-driver-rate">Daily Rate (₱)</label>
                      <input
                        id="corr-driver-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={correctionStatuses.driverDailyRate !== "confirmed"}
                        className="no-spin-stepper"
                        style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
                        placeholder="₱ 0.00"
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
                      <label htmlFor="corr-driver-allow">Allowance (₱)</label>
                      <input
                        id="corr-driver-allow"
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={correctionStatuses.driverAllowance !== "confirmed"}
                        className="no-spin-stepper"
                        style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
                        placeholder="₱ 0.00"
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
                  </div>
                </div>

                <div className="routex-dialog-field-group">
                  <span className="routex-dialog-group-title">Helper</span>
                  <div className="routex-dialog-grid-2">
                    <div className="routex-dialog-field">
                      <label htmlFor="corr-helper-rate">Daily Rate (₱)</label>
                      <input
                        id="corr-helper-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={correctionStatuses.helperDailyRate !== "confirmed"}
                        className="no-spin-stepper"
                        style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
                        placeholder="₱ 0.00"
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
                      <label htmlFor="corr-helper-allow">Allowance (₱)</label>
                      <input
                        id="corr-helper-allow"
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={correctionStatuses.helperAllowance !== "confirmed"}
                        className="no-spin-stepper"
                        style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
                        placeholder="₱ 0.00"
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
                </div>

                <div className="routex-dialog-field">
                  <label htmlFor="corr-other">Other (₱)</label>
                  <input
                    id="corr-other"
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={correctionStatuses.otherExpenses !== "confirmed"}
                    className="no-spin-stepper"
                    style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
                    placeholder="₱ 0.00"
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
                  onClick={closeCorrectionModal}
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

