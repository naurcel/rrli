"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import { Icon } from "@/components/route-x-ui";
import { saveCreatedDelivery } from "@/features/deliveries/delivery-local-preview";
import {
  calculateDeliveryCompletionFinancials,
  DELIVERY_COMPLETION_EXPENSE_CATEGORIES,
  type DeliveryCompletionExpenseCategory,
  type DeliveryExpenseConfirmation,
} from "@/features/deliveries/completion/delivery-completion-financials";
import { ownedFleetTrucks } from "@/features/fleet/fleet-preview-data";
import { createPreviewRecordId, formatPreviewDate, formatPreviewPeso } from "@/lib/preview/format";

const podOptions = ["Attached", "Missing"] as const;
const expenseLabels: Record<DeliveryCompletionExpenseCategory, string> = {
  fuel: "Fuel", tolls: "Tolls", "other-expenses": "Other expenses", "entry-fees": "Entry fees", "driver-helper-costs": "Driver / helper costs",
};

type ExpenseState = "unknown" | "amount" | "not-applicable";
type ExpenseStates = Record<DeliveryCompletionExpenseCategory, ExpenseState>;
type ExpenseAmounts = Record<DeliveryCompletionExpenseCategory, string>;

const initialExpenseStates = (): ExpenseStates => Object.fromEntries(DELIVERY_COMPLETION_EXPENSE_CATEGORIES.map((category) => [category, "unknown"])) as ExpenseStates;
const initialExpenseAmounts = (): ExpenseAmounts => Object.fromEntries(DELIVERY_COMPLETION_EXPENSE_CATEGORIES.map((category) => [category, ""])) as ExpenseAmounts;

export default function NewDeliveryPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [client, setClient] = useState("");
  const [truck, setTruck] = useState(ownedFleetTrucks[0]?.id ?? "");
  const [driver, setDriver] = useState("");
  const [completedOn, setCompletedOn] = useState("");
  const [rate, setRate] = useState("");
  const [expenseStates, setExpenseStates] = useState<ExpenseStates>(initialExpenseStates);
  const [expenseAmounts, setExpenseAmounts] = useState<ExpenseAmounts>(initialExpenseAmounts);
  const [pod, setPod] = useState<(typeof podOptions)[number]>("Missing");
  const [podAttachment, setPodAttachment] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [financialSummary, setFinancialSummary] = useState<{ rate: number; totalExpenses: number; netIncome: number } | null>(null);

  useEffect(() => { setCompletedOn(new Date().toISOString().slice(0, 10)); }, []);
  const clearError = () => setError("");

  const continueDeliveryDetails = () => {
    if (!client.trim() || !truck || !driver.trim() || !completedOn) {
      setError("Enter a client, truck, driver, and delivery date before continuing.");
      return;
    }
    clearError(); setStep(2);
  };

  const getExpenseConfirmations = (): DeliveryExpenseConfirmation[] => DELIVERY_COMPLETION_EXPENSE_CATEGORIES.map((category) => {
    const rawAmount = expenseAmounts[category].trim();
    return { category, state: expenseStates[category], ...(expenseStates[category] === "amount" && rawAmount ? { amount: Number(rawAmount) } : {}) };
  });

  const continueFinancials = () => {
    const result = calculateDeliveryCompletionFinancials({ rate: Number(rate), expenses: getExpenseConfirmations() });
    if (!result.ok) { setError(Object.values(result.fieldErrors)[0] ?? "Confirm the delivery financials before continuing."); return; }
    setFinancialSummary(result.value); clearError(); setStep(3);
  };

  const createDelivery = () => {
    if (!financialSummary) { setStep(2); setError("Confirm the financial information before finalizing this delivery."); return; }
    if (pod === "Attached" && !podAttachment) {
      setError("Attach the proof-of-delivery file or mark the POD as missing.");
      return;
    }
    saveCreatedDelivery({
      id: createPreviewRecordId("DLV"), client: client.trim(), truck, driver: driver.trim(),
      completed: formatPreviewDate(completedOn), revenue: formatPreviewPeso(financialSummary.rate), expenses: formatPreviewPeso(financialSummary.totalExpenses), pod, podAttachmentName: podAttachment?.name, createdAt: new Date().toISOString(),
    });
    router.replace("/deliveries");
  };

  const updateExpenseAmount = (category: DeliveryCompletionExpenseCategory, value: string) => {
    setExpenseAmounts((current) => ({ ...current, [category]: value }));
    setExpenseStates((current) => ({ ...current, [category]: "amount" })); clearError();
  };
  const toggleNotApplicable = (category: DeliveryCompletionExpenseCategory, checked: boolean) => {
    setExpenseStates((current) => ({ ...current, [category]: checked ? "not-applicable" : "unknown" })); clearError();
  };

  return <div className="app-shell"><OperationalSidebar /><main className="main-content"><OperationalTopbar /><div className="content-wrap preview-create-page">
    <Link className="back-link" href="/deliveries">‹ Back to deliveries</Link>
    <section className="page-intro"><div><h1>Add delivery</h1><p className="subtitle">Capture delivery details first, confirm financials next, then record proof of delivery.</p></div></section>
    <section className="records-card preview-create-card"><div className="records-heading"><div><h2>New delivery</h2><p>Step {step} of 3 · {step === 1 ? "Delivery details" : step === 2 ? "Financial input" : "Proof of delivery"}</p></div></div>
      <div className="delivery-stepper" aria-label={`Delivery creation step ${step} of 3`}><span className={step >= 1 ? "active" : ""}>1</span><i /><span className={step >= 2 ? "active" : ""}>2</span><i /><span className={step >= 3 ? "active" : ""}>3</span></div>
      <div className="preview-create-form">
        {step === 1 && <><label>Client<input value={client} onChange={(event) => { setClient(event.target.value); clearError(); }} placeholder="e.g. Northstar Retail" autoComplete="organization" autoFocus /></label><div className="preview-create-grid"><label>Truck<RoundedSelect ariaLabel="Choose a truck" options={ownedFleetTrucks.map((item) => item.id)} value={truck} onChange={(value) => { setTruck(value); clearError(); }} /></label><label>Driver<input value={driver} onChange={(event) => { setDriver(event.target.value); clearError(); }} placeholder="e.g. A. Reyes" autoComplete="name" /></label></div><label>Delivery date<input type="date" value={completedOn} onChange={(event) => { setCompletedOn(event.target.value); clearError(); }} /></label></>}
        {step === 2 && <><label>Recorded rate<input type="number" min="0" step="0.01" inputMode="decimal" value={rate} onChange={(event) => { setRate(event.target.value); clearError(); }} placeholder="0.00" autoFocus /></label><div className="financial-entry-list">{DELIVERY_COMPLETION_EXPENSE_CATEGORIES.map((category) => <div className="financial-entry" key={category}><label>{expenseLabels[category]}<input type="number" min="0" step="0.01" inputMode="decimal" disabled={expenseStates[category] === "not-applicable"} value={expenseAmounts[category]} onChange={(event) => updateExpenseAmount(category, event.target.value)} placeholder="Enter confirmed amount" /></label><label className="expense-not-applicable"><input type="checkbox" checked={expenseStates[category] === "not-applicable"} onChange={(event) => toggleNotApplicable(category, event.target.checked)} /> Not applicable</label></div>)}</div></>}
        {step === 3 && <><div className="delivery-final-review"><strong>Financial review</strong><dl><div><dt>Rate</dt><dd>{formatPreviewPeso(financialSummary?.rate ?? 0)}</dd></div><div><dt>Total expenses</dt><dd>{formatPreviewPeso(financialSummary?.totalExpenses ?? 0)}</dd></div><div><dt>Net income</dt><dd>{formatPreviewPeso(financialSummary?.netIncome ?? 0)}</dd></div></dl></div><label>Proof of delivery<RoundedSelect ariaLabel="Choose proof of delivery status" options={podOptions} value={pod} onChange={(value) => { const next = value as (typeof podOptions)[number]; setPod(next); if (next === "Missing") setPodAttachment(null); clearError(); }} /></label>{pod === "Attached" && <div className="pod-attachment"><label className="pod-attachment-trigger">Attach POD file<input type="file" accept="image/*,application/pdf" onChange={(event) => { const file = event.target.files?.[0] ?? null; setPodAttachment(file); if (file) setPod("Attached"); clearError(); }} /></label>{podAttachment ? <div className="pod-attachment-file"><span>{podAttachment.name}</span><button type="button" onClick={() => setPodAttachment(null)} aria-label="Remove proof-of-delivery attachment">Remove</button></div> : <span>Choose an image or PDF proof of delivery.</span>}</div>}<p className="field-help">Proof of delivery is recorded only after delivery details and financials have been confirmed.</p></>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="truck-create-actions">{step === 1 ? <Link className="filter-button" href="/deliveries">Cancel</Link> : <button className="filter-button" type="button" onClick={() => { clearError(); setStep((current) => current - 1); }}>Back</button>}{step === 1 ? <button className="primary-button" type="button" onClick={continueDeliveryDetails}>Continue to financials</button> : step === 2 ? <button className="primary-button" type="button" onClick={continueFinancials}>Continue to POD</button> : <button className="primary-button" type="button" onClick={createDelivery}><Icon>＋</Icon> Finalize local delivery</button>}</div>
      </div>
    </section><p className="scope-note"><span>●</span> Local workspace record · Delivery details, financial inputs, and POD are collected in sequence.</p>
  </div></main></div>;
}
