const fs = require('fs');

const fullNewPageContent = `"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { RoundedSelect } from "@/components/rounded-select";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RecordDetailDrawer, type DetailSection } from "@/components/record-detail-drawer";
import type { DeliveryFilterOption } from "@/features/deliveries/server/delivery-repository";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  readBrowserPreviewDeliveries,
  saveBrowserPreviewDelivery,
} from "@/features/deliveries/browser-preview-deliveries";
import { readBrowserPreviewTrucks } from "@/features/deliveries/browser-preview-trucks";
import type { ExpenseResolutionStatus } from "@/features/deliveries/delivery-domain";
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
};

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
  return \`\${today.getFullYear()}-\${String(today.getMonth() + 1).padStart(2, "0")}-\${String(today.getDate()).padStart(2, "0")}\`;
}

export default function NewCompletedDeliveryPage() {
  const router = useRouter();
  const [references, setReferences] = useState<ReferenceData>({ clients: [], trucks: [] });
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const idempotencyKeyRef = useRef("");
  const [clientName, setClientName] = useState("");
  const [isNewClientMode, setIsNewClientMode] = useState(false);
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

  const [expenseStatuses, setExpenseStatuses] = useState({
    dieselExpenses: "confirmed",
    tollGateExpenses: "confirmed",
    driverAllowance: "confirmed",
    driverDailyRate: "confirmed",
    helperAllowance: "confirmed",
    helperDailyRate: "confirmed",
    helper2Allowance: "confirmed",
    helper2DailyRate: "confirmed",
    otherExpenses: "confirmed",
  } satisfies Record<string, ExpenseResolutionStatus>);

  const [values, setValues] = useState({
    waybillNumber: "",
    deliveryDate: todayKey(),
    origin: "",
    distanceKm: "0",
    fuelRate: "85.00",
    deliveryRate: "0",
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
        const nextReferences = payload.filters ?? { clients: [], trucks: [] };

        // Merge custom clients from locally recorded deliveries
        const localDeliveries = readBrowserPreviewDeliveries();
        const existingClientNames = new Set(nextReferences.clients.map((c) => c.label.toLowerCase()));
        const extraClients: DeliveryFilterOption[] = [];
        for (const delivery of localDeliveries) {
          if (delivery.clientName && !existingClientNames.has(delivery.clientName.toLowerCase())) {
            existingClientNames.add(delivery.clientName.toLowerCase());
            extraClients.push({
              id: delivery.clientId || \`client-\${delivery.clientName.toLowerCase().replace(/[^a-z0-9]/g, "-")}\`,
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
        const mergedReferences = { clients: mergedClients, trucks: mergedTrucks };
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

  const financialReview = useMemo(() => {
    const entryFeesComplete = dropoffs.every((stop) => stop.entryFeeStatus !== "unknown");
    const entryFees = entryFeesComplete
      ? dropoffs.reduce((sum, stop) => sum + (stop.entryFeeStatus === "confirmed" ? numberValue(stop.entryFee) ?? 0 : 0), 0)
      : null;

    // Active keys accounting for Helper 1 and conditionally Helper 2 without duplication
    const activeExpenseKeys: (keyof typeof expenseStatuses)[] = [
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
      truckTemperature: \`\${truckTemperature}°C\`,
      distanceKm: numberValue(values.distanceKm),
      fuelRate: numberValue(values.fuelRate),
      deliveryRate: numberValue(values.deliveryRate),
      dieselExpenses: numberValue(values.dieselExpenses),
      tollGateExpenses: numberValue(values.tollGateExpenses),
      driverAllowance: numberValue(values.driverAllowance),
      driverDailyRate: numberValue(values.driverDailyRate),
      driverName: driverName.trim() || null,
      helperAllowance: numberValue(values.helperAllowance),
      helperDailyRate: numberValue(values.helperDailyRate),
      helperName: helper1Name.trim() || null,
      hasSecondHelper,
      helper2Allowance: hasSecondHelper ? numberValue(values.helper2Allowance) : null,
      helper2DailyRate: hasSecondHelper ? numberValue(values.helper2DailyRate) : null,
      helper2Name: hasSecondHelper ? (helper2Name.trim() || null) : null,
      otherExpenses: numberValue(values.otherExpenses),
      dieselExpensesStatus: expenseStatuses.dieselExpenses,
      tollGateExpensesStatus: expenseStatuses.tollGateExpenses,
      driverAllowanceStatus: expenseStatuses.driverAllowance,
      driverDailyRateStatus: expenseStatuses.driverDailyRate,
      helperAllowanceStatus: expenseStatuses.helperAllowance,
      helperDailyRateStatus: expenseStatuses.helperDailyRate,
      helper2AllowanceStatus: hasSecondHelper ? expenseStatuses.helper2Allowance : "not_applicable",
      helper2DailyRateStatus: hasSecondHelper ? expenseStatuses.helper2DailyRate : "not_applicable",
      otherExpensesStatus: expenseStatuses.otherExpenses,
      dropoffs: dropoffs.map((dropoff, index) => ({
        storeName: dropoff.storeName,
        destinationArea: dropoff.destinationArea,
        entryFee: numberValue(dropoff.entryFee),
        entryFeeStatus: dropoff.entryFeeStatus,
        podSubmitted: Boolean(firstPodName && index === 0),
        supportingDocsComplete: false,
        documentRef: index === 0 && firstPodName ? firstPodName : "Pending upload",
      })),
    };
  }

  function submitDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    buildPayload();
    setPreviewing(true);
  }

  async function recordDelivery() {
    setSubmitError(null);
    setSubmitting(true);
    const payload = buildPayload();

    try {
      const response = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      if (result.previewRecord) saveBrowserPreviewDelivery(result.previewRecord);
      router.push(\`/deliveries?created=\${encodeURIComponent(result.deliveryId ?? "")}\`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to record the completed delivery.");
      setSubmitting(false);
      setPreviewing(false);
    }
  }

  const previewSections = useMemo<DetailSection[]>(() => [
    {
      eyebrow: "TRIP DETAILS",
      title: "Delivery overview",
      rows: [
        { label: "Waybill", value: values.waybillNumber || "Not entered" },
        { label: "Delivery date", value: values.deliveryDate },
        { label: "Client", value: clientName || "Not selected" },
        { label: "Origin", value: values.origin || "Not entered" },
      ],
    },
    {
      eyebrow: "ASSIGNMENT",
      title: "Truck and trip",
      rows: [
        { label: "Truck", value: plateNumber || "Not selected" },
        { label: "Temperature", value: truckTemperature ? \`\${truckTemperature}°C\` : "Not entered" },
        { label: "Distance", value: \`\${values.distanceKm || "0"} km\` },
        { label: "Fuel rate", value: \`\${formatPeso(numberValue(values.fuelRate))} / liter\` },
      ],
    },
    {
      eyebrow: "CREW ASSIGNMENT",
      title: \`Trip Crew (1 Driver · \${hasSecondHelper ? "2 Helpers" : "1 Helper"})\`,
      rows: [
        {
          label: "Driver",
          value: \`\${driverName ? \`\${driverName} — \` : ""}Rate: \${formatPeso(numberValue(values.driverDailyRate))} | Allowance: \${formatPeso(numberValue(values.driverAllowance))}\`,
        },
        {
          label: hasSecondHelper ? "Helper 1" : "Helper",
          value: \`\${helper1Name ? \`\${helper1Name} — \` : ""}Rate: \${formatPeso(numberValue(values.helperDailyRate))} | Allowance: \${formatPeso(numberValue(values.helperAllowance))}\`,
        },
        ...(hasSecondHelper
          ? [
              {
                label: "Helper 2",
                value: \`\${helper2Name ? \`\${helper2Name} — \` : ""}Rate: \${formatPeso(numberValue(values.helper2DailyRate))} | Allowance: \${formatPeso(numberValue(values.helper2Allowance))}\`,
              },
            ]
          : []),
      ],
    },
    {
      eyebrow: "STOP SEQUENCE",
      title: \`Route and drop-offs (\${dropoffs.length})\`,
      fullWidth: true,
      customContent: (
        <ol className="delivery-preview-stops">
          {dropoffs.map((dropoff) => (
            <li key={dropoff.id}>
              <strong>{dropoff.storeName}</strong>
              <span>{dropoff.destinationArea}</span>
            </li>
          ))}
        </ol>
      ),
    },
    {
      eyebrow: "FINANCIAL REVIEW",
      title: "Revenue and expenses",
      rows: [
        { label: "Delivery Rate (Gross Revenue)", value: formatPeso(financialReview.revenue) },
        { label: "Store entry fees", value: formatPeso(financialReview.entryFees) },
        { label: "Total expenses", value: formatPeso(financialReview.totalExpenses) },
        {
          label: "Net profit",
          value: formatPeso(financialReview.netIncome),
          tone: financialReview.netIncome != null && financialReview.netIncome < 0 ? "warning" : "success",
        },
      ],
    },
    {
      eyebrow: "FILES",
      title: "POD and supporting documents",
      rows: [
        { label: "Proof of delivery", value: podFiles.map((file) => file.name).join(", ") || "None attached" },
        { label: "Supporting files", value: supportingFiles.map((file) => file.name).join(", ") || "None attached" },
      ],
    },
  ], [
    clientName,
    driverName,
    dropoffs,
    financialReview,
    hasSecondHelper,
    helper1Name,
    helper2Name,
    plateNumber,
    podFiles,
    supportingFiles,
    truckTemperature,
    values,
  ]);

  const noReferences =
    !referencesLoading && (references.clients.length === 0 || references.trucks.length === 0);

  return (
    <>
      <OperationalTopbar contextLabel="Record Completed Delivery" />
      <div className="content-wrap delivery-entry-page">
      <header className="page-intro">
        <div>
          <Link className="back-link" href="/deliveries">← Back to deliveries</Link>
          <h1>Record delivery</h1>
          <p className="subtitle">
            Record completed trip and store drop-offs.
          </p>
        </div>
      </header>

      <form className="delivery-entry-form" onSubmit={submitDelivery}>
        {referenceError ? <div className="delivery-form-alert" role="alert">{referenceError}</div> : null}
        {submitError ? <div className="delivery-form-alert" role="alert">{submitError}</div> : null}

        <section className="delivery-form-section">
          <FormHeading number="01" title="Trip information" />
          <div className="delivery-field-grid delivery-trip-grid">
            <label>Waybill<input required value={values.waybillNumber} onChange={(event) => updateValue("waybillNumber", event.target.value)} placeholder="WB-2026-0001" /></label>
            <label>Delivery date
              <span className="delivery-date-input">
                <input required type="date" value={values.deliveryDate} onChange={(event) => updateValue("deliveryDate", event.target.value)} />
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </span>
            </label>
            <div className="client-field-group">
              <div className="client-field-header">
                <label htmlFor={isNewClientMode ? "new-client-name-input" : undefined}>
                  Client
                </label>
                <button
                  type="button"
                  className="client-mode-toggle"
                  onClick={() => {
                    const nextMode = !isNewClientMode;
                    setIsNewClientMode(nextMode);
                    if (nextMode) {
                      setClientName("");
                    } else if (references.clients.length > 0) {
                      setClientName(references.clients[0]?.label ?? "");
                    }
                  }}
                >
                  {isNewClientMode ? "← Select existing" : "+ New client"}
                </button>
              </div>

              {isNewClientMode ? (
                <div className="new-client-input-wrap">
                  <input
                    id="new-client-name-input"
                    required
                    type="text"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="Client name"
                    autoFocus
                  />
                  <span className="new-client-badge">New</span>
                </div>
              ) : (
                <RoundedSelect
                  value={clientName}
                  options={references.clients.map((option) => ({ value: option.label, label: option.label }))}
                  onChange={(val) => setClientName(val)}
                  ariaLabel="Select active client"
                  placeholder={referencesLoading ? "Loading clients…" : "Select client"}
                  emptyMessage={referenceError ? "Clients could not be loaded" : "No active clients available"}
                  searchable
                />
              )}
            </div>

            {/* Truck Selection strictly from registered fleet trucks */}
            <div className="client-field-group">
              <div className="client-field-header">
                <label>Truck plate</label>
                <span className="field-hint">Fleet registry</span>
              </div>
              <RoundedSelect
                value={plateNumber}
                options={references.trucks.map((option) => ({
                  value: option.label,
                  label: option.label,
                  group: option.ownershipType === "Subcontracted" ? "Subcontracted Trucks" : "Owned Trucks",
                }))}
                onChange={(val) => setPlateNumber(val)}
                ariaLabel="Select registered truck"
                placeholder={referencesLoading ? "Loading trucks…" : "Select registered truck"}
                emptyMessage={referenceError ? "Trucks could not be loaded" : "No active trucks registered in Fleet"}
                searchable
              />
            </div>

            <label>Temperature
              <span className="temperature-input-wrap">
                <input
                  required
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={truckTemperature}
                  placeholder="e.g. 4"
                  className="no-spin-stepper"
                  style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
                  aria-describedby="delivery-temperature-unit"
                  onChange={(event) => setTruckTemperature(event.target.value)}
                />
                <span id="delivery-temperature-unit" aria-hidden="true">°C</span>
              </span>
            </label>
            <label className="origin-field">Origin<input required value={values.origin} onChange={(event) => updateValue("origin", event.target.value)} placeholder="e.g. Marilao Depot" /></label>
            <label>Distance (km)<input required min="0" step="0.01" type="number" inputMode="decimal" className="no-spin-stepper" style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }} value={values.distanceKm} onChange={(event) => updateValue("distanceKm", event.target.value)} /></label>

            {/* Fuel Rate with explicit distinction from Delivery Rate */}
            <div className="fuel-rate-field-wrap">
              <label>
                <span className="field-label-text">Fuel rate (₱ / Liter)</span>
                <span className="peso-input-wrap">
                  <span className="peso-prefix" aria-hidden="true">₱</span>
                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    inputMode="decimal"
                    className="no-spin-stepper peso-input"
                    style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
                    value={values.fuelRate}
                    onChange={(event) => updateValue("fuelRate", event.target.value)}
                    placeholder="85.00"
                  />
                </span>
              </label>
              <span className="field-explanatory-note">
                Pump price per liter of fuel (e.g. ₱85.00/L). Reference for diesel costs, distinct from the gross Delivery Rate.
              </span>
            </div>
          </div>
        </section>

        <section className="delivery-form-section">
          <FormHeading number="02" title="Stores & drop-offs" />
          <div className="dropoff-editor">
            {dropoffs.map((dropoff, index) => (
              <div key={dropoff.id} className="dropoff-row">
                <div className="dropoff-row-header">
                  <span className="dropoff-row-title">Stop {index + 1}</span>
                  {dropoffs.length > 1 ? (
                    <button
                      type="button"
                      className="dropoff-remove"
                      onClick={() => setDropoffs((current) => current.filter((item) => item.id !== dropoff.id))}
                      aria-label={\`Remove Stop \${index + 1}\`}
                    >
                      ✕ Remove
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
                    <span className="field-label-text">Destination</span>
                    <input
                      required
                      value={dropoff.destinationArea}
                      onChange={(event) => updateDropoff(dropoff.id, "destinationArea", event.target.value)}
                      placeholder="e.g. Quezon City, Metro Manila"
                    />
                  </label>
                  <div className="dropoff-field dropoff-entry-fee-wrap">
                    <ExpenseField
                      label="Entry fee (₱)"
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
                {dropoffs.length} {dropoffs.length === 1 ? "stop recorded" : "stops recorded"}
              </span>
            </div>
          </div>
        </section>

        <section className="delivery-form-section">
          <FormHeading number="03" title="Revenue & expenses" />
          <div className="delivery-field-grid delivery-finance-grid">

            {/* Delivery Rate with prominent clarification */}
            <div className="delivery-rate-banner wide">
              <div className="delivery-rate-banner-header">
                <h3 className="delivery-finance-group-title">Revenue: Delivery Rate</h3>
                <span className="delivery-rate-pill">Gross Freight Amount</span>
              </div>
              <p className="delivery-rate-clarification">
                <strong>Delivery Rate</strong> is the total gross billable revenue for this trip (the larger monetary amount). This is independent from the per-liter <strong>Fuel Rate</strong> above. Business formula calculation is pending formal verification.
              </p>
              <div className="delivery-rate-input-row">
                <MoneyField
                  label="Delivery Rate (Gross Trip Revenue ₱)"
                  value={values.deliveryRate}
                  required
                  onChange={(value) => updateValue("deliveryRate", value)}
                />
              </div>
            </div>

            <h3 className="delivery-finance-group-title wide">Operational Expenses</h3>
            {(["dieselExpenses", "tollGateExpenses", "otherExpenses"] as (keyof typeof expenseStatuses)[]).map((key) => (
              <ExpenseField
                key={key}
                label={expenseLabel(key)}
                value={values[key]}
                status={expenseStatuses[key]}
                onValueChange={(value) => updateValue(key, value)}
                onStatusChange={(status) => {
                  setExpenseStatuses((current) => ({ ...current, [key]: status }));
                  if (status !== "confirmed") updateValue(key, "");
                }}
              />
            ))}

            {/* Crew Expenses with Support for 2 Helpers */}
            <div className="crew-expense-groups wide">
              <div className="crew-expense-header-bar">
                <div>
                  <h4 className="crew-section-subtitle">Delivery Crew Rates & Allowances</h4>
                  <p className="crew-section-caption">
                    Daily compensation and travel allowances per personnel (maximum 2 helpers).
                  </p>
                </div>
                {!hasSecondHelper ? (
                  <button
                    type="button"
                    className="secondary-button add-second-helper-btn"
                    onClick={() => {
                      setHasSecondHelper(true);
                      setExpenseStatuses((cur) => ({
                        ...cur,
                        helper2DailyRate: "confirmed",
                        helper2Allowance: "confirmed",
                      }));
                    }}
                  >
                    + Add Second Helper
                  </button>
                ) : (
                  <span className="crew-max-badge" title="Maximum limit of 2 helpers reached">
                    ✓ 2 Helpers Assigned (Max Limit)
                  </span>
                )}
              </div>

              <div className="crew-cards-grid">
                {/* Driver Card */}
                <section className="crew-expense-group">
                  <div className="crew-card-title-row">
                    <span className="crew-role-pill driver">Driver</span>
                    <input
                      type="text"
                      className="crew-name-input"
                      placeholder="Driver Name (Optional)"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                    />
                  </div>
                  <div className="crew-expense-fields-row">
                    <ExpenseField
                      label="Daily rate"
                      value={values.driverDailyRate}
                      status={expenseStatuses.driverDailyRate}
                      onValueChange={(value) => updateValue("driverDailyRate", value)}
                      onStatusChange={(status) => {
                        setExpenseStatuses((current) => ({ ...current, driverDailyRate: status }));
                        if (status !== "confirmed") updateValue("driverDailyRate", "");
                      }}
                    />
                    <ExpenseField
                      label="Allowance"
                      value={values.driverAllowance}
                      status={expenseStatuses.driverAllowance}
                      onValueChange={(value) => updateValue("driverAllowance", value)}
                      onStatusChange={(status) => {
                        setExpenseStatuses((current) => ({ ...current, driverAllowance: status }));
                        if (status !== "confirmed") updateValue("driverAllowance", "");
                      }}
                    />
                  </div>
                </section>

                {/* Helper 1 Card */}
                <section className="crew-expense-group">
                  <div className="crew-card-title-row">
                    <span className="crew-role-pill helper">
                      {hasSecondHelper ? "Helper 1 (Lead)" : "Helper"}
                    </span>
                    <input
                      type="text"
                      className="crew-name-input"
                      placeholder={hasSecondHelper ? "Helper 1 Name (Optional)" : "Helper Name (Optional)"}
                      value={helper1Name}
                      onChange={(e) => setHelper1Name(e.target.value)}
                    />
                  </div>
                  <div className="crew-expense-fields-row">
                    <ExpenseField
                      label="Daily rate"
                      value={values.helperDailyRate}
                      status={expenseStatuses.helperDailyRate}
                      onValueChange={(value) => updateValue("helperDailyRate", value)}
                      onStatusChange={(status) => {
                        setExpenseStatuses((current) => ({ ...current, helperDailyRate: status }));
                        if (status !== "confirmed") updateValue("helperDailyRate", "");
                      }}
                    />
                    <ExpenseField
                      label="Allowance"
                      value={values.helperAllowance}
                      status={expenseStatuses.helperAllowance}
                      onValueChange={(value) => updateValue("helperAllowance", value)}
                      onStatusChange={(status) => {
                        setExpenseStatuses((current) => ({ ...current, helperAllowance: status }));
                        if (status !== "confirmed") updateValue("helperAllowance", "");
                      }}
                    />
                  </div>
                </section>

                {/* Helper 2 Card (When added) */}
                {hasSecondHelper ? (
                  <section className="crew-expense-group helper-2-card">
                    <div className="crew-card-title-row">
                      <span className="crew-role-pill helper-2">Helper 2</span>
                      <input
                        type="text"
                        className="crew-name-input"
                        placeholder="Helper 2 Name (Optional)"
                        value={helper2Name}
                        onChange={(e) => setHelper2Name(e.target.value)}
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
                        ✕ Remove
                      </button>
                    </div>
                    <div className="crew-expense-fields-row">
                      <ExpenseField
                        label="Daily rate"
                        value={values.helper2DailyRate}
                        status={expenseStatuses.helper2DailyRate}
                        onValueChange={(value) => updateValue("helper2DailyRate", value)}
                        onStatusChange={(status) => {
                          setExpenseStatuses((current) => ({ ...current, helper2DailyRate: status }));
                          if (status !== "confirmed") updateValue("helper2DailyRate", "");
                        }}
                      />
                      <ExpenseField
                        label="Allowance"
                        value={values.helper2Allowance}
                        status={expenseStatuses.helper2Allowance}
                        onValueChange={(value) => updateValue("helper2Allowance", value)}
                        onStatusChange={(status) => {
                          setExpenseStatuses((current) => ({ ...current, helper2Allowance: status }));
                          if (status !== "confirmed") updateValue("helper2Allowance", "");
                        }}
                      />
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>

          <div className="delivery-financial-review" aria-label="Financial review">
            <div><span>Revenue</span><strong>{formatPeso(financialReview.revenue)}</strong></div>
            <div><span>Store entry fees</span><strong>{formatPeso(financialReview.entryFees)}</strong></div>
            <div><span>Total expenses</span><strong>{formatPeso(financialReview.totalExpenses)}</strong></div>
            <div className={financialReview.netIncome != null && financialReview.netIncome < 0 ? "negative" : "positive"}><span>Net profit</span><strong>{formatPeso(financialReview.netIncome)}</strong></div>
          </div>
        </section>

        <section className="delivery-form-section delivery-document-note">
          <FormHeading number="04" title="POD & supporting documents" />
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
              helper="Receiving slips and attachments"
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
        {noReferences ? <p className="delivery-reference-warning">At least one active client and one active Fleet truck are required before a delivery can be recorded.</p> : null}
      </form>
      </div>
      <RecordDetailDrawer
        open={previewing}
        eyebrow={\`WAYBILL \${values.waybillNumber || "PREVIEW"}\`}
        title={clientName || "Delivery review"}
        statusLabel="Ready to record"
        sections={previewSections}
        onClose={() => !submitting && setPreviewing(false)}
        footer={(
          <>
            <button type="button" className="secondary-button" disabled={submitting} onClick={() => setPreviewing(false)}>Back to edit</button>
            <button type="button" className="primary-action-button" disabled={submitting} onClick={recordDelivery}>
              {submitting ? "Recording delivery…" : "Confirm and record"}
            </button>
          </>
        )}
      />
    </>
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

function MoneyField({ label, value, required = false, onChange }: { label: string; value: string; required?: boolean; onChange: (value: string) => void }) {
  const displayLabel = label.includes("₱") ? label : \`\${label} (₱)\`;
  return (
    <label>
      <span className="field-label-text">{displayLabel}</span>
      <span className="peso-input-wrap">
        <span className="peso-prefix" aria-hidden="true">₱</span>
        <input
          required={required}
          min={required ? "0.01" : "0"}
          step="0.01"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          className="no-spin-stepper peso-input"
          style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
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
          <strong>{files.length ? \`\${files.length} file\${files.length === 1 ? "" : "s"} selected\` : "Choose files"}</strong>
          <small>{files.length ? files.map((file) => file.name).join(", ") : "Select files from your device"}</small>
        </span>
        <span className="delivery-upload-browse">Browse</span>
        <input
          key={files.map((file) => \`\${file.name}:\${file.size}\`).join("|") || "empty"}
          id={id}
          className="delivery-upload-input"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          multiple
          aria-label={\`Choose \${label.toLocaleLowerCase()}\`}
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

function ExpenseField({
  label,
  value,
  status,
  onValueChange,
  onStatusChange,
}: {
  label: string;
  value: string;
  status: ExpenseResolutionStatus;
  onValueChange: (value: string) => void;
  onStatusChange: (status: ExpenseResolutionStatus) => void;
}) {
  const displayLabel = label.includes("₱") ? label : \`\${label} (₱)\`;
  return (
    <div className="expense-resolution-field">
      <span className="field-label-text">{displayLabel}</span>
      <div className="expense-resolution-controls">
        <span className={\`peso-input-wrap \${status !== "confirmed" ? "is-disabled" : ""}\`}>
          {status === "confirmed" ? (
            <span className="peso-prefix" aria-hidden="true">₱</span>
          ) : null}
          <input
            aria-label={\`\${displayLabel} amount\`}
            disabled={status !== "confirmed"}
            min="0"
            step="0.01"
            type="number"
            inputMode="decimal"
            className={\`no-spin-stepper \${status === "confirmed" ? "peso-input" : ""}\`}
            style={{ MozAppearance: "textfield", WebkitAppearance: "none", appearance: "none" }}
            value={status === "confirmed" ? value : ""}
            placeholder={status === "confirmed" ? "0.00" : status === "unknown" ? "Amount unknown" : "N/A"}
            onChange={(event) => onValueChange(event.target.value)}
          />
        </span>
        <div className="expense-resolution-options" role="group" aria-label={\`\${displayLabel} resolution\`}>
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
              onClick={() => onStatusChange(val)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function expenseLabel(key: string): string {
  return ({
    dieselExpenses: "Diesel (₱)",
    tollGateExpenses: "Toll gate (₱)",
    driverAllowance: "Allowance (₱)",
    driverDailyRate: "Daily rate (₱)",
    helperAllowance: "Allowance (₱)",
    helperDailyRate: "Daily rate (₱)",
    helper2Allowance: "Allowance (₱)",
    helper2DailyRate: "Daily rate (₱)",
    otherExpenses: "Other expenses (₱)",
  } as Record<string, string>)[key] ?? key;
}
`;

fs.writeFileSync('rrliRev/src/app/(workspace)/deliveries/new/page.tsx', fullNewPageContent, 'utf8');
console.log('Successfully updated deliveries/new/page.tsx!');
