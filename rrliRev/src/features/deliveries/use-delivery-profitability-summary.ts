"use client";

import { useEffect, useState } from "react";

import {
  beginDateRangeLoad,
  endDateRangeLoad,
  type DateRange,
} from "@/components/global-date-range-picker";
import {
  BROWSER_PREVIEW_DELIVERIES_CHANGED,
  mergeBrowserPreviewSummary,
} from "@/features/deliveries/browser-preview-deliveries";
import {
  readArchiveMachineSnapshot,
  ROUTEX_ARCHIVE_MACHINE_CHANGED,
} from "@/features/archive/archive-machine";

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

const summarySwrCache = new Map<string, PersistedProfitabilitySummary>();

export function useDeliveryProfitabilitySummary(range: DateRange) {
  const start = dateKey(range.startDate);
  const end = dateKey(range.endDate);
  const cacheKey = `${start ?? "all"}:${end ?? "all"}`;

  const [summary, setSummary] = useState<PersistedProfitabilitySummary | null>(
    () => summarySwrCache.get(cacheKey) ?? null,
  );
  const [loading, setLoading] = useState<boolean>(() => !summarySwrCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadId = `useDeliveryProfitabilitySummary:${cacheKey}:${Math.random().toString(36).slice(2)}`;
    const params = new URLSearchParams();
    if (start) params.set("dateFrom", start);
    if (end) params.set("dateTo", end);

    const cached = summarySwrCache.get(cacheKey);
    if (cached) {
      setSummary(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    const load = async () => {
      const archive = readArchiveMachineSnapshot();
      if (archive) {
        const emptySummary: PersistedProfitabilitySummary = {
          deliveries: 0,
          revenue: 0,
          expenses: 0,
          netIncome: 0,
          profitMargin: null,
          trucks: [],
        };
        const archiveSummary = mergeBrowserPreviewSummary(emptySummary, start, end, []);
        summarySwrCache.set(cacheKey, archiveSummary);
        setSummary(archiveSummary);
        setLoading(false);
        return;
      }

      beginDateRangeLoad(loadId);
      return fetch(`/api/deliveries/summary?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as {
          ok?: boolean;
          message?: string;
          source?: string;
          summary?: PersistedProfitabilitySummary;
          includedDeliveryIds?: string[];
        };
        if (!response.ok || !payload.ok || !payload.summary) throw new Error(payload.message ?? "Unable to load profitability summary.");
        const nextSummary = payload.source === "bundled-mock"
          ? mergeBrowserPreviewSummary(payload.summary, start, end, payload.includedDeliveryIds)
          : payload.summary;
        summarySwrCache.set(cacheKey, nextSummary);
        setSummary(nextSummary);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        const emptySummary: PersistedProfitabilitySummary = {
          deliveries: 0,
          revenue: 0,
          expenses: 0,
          netIncome: 0,
          profitMargin: null,
          trucks: [],
        };
        const fallback = mergeBrowserPreviewSummary(emptySummary, start, end, []);
        if (fallback.deliveries > 0) {
          summarySwrCache.set(cacheKey, fallback);
          setSummary(fallback);
          setError(null);
        } else if (!summarySwrCache.has(cacheKey)) {
          setSummary(null);
          setError(reason instanceof Error ? reason.message : "Unable to load profitability summary.");
        }
      })
      .finally(() => {
        endDateRangeLoad(loadId);
        setLoading(false);
      });
    };
    void load();
    const reload = () => {
      summarySwrCache.clear();
      if (!controller.signal.aborted) void load();
    };
    const onStorage = (event: StorageEvent) => {
      if (controller.signal.aborted) return;
      if (
        !event.key ||
        event.key === "routex.global-date-range.v2" ||
        event.key.startsWith("routex:delivery") ||
        event.key.includes("deliveries")
      ) {
        summarySwrCache.clear();
        void load();
      }
    };
    window.addEventListener(BROWSER_PREVIEW_DELIVERIES_CHANGED, reload);
    window.addEventListener(ROUTEX_ARCHIVE_MACHINE_CHANGED, reload);
    window.addEventListener("storage", onStorage);
    return () => {
      endDateRangeLoad(loadId);
      window.removeEventListener(BROWSER_PREVIEW_DELIVERIES_CHANGED, reload);
      window.removeEventListener(ROUTEX_ARCHIVE_MACHINE_CHANGED, reload);
      window.removeEventListener("storage", onStorage);
      controller.abort();
    };
  }, [cacheKey, end, start]);

  return { summary, loading, error } as const;
}
