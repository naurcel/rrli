"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import { Icon } from "@/components/route-x-ui";
import { saveCreatedTransaction } from "@/features/transactions/transaction-local-preview";
import { createPreviewRecordId, formatPreviewDate, formatPreviewPeso } from "@/lib/preview/format";

const flowOptions = ["Revenue", "Expense"] as const;

export default function NewTransactionPage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [flow, setFlow] = useState<(typeof flowOptions)[number]>("Expense");
  const [recordedOn, setRecordedOn] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRecordedOn(new Date().toISOString().slice(0, 10));
  }, []);

  function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!company.trim() || !recordedOn) {
      setError("Enter a company and transaction date.");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a positive amount.");
      return;
    }

    saveCreatedTransaction({
      id: createPreviewRecordId("TXN"),
      company: company.trim(),
      category: `Local ${flow.toLowerCase()} entry`,
      date: formatPreviewDate(recordedOn),
      amount: formatPreviewPeso(numericAmount),
      status: "Pending",
      createdAt: new Date().toISOString(),
    });
    router.replace("/transactions");
  }

  return <div className="app-shell"><OperationalSidebar /><main className="main-content"><OperationalTopbar /><div className="content-wrap preview-create-page"><Link className="back-link" href="/transactions">‹ Back to transactions</Link><section className="page-intro"><div><h1>Add transaction</h1><p className="subtitle">Capture a local entry without posting or reconciliation.</p></div></section><section className="records-card preview-create-card"><div className="records-heading"><div><h2>Financial entry</h2><p>All new local entries remain pending.</p></div></div><form className="preview-create-form" onSubmit={createTransaction}><label>Company<input value={company} onChange={(event) => { setCompany(event.target.value); setError(""); }} placeholder="e.g. Northstar Retail" autoComplete="organization" autoFocus /></label><div className="preview-create-grid"><label>Flow<RoundedSelect ariaLabel="Choose a transaction flow" options={flowOptions} value={flow} onChange={(value) => setFlow(value as (typeof flowOptions)[number])} /></label><label>Date<input type="date" value={recordedOn} onChange={(event) => { setRecordedOn(event.target.value); setError(""); }} /></label></div><label>Amount<input type="number" min="1" step="1" inputMode="numeric" value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} placeholder="0" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="truck-create-actions"><Link className="filter-button" href="/transactions">Cancel</Link><button className="primary-button" type="submit"><Icon>＋</Icon> Add local transaction</button></div></form></section><p className="scope-note"><span>●</span> Local only · It does not post a financial entry, affect reports, or represent an approved category, rate, or accounting workflow.</p></div></main></div>;
}
