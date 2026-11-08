import * as z from "zod";

export const DELIVERY_PAGE_SIZES = [10, 25, 50, 100] as const;

export const DELIVERY_SORT_FIELDS = [
  "delivery_date",
  "waybill",
  "client",
  "truck",
  "temperature",
  "origin",
  "dropoffs",
  "distance",
  "delivery_rate",
  "total_expenses",
  "net_income",
  "profit_margin",
  "pod_status",
] as const;

export type DeliverySortField = (typeof DELIVERY_SORT_FIELDS)[number];
export type DeliverySortDirection = "asc" | "desc";

export type DeliveryListQuery = {
  search: string;
  clientId: string | null;
  clientIds?: string[];
  truckId: string | null;
  truckIds?: string[];
  status: string | null;
  podStatus: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  sort: DeliverySortField;
  direction: DeliverySortDirection;
  page: number;
  pageSize: (typeof DELIVERY_PAGE_SIZES)[number];
};

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const pageSizeSchema = z
  .number()
  .int()
  .refine(
    (value): value is (typeof DELIVERY_PAGE_SIZES)[number] =>
      DELIVERY_PAGE_SIZES.includes(value as (typeof DELIVERY_PAGE_SIZES)[number]),
  );

const querySchema = z.object({
  search: z.string().trim().max(120).default(""),
  clientId: z.string().trim().min(1).nullable().default(null),
  clientIds: z.array(z.string().trim().min(1)).default([]),
  truckId: z.string().trim().min(1).nullable().default(null),
  truckIds: z.array(z.string().trim().min(1)).default([]),
  status: z.string().trim().min(1).max(40).nullable().default(null),
  podStatus: z.string().trim().min(1).max(40).nullable().default(null),
  dateFrom: dateSchema.nullable().default(null),
  dateTo: dateSchema.nullable().default(null),
  sort: z.enum(DELIVERY_SORT_FIELDS).default("delivery_date"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  pageSize: pageSizeSchema.default(10),
});

function nullableParameter(params: URLSearchParams, key: string): string | null {
  const value = params.get(key)?.trim();
  return value ? value : null;
}

function parseIdList(params: URLSearchParams, ...keys: string[]): string[] {
  const result: string[] = [];
  for (const key of keys) {
    for (const val of params.getAll(key)) {
      for (const item of val.split(",")) {
        const trimmed = item.trim();
        if (trimmed && !result.includes(trimmed)) {
          result.push(trimmed);
        }
      }
    }
  }
  return result;
}

export function parseDeliveryListQuery(params: URLSearchParams):
  | { ok: true; value: DeliveryListQuery }
  | { ok: false; message: string } {
  const clientIds = parseIdList(params, "clientId", "clientIds");
  const truckIds = parseIdList(params, "truckId", "truckIds");

  const parsed = querySchema.safeParse({
    search: params.get("q") ?? "",
    clientId: clientIds[0] ?? null,
    clientIds,
    truckId: truckIds[0] ?? null,
    truckIds,
    status: nullableParameter(params, "status"),
    podStatus: nullableParameter(params, "podStatus"),
    dateFrom: nullableParameter(params, "dateFrom"),
    dateTo: nullableParameter(params, "dateTo"),
    sort: params.get("sort") ?? "delivery_date",
    direction: params.get("direction") ?? "desc",
    page: Number(params.get("page") ?? 1),
    pageSize: Number(params.get("pageSize") ?? 10),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid delivery list query.",
    };
  }

  if (
    parsed.data.dateFrom &&
    parsed.data.dateTo &&
    parsed.data.dateFrom > parsed.data.dateTo
  ) {
    return {
      ok: false,
      message: "The delivery start date cannot be after the end date.",
    };
  }

  return { ok: true, value: parsed.data };
}

export function getDeliveryPageRange(query: Pick<DeliveryListQuery, "page" | "pageSize">) {
  const from = (query.page - 1) * query.pageSize;
  return { from, to: from + query.pageSize - 1 };
}
