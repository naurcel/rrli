"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuthenticatedActor } from "@/components/auth-context";
import { RoundedSelect, type SelectOption } from "@/components/rounded-select";
import { SingleDatePicker } from "@/components/single-date-picker";
import { NumberStepper } from "@/components/number-stepper";
import { OperationalTopbar } from "@/components/operational-topbar";
import type { DeliveryFilterOption } from "@/features/deliveries/server/delivery-repository";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  BROWSER_PREVIEW_DELIVERIES_CHANGED,
  readBrowserPreviewDeliveries,
  upsertBrowserPreviewDelivery,
} from "@/features/deliveries/browser-preview-deliveries";
import { readBrowserPreviewTrucks } from "@/features/deliveries/browser-preview-trucks";
import {
  BASE_HELPERS,
  checkCrewDateAvailability,
  formatCrewMemberOptionLabel,
  getFleetCrew,
  isCrewMemberEligibleForNewDelivery,
  type FleetCrewMember,
} from "@/features/deliveries/driver-registry";
import { getFleetTrucks } from "@/features/deliveries/truck-registry";
import {
  calculateProfitMargin,
  derivePodVerificationStatus,
  type ExpenseResolutionStatus,
} from "@/features/deliveries/delivery-domain";
import { getDeliveryDateWindow } from "@/features/deliveries/delivery-date-policy";
import { BackdatingTicketsModal } from "@/components/backdating-tickets-modal";
import {
  handlePositiveDecimalKeyDown,
  handleSignedDecimalKeyDown,
  sanitizePersonNameInput,
  sanitizePositiveDecimalInput,
  sanitizeSignedDecimalInput,
} from "@/features/deliveries/delivery-input-utils";
import { formatPeso } from "@/lib/format";
import {
  appendQueryParam,
  isValidInternalReturnPath,
  resolveReturnTarget,
  withReturnContext,
} from "@/lib/navigation/return-context";

type DropoffDraft = {
  id: string;
  storeName: string;
  destinationArea: string;
  dropoffCount: string;
  entryFee: string;
  entryFeeStatus: ExpenseResolutionStatus;
  podSubmitted?: boolean;
  supportingDocsComplete?: boolean;
  documentRef?: string;
  podFile?: File | null;
};

type ReferenceData = {
  clients: DeliveryFilterOption[];
  trucks: DeliveryFilterOption[];
  drivers: DeliveryFilterOption[];
  helpers: DeliveryFilterOption[];
};

type ExpenseFormKey =
  | "dieselExpenses"
  | "tollGateExpenses"
  | "driverAllowance"
  | "driverDailyRate"
  | "helperAllowance"
  | "helperDailyRate"
  | "helper2Allowance"
  | "helper2DailyRate"
  | "otherExpenses";

const STOP_ORDINALS = [
  "First Stop",
  "Second Stop",
  "Third Stop",
  "Fourth Stop",
  "Fifth Stop",
  "Sixth Stop",
  "Seventh Stop",
  "Eighth Stop",
  "Ninth Stop",
  "Tenth Stop",
];

function getStopLabel(index: number): string {
  return STOP_ORDINALS[index] ?? `Stop #${index + 1}`;
}

const initialDropoff: DropoffDraft = {
  id: "dropoff-1",
  storeName: "",
  destinationArea: "",
  dropoffCount: "1",
  entryFee: "",
  entryFeeStatus: "confirmed",
  podSubmitted: false,
  documentRef: "",
  podFile: null,
};

function numberValue(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function todayKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export default function NewCompletedDeliveryPage({ editDeliveryId: propEditDeliveryId }: { editDeliveryId?: string } = {}) {
  const router = useRouter();
  const actor = useAuthenticatedActor();
  const isAdmin =
    actor.role === "admin" ||
    Boolean(actor.isSuperadmin) ||
    Boolean(actor.roles?.includes("admin"));
  const deliveryDateWindow = useMemo(() => getDeliveryDateWindow(), []);
  const [references, setReferences] = useState<ReferenceData>({ clients: [], trucks: [], drivers: [], helpers: [] });
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const idempotencyKeyRef = useRef("");
  const [clientName, setClientName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [supportingFileLinks, setSupportingFileLinks] = useState<Record<string, string>>({});
  const [truckTemperature, setTruckTemperature] = useState("");
  const [dropoffs, setDropoffs] = useState<DropoffDraft[]>([initialDropoff]);
  const [resolvedEditId, setResolvedEditId] = useState<string | undefined>(propEditDeliveryId);
  const [existingDelivery, setExistingDelivery] = useState<DeliveryLedgerItem | null>(null);
  const isEditMode = Boolean(resolvedEditId || propEditDeliveryId || existingDelivery);
  const [editReason, setEditReason] = useState("");
  const [draggedStopIndex, setDraggedStopIndex] = useState<number | null>(null);
  const [returnToParam, setReturnToParam] = useState<string | null>(null);
  const [returnLabelParam, setReturnLabelParam] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const rt = searchParams.get("returnTo");
      const rl = searchParams.get("returnLabel");
      if (rt && isValidInternalReturnPath(rt)) {
        setReturnToParam(rt);
        setReturnLabelParam(rl);
      }
      if (!propEditDeliveryId) {
        const q = searchParams.get("edit");
        if (q) setResolvedEditId(q);
      }
    }
    if (propEditDeliveryId) {
      setResolvedEditId(propEditDeliveryId);
    }
  }, [propEditDeliveryId]);

  const backTarget = useMemo(
    () =>
      resolveReturnTarget({
        returnTo: returnToParam,
        returnLabel: returnLabelParam,
        fallbackHref:
          isEditMode && resolvedEditId
            ? `/deliveries/${encodeURIComponent(resolvedEditId)}`
            : "/deliveries",
        fallbackLabel: isEditMode
          ? existingDelivery?.waybillNumber
            ? `Back to Waybill #${existingDelivery.waybillNumber}`
            : "Back to delivery"
          : "Back to deliveries",
      }),
    [returnToParam, returnLabelParam, isEditMode, resolvedEditId, existingDelivery?.waybillNumber],
  );

  useEffect(() => {
    if (!resolvedEditId) return;
    let decodedEditId = resolvedEditId;
    try {
      decodedEditId = decodeURIComponent(resolvedEditId);
    } catch {
      decodedEditId = resolvedEditId;
    }

    function applyDelivery(del: DeliveryLedgerItem) {
      setExistingDelivery(del);
      setValues({
        waybillNumber: del.waybillNumber ?? "",
        deliveryDate: del.deliveryDate ? del.deliveryDate.substring(0, 10) : todayKey(),
        origin: del.origin ?? "",
        distanceKm: del.distanceKm != null ? String(del.distanceKm) : "",
        fuelRate: del.fuelRate != null ? String(del.fuelRate) : "",
        deliveryRate: del.deliveryRate != null ? String(del.deliveryRate) : "",
        additionalCharges: (del as unknown as Record<string, unknown>).additionalCharges != null ? String((del as unknown as Record<string, unknown>).additionalCharges) : "",
        dieselExpenses: del.expenses.dieselExpenses != null ? String(del.expenses.dieselExpenses) : "",
        tollGateExpenses: del.expenses.tollGateExpenses != null ? String(del.expenses.tollGateExpenses) : "",
        tollGateBreakdown: del.expenses.tollGateBreakdown ?? "",
        driverAllowance: del.expenses.driverAllowance != null ? String(del.expenses.driverAllowance) : "",
        driverDailyRate: del.expenses.driverDailyRate != null ? String(del.expenses.driverDailyRate) : "",
        helperAllowance: del.expenses.helperAllowance != null ? String(del.expenses.helperAllowance) : "",
        helperDailyRate: del.expenses.helperDailyRate != null ? String(del.expenses.helperDailyRate) : "",
        helper2Allowance: (del.expenses as unknown as Record<string, unknown>).helper2Allowance != null ? String((del.expenses as unknown as Record<string, unknown>).helper2Allowance) : "",
        helper2DailyRate: (del.expenses as unknown as Record<string, unknown>).helper2DailyRate != null ? String((del.expenses as unknown as Record<string, unknown>).helper2DailyRate) : "",
        otherExpenses: del.expenses.otherExpenses != null ? String(del.expenses.otherExpenses) : "0",
        notes: del.notes ?? "",
      });
      setClientName(del.clientName ?? "");
      setPlateNumber(del.plateNumber ?? "");
      setTruckTemperature(del.truckTemperature ? String(del.truckTemperature).replace("°C", "") : "");
      setDriverName(del.driverName ?? "");

      const rawHelperParts = (del.helperName ?? "")
        .split(/[,/&]/)
        .map((part) => part.trim())
        .filter(Boolean);
      const explicitHelper2 = (del as unknown as Record<string, unknown>).helper2Name
        ? String((del as unknown as Record<string, unknown>).helper2Name)
        : rawHelperParts[1] ?? "";
      const hasH2 = Boolean(
        (del.expenses as unknown as Record<string, unknown>).helper2DailyRate != null ||
          explicitHelper2,
      );
      setHasSecondHelper(hasH2);
      setHelper1Name(rawHelperParts[0] ?? del.helperName ?? "");
      setHelper2Name(explicitHelper2);

      if (del.expenseStates) {
        setExpenseStatuses((prev) => ({
          ...prev,
          ...del.expenseStates,
          otherExpenses: del.expenseStates.otherExpenses === "unknown" ? "unknown" : "confirmed",
        }));
      }

      if (del.dropoffs && del.dropoffs.length > 0) {
        setDropoffs(
          del.dropoffs.map((d) => ({
            id: d.id,
            storeName: d.storeName,
            destinationArea: d.destinationArea,
            dropoffCount: d.dropoffCount != null ? String(d.dropoffCount) : "1",
            entryFee: d.entryFee != null ? String(d.entryFee) : "",
            entryFeeStatus: d.entryFeeStatus ?? (d.entryFee != null ? "confirmed" : "not_applicable"),
            podSubmitted: d.podSubmitted,
            supportingDocsComplete: d.supportingDocsComplete,
            documentRef: d.documentRef,
            podFile: null,
          }))
        );
      }
      setEditReason((prev) => (prev.trim().length >= 5 ? prev : "Operational details update"));
    }

    const cleanId = (decodedEditId || "").replace(/^#/, "").trim().toLowerCase();
    const matchDelivery = (d: DeliveryLedgerItem) =>
      d.id.toLowerCase() === cleanId ||
      d.id.toLowerCase() === (decodedEditId || "").toLowerCase() ||
      Boolean(d.waybillNumber && d.waybillNumber.replace(/^#/, "").trim().toLowerCase() === cleanId);

    const local = readBrowserPreviewDeliveries().find(matchDelivery);
    if (local) {
      applyDelivery(local);
      return;
    }

    fetch(`/api/deliveries?page=1&pageSize=100&q=${encodeURIComponent(cleanId)}`)
      .then((res) => res.json())
      .then((data) => {
        const list = (data.items ?? data.deliveries ?? []) as DeliveryLedgerItem[];
        const found = list.find(matchDelivery);
        if (found) {
          applyDelivery(found);
        } else {
          fetch("/api/deliveries?page=1&pageSize=100")
            .then((res) => res.json())
            .then((allData) => {
              const allList = (allData.items ?? allData.deliveries ?? []) as DeliveryLedgerItem[];
              const broadFound = allList.find(matchDelivery);
              if (broadFound) {
                applyDelivery(broadFound);
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => console.error("Error loading delivery for edit:", err));
  }, [resolvedEditId]);

  // Delivery crew state with support for up to 2 helpers
  const [hasSecondHelper, setHasSecondHelper] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [helper1Name, setHelper1Name] = useState("");
  const [helper2Name, setHelper2Name] = useState("");

  const [expenseStatuses, setExpenseStatuses] = useState<Record<ExpenseFormKey, ExpenseResolutionStatus>>({
    dieselExpenses: "confirmed",
    tollGateExpenses: "confirmed",
    driverAllowance: "confirmed",
    driverDailyRate: "confirmed",
    helperAllowance: "confirmed",
    helperDailyRate: "confirmed",
    helper2Allowance: "confirmed",
    helper2DailyRate: "confirmed",
    otherExpenses: "confirmed",
  });

  const [values, setValues] = useState({
    waybillNumber: "",
    deliveryDate: todayKey(),
    origin: "",
    distanceKm: "",
    fuelRate: "",
    deliveryRate: "",
    additionalCharges: "",
    dieselExpenses: "",
    tollGateExpenses: "",
    tollGateBreakdown: "",
    driverAllowance: "",
    driverDailyRate: "",
    helperAllowance: "",
    helperDailyRate: "",
    helper2Allowance: "",
    helper2DailyRate: "",
    otherExpenses: "",
    notes: "",
  });

  const [backdatingModalOpen, setBackdatingModalOpen] = useState(false);
  const [approvedTicket, setApprovedTicket] = useState<{ id: string; waybillNumber: string; deliveryDate: string } | null>(null);
  const isOlderThanWindow = !isAdmin && !isEditMode && values.deliveryDate < deliveryDateWindow.min;

  useEffect(() => {
    if (!isOlderThanWindow || !values.waybillNumber.trim() || !values.deliveryDate) {
      if (!isOlderThanWindow) {
        setApprovedTicket(null);
      }
      return;
    }
    let cancelled = false;
    async function checkTicket() {
      try {
        const res = await fetch(
          `/api/deliveries/backdating-tickets?status=approved&waybillNumber=${encodeURIComponent(
            values.waybillNumber.trim().toUpperCase()
          )}`
        );
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.ok && Array.isArray(data.tickets)) {
          const match = data.tickets.find(
            (t: any) => t.deliveryDate === values.deliveryDate && t.status === "approved"
          );
          if (match) {
            setApprovedTicket(match);
          } else {
            setApprovedTicket(null);
          }
        }
      } catch {
        // ignore
      }
    }
    checkTicket();
    return () => {
      cancelled = true;
    };
  }, [isOlderThanWindow, values.waybillNumber, values.deliveryDate]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/deliveries?page=1&pageSize=10", { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json().catch(() => null)) as {
            ok?: boolean;
            filters?: ReferenceData;
          } | null;
        })
        .catch(() => null),
      fetch("/api/drivers", { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json().catch(() => null)) as {
            ok?: boolean;
            crew?: FleetCrewMember[];
            drivers?: FleetCrewMember[];
          } | null;
        })
        .catch(() => null),
    ]).then(([delivPayload, driversPayload]) => {
      const nextReferences = delivPayload?.filters ?? { clients: [], trucks: [], drivers: [], helpers: [] };
      const apiCrew: FleetCrewMember[] = Array.isArray(driversPayload?.crew)
        ? driversPayload.crew
        : Array.isArray(driversPayload?.drivers)
        ? driversPayload.drivers
        : [];

      // Merge custom clients from localStorage
      let storedCustomClients: DeliveryFilterOption[] = [];
      try {
        const raw = localStorage.getItem("routex_custom_clients");
        if (raw) storedCustomClients = JSON.parse(raw);
      } catch {}

      // Merge custom clients from locally recorded deliveries and localStorage
      const localDeliveries = readBrowserPreviewDeliveries();
      const existingClientNames = new Set(nextReferences.clients.map((c) => c.label.toLowerCase()));
      const extraClients: DeliveryFilterOption[] = [];
      for (const c of storedCustomClients) {
        if (c.label && !existingClientNames.has(c.label.toLowerCase())) {
          existingClientNames.add(c.label.toLowerCase());
          extraClients.push(c);
        }
      }
      for (const delivery of localDeliveries) {
        if (delivery.clientName && !existingClientNames.has(delivery.clientName.toLowerCase())) {
          existingClientNames.add(delivery.clientName.toLowerCase());
          extraClients.push({
            id: delivery.clientId || `client-${delivery.clientName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
            label: delivery.clientName,
          });
        }
      }
      const mergedClients = [...nextReferences.clients, ...extraClients];

      const localTrucks = readBrowserPreviewTrucks().map((t) => ({
        id: t.id,
        label: t.plateNumber,
        ownershipType: t.ownershipType,
      }));
      const existingPlates = new Set(nextReferences.trucks.map((t) => t.label.toUpperCase()));
      const mergedTrucks = [
        ...nextReferences.trucks,
        ...localTrucks.filter((t) => !existingPlates.has(t.label.toUpperCase())),
      ];

      // Merge drivers from API crew, remote delivery filters, and local deliveries
      const driverNames = new Set<string>();
      const combinedDrivers: DeliveryFilterOption[] = [];

      const addDriverIfValid = (name: string, id?: string) => {
        const clean = name.trim();
        const lower = clean.toLowerCase();
        if (!clean || lower.includes("unknown") || driverNames.has(lower)) return;
        driverNames.add(lower);
        combinedDrivers.push({
          id: id || `driver-${lower.replace(/[^a-z0-9]+/g, "-")}`,
          label: clean,
        });
      };

      for (const d of nextReferences.drivers ?? []) addDriverIfValid(d.label, d.id);
      for (const c of apiCrew) {
        if (c.assignmentType === "Driver" && c.isActive !== false) {
          addDriverIfValid(c.fullName, c.id);
        }
      }
      for (const d of localDeliveries) {
        if (d.driverName) addDriverIfValid(d.driverName);
      }

      // Merge helpers from API crew, remote delivery filters, and local deliveries
      const helperNames = new Set<string>();
      const combinedHelpers: DeliveryFilterOption[] = [];

      const addHelperIfValid = (name: string, id?: string) => {
        const clean = name.trim();
        const lower = clean.toLowerCase();
        if (!clean || lower.includes("unknown") || helperNames.has(lower)) return;
        helperNames.add(lower);
        combinedHelpers.push({
          id: id || `helper-${lower.replace(/[^a-z0-9]+/g, "-")}`,
          label: clean,
        });
      };

      for (const h of nextReferences.helpers ?? []) addHelperIfValid(h.label, h.id);
      // All active crew members (helpers and drivers) can serve as helpers in delivery records
      for (const c of apiCrew) {
        if (c.isActive !== false) {
          addHelperIfValid(c.fullName, c.id);
        }
      }
      for (const del of localDeliveries) {
        if (del.helperName) {
          for (const piece of del.helperName.split(/[,/&]/).map((h) => h.trim())) {
            addHelperIfValid(piece);
          }
        }
      }

      const mergedReferences = {
        clients: mergedClients,
        trucks: mergedTrucks,
        drivers: combinedDrivers,
        helpers: combinedHelpers,
      };
      setReferences(mergedReferences);
      if (!isEditMode && !resolvedEditId && !propEditDeliveryId) {
        setClientName(mergedReferences.clients[0]?.label ?? "");
        setPlateNumber(mergedReferences.trucks[0]?.label ?? "");
      }
    })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setReferenceError(error instanceof Error ? error.message : "Unable to load reference data.");
      })
      .finally(() => setReferencesLoading(false));
    return () => controller.abort();
  }, []);

  function handleClientChange(val: string) {
    const trimmed = val.trim();
    if (!trimmed) {
      setClientName("");
      return;
    }
    setClientName(trimmed);
    const exists = references.clients.some(
      (c) => c.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!exists) {
      const newOption: DeliveryFilterOption = {
        id: `client-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: trimmed,
      };
      setReferences((prev) => ({
        ...prev,
        clients: [...prev.clients, newOption],
      }));
      try {
        const stored = JSON.parse(localStorage.getItem("routex_custom_clients") || "[]");
        if (!stored.some((c: { label: string }) => c.label.toLowerCase() === trimmed.toLowerCase())) {
          localStorage.setItem("routex_custom_clients", JSON.stringify([...stored, newOption]));
        }
      } catch {}
    }
  }

  const isSubcontracted = useMemo(() => {
    const rawPlate = plateNumber.trim().toUpperCase();
    if (!rawPlate) return false;
    const selected = references.trucks.find(
      (t) => t.label.toUpperCase() === rawPlate || t.id.toUpperCase() === rawPlate,
    );
    if (selected?.ownershipType) {
      return selected.ownershipType === "Subcontracted";
    }
    if (rawPlate.startsWith("SUB-") || rawPlate.includes("SUBCON")) {
      return true;
    }
    const fleet = getFleetTrucks().find(
      (t) => t.plateNumber.toUpperCase() === rawPlate || t.id.toUpperCase() === rawPlate,
    );
    if (fleet?.ownershipType) {
      return fleet.ownershipType === "Subcontracted";
    }
    if (existingDelivery?.truckOwnership) {
      return existingDelivery.truckOwnership === "Subcontracted";
    }
    return false;
  }, [plateNumber, references.trucks, existingDelivery?.truckOwnership]);

  const groupedTruckOptions = useMemo<SelectOption[]>(() => {
    const owned: SelectOption[] = [];
    const subcontracted: SelectOption[] = [];

    for (const truck of references.trucks) {
      const isSub =
        truck.ownershipType === "Subcontracted" ||
        truck.label.startsWith("SUB-") ||
        truck.label.includes("SUBCON");
      const option: SelectOption = {
        value: truck.label,
        label: truck.label,
        group: isSub ? "Subcontracted Trucks" : "Owned Trucks",
      };
      if (isSub) {
        subcontracted.push(option);
      } else {
        owned.push(option);
      }
    }

    return [...owned, ...subcontracted];
  }, [references.trucks]);

  const totalDropoffs = useMemo(() => {
    return dropoffs.reduce((sum, d) => sum + Math.max(1, parseInt(d.dropoffCount, 10) || 1), 0);
  }, [dropoffs]);

  const financialReview = useMemo(() => {
    // Live calculation of entry fees from all dropoffs
    const entryFees = dropoffs.reduce((sum, stop) => {
      const num = numberValue(stop.entryFee);
      return sum + (num != null ? num : 0);
    }, 0);

    // Active keys accounting for Helper 1 and conditionally Helper 2 without duplication
    const activeExpenseKeys: ExpenseFormKey[] = [
      "dieselExpenses",
      "tollGateExpenses",
      "driverAllowance",
      "driverDailyRate",
      "helperAllowance",
      "helperDailyRate",
      "otherExpenses",
    ];

    if (hasSecondHelper) {
      activeExpenseKeys.push("helper2Allowance", "helper2DailyRate");
    }

    // Live calculation of total expenses (including entryFees)
    const totalExpenses = activeExpenseKeys.reduce((sum, key) => {
      const num = numberValue(values[key]);
      return sum + (num != null ? num : 0);
    }, entryFees);

    const revenue = numberValue(values.deliveryRate);
    const netIncome = revenue == null ? null : revenue - totalExpenses;
    const marginPercent =
      revenue != null && revenue > 0 && netIncome != null
        ? (netIncome / revenue) * 100
        : null;

    return {
      entryFees,
      totalExpenses,
      netIncome,
      revenue,
      marginPercent,
      additionalCharges: numberValue(values.additionalCharges),
    };
  }, [dropoffs, hasSecondHelper, values]);

  const liveCompleteness = useMemo(() => {
    const issues: string[] = [];

    // Revenue
    const rev = numberValue(values.deliveryRate);
    if (rev == null || rev <= 0) {
      issues.push("Missing delivery rate");
    }

    // Driver & Driver Rate
    const dName = driverName.trim();
    if (!dName) {
      issues.push("No driver assigned");
    }
    if (!isSubcontracted) {
      const dRate = numberValue(values.driverDailyRate);
      if (dRate == null || dRate <= 0) {
        issues.push("Driver daily rate missing");
      }
      const dAllow = numberValue(values.driverAllowance);
      if (!values.driverAllowance.trim() || dAllow == null || dAllow < 0) {
        issues.push("Driver allowance missing");
      }
    }

    // Helper 1 & Helper 1 Rate / Allowance
    const h1Name = helper1Name.trim();
    if (!h1Name) {
      if (numberValue(values.helperDailyRate) || numberValue(values.helperAllowance)) {
        issues.push("No helper assigned");
      }
    }
    if (!isSubcontracted && h1Name) {
      const h1Rate = numberValue(values.helperDailyRate);
      if (h1Rate == null || h1Rate <= 0) {
        issues.push("Helper daily rate missing");
      }
      const h1Allow = numberValue(values.helperAllowance);
      if (!values.helperAllowance.trim() || h1Allow == null || h1Allow < 0) {
        issues.push("Helper allowance missing");
      }
    }

    // Helper 2 if enabled
    if (hasSecondHelper) {
      const h2Name = helper2Name.trim();
      if (!h2Name) {
        issues.push("Helper 2 name missing");
      }
      if (!isSubcontracted) {
        const h2Rate = numberValue(values.helper2DailyRate);
        if (h2Rate == null || h2Rate <= 0) {
          issues.push("Helper 2 daily rate missing");
        }
        const h2Allow = numberValue(values.helper2Allowance);
        if (!values.helper2Allowance.trim() || h2Allow == null || h2Allow < 0) {
          issues.push("Helper 2 allowance missing");
        }
      }
    }

    // Fuel expenses
    const dieselVal = numberValue(values.dieselExpenses);
    if (dieselVal == null || dieselVal < 0) {
      issues.push("Pending diesel expenses");
    }

    // Toll fees
    const tollVal = numberValue(values.tollGateExpenses);
    if (tollVal == null || tollVal < 0) {
      issues.push("Pending toll expenses");
    }

    // Note: Proof of Delivery (POD) is not required to record a daily trip.
    const isComplete = issues.length === 0;

    return {
      isComplete,
      issues,
      count: issues.length,
    };
  }, [
    values.deliveryRate,
    values.driverDailyRate,
    values.driverAllowance,
    values.helperDailyRate,
    values.helperAllowance,
    values.helper2DailyRate,
    values.helper2Allowance,
    values.dieselExpenses,
    values.tollGateExpenses,
    driverName,
    helper1Name,
    helper2Name,
    hasSecondHelper,
    dropoffs,
    existingDelivery?.driverName,
    existingDelivery?.helperName,
    isSubcontracted,
  ]);

  const driverSelectOptions = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    const fleetCrew = getFleetCrew();

    // 1. Primary drivers only (Helpers must not appear on drivers dropdown)
    for (const d of references.drivers) {
      const clean = d.label.trim();
      const lower = clean.toLowerCase();
      if (!clean || lower.includes("unknown") || seen.has(lower)) continue;
      seen.add(lower);
      const fleet = fleetCrew.find((c) => c.fullName.toLowerCase() === lower);
      list.push({
        value: clean,
        label: fleet ? formatCrewMemberOptionLabel(fleet, "Driver") : clean,
      });
    }

    // Ensure currently selected driverName is present
    if (driverName.trim() && !seen.has(driverName.trim().toLowerCase())) {
      list.unshift({ value: driverName.trim(), label: driverName.trim() });
      seen.add(driverName.trim().toLowerCase());
    }

    // Always provide "Unknown Driver" as an option (especially for imported records where driver is untracked)
    if (!seen.has("unknown driver")) {
      list.push({ value: "Unknown Driver", label: "Unknown Driver" });
      seen.add("unknown driver");
    }

    return list;
  }, [references.drivers, driverName]);

  const helperSelectOptions = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    const fleetCrew = getFleetCrew();

    // 1. Primary helpers
    for (const h of references.helpers) {
      const clean = h.label.trim();
      const lower = clean.toLowerCase();
      if (!clean || lower.includes("unknown") || seen.has(lower)) continue;
      seen.add(lower);
      const fleet = fleetCrew.find((c) => c.fullName.toLowerCase() === lower);
      list.push({
        value: clean,
        label: fleet ? formatCrewMemberOptionLabel(fleet, "Helper") : clean,
      });
    }

    // 2. Also include all drivers (so when you choose a driver in helper, their name shows up!)
    for (const d of references.drivers) {
      const clean = d.label.trim();
      const lower = clean.toLowerCase();
      if (!clean || lower.includes("unknown") || seen.has(lower)) continue;
      seen.add(lower);
      const fleet = fleetCrew.find((c) => c.fullName.toLowerCase() === lower);
      list.push({
        value: clean,
        label: fleet ? formatCrewMemberOptionLabel(fleet, "Helper") : `${clean} [Driver]`,
      });
    }

    // Always provide "Unknown Helper" as an option
    if (!seen.has("unknown helper")) {
      list.push({ value: "Unknown Helper", label: "Unknown Helper" });
      seen.add("unknown helper");
    }

    return list;
  }, [references.helpers, references.drivers]);

  function updateValue(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    if (name in expenseStatuses) {
      const parsed = numberValue(value);
      setExpenseStatuses((current) => ({
        ...current,
        [name]: parsed != null ? "confirmed" : "unknown",
      }));
    }
  }

  function moveDropoff(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= dropoffs.length) return;
    setDropoffs((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function updateDropoff(
    id: string,
    fieldOrUpdates: keyof Omit<DropoffDraft, "id"> | Partial<Omit<DropoffDraft, "id">>,
    value?: unknown,
  ) {
    setDropoffs((current) =>
      current.map((dropoff) => {
        if (dropoff.id !== id) return dropoff;
        if (typeof fieldOrUpdates === "object") {
          return { ...dropoff, ...fieldOrUpdates };
        }
        const next = { ...dropoff, [fieldOrUpdates]: value };
        if (fieldOrUpdates === "entryFee" && typeof value === "string") {
          next.entryFeeStatus = "confirmed";
        }
        return next;
      }),
    );
  }

  function addDropoff() {
    setDropoffs((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        storeName: "",
        destinationArea: "",
        dropoffCount: "1",
        entryFee: "",
        entryFeeStatus: "confirmed",
        podSubmitted: false,
        documentRef: "",
        podFile: null,
      },
    ]);
  }

  function buildPayload() {
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();

    function resolveExpenseStatus(val: string, status?: ExpenseResolutionStatus, isCrew?: boolean): ExpenseResolutionStatus {
      if (isSubcontracted && isCrew && numberValue(val) == null) return "not_applicable";
      if (status === "not_applicable" && numberValue(val) == null) return "not_applicable";
      return numberValue(val) != null ? "confirmed" : (status ?? "confirmed");
    }

    const dRateStatus = resolveExpenseStatus(values.driverDailyRate, expenseStatuses.driverDailyRate, true);
    const dAllowanceStatus = resolveExpenseStatus(values.driverAllowance, expenseStatuses.driverAllowance, true);
    const hRateStatus = resolveExpenseStatus(values.helperDailyRate, expenseStatuses.helperDailyRate, true);
    const hAllowanceStatus = resolveExpenseStatus(values.helperAllowance, expenseStatuses.helperAllowance, true);
    const h2RateStatus = hasSecondHelper
      ? resolveExpenseStatus(values.helper2DailyRate, expenseStatuses.helper2DailyRate, true)
      : "not_applicable";
    const h2AllowanceStatus = hasSecondHelper
      ? resolveExpenseStatus(values.helper2Allowance, expenseStatuses.helper2Allowance, true)
      : "not_applicable";

    const dDailyRate = dRateStatus === "not_applicable" ? null : numberValue(values.driverDailyRate);
    const dAllowance = dAllowanceStatus === "not_applicable" ? null : (numberValue(values.driverAllowance) ?? 0);
    const hDailyRate = hRateStatus === "not_applicable" ? null : numberValue(values.helperDailyRate);
    const hAllowance = hAllowanceStatus === "not_applicable" ? null : (numberValue(values.helperAllowance) ?? 0);
    const h2DailyRate = hasSecondHelper ? (h2RateStatus === "not_applicable" ? null : numberValue(values.helper2DailyRate)) : null;
    const h2Allowance = hasSecondHelper ? (h2AllowanceStatus === "not_applicable" ? null : (numberValue(values.helper2Allowance) ?? 0)) : null;

    const otherStatus = isSubcontracted
      ? "confirmed"
      : resolveExpenseStatus(values.otherExpenses, expenseStatuses.otherExpenses);
    const otherExpVal = otherStatus === "not_applicable" ? null : (numberValue(values.otherExpenses) ?? 0);

    return {
      ...values,
      idempotencyKey: idempotencyKeyRef.current,
      waybillNumber: isSubcontracted && !values.waybillNumber.trim() ? "" : values.waybillNumber.trim(),
      clientName: clientName.trim() || null,
      plateNumber,
      truckTemperature: truckTemperature.trim() ? `${truckTemperature}°C` : "",
      recordingDelayed: values.deliveryDate < deliveryDateWindow.max,
      distanceKm: numberValue(values.distanceKm) ?? 0,
      fuelRate: numberValue(values.fuelRate) ?? 0,
      deliveryRate: numberValue(values.deliveryRate) ?? (existingDelivery?.deliveryRate ?? 0),
      additionalCharges: numberValue(values.additionalCharges),
      dieselExpenses: isSubcontracted ? null : numberValue(values.dieselExpenses),
      tollGateExpenses: isSubcontracted ? null : numberValue(values.tollGateExpenses),
      driverAllowance: isSubcontracted ? null : dAllowance,
      driverDailyRate: isSubcontracted ? null : dDailyRate,
      driverName: driverName.trim() || null,
      helperAllowance: isSubcontracted ? null : hAllowance,
      helperDailyRate: isSubcontracted ? null : hDailyRate,
      helperName: helper1Name.trim() || null,
      hasSecondHelper,
      helper2Allowance: isSubcontracted ? null : h2Allowance,
      helper2DailyRate: isSubcontracted ? null : h2DailyRate,
      helper2Name: hasSecondHelper ? (helper2Name.trim() || null) : null,
      otherExpenses: otherExpVal,
      notes: values.notes.trim() || null,
      dieselExpensesStatus: isSubcontracted ? "not_applicable" : resolveExpenseStatus(values.dieselExpenses, expenseStatuses.dieselExpenses),
      tollGateExpensesStatus: isSubcontracted ? "not_applicable" : resolveExpenseStatus(values.tollGateExpenses, expenseStatuses.tollGateExpenses),
      driverAllowanceStatus: isSubcontracted ? "not_applicable" : dAllowanceStatus,
      driverDailyRateStatus: isSubcontracted ? "not_applicable" : dRateStatus,
      helperAllowanceStatus: isSubcontracted ? "not_applicable" : hAllowanceStatus,
      helperDailyRateStatus: isSubcontracted ? "not_applicable" : hRateStatus,
      helper2AllowanceStatus: isSubcontracted ? "not_applicable" : h2AllowanceStatus,
      helper2DailyRateStatus: isSubcontracted ? "not_applicable" : h2RateStatus,
      otherExpensesStatus: otherStatus,
      supportingDocuments:
        supportingFiles.length > 0
          ? [
              ...(existingDelivery?.supportingDocuments ?? []),
              ...supportingFiles.map((file) => {
                const targetDropoffId = supportingFileLinks[file.name];
                const targetDropoff =
                  targetDropoffId && targetDropoffId !== "trip"
                    ? dropoffs.find((d) => d.id === targetDropoffId)
                    : null;
                return {
                  name: file.name,
                  dropoffId: targetDropoff ? targetDropoff.id : null,
                  storeName: targetDropoff ? targetDropoff.storeName : null,
                };
              }),
            ]
          : (existingDelivery?.supportingDocuments ?? []),
      dropoffs: dropoffs.map((dropoff, index) => {
        const existingStop = existingDelivery?.dropoffs.find((s) => s.id === dropoff.id) ?? existingDelivery?.dropoffs[index];
        const previouslyHadPod = Boolean(dropoff.podSubmitted ?? existingStop?.podSubmitted);
        const uploadedPodName = dropoff.podFile?.name ?? null;
        const resolvedDocRef =
          uploadedPodName ??
          (dropoff.documentRef && dropoff.documentRef !== "Pending upload" ? dropoff.documentRef : null) ??
          (existingStop?.documentRef && existingStop?.documentRef !== "Pending upload" ? existingStop?.documentRef : null) ??
          (previouslyHadPod ? "POD attached" : "Pending upload");
        const resolvedPodSubmitted =
          Boolean(uploadedPodName) || previouslyHadPod;
        const resolvedSupportingComplete =
          supportingFiles.length > 0 ||
          Boolean(dropoff.supportingDocsComplete ?? existingStop?.supportingDocsComplete);
        const entryFeeVal = numberValue(dropoff.entryFee);
        const resolvedEntryFeeStatus: ExpenseResolutionStatus =
          entryFeeVal != null
            ? "confirmed"
            : dropoff.entryFeeStatus === "not_applicable"
            ? "not_applicable"
            : "confirmed";
        return {
          id: dropoff.id || existingStop?.id || crypto.randomUUID(),
          sequence: index + 1,
          storeName: dropoff.storeName,
          destinationArea: dropoff.destinationArea,
          dropoffCount: Math.max(1, parseInt(dropoff.dropoffCount, 10) || 1),
          entryFee: entryFeeVal ?? 0,
          entryFeeStatus: resolvedEntryFeeStatus,
          podSubmitted: resolvedPodSubmitted,
          supportingDocsComplete: resolvedSupportingComplete,
          documentRef: resolvedDocRef,
        };
      }),
    };
  }

  function triggerSubmitError(msg: string) {
    setSubmitError(msg);
    toast.error(msg);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function submitDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    // 1. Truck plate is required for all deliveries (Owned and Subcon)
    if (!plateNumber.trim()) {
      triggerSubmitError("Select a registered truck.");
      return;
    }

    // 2. Waybill is required for Owned trucks; optional for Subcons (auto-generated if empty)
    if (!isSubcontracted && !values.waybillNumber.trim()) {
      triggerSubmitError("Waybill number is required for owned trucks.");
      return;
    }

    // 3. Delayed/in-transit fields: validated only if provided
    if (values.distanceKm.trim() && (!Number.isFinite(Number(values.distanceKm)) || Number(values.distanceKm) < 0)) {
      triggerSubmitError("Enter a valid trip distance in kilometers.");
      return;
    }
    if (values.fuelRate.trim() && (!Number.isFinite(Number(values.fuelRate)) || Number(values.fuelRate) < 0)) {
      triggerSubmitError("Enter a valid fuel rate per liter.");
      return;
    }

    const cleanDriver = driverName.trim().toLowerCase();
    const cleanHelper1 = helper1Name.trim().toLowerCase();
    const cleanHelper2 = hasSecondHelper ? helper2Name.trim().toLowerCase() : "";

    if (cleanDriver && cleanHelper1 && cleanDriver === cleanHelper1 && !cleanDriver.includes("unknown")) {
      triggerSubmitError("The same employee cannot be assigned as both Driver and Helper on the same trip.");
      return;
    }
    if (cleanDriver && cleanHelper2 && cleanDriver === cleanHelper2 && !cleanDriver.includes("unknown")) {
      triggerSubmitError("The same employee cannot be assigned as both Driver and Helper 2 on the same trip.");
      return;
    }
    if (cleanHelper1 && cleanHelper2 && cleanHelper1 === cleanHelper2 && !cleanHelper1.includes("unknown")) {
      triggerSubmitError("Helper 1 and Helper 2 must be different employees.");
      return;
    }

    if (values.deliveryRate && Number(values.deliveryRate) < 0) {
      triggerSubmitError("Delivery rate cannot be negative.");
      return;
    }

    // Required crew rates & allowances for Owned trucks (Subcontracted trucks are exempt)
    if (!isSubcontracted) {
      if (!values.driverDailyRate.trim() || Number(values.driverDailyRate) <= 0) {
        triggerSubmitError("Driver daily rate is required for owned trucks.");
        return;
      }
      if (!values.driverAllowance.trim() || Number(values.driverAllowance) < 0) {
        triggerSubmitError("Driver allowance is required for owned trucks.");
        return;
      }
      if (helper1Name.trim()) {
        if (!values.helperDailyRate.trim() || Number(values.helperDailyRate) <= 0) {
          triggerSubmitError("Helper daily rate is required when helper is assigned.");
          return;
        }
        if (!values.helperAllowance.trim() || Number(values.helperAllowance) < 0) {
          triggerSubmitError("Helper allowance is required when helper is assigned.");
          return;
        }
      }
      if (hasSecondHelper && helper2Name.trim()) {
        if (!values.helper2DailyRate.trim() || Number(values.helper2DailyRate) <= 0) {
          triggerSubmitError("Helper 2 daily rate is required when Helper 2 is assigned.");
          return;
        }
        if (!values.helper2Allowance.trim() || Number(values.helper2Allowance) < 0) {
          triggerSubmitError("Helper 2 allowance is required when Helper 2 is assigned.");
          return;
        }
      }
    }

    // Crew Inactivity / Removal check (only if employee name is specified)
    if (driverName.trim()) {
      const driverEligibility = isCrewMemberEligibleForNewDelivery(driverName);
      if (!driverEligibility.ok) {
        triggerSubmitError(driverEligibility.message);
        return;
      }
    }
    if (helper1Name.trim()) {
      const helper1Eligibility = isCrewMemberEligibleForNewDelivery(helper1Name);
      if (!helper1Eligibility.ok) {
        triggerSubmitError(helper1Eligibility.message);
        return;
      }
    }
    if (hasSecondHelper && helper2Name.trim()) {
      const helper2Eligibility = isCrewMemberEligibleForNewDelivery(helper2Name);
      if (!helper2Eligibility.ok) {
        triggerSubmitError(helper2Eligibility.message);
        return;
      }
    }

    // Crew Same-Date Double-Booking check (exempt current delivery being edited)
    const allDeliveriesForCheck = readBrowserPreviewDeliveries();
    const currentRef = existingDelivery?.id || resolvedEditId || propEditDeliveryId || values.waybillNumber;
    if (driverName.trim()) {
      const dConflict = checkCrewDateAvailability({
        employeeName: driverName,
        deliveryDate: values.deliveryDate,
        currentWaybillOrId: currentRef,
        deliveries: allDeliveriesForCheck,
      });
      if (!dConflict.ok) {
        triggerSubmitError(dConflict.message);
        return;
      }
    }
    if (helper1Name.trim()) {
      const h1Conflict = checkCrewDateAvailability({
        employeeName: helper1Name,
        deliveryDate: values.deliveryDate,
        currentWaybillOrId: currentRef,
        deliveries: allDeliveriesForCheck,
      });
      if (!h1Conflict.ok) {
        triggerSubmitError(h1Conflict.message);
        return;
      }
    }
    if (hasSecondHelper && helper2Name.trim()) {
      const h2Conflict = checkCrewDateAvailability({
        employeeName: helper2Name,
        deliveryDate: values.deliveryDate,
        currentWaybillOrId: currentRef,
        deliveries: allDeliveriesForCheck,
      });
      if (!h2Conflict.ok) {
        triggerSubmitError(h2Conflict.message);
        return;
      }
    }
    if (values.deliveryDate < "2024-01-01") {
      triggerSubmitError("Delivery date cannot be earlier than company foundation year (2024).");
      return;
    }
    if (!isEditMode && !isAdmin && values.deliveryDate > deliveryDateWindow.max) {
      triggerSubmitError(`Delivery date cannot be in the future. Today in Manila is ${deliveryDateWindow.max}.`);
      return;
    }
    if (!isEditMode && !isAdmin && values.deliveryDate < deliveryDateWindow.min) {
      if (!approvedTicket) {
        triggerSubmitError(
          `Delivery date precedes the rolling 3-working-day window (${deliveryDateWindow.min}). Please submit an Admin Backdating Request.`
        );
        return;
      }
    }
    if (isEditMode && !isAdmin && editReason.trim().length < 5) {
      if (!editReason.trim()) {
        setEditReason("Operational details update");
      } else {
        triggerSubmitError("Please provide a reason for editing this delivery (at least 5 characters).");
        return;
      }
    }
    if (isEditMode && isAdmin && !editReason.trim()) {
      setEditReason("Administrative update");
    }
    buildPayload();
    setPreviewing(true);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function recordDelivery() {
    setSubmitError(null);
    setSubmitting(true);
    const payload = buildPayload();

    const editId = existingDelivery?.id || resolvedEditId || propEditDeliveryId;
    if (isEditMode && editId) {
      const combinedHelperName =
        hasSecondHelper && payload.helper2Name
          ? `${payload.helperName}, ${payload.helper2Name}`
          : payload.helperName;

      const dropoffUnknown = (payload.dropoffs as Array<{ entryFeeStatus?: ExpenseResolutionStatus }>).some((d) => d.entryFeeStatus === "unknown");
      const dropoffAllNa =
        payload.dropoffs.length > 0 &&
        payload.dropoffs.every((d) => d.entryFeeStatus === "not_applicable");
      const derivedEntryFeeStatus: ExpenseResolutionStatus = dropoffUnknown
        ? "unknown"
        : dropoffAllNa
        ? "not_applicable"
        : "confirmed";

      const remainingIntegrityIssues: string[] = [];
      if (payload.dieselExpensesStatus === "unknown" || payload.dieselExpenses == null) remainingIntegrityIssues.push("dieselExpenses is unknown");
      if (payload.tollGateExpensesStatus === "unknown" || payload.tollGateExpenses == null) remainingIntegrityIssues.push("tollGateExpenses is unknown");
      if (!isSubcontracted) {
        if (payload.driverDailyRateStatus === "unknown" || payload.driverDailyRate == null) remainingIntegrityIssues.push("driverDailyRate is unknown");
        if (payload.helperDailyRateStatus === "unknown" || payload.helperDailyRate == null) remainingIntegrityIssues.push("helperDailyRate is unknown");
      } else {
        if (payload.driverDailyRateStatus === "unknown") remainingIntegrityIssues.push("driverDailyRate is unknown");
        if (payload.helperDailyRateStatus === "unknown") remainingIntegrityIssues.push("helperDailyRate is unknown");
      }
      if (derivedEntryFeeStatus === "unknown") remainingIntegrityIssues.push("dropoff entryFee is unknown");
      const isFinanciallyResolved =
        payload.deliveryRate != null &&
        payload.deliveryRate > 0 &&
        remainingIntegrityIssues.length === 0;

      const combinedHelperAllowanceVal =
        payload.helperAllowanceStatus === "not_applicable" && (!hasSecondHelper || payload.helper2AllowanceStatus === "not_applicable")
          ? null
          : (payload.helperAllowance ?? 0) + (hasSecondHelper ? (payload.helper2Allowance ?? 0) : 0);
      const combinedHelperDailyRateVal =
        payload.helperDailyRateStatus === "not_applicable" && (!hasSecondHelper || payload.helper2DailyRateStatus === "not_applicable")
          ? null
          : (payload.helperDailyRate ?? 0) + (hasSecondHelper ? (payload.helper2DailyRate ?? 0) : 0);
      const combinedHelperAllowanceStatusVal: ExpenseResolutionStatus =
        payload.helperAllowanceStatus === "unknown" || (hasSecondHelper && payload.helper2AllowanceStatus === "unknown")
          ? "unknown"
          : payload.helperAllowanceStatus === "confirmed" || (hasSecondHelper && payload.helper2AllowanceStatus === "confirmed")
          ? "confirmed"
          : "not_applicable";
      const combinedHelperDailyRateStatusVal: ExpenseResolutionStatus =
        payload.helperDailyRateStatus === "unknown" || (hasSecondHelper && payload.helper2DailyRateStatus === "unknown")
          ? "unknown"
          : payload.helperDailyRateStatus === "confirmed" || (hasSecondHelper && payload.helper2DailyRateStatus === "confirmed")
          ? "confirmed"
          : "not_applicable";

      try {
        const response = await fetch("/api/deliveries", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-actor-role": actor.role,
            "x-actor-username": actor.username,
          },
          body: JSON.stringify({
            action: "correct_financials",
            deliveryId: editId,
            expectedVersion: existingDelivery?.version ?? 1,
            idempotencyKey: crypto.randomUUID(),
            reason: editReason.trim().length >= 5 ? editReason.trim() : "Operational details update",
            changes: {
              waybillNumber: payload.waybillNumber,
              deliveryDate: payload.deliveryDate,
              clientName: payload.clientName || existingDelivery?.clientName || "Pending Client",
              plateNumber: payload.plateNumber,
              origin: payload.origin,
              distanceKm: payload.distanceKm,
              fuelRate: payload.fuelRate,
              truckTemperature: Number(truckTemperature) || 0,
              deliveryRate: payload.deliveryRate,
              driverName: payload.driverName || null,
              helperName: combinedHelperName || null,
              supportingDocuments: payload.supportingDocuments,
              notes: payload.notes,
              expenses: {
                dieselExpenses: payload.dieselExpenses,
                tollGateExpenses: payload.tollGateExpenses,
                tollGateBreakdown: payload.tollGateBreakdown || existingDelivery?.expenses?.tollGateBreakdown || "",
                entryFees: financialReview.entryFees,
                driverAllowance: payload.driverAllowance,
                driverDailyRate: payload.driverDailyRate,
                helperAllowance: combinedHelperAllowanceVal,
                helperDailyRate: combinedHelperDailyRateVal,
                otherExpenses: payload.otherExpenses,
              },
              expenseStates: {
                dieselExpenses: payload.dieselExpensesStatus,
                tollGateExpenses: payload.tollGateExpensesStatus,
                entryFees: derivedEntryFeeStatus,
                driverAllowance: payload.driverAllowanceStatus,
                driverDailyRate: payload.driverDailyRateStatus,
                helperAllowance: combinedHelperAllowanceStatusVal,
                helperDailyRate: combinedHelperDailyRateStatusVal,
                otherExpenses: payload.otherExpensesStatus,
              },
              dropoffs: payload.dropoffs,
              financialState: isFinanciallyResolved ? "finalized" : "incomplete",
            },
            fallbackRecord: existingDelivery,
          }),
        });
        const result = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
          result?: { version?: number };
        };
        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "Unable to update delivery record.");
        }
        if (existingDelivery) {
          const resolvedDropoffs = payload.dropoffs.map((d, i) => ({
            id: d.id || existingDelivery.dropoffs[i]?.id || crypto.randomUUID(),
            sequence: i + 1,
            storeName: d.storeName,
            destinationArea: d.destinationArea,
            dropoffCount: Math.max(1, (d as any).dropoffCount || 1),
            entryFee: d.entryFee,
            entryFeeStatus: d.entryFeeStatus,
            podSubmitted: d.podSubmitted,
            supportingDocsComplete: d.supportingDocsComplete,
            documentRef: d.documentRef,
            podFile: null,
          }));

          const updatedTrip: DeliveryLedgerItem = {
            ...existingDelivery,
            waybillNumber: payload.waybillNumber,
            deliveryDate: payload.deliveryDate,
            origin: payload.origin,
            distanceKm: payload.distanceKm ?? 0,
            fuelRate: payload.fuelRate ?? 0,
            deliveryRate: payload.deliveryRate,
            clientName: payload.clientName || existingDelivery?.clientName || "Pending Client",
            plateNumber: payload.plateNumber,
            driverName: payload.driverName,
            helperName: combinedHelperName,
            supportingDocuments: payload.supportingDocuments,
            notes: payload.notes,
            truckTemperature: `${Number(truckTemperature) || 0}°C` as `${number}°C`,
            expenses: {
              dieselExpenses: payload.dieselExpenses,
              tollGateExpenses: payload.tollGateExpenses,
              tollGateBreakdown: payload.tollGateBreakdown || existingDelivery.expenses.tollGateBreakdown || "",
              entryFees: financialReview.entryFees,
              driverAllowance: payload.driverAllowance,
              driverDailyRate: payload.driverDailyRate,
              helperAllowance: combinedHelperAllowanceVal,
              helperDailyRate: combinedHelperDailyRateVal,
              otherExpenses: payload.otherExpenses,
            },
            expenseStates: {
              dieselExpenses: payload.dieselExpensesStatus,
              tollGateExpenses: payload.tollGateExpensesStatus,
              entryFees: derivedEntryFeeStatus,
              driverAllowance: payload.driverAllowanceStatus,
              driverDailyRate: payload.driverDailyRateStatus,
              helperAllowance: combinedHelperAllowanceStatusVal,
              helperDailyRate: combinedHelperDailyRateStatusVal,
              otherExpenses: payload.otherExpensesStatus,
            },
            totalExpenses: financialReview.totalExpenses,
            netIncome: financialReview.netIncome,
            marginPercent: calculateProfitMargin(payload.deliveryRate, financialReview.netIncome),
            financialState: isFinanciallyResolved ? "finalized" : "incomplete",
            financialIntegrityIssues: remainingIntegrityIssues,
            dropoffs: resolvedDropoffs,
            podStatus: derivePodVerificationStatus(resolvedDropoffs),
            version: result.result?.version ?? (existingDelivery.version ?? 1) + 1,
          };
          upsertBrowserPreviewDelivery(updatedTrip);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(BROWSER_PREVIEW_DELIVERIES_CHANGED));
          }
        }
        toast.success("Delivery updated", {
          description: `Waybill #${payload.waybillNumber} changes saved.`,
        });
        const finalEditId = editId || resolvedEditId || existingDelivery?.id || "";
        const encodedEditId = encodeURIComponent(finalEditId);
        if (returnToParam && isValidInternalReturnPath(returnToParam)) {
          if (
            returnToParam.startsWith(`/deliveries/${encodedEditId}`) ||
            (finalEditId && returnToParam.startsWith(`/deliveries/${finalEditId}`))
          ) {
            router.push(appendQueryParam(returnToParam, "updated", "1"));
          } else {
            router.push(returnToParam);
          }
        } else {
          router.push(`/deliveries/${encodedEditId}?updated=1`);
        }
        return;
      } catch (error) {
        triggerSubmitError(error instanceof Error ? error.message : "Unable to update delivery record.");
        setSubmitting(false);
        setPreviewing(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/deliveries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-actor-role": actor.role,
          "x-actor-username": actor.username,
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        deliveryId?: string;
        previewRecord?: DeliveryLedgerItem;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to record the completed delivery.");
      }
      if (result.previewRecord) upsertBrowserPreviewDelivery(result.previewRecord);
      toast.success("Delivery recorded", {
        description: `Waybill #${payload.waybillNumber} recorded successfully.`,
      });
      if (result.deliveryId) {
        const dest = `/deliveries/${encodeURIComponent(result.deliveryId)}`;
        if (returnToParam && isValidInternalReturnPath(returnToParam)) {
          router.push(withReturnContext(dest, returnToParam, returnLabelParam));
        } else {
          router.push(dest);
        }
      } else {
        router.push(returnToParam && isValidInternalReturnPath(returnToParam) ? returnToParam : "/deliveries");
      }
    } catch (error) {
      triggerSubmitError(error instanceof Error ? error.message : "Unable to record the completed delivery.");
      setSubmitting(false);
      setPreviewing(false);
    }
  }

  const noReferences =
    !referencesLoading && (references.clients.length === 0 || references.trucks.length === 0);

  return (
    <>
      <OperationalTopbar
        contextLabel={
          previewing
            ? `Preview / Waybill #${values.waybillNumber || "DRAFT"}`
            : isEditMode
              ? `Edit Delivery / Waybill #${values.waybillNumber || ""}`
              : "Record Completed Delivery"
        }
        showDateFilter={false}
      />
      <div className="content-wrap delivery-entry-page">
      {previewing ? (
        <>
          <header className="page-intro">
            <div>
              <button
                type="button"
                className="back-link"
                onClick={() => {
                  setPreviewing(false);
                  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                ← Back to edit
              </button>
              <h1>Preview delivery</h1>
              <p className="subtitle">
                Review the inputted delivery details before recording.
              </p>
            </div>
          </header>

          <div className="delivery-entry-form">
            {submitError ? <div className="delivery-form-alert" role="alert">{submitError}</div> : null}

            <section className="delivery-form-section">
              <FormHeading number="01" title="Trip details" />
              <div className="detail-meta-grid">
                <div className="detail-meta-item">
                  <span className="meta-label">Waybill</span>
                  <strong className="meta-value">{values.waybillNumber || "—"}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Delivery date</span>
                  <strong className="meta-value">{values.deliveryDate || "—"}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Client</span>
                  <strong className="meta-value">{clientName || "—"}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Truck plate</span>
                  <strong className="meta-value">{plateNumber || "—"}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Temperature</span>
                  <strong className="meta-value">{truckTemperature ? `${truckTemperature}°C` : "—"}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Fuel rate</span>
                  <strong className="meta-value">{formatPeso(numberValue(values.fuelRate) ?? 0)} / L</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Origin</span>
                  <strong className="meta-value">{values.origin || "—"}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Distance</span>
                  <strong className="meta-value">{values.distanceKm ? `${values.distanceKm} km` : "—"}</strong>
                </div>
              </div>
            </section>

            <section className="delivery-form-section">
              <FormHeading
                number="02"
                title={
                  totalDropoffs === dropoffs.length
                    ? `Locations & drop-offs (${totalDropoffs})`
                    : `Locations & drop-offs (${totalDropoffs} drop-offs · ${dropoffs.length} locations)`
                }
              />
              <div className="drawer-dropoff-timeline" aria-label="Drop-off stops sequence">
                {dropoffs.map((stop, index) => {
                  const isLast = index === dropoffs.length - 1;
                  const entryFeeVal = numberValue(stop.entryFee) ?? 0;
                  const countNum = Math.max(1, parseInt(stop.dropoffCount, 10) || 1);
                  return (
                    <div
                      key={stop.id}
                      className={`drawer-dropoff-item ${isLast ? "is-last" : ""}`}
                    >
                      <div className="drawer-dropoff-node" aria-hidden="true">
                        <span className="drawer-dropoff-number">{index + 1}</span>
                      </div>
                      <div className="drawer-dropoff-card">
                        <div className="drawer-dropoff-card-header">
                          <span className="drawer-dropoff-stop-tag">{getStopLabel(index)}</span>
                          <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", fontWeight: 600 }}>
                            {countNum} {countNum === 1 ? "drop-off" : "drop-offs"}
                          </span>
                        </div>
                        <div className="drawer-dropoff-body">
                          <strong className="drawer-dropoff-store">{stop.storeName || `Stop #${index + 1}`}</strong>
                          {stop.destinationArea ? (
                            <span className="drawer-dropoff-destination">{stop.destinationArea}</span>
                          ) : null}
                        </div>
                        <div className="drawer-dropoff-footer">
                          <span className="drawer-dropoff-fee-label">Entry fee:</span>
                          <span className="drawer-dropoff-fee-val">
                            {entryFeeVal === 0 ? "₱0.00" : formatPeso(entryFeeVal)}
                          </span>
                          {stop.podFile || stop.podSubmitted || (stop.documentRef && stop.documentRef !== "Pending upload") ? (
                            <span
                              style={{
                                marginLeft: "auto",
                                fontSize: "11px",
                                color: "var(--color-primary)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontWeight: 600,
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                              POD Attached
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="delivery-form-section">
              <FormHeading number="03" title="Rate & expenses" />
              <div className="review-meta-groups">
                {/* Revenue & Billing Rates */}
                <div className="review-meta-group">
                  <div className="review-group-title">Revenue & Billing</div>
                  <div className="detail-meta-grid detail-meta-grid-2">
                    <div className="detail-meta-item">
                      <span className="meta-label">Delivery rate</span>
                      <strong className="meta-value">{formatPeso(numberValue(values.deliveryRate) ?? 0)}</strong>
                    </div>
                    <div className="detail-meta-item">
                      <span className="meta-label">Additional charges</span>
                      <strong className="meta-value">{formatPeso(numberValue(values.additionalCharges) ?? 0)}</strong>
                    </div>
                  </div>
                </div>

                {/* Direct Trip Expenses */}
                <div className="review-meta-group">
                  <div className="review-group-title">Trip Expenses</div>
                  <div className="detail-meta-grid detail-meta-grid-4">
                    <div className="detail-meta-item">
                      <span className="meta-label">Diesel</span>
                      <strong className="meta-value">{formatPeso(numberValue(values.dieselExpenses) ?? 0)}</strong>
                    </div>
                    <div className="detail-meta-item">
                      <span className="meta-label">Toll gates</span>
                      <strong className="meta-value">{formatPeso(numberValue(values.tollGateExpenses) ?? 0)}</strong>
                    </div>
                    <div className="detail-meta-item">
                      <span className="meta-label">Store entry fees</span>
                      <strong className="meta-value">{formatPeso(financialReview.entryFees ?? 0)}</strong>
                    </div>
                    <div className="detail-meta-item">
                      <span className="meta-label">Other expenses</span>
                      <strong className="meta-value">{formatPeso(numberValue(values.otherExpenses) ?? 0)}</strong>
                    </div>
                  </div>
                </div>

                {/* Crew Compensation in One Row */}
                <div className="review-meta-group">
                  <div className="review-group-title">Crew Compensation</div>
                  <div className={`detail-meta-grid ${hasSecondHelper ? "detail-meta-grid-3" : "detail-meta-grid-2"}`}>
                    <div className="detail-meta-item">
                      <span className="meta-label">Driver ({driverName || "—"})</span>
                      <strong className="meta-value">
                        {formatPeso(numberValue(values.driverDailyRate) ?? 0)} rate · {formatPeso(numberValue(values.driverAllowance) ?? 0)} allowance
                      </strong>
                    </div>
                    <div className="detail-meta-item">
                      <span className="meta-label">
                        {hasSecondHelper ? `Helper 1 (${helper1Name || "—"})` : `Helper (${helper1Name || "—"})`}
                      </span>
                      <strong className="meta-value">
                        {formatPeso(numberValue(values.helperDailyRate) ?? 0)} rate · {formatPeso(numberValue(values.helperAllowance) ?? 0)} allowance
                      </strong>
                    </div>
                    {hasSecondHelper ? (
                      <div className="detail-meta-item">
                        <span className="meta-label">Helper 2 ({helper2Name || "—"})</span>
                        <strong className="meta-value">
                          {formatPeso(numberValue(values.helper2DailyRate) ?? 0)} rate · {formatPeso(numberValue(values.helper2Allowance) ?? 0)} allowance
                        </strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="delivery-financial-review" aria-label="Financial review">
                <div><span>Revenue</span><strong>{formatPeso(financialReview.revenue)}</strong></div>
                <div><span>Entry Fees</span><strong>{formatPeso(financialReview.entryFees)}</strong></div>
                <div><span>Expenses</span><strong>{formatPeso(financialReview.totalExpenses)}</strong></div>
                <div className={financialReview.netIncome == null ? "" : financialReview.netIncome < 0 ? "negative" : "positive"}>
                  <span>Net Profit</span>
                  <strong>
                    {formatPeso(financialReview.netIncome)}
                    {financialReview.marginPercent != null ? ` (${financialReview.marginPercent.toFixed(1)}%)` : ""}
                  </strong>
                </div>
              </div>
            </section>

            <section className="delivery-form-section">
              <FormHeading number="04" title="Documents" />
              <DeliveryFilePreview dropoffs={dropoffs} supportingFiles={supportingFiles} />
            </section>

            {values.notes ? (
              <section className="delivery-form-section">
                <FormHeading number="05" title="Trip notes" />
                <div className="review-meta-groups">
                  <div className="review-meta-group">
                    <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: "14px", lineHeight: "1.6", color: "var(--color-text)" }}>
                      {values.notes}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {isEditMode ? (
              <section className="delivery-form-section">
                <FormHeading number={values.notes ? "06" : "05"} title="Reason for edit" />
                <div className="review-meta-groups">
                  <div className="review-meta-group">
                    <div className="detail-meta-item">
                      <span className="meta-label">Reason</span>
                      <strong className="meta-value">{editReason.trim()}</strong>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <div className="delivery-form-actions">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "auto" }}>
                {liveCompleteness.isComplete ? (
                  <span
                    className="routex-badge tone-success"
                    style={{
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "rgba(16, 185, 129, 0.12)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Complete (All requirements met)
                  </span>
                ) : (
                  <span
                    className="routex-badge tone-warning"
                    style={{
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "rgba(245, 158, 11, 0.12)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Incomplete ({liveCompleteness.count} pending)
                  </span>
                )}
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPreviewing(false);
                  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={submitting}
              >
                Back to edit
              </button>
              <button
                type="button"
                className="primary-action-button"
                onClick={() => void recordDelivery()}
                disabled={submitting}
              >
                {submitting ? (isEditMode ? "Saving…" : "Recording…") : isEditMode ? "Save Changes" : "Record delivery"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
      <header className="page-intro">
        <div>
          <Link
            className="back-link"
            href={backTarget.href}
          >
            ← {backTarget.label}
          </Link>
          <h1>{isEditMode ? "Edit delivery" : "Record delivery"}</h1>
          <p className="subtitle">
            {isEditMode
              ? "Update trip details, store drop-offs, crew compensation, and expenses."
              : "Complete trip details, store drop-offs, financials, and supporting documents."}
          </p>
        </div>
      </header>

      <form className="delivery-entry-form" onSubmit={submitDelivery}>
        {referenceError ? <div className="delivery-form-alert" role="alert">{referenceError}</div> : null}
        {submitError ? <div className="delivery-form-alert" role="alert">{submitError}</div> : null}

        <section className="delivery-form-section">
          <FormHeading number="01" title="Trip details" />
          <div className="delivery-field-grid delivery-trip-grid">
            <label>
              <span className="field-label-text">
                Waybill {!isSubcontracted ? <span className="required-asterisk" aria-hidden="true">*</span> : <span style={{ opacity: 0.6, fontSize: "11px", fontWeight: "normal" }}>(optional for subcons)</span>}
              </span>
              <input
                required={!isSubcontracted}
                value={values.waybillNumber}
                onChange={(event) => updateValue("waybillNumber", event.target.value)}
                placeholder={isSubcontracted ? "Auto-generated if empty" : "WB-2026-0001"}
              />
            </label>
            <label>
              <span className="field-label-text">Delivery date</span>
              <SingleDatePicker
                required
                disabled={isEditMode}
                min="2024-01-01"
                max={isAdmin || isEditMode ? undefined : deliveryDateWindow.max}
                value={values.deliveryDate}
                onChange={(nextDate) => {
                  if (isEditMode) return;
                  updateValue("deliveryDate", nextDate);
                }}
              />
            </label>
            {isOlderThanWindow && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  border: "1px solid",
                  backgroundColor: approvedTicket ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                  borderColor: approvedTicket ? "#10b981" : "#f59e0b",
                  color: "var(--color-text)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  {approvedTicket ? (
                    <span style={{ fontWeight: 600, color: "#059669", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Approved Backdating Request #{approvedTicket.id} on file for Waybill #{values.waybillNumber}.
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "flex-start", gap: "6px" }}>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0, marginTop: "2px" }}
                        aria-hidden="true"
                      >
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span><strong>Backdating Notice:</strong> This date precedes the rolling 3-working-day window (Min: {deliveryDateWindow.min}). An approved Admin Backdating Request is required to record this delivery.</span>
                    </span>
                  )}
                </div>
                {!approvedTicket && (
                  <button
                    type="button"
                    onClick={() => setBackdatingModalOpen(true)}
                    className="secondary-button"
                    style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}
                  >
                    Submit Request
                  </button>
                )}
              </div>
            )}
            <div className="client-field-group">
              <span className="field-label-text">Client</span>
              <RoundedSelect
                value={clientName}
                options={references.clients.map((option) => ({ value: option.label, label: option.label }))}
                onChange={handleClientChange}
                ariaLabel="Client name"
                placeholder={referencesLoading ? "Loading clients…" : "Select or add client"}
                emptyMessage={referenceError ? "Clients could not be loaded" : "No active clients available"}
                searchable
                allowCustomValue
                searchPlaceholder="Search or enter a new client"
                customValueLabel={(query) => (
                  <>
                    <span>Add </span>
                    <strong>{query}</strong>
                  </>
                )}
              />
            </div>

            {/* Truck Selection grouped into Owned Trucks and Subcontracted Trucks */}
            <div className="client-field-group">
              <span className="field-label-text">
                Truck plate <span className="required-asterisk" aria-hidden="true">*</span>
              </span>
              <RoundedSelect
                value={plateNumber}
                options={groupedTruckOptions}
                onChange={(val) => setPlateNumber(val)}
                ariaLabel="Select registered truck"
                placeholder={referencesLoading ? "Loading trucks…" : "Select registered truck"}
                emptyMessage={referenceError ? "Trucks could not be loaded" : "No active trucks registered in Fleet"}
                searchable
                searchPlaceholder="Search by truck plate..."
              />
            </div>

            <label>
              <span className="field-label-text">Temperature</span>
              <span className="temperature-input-wrap">
                <input
                  type="text"
                  inputMode="decimal"
                  value={truckTemperature}
                  placeholder="e.g. 4"
                  className="no-spin-stepper"
                  aria-describedby="delivery-temperature-unit"
                  onKeyDown={handleSignedDecimalKeyDown}
                  onChange={(event) => setTruckTemperature(sanitizeSignedDecimalInput(event.target.value, 1))}
                />
                <span id="delivery-temperature-unit" aria-hidden="true">°C</span>
              </span>
            </label>

            {/* Fuel Rate */}
            <div className="fuel-rate-field-wrap">
              <label>
                <span className="field-label-text">Fuel rate (₱/L)</span>
                <span className="peso-input-wrap">
                  <span className="peso-prefix" aria-hidden="true">₱</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="no-spin-stepper peso-input"
                    value={values.fuelRate}
                    onKeyDown={handlePositiveDecimalKeyDown}
                    onChange={(event) => updateValue("fuelRate", sanitizePositiveDecimalInput(event.target.value, 2))}
                    placeholder="e.g. 85.00"
                  />
                </span>
              </label>
            </div>

            <label className="origin-field">
              <span className="field-label-text">Origin</span>
              <input
                value={values.origin}
                onChange={(event) => updateValue("origin", event.target.value)}
                placeholder="e.g. Marilao Depot"
              />
            </label>
            <label>
              <span className="field-label-text">Distance (km)</span>
              <input
                type="text"
                inputMode="decimal"
                className="no-spin-stepper"
                placeholder="e.g. 42.5"
                value={values.distanceKm}
                onKeyDown={handlePositiveDecimalKeyDown}
                onChange={(event) => updateValue("distanceKm", sanitizePositiveDecimalInput(event.target.value, 2))}
              />
            </label>
          </div>
        </section>

        <section className="delivery-form-section">
          <FormHeading number="02" title="Locations & drop-offs" />
          <div className="dropoff-editor">
            {dropoffs.map((dropoff, index) => {
              const isLast = index === dropoffs.length - 1;
              return (
              <div
                key={dropoff.id}
                className={`dropoff-row ${isLast ? "is-last-stop" : ""} ${draggedStopIndex === index ? "is-dragging" : ""}`}
                draggable
                onDragStart={() => setDraggedStopIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={() => {
                  if (draggedStopIndex === null || draggedStopIndex === index) return;
                  setDropoffs((current) => {
                    const next = [...current];
                    const [moved] = next.splice(draggedStopIndex, 1);
                    next.splice(index, 0, moved);
                    return next;
                  });
                  setDraggedStopIndex(null);
                }}
                onDragEnd={() => setDraggedStopIndex(null)}
              >
                <div className="dropoff-row-header">
                  <div className="dropoff-title-wrap">
                    <span
                      className="dropoff-drag-handle"
                      title="Reorder stop"
                      aria-hidden="true"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="5" cy="4" r="1.5" />
                        <circle cx="11" cy="4" r="1.5" />
                        <circle cx="5" cy="8" r="1.5" />
                        <circle cx="11" cy="8" r="1.5" />
                        <circle cx="5" cy="12" r="1.5" />
                        <circle cx="11" cy="12" r="1.5" />
                      </svg>
                    </span>
                    <span className="dropoff-row-title">{getStopLabel(index)}</span>
                  </div>
                  <div className="dropoff-row-actions">
                    <button
                      type="button"
                      className="dropoff-move-btn"
                      disabled={index === 0}
                      onClick={() => moveDropoff(index, "up")}
                      aria-label={`Move ${getStopLabel(index)} up`}
                      title="Move up"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="13 10 8 5 3 10" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="dropoff-move-btn"
                      disabled={index === dropoffs.length - 1}
                      onClick={() => moveDropoff(index, "down")}
                      aria-label={`Move ${getStopLabel(index)} down`}
                      title="Move down"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 8 11 13 6" />
                      </svg>
                    </button>
                    {dropoffs.length > 1 ? (
                      <button
                        type="button"
                        className="dropoff-remove-btn"
                        onClick={() => setDropoffs((current) => current.filter((item) => item.id !== dropoff.id))}
                        aria-label={`Remove ${getStopLabel(index)}`}
                        title="Remove stop"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="4" y1="4" x2="12" y2="12" />
                          <line x1="12" y1="4" x2="4" y2="12" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="dropoff-fields">
                  <label className="dropoff-field">
                    <span className="field-label-text">Store name</span>
                    <input
                      value={dropoff.storeName}
                      onChange={(event) => updateDropoff(dropoff.id, "storeName", event.target.value)}
                      placeholder="e.g. Landers Balintawak"
                    />
                  </label>
                  <label className="dropoff-field">
                    <span className="field-label-text">Location</span>
                    <input
                      value={dropoff.destinationArea}
                      onChange={(event) => updateDropoff(dropoff.id, "destinationArea", event.target.value)}
                      placeholder="e.g. Quezon City, Metro Manila"
                    />
                  </label>
                  <label className="dropoff-field" style={{ maxWidth: "140px" }} htmlFor={`dropoff-count-${dropoff.id}`}>
                    <span className="field-label-text">Stops / Drop-offs</span>
                    <NumberStepper
                      id={`dropoff-count-${dropoff.id}`}
                      min={1}
                      max={99}
                      value={dropoff.dropoffCount}
                      onChange={(next) => updateDropoff(dropoff.id, "dropoffCount", next)}
                      placeholder="1"
                      ariaLabel="Stops / Drop-offs"
                    />
                  </label>
                  <div className="dropoff-field dropoff-entry-fee-wrap">
                    <EntryFeeField
                      value={dropoff.entryFee}
                      status={dropoff.entryFeeStatus}
                      onValueChange={(value) => updateDropoff(dropoff.id, "entryFee", value)}
                      onStatusChange={(status) => {
                        updateDropoff(dropoff.id, "entryFeeStatus", status);
                        if (status !== "confirmed") updateDropoff(dropoff.id, "entryFee", "");
                      }}
                    />
                  </div>
                </div>

                <div
                  className="dropoff-pod-attachment-bar"
                  style={{
                    marginTop: "12px",
                    paddingTop: "10px",
                    borderTop: "1px dashed var(--color-border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)" }}>
                      Proof of Delivery (POD)
                    </span>
                  </div>

                  {dropoff.podFile || dropoff.podSubmitted || (dropoff.documentRef && dropoff.documentRef !== "Pending upload") ? (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        backgroundColor: "var(--color-surface-hover)",
                        border: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <path d="m9 15 2 2 4-4" />
                      </svg>
                      <span
                        style={{
                          maxWidth: "240px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                        }}
                        title={dropoff.podFile?.name ?? (dropoff.documentRef && dropoff.documentRef !== "Pending upload" ? dropoff.documentRef : "POD Attached")}
                      >
                        {dropoff.podFile?.name ?? (dropoff.documentRef && dropoff.documentRef !== "Pending upload" ? dropoff.documentRef : "POD Attached")}
                      </span>
                      <label
                        style={{
                          cursor: "pointer",
                          color: "var(--color-accent)",
                          fontWeight: 600,
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: "var(--color-surface)",
                          border: "1px solid var(--color-border-subtle)",
                        }}
                        title="Replace POD"
                      >
                        Replace
                        <input
                          type="file"
                          accept="application/pdf,image/png,image/jpeg"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              updateDropoff(dropoff.id, {
                                podFile: file,
                                podSubmitted: true,
                                documentRef: file.name,
                              });
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          updateDropoff(dropoff.id, {
                            podFile: null,
                            podSubmitted: false,
                            documentRef: "",
                          });
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--color-text-muted)",
                          padding: "0 2px",
                          fontWeight: "bold",
                          fontSize: "14px",
                          lineHeight: 1,
                        }}
                        title="Remove POD"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label
                      style={{
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        padding: "5px 12px",
                        borderRadius: "6px",
                        backgroundColor: "var(--color-surface)",
                        border: "1px dashed var(--color-border-subtle)",
                        color: "var(--color-accent)",
                        fontWeight: 600,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>Attach POD</span>
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            updateDropoff(dropoff.id, {
                              podFile: file,
                              podSubmitted: true,
                              documentRef: file.name,
                            });
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
              );
            })}
            <div className="dropoff-actions-bar">
              <button type="button" className="secondary-button add-dropoff" onClick={addDropoff}>
                + Add location / store
              </button>
              <span className="dropoff-counter">
                {totalDropoffs} {totalDropoffs === 1 ? "drop-off" : "drop-offs"} ({dropoffs.length} {dropoffs.length === 1 ? "location" : "locations"})
              </span>
            </div>
          </div>
        </section>

        <section className="delivery-form-section">
          <FormHeading number="03" title="Rate & expenses" />
          <div className="delivery-field-grid delivery-finance-grid">

            {/* Rate & Additional Charges */}
            <div className="delivery-rate-banner wide">
              <div className="delivery-rate-input-row rate-and-charges-grid">
                <div className="hero-rate-field">
                  <label>
                    <span className="field-label-text">Delivery rate</span>
                    <span className="peso-input-wrap emphasized-rate-wrap">
                      <span className="peso-prefix" aria-hidden="true">₱</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="no-spin-stepper peso-input emphasized-rate-input"
                        value={values.deliveryRate}
                        onKeyDown={handlePositiveDecimalKeyDown}
                        onChange={(event) => updateValue("deliveryRate", sanitizePositiveDecimalInput(event.target.value, 2))}
                      />
                    </span>
                  </label>
                </div>

                <div className="additional-charges-field">
                  <label>
                    <span className="field-label-text">Additional charges</span>
                    <span className="peso-input-wrap">
                      <span className="peso-prefix" aria-hidden="true">₱</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="no-spin-stepper peso-input"
                        value={values.additionalCharges}
                        onKeyDown={handlePositiveDecimalKeyDown}
                        onChange={(event) => updateValue("additionalCharges", sanitizePositiveDecimalInput(event.target.value, 2))}
                      />
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <h3 className="delivery-finance-group-title wide">
              {isSubcontracted ? "Subcontracted Expense" : "Trip Expenses"}
            </h3>

            {isSubcontracted ? (
              <div className="direct-expense-field wide" style={{ gridColumn: "1 / -1" }}>
                <label>
                  <span className="field-label-text">Total Subcontracted Expense</span>
                  <span className="peso-input-wrap">
                    <span className="peso-prefix" aria-hidden="true">₱</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="no-spin-stepper peso-input"
                      value={values.otherExpenses}
                      onKeyDown={handlePositiveDecimalKeyDown}
                      onChange={(event) => updateValue("otherExpenses", sanitizePositiveDecimalInput(event.target.value, 2))}
                    />
                  </span>
                </label>
                <span className="field-hint" style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "block", marginTop: "4px" }}>
                  Single total expense for subcontracted trip.
                </span>
              </div>
            ) : (
              <>
                <div className="direct-expense-field">
                  <label>
                    <span className="field-label-text">Diesel</span>
                    <span className="peso-input-wrap">
                      <span className="peso-prefix" aria-hidden="true">₱</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="no-spin-stepper peso-input"
                        value={values.dieselExpenses}
                        onKeyDown={handlePositiveDecimalKeyDown}
                        onChange={(event) => updateValue("dieselExpenses", sanitizePositiveDecimalInput(event.target.value, 2))}
                      />
                    </span>
                  </label>
                </div>

                <div className="direct-expense-field">
                  <label>
                    <span className="field-label-text">Toll gates</span>
                    <span className="peso-input-wrap">
                      <span className="peso-prefix" aria-hidden="true">₱</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="no-spin-stepper peso-input"
                        value={values.tollGateExpenses}
                        onKeyDown={handlePositiveDecimalKeyDown}
                        onChange={(event) => updateValue("tollGateExpenses", sanitizePositiveDecimalInput(event.target.value, 2))}
                      />
                    </span>
                  </label>
                </div>

                <div className="direct-expense-field">
                  <label>
                    <span className="field-label-text">Other expenses</span>
                    <span className="peso-input-wrap">
                      <span className="peso-prefix" aria-hidden="true">₱</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="no-spin-stepper peso-input"
                        value={values.otherExpenses}
                        onKeyDown={handlePositiveDecimalKeyDown}
                        onChange={(event) => updateValue("otherExpenses", sanitizePositiveDecimalInput(event.target.value, 2))}
                      />
                    </span>
                  </label>
                </div>
              </>
            )}

            {/* Crew Expenses with Support for 2 Helpers */}
            <div className="crew-expense-groups wide">
              <div className="crew-expense-header-bar">
                <h4 className="crew-section-subtitle">Crew Compensation</h4>
                {hasSecondHelper ? (
                  <span className="crew-max-badge" title="Maximum 2 helpers">
                    2 Helpers (Max)
                  </span>
                ) : null}
              </div>

              <div className="crew-cards-grid">
                {/* Driver Card */}
                <section className="crew-expense-group">
                  <div className="crew-card-title-row">
                    <span className="crew-role-pill driver">Driver</span>
                    <RoundedSelect
                      value={driverName}
                      options={driverSelectOptions}
                      onChange={(val) => setDriverName(sanitizePersonNameInput(val))}
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
                  {!isSubcontracted && (
                    <div className="crew-expense-fields-row">
                      <div className="daily-rate-field">
                        <label>
                          <span className="field-label-text">Daily rate <span className="required-asterisk" aria-hidden="true">*</span></span>
                          <span className="peso-input-wrap">
                            <span className="peso-prefix" aria-hidden="true">₱</span>
                            <input
                              aria-label="Driver daily rate"
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              className="no-spin-stepper peso-input"
                              value={values.driverDailyRate}
                              onKeyDown={handlePositiveDecimalKeyDown}
                              onChange={(event) => updateValue("driverDailyRate", sanitizePositiveDecimalInput(event.target.value, 2))}
                            />
                          </span>
                        </label>
                      </div>
                      <div className="daily-rate-field allowance-field">
                        <label>
                          <span className="field-label-text">Allowance <span className="required-asterisk" aria-hidden="true">*</span></span>
                          <span className="peso-input-wrap">
                            <span className="peso-prefix" aria-hidden="true">₱</span>
                            <input
                              aria-label="Driver allowance"
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              className="no-spin-stepper peso-input"
                              value={values.driverAllowance}
                              onKeyDown={handlePositiveDecimalKeyDown}
                              onChange={(event) => {
                                updateValue("driverAllowance", sanitizePositiveDecimalInput(event.target.value, 2));
                                setExpenseStatuses((current) => ({ ...current, driverAllowance: "confirmed" }));
                              }}
                            />
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </section>

                {/* Helper 1 Card */}
                <section className="crew-expense-group">
                  <div className="crew-card-title-row">
                    <span className="crew-role-pill helper">Helper 1</span>
                    <RoundedSelect
                      value={helper1Name}
                      options={helperSelectOptions}
                      onChange={(val) => setHelper1Name(sanitizePersonNameInput(val))}
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
                  {!isSubcontracted && (
                    <div className="crew-expense-fields-row">
                      <div className="daily-rate-field">
                        <label>
                          <span className="field-label-text">Daily rate <span className="required-asterisk" aria-hidden="true">*</span></span>
                          <span className="peso-input-wrap">
                            <span className="peso-prefix" aria-hidden="true">₱</span>
                            <input
                              aria-label="Helper daily rate"
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              className="no-spin-stepper peso-input"
                              value={values.helperDailyRate}
                              onKeyDown={handlePositiveDecimalKeyDown}
                              onChange={(event) => updateValue("helperDailyRate", sanitizePositiveDecimalInput(event.target.value, 2))}
                            />
                          </span>
                        </label>
                      </div>
                      <div className="daily-rate-field allowance-field">
                        <label>
                          <span className="field-label-text">Allowance <span className="required-asterisk" aria-hidden="true">*</span></span>
                          <span className="peso-input-wrap">
                            <span className="peso-prefix" aria-hidden="true">₱</span>
                            <input
                              aria-label="Helper allowance"
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              className="no-spin-stepper peso-input"
                              value={values.helperAllowance}
                              onKeyDown={handlePositiveDecimalKeyDown}
                              onChange={(event) => {
                                updateValue("helperAllowance", sanitizePositiveDecimalInput(event.target.value, 2));
                                setExpenseStatuses((current) => ({ ...current, helperAllowance: "confirmed" }));
                              }}
                            />
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </section>

                {/* Helper 2 Card (When added) */}
                {hasSecondHelper ? (
                  <section className="crew-expense-group helper-2-card">
                    <div className="crew-card-title-row">
                      <span className="crew-role-pill helper-2">Helper 2</span>
                      <RoundedSelect
                        value={helper2Name}
                        options={helperSelectOptions}
                        onChange={(val) => setHelper2Name(sanitizePersonNameInput(val))}
                        inputFilter={sanitizePersonNameInput}
                        ariaLabel="Helper 2 name"
                        className="crew-name-select"
                        placeholder="Select or add helper"
                        emptyMessage="No saved helpers"
                        searchable
                        allowCustomValue
                        searchPlaceholder="Search or enter a new helper"
                      />
                      <button
                        type="button"
                        className="remove-helper-btn"
                        onClick={() => {
                          setHasSecondHelper(false);
                          updateValue("helper2DailyRate", "");
                          updateValue("helper2Allowance", "");
                          setHelper2Name("");
                        }}
                        title="Remove helper"
                      >
                        × Remove
                      </button>
                    </div>
                    {!isSubcontracted && (
                      <div className="crew-expense-fields-row">
                        <div className="daily-rate-field">
                          <label>
                            <span className="field-label-text">Daily rate <span className="required-asterisk" aria-hidden="true">*</span></span>
                            <span className="peso-input-wrap">
                              <span className="peso-prefix" aria-hidden="true">₱</span>
                              <input
                                aria-label="Helper 2 daily rate"
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                className="no-spin-stepper peso-input"
                                value={values.helper2DailyRate}
                                onKeyDown={handlePositiveDecimalKeyDown}
                                onChange={(event) => updateValue("helper2DailyRate", sanitizePositiveDecimalInput(event.target.value, 2))}
                              />
                            </span>
                          </label>
                        </div>
                        <div className="daily-rate-field allowance-field">
                          <label>
                            <span className="field-label-text">Allowance <span className="required-asterisk" aria-hidden="true">*</span></span>
                            <span className="peso-input-wrap">
                              <span className="peso-prefix" aria-hidden="true">₱</span>
                              <input
                                aria-label="Helper 2 allowance"
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                className="no-spin-stepper peso-input"
                                value={values.helper2Allowance}
                                onKeyDown={handlePositiveDecimalKeyDown}
                                onChange={(event) => {
                                  updateValue("helper2Allowance", sanitizePositiveDecimalInput(event.target.value, 2));
                                  setExpenseStatuses((current) => ({ ...current, helper2Allowance: "confirmed" }));
                                }}
                              />
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </section>
                ) : (
                  <div className="crew-add-helper-slot">
                    <button
                      type="button"
                      className="crew-add-helper-card-btn"
                      onClick={() => {
                        setHasSecondHelper(true);
                        setExpenseStatuses((cur) => ({
                          ...cur,
                          helper2DailyRate: isSubcontracted ? "not_applicable" : "confirmed",
                          helper2Allowance: isSubcontracted ? "not_applicable" : "confirmed",
                        }));
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>+ Add Helper</span>
                      <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Support up to 2 helpers</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Delivery Completeness Indicator */}
          <div
            className="delivery-completeness-live-bar"
            style={{
              marginTop: "16px",
              padding: "12px 16px",
              borderRadius: "10px",
              border: liveCompleteness.isComplete
                ? "1px solid rgba(16, 185, 129, 0.35)"
                : "1px solid rgba(245, 158, 11, 0.35)",
              background: liveCompleteness.isComplete
                ? "rgba(16, 185, 129, 0.08)"
                : "rgba(245, 158, 11, 0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {liveCompleteness.isComplete ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "var(--color-status-success, #059669)",
                      color: "#fff",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "var(--color-accent, #f59e0b)",
                      color: "#fff",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </span>
                )}
                <strong
                  style={{
                    fontSize: "13px",
                    color: liveCompleteness.isComplete
                      ? "var(--color-status-success, #059669)"
                      : "var(--color-accent-deep, #b45309)",
                  }}
                >
                  {liveCompleteness.isComplete
                    ? "All Details Complete · Ready to Record"
                    : `Incomplete Delivery (${liveCompleteness.count} pending ${liveCompleteness.count === 1 ? "field" : "fields"})`}
                </strong>
              </div>
              {liveCompleteness.isComplete ? (
                <span className="routex-badge tone-success" style={{ fontWeight: 700 }}>
                  COMPLETE
                </span>
              ) : (
                <span className="routex-badge tone-warning" style={{ fontWeight: 700 }}>
                  INCOMPLETE
                </span>
              )}
            </div>
            {!liveCompleteness.isComplete && liveCompleteness.issues.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px", paddingLeft: "28px" }}>
                {liveCompleteness.issues.map((issue) => (
                  <span
                    key={issue}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "rgba(245, 158, 11, 0.16)",
                      color: "var(--color-accent-deep, #b45309)",
                      border: "1px solid rgba(245, 158, 11, 0.25)",
                    }}
                  >
                    • {issue}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="delivery-financial-review" aria-label="Financial review">
            <div>
              <span>Revenue</span>
              <strong>{formatPeso(financialReview.revenue)}</strong>
            </div>
            <div>
              <span>Entry Fees</span>
              <strong>{formatPeso(financialReview.entryFees)}</strong>
            </div>
            <div>
              <span>Expenses</span>
              <strong>{formatPeso(financialReview.totalExpenses)}</strong>
            </div>
            <div className={financialReview.netIncome == null ? "" : financialReview.netIncome < 0 ? "negative" : "positive"}>
              <span>Net Profit</span>
              <strong>
                {formatPeso(financialReview.netIncome)}
                {financialReview.marginPercent != null ? ` (${financialReview.marginPercent.toFixed(1)}%)` : ""}
              </strong>
            </div>
          </div>
        </section>

        <section className="delivery-form-section">
          <FormHeading
            number="04"
            title="Supporting documents"
            description="Attach trip receiving slips, gate passes, or miscellaneous receipts for this trip."
          />
          <div className="delivery-upload-single">
            <FileUploadField
              id="delivery-supporting-files"
              label="Trip supporting documents"
              helper="Receiving slips, gate passes, or miscellaneous attachments (PDF, PNG, JPG)"
              files={supportingFiles}
              onChange={setSupportingFiles}
            />
            {supportingFiles.length > 0 ? (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-secondary)" }}>
                  Link attached files to locations:
                </span>
                {supportingFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--color-surface)",
                      fontSize: "12px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l7.9-7.9" />
                      </svg>
                      {file.name}
                    </span>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      <select
                        className="supporting-docs-store-select"
                        value={supportingFileLinks[file.name] ?? "trip"}
                        onChange={(e) =>
                          setSupportingFileLinks((prev) => ({ ...prev, [file.name]: e.target.value }))
                        }
                        style={{ fontSize: "11px", padding: "2px 6px", height: "26px" }}
                        aria-label={`Link ${file.name} to location`}
                      >
                        <option value="trip">Entire Trip (All stops)</option>
                        {dropoffs.map((d, sIdx) => (
                          <option key={d.id} value={d.id}>
                            Stop #{sIdx + 1}: {d.storeName || `Stop #${sIdx + 1}`}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setSupportingFiles((prev) => prev.filter((_, i) => i !== idx))}
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: "var(--color-danger, #ef4444)",
                          fontWeight: "bold",
                          fontSize: "14px",
                          padding: "0 4px",
                        }}
                        title="Remove file"
                        aria-label={`Remove ${file.name}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="delivery-form-section">
          <FormHeading
            number="05"
            title="Trip notes"
            description="Operational remarks, special instructions, delays, or dispatch notes for this trip."
          />
          <div className="delivery-field-grid">
            <label style={{ gridColumn: "1 / -1" }}>
              <span className="field-label-text">Notes (optional)</span>
              <textarea
                value={values.notes}
                onChange={(event) => setValues((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Add any delivery notes, special handling details, client requests, or route remarks…"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                aria-label="Delivery notes"
              />
            </label>
          </div>
        </section>

        {isEditMode ? (
          <section className="delivery-form-section">
            <FormHeading number="06" title="Reason for edit" />
            <div className="delivery-field-grid">
              <label style={{ gridColumn: "1 / -1" }}>
                <span className="field-label-text">
                  Reason <span className="required-asterisk" aria-hidden="true">*</span>
                </span>
                <input
                  type="text"
                  required
                  minLength={5}
                  value={editReason}
                  onChange={(event) => setEditReason(event.target.value)}
                  placeholder="Describe why this delivery is being updated (minimum 5 characters)"
                  aria-label="Reason for editing delivery"
                />
              </label>
            </div>
          </section>
        ) : null}

        <div className="delivery-form-actions">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "auto" }}>
            {liveCompleteness.isComplete ? (
              <span
                className="routex-badge tone-success"
                style={{
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: "6px",
                  background: "rgba(16, 185, 129, 0.12)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Complete (All requirements met)
              </span>
            ) : (
              <span
                className="routex-badge tone-warning"
                style={{
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: "6px",
                  background: "rgba(245, 158, 11, 0.12)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Incomplete ({liveCompleteness.count} pending)
              </span>
            )}
          </div>
          <Link
            className="secondary-button"
            href={backTarget.href}
          >
            Cancel
          </Link>
          <button className="primary-action-button" type="submit" disabled={submitting || referencesLoading || noReferences}>
            {isEditMode ? "Review changes" : "Preview delivery"}
          </button>
        </div>
        {noReferences ? <p className="delivery-reference-warning">At least one client and truck required.</p> : null}
      </form>
        </>
      )}
      </div>

      <BackdatingTicketsModal
        isOpen={backdatingModalOpen}
        onClose={() => setBackdatingModalOpen(false)}
        currentUserRole={actor.role}
        currentUsername={actor.username}
        initialWaybill={values.waybillNumber}
        initialDeliveryDate={values.deliveryDate}
        onTicketApproved={(ticket) => {
          setApprovedTicket(ticket);
        }}
      />
    </>
  );
}

function DeliveryFilePreview({
  dropoffs,
  supportingFiles,
}: {
  dropoffs: DropoffDraft[];
  supportingFiles: File[];
}) {
  const [previews, setPreviews] = useState<Array<{
    file?: File;
    name: string;
    kind: string;
    url?: string;
  }>>([]);

  useEffect(() => {
    const podList = dropoffs
      .filter((d) => d.podFile || (d.documentRef && d.documentRef !== "Pending upload"))
      .map((d) => ({
        file: d.podFile || undefined,
        name: d.podFile?.name ?? d.documentRef ?? "POD Document",
        kind: `POD · ${d.storeName || "Stop"}`,
        url: d.podFile ? URL.createObjectURL(d.podFile) : undefined,
      }));

    const supportingList = supportingFiles.map((file) => ({
      file,
      name: file.name,
      kind: "Supporting",
      url: URL.createObjectURL(file),
    }));

    const nextPreviews = [...podList, ...supportingList];
    setPreviews(nextPreviews);

    return () => {
      supportingList.forEach(({ url }) => {
        if (url) URL.revokeObjectURL(url);
      });
      podList.forEach(({ url }) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [dropoffs, supportingFiles]);

  if (previews.length === 0) {
    return <p className="delivery-file-preview-empty">No files attached.</p>;
  }

  return (
    <div className="delivery-file-preview-grid">
      {previews.map(({ file, name, kind, url }, index) => {
        const isImage = file?.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(name);
        return (
          <a
            className="delivery-file-preview-card is-clickable"
            key={`${kind}-${name}-${index}`}
            href={url || "#"}
            target={url ? "_blank" : undefined}
            rel="noreferrer"
            title={`View ${name}`}
            aria-label={`View ${name}`}
            style={{ textDecoration: "none", cursor: url ? "pointer" : "default" }}
          >
            <div className="delivery-file-preview-visual">
              {url && isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`Preview of ${name}`} />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 3.5h6l4 4V20.5H7V3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M13 3.5v4h4M9.5 12h5M9.5 15h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div className="delivery-file-preview-copy">
              <span>{kind}</span>
              <strong>{name}</strong>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function FormHeading({ number, title, description }: { number: string; title: string; description?: string }) {
  return (
    <div className="delivery-form-heading">
      <div><span>{number}</span><h2>{title}</h2></div>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function FileUploadField({ id, label, helper, files, onChange }: {
  id: string;
  label: string;
  helper: string;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <div className="delivery-upload-field">
      <span className="delivery-upload-label">{label}</span>
      <label className="delivery-upload-control">
        <span className="delivery-upload-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span className="delivery-upload-copy">
          <strong>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Choose files"}</strong>
          <small>{files.length ? files.map((file) => file.name).join(", ") : "Select files from your device"}</small>
        </span>
        <span className="delivery-upload-browse">Browse</span>
        <input
          key={files.map((file) => `${file.name}:${file.size}`).join("|") || "empty"}
          id={id}
          className="delivery-upload-input"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          multiple
          aria-label={`Choose ${label.toLocaleLowerCase()}`}
          onChange={(event) => onChange(Array.from(event.target.files ?? []))}
        />
      </label>
      <div className="delivery-upload-meta">
        <small>{helper}</small>
        {files.length ? <button type="button" onClick={() => onChange([])}>Clear</button> : null}
      </div>
    </div>
  );
}

function EntryFeeField({
  value,
  onValueChange,
}: {
  value: string;
  status?: ExpenseResolutionStatus;
  onValueChange: (value: string) => void;
  onStatusChange?: (status: ExpenseResolutionStatus) => void;
}) {
  return (
    <label className="dropoff-field">
      <span className="field-label-text">Entry fee</span>
      <span className="peso-input-wrap">
        <span className="peso-prefix" aria-hidden="true">₱</span>
        <input
          aria-label="Entry fee amount"
          type="text"
          inputMode="decimal"
          className="no-spin-stepper peso-input"
          value={value}
          placeholder="0.00"
          onKeyDown={handlePositiveDecimalKeyDown}
          onChange={(event) => onValueChange(sanitizePositiveDecimalInput(event.target.value, 2))}
        />
      </span>
    </label>
  );
}


