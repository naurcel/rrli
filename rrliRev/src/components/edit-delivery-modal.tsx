"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
} from "@/features/deliveries/delivery-domain";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  readBrowserPreviewDeliveries,
  upsertBrowserPreviewDelivery,
} from "@/features/deliveries/browser-preview-deliveries";
import { BASE_HELPERS, getFleetCrew } from "@/features/deliveries/driver-registry";
import {
  handlePositiveDecimalKeyDown,
  sanitizePersonNameInput,
  sanitizePositiveDecimalInput,
} from "@/features/deliveries/delivery-input-utils";
import { formatPeso } from "@/lib/format";

type CorrectionDropoffDraft = {
  id: string;
  storeName: string;
  destinationArea: string;
  entryFee: string;
  entryFeeStatus: "confirmed" | "not_applicable" | "unknown";
  podSubmitted: boolean;
  supportingDocsComplete: boolean;
  documentRef?: string;
};

export type EditDeliveryModalProps = {
  delivery: DeliveryLedgerItem | null;
  drivers?: readonly { label: string }[];
  helpers?: readonly { label: string }[];
  onClose: () => void;
  onSaved: (updatedTrip: DeliveryLedgerItem, message: string) => void;
};

export function EditDeliveryModal({
  delivery,
  drivers: propDrivers,
  helpers: propHelpers,
  onClose,
  onSaved,
}: EditDeliveryModalProps) {
  const [reason, setReason] = useState("");
  const [rate, setRate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [helperName, setHelperName] = useState("");
  const [expenses, setExpenses] = useState<{ [key: string]: string }>({});
  const [statuses, setStatuses] = useState<{ [key: string]: "confirmed" | "not_applicable" | "unknown" }>({});
  const [existingDocs, setExistingDocs] = useState<string[]>([]);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [dropoffs, setDropoffs] = useState<CorrectionDropoffDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallbackDrivers = getFleetCrew().map((d) => ({ label: d.fullName }));
  const fallbackHelpers = BASE_HELPERS.map((h) => ({ label: h.fullName }));
  const drivers = propDrivers && propDrivers.length > 0 ? propDrivers : fallbackDrivers;
  const helpers = propHelpers && propHelpers.length > 0 ? propHelpers : fallbackHelpers;

  useEffect(() => {
    if (!delivery) return;

    setReason("");
    setRate(delivery.deliveryRate != null ? String(delivery.deliveryRate) : "");
    setDriverName(delivery.driverName ?? "");
    setHelperName(delivery.helperName ?? "");
    setExpenses({
      dieselExpenses: delivery.expenses.dieselExpenses != null ? String(delivery.expenses.dieselExpenses) : "",
      tollGateExpenses: delivery.expenses.tollGateExpenses != null ? String(delivery.expenses.tollGateExpenses) : "",
      driverAllowance: delivery.expenses.driverAllowance != null ? String(delivery.expenses.driverAllowance) : "",
      driverDailyRate: delivery.expenses.driverDailyRate != null ? String(delivery.expenses.driverDailyRate) : "",
      helperAllowance: delivery.expenses.helperAllowance != null ? String(delivery.expenses.helperAllowance) : "",
      helperDailyRate: delivery.expenses.helperDailyRate != null ? String(delivery.expenses.helperDailyRate) : "",
      otherExpenses: delivery.expenses.otherExpenses != null ? String(delivery.expenses.otherExpenses) : "",
    });
    setStatuses({
      dieselExpenses: delivery.expenseStates?.dieselExpenses ?? "confirmed",
      tollGateExpenses: delivery.expenseStates?.tollGateExpenses ?? "confirmed",
      driverAllowance: delivery.expenseStates?.driverAllowance ?? "confirmed",
      driverDailyRate: delivery.expenseStates?.driverDailyRate ?? "confirmed",
      helperAllowance: delivery.expenseStates?.helperAllowance ?? "confirmed",
      helperDailyRate: delivery.expenseStates?.helperDailyRate ?? "confirmed",
      otherExpenses: delivery.expenseStates?.otherExpenses ?? "confirmed",
    });
    setExistingDocs([...(delivery.supportingDocuments ?? [])]);
    setSupportingFiles([]);
    setDropoffs(
      delivery.dropoffs.length > 0
        ? delivery.dropoffs.map((d) => ({
            id: d.id,
            storeName: d.storeName,
            destinationArea: d.destinationArea,
            entryFee: d.entryFee != null ? String(d.entryFee) : "",
            entryFeeStatus: d.entryFeeStatus ?? (d.entryFee != null ? "confirmed" : "not_applicable"),
            podSubmitted: d.podSubmitted,
            supportingDocsComplete: d.supportingDocsComplete,
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
          ],
    );
    setSubmitting(false);
    setError(null);
  }, [delivery]);

  useEffect(() => {
    if (!delivery) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [delivery, submitting, onClose]);

  useEffect(() => {
    if (!delivery) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [delivery]);

  if (!delivery || typeof document === "undefined") return null;

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  function addDropoff() {
    setDropoffs((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        storeName: "",
        destinationArea: "",
        entryFee: "",
        entryFeeStatus: "not_applicable",
        podSubmitted: false,
        supportingDocsComplete: false,
      },
    ]);
  }

  function removeDropoff(index: number) {
    if (dropoffs.length <= 1) return;
    setDropoffs((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDropoff<K extends keyof CorrectionDropoffDraft>(
    index: number,
    field: K,
    val: CorrectionDropoffDraft[K],
  ) {
    setDropoffs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  }

  const entryFeeSummary = (() => {
    const hasUnknown = dropoffs.some((d) => d.entryFeeStatus === "unknown");
    if (hasUnknown) return "Incomplete";
    const allNa = dropoffs.length > 0 && dropoffs.every((d) => d.entryFeeStatus === "not_applicable");
    if (allNa) return "Not applicable";
    const total = dropoffs.reduce((sum, d) => {
      if (d.entryFeeStatus === "confirmed" && d.entryFee !== "") {
        return sum + (Number(d.entryFee) || 0);
      }
      return sum;
    }, 0);
    return formatPeso(total);
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!delivery || submitting) return;

    if (reason.trim().length < 5) {
      setError("A correction reason of at least 5 characters is required for audit integrity.");
      return;
    }

    const numRate = Number(rate);
    if (!Number.isFinite(numRate) || numRate <= 0) {
      setError("Please enter a valid positive delivery revenue.");
      return;
    }

    if (dropoffs.length === 0) {
      setError("At least one store drop-off is required.");
      return;
    }

    for (let i = 0; i < dropoffs.length; i++) {
      const stop = dropoffs[i];
      if (!stop.storeName.trim()) {
        setError(`Store name is required for Store Drop-off #${i + 1}.`);
        return;
      }
      if (!stop.destinationArea.trim()) {
        setError(`Destination area is required for Store Drop-off #${i + 1}.`);
        return;
      }
      if (stop.entryFeeStatus === "confirmed") {
        const feeNum = stop.entryFee === "" ? null : Number(stop.entryFee);
        if (feeNum === null || !Number.isFinite(feeNum) || feeNum < 0) {
          setError(`Please enter a valid positive entry fee for Store Drop-off #${i + 1}.`);
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);

    const expensesPayload: Record<string, number | null> = {};
    for (const [key, val] of Object.entries(expenses)) {
      const status = statuses[key];
      if (status === "confirmed") {
        const num = val === "" ? null : Number(val);
        if (num !== null && (!Number.isFinite(num) || num < 0)) {
          setError(`Please enter a valid amount for ${key}.`);
          setSubmitting(false);
          return;
        }
        expensesPayload[key] = num;
      } else {
        expensesPayload[key] = null;
      }
    }

    const finalSupportingDocs = [
      ...existingDocs,
      ...supportingFiles.map((f) => f.name),
    ];
    const hasSupporting = finalSupportingDocs.length > 0;
    const updatedDropoffs: DeliveryStoreDropoff[] = dropoffs.map((stop, index) => {
      const feeNum =
        stop.entryFeeStatus === "confirmed" && stop.entryFee !== ""
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
    const allNaEntryFee =
      updatedDropoffs.length > 0 && updatedDropoffs.every((d) => d.entryFeeStatus === "not_applicable");
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
      ...statuses,
      entryFees: aggregatedEntryFeeStatus,
    };

    const nextPodStatus = derivePodVerificationStatus(updatedDropoffs);
    const updatedExpenses = { ...delivery.expenses, ...expensesPayload };
    const updatedStates = { ...delivery.expenseStates, ...finalStatuses };
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
        return [`${key} has no amount entered.`];
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
          deliveryId: delivery.id,
          expectedVersion: delivery.version,
          idempotencyKey: crypto.randomUUID(),
          reason: reason.trim(),
          changes: {
            deliveryRate: numRate,
            driverName: driverName.trim() || null,
            helperName: helperName.trim() || null,
            expenses: expensesPayload,
            expenseStates: finalStatuses,
            supportingDocuments: finalSupportingDocs,
            dropoffs: updatedDropoffs,
            financialState: nextFinancialState,
          },
          fallbackRecord: delivery,
        }),
      });

      const data = await response.json().catch(() => ({}));
      let newVersion = delivery.version + 1;

      if (!response.ok || !data.ok) {
        if (response.status === 409 || data.code === "VERSION_CONFLICT") {
          setError(
            "Version Conflict: This delivery record was modified concurrently by another user. Your inputs have been preserved. Please review and retry.",
          );
          setSubmitting(false);
          return;
        }

        const hasBrowserRecord = readBrowserPreviewDeliveries().some(
          (item) => item.id === delivery.id,
        );
        const isNotFound =
          response.status === 404 ||
          data.code === "NOT_FOUND" ||
          String(data.message).includes("NOT_FOUND") ||
          String(data.message).toLowerCase().includes("delivery_not_found");

        if (!isNotFound || !hasBrowserRecord) {
          setError(data.message ?? "Failed to save correction.");
          setSubmitting(false);
          return;
        }
      } else {
        newVersion = data.result?.version ?? delivery.version + 1;
      }

      const updated: DeliveryLedgerItem = {
        ...delivery,
        deliveryRate: numRate,
        driverName: driverName.trim() || null,
        helperName: helperName.trim() || null,
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

      const message =
        nextFinancialState === "finalized"
          ? `Delivery updated and financials resolved (Version ${newVersion}). Reason: "${reason.trim()}".`
          : `Delivery updated with pending unresolved expenses (Version ${newVersion}). Reason: "${reason.trim()}".`;

      upsertBrowserPreviewDelivery(updated);
      onSaved(updated, message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error while saving correction.");
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="routex-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="correction-dialog-title" style={{ zIndex: 1000 }}>
      <div className="routex-dialog-backdrop" onClick={handleClose} />
      <div className="routex-dialog edit-delivery-dialog">
        <header className="routex-dialog-header">
          <div>
            <h2 id="correction-dialog-title">Edit Delivery Financials</h2>
            <p>Waybill: {delivery.waybillNumber} · Current Version: {delivery.version}</p>
          </div>
          <button
            type="button"
            className="routex-dialog-close"
            onClick={handleClose}
            aria-label="Close correction modal"
            title="Close dialog (Esc)"
          >
            ×
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          <div className="routex-dialog-body" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {error ? (
              <div className="delivery-form-alert" role="alert">
                {error}
              </div>
            ) : null}

            {/* Revenue */}
            <div className="delivery-rate-banner">
              <div className="delivery-rate-input-row">
                <label htmlFor="corr-rate" className="field-label-text">
                  Delivery rate (₱)
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
                    value={rate}
                    onKeyDown={handlePositiveDecimalKeyDown}
                    onChange={(e) => setRate(sanitizePositiveDecimalInput(e.target.value, 2))}
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
                  Total Entry Fees: {entryFeeSummary}
                </span>
              </div>

              <div className="dropoff-editor">
                {dropoffs.map((dropoff, index) => (
                  <div key={dropoff.id} className="dropoff-row">
                    <div className="dropoff-row-header">
                      <span className="dropoff-row-title">Store Drop-off #{index + 1}</span>
                      {dropoffs.length > 1 ? (
                        <button
                          type="button"
                          className="dropoff-remove"
                          onClick={() => removeDropoff(index)}
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
                          onChange={(e) => updateDropoff(index, "storeName", e.target.value)}
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
                          onChange={(e) => updateDropoff(index, "destinationArea", e.target.value)}
                        />
                      </div>
                      <div className="dropoff-field dropoff-entry-fee-wrap">
                        <DialogExpenseField
                          id={`corr-dropoff-fee-${index}`}
                          label="Entry Fee / Toll"
                          value={dropoff.entryFee}
                          status={dropoff.entryFeeStatus}
                          onValueChange={(val) => updateDropoff(index, "entryFee", val)}
                          onStatusChange={(st) => updateDropoff(index, "entryFeeStatus", st)}
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
                  onClick={addDropoff}
                >
                  + Add Store Drop-off
                </button>
                <span className="dropoff-counter">
                  {dropoffs.length} {dropoffs.length === 1 ? "store drop-off" : "store drop-offs"}
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
                  value={expenses.dieselExpenses ?? ""}
                  status={statuses.dieselExpenses ?? "confirmed"}
                  onValueChange={(val) => setExpenses((prev) => ({ ...prev, dieselExpenses: val }))}
                  onStatusChange={(st) => {
                    setStatuses((prev) => ({ ...prev, dieselExpenses: st }));
                    if (st !== "confirmed") setExpenses((prev) => ({ ...prev, dieselExpenses: "" }));
                  }}
                />
                <DialogExpenseField
                  id="corr-toll"
                  label="Highway tolls"
                  value={expenses.tollGateExpenses ?? ""}
                  status={statuses.tollGateExpenses ?? "confirmed"}
                  onValueChange={(val) => setExpenses((prev) => ({ ...prev, tollGateExpenses: val }))}
                  onStatusChange={(st) => {
                    setStatuses((prev) => ({ ...prev, tollGateExpenses: st }));
                    if (st !== "confirmed") setExpenses((prev) => ({ ...prev, tollGateExpenses: "" }));
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
                      value={driverName}
                      options={drivers.map((d) => ({
                        value: d.label,
                        label: d.label,
                      }))}
                      onChange={(val) => setDriverName(val)}
                      ariaLabel="Assigned Driver selection"
                    />
                  </div>
                  <div className="crew-rates-fields">
                    <DialogExpenseField
                      id="corr-driver-rate"
                      label="Daily Rate"
                      value={expenses.driverDailyRate ?? ""}
                      status={statuses.driverDailyRate ?? "confirmed"}
                      onValueChange={(val) => setExpenses((prev) => ({ ...prev, driverDailyRate: val }))}
                      onStatusChange={(st) => {
                        setStatuses((prev) => ({ ...prev, driverDailyRate: st }));
                        if (st !== "confirmed") setExpenses((prev) => ({ ...prev, driverDailyRate: "" }));
                      }}
                    />
                    <DialogExpenseField
                      id="corr-driver-allowance"
                      label="Trip Allowance"
                      value={expenses.driverAllowance ?? ""}
                      status="confirmed"
                      onValueChange={(val) => {
                        setExpenses((prev) => ({ ...prev, driverAllowance: val }));
                        setStatuses((prev) => ({ ...prev, driverAllowance: "confirmed" }));
                      }}
                      hideStatusSwitch
                    />
                  </div>
                </section>

                {/* Helper Card */}
                <section className="crew-expense-group">
                  <div className="crew-card-title-row">
                    <span className="crew-role-pill helper">Helper</span>
                    <RoundedSelect
                      value={helperName}
                      options={helpers.map((h) => ({
                        value: h.label,
                        label: h.label,
                      }))}
                      onChange={(val) => setHelperName(val)}
                      ariaLabel="Assigned Helper selection"
                    />
                  </div>
                  <div className="crew-rates-fields">
                    <DialogExpenseField
                      id="corr-helper-rate"
                      label="Daily Rate"
                      value={expenses.helperDailyRate ?? ""}
                      status={statuses.helperDailyRate ?? "confirmed"}
                      onValueChange={(val) => setExpenses((prev) => ({ ...prev, helperDailyRate: val }))}
                      onStatusChange={(st) => {
                        setStatuses((prev) => ({ ...prev, helperDailyRate: st }));
                        if (st !== "confirmed") setExpenses((prev) => ({ ...prev, helperDailyRate: "" }));
                      }}
                    />
                    <DialogExpenseField
                      id="corr-helper-allowance"
                      label="Trip Allowance"
                      value={expenses.helperAllowance ?? ""}
                      status="confirmed"
                      onValueChange={(val) => {
                        setExpenses((prev) => ({ ...prev, helperAllowance: val }));
                        setStatuses((prev) => ({ ...prev, helperAllowance: "confirmed" }));
                      }}
                      hideStatusSwitch
                    />
                  </div>
                </section>
              </div>
            </div>

            {/* Other Operational Expenses */}
            <div className="routex-dialog-section">
              <h3 className="delivery-finance-group-title">Other Operational Expenses</h3>
              <div style={{ maxWidth: "420px" }}>
                <DialogExpenseField
                  id="corr-other"
                  label="Other expenses"
                  value={expenses.otherExpenses ?? ""}
                  status={statuses.otherExpenses ?? "confirmed"}
                  onValueChange={(val) => setExpenses((prev) => ({ ...prev, otherExpenses: val }))}
                  onStatusChange={(st) => {
                    setStatuses((prev) => ({ ...prev, otherExpenses: st }));
                    if (st !== "confirmed") setExpenses((prev) => ({ ...prev, otherExpenses: "" }));
                  }}
                />
              </div>
            </div>

            {/* Supporting Documents */}
            <div className="routex-dialog-section">
              <h3 className="delivery-finance-group-title">Supporting Documents</h3>
              {existingDocs.length > 0 ? (
                <div style={{ marginBottom: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {existingDocs.map((doc, idx) => (
                    <span
                      key={`${doc}-${idx}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 8px",
                        background: "var(--color-surface-subtle, #f1f5f9)",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    >
                      📄 {doc}
                      <button
                        type="button"
                        onClick={() => setExistingDocs((prev) => prev.filter((_, i) => i !== idx))}
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: "var(--color-danger, #ef4444)",
                          fontWeight: "bold",
                        }}
                        title="Remove existing document"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="file-upload-zone" style={{ border: "1.5px dashed var(--line)", padding: "14px 18px", borderRadius: "8px", textAlign: "center" }}>
                <input
                  id="corr-files"
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files) {
                      setSupportingFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }}
                />
                <label htmlFor="corr-files" style={{ cursor: "pointer", color: "var(--color-accent)", fontWeight: 600, fontSize: "12.5px" }}>
                  + Add supporting document files
                </label>
                <span style={{ fontSize: "11px", color: "var(--color-text-muted)", display: "block", marginTop: "4px" }}>
                  PDF, PNG, or JPG up to 10 MB
                </span>
                {supportingFiles.length > 0 ? (
                  <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center" }}>
                    {supportingFiles.map((file, idx) => (
                      <span key={`${file.name}-${idx}`} style={{ fontSize: "11px", background: "#e0f2fe", padding: "2px 6px", borderRadius: "4px" }}>
                        {file.name}
                        <button
                          type="button"
                          onClick={() => setSupportingFiles((prev) => prev.filter((_, i) => i !== idx))}
                          style={{ border: "none", background: "none", marginLeft: "4px", cursor: "pointer", color: "#dc2626" }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
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
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <footer className="routex-dialog-footer" style={{ flexShrink: 0 }}>
            <button
              type="button"
              className="secondary-button"
              disabled={submitting}
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-action-button"
              disabled={submitting || reason.trim().length < 5}
            >
              {submitting ? "Saving changes…" : "Save changes"}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export function DialogExpenseField({
  id,
  label,
  value,
  status,
  onValueChange,
  onStatusChange,
  hideStatusSwitch,
}: {
  id?: string;
  label: string;
  value: string;
  status: "confirmed" | "not_applicable" | "unknown";
  onValueChange: (val: string) => void;
  onStatusChange?: (st: "confirmed" | "not_applicable" | "unknown") => void;
  hideStatusSwitch?: boolean;
}) {
  const displayLabel = label.includes("₱") ? label : `${label} (₱)`;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleWrapperClick = () => {
    if (status !== "confirmed" && onStatusChange) {
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
        {!hideStatusSwitch && onStatusChange ? (
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
        ) : null}
      </div>
    </div>
  );
}
