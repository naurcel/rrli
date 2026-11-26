"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuthenticatedActor } from "@/components/auth-context";
import { ConfirmDeliveryDeletionDialog } from "@/components/confirm-delivery-deletion-dialog";
import { BackdatingTicketsModal } from "@/components/backdating-tickets-modal";
import {
  formatDateRange,
  GlobalDateRangePicker,
  parseDateValue,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { FinancialBreakdownModal } from "@/components/financial-breakdown-modal";
import { DeliveryFilterDropdown } from "@/components/delivery-filter-dropdown";
import { TablePagination } from "@/components/table-pagination";
import { ViewTripExpensesModal } from "@/components/view-trip-expenses-modal";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import { useSearchBuffer } from "@/components/search-buffer";
import { SimpleLoading } from "@/components/simple-loading";
import {
  getTripTotalDropoffs,
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
} from "@/features/deliveries/delivery-domain";
import type {
  DeliveryFilterOption,
  DeliveryLedgerItem,
} from "@/features/deliveries/server/delivery-repository";
import {
  canImportAndReviewExcel,
  canMutateDeliveryRecords,
} from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";
import {
  selectBrowserPreviewDeliveries,
  upsertBrowserPreviewDelivery,
} from "@/features/deliveries/browser-preview-deliveries";
import { deleteDeliveryRecord } from "@/features/deliveries/delivery-deletion-client";
import {
  countUnresolvedDeliveryAttentionFlags,
  DELIVERY_FLAGS_CHANGED_EVENT,
} from "@/features/deliveries/delivery-attention-flags";
import { BASE_HELPERS, getFleetCrew } from "@/features/deliveries/driver-registry";
import {
  isValidInternalReturnPath,
  resolveReturnTarget,
  withReturnContext,
} from "@/lib/navigation/return-context";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sortDeliveryLedgerItems(
  items: readonly DeliveryLedgerItem[],
  sortField: string,
  direction: TableSortDirection,
): DeliveryLedgerItem[] {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    let leftVal: string | number | null = null;
    let rightVal: string | number | null = null;

    switch (sortField) {
      case "waybill":
        leftVal = (left.waybillNumber ?? "").toLowerCase();
        rightVal = (right.waybillNumber ?? "").toLowerCase();
        break;
      case "delivery_date":
        leftVal = left.deliveryDate ?? "";
        rightVal = right.deliveryDate ?? "";
        break;
      case "client":
        leftVal = (left.clientName ?? "").toLowerCase();
        rightVal = (right.clientName ?? "").toLowerCase();
        break;
      case "truck":
        leftVal = (left.plateNumber ?? "").toLowerCase();
        rightVal = (right.plateNumber ?? "").toLowerCase();
        break;
      case "temperature": {
        const parseTemp = (t?: string | null) => {
          const raw = t ?? "";
          const num = Number(raw.replace(/°?c/i, "").trim());
          return Number.isFinite(num) ? num : raw.toLowerCase();
        };
        leftVal = parseTemp(left.truckTemperature);
        rightVal = parseTemp(right.truckTemperature);
        break;
      }
      case "origin":
        leftVal = (left.origin ?? "").toLowerCase();
        rightVal = (right.origin ?? "").toLowerCase();
        break;
      case "dropoffs":
        leftVal = getTripTotalDropoffs(left.dropoffs);
        rightVal = getTripTotalDropoffs(right.dropoffs);
        break;
      case "distance":
        leftVal = left.distanceKm ?? 0;
        rightVal = right.distanceKm ?? 0;
        break;
      case "delivery_rate":
        leftVal = left.deliveryRate;
        rightVal = right.deliveryRate;
        break;
      case "total_expenses":
        leftVal = left.totalExpenses;
        rightVal = right.totalExpenses;
        break;
      case "net_income":
        leftVal = left.netIncome;
        rightVal = right.netIncome;
        break;
      case "profit_margin":
        leftVal = left.marginPercent;
        rightVal = right.marginPercent;
        break;
      default:
        leftVal = left.deliveryDate ?? "";
        rightVal = right.deliveryDate ?? "";
        break;
    }

    if (leftVal == null && rightVal == null) return 0;
    if (leftVal == null) return 1;
    if (rightVal == null) return -1;

    const compared =
      typeof leftVal === "number" && typeof rightVal === "number"
        ? leftVal - rightVal
        : String(leftVal).localeCompare(String(rightVal));

    return compared * multiplier || left.id.localeCompare(right.id);
  });
}

export default function DeliveriesPage() {
  const router = useRouter();
  const actor = useAuthenticatedActor();
  const { range, setRange } = useGlobalDateRange();
  const [deliveries, setDeliveries] = useState<readonly DeliveryLedgerItem[]>([]);
  const [clients, setClients] = useState<DeliveryFilterOption[]>([]);
  const [trucks, setTrucks] = useState<DeliveryFilterOption[]>([]);
  const [drivers, setDrivers] = useState<DeliveryFilterOption[]>([]);
  const [helpers, setHelpers] = useState<DeliveryFilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const {
    value: searchQuery,
    setValue: setSearchQuery,
    bufferedQuery: debouncedSearchQuery,
    isBuffering: isSearchBuffering,
    clear: clearSearch,
    reset: resetSearch,
  } = useSearchBuffer({ delay: 500 });
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedTrucks, setSelectedTrucks] = useState<string[]>([]);
  const [sort, setSort] = useState("delivery_date:desc");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "incomplete">("all");
  const [page, setPage] = useState(1);
  const [deliveryToDelete, setDeliveryToDelete] = useState<DeliveryLedgerItem | null>(null);
  const [isDeletingDelivery, setIsDeletingDelivery] = useState(false);
  const [deleteDeliveryError, setDeleteDeliveryError] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState<"earnings" | "expenses" | "profit" | null>(null);
  const [financialActionMessage, setFinancialActionMessage] = useState<string | null>(null);
  const [viewingTripExpenses, setViewingTripExpenses] = useState<DeliveryLedgerItem | null>(null);
  const [returnToParam, setReturnToParam] = useState<string | null>(null);
  const [returnLabelParam, setReturnLabelParam] = useState<string | null>(null);
  const [backdatingModalOpen, setBackdatingModalOpen] = useState(false);
  const [selectedTripIds, setSelectedTripIds] = useState<Set<string>>(new Set());
  const [, setFlagsVersion] = useState(0);

  useEffect(() => {
    function handleFlags() {
      setFlagsVersion((v) => v + 1);
    }
    window.addEventListener(DELIVERY_FLAGS_CHANGED_EVENT, handleFlags);
    window.addEventListener("storage", handleFlags);
    return () => {
      window.removeEventListener(DELIVERY_FLAGS_CHANGED_EVENT, handleFlags);
      window.removeEventListener("storage", handleFlags);
    };
  }, []);

  function buildCurrentDeliveriesUrl(): string {
    const query = new URLSearchParams();
    if (searchQuery.trim()) query.set("search", searchQuery.trim());
    if (statusFilter !== "all") query.set("status", statusFilter);
    if (sort !== "delivery_date:desc") query.set("sort", sort);
    if (page > 1) query.set("page", String(page));
    if (selectedClients.length > 0) query.set("clients", selectedClients.join(","));
    if (selectedTrucks.length > 0) query.set("trucks", selectedTrucks.join(","));
    if (range.startDate) query.set("dateFrom", toDateKey(range.startDate));
    if (range.endDate) query.set("dateTo", toDateKey(range.endDate));
    if (returnToParam && isValidInternalReturnPath(returnToParam)) {
      query.set("returnTo", returnToParam);
      if (returnLabelParam) query.set("returnLabel", returnLabelParam);
    }
    const qs = query.toString();
    return qs ? `/deliveries?${qs}` : "/deliveries";
  }

  function navigateToDelivery(trip: DeliveryLedgerItem) {
    const query = new URLSearchParams();
    query.set("from", "deliveries");
    if (searchQuery.trim()) query.set("search", searchQuery.trim());
    if (statusFilter !== "all") query.set("status", statusFilter);
    if (sort !== "delivery_date:desc") query.set("sort", sort);
    if (page > 1) query.set("page", String(page));
    if (selectedClients.length > 0) query.set("clients", selectedClients.join(","));
    if (selectedTrucks.length > 0) query.set("trucks", selectedTrucks.join(","));
    if (range.startDate) query.set("dateFrom", toDateKey(range.startDate));
    if (range.endDate) query.set("dateTo", toDateKey(range.endDate));
    query.set("returnTo", buildCurrentDeliveriesUrl());
    query.set("returnLabel", "Deliveries");
    const qs = query.toString();
    router.push(`/deliveries/${encodeURIComponent(trip.id)}${qs ? `?${qs}` : ""}`);
  }

  const handledEditLink = useRef<string | null>(null);

  function openDeleteDeliveryModal(trip: DeliveryLedgerItem) {
    setDeleteDeliveryError(null);
    setDeliveryToDelete(trip);
  }

  function closeDeleteDeliveryModal() {
    if (isDeletingDelivery) return;
    setDeleteDeliveryError(null);
    setDeliveryToDelete(null);
  }

  async function handleConfirmDeleteDelivery() {
    if (!deliveryToDelete || isDeletingDelivery) return;
    setIsDeletingDelivery(true);
    setDeleteDeliveryError(null);

    try {
      await deleteDeliveryRecord(deliveryToDelete.id);
      setDeliveries((prev) => prev.filter((d) => d.id !== deliveryToDelete.id));
      const deletedMsg = `Delivery record "${deliveryToDelete.waybillNumber}" was successfully deleted.`;
      setFinancialActionMessage(deletedMsg);
      toast.success("Delivery deleted", {
        description: deletedMsg,
      });
      setDeliveryToDelete(null);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Network error while deleting delivery record.";
      setDeleteDeliveryError(errMsg);
      toast.error("Failed to delete delivery", {
        description: errMsg,
      });
    } finally {
      setIsDeletingDelivery(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (debouncedSearchQuery.trim()) params.set("q", debouncedSearchQuery.trim());
      if (selectedClients.length > 0) params.set("clientIds", selectedClients.join(","));
      if (selectedTrucks.length > 0) params.set("truckIds", selectedTrucks.join(","));
      if (range.startDate) params.set("dateFrom", toDateKey(range.startDate));
      if (range.endDate) params.set("dateTo", toDateKey(range.endDate));
      const [sortField, direction] = sort.split(":");
      params.set("sort", sortField);
      params.set("direction", direction);

      if (deliveries.length === 0) {
        setLoading(true);
      }
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
              drivers?: DeliveryFilterOption[];
              helpers?: DeliveryFilterOption[];
            };
            source?: string;
          };
          if (!response.ok || !data.ok) {
            throw new Error(data.message ?? "Unable to load delivery records.");
          }
          const local = data.source === "bundled-mock"
            ? selectBrowserPreviewDeliveries({
                search: debouncedSearchQuery,
                clientIds: selectedClients.length > 0 ? selectedClients : undefined,
                truckIds: selectedTrucks.length > 0 ? selectedTrucks : undefined,
                dateFrom: range.startDate ? toDateKey(range.startDate) : undefined,
                dateTo: range.endDate ? toDateKey(range.endDate) : undefined,
              })
            : [];
          const remote = data.items ?? [];
          const localIds = new Set(local.map((item) => item.id));
          const combined = [...local, ...remote.filter((item) => !localIds.has(item.id))];
          setDeliveries(sortDeliveryLedgerItems(combined, sortField, direction as TableSortDirection));
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

          const remoteDrivers = data.filters?.drivers ?? [];
          const existingDriverNames = new Set(remoteDrivers.map((d) => d.label.toLowerCase()));
          const extraPreviewDrivers: DeliveryFilterOption[] = [];
          for (const item of local) {
            if (item.driverName && !existingDriverNames.has(item.driverName.toLowerCase())) {
              existingDriverNames.add(item.driverName.toLowerCase());
              extraPreviewDrivers.push({
                id: `driver-${item.driverName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                label: item.driverName,
              });
            }
          }
          setDrivers([...remoteDrivers, ...extraPreviewDrivers]);

          const remoteHelpers = data.filters?.helpers ?? [];
          const baseHelpersList: DeliveryFilterOption[] = [
            ...remoteHelpers,
            ...BASE_HELPERS.map((h) => ({ id: h.id, label: h.fullName })),
            ...getFleetCrew().filter((c) => c.assignmentType === "Helper").map((h) => ({ id: h.id, label: h.fullName })),
          ];
          const existingHelperNames = new Set(baseHelpersList.map((h) => h.label.toLowerCase()));
          const extraPreviewHelpers: DeliveryFilterOption[] = [];
          for (const item of local) {
            if (item.helperName) {
              for (const name of item.helperName.split(/[,/&]/).map((h) => h.trim()).filter(Boolean)) {
                if (!existingHelperNames.has(name.toLowerCase())) {
                  existingHelperNames.add(name.toLowerCase());
                  extraPreviewHelpers.push({
                    id: `helper-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                    label: name,
                  });
                }
              }
            }
          }
          const mergedHelpers = [...baseHelpersList, ...extraPreviewHelpers].filter(
            (helper, index, all) =>
              all.findIndex((candidate) => candidate.label.toLowerCase() === helper.label.toLowerCase()) === index,
          );
          setHelpers(mergedHelpers);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setDeliveries([]);
          setLoadError(error instanceof Error ? error.message : "Unable to load deliveries.");
        })
        .finally(() => setLoading(false));
    }, 50);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, debouncedSearchQuery, selectedClients, selectedTrucks]);

  const isInitialParamsParsed = useRef(false);

  useEffect(() => {
    if (isInitialParamsParsed.current) {
      setPage(1);
    }
  }, [range, debouncedSearchQuery, selectedClients, selectedTrucks, sort, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get("edit");
    const createdId = params.get("created");
    const clientParam = params.get("client");
    const searchParam = params.get("search") || params.get("q") || clientParam;

    if (!isInitialParamsParsed.current) {
      isInitialParamsParsed.current = true;
      if (searchParam) {
        resetSearch(searchParam);
      }
      const statusParam = params.get("status");
      if (statusParam === "completed" || statusParam === "incomplete" || statusParam === "all") {
        setStatusFilter(statusParam);
      }
      const sortParam = params.get("sort");
      if (sortParam) {
        setSort(sortParam);
      }
      const pageParam = params.get("page");
      if (pageParam && Number(pageParam) > 1) {
        setPage(Number(pageParam));
      }
      const clientsParam = params.get("clients");
      if (clientsParam) {
        setSelectedClients(clientsParam.split(",").filter(Boolean));
      }
      const trucksParam = params.get("trucks");
      if (trucksParam) {
        setSelectedTrucks(trucksParam.split(",").filter(Boolean));
      }
      const dateFromParam = params.get("dateFrom");
      const dateToParam = params.get("dateTo");
      if (dateFromParam || dateToParam) {
        setRange({
          startDate: dateFromParam ? parseDateValue(dateFromParam) : null,
          endDate: dateToParam ? parseDateValue(dateToParam) : null,
        });
      }
      const rt = params.get("returnTo");
      const rl = params.get("returnLabel");
      if (rt && isValidInternalReturnPath(rt)) {
        setReturnToParam(rt);
        setReturnLabelParam(rl);
      }
    }

    if (requestedId && handledEditLink.current !== requestedId) {
      handledEditLink.current = requestedId;
      router.push(`/deliveries/${encodeURIComponent(requestedId)}/edit`);
    } else if (createdId && handledEditLink.current !== createdId) {
      handledEditLink.current = createdId;
      router.push(`/deliveries/${encodeURIComponent(createdId)}`);
    }
  }, [deliveries, router]);

  const sortedDeliveriesBase = useMemo(() => {
    const [sortField, direction] = sort.split(":") as [string, TableSortDirection];
    return sortDeliveryLedgerItems(deliveries, sortField, direction || "desc");
  }, [deliveries, sort]);

  const statusCounts = useMemo(() => {
    const all = sortedDeliveriesBase.length;
    const completed = sortedDeliveriesBase.filter((d) => !isDeliveryIncomplete(d)).length;
    const incomplete = sortedDeliveriesBase.filter(isDeliveryIncomplete).length;
    return { all, completed, incomplete };
  }, [sortedDeliveriesBase]);

  const filteredDeliveries = useMemo(() => {
    if (statusFilter === "completed") {
      return sortedDeliveriesBase.filter((d) => !isDeliveryIncomplete(d));
    }
    if (statusFilter === "incomplete") {
      return sortedDeliveriesBase.filter(isDeliveryIncomplete);
    }
    return sortedDeliveriesBase;
  }, [sortedDeliveriesBase, statusFilter]);

  const filteredPageCount = Math.max(1, Math.ceil(filteredDeliveries.length / 10));
  const paginatedDeliveries = useMemo(() => {
    const startIdx = (page - 1) * 10;
    return filteredDeliveries.slice(startIdx, startIdx + 10);
  }, [filteredDeliveries, page]);

  useEffect(() => {
    if (page > filteredPageCount) {
      setPage(filteredPageCount);
    }
  }, [page, filteredPageCount]);

  const truckerByPlate = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of trucks) {
      if (t.provider) {
        map.set(t.label.toUpperCase(), t.provider);
        map.set(t.id, t.provider);
      }
    }
    return map;
  }, [trucks]);

  const summary = useMemo(() => {
    const financiallyComplete = sortedDeliveriesBase.filter(isDeliveryFinanciallyComplete);
    const rateTotal = financiallyComplete.reduce((sum, item) => sum + (item.deliveryRate ?? 0), 0);
    const expenseTotal = financiallyComplete.reduce((sum, item) => sum + (item.totalExpenses ?? 0), 0);
    const netTotal = rateTotal - expenseTotal;
    const stopCount = sortedDeliveriesBase.reduce(
      (sum, item) => sum + getTripTotalDropoffs(item.dropoffs),
      0,
    );
    return { rateTotal, expenseTotal, netTotal, stopCount };
  }, [sortedDeliveriesBase]);

  const kpiBreakdown = useMemo(() => {
    const financiallyComplete = sortedDeliveriesBase.filter(isDeliveryFinanciallyComplete);
    const financiallyIncomplete = sortedDeliveriesBase.filter((d) => !isDeliveryFinanciallyComplete(d));
    const totalTrips = sortedDeliveriesBase.length;
    const financiallyCompleteCount = financiallyComplete.length;
    const financiallyIncompleteCount = financiallyIncomplete.length;
    const completedCount = statusCounts.completed;
    const incompleteCount = statusCounts.incomplete;
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

    for (const trip of financiallyComplete) {
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
      clientRevenue[client].stops += getTripTotalDropoffs(trip.dropoffs);

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

    const avgRevenuePerTrip = financiallyCompleteCount > 0 ? summary.rateTotal / financiallyCompleteCount : 0;
    const avgRevenuePerStop = totalStops > 0 ? summary.rateTotal / totalStops : 0;
    const avgExpensePerTrip = financiallyCompleteCount > 0 ? summary.expenseTotal / financiallyCompleteCount : 0;
    const avgExpensePerStop = totalStops > 0 ? summary.expenseTotal / totalStops : 0;
    const avgProfitPerTrip = financiallyCompleteCount > 0 ? summary.netTotal / financiallyCompleteCount : 0;

    return {
      totalTrips,
      finalizedCount: financiallyCompleteCount,
      incompleteCount,
      financiallyCompleteCount,
      financiallyIncompleteCount,
      completedCount,
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
  }, [sortedDeliveriesBase, statusCounts, summary]);



  const canWrite = canMutateDeliveryRecords(actor);
  const canImport = canImportAndReviewExcel(actor);
  const canDeleteDelivery = Boolean(
    actor.isSuperadmin || actor.role === "admin" || actor.roles?.includes("admin"),
  );
  const [activeSortKey, activeSortDirection] = sort.split(":") as [string, TableSortDirection];
  const updateTableSort = (key: string, direction: TableSortDirection) => setSort(`${key}:${direction}`);
  const resetTableSort = () => setSort("delivery_date:desc");
  const parentBackTarget = useMemo(() => {
    if (!returnToParam || !isValidInternalReturnPath(returnToParam)) return null;
    return resolveReturnTarget({
      returnTo: returnToParam,
      returnLabel: returnLabelParam,
      fallbackHref: "/dashboard",
      fallbackLabel: "Back",
    });
  }, [returnToParam, returnLabelParam]);

  return (
    <>
      <OperationalTopbar
        contextLabel="Completed Deliveries & Multi-Store Trips"
        showDateFilter={false}
      />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            {parentBackTarget ? (
              <Link className="back-link" href={parentBackTarget.href}>
                ← {parentBackTarget.label}
              </Link>
            ) : null}
            <h1>Deliveries</h1>
            <p className="subtitle">
              Trip records, store drop-offs, and expense tracking.
            </p>
          </div>
          <div className="fleet-intro-actions">
            <button
              type="button"
              className="secondary-button page-intro-action"
              onClick={() => setBackdatingModalOpen(true)}
              title="View or submit delivery backdating requests"
            >
              Requests
            </button>
            {canImport ? (
              <Link
                className="secondary-button page-intro-action"
                href={withReturnContext("/deliveries/import", buildCurrentDeliveriesUrl(), "Deliveries")}
                aria-label="Import an Excel trip report"
              >
                Import
              </Link>
            ) : null}
            {canWrite ? (
              <Link
                className="primary-action-button page-intro-action"
                href={withReturnContext("/deliveries/new", buildCurrentDeliveriesUrl(), "Deliveries")}
                aria-label="Record a completed delivery and its trip details"
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

        {financialActionMessage ? (
          <div
            className="notice"
            role="status"
            style={{
              padding: "10px 14px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              color: "#047857",
              fontSize: "12px",
            }}
          >
            <span>{financialActionMessage}</span>
            <button
              type="button"
              onClick={() => setFinancialActionMessage(null)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "inherit",
                fontWeight: "bold",
                padding: "0 4px",
                fontSize: "14px",
              }}
              aria-label="Dismiss notice"
            >
              ×
            </button>
          </div>
        ) : null}

        <section className="stat-grid" aria-label="Current delivery page totals">
          <button
            type="button"
            className={`stat-card stat-card-revenue is-interactive${activeKpi === "earnings" ? " is-active" : ""}`}
            onClick={() => {
              setActiveKpi((curr) => (curr === "earnings" ? null : "earnings"));
            }}
            aria-expanded={activeKpi === "earnings"}
            aria-label="Revenue breakdown and calculation"
          >
            <div className="stat-card-header">
              <span className="stat-label">REVENUE</span>
              <span className="kpi-click-pill">Breakdown ›</span>
            </div>
            <strong>{formatPeso(summary.rateTotal)}</strong>
            <span className="stat-meta positive">
              {kpiBreakdown.financiallyCompleteCount} trips · {summary.stopCount} stops
            </span>
          </button>
          <button
            type="button"
            className={`stat-card stat-card-expenses is-interactive${activeKpi === "expenses" ? " is-active" : ""}`}
            onClick={() => {
              setActiveKpi((curr) => (curr === "expenses" ? null : "expenses"));
            }}
            aria-expanded={activeKpi === "expenses"}
            aria-label="Trip expenses breakdown and calculation"
          >
            <div className="stat-card-header">
              <span className="stat-label">EXPENSES</span>
              <span className="kpi-click-pill">Breakdown ›</span>
            </div>
            <strong>{formatPeso(summary.expenseTotal)}</strong>
            <span className="stat-meta">
              Fuel, tolls &amp; crew pay
            </span>
          </button>
          <button
            type="button"
            className={`stat-card stat-card-profit is-interactive${activeKpi === "profit" ? " is-active" : ""}`}
            onClick={() => {
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
              {kpiBreakdown.marginPercent !== null ? `${formatPercent(kpiBreakdown.marginPercent)} margin · ` : ""}{kpiBreakdown.financiallyCompleteCount} trips
            </span>
          </button>
        </section>

        <section className={`records-card delivery-ledger-card${loading ? " is-loading" : ""}`} aria-label="Completed deliveries table">
          <div className="records-heading">
            <div className="records-heading-copy">
              <h2>Deliveries</h2>
            </div>
          </div>

          <div className="delivery-status-tabs" role="tablist" aria-label="Filter deliveries by completion status">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "all"}
              className={`delivery-status-tab${statusFilter === "all" ? " active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All
              <span className="tab-count-badge">{statusCounts.all}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "completed"}
              className={`delivery-status-tab${statusFilter === "completed" ? " active" : ""}`}
              onClick={() => setStatusFilter("completed")}
            >
              Completed
              <span className="tab-count-badge">{statusCounts.completed}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "incomplete"}
              className={`delivery-status-tab is-incomplete-tab${statusFilter === "incomplete" ? " active" : ""}`}
              onClick={() => setStatusFilter("incomplete")}
            >
              Incomplete
              <span className="tab-count-badge">{statusCounts.incomplete}</span>
            </button>
          </div>

          <div className="filters">
            <label className={`search-box${isSearchBuffering ? " is-buffering" : ""}`}>
              <span className="sr-only">
                Search by waybill, plate, client, or trucker
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Search by waybill, plate, client, or trucker…"
                aria-label="Search deliveries by waybill, plate, client, or trucker"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {isSearchBuffering && (
                <span className="search-buffer-indicator" title="Buffering search…" aria-label="Buffering search…" />
              )}
            </label>

            <GlobalDateRangePicker />

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
                setRange({ startDate: null, endDate: null });
              }}
            />
          </div>

          {(selectedClients.length > 0 ||
            selectedTrucks.length > 0 ||
            range.startDate ||
            range.endDate) && (
            <div className="active-filter-chips" aria-label="Active filters">
              <span className="active-chips-label">Active filters:</span>
              {(range.startDate || range.endDate) && (
                <span className="filter-chip">
                  <span className="filter-chip-category">Date:</span>{" "}
                  {formatDateRange(range)}
                  <button
                    type="button"
                    className="filter-chip-remove"
                    aria-label="Remove date range filter"
                    title="Remove date range filter"
                    onClick={() =>
                      setRange({ startDate: null, endDate: null })
                    }
                  >
                    ×
                  </button>
                </span>
              )}
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
                      title={`Remove filter for ${label}`}
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
                      title={`Remove filter for ${label}`}
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
                title="Clear all active filters"
                onClick={() => {
                  clearSearch();
                  setSelectedClients([]);
                  setSelectedTrucks([]);
                  setRange({ startDate: null, endDate: null });
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
          ) : (loading && deliveries.length === 0) ? (
            <SimpleLoading
              message="Loading deliveries…"
            />
          ) : (
            <>
              {selectedTripIds.size > 0 && (
                <div className="bulk-selection-bar" role="region" aria-label="Selected delivery records actions">
                  <span className="bulk-selection-count">
                    <strong>{selectedTripIds.size}</strong> delivery record{selectedTripIds.size === 1 ? "" : "s"} selected
                  </span>
                  <div className="bulk-selection-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ minHeight: "28px", fontSize: "11.5px", padding: "0 10px" }}
                      onClick={() => {
                        const rows = filteredDeliveries.filter((t) => selectedTripIds.has(t.id));
                        const text = rows
                          .map(
                            (t) =>
                              `#${t.waybillNumber}\t${t.deliveryDate}\t${t.clientName}\t${t.plateNumber}\t${formatPeso(t.deliveryRate)}\t${formatPeso(t.netIncome)}`,
                          )
                          .join("\n");
                        navigator.clipboard?.writeText(text);
                        toast.success(`Copied ${rows.length} delivery record(s) to clipboard`);
                      }}
                    >
                      Copy Selected
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ minHeight: "28px", fontSize: "11.5px", padding: "0 10px" }}
                      onClick={() => setSelectedTripIds(new Set())}
                    >
                      Clear selection
                    </button>
                  </div>
                </div>
              )}
              <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "36px", textAlign: "center", paddingLeft: "12px", paddingRight: "4px" }}>
                      <input
                        type="checkbox"
                        className="table-select-checkbox"
                        aria-label="Select all deliveries on page"
                        checked={
                          paginatedDeliveries.length > 0 &&
                          paginatedDeliveries.every((trip) => selectedTripIds.has(trip.id))
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedTripIds((prev) => {
                            const next = new Set(prev);
                            for (const trip of paginatedDeliveries) {
                              if (checked) next.add(trip.id);
                              else next.delete(trip.id);
                            }
                            return next;
                          });
                        }}
                      />
                    </th>
                    <SortableTableHeader label="Waybill" sortKey="waybill" activeSortKey={activeSortKey} direction={activeSortDirection} onSort={updateTableSort} onReset={resetTableSort} />
                    <SortableTableHeader label="Date" sortKey="delivery_date" activeSortKey={activeSortKey} direction={activeSortDirection} defaultDirection="desc" onSort={updateTableSort} onReset={resetTableSort} />
                    <SortableTableHeader label="Client" sortKey="client" activeSortKey={activeSortKey} direction={activeSortDirection} onSort={updateTableSort} onReset={resetTableSort} />
                    <SortableTableHeader label="Truck" sortKey="truck" activeSortKey={activeSortKey} direction={activeSortDirection} onSort={updateTableSort} onReset={resetTableSort} />
                    <SortableTableHeader label="Temp" sortKey="temperature" activeSortKey={activeSortKey} direction={activeSortDirection} onSort={updateTableSort} onReset={resetTableSort} />
                    <SortableTableHeader label="Origin" sortKey="origin" activeSortKey={activeSortKey} direction={activeSortDirection} onSort={updateTableSort} onReset={resetTableSort} />
                    <SortableTableHeader label="Drop-offs" sortKey="dropoffs" activeSortKey={activeSortKey} direction={activeSortDirection} defaultDirection="desc" onSort={updateTableSort} onReset={resetTableSort} />
                    <SortableTableHeader label="Distance" sortKey="distance" activeSortKey={activeSortKey} direction={activeSortDirection} defaultDirection="desc" onSort={updateTableSort} onReset={resetTableSort} />
                    <SortableTableHeader label="Revenue" sortKey="delivery_rate" activeSortKey={activeSortKey} direction={activeSortDirection} defaultDirection="desc" onSort={updateTableSort} onReset={resetTableSort} />
                    <SortableTableHeader label="Expenses" sortKey="total_expenses" activeSortKey={activeSortKey} direction={activeSortDirection} defaultDirection="desc" onSort={updateTableSort} onReset={resetTableSort} />
                    <SortableTableHeader label="Net Profit" sortKey="net_income" activeSortKey={activeSortKey} direction={activeSortDirection} defaultDirection="desc" onSort={updateTableSort} onReset={resetTableSort} />
                    <th style={{ width: actor.role === "admin" ? "76px" : "44px", textAlign: "right" }}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="table-empty-cell">
                        <div className="empty-state minimal">
                          <strong className="empty-state-title">No records found</strong>
                          <span className="empty-state-desc">
                            No deliveries match the active filters or selected date range.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedDeliveries.map((trip) => {
                    const isIncomplete = isDeliveryIncomplete(trip);
                    const isFinanciallyIncomplete = !isDeliveryFinanciallyComplete(trip);
                    const isRowSelected = selectedTripIds.has(trip.id);
                    return (
                      <tr
                        key={trip.id}
                        className={`record-row ${isIncomplete ? "is-incomplete" : ""}${isRowSelected ? " is-selected" : ""}`}
                        tabIndex={0}
                        onClick={() => {
                          setActiveKpi(null);
                          navigateToDelivery(trip);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setActiveKpi(null);
                            navigateToDelivery(trip);
                          }
                        }}
                      >
                        <td
                          style={{ width: "36px", textAlign: "center", paddingLeft: "12px", paddingRight: "4px" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="table-select-checkbox"
                            aria-label={`Select waybill #${trip.waybillNumber}`}
                            checked={isRowSelected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedTripIds((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(trip.id);
                                else next.delete(trip.id);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="cell-waybill">
                          <div className="waybill-badge-stack">
                            <strong className="waybill-code">#{trip.waybillNumber}</strong>
                            {trip.notes ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--color-text-muted, #64748b)",
                                  maxWidth: "140px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  marginTop: "2px",
                                }}
                                title={`Note: ${trip.notes}`}
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{ flexShrink: 0, opacity: 0.7 }}
                                  aria-hidden="true"
                                >
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="16" y1="13" x2="8" y2="13" />
                                  <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trip.notes}</span>
                              </span>
                            ) : null}
                          </div>
                        </td>
                      <td className="cell-date">
                        <span className="date-main">{trip.deliveryDate}</span>
                      </td>
                      <td className="cell-client">
                        <span className="client-name-label">{trip.clientName}</span>
                      </td>
                      <td className="truck-code cell-truck">
                        <strong>{trip.plateNumber}</strong>
                        <br />
                        <small>{trip.truckType}{trip.truckOwnership === "Subcontracted" ? ` · ${truckerByPlate.get(trip.plateNumber.toUpperCase()) || "Subcon"}` : ""}</small>
                      </td>
                      <td className="cell-temp">
                        <span className="temp-value">{trip.truckTemperature}</span>
                      </td>
                      <td className="cell-origin">
                        <span className="origin-name">{trip.origin}</span>
                      </td>
                      <td className="cell-stores">
                        {(() => {
                          const totalDrops = getTripTotalDropoffs(trip.dropoffs);
                          return (
                            <div
                              className="stores-cell-wrap"
                              title={trip.dropoffs
                                .map(
                                  (d) =>
                                    `#${d.sequence} ${d.storeName} (${d.destinationArea}) · ${d.dropoffCount ?? 1} drop-off(s)`,
                                )
                                .join("\n")}
                            >
                              <span className="dropoff-count-badge">
                                {totalDrops} {totalDrops === 1 ? "drop-off" : "drop-offs"}
                                {totalDrops !== trip.dropoffs.length ? ` · ${trip.dropoffs.length} locs` : ""}
                              </span>
                              {trip.dropoffs.length > 0 ? (
                                <span className="stores-destination-summary">
                                  {trip.dropoffs
                                    .map((d) => d.destinationArea || d.storeName)
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .join(", ") + (trip.dropoffs.length > 2 ? ` +${trip.dropoffs.length - 2}` : "")}
                                </span>
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="cell-distance">{trip.distanceKm} km</td>
                      <td className="money cell-delivery-rate">{formatPeso(trip.deliveryRate)}</td>
                      <td
                        className="cell-expenses is-clickable"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingTripExpenses(trip);
                        }}
                        title="View expenses"
                        style={{ cursor: "pointer" }}
                      >
                        {isFinanciallyIncomplete || trip.totalExpenses == null ? (
                          <span
                            className="profit-amount warning"
                            title="Pending unresolved expenses"
                            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "var(--color-warning, #f59e0b)",
                                flexShrink: 0,
                              }}
                            />
                            Pending
                          </span>
                        ) : (
                          <span className="expenses-clickable-amount" style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "3px" }}>
                            {formatPeso(trip.totalExpenses)}
                          </span>
                        )}
                      </td>
                      <td className="money cell-net-income">
                        <div className="profit-stack">
                          {isFinanciallyIncomplete || trip.netIncome == null ? (
                            <span
                              className="profit-amount warning"
                              title="Pending unresolved expenses"
                              style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: "var(--color-warning, #f59e0b)",
                                  flexShrink: 0,
                                }}
                              />
                              Pending
                            </span>
                          ) : (
                            <>
                              <span className={`profit-amount ${trip.netIncome != null && trip.netIncome >= 0 ? "positive" : "warning"}`}>
                                {formatPeso(trip.netIncome)}
                              </span>
                              {trip.marginPercent !== null ? (
                                <span
                                  className={`margin-pill ${trip.marginPercent >= 20 ? "good" : trip.marginPercent >= 0 ? "mod" : "low"}`}
                                >
                                  {formatPercent(trip.marginPercent)}
                                </span>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <div className="table-row-actions" style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                          {canWrite ? (
                            <>
                              <button
                                type="button"
                                className="truck-action-icon-btn"
                                aria-label={`Edit delivery #${trip.waybillNumber}`}
                                title="Edit delivery"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(
                                    withReturnContext(
                                      `/deliveries/${encodeURIComponent(trip.id)}/edit`,
                                      buildCurrentDeliveriesUrl(),
                                      "Deliveries",
                                    ),
                                  );
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                </svg>
                              </button>
                              {canDeleteDelivery && (
                                <button
                                  type="button"
                                  className="truck-action-icon-btn danger"
                                  aria-label={`Delete delivery #${trip.waybillNumber}`}
                                  title="Delete delivery"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteDeliveryModal(trip);
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                  </svg>
                                </button>
                              )}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
              </table>
            </div>
            </>
          )}

          <TablePagination
            page={page}
            pageCount={filteredPageCount}
            totalItems={filteredDeliveries.length}
            pageSize={10}
            onPageChange={setPage}
            loading={loading || isSearchBuffering}
            itemLabel="deliveries"
            itemCountInPage={paginatedDeliveries.length}
          />
        </section>
      </div>

      {/* Trip Expenses Popup Modal */}
      <ViewTripExpensesModal
        trip={viewingTripExpenses}
        onClose={() => setViewingTripExpenses(null)}
        onViewDelivery={(t) => {
          setViewingTripExpenses(null);
          navigateToDelivery(t);
        }}
      />

      <FinancialBreakdownModal
        open={Boolean(activeKpi)}
        activeTab={activeKpi ?? "earnings"}
        onTabChange={(tab) => setActiveKpi(tab)}
        onClose={() => setActiveKpi(null)}
        summary={summary}
        kpiBreakdown={kpiBreakdown}
      />

      <ConfirmDeliveryDeletionDialog
        delivery={deliveryToDelete}
        pending={isDeletingDelivery}
        error={deleteDeliveryError}
        onCancel={closeDeleteDeliveryModal}
        onConfirm={handleConfirmDeleteDelivery}
      />

      <BackdatingTicketsModal
        isOpen={backdatingModalOpen}
        onClose={() => setBackdatingModalOpen(false)}
        currentUserRole={canDeleteDelivery ? "admin" : actor.role}
        currentUsername={actor.username}
      />
    </>
  );
}

