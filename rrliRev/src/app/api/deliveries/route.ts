import { NextResponse } from "next/server";
import * as z from "zod";

import { parseDeliveryListQuery } from "@/features/deliveries/delivery-query";
import { buildDeliveryTripRecord } from "@/features/deliveries/delivery-domain";
import { SMALL_MOCK_DATABASE } from "@/features/deliveries/small-mock-database";
import { listSmallMockDeliveryRecords } from "@/features/deliveries/small-mock-repository";
import { listDeliveryRecords } from "@/features/deliveries/server/delivery-repository";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const moneySchema = z.number().finite().min(0);
const optionalMoneySchema = moneySchema.nullable();
const expenseStatusSchema = z.enum(["confirmed", "not_applicable", "unknown"]);

const createDeliverySchema = z.object({
  waybillNumber: z.string().trim().min(3, "Waybill number is required."),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Valid YYYY-MM-DD delivery date is required."),
  clientName: z.string().trim().min(2, "Client name is required."),
  plateNumber: z.string().trim().min(3, "Truck plate number is required."),
  origin: z.string().trim().min(2, "Origin is required."),
  distanceKm: moneySchema,
  fuelRate: moneySchema,
  deliveryRate: z.number().finite().positive("Delivery rate must be greater than zero."),
  idempotencyKey: z.string().uuid(),
  dieselExpenses: optionalMoneySchema,
  dieselExpensesStatus: expenseStatusSchema,
  tollGateExpenses: optionalMoneySchema,
  tollGateExpensesStatus: expenseStatusSchema,
  tollGateBreakdown: z.string().trim().default(""),
  driverAllowance: optionalMoneySchema,
  driverAllowanceStatus: expenseStatusSchema,
  driverDailyRate: optionalMoneySchema,
  driverDailyRateStatus: expenseStatusSchema,
  helperAllowance: optionalMoneySchema,
  helperAllowanceStatus: expenseStatusSchema,
  helperDailyRate: optionalMoneySchema,
  helperDailyRateStatus: expenseStatusSchema,
  otherExpenses: optionalMoneySchema,
  otherExpensesStatus: expenseStatusSchema,
  dropoffs: z
    .array(
      z.object({
        storeName: z.string().trim().min(2, "Store name is required."),
        destinationArea: z.string().trim().min(2, "Destination area is required."),
        entryFee: optionalMoneySchema,
        entryFeeStatus: expenseStatusSchema,
        podSubmitted: z.boolean().default(false),
        supportingDocsComplete: z.boolean().default(false),
        documentRef: z.string().trim().default("Pending upload"),
      }),
    )
    .min(1, "At least one store drop-off is required."),
}).superRefine((data, context) => {
  const pairs = [
    ["dieselExpenses", data.dieselExpenses, data.dieselExpensesStatus],
    ["tollGateExpenses", data.tollGateExpenses, data.tollGateExpensesStatus],
    ["driverAllowance", data.driverAllowance, data.driverAllowanceStatus],
    ["driverDailyRate", data.driverDailyRate, data.driverDailyRateStatus],
    ["helperAllowance", data.helperAllowance, data.helperAllowanceStatus],
    ["helperDailyRate", data.helperDailyRate, data.helperDailyRateStatus],
    ["otherExpenses", data.otherExpenses, data.otherExpensesStatus],
  ] as const;
  for (const [field, amount, status] of pairs) {
    if (status === "confirmed" && amount == null) {
      context.addIssue({ code: "custom", path: [field], message: "Enter a confirmed amount, including zero when confirmed." });
    }
    if (status === "not_applicable" && amount != null) {
      context.addIssue({ code: "custom", path: [field], message: "Not applicable expenses must not contain an amount." });
    }
  }
  data.dropoffs.forEach((dropoff, index) => {
    if (dropoff.entryFeeStatus === "confirmed" && dropoff.entryFee == null) {
      context.addIssue({ code: "custom", path: ["dropoffs", index, "entryFee"], message: "Enter the confirmed store entry fee." });
    }
    if (dropoff.entryFeeStatus === "not_applicable" && dropoff.entryFee != null) {
      context.addIssue({ code: "custom", path: ["dropoffs", index, "entryFee"], message: "Not applicable entry fees must not contain an amount." });
    }
  });
});

const verifyPodStopSchema = z.object({
  action: z.literal("update_pod"),
  deliveryId: z.string().trim().min(1),
  dropoffId: z.string().trim().min(1),
  expectedVersion: z.number().int().positive(),
  podSubmitted: z.boolean(),
  supportingDocsComplete: z.boolean(),
  documentRef: z.string().trim().optional(),
});

const finalizeFinancialsSchema = z.object({
  action: z.literal("finalize_financials"),
  deliveryId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
});

const correctFinancialsSchema = z.object({
  action: z.literal("correct_financials"),
  deliveryId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().uuid(),
  reason: z.string().trim().min(5),
  changes: z.record(z.string(), z.unknown()),
});

const deliveryMutationSchema = z.discriminatedUnion("action", [
  verifyPodStopSchema,
  finalizeFinancialsSchema,
  correctFinancialsSchema,
]);

export async function GET(request: Request) {
  const auth = await verifyServerPermission("deliveries:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const parsedQuery = parseDeliveryListQuery(new URL(request.url).searchParams);
  if (!parsedQuery.ok) {
    return NextResponse.json(
      { ok: false, code: "INVALID_QUERY", message: parsedQuery.message },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      source: "bundled-mock",
      ...listSmallMockDeliveryRecords(parsedQuery.value),
    });
  }

  try {
    const result = await listDeliveryRecords(parsedQuery.value);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DELIVERY_QUERY_FAILED",
        message: error instanceof Error ? error.message : "Unable to load delivery records.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await verifyServerPermission("deliveries:create");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createDeliverySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid delivery record payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    const client = SMALL_MOCK_DATABASE.clients.find((item) => item.name === parsed.data.clientName);
    const truck = SMALL_MOCK_DATABASE.trucks.find((item) => item.plateNumber === parsed.data.plateNumber);
    if (!client || !truck) {
      return NextResponse.json(
        { ok: false, code: !client ? "INVALID_CLIENT" : "INVALID_TRUCK", message: !client ? "Select an available client." : "Select an available Fleet truck." },
        { status: 400 },
      );
    }
    if (SMALL_MOCK_DATABASE.deliveries.some((item) => item.record.waybillNumber === parsed.data.waybillNumber)) {
      return NextResponse.json(
        { ok: false, code: "DUPLICATE_WAYBILL", message: `Waybill ${parsed.data.waybillNumber} already exists.` },
        { status: 409 },
      );
    }

    const record = buildDeliveryTripRecord({
      id: parsed.data.idempotencyKey,
      waybillNumber: parsed.data.waybillNumber,
      deliveryDate: parsed.data.deliveryDate,
      clientName: client.name,
      plateNumber: truck.plateNumber,
      truckType: truck.truckType,
      truckTemperature: truck.truckTemperature,
      origin: parsed.data.origin,
      distanceKm: parsed.data.distanceKm,
      fuelRate: parsed.data.fuelRate,
      deliveryRate: parsed.data.deliveryRate,
      expenses: {
        dieselExpenses: parsed.data.dieselExpenses,
        tollGateExpenses: parsed.data.tollGateExpenses,
        tollGateBreakdown: parsed.data.tollGateBreakdown,
        driverAllowance: parsed.data.driverAllowance,
        driverDailyRate: parsed.data.driverDailyRate,
        helperAllowance: parsed.data.helperAllowance,
        helperDailyRate: parsed.data.helperDailyRate,
        otherExpenses: parsed.data.otherExpenses,
      },
      expenseStates: {
        dieselExpenses: parsed.data.dieselExpensesStatus,
        tollGateExpenses: parsed.data.tollGateExpensesStatus,
        driverAllowance: parsed.data.driverAllowanceStatus,
        driverDailyRate: parsed.data.driverDailyRateStatus,
        helperAllowance: parsed.data.helperAllowanceStatus,
        helperDailyRate: parsed.data.helperDailyRateStatus,
        otherExpenses: parsed.data.otherExpensesStatus,
      },
      dropoffs: parsed.data.dropoffs.map((dropoff, index) => ({
        ...dropoff,
        id: `${parsed.data.idempotencyKey}-stop-${index + 1}`,
        sequence: index + 1,
      })),
    });
    return NextResponse.json({
      ok: true,
      source: "browser-local",
      deliveryId: record.id,
      previewRecord: {
        ...record,
        clientId: client.id,
        truckId: truck.id,
        deliveryStatus: "Completed",
        driverName: null,
        helperName: null,
      },
      recordedBy: { id: auth.actor.id, email: auth.actor.email, role: auth.actor.role },
    }, { status: 201 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: deliveryId, error } = await supabase.rpc("create_delivery_record", {
    p_record: parsed.data,
    p_dropoffs: parsed.data.dropoffs,
  });

  if (error) {
    const duplicate = error.code === "23505" || error.message.includes("waybill_number");
    const invalidClient = error.message.includes("INVALID_CLIENT");
    const invalidTruck = error.message.includes("INVALID_TRUCK");
    const code = duplicate
      ? "DUPLICATE_WAYBILL"
      : invalidClient
        ? "INVALID_CLIENT"
        : invalidTruck
          ? "INVALID_TRUCK"
          : "DELIVERY_CREATE_FAILED";
    const message = duplicate
      ? `Waybill ${parsed.data.waybillNumber} already exists.`
      : invalidClient
        ? "Select an active client record."
        : invalidTruck
          ? "Select an active truck from Fleet."
          : error.message;

    return NextResponse.json(
      { ok: false, code, message },
      { status: duplicate ? 409 : 400 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      deliveryId,
      recordedBy: { id: auth.actor.id, email: auth.actor.email, role: auth.actor.role },
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: "DATABASE_NOT_CONFIGURED",
        message: "POD verification requires a configured Supabase database.",
      },
      { status: 503 },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = deliveryMutationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid POD verification payload.",
      },
      { status: 400 },
    );
  }

  const permission = parsed.data.action === "update_pod" ? "pod:verify" : "deliveries:complete";
  const auth = await verifyServerPermission(permission);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const supabase = await createServerSupabaseClient();
  const mutation = parsed.data;
  const response = mutation.action === "update_pod"
    ? await supabase.rpc("update_dropoff_document_state", {
        p_delivery_id: mutation.deliveryId,
        p_dropoff_id: mutation.dropoffId,
        p_expected_version: mutation.expectedVersion,
        p_pod_submitted: mutation.podSubmitted,
        p_supporting_docs_complete: mutation.supportingDocsComplete,
        p_document_ref: mutation.documentRef ?? "",
      })
    : mutation.action === "finalize_financials"
      ? await supabase.rpc("finalize_delivery_financials", {
          p_delivery_id: mutation.deliveryId,
          p_expected_version: mutation.expectedVersion,
          p_idempotency_key: mutation.idempotencyKey,
        })
      : await supabase.rpc("correct_delivery_financials", {
          p_delivery_id: mutation.deliveryId,
          p_expected_version: mutation.expectedVersion,
          p_changes: mutation.changes,
          p_reason: mutation.reason,
          p_idempotency_key: mutation.idempotencyKey,
        });
  const { data, error } = response;

  if (error) {
    const notFound = error.message.includes("NOT_FOUND");
    const conflict = error.message.includes("VERSION_CONFLICT");
    const incomplete = error.message.includes("FINANCIALS_INCOMPLETE");
    return NextResponse.json(
      {
        ok: false,
        code: notFound
          ? "NOT_FOUND"
          : conflict
            ? "VERSION_CONFLICT"
            : incomplete
              ? "FINANCIALS_INCOMPLETE"
              : "DELIVERY_UPDATE_FAILED",
        message: error.message,
        preserveInput: true,
      },
      { status: notFound ? 404 : conflict ? 409 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    deliveryId: mutation.deliveryId,
    result: data,
    changedBy: { id: auth.actor.id, email: auth.actor.email, role: auth.actor.role },
  });
}
