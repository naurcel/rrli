"use client";

import { useEffect, useState } from "react";

import type { DateRange } from "@/components/global-date-range-picker";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  BROWSER_PREVIEW_DELIVERIES_CHANGED,
  selectBrowserPreviewDeliveries,
} from "@/features/deliveries/browser-preview-deliveries";

type DeliveryPagePayload = {
  ok?: boolean;
  message?: string;
  source?: string;
  items?: DeliveryLedgerItem[];
  pageCount?: number;
};

function toDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

async function fetchDeliveryPage(
  page: number,
  range: DateRange,
  signal: AbortSignal,
): Promise<DeliveryPagePayload> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "100",
    sort: "delivery_date",
    direction: "desc",
  });
  if (range.startDate) params.set("dateFrom", toDateKey(range.startDate));
  if (range.endDate) params.set("dateTo", toDateKey(range.endDate));

  const response = await fetch(`/api/deliveries?${params.toString()}`, { signal });
  const payload = (await response.json()) as DeliveryPagePayload;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? "Unable to load completed deliveries.");
  }
  return payload;
}

export function usePersistedDeliveries(range: DateRange, options: { allPages?: boolean } = {}) {
  const [deliveries, setDeliveries] = useState<readonly DeliveryLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startTime = range.startDate?.getTime() ?? null;
  const endTime = range.endDate?.getTime() ?? null;

  useEffect(() => {
    const controller = new AbortController();
    const activeRange: DateRange = {
      startDate: startTime == null ? null : new Date(startTime),
      endDate: endTime == null ? null : new Date(endTime),
    };

    setLoading(true);
    setError(null);
    const load = () => fetchDeliveryPage(1, activeRange, controller.signal)
      .then(async (firstPage) => {
        const pageCount = firstPage.pageCount ?? 1;
        const remaining = options.allPages === false ? [] : await Promise.all(
          Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
            fetchDeliveryPage(index + 2, activeRange, controller.signal),
          ),
        );
        const persisted = [
          ...(firstPage.items ?? []),
          ...remaining.flatMap((page) => page.items ?? []),
        ];
        const local = firstPage.source === "bundled-mock"
          ? selectBrowserPreviewDeliveries({
              dateFrom: activeRange.startDate ? toDateKey(activeRange.startDate) : undefined,
              dateTo: activeRange.endDate ? toDateKey(activeRange.endDate) : undefined,
            })
          : [];
        const localIds = new Set(local.map((item) => item.id));
        setDeliveries([...local, ...persisted.filter((item) => !localIds.has(item.id))]);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setDeliveries([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load completed deliveries.",
        );
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
  }, [endTime, options.allPages, startTime]);

  return { deliveries, loading, error } as const;
}
