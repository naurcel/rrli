"use client";

import { useEffect, useState } from "react";

import type { DateRange } from "@/components/global-date-range-picker";
import {
  BROWSER_PREVIEW_DELIVERIES_CHANGED,
  mergeBrowserPreviewSummary,
} from "@/features/deliveries/browser-preview-deliveries";

export type PersistedTruckSummary = {
  truck_id: string;
  plate_number: string;
  deliveries: number;
  revenue: number;
  expenses: number;
  net_income: number;
  profit_margin: number | null;
};

export type PersistedProfitabilitySummary = {
  deliveries: number;
  revenue: number;
  expenses: number;
  netIncome: number;
  profitMargin: number | null;
  trucks: PersistedTruckSummary[];
};

function dateKey(value: Date | null): string | null {
  if (!value) return null;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function useDeliveryProfitabilitySummary(range: DateRange) {
  const [summary, setSummary] = useState<PersistedProfitabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const start = dateKey(range.startDate);
  const end = dateKey(range.endDate);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (start) params.set("dateFrom", start);
    if (end) params.set("dateTo", end);
    setLoading(true);
    setError(null);
    const load = () => fetch(`/api/deliveries/summary?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as {
          ok?: boolean;
          message?: string;
          source?: string;
          summary?: PersistedProfitabilitySummary;
          includedDeliveryIds?: string[];
        };
        if (!response.ok || !payload.ok || !payload.summary) throw new Error(payload.message ?? "Unable to load profitability summary.");
        setSummary(payload.source === "bundled-mock"
          ? mergeBrowserPreviewSummary(payload.summary, start, end, payload.includedDeliveryIds)
          : payload.summary);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setSummary(null);
        setError(reason instanceof Error ? reason.message : "Unable to load profitability summary.");
      })
      .finally(() => setLoading(false));
    void load();
    const reload = () => { if (!controller.signal.aborted) void load(); };
    window.addEventListener(BROWSER_PREVIEW_DELIVERIES_CHANGED, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(BROWSER_PREVIEW_DELIVERIES_CHANGED, reload);
      window.removeEventListener("storage", reload);
      controller.abort();
    };
  }, [end, start]);

  return { summary, loading, error } as const;
}
