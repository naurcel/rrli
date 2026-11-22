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
  normalizeSupportingDocument,
  type SupportingDocumentRecord,
} from "@/features/deliveries/delivery-domain";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  readBrowserPreviewDeliveries,
  upsertBrowserPreviewDelivery,
} from "@/features/deliveries/browser-preview-deliveries";
import { BASE_HELPERS, getFleetCrew } from "@/features/deliveries/driver-registry";
import {
  handlePositiveDecimalKeyDown,
  sanitizePositiveDecimalInput,
} from "@/features/deliveries/delivery-input-utils";
import { formatPeso } from "@/lib/format";

function numberValue(val: string): number | null {
  const clean = val.replace(/,/g, "").trim();
  if (clean === "") return null;
  const num = Number(clean);
  return isNaN(num) ? null : num;
}

type CorrectionDropoffDraft = {
  id: string;
  storeName: string;
  destinationArea: string;
  dropoffCount: string;
  entryFee: string;
  entryFeeStatus: "confirmed" | "not_applicable" | "unknown";
  podSubmitted: boolean;
  supportingDocsComplete: boolean;
  documentRef?: string;
  podFile?: File | null;
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
  const [hasSecondHelper, setHasSecondHelper] = useState(false);
  const [helper2Name, setHelper2Name] = useState("");
  const [notes, setNotes] = useState("");
  const [expenses, setExpenses] = useState<{ [key: string]: string }>({});
  const [statuses, setStatuses] = useState<{ [key: string]: "confirmed" | "not_applicable" | "unknown" }>({});
  const [existingDocs, setExistingDocs] = useState<SupportingDocumentRecord[]>([]);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [dropoffs, setDropoffs] = useState<CorrectionDropoffDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallbackDrivers = getFleetCrew().map((d) => ({ label: d.fullName }));
  const fallbackHelpers = BASE_HELPERS.map((h) => ({ label: h.fullName }));
  const drivers = (propDrivers && propDrivers.length > 0 ? propDrivers : fallbackDrivers).filter(
    (d) => !d.label.toLowerCase().includes("unknown"),
  );
  const helpers = (propHelpers && propHelpers.length > 0 ? propHelpers : fallbackHelpers).filter(
    (h) => !h.label.toLowerCase().includes("unknown"),
  );

  const isSubcontracted = Boolean(
    delivery?.truckOwnership === "Subcontracted" ||
    delivery?.plateNumber?.trim().toUpperCase().startsWith("SUB-") ||
    delivery?.plateNumber?.trim().toUpperCase().includes("SUBCON")
  );

  useEffect(() => {
    if (!delivery) return;

    setReason("");
    setRate(delivery.deliveryRate != null ? String(delivery.deliveryRate) : "");
    setDriverName(delivery.driverName ?? "");
    const rawHelpers = (delivery.helperName ?? "")
      .split(/[,/&]/)
      .map((p) => p.trim())
      .filter(Boolean);
    const h1 = rawHelpers[0] ?? "";
    const h2 = (delivery as unknown as Record<string, unknown>).helper2Name
      ? String((delivery as unknown as Record<string, unknown>).helper2Name)
      : rawHelpers[1] ?? "";
    setHelperName(h1);
    setHelper2Name(h2);
    const hasH2 = Boolean(
      h2 || (delivery.expenses as unknown as Record<string, unknown>).helper2DailyRate != null,
    );
    setHasSecondHelper(hasH2);
    setNotes(delivery.notes ?? "");

    const isSub =
      delivery.truckOwnership === "Subcontracted" ||
      delivery.plateNumber?.trim().toUpperCase().startsWith("SUB-") ||
      delivery.plateNumber?.trim().toUpperCase().includes("SUBCON");

    setExpenses({
      dieselExpenses: delivery.expenses.dieselExpenses != null ? String(delivery.expenses.dieselExpenses) : "",
      tollGateExpenses: delivery.expenses.tollGateExpenses != null ? String(delivery.expenses.tollGateExpenses) : "",
      driverAllowance: delivery.expenses.driverAllowance != null ? String(delivery.expenses.driverAllowance) : "",
      driverDailyRate: delivery.expenses.driverDailyRate != null ? String(delivery.expenses.driverDailyRate) : "",
      helperAllowance: delivery.expenses.helperAllowance != null ? String(delivery.expenses.helperAllowance) : "",
      helperDailyRate: delivery.expenses.helperDailyRate != null ? String(delivery.expenses.helperDailyRate) : "",
      helper2Allowance:
        (delivery.expenses as unknown as Record<string, unknown>).helper2Allowance != null
          ? String((delivery.expenses as unknown as Record<string, unknown>).helper2Allowance)
          : "",
      helper2DailyRate:
        (delivery.expenses as unknown as Record<string, unknown>).helper2DailyRate != null
          ? String((delivery.expenses as unknown as Record<string, unknown>).helper2DailyRate)
          : "",
      otherExpenses: delivery.expenses.otherExpenses != null ? String(delivery.expenses.otherExpenses) : "",
    });
    setStatuses({
      dieselExpenses: delivery.expenseStates?.dieselExpenses ?? "confirmed",
      tollGateExpenses: delivery.expenseStates?.tollGateExpenses ?? "confirmed",
      driverAllowance:
        isSub && delivery.expenses.driverAllowance == null
          ? "not_applicable"
          : (delivery.expenseStates?.driverAllowance ?? "confirmed"),
      driverDailyRate:
        isSub && delivery.expenses.driverDailyRate == null
          ? "not_applicable"
          : (delivery.expenseStates?.driverDailyRate ?? "confirmed"),
      helperAllowance:
        isSub && delivery.expenses.helperAllowance == null
          ? "not_applicable"
          : (delivery.expenseStates?.helperAllowance ?? "confirmed"),
      helperDailyRate:
        isSub && delivery.expenses.helperDailyRate == null
          ? "not_applicable"
          : (delivery.expenseStates?.helperDailyRate ?? "confirmed"),
      helper2Allowance:
        isSub && (delivery.expenses as unknown as Record<string, unknown>).helper2Allowance == null
          ? "not_applicable"
          : ((delivery.expenseStates as unknown as Record<string, ExpenseResolutionStatus> | undefined)?.helper2Allowance ?? (hasH2 ? "confirmed" : "not_applicable")),
      helper2DailyRate:
        isSub && (delivery.expenses as unknown as Record<string, unknown>).helper2DailyRate == null
          ? "not_applicable"
          : ((delivery.expenseStates as unknown as Record<string, ExpenseResolutionStatus> | undefined)?.helper2DailyRate ?? (hasH2 ? "confirmed" : "not_applicable")),
      otherExpenses: delivery.expenseStates?.otherExpenses ?? "confirmed",
    });
    setExistingDocs(
      (delivery.supportingDocuments ?? []).map((doc, idx) => normalizeSupportingDocument(doc, idx)),
    );
    setSupportingFiles([]);
    setDropoffs(
      delivery.dropoffs.length > 0
        ? delivery.dropoffs.map((d) => ({
            id: d.id,
            storeName: d.storeName,
            destinationArea: d.destinationArea,
            dropoffCount: d.dropoffCount != null ? String(d.dropoffCount) : "1",
            entryFee: d.entryFee != null ? String(d.entryFee) : "",
            entryFeeStatus: d.entryFeeStatus ?? (d.entryFee != null ? "confirmed" : "not_applicable"),
            podSubmitted: d.podSubmitted,
            supportingDocsComplete: d.supportingDocsComplete,
            documentRef: d.documentRef ?? "",
            podFile: null,
          }))
        : [
            {
              id: crypto.randomUUID(),
              storeName: "",
              destinationArea: "",
              dropoffCount: "1",
              entryFee: "",
              entryFeeStatus: "not_applicable",
              podSubmitted: false,
              supportingDocsComplete: false,
              documentRef: "",
              podFile: null,
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
        dropoffCount: "1",
        entryFee: "",
        entryFeeStatus: "not_applicable",
        podSubmitted: false,
        supportingDocsComplete: false,
        documentRef: "",
        podFile: null,
      },
    ]);
  }

  function removeDropoff(index: number) {
    if (dropoffs.length <= 1) return;
    setDropoffs((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDropoff<K extends keyof CorrectionDropoffDraft>(
    index: number,
    fieldOrUpdates: K | Partial<CorrectionDropoffDraft>,
    val?: CorrectionDropoffDraft[K],
  ) {
    setDropoffs((prev) => {
      const copy = [...prev];
      if (typeof fieldOrUpdates === "object") {
        copy[index] = { ...copy[index], ...fieldOrUpdates };
      } else {
        copy[index] = { ...copy[index], [fieldOrUpdates]: val };
      }
      if (fieldOrUpdates === "entryFee" && typeof val === "string") {
        const num = Number(val);
        copy[index].entryFeeStatus = !isNaN(num) && val.trim() !== "" ? "confirmed" : "not_applicable";
      }
      return copy;
    });
  }

  const totalDropoffs = dropoffs.reduce((sum, d) => sum + Math.max(1, parseInt(d.dropoffCount, 10) || 1), 0);

  const entryFeeSummary = (() => {
    const total = dropoffs.reduce((sum, d) => {
      const amt = Number(d.entryFee);
      return sum + (!isNaN(amt) && amt > 0 ? amt : 0);
    }, 0);
    return formatPeso(total);
  })();

  const liveRevenue = numberValue(rate) ?? 0;
  const liveDropoffEntryFees = dropoffs.reduce((sum, d) => {
    if (d.entryFeeStatus === "confirmed" && d.entryFee) {
      return sum + (numberValue(d.entryFee) ?? 0);
    }
    return sum;
  }, 0);
  const liveHasUnknownEntryFee = dropoffs.some((d) => d.entryFeeStatus === "unknown");

  const liveExpenseIssues: string[] = [];
  if (statuses.dieselExpenses === "unknown") liveExpenseIssues.push("Fuel receipt");
  if (statuses.tollGateExpenses === "unknown") liveExpenseIssues.push("Toll receipts");
  if (statuses.driverDailyRate === "unknown") liveExpenseIssues.push("Driver rate");
  if (statuses.driverAllowance === "unknown") liveExpenseIssues.push("Driver allowance");
  if (statuses.helperDailyRate === "unknown") liveExpenseIssues.push("Helper rate");
  if (statuses.helperAllowance === "unknown") liveExpenseIssues.push("Helper allowance");
  if (hasSecondHelper && statuses.helper2DailyRate === "unknown") liveExpenseIssues.push("Helper 2 rate");
  if (hasSecondHelper && statuses.helper2Allowance === "unknown") liveExpenseIssues.push("Helper 2 allowance");
  if (statuses.otherExpenses === "unknown") liveExpenseIssues.push("Other expenses");
  if (liveHasUnknownEntryFee) liveExpenseIssues.push("Store entry fee");

  const liveIsComplete = liveExpenseIssues.length === 0;

  const liveExpensesTotal = (
    (statuses.dieselExpenses === "confirmed" ? (numberValue(expenses.dieselExpenses) ?? 0) : 0) +
    (statuses.tollGateExpenses === "confirmed" ? (numberValue(expenses.tollGateExpenses) ?? 0) : 0) +
    (statuses.driverDailyRate === "confirmed" ? (numberValue(expenses.driverDailyRate) ?? 0) : 0) +
    (statuses.driverAllowance === "confirmed" ? (numberValue(expenses.driverAllowance) ?? 0) : 0) +
    (statuses.helperDailyRate === "confirmed" ? (numberValue(expenses.helperDailyRate) ?? 0) : 0) +
    (statuses.helperAllowance === "confirmed" ? (numberValue(expenses.helperAllowance) ?? 0) : 0) +
    (hasSecondHelper && statuses.helper2DailyRate === "confirmed" ? (numberValue(expenses.helper2DailyRate) ?? 0) : 0) +
    (hasSecondHelper && statuses.helper2Allowance === "confirmed" ? (numberValue(expenses.helper2Allowance) ?? 0) : 0) +
    (statuses.otherExpenses === "confirmed" ? (numberValue(expenses.otherExpenses) ?? 0) : 0) +
    liveDropoffEntryFees
  );

  const liveNetProfit = liveRevenue - liveExpensesTotal;
  const liveMarginPercent = liveRevenue > 0 ? (liveNetProfit / liveRevenue) * 100 : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!delivery || submitting) return;

    if (reason.trim().length < 5) {
      setError("A correction reason of at least 5 characters is required for audit integrity.");
      return;
    }

    const isExistingUnknownDriver = Boolean(delivery.driverName && delivery.driverName.toLowerCase().includes("unknown"));
    if (driverName.trim().toLowerCase().includes("unknown") && !isExistingUnknownDriver) {
      setError("Unknown driver is not permitted when editing deliveries. Please assign a real driver name.");
      return;
    }
    const isExistingUnknownHelper = Boolean(delivery.helperName && delivery.helperName.toLowerCase().includes("unknown"));
    if (helperName.trim().toLowerCase().includes("unknown") && !isExistingUnknownHelper) {
      setError("Unknown helper is not permitted when editing deliveries. Please assign a real helper name.");
      return;
    }
    if (hasSecondHelper) {
      if (helper2Name.trim().length < 2) {
        setError("Select or enter a name for Helper 2.");
        return;
      }
      if (helper2Name.trim().toLowerCase().includes("unknown")) {
        setError("Unknown helper is not permitted when editing deliveries. Please assign a real helper name.");
        return;
      }
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
      if (!hasSecondHelper && (key === "helper2DailyRate" || key === "helper2Allowance")) {
        continue;
      }
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

    const h1Rate = statuses.helperDailyRate === "confirmed" ? (numberValue(expenses.helperDailyRate) ?? 0) : 0;
    const h2Rate = hasSecondHelper && statuses.helper2DailyRate === "confirmed" ? (numberValue(expenses.helper2DailyRate) ?? 0) : 0;
    const hasHConfirmedRate = statuses.helperDailyRate === "confirmed" || (hasSecondHelper && statuses.helper2DailyRate === "confirmed");
    const hasHUnknownRate = statuses.helperDailyRate === "unknown" || (hasSecondHelper && statuses.helper2DailyRate === "unknown");
    const finalHelperDailyRate = hasHUnknownRate ? null : hasHConfirmedRate ? h1Rate + h2Rate : null;
    const finalHelperDailyRateStatus: ExpenseResolutionStatus = hasHUnknownRate ? "unknown" : hasHConfirmedRate ? "confirmed" : "not_applicable";

    const h1Allowance = statuses.helperAllowance === "confirmed" ? (numberValue(expenses.helperAllowance) ?? 0) : 0;
    const h2Allowance = hasSecondHelper && statuses.helper2Allowance === "confirmed" ? (numberValue(expenses.helper2Allowance) ?? 0) : 0;
    const hasHConfirmedAllowance = statuses.helperAllowance === "confirmed" || (hasSecondHelper && statuses.helper2Allowance === "confirmed");
    const hasHUnknownAllowance = statuses.helperAllowance === "unknown" || (hasSecondHelper && statuses.helper2Allowance === "unknown");
    const finalHelperAllowance = hasHUnknownAllowance ? null : hasHConfirmedAllowance ? h1Allowance + h2Allowance : null;
    const finalHelperAllowanceStatus: ExpenseResolutionStatus = hasHUnknownAllowance ? "unknown" : hasHConfirmedAllowance ? "confirmed" : "not_applicable";

    expensesPayload.helperDailyRate = finalHelperDailyRate;
    expensesPayload.helperAllowance = finalHelperAllowance;

    const finalSupportingDocs: SupportingDocumentRecord[] = [
      ...existingDocs,
      ...supportingFiles.map((f, i) => ({
        id: `doc-${Date.now()}-${i}`,
        name: f.name,
        dropoffId: null,
        storeName: null,
      })),
    ];
    const hasSupporting = finalSupportingDocs.length > 0;
    const updatedDropoffs: DeliveryStoreDropoff[] = dropoffs.map((stop, index) => {
      const feeNum =
        stop.entryFeeStatus === "confirmed" && stop.entryFee !== ""
          ? Number(stop.entryFee)
          : null;
      const hasPod = Boolean(stop.podFile || stop.podSubmitted || (stop.documentRef && stop.documentRef !== "Pending upload"));
      const docRef = stop.podFile
        ? stop.podFile.name
        : (stop.documentRef || (hasPod ? "POD attached" : "Pending upload"));
      return {
        id: stop.id,
        sequence: index + 1,
        storeName: stop.storeName.trim(),
        destinationArea: stop.destinationArea.trim(),
        dropoffCount: Math.max(1, parseInt(stop.dropoffCount, 10) || 1),
        entryFee: feeNum,
        entryFeeStatus: stop.entryFeeStatus,
        podSubmitted: hasPod,
        supportingDocsComplete: hasSupporting || stop.supportingDocsComplete,
        documentRef: docRef,
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
      helperDailyRate: finalHelperDailyRateStatus,
      helperAllowance: finalHelperAllowanceStatus,
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
    const expenseIssueLabels: Record<typeof expenseKeys[number], string> = {
      dieselExpenses: "Fuel receipt",
      tollGateExpenses: "Toll receipts",
      entryFees: "Store entry fee",
      driverAllowance: "Driver allowance",
      driverDailyRate: "Driver rate",
      helperAllowance: "Helper allowance",
      helperDailyRate: "Helper rate",
      otherExpenses: "Other expenses",
    };
    const financialIntegrityIssues = expenseKeys.flatMap((key) => {
      if (isSubcontracted && (key === "driverDailyRate" || key === "driverAllowance" || key === "helperDailyRate" || key === "helperAllowance")) {
        if (updatedStates[key] === "unknown") return [`Pending ${expenseIssueLabels[key].toLowerCase()}`];
        return [];
      }
      const status = updatedStates[key];
      if (status === "unknown") return [`Pending ${expenseIssueLabels[key].toLowerCase()}`];
      if (status === "confirmed" && updatedExpenses[key] == null) {
        return [`Missing ${expenseIssueLabels[key].toLowerCase()} amount`];
      }
      return [];
    });
    const nextFinancialState: FinancialState =
      financialIntegrityIssues.length === 0 ? "finalized" : "incomplete";

    const combinedHelperName =
      hasSecondHelper && helper2Name.trim()
        ? `${helperName.trim()}, ${helper2Name.trim()}`
        : helperName.trim();

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
            helperName: combinedHelperName || null,
            notes: notes.trim() || null,
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
        helperName: combinedHelperName || null,
        notes: notes.trim() || null,
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
            <h2 id="correction-dialog-title">Edit Delivery</h2>
            <p>Waybill: {delivery.waybillNumber} · Current Version: {delivery.version}</p>
          </div>
          <button
            type="button"
            className="routex-dialog-close"
            onClick={handleClose}
            aria-label="Close correction modal"
            title="Close (Esc)"
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

            {/* Live Financial Calculation & Completeness Card */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "12px",
                background: liveIsComplete
                  ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%)"
                  : "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%)",
                border: `1px solid ${liveIsComplete ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                marginBottom: "14px",
              }}
            >
              <div>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                  Live Revenue
                </span>
                <strong style={{ display: "block", fontSize: "14px", color: "var(--color-text-primary)" }}>
                  {formatPeso(liveRevenue)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                  Live Expenses
                </span>
                <strong style={{ display: "block", fontSize: "14px", color: liveIsComplete ? "var(--color-accent-deep)" : "var(--color-danger, #dc2626)" }}>
                  {liveIsComplete ? formatPeso(liveExpensesTotal) : "Incomplete"}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                  Live Net Profit
                </span>
                <strong style={{ display: "block", fontSize: "14px", color: liveIsComplete && liveNetProfit >= 0 ? "#059669" : liveIsComplete ? "#dc2626" : "var(--color-text-muted)" }}>
                  {liveIsComplete ? formatPeso(liveNetProfit) : "Pending"}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                  Margin
                </span>
                <strong style={{ display: "block", fontSize: "14px", color: liveIsComplete ? "#059669" : "var(--color-text-muted)" }}>
                  {liveIsComplete ? `${liveMarginPercent.toFixed(1)}%` : "Pending"}
                </strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textAlign: "center",
                    background: liveIsComplete ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.12)",
                    color: liveIsComplete ? "#059669" : "#dc2626",
                    border: `1px solid ${liveIsComplete ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.25)"}`,
                  }}
                >
                  {liveIsComplete ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Complete
                    </span>
                  ) : (
                    `Pending: ${liveExpenseIssues.join(", ")}`
                  )}
                </span>
              </div>
            </div>

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
                {dropoffs.map((dropoff, index) => {
                  const isLast = index === dropoffs.length - 1;
                  return (
                  <div key={dropoff.id} className={`dropoff-row ${isLast ? "is-last-stop" : ""}`}>
                    <div className="dropoff-row-header">
                      <span className="dropoff-row-title">Store Drop-off #{index + 1}</span>
                      {dropoffs.length > 1 ? (
                        <button
                          type="button"
                          className="dropoff-remove"
                          onClick={() => removeDropoff(index)}
                          title="Remove stop"
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
                      <div className="dropoff-field" style={{ maxWidth: "120px" }}>
                        <label htmlFor={`corr-dropoff-count-${index}`} className="field-label-text">
                          Drop-offs
                        </label>
                        <input
                          id={`corr-dropoff-count-${index}`}
                          type="number"
                          min={1}
                          step={1}
                          required
                          value={dropoff.dropoffCount}
                          onChange={(e) => updateDropoff(index, "dropoffCount", e.target.value)}
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

                    <div
                      style={{
                        marginTop: "10px",
                        paddingTop: "10px",
                        borderTop: "1px dashed var(--color-border-subtle)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 500 }}>
                        Proof of Delivery (POD):
                      </span>
                      {dropoff.podFile || dropoff.podSubmitted || (dropoff.documentRef && dropoff.documentRef !== "Pending upload") ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "12px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            backgroundColor: "var(--color-surface-hover)",
                            border: "1px solid var(--color-border-subtle)",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6 }}>
                            <path d="M4 1h8l3 3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm7 1.5V5h2.5L11 2.5z" />
                          </svg>
                          <span style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {dropoff.podFile?.name ?? (dropoff.documentRef && dropoff.documentRef !== "Pending upload" ? dropoff.documentRef : "POD Attached")}
                          </span>
                          <label
                            style={{
                              cursor: "pointer",
                              color: "var(--color-accent)",
                              fontWeight: 600,
                              fontSize: "11px",
                              marginLeft: "4px",
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
                                  updateDropoff(index, {
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
                              updateDropoff(index, {
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
                            gap: "5px",
                            fontSize: "11.5px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            backgroundColor: "var(--color-surface)",
                            border: "1px dashed var(--color-border-subtle)",
                            color: "var(--color-accent)",
                            fontWeight: 600,
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          Attach POD
                          <input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                updateDropoff(index, {
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
              </div>

              <div className="dropoff-actions-bar" style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  className="button-tertiary add-dropoff"
                  onClick={addDropoff}
                >
                  + Add Location / Store
                </button>
                <span className="dropoff-counter">
                  {totalDropoffs} {totalDropoffs === 1 ? "drop-off" : "drop-offs"} ({dropoffs.length} {dropoffs.length === 1 ? "location" : "locations"})
                </span>
              </div>
            </div>

            {/* Trip Expenses */}
            <div className="routex-dialog-section">
              <h3 className="delivery-finance-group-title">
                {isSubcontracted ? "Subcontracted Expense" : "Trip Expenses"}
              </h3>
              {isSubcontracted ? (
                <div style={{ maxWidth: "420px" }}>
                  <DialogExpenseField
                    id="corr-subcontracted"
                    label="Total Subcontracted Expense"
                    value={expenses.otherExpenses ?? ""}
                    status={statuses.otherExpenses ?? "confirmed"}
                    onValueChange={(val) => setExpenses((prev) => ({ ...prev, otherExpenses: val }))}
                    onStatusChange={(st) => {
                      setStatuses((prev) => ({ ...prev, otherExpenses: st }));
                      if (st !== "confirmed") setExpenses((prev) => ({ ...prev, otherExpenses: "" }));
                    }}
                    hideStatusSwitch
                  />
                </div>
              ) : (
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
                    label="Toll gates"
                    value={expenses.tollGateExpenses ?? ""}
                    status={statuses.tollGateExpenses ?? "confirmed"}
                    onValueChange={(val) => setExpenses((prev) => ({ ...prev, tollGateExpenses: val }))}
                    onStatusChange={(st) => {
                      setStatuses((prev) => ({ ...prev, tollGateExpenses: st }));
                      if (st !== "confirmed") setExpenses((prev) => ({ ...prev, tollGateExpenses: "" }));
                    }}
                  />
                </div>
              )}
            </div>

            {/* Crew Rates & Allowances */}
            <div className="routex-dialog-section">
              <h3 className="delivery-finance-group-title">
                {isSubcontracted ? "Crew Assignment" : "Crew Rates & Allowances"}
              </h3>
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
                  {!isSubcontracted && (
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
                        status={statuses.driverAllowance ?? "confirmed"}
                        onValueChange={(val) => {
                          setExpenses((prev) => ({ ...prev, driverAllowance: val }));
                          setStatuses((prev) => ({ ...prev, driverAllowance: "confirmed" }));
                        }}
                        onStatusChange={(st) => {
                          setStatuses((prev) => ({ ...prev, driverAllowance: st }));
                          if (st !== "confirmed") setExpenses((prev) => ({ ...prev, driverAllowance: "" }));
                        }}
                      />
                    </div>
                  )}
                </section>

                {/* Helper Card */}
                <section className="crew-expense-group">
                  <div className="crew-card-title-row">
                    <span className="crew-role-pill helper">Helper 1</span>
                    <RoundedSelect
                      value={helperName}
                      options={helpers.map((h) => ({
                        value: h.label,
                        label: h.label,
                      }))}
                      onChange={(val) => setHelperName(val)}
                      ariaLabel="Assigned Helper selection"
                      searchable
                      allowCustomValue
                      searchPlaceholder="Search or enter helper"
                    />
                  </div>
                  {!isSubcontracted && (
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
                        status={statuses.helperAllowance ?? "confirmed"}
                        onValueChange={(val) => {
                          setExpenses((prev) => ({ ...prev, helperAllowance: val }));
                          setStatuses((prev) => ({ ...prev, helperAllowance: "confirmed" }));
                        }}
                        onStatusChange={(st) => {
                          setStatuses((prev) => ({ ...prev, helperAllowance: st }));
                          if (st !== "confirmed") setExpenses((prev) => ({ ...prev, helperAllowance: "" }));
                        }}
                      />
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
                        options={helpers.map((h) => ({
                          value: h.label,
                          label: h.label,
                        }))}
                        onChange={(val) => setHelper2Name(val)}
                        ariaLabel="Assigned Helper 2 selection"
                        placeholder="Select or enter helper"
                        searchable
                        allowCustomValue
                        searchPlaceholder="Search or enter helper"
                      />
                      <button
                        type="button"
                        className="remove-helper-btn"
                        onClick={() => {
                          setHasSecondHelper(false);
                          setExpenses((prev) => ({ ...prev, helper2DailyRate: "", helper2Allowance: "" }));
                          setStatuses((prev) => ({ ...prev, helper2DailyRate: "not_applicable", helper2Allowance: "not_applicable" }));
                          setHelper2Name("");
                        }}
                        title="Remove helper"
                      >
                        × Remove
                      </button>
                    </div>
                    {!isSubcontracted && (
                      <div className="crew-rates-fields">
                        <DialogExpenseField
                          id="corr-helper2-rate"
                          label="Daily Rate"
                          value={expenses.helper2DailyRate ?? ""}
                          status={statuses.helper2DailyRate ?? "confirmed"}
                          onValueChange={(val) => setExpenses((prev) => ({ ...prev, helper2DailyRate: val }))}
                          onStatusChange={(st) => {
                            setStatuses((prev) => ({ ...prev, helper2DailyRate: st }));
                            if (st !== "confirmed") setExpenses((prev) => ({ ...prev, helper2DailyRate: "" }));
                          }}
                        />
                        <DialogExpenseField
                          id="corr-helper2-allowance"
                          label="Trip Allowance"
                          value={expenses.helper2Allowance ?? ""}
                          status={statuses.helper2Allowance ?? "confirmed"}
                          onValueChange={(val) => {
                            setExpenses((prev) => ({ ...prev, helper2Allowance: val }));
                            setStatuses((prev) => ({ ...prev, helper2Allowance: "confirmed" }));
                          }}
                          onStatusChange={(st) => {
                            setStatuses((prev) => ({ ...prev, helper2Allowance: st }));
                            if (st !== "confirmed") setExpenses((prev) => ({ ...prev, helper2Allowance: "" }));
                          }}
                        />
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
                        setStatuses((prev) => ({
                          ...prev,
                          helper2DailyRate: isSubcontracted ? "not_applicable" : "confirmed",
                          helper2Allowance: isSubcontracted ? "not_applicable" : "confirmed",
                        }));
                      }}
                    >
                      <div className="crew-add-helper-icon">
                        <svg
                          width="18"
                          height="18"
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
                      </div>
                      <span className="crew-add-helper-label">+ Add Helper</span>
                      <span className="crew-add-helper-hint">Support up to 2 helpers</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Other Operational Expenses */}
            {!isSubcontracted && (
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
            )}

            {/* Supporting Documents */}
            <div className="routex-dialog-section">
              <h3 className="delivery-finance-group-title">Supporting Documents</h3>
              {existingDocs.length > 0 ? (
                <div style={{ marginBottom: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {existingDocs.map((doc, idx) => (
                    <div
                      key={doc.id || `${doc.name}-${idx}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        padding: "6px 10px",
                        background: "var(--color-surface-subtle, #f1f5f9)",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    >
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        {doc.name}
                      </span>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                        <select
                          value={doc.dropoffId ?? "trip"}
                          onChange={(e) => {
                            const val = e.target.value;
                            const foundStop = val === "trip" ? null : dropoffs.find((d) => d.id === val);
                            setExistingDocs((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? {
                                      ...item,
                                      dropoffId: foundStop ? foundStop.id : null,
                                      storeName: foundStop ? foundStop.storeName : null,
                                    }
                                  : item,
                              ),
                            );
                          }}
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            border: "1px solid var(--line)",
                            background: "var(--color-surface)",
                            color: "var(--color-text-primary)",
                            cursor: "pointer",
                          }}
                          aria-label={`Link ${doc.name} to location`}
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
                          onClick={() => setExistingDocs((prev) => prev.filter((_, i) => i !== idx))}
                          style={{
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            color: "var(--color-danger, #ef4444)",
                            fontWeight: "bold",
                            fontSize: "14px",
                            padding: "0 4px",
                          }}
                          title="Remove document"
                          aria-label={`Remove ${doc.name}`}
                        >
                          ×
                        </button>
                      </div>
                    </div>
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

            {/* Trip Notes */}
            <div className="routex-dialog-section">
              <label htmlFor="corr-notes" className="field-label-text">
                Trip Notes & Instructions <span className="field-optional-tag">(Optional)</span>
              </label>
              <textarea
                id="corr-notes"
                rows={2}
                className="correction-reason-textarea"
                placeholder="Optional operational remarks, instructions, or dispatch notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
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
          title={status !== "confirmed" ? "Enter amount" : undefined}
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
