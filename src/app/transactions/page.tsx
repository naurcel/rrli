"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { isDateInRange, useGlobalDateRange } from "@/components/global-date-range-picker";
import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RecordDetailDrawer, type RecordDetailSection } from "@/components/record-detail-drawer";
import { RoundedSelect } from "@/components/rounded-select";
import { Icon } from "@/components/route-x-ui";
import { getNextSortState, SortableTableHeader, type SortState } from "@/components/sortable-table-header";
import { readCreatedTransactions, TRANSACTION_PREVIEW_UPDATED_EVENT, type CreatedTransactionPreview } from "@/features/transactions/transaction-local-preview";

type Transaction = {
  id: string;
  company: string;
  category: string;
  date: string;
  amount: string;
  status: "Posted" | "Pending";
};

type TransactionSortKey = keyof Transaction;

const transactions: Transaction[] = [
  { id: "TXN-0184", company: "Northstar Retail", category: "Delivery revenue", date: "Oct 21, 2026", amount: "₱18,420", status: "Posted" },
  { id: "TXN-0183", company: "Harbor Foods Co.", category: "Delivery revenue", date: "Oct 20, 2026", amount: "₱12,860", status: "Posted" },
  { id: "TXN-0182", company: "RouteX Fleet Services", category: "Fuel expense", date: "Oct 19, 2026", amount: "₱8,400", status: "Posted" },
  { id: "TXN-0181", company: "Evergreen Supply", category: "Delivery revenue", date: "Oct 18, 2026", amount: "₱9,740", status: "Pending" },
  { id: "TXN-0180", company: "Workshop Partners", category: "Maintenance expense", date: "Oct 17, 2026", amount: "₱21,110", status: "Posted" },
  { id: "TXN-0179", company: "Metro Buildworks", category: "Delivery revenue", date: "Oct 17, 2026", amount: "₱21,110", status: "Posted" },
  { id: "TXN-0178", company: "RouteX Fleet Services", category: "Fuel expense", date: "Oct 16, 2026", amount: "₱7,860", status: "Posted" },
  { id: "TXN-0177", company: "Lumen Home Goods", category: "Delivery revenue", date: "Oct 15, 2026", amount: "₱7,980", status: "Posted" },
  { id: "TXN-0176", company: "Tollway Services", category: "Toll expense", date: "Oct 15, 2026", amount: "₱2,450", status: "Posted" },
  { id: "TXN-0175", company: "Summit Hardware", category: "Delivery revenue", date: "Oct 14, 2026", amount: "₱14,560", status: "Posted" },
  { id: "TXN-0174", company: "RouteX Fleet Services", category: "Fuel expense", date: "Oct 14, 2026", amount: "₱6,920", status: "Posted" },
  { id: "TXN-0173", company: "Pacific Agri Supply", category: "Delivery revenue", date: "Oct 13, 2026", amount: "₱16,280", status: "Posted" },
  { id: "TXN-0172", company: "Driver Operations", category: "Driver allowance expense", date: "Oct 13, 2026", amount: "₱3,200", status: "Pending" },
  { id: "TXN-0171", company: "Cedar & Stone", category: "Delivery revenue", date: "Oct 11, 2026", amount: "₱11,390", status: "Posted" },
  { id: "TXN-0170", company: "Tollway Services", category: "Toll expense", date: "Oct 10, 2026", amount: "₱1,980", status: "Posted" },
  { id: "TXN-0169", company: "Brightline Markets", category: "Delivery revenue", date: "Oct 10, 2026", amount: "₱8,740", status: "Posted" },
  { id: "TXN-0168", company: "Oakridge Manufacturing", category: "Delivery revenue", date: "Oct 8, 2026", amount: "₱19,620", status: "Posted" },
  { id: "TXN-0167", company: "Workshop Partners", category: "Maintenance expense", date: "Oct 8, 2026", amount: "₱5,600", status: "Pending" },
  { id: "TXN-0166", company: "Atlas Office Supply", category: "Delivery revenue", date: "Oct 7, 2026", amount: "₱10,850", status: "Posted" },
  { id: "TXN-0165", company: "RouteX Administration", category: "Administrative expense", date: "Oct 7, 2026", amount: "₱4,250", status: "Posted" },
  { id: "TXN-0164", company: "Greenway Pharmacy", category: "Delivery revenue", date: "Oct 6, 2026", amount: "₱13,210", status: "Posted" },
  { id: "TXN-0163", company: "RouteX Fleet Services", category: "Fuel expense", date: "Oct 6, 2026", amount: "₱7,340", status: "Posted" },
  { id: "TXN-0162", company: "Riverside Packaging", category: "Delivery revenue", date: "Oct 4, 2026", amount: "₱17,045", status: "Posted" },
  { id: "TXN-0161", company: "Driver Operations", category: "Driver allowance expense", date: "Oct 2, 2026", amount: "₱3,750", status: "Posted" },
  { id: "TXN-0160", company: "Silverline Imports", category: "Delivery revenue", date: "Oct 2, 2026", amount: "₱6,920", status: "Posted" },
];

const transactionKinds = ["All flows", "Revenue", "Expense"];

function toAmount(value: string) {
  return Number(value.replace(/[^\d.-]/g, ""));
}

function formatPeso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function compareTransactions(left: Transaction, right: Transaction, key: TransactionSortKey) {
  if (key === "date") return Date.parse(left.date) - Date.parse(right.date);
  if (key === "amount") return toAmount(left.amount) - toAmount(right.amount);
  return left[key].localeCompare(right[key], undefined, { numeric: true, sensitivity: "base" });
}

function getTransactionSections(transaction: Transaction): RecordDetailSection[] {
  return [
    {
      title: "Transaction",
      fields: [
        { label: "Company", value: transaction.company },
        { label: "Category", value: transaction.category },
        { label: "Date", value: transaction.date },
        { label: "Status", value: transaction.status, tone: transaction.status === "Pending" ? "warning" : "success" },
      ],
    },
    {
      title: "Amount",
      fields: [{ label: "Recorded amount", value: transaction.amount, tone: transaction.category.includes("expense") ? "warning" : "success" }],
      note: "Posting, approvals, source documents, and reconciliation are not connected.",
    },
  ];
}

export default function TransactionsPage() {
  const { range } = useGlobalDateRange();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [flowFilter, setFlowFilter] = useState("All flows");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [sort, setSort] = useState<SortState<TransactionSortKey>>({ key: null, direction: "desc" });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [createdTransactions, setCreatedTransactions] = useState<CreatedTransactionPreview[]>([]);

  useEffect(() => {
    const syncCreatedTransactions = () => setCreatedTransactions(readCreatedTransactions());
    syncCreatedTransactions();
    window.addEventListener(TRANSACTION_PREVIEW_UPDATED_EVENT, syncCreatedTransactions);
    return () => window.removeEventListener(TRANSACTION_PREVIEW_UPDATED_EVENT, syncCreatedTransactions);
  }, []);

  const allTransactions = useMemo<Transaction[]>(() => [...createdTransactions, ...transactions], [createdTransactions]);
  const transactionStatuses = useMemo(() => ["All statuses", ...Array.from(new Set(allTransactions.map((transaction) => transaction.status)))], [allTransactions]);
  const transactionCategories = useMemo(() => ["All categories", ...Array.from(new Set(allTransactions.map((transaction) => transaction.category)))], [allTransactions]);

  const transactionKpis = useMemo(() => {
    const inRange = allTransactions.filter((transaction) => isDateInRange(transaction.date, range));
    const revenueEntries = inRange.filter((transaction) => transaction.category.includes("revenue"));
    const expenseEntries = inRange.filter((transaction) => transaction.category.includes("expense"));
    return {
      revenue: revenueEntries.reduce((total, transaction) => total + toAmount(transaction.amount), 0),
      expenses: expenseEntries.reduce((total, transaction) => total + toAmount(transaction.amount), 0),
      revenueCount: revenueEntries.length,
      expenseCount: expenseEntries.length,
      pending: inRange.filter((transaction) => transaction.status === "Pending").length,
      total: inRange.length,
    };
  }, [allTransactions, range]);

  const hasAdvancedFilters = categoryFilter !== "All categories" || flowFilter !== "All flows";
  const filteredTransactions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = allTransactions.filter((transaction) => {
      const matchesQuery = !normalized || Object.values(transaction).some((value) => value.toLowerCase().includes(normalized));
      const matchesFlow = flowFilter === "All flows" || (flowFilter === "Revenue" ? transaction.category.includes("revenue") : transaction.category.includes("expense"));
      return matchesQuery
        && (statusFilter === "All statuses" || transaction.status === statusFilter)
        && (categoryFilter === "All categories" || transaction.category === categoryFilter)
        && matchesFlow
        && isDateInRange(transaction.date, range);
    });
    if (!sort.key) return filtered;
    return [...filtered].sort((left, right) => compareTransactions(left, right, sort.key!) * (sort.direction === "asc" ? 1 : -1));
  }, [allTransactions, categoryFilter, flowFilter, query, range, sort, statusFilter]);

  const clearAdvancedFilters = () => {
    setCategoryFilter("All categories");
    setFlowFilter("All flows");
  };

  const updateSort = (column: TransactionSortKey) => {
    setSort((current) => getNextSortState(current, column));
  };

  return (
    <div className="app-shell">
      <OperationalSidebar />
      <main className="main-content">
        <OperationalTopbar />
        <div className="content-wrap">
          <section className="page-intro">
            <div>
              <h1>Transactions</h1>
              <p className="subtitle">Review revenue, expenses, and financial entries across the workspace.</p>
            </div>
            <Link className="secondary-button" href="/transactions/new">
              <Icon>＋</Icon> Add transaction
            </Link>
          </section>

          <div className="notice" role="status">
            <span className="notice-icon">i</span>
            <div>
              <strong>Local data only</strong>
              <span>This screen uses local financial records while the approved data model and authorization boundary are finalized.</span>
            </div>
          </div>

          <section className="stat-grid transaction-stats" aria-label="Transaction summary for the selected date range">
            <article className="stat-card">
              <span className="stat-label">REVENUE ENTRIES</span>
              <strong>{formatPeso(transactionKpis.revenue)}</strong>
              <span className="stat-meta positive"><em>{transactionKpis.revenueCount} local revenue entries</em></span>
            </article>
            <article className="stat-card">
              <span className="stat-label">EXPENSE ENTRIES</span>
              <strong>{formatPeso(transactionKpis.expenses)}</strong>
              <span className="stat-meta"><em>{transactionKpis.expenseCount} local expense entries</em></span>
            </article>
            <article className="stat-card">
              <span className="stat-label">PENDING REVIEW</span>
              <strong>{transactionKpis.pending}</strong>
              <span className={transactionKpis.pending > 0 ? "stat-meta warning" : "stat-meta positive"}>
                <em>{transactionKpis.pending > 0 ? "Needs attention" : "No pending entries"}</em> in {transactionKpis.total} selected records
              </span>
            </article>
          </section>

          <section className="records-card transaction-records">
            <div className="records-heading">
              <div>
                <h2>Financial transactions</h2>
                <p>Filter local records or select a row to review its available details.</p>
              </div>
              <button className="export-button" disabled><Icon>⇩</Icon> Export <span className="lock">◌</span></button>
            </div>

            <div className="filters">
              <label className="search-box">
                <Icon>⌕</Icon>
                <input aria-label="Search transactions" placeholder="Search by transaction, company, or category" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <RoundedSelect ariaLabel="Filter transactions by status" options={transactionStatuses} value={statusFilter} onChange={setStatusFilter} />
              <div className="more-filters-control">
                <button className="filter-button" type="button" aria-expanded={showMoreFilters} onClick={() => setShowMoreFilters((visible) => !visible)}>
                  <Icon>≡</Icon> More filters
                </button>
                {showMoreFilters && <div className="more-filters-popover"><span>Refine by</span><RoundedSelect ariaLabel="Filter transactions by category" options={transactionCategories} value={categoryFilter} onChange={setCategoryFilter} /><RoundedSelect ariaLabel="Filter transactions by financial flow" options={transactionKinds} value={flowFilter} onChange={setFlowFilter} /></div>}
              </div>
              {hasAdvancedFilters && <button className="filter-button filter-clear" type="button" onClick={clearAdvancedFilters}>Clear filters</button>}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <SortableTableHeader column="id" label="Transaction" sort={sort} onSort={updateSort} />
                    <SortableTableHeader column="company" label="Company" sort={sort} onSort={updateSort} />
                    <SortableTableHeader column="category" label="Category" sort={sort} onSort={updateSort} />
                    <SortableTableHeader column="date" label="Date" sort={sort} onSort={updateSort} />
                    <SortableTableHeader column="amount" label="Amount" sort={sort} onSort={updateSort} />
                    <SortableTableHeader column="status" label="Status" sort={sort} onSort={updateSort} />
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr
                      className="record-row"
                      tabIndex={0}
                      role="button"
                      aria-label={"View " + transaction.id + " details"}
                      key={transaction.id}
                      onClick={() => setSelectedTransaction(transaction)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedTransaction(transaction);
                        }
                      }}
                    >
                      <td className="record-link">{transaction.id}</td>
                      <td>{transaction.company}</td>
                      <td>{transaction.category}</td>
                      <td>{transaction.date}</td>
                      <td className="money">{transaction.amount}</td>
                      <td><span className={transaction.status === "Pending" ? "pod-status missing" : "pod-status attached"}><i />{transaction.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTransactions.length === 0 && <div className="empty-state"><strong>No transactions found</strong><span>Try a different search, date range, or status filter.</span></div>}
            </div>

            <div className="table-footer">
              <span>
                {filteredTransactions.length} of {allTransactions.length} local records{" "}
                {sort.key ? "· sorted by " + sort.key + " " + (sort.direction === "asc" ? "ascending" : "descending") : "· default date order"}
              </span>
              <div className="pagination">
                <button disabled aria-label="Previous page">‹</button>
                <span>1</span>
                <button disabled aria-label="Next page">›</button>
              </div>
            </div>
          </section>

          <p className="scope-note"><span>●</span> Local data only · Reconciliation, approvals, and posting controls are intentionally unavailable.</p>
        </div>
      </main>
      <RecordDetailDrawer
        record={selectedTransaction ? {
          title: selectedTransaction.id,
          subtitle: "FINANCIAL TRANSACTION",
          status: { label: selectedTransaction.status, tone: selectedTransaction.status === "Pending" ? "warning" : "success" },
          sections: getTransactionSections(selectedTransaction),
        } : null}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  );
}
