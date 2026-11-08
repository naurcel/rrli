import { NextResponse } from "next/server";
import * as z from "zod";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";

import { parseDeliveryListQuery } from "@/features/deliveries/delivery-query";
import { buildDeliveryTripRecord, type TruckTemperature } from "@/features/deliveries/delivery-domain";
import { validateDeliveryDateWindow } from "@/features/deliveries/delivery-recording-policy";
import {
  getMockClients,
  registerMockClient,
  SMALL_MOCK_DATABASE,
} from "@/features/deliveries/small-mock-database";
import {
  correctSmallMockDelivery,
  deleteSmallMockDelivery,
  dynamicMockDeliveries,
  finalizeSmallMockDelivery,
  listSmallMockDeliveryRecords,
  savePersistedMockDeliveries,
} from "@/features/deliveries/small-mock-repository";
import { listDeliveryRecords } from "@/features/deliveries/server/delivery-repository";
import { getFleetTrucks, registerFleetTruck } from "@/features/deliveries/truck-registry";
import { registerFleetDriver } from "@/features/deliveries/driver-registry";
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
  truckTemperature: z.string().trim().regex(/^-?\d+(?:\.\d+)?°C$/, "Enter a numeric delivery temperature in °C."),
  origin: z.string().trim().min(2, "Origin is required."),
  distanceKm: moneySchema,
  fuelRate: moneySchema,
  deliveryRate: z.number().finite().positive("Delivery revenue must be greater than zero."),
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
  driverName: z.string().trim().min(2, "Driver name is required."),
  recordingDelayed: z.boolean().default(false),
  helperAllowance: optionalMoneySchema,
  helperAllowanceStatus: expenseStatusSchema,
  helperDailyRate: optionalMoneySchema,
  helperDailyRateStatus: expenseStatusSchema,
  helperName: z.string().trim().min(2, "Helper name is required."),
  hasSecondHelper: z.boolean().default(false),
  helper2Allowance: optionalMoneySchema.optional().nullable(),
  helper2AllowanceStatus: expenseStatusSchema.optional().default("not_applicable"),
  helper2DailyRate: optionalMoneySchema.optional().nullable(),
  helper2DailyRateStatus: expenseStatusSchema.optional().default("not_applicable"),
  helper2Name: z.string().trim().optional().nullable(),
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
  supportingDocuments: z.array(z.string().trim()).optional().default([]),
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
  if (data.hasSecondHelper) {
    const helper2Pairs = [
      ["helper2Allowance", data.helper2Allowance, data.helper2AllowanceStatus],
      ["helper2DailyRate", data.helper2DailyRate, data.helper2DailyRateStatus],
    ] as const;
    for (const [field, amount, status] of helper2Pairs) {
      if (status === "confirmed" && amount == null) {
        context.addIssue({ code: "custom", path: [field], message: "Enter a confirmed amount for Helper 2, including zero when confirmed." });
      }
      if (status === "not_applicable" && amount != null) {
        context.addIssue({ code: "custom", path: [field], message: "Not applicable expenses must not contain an amount." });
      }
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

const finalizeFinancialsSchema = z.object({
  action: z.literal("finalize_financials"),
  deliveryId: z.string().trim().min(1),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().default(() => crypto.randomUUID()),
  fallbackRecord: z.record(z.string(), z.unknown()).optional(),
});

const correctFinancialsSchema = z.object({
  action: z.literal("correct_financials"),
  deliveryId: z.string().trim().min(1),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().default(() => crypto.randomUUID()),
  reason: z.string().trim().min(5),
  changes: z.record(z.string(), z.unknown()),
  fallbackRecord: z.record(z.string(), z.unknown()).optional(),
});

const deliveryMutationSchema = z.discriminatedUnion("action", [
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

  const deliveryDatePolicy = validateDeliveryDateWindow(
    parsed.data.deliveryDate,
    undefined,
    auth.actor.role,
  );
  if (!deliveryDatePolicy.ok) {
    return NextResponse.json(
      { ok: false, code: "DELIVERY_DATE_OUTSIDE_WINDOW", message: deliveryDatePolicy.message },
      { status: 400 },
    );
  }
  if (deliveryDatePolicy.isLate && typeof rawBody?.recordingDelayed !== "boolean") {
    return NextResponse.json(
      {
        ok: false,
        code: "DELAY_CONFIRMATION_REQUIRED",
        message: "Confirm whether this delivery was recorded late.",
      },
      { status: 400 },
    );
  }

  let combinedHelperAllowance = parsed.data.helperAllowance;
  let combinedHelperAllowanceStatus = parsed.data.helperAllowanceStatus;
  let combinedHelperDailyRate = parsed.data.helperDailyRate;
  let combinedHelperDailyRateStatus = parsed.data.helperDailyRateStatus;

  if (parsed.data.hasSecondHelper) {
    if (parsed.data.helperAllowanceStatus === "unknown" || parsed.data.helper2AllowanceStatus === "unknown") {
      combinedHelperAllowance = null;
      combinedHelperAllowanceStatus = "unknown";
    } else if (parsed.data.helperAllowanceStatus === "confirmed" || parsed.data.helper2AllowanceStatus === "confirmed") {
      const h1 = parsed.data.helperAllowanceStatus === "confirmed" ? (parsed.data.helperAllowance ?? 0) : 0;
      const h2 = parsed.data.helper2AllowanceStatus === "confirmed" ? (parsed.data.helper2Allowance ?? 0) : 0;
      combinedHelperAllowance = h1 + h2;
      combinedHelperAllowanceStatus = "confirmed";
    } else {
      combinedHelperAllowance = null;
      combinedHelperAllowanceStatus = "not_applicable";
    }

    if (parsed.data.helperDailyRateStatus === "unknown" || parsed.data.helper2DailyRateStatus === "unknown") {
      combinedHelperDailyRate = null;
      combinedHelperDailyRateStatus = "unknown";
    } else if (parsed.data.helperDailyRateStatus === "confirmed" || parsed.data.helper2DailyRateStatus === "confirmed") {
      const r1 = parsed.data.helperDailyRateStatus === "confirmed" ? (parsed.data.helperDailyRate ?? 0) : 0;
      const r2 = parsed.data.helper2DailyRateStatus === "confirmed" ? (parsed.data.helper2DailyRate ?? 0) : 0;
      combinedHelperDailyRate = r1 + r2;
      combinedHelperDailyRateStatus = "confirmed";
    } else {
      combinedHelperDailyRate = null;
      combinedHelperDailyRateStatus = "not_applicable";
    }
  }

  const helperNames = [parsed.data.helperName, parsed.data.helper2Name]
    .filter((n): n is string => Boolean(n && n.trim()))
    .join(", ") || null;

  if (!isSupabaseConfigured()) {
    const rawClientName = parsed.data.clientName.trim();
    const client =
      getMockClients().find((item) => item.name.toLowerCase() === rawClientName.toLowerCase()) ??
      registerMockClient(rawClientName);
    const rawPlate = parsed.data.plateNumber.trim().toUpperCase();
    const rawPlateClean = rawPlate.replace(/\s+/g, "");
    let truck =
      getFleetTrucks().find(
        (item) =>
          item.plateNumber.toUpperCase() === rawPlate ||
          item.plateNumber.replace(/\s+/g, "").toUpperCase() === rawPlateClean,
      ) ??
      SMALL_MOCK_DATABASE.trucks.find(
        (item) =>
          item.plateNumber.toUpperCase() === rawPlate ||
          item.plateNumber.replace(/\s+/g, "").toUpperCase() === rawPlateClean,
      );

    if (!truck) {
      const registered = registerFleetTruck({
        id: `truck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        plateNumber: rawPlate,
        truckType: "6-Wheeler",
        ownershipType: "Owned",
        rateBasis: "Redeemed Rate",
        provider: null,
        contactPerson: null,
      });
      if (registered.ok) {
        truck = registered.truck;
      }
    }

    if (!truck) {
      return NextResponse.json(
        { ok: false, code: "INVALID_TRUCK", message: "Select an available Fleet truck." },
        { status: 400 },
      );
    }
    if (
      SMALL_MOCK_DATABASE.deliveries.some((item) => item.record.waybillNumber === parsed.data.waybillNumber) ||
      dynamicMockDeliveries.some((item) => item.record.waybillNumber === parsed.data.waybillNumber)
    ) {
      return NextResponse.json(
        { ok: false, code: "DUPLICATE_WAYBILL", message: `Waybill ${parsed.data.waybillNumber} already exists.` },
        { status: 409 },
      );
    }

    const record = buildDeliveryTripRecord({
      id: parsed.data.idempotencyKey,
      waybillNumber: parsed.data.waybillNumber,
      deliveryDate: parsed.data.deliveryDate,
      recordingDelayed: parsed.data.recordingDelayed,
      clientName: client.name,
      plateNumber: truck.plateNumber,
      truckType: truck.truckType,
      truckTemperature: parsed.data.truckTemperature as TruckTemperature,
      truckOwnership: truck.ownershipType,
      rateBasis: truck.rateBasis,
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
        helperAllowance: combinedHelperAllowance,
        helperDailyRate: combinedHelperDailyRate,
        otherExpenses: parsed.data.otherExpenses,
      },
      expenseStates: {
        dieselExpenses: parsed.data.dieselExpensesStatus,
        tollGateExpenses: parsed.data.tollGateExpensesStatus,
        driverAllowance: parsed.data.driverAllowanceStatus,
        driverDailyRate: parsed.data.driverDailyRateStatus,
        helperAllowance: combinedHelperAllowanceStatus,
        helperDailyRate: combinedHelperDailyRateStatus,
        otherExpenses: parsed.data.otherExpensesStatus,
      },
      dropoffs: parsed.data.dropoffs.map((dropoff, index) => ({
        ...dropoff,
        id: `${parsed.data.idempotencyKey}-stop-${index + 1}`,
        sequence: index + 1,
      })),
      supportingDocuments: parsed.data.supportingDocuments,
    });
    recordAuditEntry({ actorId: auth.actor.id, actorEmail: auth.actor.email, action: "delivery.created", entityType: "delivery", entityId: record.id, summary: `Recorded completed delivery ${record.waybillNumber}.`, changes: { clientName: record.clientName, plateNumber: record.plateNumber, deliveryRate: record.deliveryRate } });
    if (parsed.data.driverName) {
      registerFleetDriver({ fullName: parsed.data.driverName, assignmentType: "Driver" });
    }
    if (parsed.data.helperName) {
      registerFleetDriver({ fullName: parsed.data.helperName, assignmentType: "Helper" });
    }
    if (parsed.data.helper2Name) {
      registerFleetDriver({ fullName: parsed.data.helper2Name, assignmentType: "Helper" });
    }
    dynamicMockDeliveries.push({
      record,
      clientId: client.id,
      truckId: truck.id,
      driverId: "",
      helperId: "",
      driverName: parsed.data.driverName,
      helperName: helperNames,
      scenario: "User-recorded completed delivery.",
    });
    savePersistedMockDeliveries();
    return NextResponse.json({
      ok: true,
      source: "browser-local",
      deliveryId: record.id,
      previewRecord: {
        ...record,
        clientId: client.id,
        truckId: truck.id,
        deliveryStatus: "Completed",
        driverName: parsed.data.driverName,
        helperName: helperNames,
      },
      recordedBy: { id: auth.actor.id, email: auth.actor.email, role: auth.actor.role },
    }, { status: 201 });
  }

  const supabase = await createServerSupabaseClient();
  const rawClientName = parsed.data.clientName.trim();

  // Ensure new client exists in public.clients so RPC does not throw INVALID_CLIENT
  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", rawClientName)
    .eq("is_active", true)
    .maybeSingle();

  if (!existingClient) {
    const clientCode =
      rawClientName
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase()
        .slice(0, 6) || "CLI";

    const { error: clientInsertError } = await supabase.from("clients").insert({
      name: rawClientName,
      code: clientCode,
      is_active: true,
    });
    if (clientInsertError && clientInsertError.code !== "23505") {
      return NextResponse.json(
        { ok: false, code: "CLIENT_CREATE_FAILED", message: clientInsertError.message },
        { status: 400 },
      );
    }
  }

  // Ensure truck exists in public.trucks so RPC does not throw INVALID_TRUCK
  const rawPlate = parsed.data.plateNumber.trim().toUpperCase();
  const { data: existingTruck } = await supabase
    .from("trucks")
    .select("id")
    .ilike("plate_number", rawPlate)
    .eq("is_active", true)
    .maybeSingle();

  if (!existingTruck) {
    const { error: truckInsertError } = await supabase.from("trucks").insert({
      plate_number: rawPlate,
      truck_type: "6-Wheeler",
      ownership_type: "Owned",
      rate_basis: "Redeemed Rate",
      is_active: true,
    });
    if (truckInsertError && truckInsertError.code !== "23505") {
      return NextResponse.json(
        { ok: false, code: "TRUCK_CREATE_FAILED", message: truckInsertError.message },
        { status: 400 },
      );
    }
  }

  const normalizedDriverName = parsed.data.driverName.trim();
  const { data: existingDriver, error: driverLookupError } = await supabase
    .from("employees")
    .select("id")
    .ilike("full_name", normalizedDriverName)
    .eq("assignment_type", "Driver")
    .eq("is_active", true)
    .maybeSingle();
  if (driverLookupError) {
    return NextResponse.json(
      { ok: false, code: "DRIVER_LOOKUP_FAILED", message: driverLookupError.message },
      { status: 400 },
    );
  }
  let driverId = existingDriver?.id ?? null;
  if (!driverId) {
    const { data: createdDriver, error: driverInsertError } = await supabase
      .from("employees")
      .insert({
        employee_code: `DRV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        full_name: normalizedDriverName,
        assignment_type: "Driver",
        is_active: true,
      })
      .select("id")
      .single();
    if (driverInsertError?.code === "23505") {
      const { data: concurrentDriver, error: concurrentLookupError } = await supabase
        .from("employees")
        .select("id")
        .ilike("full_name", normalizedDriverName)
        .eq("assignment_type", "Driver")
        .eq("is_active", true)
        .single();
      if (concurrentLookupError || !concurrentDriver) {
        return NextResponse.json(
          { ok: false, code: "DRIVER_LOOKUP_FAILED", message: concurrentLookupError?.message ?? "Unable to reuse driver." },
          { status: 400 },
        );
      }
      driverId = concurrentDriver.id;
    } else if (driverInsertError || !createdDriver) {
      return NextResponse.json(
        { ok: false, code: "DRIVER_CREATE_FAILED", message: driverInsertError?.message ?? "Unable to save driver." },
        { status: 400 },
      );
    } else {
      driverId = createdDriver.id;
    }
  }

  const { data: deliveryId, error } = await supabase.rpc("create_delivery_record", {
    p_record: {
      ...parsed.data,
      helperAllowance: combinedHelperAllowance,
      helperAllowanceStatus: combinedHelperAllowanceStatus,
      helperDailyRate: combinedHelperDailyRate,
      helperDailyRateStatus: combinedHelperDailyRateStatus,
      driverId,
    },
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

  recordAuditEntry({ actorId: auth.actor.id, actorEmail: auth.actor.email, action: "delivery.created", entityType: "delivery", entityId: String(deliveryId), summary: `Recorded completed delivery ${parsed.data.waybillNumber}.`, changes: { clientName: parsed.data.clientName, plateNumber: parsed.data.plateNumber, deliveryRate: parsed.data.deliveryRate } });

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
  const rawBody = await request.json().catch(() => null);
  const parsed = deliveryMutationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid delivery update payload.",
      },
      { status: 400 },
    );
  }

  const auth = await verifyServerPermission("deliveries:complete");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const mutation = parsed.data;

  if (!isSupabaseConfigured()) {
    const mockResult = mutation.action === "finalize_financials"
      ? finalizeSmallMockDelivery({
          deliveryId: mutation.deliveryId,
          expectedVersion: mutation.expectedVersion,
          fallbackRecord: mutation.fallbackRecord as any,
        })
      : correctSmallMockDelivery({
          deliveryId: mutation.deliveryId,
          expectedVersion: mutation.expectedVersion,
          changes: mutation.changes,
          reason: mutation.reason,
          fallbackRecord: mutation.fallbackRecord as any,
        });

    if (!mockResult.ok) {
      const isNotFound = mockResult.error.includes("NOT_FOUND");
      const isConflict = mockResult.error.includes("VERSION_CONFLICT");
      const isIncomplete = mockResult.error.includes("FINANCIALS_INCOMPLETE");
      return NextResponse.json(
        {
          ok: false,
          code: isNotFound
            ? "NOT_FOUND"
            : isConflict
              ? "VERSION_CONFLICT"
              : isIncomplete
                ? "FINANCIALS_INCOMPLETE"
                : "DELIVERY_UPDATE_FAILED",
          message: mockResult.error,
          preserveInput: true,
        },
        { status: isNotFound ? 404 : isConflict ? 409 : 400 },
      );
    }

    if (mutation.action === "finalize_financials") {
      recordAuditEntry({
        actorId: auth.actor.id,
        actorEmail: auth.actor.email,
        action: "delivery.financials_finalized",
        entityType: "delivery",
        entityId: mutation.deliveryId,
        summary: `Finalized trip financials for delivery ${mutation.deliveryId}.`,
        changes: { version: mutation.expectedVersion + 1 },
      });
    } else {
      recordAuditEntry({
        actorId: auth.actor.id,
        actorEmail: auth.actor.email,
        action: "delivery.financials_corrected",
        entityType: "delivery",
        entityId: mutation.deliveryId,
        summary: `Audited financial correction: ${mutation.reason}`,
        changes: mutation.changes,
      });
    }

    return NextResponse.json({
      ok: true,
      deliveryId: mutation.deliveryId,
      result: mockResult,
      changedBy: { id: auth.actor.id, email: auth.actor.email, role: auth.actor.role },
    });
  }

  const supabase = await createServerSupabaseClient();
  const correctionChanges = mutation.action === "correct_financials"
    ? {
        deliveryRate: mutation.changes.deliveryRate,
        ...((mutation.changes.expenses && typeof mutation.changes.expenses === "object")
          ? mutation.changes.expenses
          : {}),
        ...Object.fromEntries(
          Object.entries(
            mutation.changes.expenseStates && typeof mutation.changes.expenseStates === "object"
              ? mutation.changes.expenseStates
              : {},
          ).map(([key, value]) => [`${key}Status`, value]),
        ),
      }
    : null;
  const response = mutation.action === "finalize_financials"
    ? await supabase.rpc("finalize_delivery_financials", {
        p_delivery_id: mutation.deliveryId,
        p_expected_version: mutation.expectedVersion,
        p_idempotency_key: mutation.idempotencyKey,
      })
    : await supabase.rpc("correct_delivery_financials", {
        p_delivery_id: mutation.deliveryId,
        p_expected_version: mutation.expectedVersion,
        p_changes: correctionChanges,
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

  if (mutation.action === "correct_financials" && typeof mutation.changes.driverName === "string") {
    const driverName = mutation.changes.driverName.trim();
    if (driverName) {
      let { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("assignment_type", "Driver")
        .ilike("full_name", driverName)
        .maybeSingle();
      if (!emp) {
        const { data: newEmp } = await supabase
          .from("employees")
          .insert({
            full_name: driverName,
            assignment_type: "Driver",
            is_active: true,
          })
          .select("id")
          .single();
        emp = newEmp;
      }
      if (emp) {
        await supabase.from("deliveries").update({ driver_id: emp.id }).eq("id", mutation.deliveryId);
      }
    }
  }

  if (mutation.action === "correct_financials" && typeof mutation.changes.helperName === "string") {
    const helperName = mutation.changes.helperName.trim();
    if (helperName) {
      let { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("assignment_type", "Helper")
        .ilike("full_name", helperName)
        .maybeSingle();
      if (!emp) {
        const { data: newEmp } = await supabase
          .from("employees")
          .insert({
            full_name: helperName,
            assignment_type: "Helper",
            is_active: true,
          })
          .select("id")
          .single();
        emp = newEmp;
      }
      if (emp) {
        await supabase.from("deliveries").update({ helper_id: emp.id }).eq("id", mutation.deliveryId);
      }
    }
  }

  if (mutation.action === "correct_financials" && Array.isArray(mutation.changes.dropoffs)) {
    try {
      await supabase.from("delivery_dropoffs").delete().eq("delivery_id", mutation.deliveryId);
      if (mutation.changes.dropoffs.length > 0) {
        await supabase.from("delivery_dropoffs").insert(
          (mutation.changes.dropoffs as any[]).map((d: any, idx: number) => ({
            delivery_id: mutation.deliveryId,
            sequence_number: idx + 1,
            store_name: d.storeName ?? "",
            destination_area: d.destinationArea ?? "",
            entry_fee: d.entryFee ?? null,
            entry_fee_status: d.entryFeeStatus ?? "confirmed",
            pod_submitted: Boolean(d.podSubmitted),
            supporting_docs_complete: Boolean(d.supportingDocsComplete),
            document_ref: d.documentRef ?? "",
          }))
        );
      }
    } catch {
      // dropoff table sync fallback
    }
  }

  if (mutation.action === "finalize_financials") {
    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "delivery.financials_finalized",
      entityType: "delivery",
      entityId: mutation.deliveryId,
      summary: `Finalized trip financials for delivery ${mutation.deliveryId}.`,
      changes: { version: mutation.expectedVersion + 1 },
    });
  } else {
    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "delivery.financials_corrected",
      entityType: "delivery",
      entityId: mutation.deliveryId,
      summary: `Audited financial correction: ${mutation.reason}`,
      changes: mutation.changes,
    });
  }

  return NextResponse.json({
    ok: true,
    deliveryId: mutation.deliveryId,
    result: data,
    changedBy: { id: auth.actor.id, email: auth.actor.email, role: auth.actor.role },
  });
}

export async function DELETE(request: Request) {
  const auth = await verifyServerPermission("deliveries:edit");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  // Deletion decisions strictly restricted to Admin
  if (auth.actor.role !== "admin") {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        message: "Only System Administrators are authorized to make delivery deletion decisions.",
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const deliveryId = searchParams.get("id");
  const isBrowserLocal = searchParams.get("browserLocal") === "true";
  if (!deliveryId) {
    return NextResponse.json({ ok: false, message: "Delivery ID is required." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    const res = deleteSmallMockDelivery(deliveryId);
    if (!res.ok && !isBrowserLocal) {
      return NextResponse.json({ ok: false, message: res.error }, { status: 404 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "delivery.deleted",
      entityType: "delivery",
      entityId: deliveryId,
      summary: `Deleted delivery record ID ${deliveryId}.`,
      changes: { storage: !res.ok ? "browser-local" : "bundled-mock" },
    });

    return NextResponse.json({ ok: true, message: "Delivery record deleted successfully.", deliveryId, source: !res.ok ? "browser-local" : "bundled-mock" });
  }

  const supabase = await createServerSupabaseClient();
  const { data: deletedDelivery, error } = await supabase
    .from("deliveries")
    .delete()
    .eq("id", deliveryId)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }
  if (!deletedDelivery && !isBrowserLocal) {
    return NextResponse.json({ ok: false, code: "DELIVERY_NOT_FOUND", message: "Delivery record was not found." }, { status: 404 });
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "delivery.deleted",
    entityType: "delivery",
    entityId: deliveryId,
    summary: `Deleted delivery record ID ${deliveryId}.`,
  });

  return NextResponse.json({ ok: true, message: "Delivery record deleted successfully.", deliveryId });
}
