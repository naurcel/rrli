"use client";

import { useMemo, useState } from "react";

import { isDateInRange, useGlobalDateRange } from "@/components/global-date-range-picker";
import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import { Icon } from "@/components/route-x-ui";

const transactions = [
  { id: "TXN-0184", company: "Northstar Retail", category: "Delivery revenue", date: "Oct 21, 2026", amount: "₱18,420", status: "Posted" },
  { id: "TXN-0183", company: "Harbor Foods Co.", category: "Delivery revenue", date: "Oct 20, 2026", amount: "₱12,860", status: "Posted" },
  { id: "TXN-0182", company: "RouteX Fleet Services", category: "Fuel expense", date: "Oct 19, 2026", amount: "₱8,400", status: "Posted" },
  { id: "TXN-0181", company: "Evergreen Supply", category: "Delivery revenue", date: "Oct 18, 2026", amount: "₱9,740", status: "Pending" },
  { id: "TXN-0180", company: "Workshop Partners", category: "Maintenance expense", date: "Oct 17, 2026", amount: "₱21,110", status: "Posted" },
] as const;

const transactionStatuses = ["All statuses", ...Array.from(new Set(transactions.map((transaction) => transaction.status)))] as const;

export default function TransactionsPage() {
  const { range } = useGlobalDateRange();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All statuses");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const filteredTransactions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesQuery = !normalized || Object.values(transaction).some((value) => value.toLowerCase().includes(normalized));
      const matchesStatus = statusFilter === "All statuses" || transaction.status === statusFilter;
      return matchesQuery && matchesStatus && isDateInRange(transaction.date, range);
    });
  }, [query, range, statusFilter]);

  return (
    <div className="app-shell">
      <OperationalSidebar />
      <main className="main-content">
        <OperationalTopbar />
        <div className="content-wrap">
          <section className="page-intro"><div><p className="eyebrow">OPERATIONS / FINANCIALS</p><h1>Transactions</h1><p className="subtitle">Review revenue, expenses, and financial entries across RouteX operations.</p></div><button className="secondary-button" disabled title="Creation is unavailable until the data and authorization boundary is connected"><Icon>＋</Icon> New transaction <span className="lock">◌</span></button></section>
          <div className="notice" role="status"><span className="notice-icon">i</span><div><strong>Preview data only</strong><span>This screen uses local financial records while the approved data model and authorization boundary are finalized.</span></div></div>
          <section className="records-card transaction-records">
            <div className="records-heading"><div><h2>Financial transactions</h2><p>Showing locally available preview records</p></div><button className="export-button" disabled><Icon>⇩</Icon> Export <span className="lock">◌</span></button></div>
            <div className="filters">
              <label className="search-box"><Icon>⌕</Icon><input aria-label="Search transactions" placeholder="Search by transaction, company, or category" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              {showMoreFilters && <RoundedSelect ariaLabel="Filter transactions by status" className="inline-filter" options={transactionStatuses} value={statusFilter} onChange={setStatusFilter} />}
              <button className="filter-button" type="button" aria-expanded={showMoreFilters} onClick={() => setShowMoreFilters((visible) => !visible)}><Icon>≡</Icon> {showMoreFilters ? "Hide filters" : "More filters"}</button>
            </div>
            <div className="table-wrap"><table><thead><tr><th>Transaction</th><th>Company</th><th>Category</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{filteredTransactions.map((transaction) => <tr key={transaction.id}><td><a href={`#${transaction.id}`} className="record-link">{transaction.id}</a></td><td>{transaction.company}</td><td>{transaction.category}</td><td>{transaction.date}</td><td className="money">{transaction.amount}</td><td><span className={`pod-status ${transaction.status === "Pending" ? "missing" : "attached"}`}><i />{transaction.status}</span></td></tr>)}</tbody></table>{filteredTransactions.length === 0 && <div className="empty-state"><strong>No transactions found</strong><span>Try a different search, date range, or status filter.</span></div>}</div>
            <div className="table-footer"><span>{filteredTransactions.length} of {transactions.length} preview records</span><div className="pagination"><button disabled aria-label="Previous page">‹</button><span>1</span><button disabled aria-label="Next page">›</button></div></div>
          </section>
          <p className="scope-note"><span>●</span> Financial preview only · Reconciliation, approvals, and posting controls are intentionally unavailable.</p>
        </div>
      </main>
    </div>
  );
}
