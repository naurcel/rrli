"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { ConfirmDeliveryDeletionDialog } from "@/components/confirm-delivery-deletion-dialog";
import {
  formatDateRange,
  GlobalDateRangePicker,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import {
  RecordDetailDrawer,
  type DetailSection,
} from "@/components/record-detail-drawer";
import { DeliveryFilterDropdown } from "@/components/delivery-filter-dropdown";
import { TablePagination } from "@/components/table-pagination";
import {
  AggregateExpenseBreakdown,
  DeliveryFinancialBreakdown,
} from "@/components/delivery-financial-breakdown";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import { RoundedSelect } from "@/components/rounded-select";
import type {
  DeliveryStoreDropoff,
  ExpenseResolutionStatus,
  FinancialState,
} from "@/features/deliveries/delivery-domain";
import {
  calculateProfitMargin,
  calculateTripExpenseTotal,
  derivePodVerificationStatus,
  getDeliveryIncompleteIssues,
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
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
import {
  readBrowserPreviewDeliveries,
  selectBrowserPreviewDeliveries,
  upsertBrowserPreviewDelivery,
} from "@/features/deliveries/browser-preview-deliveries";
import { deleteDeliveryRecord } from "@/features/deliveries/delivery-deletion-client";
import {
  handlePositiveDecimalKeyDown,
  sanitizePersonNameInput,
  sanitizePositiveDecimalInput,
} from "@/features/deliveries/delivery-input-utils";
import { BASE_HELPERS, getFleetCrew } from "@/features/deliveries/driver-registry";

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
  if (state === "unknown") return "Incomplete";
  if (state === "not_applicable") return "Not applicable";
  return formatPeso(value);
}

type CorrectionDropoffDraft = {
  id: string;
  storeName: string;
  destinationArea: string;
  entryFee: string;
  entryFeeStatus: ExpenseResolutionStatus;
  podSubmitted: boolean;
  supportingDocsComplete: boolean;
  documentRef: string;
};

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
        leftVal = left.dropoffs?.length ?? 0;
        rightVal = right.dropoffs?.length ?? 0;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedTrucks, setSelectedTrucks] = useState<string[]>([]);
  const [sort, setSort] = useState("delivery_date:desc");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "incomplete">("all");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [deliveryToDelete, setDeliveryToDelete] = useState<DeliveryLedgerItem | null>(null);
  const [isDeletingDelivery, setIsDeletingDelivery] = useState(false);
  const [deleteDeliveryError, setDeleteDeliveryError] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState<"earnings" | "expenses" | "profit" | null>(null);
  const [financialActionMessage, setFinancialActionMessage] = useState<string | null>(null);

  function navigateToDelivery(trip: DeliveryLedgerItem) {
    const query = new URLSearchParams();
    if (searchQuery.trim()) query.set("search", searchQuery.trim());
    if (statusFilter !== "all") query.set("status", statusFilter);
    if (sort !== "delivery_date:desc") query.set("sort", sort);
    if (page > 1) query.set("page", String(page));
    if (selectedClients.length > 0) query.set("clients", selectedClients.join(","));
    if (selectedTrucks.length > 0) query.set("trucks", selectedTrucks.join(","));
    const qs = query.toString();
    router.push(`/deliveries/${encodeURIComponent(trip.id)}${qs ? `?${qs}` : ""}`);
  }

  const [correctingTrip, setCorrectingTrip] = useState<DeliveryLedgerItem | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionDeliveryRate, setCorrectionDeliveryRate] = useState<string>("");
  const [correctionDriverName, setCorrectionDriverName] = useState("");
  const [correctionHelperName, setCorrectionHelperName] = useState("");
  const [correctionExpenses, setCorrectionExpenses] = useState<{ [key: string]: string }>({});
  const [correctionStatuses, setCorrectionStatuses] = useState<{ [key: string]: "confirmed" | "not_applicable" | "unknown" }>({});
  const [correctionExistingSupportingDocs, setCorrectionExistingSupportingDocs] = useState<string[]>([]);
  const [correctionSupportingFiles, setCorrectionSupportingFiles] = useState<File[]>([]);
  const [correctionDropoffs, setCorrectionDropoffs] = useState<CorrectionDropoffDraft[]>([]);
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const handledEditLink = useRef<string | null>(null);

  function addCorrectionDropoff() {
    setCorrectionDropoffs((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        storeName: "",
        destinationArea: "",
        entryFee: "",
        entryFeeStatus: "not_applicable",
        podSubmitted: false,
        supportingDocsComplete: false,
        documentRef: "",
      },
    ]);
  }

  function removeCorrectionDropoff(index: number) {
    setCorrectionDropoffs((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function updateCorrectionDropoff(
    index: number,
    field: keyof CorrectionDropoffDraft,
    val: any,
  ) {
    setCorrectionDropoffs((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: val };
        if (field === "entryFeeStatus" && val !== "confirmed") {
          updated.entryFee = "";
        }
        return updated;
      }),
    );
  }

  const correctionEntryFeeSummary = useMemo(() => {
    const hasUnknown = correctionDropoffs.some((d) => d.entryFeeStatus === "unknown");
    const allNa = correctionDropoffs.length > 0 && correctionDropoffs.every((d) => d.entryFeeStatus === "not_applicable");
    if (hasUnknown) return "Incomplete";
    if (allNa) return "Not applicable";
    const total = correctionDropoffs.reduce((sum, d) => {
      if (d.entryFeeStatus === "confirmed" && d.entryFee !== "") {
        const num = Number(d.entryFee);
        return sum + (Number.isFinite(num) ? num : 0);
      }
      return sum;
    }, 0);
    return formatPeso(total);
  }, [correctionDropoffs]);

  function openCorrectionModal(trip: DeliveryLedgerItem) {
    setCorrectingTrip(trip);
    setCorrectionReason("");
    setCorrectionDeliveryRate(trip.deliveryRate != null ? String(trip.deliveryRate) : "");
    setCorrectionDriverName(trip.driverName ?? "");
    setCorrectionHelperName(trip.helperName ?? "");
    setCorrectionExistingSupportingDocs(trip.supportingDocuments ? [...trip.supportingDocuments] : []);
    setCorrectionSupportingFiles([]);
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
    const dropoffsDraft: CorrectionDropoffDraft[] = (trip.dropoffs && trip.dropoffs.length > 0)
      ? trip.dropoffs.map((d) => ({
          id: d.id || crypto.randomUUID(),
          storeName: d.storeName,
          destinationArea: d.destinationArea,
          entryFee: d.entryFee != null ? String(d.entryFee) : "",
          entryFeeStatus: d.entryFeeStatus ?? (d.entryFee != null ? "confirmed" : "not_applicable"),
          podSubmitted: Boolean(d.podSubmitted),
          supportingDocsComplete: Boolean(d.supportingDocsComplete),
          documentRef: d.documentRef ?? "",
        }))
      : [
          {
            id: crypto.randomUUID(),
            storeName: "",
            destinationArea: "",
            entryFee: "",
            entryFeeStatus: "not_applicable",
            podSubmitted: false,
            supportingDocsComplete: false,
            documentRef: "",
          },
        ];
    setCorrectionDropoffs(dropoffsDraft);
    setCorrectionSubmitting(false);
    setCorrectionError(null);
  }

  function closeCorrectionModal() {
    if (correctionSubmitting) return;
    setCorrectingTrip(null);
  }

  function openDeleteDeliveryModal(trip: DeliveryLedgerItem) {
    setDeleteDeliveryError(null);
    setDeliveryToDelete(trip);
  }

  function closeDeleteDeliveryModal() {
    if (isDeletingDelivery) return;
    setDeleteDeliveryError(null);
    setDeliveryToDelete(null);
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
      setCorrectionError("Please enter a valid positive delivery revenue.");
      return;
    }

    if (correctionDropoffs.length === 0) {
      setCorrectionError("At least one store drop-off is required.");
      return;
    }

    for (let i = 0; i < correctionDropoffs.length; i++) {
      const stop = correctionDropoffs[i];
      if (!stop.storeName.trim()) {
        setCorrectionError(`Store name is required for Store Drop-off #${i + 1}.`);
        return;
      }
      if (!stop.destinationArea.trim()) {
        setCorrectionError(`Destination area is required for Store Drop-off #${i + 1}.`);
        return;
      }
      if (stop.entryFeeStatus === "confirmed") {
        const feeNum = stop.entryFee === "" ? null : Number(stop.entryFee);
        if (feeNum === null || !Number.isFinite(feeNum) || feeNum < 0) {
          setCorrectionError(`Please enter a valid positive entry fee for Store Drop-off #${i + 1}.`);
          return;
        }
      }
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

    const finalSupportingDocs = [
      ...correctionExistingSupportingDocs,
      ...correctionSupportingFiles.map((f) => f.name),
    ];
    const hasSupporting = finalSupportingDocs.length > 0;
    const updatedDropoffs: DeliveryStoreDropoff[] = correctionDropoffs.map((stop, index) => {
      const feeNum = stop.entryFeeStatus === "confirmed" && stop.entryFee !== ""
        ? Number(stop.entryFee)
        : null;
      return {
        id: stop.id,
        sequence: index + 1,
        storeName: stop.storeName.trim(),
        destinationArea: stop.destinationArea.trim(),
        entryFee: feeNum,
        entryFeeStatus: stop.entryFeeStatus,
        podSubmitted: stop.podSubmitted,
        supportingDocsComplete: hasSupporting || stop.supportingDocsComplete,
        documentRef: stop.documentRef || "",
      };
    });

    const hasUnknownEntryFee = updatedDropoffs.some((d) => d.entryFeeStatus === "unknown");
    const allNaEntryFee = updatedDropoffs.length > 0 && updatedDropoffs.every((d) => d.entryFeeStatus === "not_applicable");
    let aggregatedEntryFeeTotal: number | null = null;
    let aggregatedEntryFeeStatus: ExpenseResolutionStatus = "confirmed";

    if (hasUnknownEntryFee) {
      aggregatedEntryFeeTotal = null;
      aggregatedEntryFeeStatus = "unknown";
    } else if (allNaEntryFee) {
      aggregatedEntryFeeTotal = null;
      aggregatedEntryFeeStatus = "not_applicable";
    } else {
      aggregatedEntryFeeTotal = updatedDropoffs.reduce((sum, d) => sum + (d.entryFee ?? 0), 0);
      aggregatedEntryFeeStatus = "confirmed";
    }

    expensesPayload.entryFees = aggregatedEntryFeeTotal;
    const finalStatuses: Record<string, ExpenseResolutionStatus> = {
      ...correctionStatuses,
      entryFees: aggregatedEntryFeeStatus,
    };

    const nextPodStatus = derivePodVerificationStatus(updatedDropoffs);
    const updatedExpenses = { ...correctingTrip.expenses, ...expensesPayload };
    const updatedStates = { ...correctingTrip.expenseStates, ...finalStatuses };
    const totalExp = calculateTripExpenseTotal(updatedExpenses, updatedStates);
    const net = totalExp == null ? null : numRate - totalExp;
    const margin = calculateProfitMargin(numRate, net);
    const expenseKeys = [
      "dieselExpenses",
      "tollGateExpenses",
      "entryFees",
      "driverAllowance",
      "driverDailyRate",
      "helperAllowance",
      "helperDailyRate",
      "otherExpenses",
    ] as const;
    const financialIntegrityIssues = expenseKeys.flatMap((key) => {
      const status = updatedStates[key];
      if (status === "unknown") return [`${key} is unresolved.`];
      if (status === "confirmed" && updatedExpenses[key] == null) {
        return [`${key} has no confirmed amount.`];
      }
      return [];
    });
    const nextFinancialState: FinancialState =
      financialIntegrityIssues.length === 0 ? "finalized" : "incomplete";

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
            driverName: correctionDriverName.trim() || null,
            helperName: correctionHelperName.trim() || null,
            expenses: expensesPayload,
            expenseStates: finalStatuses,
            supportingDocuments: finalSupportingDocs,
            dropoffs: updatedDropoffs,
            financialState: nextFinancialState,
          },
          fallbackRecord: correctingTrip,
        }),
      });

      const data = await response.json().catch(() => ({}));
      let newVersion = correctingTrip.version + 1;

      if (!response.ok || !data.ok) {
        if (response.status === 409 || data.code === "VERSION_CONFLICT") {
          setCorrectionError(
            "Version Conflict: This delivery record was modified concurrently by another user. Your inputs have been preserved. Please review and retry.",
          );
          return;
        }

        const hasBrowserRecord = readBrowserPreviewDeliveries().some(
          (item) => item.id === correctingTrip.id,
        );
        const isNotFound =
          response.status === 404 ||
          data.code === "NOT_FOUND" ||
          String(data.message).includes("NOT_FOUND") ||
          String(data.message).toLowerCase().includes("delivery_not_found");

        if (!isNotFound || !hasBrowserRecord) {
          setCorrectionError(data.message ?? "Failed to save correction.");
          return;
        }
      } else {
        newVersion = data.result?.version ?? correctingTrip.version + 1;
      }

      const updated = {
        ...correctingTrip,
        deliveryRate: numRate,
        driverName: correctionDriverName.trim() || null,
        helperName: correctionHelperName.trim() || null,
        expenses: updatedExpenses,
        expenseStates: updatedStates,
        totalExpenses: totalExp,
        netIncome: net,
        marginPercent: margin,
        financialState: nextFinancialState,
        financialIntegrityIssues,
        version: newVersion,
        supportingDocuments: finalSupportingDocs,
        dropoffs: updatedDropoffs,
        podStatus: nextPodStatus,
      };

      setFinancialActionMessage(
        nextFinancialState === "finalized"
          ? `Delivery updated and financials resolved (Version ${newVersion}). Reason: "${correctionReason.trim()}".`
          : `Delivery updated with pending unresolved expenses (Version ${newVersion}). Reason: "${correctionReason.trim()}".`,
      );
      upsertBrowserPreviewDelivery(updated);
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

  async function handleConfirmDeleteDelivery() {
    if (!deliveryToDelete || isDeletingDelivery) return;
    setIsDeletingDelivery(true);
    setDeleteDeliveryError(null);

    try {
      await deleteDeliveryRecord(deliveryToDelete.id);
      setDeliveries((prev) => prev.filter((d) => d.id !== deliveryToDelete.id));
      setTotal((current) => Math.max(0, current - 1));
      setFinancialActionMessage(`Delivery record "${deliveryToDelete.waybillNumber}" was successfully deleted.`);
      setDeliveryToDelete(null);
    } catch (error) {
      setDeleteDeliveryError(error instanceof Error ? error.message : "Network error while deleting delivery record.");
    } finally {
      setIsDeletingDelivery(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
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
                search: searchQuery,
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
          setTotal(combined.length);
          setPageCount(Math.max(1, Math.ceil(combined.length / 10)));
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
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [range, searchQuery, selectedClients, selectedTrucks, sort]);

  const isInitialParamsParsed = useRef(false);

  useEffect(() => {
    if (isInitialParamsParsed.current) {
      setPage(1);
    }
  }, [range, searchQuery, selectedClients, selectedTrucks, sort, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get("edit");
    const createdId = params.get("created");
    const searchParam = params.get("search") || params.get("q");

    if (!isInitialParamsParsed.current) {
      isInitialParamsParsed.current = true;
      if (searchParam) {
        setSearchQuery(searchParam);
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
    }

    if (requestedId && handledEditLink.current !== requestedId) {
      const requestedTrip =
        deliveries.find((trip) => trip.id === requestedId) ??
        readBrowserPreviewDeliveries().find((trip) => trip.id === requestedId);
      if (requestedTrip) {
        handledEditLink.current = requestedId;
        openCorrectionModal(requestedTrip);
      }
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

  const summary = useMemo(() => {
    const financiallyComplete = sortedDeliveriesBase.filter(isDeliveryFinanciallyComplete);
    const rateTotal = financiallyComplete.reduce((sum, item) => sum + (item.deliveryRate ?? 0), 0);
    const expenseTotal = financiallyComplete.reduce((sum, item) => sum + (item.totalExpenses ?? 0), 0);
    const netTotal = rateTotal - expenseTotal;
    const stopCount = sortedDeliveriesBase.reduce(
      (sum, item) => sum + item.dropoffs.length,
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
          title: "Revenue",
          rows: [
            { label: "Formula", value: "∑ (Revenue for all Finalized Deliveries)" },
            { label: "Revenue", value: formatPeso(summary.rateTotal), tone: "success" },
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
            { label: "Total Store Drop-offs Served", value: `${kpiBreakdown.totalStops} drop-offs` },
            {
              label: "Average Drop-offs per Trip",
              value: `${kpiBreakdown.finalizedCount > 0 ? (kpiBreakdown.totalStops / kpiBreakdown.finalizedCount).toFixed(1) : "0"} drop-offs`,
            },
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
              label: "Owned Trucks",
              value: `${formatPeso(kpiBreakdown.ownershipRevenue.Owned.total)} (${sharePercent(kpiBreakdown.ownershipRevenue.Owned.total, summary.rateTotal)}) · ${kpiBreakdown.ownershipRevenue.Owned.trips} trips`,
            },
            {
              label: "Subcontracted Trucks",
              value: `${formatPeso(kpiBreakdown.ownershipRevenue.Subcontracted.total)} (${sharePercent(kpiBreakdown.ownershipRevenue.Subcontracted.total, summary.rateTotal)}) · ${kpiBreakdown.ownershipRevenue.Subcontracted.trips} trips`,
            },
            {
              label: "Total Fleet Trips",
              value: `${kpiBreakdown.ownershipRevenue.Owned.trips + kpiBreakdown.ownershipRevenue.Subcontracted.trips} trips`,
            },
          ],
        },
      ];
    }

    if (activeKpi === "expenses") {
      const expTotal = summary.expenseTotal;
      return [
        {
          eyebrow: "EXPENSE BREAKDOWN",
          title: "Trip Expenses Distribution",
          fullWidth: true,
          customContent: (
            <AggregateExpenseBreakdown
              summary={summary}
              kpiBreakdown={kpiBreakdown}
            />
          ),
        },
        {
          eyebrow: "FORMULA",
          title: "Trip Expenses",
          rows: [
            { label: "Formula", value: "Diesel Fuel + Highway Tolls + Store Entry Fees + Crew Compensation + Other Expenses" },
            { label: "Trip Expenses", value: formatPeso(expTotal), tone: "warning" },
            { label: "Finalized Trips Included", value: `${kpiBreakdown.finalizedCount} trips` },
            { label: "Average Expense per Trip", value: formatPeso(kpiBreakdown.avgExpensePerTrip) },
            { label: "Average Expense per Store Drop-off", value: formatPeso(kpiBreakdown.avgExpensePerStop) },
          ],
        },
        {
          eyebrow: "COST CATEGORIES",
          title: "Cost Categories",
          rows: [
            { label: "Diesel Fuel", value: `${formatPeso(kpiBreakdown.diesel)} (${sharePercent(kpiBreakdown.diesel, expTotal)})` },
            { label: "Highway Tolls", value: `${formatPeso(kpiBreakdown.toll)} (${sharePercent(kpiBreakdown.toll, expTotal)})` },
            { label: "Store Entry Fees", value: `${formatPeso(kpiBreakdown.entryFees)} (${sharePercent(kpiBreakdown.entryFees, expTotal)})` },
            { label: "Crew Compensation", value: `${formatPeso(kpiBreakdown.crewTotal)} (${sharePercent(kpiBreakdown.crewTotal, expTotal)})` },
            { label: "Other Expenses", value: `${formatPeso(kpiBreakdown.otherExpenses)} (${sharePercent(kpiBreakdown.otherExpenses, expTotal)})` },
          ],
        },
        {
          eyebrow: "CREW COMPENSATION",
          title: "Crew Compensation",
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
          title: "Net Profit Calculation",
          rows: [
            { label: "Profit Equation", value: "Revenue − Expenses" },
            { label: "Revenue (+)", value: formatPeso(summary.rateTotal), tone: "success" },
            { label: "Expenses (−)", value: formatPeso(summary.expenseTotal), tone: "warning" },
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
              label: "Profit Margin",
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
          title: "Revenue",
          statusLabel: formatPeso(summary.rateTotal),
          statusTone: "success" as const,
        };
      case "expenses":
        return {
          eyebrow: "METRIC BREAKDOWN & CALCULATION",
          title: "Expenses",
          statusLabel: formatPeso(summary.expenseTotal),
          statusTone: "warning" as const,
        };
      case "profit":
        return {
          eyebrow: "METRIC BREAKDOWN & CALCULATION",
          title: "Net Profit",
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
  const resetTableSort = () => setSort("delivery_date:desc");

  return (
    <>
      <OperationalTopbar
        contextLabel="Completed Deliveries & Multi-Store Trips"
        showDateFilter={false}
      />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <h1>Deliveries</h1>
            <p className="subtitle">
              Trip records, store drop-offs, and expense tracking.
            </p>
          </div>
          <div className="fleet-intro-actions">
            {canImport ? (
              <Link
                className="secondary-button page-intro-action"
                href="/deliveries/import"
                aria-label="Import an Excel trip report"
                data-tooltip="Import an Excel trip report"
                title="Import an Excel trip report"
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
                title="Record a completed delivery and its trip details"
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
            className={`stat-card is-interactive${activeKpi === "earnings" ? " is-active" : ""}`}
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
              {kpiBreakdown.financiallyCompleteCount} finalized {kpiBreakdown.financiallyCompleteCount === 1 ? "trip" : "trips"} · {summary.stopCount} drop-offs
            </span>
          </button>
          <button
            type="button"
            className={`stat-card is-interactive${activeKpi === "expenses" ? " is-active" : ""}`}
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
              Diesel, highway tolls, entry fees & crew compensation
            </span>
          </button>
          <button
            type="button"
            className={`stat-card is-interactive${activeKpi === "profit" ? " is-active" : ""}`}
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
              {kpiBreakdown.marginPercent !== null ? `${formatPercent(kpiBreakdown.marginPercent)} profit margin · ` : ""}For {kpiBreakdown.financiallyCompleteCount} finalized records
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
            <label className="search-box">
              <span className="sr-only">
                Search by waybill or truck plate number
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
                placeholder="Search by waybill or plate number…"
                aria-label="Search deliveries by waybill or plate number"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
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

            {searchQuery ||
            selectedClients.length > 0 ||
            selectedTrucks.length > 0 ||
            range.startDate ||
            range.endDate ? (
              <button
                type="button"
                className="filter-button filter-clear"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedClients([]);
                  setSelectedTrucks([]);
                  setRange({ startDate: null, endDate: null });
                }}
              >
                Clear filters
              </button>
            ) : null}

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
          ) : loading ? (
            <div className="empty-state" role="status">
              <strong>Loading delivery ledger…</strong>
              <span>Applying the active client, date, truck, and document filters.</span>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="empty-state" title="No delivery records match the current filter criteria or date range">
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
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeliveries.map((trip) => {
                    const isIncomplete = isDeliveryIncomplete(trip);
                    const isFinanciallyIncomplete = !isDeliveryFinanciallyComplete(trip);
                    return (
                      <tr
                        key={trip.id}
                        className={`record-row ${isIncomplete ? "is-incomplete" : ""}`}
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
                        <td className="cell-waybill">
                          <div className="waybill-badge-stack">
                            <strong className="waybill-code">#{trip.waybillNumber}</strong>
                          </div>
                        </td>
                      <td className="cell-date">
                        <span className="date-main">{trip.deliveryDate}</span>
                      </td>
                      <td className="cell-client">
                        <span className="client-name-label">{trip.clientName}</span>
                      </td>
                      <td className="truck-code cell-truck">
                        <div className="truck-info-stack">
                          <span className="truck-plate-label">{trip.plateNumber}</span>
                          <span className="truck-type-meta">{trip.truckType}</span>
                          <span className={`truck-ownership-label ${trip.truckOwnership.toLowerCase()}`}>
                            {trip.truckOwnership}
                          </span>
                        </div>
                      </td>
                      <td className="cell-temp">
                        <span className="temp-value">{trip.truckTemperature}</span>
                      </td>
                      <td className="cell-origin">
                        <span className="origin-name">{trip.origin}</span>
                      </td>
                      <td className="cell-stores">
                        <div
                          className="stores-cell-wrap"
                          title={trip.dropoffs.map((d) => `#${d.sequence} ${d.storeName} (${d.destinationArea})`).join("\n")}
                        >
                          <span className="dropoff-count-badge">
                            {trip.dropoffs.length} {trip.dropoffs.length === 1 ? "store" : "stores"}
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
                      </td>
                      <td className="cell-distance">{trip.distanceKm} km</td>
                      <td className="money cell-delivery-rate">{formatPeso(trip.deliveryRate)}</td>
                      <td className="cell-expenses">
                        {isFinanciallyIncomplete || trip.totalExpenses == null ? (
                          <span
                            className="profit-amount warning"
                            title={`Trip expenses incomplete: ${trip.financialIntegrityIssues.join(", ") || "Incomplete trip expenses"}`}
                          >
                            Incomplete
                          </span>
                        ) : (
                          formatPeso(trip.totalExpenses)
                        )}
                      </td>
                      <td className="money cell-net-income">
                        <div className="profit-stack">
                          {isFinanciallyIncomplete || trip.netIncome == null ? (
                            <span
                              className="profit-amount warning"
                              title="Net profit calculation requires all trip expenses to be recorded"
                            >
                              Incomplete
                            </span>
                          ) : (
                            <>
                              <span className={`profit-amount ${trip.netIncome != null && trip.netIncome >= 0 ? "positive" : "warning"}`}>
                                {formatPeso(trip.netIncome)}
                              </span>
                              {trip.marginPercent !== null ? (
                                <span
                                  className={`margin-pill ${trip.marginPercent >= 20 ? "good" : trip.marginPercent >= 0 ? "mod" : "low"}`}
                                  title={`Profit margin: ${formatPercent(trip.marginPercent)}`}
                                >
                                  {formatPercent(trip.marginPercent)}
                                </span>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          )}

          <TablePagination
            page={page}
            pageCount={filteredPageCount}
            totalItems={filteredDeliveries.length}
            pageSize={10}
            onPageChange={setPage}
            loading={loading}
            itemLabel="deliveries"
            itemCountInPage={paginatedDeliveries.length}
          />
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
      />

      {correctingTrip ? (
        <div className="routex-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="correction-dialog-title">
          <div className="routex-dialog-backdrop" onClick={closeCorrectionModal} />
          <div className="routex-dialog edit-delivery-dialog">
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
                title="Close dialog (Esc)"
              >
                ×
              </button>
            </header>

            <form
              onSubmit={submitCorrection}
              style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}
            >
              <div className="routex-dialog-body" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {correctionError ? (
                  <div className="delivery-form-alert" role="alert">
                    {correctionError}
                  </div>
                ) : null}

                {/* Revenue */}
                <div className="delivery-rate-banner">
                  <div className="delivery-rate-banner-header">
                    <h3 className="delivery-finance-group-title">Revenue</h3>
                  </div>
                  <div className="delivery-rate-input-row">
                    <label htmlFor="corr-rate" className="field-label-text">
                      Revenue (₱)
                    </label>
                    <div className="peso-input-wrap">
                      <span className="peso-prefix" aria-hidden="true">₱</span>
                      <input
                        id="corr-rate"
                        type="text"
                        inputMode="decimal"
                        required
                        className="no-spin-stepper peso-input"
                        placeholder="0.00"
                        value={correctionDeliveryRate}
                        onKeyDown={handlePositiveDecimalKeyDown}
                        onChange={(e) => setCorrectionDeliveryRate(sanitizePositiveDecimalInput(e.target.value, 2))}
                      />
                    </div>
                  </div>
                </div>

                {/* Route & Store Drop-offs */}
                <div className="routex-dialog-section">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <h3 className="delivery-finance-group-title" style={{ margin: 0 }}>Route &amp; Store Drop-offs</h3>
                      <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "var(--color-text-muted)" }}>
                        Drop-offs and store entry fees.
                      </p>
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-accent-deep)" }}>
                      Total Entry Fees: {correctionEntryFeeSummary}
                    </span>
                  </div>

                  <div className="dropoff-editor">
                    {correctionDropoffs.map((dropoff, index) => (
                      <div key={dropoff.id} className="dropoff-row">
                        <div className="dropoff-row-header">
                          <span className="dropoff-row-title">Store Drop-off #{index + 1}</span>
                          {correctionDropoffs.length > 1 ? (
                            <button
                              type="button"
                              className="dropoff-remove"
                              onClick={() => removeCorrectionDropoff(index)}
                              title="Remove this drop-off stop"
                            >
                              × Remove
                            </button>
                          ) : null}
                        </div>
                        <div className="dropoff-fields">
                          <div className="dropoff-field">
                            <label htmlFor={`corr-dropoff-store-${index}`} className="field-label-text">
                              Store Name
                            </label>
                            <input
                              id={`corr-dropoff-store-${index}`}
                              type="text"
                              required
                              placeholder="e.g. Wilcon Depot - Las Piñas"
                              value={dropoff.storeName}
                              onChange={(e) => updateCorrectionDropoff(index, "storeName", e.target.value)}
                            />
                          </div>
                          <div className="dropoff-field">
                            <label htmlFor={`corr-dropoff-dest-${index}`} className="field-label-text">
                              Destination / Area
                            </label>
                            <input
                              id={`corr-dropoff-dest-${index}`}
                              type="text"
                              required
                              placeholder="e.g. Almanza Uno, Las Piñas"
                              value={dropoff.destinationArea}
                              onChange={(e) => updateCorrectionDropoff(index, "destinationArea", e.target.value)}
                            />
                          </div>
                          <div className="dropoff-field dropoff-entry-fee-wrap">
                            <DialogExpenseField
                              id={`corr-dropoff-fee-${index}`}
                              label="Entry Fee / Toll"
                              value={dropoff.entryFee}
                              status={dropoff.entryFeeStatus}
                              onValueChange={(val) => updateCorrectionDropoff(index, "entryFee", val)}
                              onStatusChange={(st) => updateCorrectionDropoff(index, "entryFeeStatus", st)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="dropoff-actions-bar" style={{ marginTop: "12px" }}>
                    <button
                      type="button"
                      className="button-tertiary add-dropoff"
                      title="Add a new store drop-off point to this route"
                      onClick={addCorrectionDropoff}
                    >
                      + Add Store Drop-off
                    </button>
                    <span className="dropoff-counter">
                      {correctionDropoffs.length} {correctionDropoffs.length === 1 ? "store drop-off" : "store drop-offs"}
                    </span>
                  </div>
                </div>

                {/* Trip Expenses */}
                <div className="routex-dialog-section">
                  <h3 className="delivery-finance-group-title">Trip Expenses</h3>
                  <div className="routex-dialog-grid-2">
                    <DialogExpenseField
                      id="corr-diesel"
                      label="Diesel"
                      value={correctionExpenses.dieselExpenses ?? ""}
                      status={correctionStatuses.dieselExpenses ?? "confirmed"}
                      onValueChange={(val) => setCorrectionExpenses((prev) => ({ ...prev, dieselExpenses: val }))}
                      onStatusChange={(st) => {
                        setCorrectionStatuses((prev) => ({ ...prev, dieselExpenses: st }));
                        if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, dieselExpenses: "" }));
                      }}
                    />
                    <DialogExpenseField
                      id="corr-toll"
                      label="Highway tolls"
                      value={correctionExpenses.tollGateExpenses ?? ""}
                      status={correctionStatuses.tollGateExpenses ?? "confirmed"}
                      onValueChange={(val) => setCorrectionExpenses((prev) => ({ ...prev, tollGateExpenses: val }))}
                      onStatusChange={(st) => {
                        setCorrectionStatuses((prev) => ({ ...prev, tollGateExpenses: st }));
                        if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, tollGateExpenses: "" }));
                      }}
                    />
                  </div>
                </div>

                {/* Crew Rates & Allowances */}
                <div className="routex-dialog-section">
                  <h3 className="delivery-finance-group-title">Crew Rates & Allowances</h3>
                  <div className="crew-cards-grid">
                    {/* Driver Card */}
                    <section className="crew-expense-group">
                      <div className="crew-card-title-row">
                        <span className="crew-role-pill driver">Driver</span>
                        <RoundedSelect
                          value={correctionDriverName}
                          options={drivers.map((driver) => ({
                            value: driver.label,
                            label: driver.label,
                          }))}
                          onChange={(val) => setCorrectionDriverName(sanitizePersonNameInput(val))}
                          inputFilter={sanitizePersonNameInput}
                          ariaLabel="Driver name"
                          className="crew-name-select"
                          placeholder="Select or add driver"
                          emptyMessage="No saved drivers"
                          searchable
                          allowCustomValue
                          searchPlaceholder="Search or enter a new driver"
                        />
                      </div>
                      <div className="routex-dialog-grid-2">
                        <DialogExpenseField
                          id="corr-driver-rate"
                          label="Daily rate"
                          value={correctionExpenses.driverDailyRate ?? ""}
                          status={correctionStatuses.driverDailyRate ?? "confirmed"}
                          onValueChange={(val) => setCorrectionExpenses((prev) => ({ ...prev, driverDailyRate: val }))}
                          onStatusChange={(st) => {
                            setCorrectionStatuses((prev) => ({ ...prev, driverDailyRate: st }));
                            if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, driverDailyRate: "" }));
                          }}
                        />
                        <DialogExpenseField
                          id="corr-driver-allow"
                          label="Allowance"
                          value={correctionExpenses.driverAllowance ?? ""}
                          status={correctionStatuses.driverAllowance ?? "confirmed"}
                          onValueChange={(val) => setCorrectionExpenses((prev) => ({ ...prev, driverAllowance: val }))}
                          onStatusChange={(st) => {
                            setCorrectionStatuses((prev) => ({ ...prev, driverAllowance: st }));
                            if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, driverAllowance: "" }));
                          }}
                        />
                      </div>
                    </section>

                    {/* Helper Card */}
                    <section className="crew-expense-group">
                      <div className="crew-card-title-row">
                        <span className="crew-role-pill helper">Helper</span>
                        <RoundedSelect
                          value={correctionHelperName}
                          options={helpers.map((helper) => ({
                            value: helper.label,
                            label: helper.label,
                          }))}
                          onChange={(val) => setCorrectionHelperName(sanitizePersonNameInput(val))}
                          inputFilter={sanitizePersonNameInput}
                          ariaLabel="Helper name"
                          className="crew-name-select"
                          placeholder="Select or add helper"
                          emptyMessage="No saved helpers"
                          searchable
                          allowCustomValue
                          searchPlaceholder="Search or enter a new helper"
                        />
                      </div>
                      <div className="routex-dialog-grid-2">
                        <DialogExpenseField
                          id="corr-helper-rate"
                          label="Daily rate"
                          value={correctionExpenses.helperDailyRate ?? ""}
                          status={correctionStatuses.helperDailyRate ?? "confirmed"}
                          onValueChange={(val) => setCorrectionExpenses((prev) => ({ ...prev, helperDailyRate: val }))}
                          onStatusChange={(st) => {
                            setCorrectionStatuses((prev) => ({ ...prev, helperDailyRate: st }));
                            if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, helperDailyRate: "" }));
                          }}
                        />
                        <DialogExpenseField
                          id="corr-helper-allow"
                          label="Allowance"
                          value={correctionExpenses.helperAllowance ?? ""}
                          status={correctionStatuses.helperAllowance ?? "confirmed"}
                          onValueChange={(val) => setCorrectionExpenses((prev) => ({ ...prev, helperAllowance: val }))}
                          onStatusChange={(st) => {
                            setCorrectionStatuses((prev) => ({ ...prev, helperAllowance: st }));
                            if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, helperAllowance: "" }));
                          }}
                        />
                      </div>
                    </section>
                  </div>
                </div>

                {/* Other Expenses */}
                <div className="routex-dialog-section">
                  <h3 className="delivery-finance-group-title">Other Expenses</h3>
                  <DialogExpenseField
                    id="corr-other"
                    label="Other expenses"
                    value={correctionExpenses.otherExpenses ?? ""}
                    status={correctionStatuses.otherExpenses ?? "confirmed"}
                    onValueChange={(val) => setCorrectionExpenses((prev) => ({ ...prev, otherExpenses: val }))}
                    onStatusChange={(st) => {
                      setCorrectionStatuses((prev) => ({ ...prev, otherExpenses: st }));
                      if (st !== "confirmed") setCorrectionExpenses((prev) => ({ ...prev, otherExpenses: "" }));
                    }}
                  />
                </div>

                {/* Supporting Documents */}
                <div className="routex-dialog-section">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                    <h3 className="delivery-finance-group-title" style={{ margin: 0 }}>Supporting Documents</h3>
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Receiving slips, invoices, or attachments</span>
                  </div>

                  {correctionExistingSupportingDocs.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                      {correctionExistingSupportingDocs.map((docName, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "5px 10px",
                            background: "var(--color-surface-subtle, #f3f4f6)",
                            border: "1px solid var(--line, #e5e7eb)",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "var(--color-text-primary)",
                          }}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ flexShrink: 0 }}
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <strong>{docName}</strong>
                          <button
                            type="button"
                            title={`Remove ${docName}`}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "#dc2626",
                              fontSize: "15px",
                              lineHeight: 1,
                              padding: "0 2px",
                            }}
                            onClick={() => {
                              setCorrectionExistingSupportingDocs((prev) => prev.filter((_, i) => i !== idx));
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {correctionSupportingFiles.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                      {correctionSupportingFiles.map((file, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "5px 10px",
                            background: "rgba(224, 86, 36, 0.08)",
                            border: "1px solid rgba(224, 86, 36, 0.25)",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "var(--color-brand, #e05624)",
                          }}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ flexShrink: 0 }}
                          >
                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                          <strong>{file.name}</strong>
                          <small style={{ color: "var(--color-text-muted)" }}>({(file.size / 1024).toFixed(1)} KB)</small>
                          <button
                            type="button"
                            title={`Remove ${file.name}`}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "#dc2626",
                              fontSize: "15px",
                              lineHeight: 1,
                              padding: "0 2px",
                            }}
                            onClick={() => {
                              setCorrectionSupportingFiles((prev) => prev.filter((_, i) => i !== idx));
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label
                      htmlFor="corr-supporting-files"
                      className="secondary-button"
                      style={{
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 13px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      <span>+ Add Supporting Document</span>
                      <input
                        id="corr-supporting-files"
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const selected = Array.from(e.target.files ?? []);
                          if (selected.length > 0) {
                            setCorrectionSupportingFiles((prev) => [...prev, ...selected]);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                      PDF, PNG, or JPG up to 10 MB
                    </span>
                  </div>
                </div>

                {/* Correction Reason */}
                <div className="routex-dialog-section">
                  <label htmlFor="corr-reason" className="field-label-text">
                    Correction Reason <span className="field-required-tag">(Required for audit history · min 5 chars)</span>
                  </label>
                  <textarea
                    id="corr-reason"
                    rows={3}
                    required
                    className="correction-reason-textarea"
                    placeholder="e.g. Fuel receipt adjustment after monthly reconciliation"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                  />
                </div>
              </div>

              <footer className="routex-dialog-footer" style={{ flexShrink: 0 }}>
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
                  {correctionSubmitting ? "Saving changes…" : "Save changes"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDeliveryDeletionDialog
        delivery={deliveryToDelete}
        pending={isDeletingDelivery}
        error={deleteDeliveryError}
        onCancel={closeDeleteDeliveryModal}
        onConfirm={handleConfirmDeleteDelivery}
      />
    </>
  );
}

function DialogExpenseField({
  id,
  label,
  value,
  status,
  onValueChange,
  onStatusChange,
}: {
  id?: string;
  label: string;
  value: string;
  status: "confirmed" | "not_applicable" | "unknown";
  onValueChange: (val: string) => void;
  onStatusChange: (st: "confirmed" | "not_applicable" | "unknown") => void;
}) {
  const displayLabel = label.includes("₱") ? label : `${label} (₱)`;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleWrapperClick = () => {
    if (status !== "confirmed") {
      onStatusChange("confirmed");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <div className="expense-resolution-field">
      <label htmlFor={id} className="field-label-text">{displayLabel}</label>
      <div className="expense-resolution-controls">
        <span
          className={`peso-input-wrap ${status !== "confirmed" ? "is-disabled" : ""}`}
          onClick={handleWrapperClick}
          style={status !== "confirmed" ? { cursor: "pointer" } : undefined}
          title={status !== "confirmed" ? "Click to enter amount" : undefined}
        >
          {status === "confirmed" ? <span className="peso-prefix" aria-hidden="true">₱</span> : null}
          <input
            ref={inputRef}
            id={id}
            aria-label={`${displayLabel} amount`}
            disabled={status !== "confirmed"}
            type="text"
            inputMode="decimal"
            className={`no-spin-stepper ${status === "confirmed" ? "peso-input" : ""}`}
            value={status === "confirmed" ? value : ""}
            placeholder={status === "confirmed" ? "0.00" : status === "unknown" ? "Amount unknown (click to enter)" : "N/A (click to enter)"}
            onKeyDown={handlePositiveDecimalKeyDown}
            onChange={(e) => onValueChange(sanitizePositiveDecimalInput(e.target.value, 2))}
          />
        </span>
        <div className="expense-resolution-options" role="group" aria-label={`${displayLabel} resolution`}>
          {([
            ["confirmed", "Amount"],
            ["not_applicable", "N/A"],
            ["unknown", "Unknown"],
          ] as const).map(([val, text]) => (
            <button
              type="button"
              key={val}
              className={status === val ? "active" : ""}
              aria-pressed={status === val}
              onClick={() => {
                onStatusChange(val);
                if (val !== "confirmed") onValueChange("");
              }}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

