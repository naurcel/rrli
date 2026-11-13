"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useAuthenticatedActor } from "@/components/auth-context";
import { RoundedSelect, type SelectOption } from "@/components/rounded-select";
import { SingleDatePicker } from "@/components/single-date-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import type { DeliveryFilterOption } from "@/features/deliveries/server/delivery-repository";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  readBrowserPreviewDeliveries,
  upsertBrowserPreviewDelivery,
} from "@/features/deliveries/browser-preview-deliveries";
import { readBrowserPreviewTrucks } from "@/features/deliveries/browser-preview-trucks";
import { BASE_HELPERS, getFleetCrew } from "@/features/deliveries/driver-registry";
import {
  type ExpenseResolutionStatus,
} from "@/features/deliveries/delivery-domain";
import { getDeliveryDateWindow } from "@/features/deliveries/delivery-recording-policy";
import {
  handlePositiveDecimalKeyDown,
  handleSignedDecimalKeyDown,
  sanitizePersonNameInput,
  sanitizePositiveDecimalInput,
  sanitizeSignedDecimalInput,
} from "@/features/deliveries/delivery-input-utils";
import { formatPeso } from "@/lib/format";

type DropoffDraft = {
  id: string;
  storeName: string;
  destinationArea: string;
  entryFee: string;
  entryFeeStatus: ExpenseResolutionStatus;
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
  entryFee: "",
  entryFeeStatus: "confirmed",
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

export default function NewCompletedDeliveryPage() {
  const router = useRouter();
  const actor = useAuthenticatedActor();
  const isAdmin = actor.role === "admin";
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
  const [podFiles, setPodFiles] = useState<File[]>([]);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [truckTemperature, setTruckTemperature] = useState("");
  const [dropoffs, setDropoffs] = useState<DropoffDraft[]>([initialDropoff]);

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
    fuelRate: "85.00",
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
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/deliveries?page=1&pageSize=10", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok?: boolean;
          message?: string;
          filters?: ReferenceData;
        };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message ?? "Unable to load active clients and trucks.");
        }
        const nextReferences = payload.filters ?? { clients: [], trucks: [], drivers: [], helpers: [] };

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
        const browserDrivers = localDeliveries
          .map((delivery) => delivery.driverName?.trim())
          .filter((name): name is string => Boolean(name));
        const driverNames = new Set((nextReferences.drivers ?? []).map((driver) => driver.label.toLowerCase()));
        const extraDrivers = browserDrivers
          .filter((name) => {
            const key = name.toLowerCase();
            if (driverNames.has(key)) return false;
            driverNames.add(key);
            return true;
          })
          .map((name) => ({ id: `driver-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: name }));

        const baseHelpersList: DeliveryFilterOption[] = [
          ...(nextReferences.helpers ?? []),
          ...BASE_HELPERS.map((h) => ({ id: h.id, label: h.fullName })),
          ...getFleetCrew().filter((c) => c.assignmentType === "Helper").map((h) => ({ id: h.id, label: h.fullName })),
        ];
        const helperNames = new Set(baseHelpersList.map((h) => h.label.toLowerCase()));
        const browserHelpers = localDeliveries
          .filter((delivery) => Boolean(delivery.helperName))
          .flatMap((delivery) => delivery.helperName!.split(/[,/&]/).map((h) => h.trim()))
          .filter(Boolean);
        const extraHelpers = browserHelpers
          .filter((name) => {
            const key = name.toLowerCase();
            if (helperNames.has(key)) return false;
            helperNames.add(key);
            return true;
          })
          .map((name) => ({ id: `helper-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: name }));
        const mergedHelpers = [...baseHelpersList, ...extraHelpers].filter(
          (helper, index, all) =>
            all.findIndex((candidate) => candidate.label.toLowerCase() === helper.label.toLowerCase()) === index,
        );

        const mergedReferences = {
          clients: mergedClients,
          trucks: mergedTrucks,
          drivers: [...(nextReferences.drivers ?? []), ...extraDrivers],
          helpers: mergedHelpers,
        };
        setReferences(mergedReferences);
        setClientName(mergedReferences.clients[0]?.label ?? "");
        setPlateNumber(mergedReferences.trucks[0]?.label ?? "");
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

  const financialReview = useMemo(() => {
    const entryFeesComplete = dropoffs.every((stop) => stop.entryFeeStatus !== "unknown");
    const entryFees = entryFeesComplete
      ? dropoffs.reduce((sum, stop) => sum + (stop.entryFeeStatus === "confirmed" ? numberValue(stop.entryFee) ?? 0 : 0), 0)
      : null;

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

    const expensesComplete = activeExpenseKeys.every((key) => {
      const status = expenseStatuses[key];
      const isAllowance = key === "driverAllowance" || key === "helperAllowance" || key === "helper2Allowance";
      if (isAllowance) {
        return status === "not_applicable" || status === "confirmed";
      }
      return status === "not_applicable" || (status === "confirmed" && numberValue(values[key]) != null);
    });

    const totalExpenses = entryFees == null || !expensesComplete
      ? null
      : activeExpenseKeys.reduce((sum, key) => {
          const status = expenseStatuses[key];
          return sum + (status === "confirmed" ? numberValue(values[key]) ?? 0 : 0);
        }, entryFees);

    const revenue = numberValue(values.deliveryRate);
    return {
      entryFees,
      totalExpenses,
      netIncome: revenue == null || totalExpenses == null ? null : revenue - totalExpenses,
      revenue,
      additionalCharges: numberValue(values.additionalCharges),
    };
  }, [dropoffs, expenseStatuses, hasSecondHelper, values]);

  function updateValue(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateDropoff(id: string, field: keyof Omit<DropoffDraft, "id">, value: string) {
    setDropoffs((current) =>
      current.map((dropoff) => (dropoff.id === id ? { ...dropoff, [field]: value } : dropoff)),
    );
  }

  function addDropoff() {
    setDropoffs((current) => [
      ...current,
      { id: crypto.randomUUID(), storeName: "", destinationArea: "", entryFee: "", entryFeeStatus: "confirmed" },
    ]);
  }

  function buildPayload() {
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
    const firstPodName = podFiles[0]?.name;
    return {
      ...values,
      idempotencyKey: idempotencyKeyRef.current,
      clientName,
      plateNumber,
      truckTemperature: `${truckTemperature}°C`,
      recordingDelayed: values.deliveryDate < deliveryDateWindow.max,
      distanceKm: numberValue(values.distanceKm),
      fuelRate: numberValue(values.fuelRate),
      deliveryRate: numberValue(values.deliveryRate),
      additionalCharges: numberValue(values.additionalCharges),
      dieselExpenses: numberValue(values.dieselExpenses),
      tollGateExpenses: numberValue(values.tollGateExpenses),
      driverAllowance: numberValue(values.driverAllowance) ?? 0,
      driverDailyRate: numberValue(values.driverDailyRate),
      driverName: driverName.trim() || null,
      helperAllowance: numberValue(values.helperAllowance) ?? 0,
      helperDailyRate: numberValue(values.helperDailyRate),
      helperName: helper1Name.trim(),
      hasSecondHelper,
      helper2Allowance: hasSecondHelper ? (numberValue(values.helper2Allowance) ?? 0) : null,
      helper2DailyRate: hasSecondHelper ? numberValue(values.helper2DailyRate) : null,
      helper2Name: hasSecondHelper ? (helper2Name.trim() || null) : null,
      otherExpenses: numberValue(values.otherExpenses),
      dieselExpensesStatus: "confirmed" as ExpenseResolutionStatus,
      tollGateExpensesStatus: "confirmed" as ExpenseResolutionStatus,
      driverAllowanceStatus: "confirmed" as ExpenseResolutionStatus,
      driverDailyRateStatus: "confirmed" as ExpenseResolutionStatus,
      helperAllowanceStatus: "confirmed" as ExpenseResolutionStatus,
      helperDailyRateStatus: "confirmed" as ExpenseResolutionStatus,
      helper2AllowanceStatus: hasSecondHelper ? ("confirmed" as ExpenseResolutionStatus) : "not_applicable",
      helper2DailyRateStatus: hasSecondHelper ? ("confirmed" as ExpenseResolutionStatus) : "not_applicable",
      otherExpensesStatus: "confirmed" as ExpenseResolutionStatus,
      supportingDocuments: supportingFiles.map((file) => file.name),
      dropoffs: dropoffs.map((dropoff, index) => ({
        storeName: dropoff.storeName,
        destinationArea: dropoff.destinationArea,
        entryFee: numberValue(dropoff.entryFee) ?? 0,
        entryFeeStatus: "confirmed" as ExpenseResolutionStatus,
        podSubmitted: Boolean(firstPodName && index === 0),
        supportingDocsComplete: supportingFiles.length > 0,
        documentRef: index === 0 && firstPodName ? firstPodName : "Pending upload",
      })),
    };
  }

  function submitDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    if (!clientName.trim()) {
      setSubmitError("Select or enter a client name.");
      return;
    }
    if (!plateNumber.trim()) {
      setSubmitError("Select a registered truck.");
      return;
    }
    if (!truckTemperature.trim() || !Number.isFinite(Number(truckTemperature))) {
      setSubmitError("Enter a valid truck temperature.");
      return;
    }
    if (!values.distanceKm.trim() || !Number.isFinite(Number(values.distanceKm)) || Number(values.distanceKm) <= 0) {
      setSubmitError("Enter a valid trip distance in kilometers.");
      return;
    }
    if (!values.fuelRate.trim() || !Number.isFinite(Number(values.fuelRate)) || Number(values.fuelRate) <= 0) {
      setSubmitError("Enter a valid fuel rate per liter.");
      return;
    }
    if (driverName.trim().length < 2) {
      setSubmitError("Select a saved driver or enter a new driver name.");
      return;
    }
    if (!values.driverDailyRate || Number(values.driverDailyRate) <= 0) {
      setSubmitError("Driver daily rate must have a valid value.");
      return;
    }
    if (helper1Name.trim().length < 2) {
      setSubmitError("Select a saved helper or enter a new helper name.");
      return;
    }
    if (!values.helperDailyRate || Number(values.helperDailyRate) <= 0) {
      setSubmitError("Helper daily rate must have a valid value.");
      return;
    }
    if (hasSecondHelper) {
      if (helper2Name.trim().length < 2) {
        setSubmitError("Select or enter a name for Helper 2.");
        return;
      }
      if (!values.helper2DailyRate || Number(values.helper2DailyRate) <= 0) {
        setSubmitError("Daily rate for Helper 2 must have a valid value.");
        return;
      }
    }
    if (!values.deliveryRate || Number(values.deliveryRate) <= 0) {
      setSubmitError("Rate must have a valid value.");
      return;
    }
    if (!values.dieselExpenses || Number(values.dieselExpenses) < 0) {
      setSubmitError("Diesel fuel expense must have a valid value.");
      return;
    }
    if (!values.tollGateExpenses || Number(values.tollGateExpenses) < 0) {
      setSubmitError("Highway tolls expense must have a valid value.");
      return;
    }
    if (!values.otherExpenses || Number(values.otherExpenses) < 0) {
      setSubmitError("Other expenses must have a valid value.");
      return;
    }
    if (values.deliveryDate < "2024-01-01") {
      setSubmitError("Delivery date cannot be earlier than company foundation year (2024).");
      return;
    }
    if (!isAdmin && (values.deliveryDate < deliveryDateWindow.min || values.deliveryDate > deliveryDateWindow.max)) {
      setSubmitError(`Delivery date must be between ${deliveryDateWindow.min} and ${deliveryDateWindow.max}.`);
      return;
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
      router.push(`/deliveries?created=${encodeURIComponent(result.deliveryId ?? "")}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to record the completed delivery.");
      setSubmitting(false);
      setPreviewing(false);
    }
  }

  const noReferences =
    !referencesLoading && (references.clients.length === 0 || references.trucks.length === 0);

  return (
    <>
      <OperationalTopbar
        contextLabel={previewing ? `Preview / Waybill #${values.waybillNumber || "DRAFT"}` : "Record Completed Delivery"}
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
              <FormHeading number="02" title={`Store drop-offs (${dropoffs.length})`} />
              <div className="drawer-dropoff-timeline" aria-label="Drop-off stops sequence">
                {dropoffs.map((stop, index) => {
                  const isLast = index === dropoffs.length - 1;
                  const entryFeeVal = numberValue(stop.entryFee) ?? 0;
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
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="delivery-form-section">
              <FormHeading number="03" title="Rate & expenses" />
              <div className="detail-meta-grid">
                <div className="detail-meta-item">
                  <span className="meta-label">Delivery rate</span>
                  <strong className="meta-value">{formatPeso(numberValue(values.deliveryRate) ?? 0)}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Additional charges</span>
                  <strong className="meta-value">{formatPeso(numberValue(values.additionalCharges) ?? 0)}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Diesel fuel</span>
                  <strong className="meta-value">{formatPeso(numberValue(values.dieselExpenses) ?? 0)}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Highway tolls</span>
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

              <div className="delivery-financial-review" aria-label="Financial review">
                <div><span>Revenue</span><strong>{formatPeso(financialReview.revenue)}</strong></div>
                <div><span>Store Entry Fees</span><strong>{formatPeso(financialReview.entryFees)}</strong></div>
                <div><span>Expenses</span><strong>{formatPeso(financialReview.totalExpenses)}</strong></div>
                <div className={financialReview.netIncome == null ? "" : financialReview.netIncome < 0 ? "negative" : "positive"}>
                  <span>Net Profit</span>
                  <strong>{formatPeso(financialReview.netIncome)}</strong>
                </div>
              </div>
            </section>

            <section className="delivery-form-section">
              <FormHeading number="04" title="Documents" />
              <DeliveryFilePreview podFiles={podFiles} supportingFiles={supportingFiles} />
            </section>

            <div className="delivery-form-actions">
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
                {submitting ? "Recording…" : "Record delivery"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
      <header className="page-intro">
        <div>
          <Link className="back-link" href="/deliveries">← Back to deliveries</Link>
          <h1>Record delivery</h1>
          <p className="subtitle">
            Complete trip details, store drop-offs, financials, and supporting documents.
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
              <span className="field-label-text">Waybill</span>
              <input
                required
                value={values.waybillNumber}
                onChange={(event) => updateValue("waybillNumber", event.target.value)}
                placeholder="WB-2026-0001"
              />
            </label>
            <label>
              <span className="field-label-text">Delivery date</span>
              <SingleDatePicker
                required
                min={isAdmin ? "2024-01-01" : deliveryDateWindow.min}
                max={isAdmin ? undefined : deliveryDateWindow.max}
                value={values.deliveryDate}
                onChange={(nextDate) => {
                  updateValue("deliveryDate", nextDate);
                }}
              />
            </label>
            <div className="client-field-group">
              <label className="field-label-text">Client</label>
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
              <label className="field-label-text">Truck plate</label>
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
                  required
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
                    required
                    type="text"
                    inputMode="decimal"
                    className="no-spin-stepper peso-input"
                    value={values.fuelRate}
                    onKeyDown={handlePositiveDecimalKeyDown}
                    onChange={(event) => updateValue("fuelRate", sanitizePositiveDecimalInput(event.target.value, 2))}
                    placeholder="85.00"
                  />
                </span>
              </label>
            </div>

            <label className="origin-field">
              <span className="field-label-text">Origin</span>
              <input
                required
                value={values.origin}
                onChange={(event) => updateValue("origin", event.target.value)}
                placeholder="e.g. Marilao Depot"
              />
            </label>
            <label>
              <span className="field-label-text">Distance (km)</span>
              <input
                required
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
          <FormHeading number="02" title="Drop-offs" />
          <div className="dropoff-editor">
            {dropoffs.map((dropoff, index) => (
              <div key={dropoff.id} className="dropoff-row">
                <div className="dropoff-row-header">
                  <span className="dropoff-row-title">{getStopLabel(index)}</span>
                  {dropoffs.length > 1 ? (
                    <button
                      type="button"
                      className="dropoff-remove"
                      onClick={() => setDropoffs((current) => current.filter((item) => item.id !== dropoff.id))}
                      aria-label={`Remove ${getStopLabel(index)}`}
                      title={`Remove ${getStopLabel(index)}`}
                    >
                      × Remove
                    </button>
                  ) : null}
                </div>
                <div className="dropoff-fields">
                  <label className="dropoff-field">
                    <span className="field-label-text">Store name</span>
                    <input
                      required
                      value={dropoff.storeName}
                      onChange={(event) => updateDropoff(dropoff.id, "storeName", event.target.value)}
                      placeholder="e.g. Landers Balintawak"
                    />
                  </label>
                  <label className="dropoff-field">
                    <span className="field-label-text">Location</span>
                    <input
                      required
                      value={dropoff.destinationArea}
                      onChange={(event) => updateDropoff(dropoff.id, "destinationArea", event.target.value)}
                      placeholder="e.g. Quezon City, Metro Manila"
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
              </div>
            ))}
            <div className="dropoff-actions-bar">
              <button type="button" className="secondary-button add-dropoff" onClick={addDropoff}>
                + Add store
              </button>
              <span className="dropoff-counter">
                {dropoffs.length} {dropoffs.length === 1 ? "stop" : "stops"}
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
                        required
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

            <h3 className="delivery-finance-group-title wide">Trip Expenses</h3>
            <div className="direct-expense-field">
              <label>
                <span className="field-label-text">Diesel fuel</span>
                <span className="peso-input-wrap">
                  <span className="peso-prefix" aria-hidden="true">₱</span>
                  <input
                    required
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
                <span className="field-label-text">Highway tolls</span>
                <span className="peso-input-wrap">
                  <span className="peso-prefix" aria-hidden="true">₱</span>
                  <input
                    required
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
                    required
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

            {/* Crew Expenses with Support for 2 Helpers */}
            <div className="crew-expense-groups wide">
              <div className="crew-expense-header-bar">
                <h4 className="crew-section-subtitle">Crew Compensation</h4>
                {!hasSecondHelper ? (
                  <button
                    type="button"
                    className="secondary-button add-second-helper-btn"
                    title="Add a second helper to this delivery crew"
                    onClick={() => {
                      setHasSecondHelper(true);
                      setExpenseStatuses((cur) => ({
                        ...cur,
                        helper2DailyRate: "confirmed",
                        helper2Allowance: "confirmed",
                      }));
                    }}
                  >
                    + Add helper
                  </button>
                ) : (
                  <span className="crew-max-badge" title="Maximum 2 helpers">
                    2 Helpers (Max)
                  </span>
                )}
              </div>

              <div className="crew-cards-grid">
                {/* Driver Card */}
                <section className="crew-expense-group">
                  <div className="crew-card-title-row">
                    <span className="crew-role-pill driver">Driver</span>
                    <RoundedSelect
                      value={driverName}
                      options={references.drivers.map((driver) => ({
                        value: driver.label,
                        label: driver.label,
                      }))}
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
                  <div className="crew-expense-fields-row">
                    <div className="daily-rate-field">
                      <label>
                        <span className="field-label-text">Daily rate</span>
                        <span className="peso-input-wrap">
                          <span className="peso-prefix" aria-hidden="true">₱</span>
                          <input
                            aria-label="Driver daily rate"
                            required
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
                        <span className="field-label-text">Allowance</span>
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
                </section>

                {/* Helper 1 Card */}
                <section className="crew-expense-group">
                  <div className="crew-card-title-row">
                    <span className="crew-role-pill helper">
                      {hasSecondHelper ? "Helper 1" : "Helper"}
                    </span>
                    <RoundedSelect
                      value={helper1Name}
                      options={references.helpers.map((helper) => ({
                        value: helper.label,
                        label: helper.label,
                      }))}
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
                  <div className="crew-expense-fields-row">
                    <div className="daily-rate-field">
                      <label>
                        <span className="field-label-text">Daily rate</span>
                        <span className="peso-input-wrap">
                          <span className="peso-prefix" aria-hidden="true">₱</span>
                          <input
                            aria-label="Helper daily rate"
                            required
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
                        <span className="field-label-text">Allowance</span>
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
                </section>

                {/* Helper 2 Card (When added) */}
                {hasSecondHelper ? (
                  <section className="crew-expense-group helper-2-card">
                    <div className="crew-card-title-row">
                      <span className="crew-role-pill helper-2">Helper 2</span>
                      <RoundedSelect
                        value={helper2Name}
                        options={references.helpers.map((helper) => ({
                          value: helper.label,
                          label: helper.label,
                        }))}
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
                        title="Remove second helper"
                      >
                        × Remove
                      </button>
                    </div>
                    <div className="crew-expense-fields-row">
                      <div className="daily-rate-field">
                        <label>
                          <span className="field-label-text">Daily rate</span>
                          <span className="peso-input-wrap">
                            <span className="peso-prefix" aria-hidden="true">₱</span>
                            <input
                              aria-label="Helper 2 daily rate"
                              required
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
                          <span className="field-label-text">Allowance</span>
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
                  </section>
                ) : null}
              </div>
            </div>
          </div>

          <div className="delivery-financial-review" aria-label="Financial review">
            <div><span>Revenue</span><strong>{formatPeso(financialReview.revenue)}</strong></div>
            <div><span>Store Entry Fees</span><strong>{formatPeso(financialReview.entryFees)}</strong></div>
            <div><span>Expenses</span><strong>{formatPeso(financialReview.totalExpenses)}</strong></div>
            <div className={financialReview.netIncome == null ? "" : financialReview.netIncome < 0 ? "negative" : "positive"}><span>Net Profit</span><strong>{formatPeso(financialReview.netIncome)}</strong></div>
          </div>
        </section>

        <section className="delivery-form-section">
          <FormHeading number="04" title="Documents" />
          <div className="delivery-upload-grid">
            <FileUploadField
              id="delivery-pod-files"
              label="Proof of delivery"
              helper="PDF, PNG, or JPG"
              files={podFiles}
              onChange={setPodFiles}
            />
            <FileUploadField
              id="delivery-supporting-files"
              label="Supporting documents"
              helper="Receiving slips or attachments"
              files={supportingFiles}
              onChange={setSupportingFiles}
            />
          </div>
        </section>

        <div className="delivery-form-actions">
          <Link className="secondary-button" href="/deliveries">Cancel</Link>
          <button className="primary-action-button" type="submit" disabled={submitting || referencesLoading || noReferences}>
            Preview delivery
          </button>
        </div>
        {noReferences ? <p className="delivery-reference-warning">At least one client and truck required.</p> : null}
      </form>
        </>
      )}
      </div>
    </>
  );
}

function DeliveryFilePreview({
  podFiles,
  supportingFiles,
}: {
  podFiles: File[];
  supportingFiles: File[];
}) {
  const [previews, setPreviews] = useState<Array<{
    file: File;
    kind: "pod" | "supporting";
    url: string;
  }>>([]);

  useEffect(() => {
    const nextPreviews = [
      ...podFiles.map((file) => ({ file, kind: "pod" as const, url: URL.createObjectURL(file) })),
      ...supportingFiles.map((file) => ({ file, kind: "supporting" as const, url: URL.createObjectURL(file) })),
    ];

    setPreviews(nextPreviews);
    return () => nextPreviews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [podFiles, supportingFiles]);

  if (previews.length === 0) {
    return <p className="delivery-file-preview-empty">No files attached.</p>;
  }

  return (
    <div className="delivery-file-preview-grid">
      {previews.map(({ file, kind, url }, index) => (
        <article className="delivery-file-preview-card" key={`${kind}-${file.name}-${file.lastModified}-${index}`}>
          <div className="delivery-file-preview-visual">
            {file.type.startsWith("image/") ? (
              // Browser-created object URLs cannot be optimized by next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={`Preview of ${file.name}`} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 3.5h6l4 4V20.5H7V3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M13 3.5v4h4M9.5 12h5M9.5 15h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div className="delivery-file-preview-copy">
            <span>{kind === "pod" ? "POD" : "Supporting"}</span>
            <strong title={file.name}>{file.name}</strong>
          </div>
          <a
            className="delivery-file-view-action ui-tooltip"
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={`View ${file.name}`}
            data-tooltip="View file"
            title="View file"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3.5 12s3.1-5 8.5-5 8.5 5 8.5 5-3.1 5-8.5 5-8.5-5-8.5-5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </a>
        </article>
      ))}
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


