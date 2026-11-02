"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { RoundedSelect } from "@/components/rounded-select";
import { OperationalTopbar } from "@/components/operational-topbar";
import type { DeliveryFilterOption } from "@/features/deliveries/server/delivery-repository";
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
  entryFee: "0",
  entryFeeStatus: "unknown",
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
  const [references, setReferences] = useState<ReferenceData>({ clients: [], trucks: [] });
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [dropoffs, setDropoffs] = useState<DropoffDraft[]>([initialDropoff]);
  const [expenseStatuses, setExpenseStatuses] = useState({
    dieselExpenses: "unknown",
    tollGateExpenses: "unknown",
    driverAllowance: "unknown",
    driverDailyRate: "unknown",
    helperAllowance: "unknown",
    helperDailyRate: "unknown",
    otherExpenses: "unknown",
  } satisfies Record<string, ExpenseResolutionStatus>);
  const [values, setValues] = useState({
    waybillNumber: "",
    deliveryDate: todayKey(),
    origin: "",
    distanceKm: "0",
    fuelRate: "0",
    deliveryRate: "0",
    dieselExpenses: "",
    tollGateExpenses: "",
    tollGateBreakdown: "",
    driverAllowance: "",
    driverDailyRate: "",
    helperAllowance: "",
    helperDailyRate: "",
    otherExpenses: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/deliveries?page=1&pageSize=1", { signal: controller.signal })
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
        setReferences(nextReferences);
        setClientName(nextReferences.clients[0]?.label ?? "");
        setPlateNumber(nextReferences.trucks[0]?.label ?? "");
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
    const expenseEntries = Object.entries(expenseStatuses) as [keyof typeof expenseStatuses, ExpenseResolutionStatus][];
    const expensesComplete = expenseEntries.every(([key, status]) =>
      status === "not_applicable" || (status === "confirmed" && numberValue(values[key]) != null),
    );
    const totalExpenses = entryFees == null || !expensesComplete
      ? null
      : expenseEntries.reduce((sum, [key, status]) => sum + (status === "confirmed" ? numberValue(values[key]) ?? 0 : 0), entryFees);
    const revenue = numberValue(values.deliveryRate);
    return {
      entryFees,
      totalExpenses,
      netIncome: revenue == null || totalExpenses == null ? null : revenue - totalExpenses,
      revenue,
    };
  }, [dropoffs, expenseStatuses, values]);

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
      { id: crypto.randomUUID(), storeName: "", destinationArea: "", entryFee: "", entryFeeStatus: "unknown" },
    ]);
  }

  async function submitDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const payload = {
      ...values,
      idempotencyKey: crypto.randomUUID(),
      clientName,
      plateNumber,
      distanceKm: numberValue(values.distanceKm),
      fuelRate: numberValue(values.fuelRate),
      deliveryRate: numberValue(values.deliveryRate),
      dieselExpenses: numberValue(values.dieselExpenses),
      tollGateExpenses: numberValue(values.tollGateExpenses),
      driverAllowance: numberValue(values.driverAllowance),
      driverDailyRate: numberValue(values.driverDailyRate),
      helperAllowance: numberValue(values.helperAllowance),
      helperDailyRate: numberValue(values.helperDailyRate),
      otherExpenses: numberValue(values.otherExpenses),
      ...Object.fromEntries(Object.entries(expenseStatuses).map(([key, status]) => [`${key}Status`, status])),
      dropoffs: dropoffs.map((dropoff) => ({
        storeName: dropoff.storeName,
        destinationArea: dropoff.destinationArea,
        entryFee: numberValue(dropoff.entryFee),
        entryFeeStatus: dropoff.entryFeeStatus,
        podSubmitted: false,
        supportingDocsComplete: false,
        documentRef: "Pending upload",
      })),
    };

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
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to record the completed delivery.");
      }
      router.push(`/deliveries?created=${encodeURIComponent(result.deliveryId ?? "")}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to record the completed delivery.");
      setSubmitting(false);
    }
  }

  const noReferences =
    !referencesLoading && (references.clients.length === 0 || references.trucks.length === 0);

  return (
    <>
      <OperationalTopbar contextLabel="Record Completed Delivery" />
      <div className="content-wrap delivery-entry-page">
      <header className="page-intro">
        <div>
          <Link className="back-link" href="/deliveries">← Back to completed deliveries</Link>
          <p className="eyebrow">COMPLETED DELIVERY RECORD</p>
          <h1>Record delivery</h1>
          <p className="subtitle">
            Encode one completed trip. Multiple stores remain part of this single delivery and do not duplicate its revenue.
          </p>
        </div>
      </header>

      <form className="delivery-entry-form" onSubmit={submitDelivery}>
        {referenceError ? <div className="delivery-form-alert" role="alert">{referenceError}</div> : null}
        {submitError ? <div className="delivery-form-alert" role="alert">{submitError}</div> : null}

        <section className="delivery-form-section">
          <FormHeading number="01" title="Trip information" description="Use the actual trip date and issued waybill number." />
          <div className="delivery-field-grid">
            <label>Waybill number<input required value={values.waybillNumber} onChange={(event) => updateValue("waybillNumber", event.target.value)} placeholder="WB-2026-0001" /></label>
            <label>Actual delivery date<input required type="date" value={values.deliveryDate} onChange={(event) => updateValue("deliveryDate", event.target.value)} /></label>
            <label>Client<RoundedSelect value={clientName} options={references.clients.map((option) => ({ value: option.label, label: option.label }))} onChange={setClientName} ariaLabel="Select active client" /></label>
            <label>Truck / plate number<RoundedSelect value={plateNumber} options={references.trucks.map((option) => ({ value: option.label, label: option.label }))} onChange={setPlateNumber} ariaLabel="Select active truck" /></label>
            <label className="wide">Origin<input required value={values.origin} onChange={(event) => updateValue("origin", event.target.value)} placeholder="Warehouse or dispatch origin" /></label>
            <label>Distance travelled (km)<input required min="0" step="0.01" type="number" value={values.distanceKm} onChange={(event) => updateValue("distanceKm", event.target.value)} /></label>
            <label>Fuel rate per litre<input required min="0" step="0.01" type="number" value={values.fuelRate} onChange={(event) => updateValue("fuelRate", event.target.value)} /></label>
          </div>
        </section>

        <section className="delivery-form-section">
          <FormHeading number="02" title="Stores and drop-offs" description="Add every store served by this completed trip." />
          <div className="dropoff-editor">
            {dropoffs.map((dropoff, index) => (
              <fieldset key={dropoff.id} className="dropoff-row">
                <legend>Stop {index + 1}</legend>
                <label>Store name<input required value={dropoff.storeName} onChange={(event) => updateDropoff(dropoff.id, "storeName", event.target.value)} /></label>
                <label>Destination<input required value={dropoff.destinationArea} onChange={(event) => updateDropoff(dropoff.id, "destinationArea", event.target.value)} /></label>
                <ExpenseField label="Entry fee" value={dropoff.entryFee} status={dropoff.entryFeeStatus} onValueChange={(value) => updateDropoff(dropoff.id, "entryFee", value)} onStatusChange={(status) => { updateDropoff(dropoff.id, "entryFeeStatus", status); if (status !== "confirmed") updateDropoff(dropoff.id, "entryFee", ""); }} />
                {dropoffs.length > 1 ? <button type="button" className="dropoff-remove" onClick={() => setDropoffs((current) => current.filter((item) => item.id !== dropoff.id))}>Remove</button> : null}
              </fieldset>
            ))}
            <button type="button" className="secondary-button add-dropoff" onClick={addDropoff}>+ Add another store</button>
          </div>
        </section>

        <section className="delivery-form-section">
          <FormHeading number="03" title="Revenue and expenses" description="Entry fees come from the stores above. Final totals are calculated by the server." />
          <div className="delivery-field-grid">
            <MoneyField label="Delivery rate / revenue" value={values.deliveryRate} required onChange={(value) => updateValue("deliveryRate", value)} />
            {(Object.keys(expenseStatuses) as (keyof typeof expenseStatuses)[]).map((key) => (
              <ExpenseField key={key} label={expenseLabel(key)} value={values[key]} status={expenseStatuses[key]} onValueChange={(value) => updateValue(key, value)} onStatusChange={(status) => { setExpenseStatuses((current) => ({ ...current, [key]: status })); if (status !== "confirmed") updateValue(key, ""); }} />
            ))}
            <label className="wide">Toll breakdown<textarea value={values.tollGateBreakdown} onChange={(event) => updateValue("tollGateBreakdown", event.target.value)} placeholder="Optional toll gate names and amounts" /></label>
          </div>
          <div className="delivery-financial-review" aria-label="Financial review">
            <div><span>Revenue</span><strong>{formatPeso(financialReview.revenue)}</strong></div>
            <div><span>Store entry fees</span><strong>{formatPeso(financialReview.entryFees)}</strong></div>
            <div><span>Total expenses</span><strong>{formatPeso(financialReview.totalExpenses)}</strong></div>
            <div className={financialReview.netIncome != null && financialReview.netIncome < 0 ? "negative" : "positive"}><span>Net income</span><strong>{formatPeso(financialReview.netIncome)}</strong></div>
          </div>
        </section>

        <section className="delivery-form-section delivery-document-note">
          <FormHeading number="04" title="POD and supporting documents" description="The trip is saved with documents pending. Upload and verify each store document after creation." />
        </section>

        <div className="delivery-form-actions">
          <Link className="secondary-button" href="/deliveries">Cancel</Link>
          <button className="primary-action-button" type="submit" disabled={submitting || referencesLoading || noReferences}>
            {submitting ? "Recording delivery…" : "Record completed delivery"}
          </button>
        </div>
        {noReferences ? <p className="delivery-reference-warning">At least one active client and one active Fleet truck are required before a delivery can be recorded.</p> : null}
      </form>
      </div>
    </>
  );
}

function FormHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="delivery-form-heading"><div><span>{number}</span><h2>{title}</h2></div><p>{description}</p></div>;
}

function MoneyField({ label, value, required = false, onChange }: { label: string; value: string; required?: boolean; onChange: (value: string) => void }) {
  return <label>{label}<input required={required} min={required ? "0.01" : "0"} step="0.01" type="number" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
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
  return (
    <label className="expense-resolution-field">
      {label}
      <div className="expense-resolution-controls">
        <select
          aria-label={`${label} resolution`}
          value={status}
          onChange={(event) => onStatusChange(event.target.value as ExpenseResolutionStatus)}
        >
          <option value="unknown">Unknown</option>
          <option value="confirmed">Confirmed amount</option>
          <option value="not_applicable">Not applicable</option>
        </select>
        <input
          aria-label={`${label} amount`}
          disabled={status !== "confirmed"}
          min="0"
          step="0.01"
          type="number"
          value={status === "confirmed" ? value : ""}
          placeholder={status === "confirmed" ? "0.00" : status === "unknown" ? "Amount unknown" : "N/A"}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </div>
    </label>
  );
}

function expenseLabel(key: string): string {
  return ({
    dieselExpenses: "Diesel expenses",
    tollGateExpenses: "Toll gate expenses",
    driverAllowance: "Driver allowance",
    driverDailyRate: "Driver daily rate",
    helperAllowance: "Helper allowance",
    helperDailyRate: "Helper daily rate",
    otherExpenses: "Other expenses",
  } as Record<string, string>)[key] ?? key;
}
