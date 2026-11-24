"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  formatDateRange,
  parseDateValue,
  toDateKey,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import type { TableSortDirection } from "@/components/sortable-table-header";
import {
  buildFinancialTimeSeries,
  calculateTopClient,
} from "@/features/dashboard/dashboard-kpi";
import {
  DashboardAttentionNeeded,
  DashboardFinancialChart,
  DashboardHeader,
  DashboardRecentDeliveries,
  DashboardSummaryCards,
  DashboardTopTrucks,
  type TruckRankingMetric,
} from "@/features/dashboard/components";
import {
  getDeliveryIncompleteIssues,
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
} from "@/features/deliveries/delivery-domain";
import {
  useDeliveryProfitabilitySummary,
  type PersistedTruckSummary,
} from "@/features/deliveries/use-delivery-profitability-summary";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import {
  readBrowserPreviewExpenses,
  ROUTEX_COMPANY_EXPENSES_CHANGED,
} from "@/features/finance/browser-preview-expenses";
import {
  filterExpensesByDateRange,
  type CompanyExpense,
} from "@/features/finance/company-expense-domain";
import { canMutateDeliveryRecords } from "@/lib/auth/rbac";

function getTimeOfDayGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

function getAttentionIssueTooltip(label: string): string {
  if (label.startsWith("Missing POD")) return "Proof of delivery document required";
  if (label === "Pending fuel receipt") return "Fuel expense receipt pending";
  if (label === "Pending toll receipts") return "Highway toll receipts pending";
  if (label.startsWith("Pending store entry fee")) return "Store entry fee receipt pending";
  if (label === "Pending driver rate") return "Driver daily wage pending";
  if (label === "Pending driver allowance") return "Driver trip allowance pending";
  if (label === "Pending helper rate") return "Helper daily wage pending";
  if (label === "Pending helper allowance") return "Helper trip allowance pending";
  if (label === "Missing delivery rate") return "Agreed billing rate pending";
  if (label === "No driver assigned") return "Primary driver not yet assigned";
  return label;
}

function truckRankingValue(
  truck: PersistedTruckSummary,
  metric: TruckRankingMetric,
): number {
  if (metric === "revenue") return truck.revenue;
  if (metric === "expenses") return truck.expenses;
  if (metric === "profitMargin") {
    return truck.profit_margin ?? Number.NEGATIVE_INFINITY;
  }
  return truck.net_income;
}

export default function DashboardPage() {
  const router = useRouter();
  const actor = useAuthenticatedActor();
  const { range, setRange } = useGlobalDateRange();
  const { deliveries, loading, error } = usePersistedDeliveries(range);
  const { summary: persistedSummary } = useDeliveryProfitabilitySummary(range);
  const [accessNoticeDismissed, setAccessNoticeDismissed] = useState(false);
  const [truckRankingMetric, setTruckRankingMetric] =
    useState<TruckRankingMetric>("netIncome");
  const [deliverySort, setDeliverySort] = useState<{
    key: string;
    direction: TableSortDirection;
  }>({ key: "date", direction: "desc" });
  const [companyExpenses, setCompanyExpenses] = useState<CompanyExpense[]>([]);
  const [expandedAttentionIds, setExpandedAttentionIds] = useState<Set<string>>(new Set());
  const [greeting, setGreeting] = useState<string>(() => getTimeOfDayGreeting());

  useEffect(() => {
    setGreeting(getTimeOfDayGreeting());
    const params = new URLSearchParams(window.location.search);
    const sortParam = params.get("sort");
    if (sortParam && sortParam.includes(":")) {
      const [key, direction] = sortParam.split(":");
      if (key && (direction === "asc" || direction === "desc")) {
        setDeliverySort({ key, direction });
      }
    }
    const truckMetricParam = params.get("truckMetric");
    if (
      truckMetricParam === "revenue" ||
      truckMetricParam === "netIncome" ||
      truckMetricParam === "expenses" ||
      truckMetricParam === "profitMargin"
    ) {
      setTruckRankingMetric(truckMetricParam);
    }
    const dateFromParam = params.get("dateFrom");
    const dateToParam = params.get("dateTo");
    if (dateFromParam !== null || dateToParam !== null) {
      setRange({
        startDate: dateFromParam ? parseDateValue(dateFromParam) : null,
        endDate: dateToParam ? parseDateValue(dateToParam) : null,
      });
    }
  }, [setRange]);

  function buildCurrentDashboardUrl(): string {
    const params = new URLSearchParams();
    if (deliverySort.key !== "date" || deliverySort.direction !== "desc") {
      params.set("sort", `${deliverySort.key}:${deliverySort.direction}`);
    }
    if (truckRankingMetric !== "netIncome") {
      params.set("truckMetric", truckRankingMetric);
    }
    if (range.startDate) params.set("dateFrom", toDateKey(range.startDate));
    if (range.endDate) params.set("dateTo", toDateKey(range.endDate));
    const qs = params.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  }

  function navigateToDashboardDelivery(tripId: string, isAttention = false) {
    const params = new URLSearchParams();
    params.set("from", "dashboard");
    params.set("sort", `${deliverySort.key}:${deliverySort.direction}`);
    if (isAttention) params.set("attention", "1");
    if (range.startDate) params.set("dateFrom", toDateKey(range.startDate));
    if (range.endDate) params.set("dateTo", toDateKey(range.endDate));
    params.set("returnTo", buildCurrentDashboardUrl());
    params.set("returnLabel", "Dashboard");
    router.push(`/deliveries/${encodeURIComponent(tripId)}?${params.toString()}`);
  }

  const toggleAttentionItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedAttentionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    async function fetchExpenses() {
      try {
        const res = await fetch("/api/finance/expenses?pageSize=1000");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.items)) {
            setCompanyExpenses(data.items);
            return;
          }
        }
      } catch {
        // Fallback
      }
      setCompanyExpenses(readBrowserPreviewExpenses());
    }

    fetchExpenses();

    const onExpensesChanged = () => {
      setCompanyExpenses(readBrowserPreviewExpenses());
    };
    window.addEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, onExpensesChanged);
    return () => {
      window.removeEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, onExpensesChanged);
    };
  }, []);

  const filteredDeliveries = deliveries;
  const deliveriesWithMissingDetails = useMemo(() => {
    return filteredDeliveries
      .map((delivery) => {
        const issues = getDeliveryIncompleteIssues(delivery);
        return {
          delivery,
          issues: issues.map((label) => ({
            label,
            tooltip: getAttentionIssueTooltip(label),
          })),
        };
      })
      .filter((item) => item.issues.length > 0);
  }, [filteredDeliveries]);

  const topClientData = useMemo(
    () => calculateTopClient(filteredDeliveries),
    [filteredDeliveries],
  );

  const sortedDeliveries = useMemo(() => {
    const multiplier = deliverySort.direction === "asc" ? 1 : -1;
    return [...filteredDeliveries].sort((left, right) => {
      const values: Record<string, [string | number, string | number]> = {
        date: [left.deliveryDate, right.deliveryDate],
        client: [left.clientName, right.clientName],
        truck: [left.plateNumber, right.plateNumber],
        dropoffs: [left.dropoffs.length, right.dropoffs.length],
        revenue: [left.deliveryRate ?? 0, right.deliveryRate ?? 0],
        netIncome: [
          left.netIncome ?? Number.NEGATIVE_INFINITY,
          right.netIncome ?? Number.NEGATIVE_INFINITY,
        ],
      };
      const [leftValue, rightValue] = values[deliverySort.key] ?? values.date;
      const compared =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue));
      return compared * multiplier || left.id.localeCompare(right.id);
    });
  }, [deliverySort, filteredDeliveries]);

  const recentDeliveries = useMemo(() => {
    return sortedDeliveries.slice(0, 8);
  }, [sortedDeliveries]);

  const rangeKey = `${range.startDate?.getTime() ?? "all"}-${range.endDate?.getTime() ?? "all"}`;

  const filteredCompanyExpenses = useMemo(() => {
    return filterExpensesByDateRange(
      companyExpenses,
      range.startDate ? toDateKey(range.startDate) : null,
      range.endDate ? toDateKey(range.endDate) : null,
    );
  }, [companyExpenses, range.startDate, range.endDate]);

  const totals = useMemo(() => {
    const financiallyComplete = filteredDeliveries.filter(isDeliveryFinanciallyComplete);
    const fallbackEarnings = financiallyComplete.reduce(
      (sum, item) => sum + (item.deliveryRate ?? 0),
      0,
    );
    const fallbackExpenses = financiallyComplete.reduce(
      (sum, item) => sum + (item.totalExpenses ?? 0),
      0,
    );
    const deliveryRevenue = persistedSummary?.revenue ?? fallbackEarnings;
    const deliveryExpenses = persistedSummary?.expenses ?? fallbackExpenses;

    const companyRevenue = filteredCompanyExpenses
      .filter((e) => e.transactionType === "Incoming")
      .reduce((sum, e) => sum + e.amount, 0);

    const companyExpensesTotal = filteredCompanyExpenses
      .filter((e) => e.transactionType !== "Incoming")
      .reduce((sum, e) => sum + e.amount, 0);

    const totalRevenue = deliveryRevenue + companyRevenue;
    const totalExpenses = deliveryExpenses + companyExpensesTotal;

    const companyNetProfit = totalRevenue - totalExpenses;
    const companyProfitMargin =
      totalRevenue > 0 ? (companyNetProfit / totalRevenue) * 100 : null;
    const totalStops = filteredDeliveries.reduce(
      (sum, item) => sum + item.dropoffs.length,
      0,
    );
    const incompleteDeliveries = filteredDeliveries.filter(isDeliveryIncomplete);
    const incompleteCount = incompleteDeliveries.length;
    const completedCount = filteredDeliveries.length - incompleteCount;
    const finalizedCount = persistedSummary?.deliveries ?? financiallyComplete.length;

    return {
      earnings: totalRevenue,
      totalRevenue,
      deliveryRevenue,
      companyRevenue,
      deliveryExpenses,
      companyExpenses: companyExpensesTotal,
      companyNetProfit,
      companyProfitMargin,
      totalStops,
      incompleteCount,
      completedCount,
      finalizedCount,
      totalTrips: filteredDeliveries.length,
    };
  }, [filteredDeliveries, persistedSummary, filteredCompanyExpenses]);

  const financialSeries = useMemo(
    () => buildFinancialTimeSeries(filteredDeliveries, filteredCompanyExpenses, range),
    [filteredDeliveries, filteredCompanyExpenses, range],
  );

  const truckRankings = useMemo(
    () =>
      [...(persistedSummary?.trucks ?? [])]
        .sort((left, right) => {
          const leftValue = truckRankingValue(left, truckRankingMetric);
          const rightValue = truckRankingValue(right, truckRankingMetric);
          if (leftValue !== rightValue) return rightValue > leftValue ? 1 : -1;
          if (right.net_income !== left.net_income) {
            return right.net_income - left.net_income;
          }
          return left.plate_number.localeCompare(right.plate_number);
        })
        .slice(0, 3),
    [persistedSummary?.trucks, truckRankingMetric],
  );

  const canWrite = canMutateDeliveryRecords(actor);
  const actorName = actor.fullName
    ? actor.fullName.split(" ")[0]
    : (actor.username ?? "there");

  return (
    <>
      <OperationalTopbar
        contextLabel="Delivery Operations & Trucks"
        showDateFilter={false}
      />

      <div key={rangeKey} className="content-wrap dashboard-range-refresh">
        <DashboardHeader
          greeting={greeting}
          actorName={actorName}
          roleLabel={actor.roleLabel}
          canWrite={canWrite}
          currentDashboardUrl={buildCurrentDashboardUrl()}
          error={error}
          loading={loading}
          accessLevel={actor.accessLevel}
          accessNoticeDismissed={accessNoticeDismissed}
          onDismissAccessNotice={() => setAccessNoticeDismissed(true)}
        />

        <section
          className={`dashboard-overview-grid${loading ? " is-page-loading" : ""}`}
          aria-label="Performance and profitability overview"
        >
          <DashboardFinancialChart
            series={financialSeries}
            periodLabel={formatDateRange(range)}
          />

          <DashboardSummaryCards
            totals={totals}
            topClientData={topClientData}
          />
        </section>

        <div className={`dashboard-columns${loading ? " is-page-loading" : ""}`}>
          <DashboardRecentDeliveries
            deliveries={recentDeliveries}
            deliverySort={deliverySort}
            onSort={(key, direction) => setDeliverySort({ key, direction })}
            onSelectDelivery={(tripId) => navigateToDashboardDelivery(tripId, false)}
          />

          <div
            className="dashboard-actions"
            style={{ display: "grid", gap: "16px", alignContent: "start" }}
          >
            <DashboardTopTrucks
              truckRankings={truckRankings}
              truckRankingMetric={truckRankingMetric}
              onMetricChange={(metric) => setTruckRankingMetric(metric)}
              currentDashboardUrl={buildCurrentDashboardUrl()}
            />

            <DashboardAttentionNeeded
              items={deliveriesWithMissingDetails}
              expandedIds={expandedAttentionIds}
              onToggleItem={toggleAttentionItem}
              onToggleAll={() => {
                if (
                  expandedAttentionIds.size ===
                  deliveriesWithMissingDetails.length
                ) {
                  setExpandedAttentionIds(new Set());
                } else {
                  setExpandedAttentionIds(
                    new Set(
                      deliveriesWithMissingDetails.map((d) => d.delivery.id),
                    ),
                  );
                }
              }}
              onSelectDelivery={(deliveryId) =>
                navigateToDashboardDelivery(deliveryId, true)
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
