import type { DashboardDelivery } from "../dashboard/dashboard-preview-data";
import { calculateFinancialPerformance } from "../deliveries/completion/delivery-completion-financials.ts";

export type ReportKind = "revenue" | "expenses" | "profitability" | "operations";

export type ReportRow = {
  label: string;
  deliveries: number;
  primary: number;
  secondary: number | null;
  share: number;
};

export type ReportPreview = {
  kind: ReportKind;
  title: string;
  description: string;
  subjectLabel: string;
  primaryLabel: string;
  secondaryLabel: string;
  secondaryIsRate: boolean;
  rows: ReportRow[];
  totals: { revenue: number; totalExpenses: number; netIncome: number; profitMargin: number | null; deliveries: number };
};

type Group = { deliveries: number; revenue: number; expenses: number; attachedPods: number; missingPods: number };

function groupBy(deliveries: readonly DashboardDelivery[], key: (delivery: DashboardDelivery) => string) {
  const groups = new Map<string, Group>();
  for (const delivery of deliveries) {
    const current = groups.get(key(delivery)) ?? { deliveries: 0, revenue: 0, expenses: 0, attachedPods: 0, missingPods: 0 };
    current.deliveries += 1;
    current.revenue += delivery.revenue;
    current.expenses += delivery.expenses;
    if (delivery.pod === "Attached") current.attachedPods += 1;
    else current.missingPods += 1;
    groups.set(key(delivery), current);
  }
  return groups;
}

function summarize(deliveries: readonly DashboardDelivery[]) {
  return {
    ...calculateFinancialPerformance(deliveries.map((delivery) => ({
      revenue: delivery.revenue,
      totalExpenses: delivery.expenses,
    }))),
    deliveries: deliveries.length,
  };
}

export function getReportPreview(deliveries: readonly DashboardDelivery[], kind: ReportKind): ReportPreview {
  const totals = summarize(deliveries);
  const isOperations = kind === "operations";
  const groups = groupBy(deliveries, (delivery) => kind === "revenue" || isOperations ? delivery.client : delivery.truck);
  const rows = [...groups.entries()].map(([label, group]) => {
    const financials = calculateFinancialPerformance([{ revenue: group.revenue, totalExpenses: group.expenses }]);
    if (kind === "revenue") return { label, deliveries: group.deliveries, primary: group.revenue, secondary: 0, share: totals.revenue === 0 ? 0 : (group.revenue / totals.revenue) * 100 };
    if (kind === "expenses") return { label, deliveries: group.deliveries, primary: group.expenses, secondary: 0, share: totals.totalExpenses === 0 ? 0 : (group.expenses / totals.totalExpenses) * 100 };
    if (kind === "profitability") return { label, deliveries: group.deliveries, primary: financials.netIncome, secondary: financials.profitMargin, share: totals.netIncome === 0 ? 0 : (financials.netIncome / totals.netIncome) * 100 };
    return { label, deliveries: group.deliveries, primary: group.attachedPods, secondary: group.missingPods, share: group.deliveries === 0 ? 0 : (group.attachedPods / group.deliveries) * 100 };
  }).sort((left, right) => right.primary - left.primary || left.label.localeCompare(right.label));

  const content: Record<ReportKind, Omit<ReportPreview, "kind" | "rows" | "totals">> = {
    revenue: { title: "Revenue report", description: "Completed-delivery revenue by client", subjectLabel: "Client", primaryLabel: "Revenue", secondaryLabel: "Share", secondaryIsRate: true },
    expenses: { title: "Expense report", description: "Locally available expenses by truck", subjectLabel: "Truck", primaryLabel: "Expenses", secondaryLabel: "Share", secondaryIsRate: true },
    profitability: { title: "Profitability report", description: "Revenue, expenses, and net income by truck", subjectLabel: "Truck", primaryLabel: "Net income", secondaryLabel: "Profit margin", secondaryIsRate: true },
    operations: { title: "Operations report", description: "Completed deliveries and proof-of-delivery follow-up by client", subjectLabel: "Client", primaryLabel: "POD attached", secondaryLabel: "Follow-up", secondaryIsRate: false },
  };
  return { kind, ...content[kind], rows, totals };
}
