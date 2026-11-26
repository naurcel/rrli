import { NextResponse } from "next/server";
import * as z from "zod";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";

import { parseDeliveryListQuery } from "@/features/deliveries/delivery-query";
import { buildDeliveryTripRecord, type TruckTemperature, type ExpenseResolutionStatus } from "@/features/deliveries/delivery-domain";
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
import {
  checkCrewDateAvailability,
  isCrewMemberEligibleForNewDelivery,
  registerFleetDriver,
} from "@/features/deliveries/driver-registry";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseConfigured, getServiceRoleKey } from "@/lib/config/env";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";

async function getMutationSupabaseClient() {
  const serviceRoleKey = getServiceRoleKey();
  if (serviceRoleKey) {
    return createAdminSupabaseClient();
  }
  return await createServerSupabaseClient();
}

const moneySchema = z.number().finite().min(0);
const optionalMoneySchema = moneySchema.nullable();
const expenseStatusSchema = z.enum(["confirmed", "not_applicable", "unknown"]);

const createDeliverySchema = z.object({
  waybillNumber: z.string().trim().optional().default(""),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Valid YYYY-MM-DD delivery date is required.")
    .optional()
    .default(() => new Date().toISOString().split("T")[0]),
  clientName: z.string().trim().optional().default(""),
  plateNumber: z.string().trim().min(1, "Truck plate number is required."),
  truckTemperature: z.string().trim().optional().default(""),
  origin: z.string().trim().optional().default("Pending Origin"),
  distanceKm: moneySchema.optional().default(0),
  fuelRate: moneySchema.optional().default(0),
  deliveryRate: z.number().finite().min(0, "Delivery revenue cannot be negative.").optional().default(0),
  idempotencyKey: z.string().uuid().optional().default(() => crypto.randomUUID()),
  dieselExpenses: optionalMoneySchema.optional().default(null),
  dieselExpensesStatus: expenseStatusSchema.optional().default("confirmed"),
  tollGateExpenses: optionalMoneySchema.optional().default(null),
  tollGateExpensesStatus: expenseStatusSchema.optional().default("confirmed"),
  tollGateBreakdown: z.string().trim().default(""),
  driverAllowance: optionalMoneySchema.optional().default(null),
  driverAllowanceStatus: expenseStatusSchema.optional().default("confirmed"),
  driverDailyRate: optionalMoneySchema.optional().default(null),
  driverDailyRateStatus: expenseStatusSchema.optional().default("confirmed"),
  driverName: z.string().trim().optional().default(""),
  recordingDelayed: z.boolean().default(false),
  helperAllowance: optionalMoneySchema.optional().default(null),
  helperAllowanceStatus: expenseStatusSchema.optional().default("confirmed"),
  helperDailyRate: optionalMoneySchema.optional().default(null),
  helperDailyRateStatus: expenseStatusSchema.optional().default("confirmed"),
  helperName: z.string().trim().optional().default(""),
  hasSecondHelper: z.boolean().default(false),
  helper2Allowance: optionalMoneySchema.optional().nullable().default(null),
  helper2AllowanceStatus: expenseStatusSchema.optional().default("not_applicable"),
  helper2DailyRate: optionalMoneySchema.optional().nullable().default(null),
  helper2DailyRateStatus: expenseStatusSchema.optional().default("not_applicable"),
  helper2Name: z.string().trim().optional().nullable().default(""),
  otherExpenses: optionalMoneySchema.optional().default(null),
  otherExpensesStatus: expenseStatusSchema.optional().default("confirmed"),
  dropoffs: z
    .array(
      z.object({
        storeName: z.string().trim().optional().default("Pending Store"),
        destinationArea: z.string().trim().optional().default("Pending Destination"),
        dropoffCount: z.number().int().min(1).default(1).optional(),
        entryFee: optionalMoneySchema.optional().default(null),
        entryFeeStatus: expenseStatusSchema.optional().default("confirmed"),
        podSubmitted: z.boolean().default(false),
        supportingDocsComplete: z.boolean().default(false),
        documentRef: z.string().trim().default("Pending upload"),
      }),
    )
    .optional()
    .default([]),
  supportingDocuments: z
    .array(
      z.union([
        z.string().trim(),
        z.object({
          id: z.string().optional(),
          name: z.string().trim(),
          dropoffId: z.string().nullable().optional(),
          storeName: z.string().nullable().optional(),
          fileUrl: z.string().nullable().optional(),
          uploadedAt: z.string().optional(),
        }),
      ]),
    )
    .optional()
    .default([]),
  notes: z.string().trim().nullable().optional().default(null),
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
      if (status === "not_applicable" && amount != null) {
        context.addIssue({ code: "custom", path: [field], message: "Not applicable expenses must not contain an amount." });
      }
    }
  }
  data.dropoffs.forEach((dropoff, index) => {
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
    const message = error instanceof Error ? error.message : "Unable to load delivery records.";
    // If Supabase schema cache is missing delivery_ledger or unmigrated, gracefully fallback to bundled mock data
    if (
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("relation") ||
      message.includes("delivery_ledger")
    ) {
      console.warn("Supabase schema missing delivery_ledger; falling back to bundled mock data:", message);
      return NextResponse.json({
        ok: true,
        source: "bundled-mock",
        fallbackNotice: message,
        ...listSmallMockDeliveryRecords(parsedQuery.value),
      });
    }

    return NextResponse.json(
      {
        ok: false,
        code: "DELIVERY_QUERY_FAILED",
        message,
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

  const effectiveWindowRole =
    auth.actor.isSuperadmin || auth.actor.roles.includes("admin")
      ? "admin"
      : auth.actor.role;
  const deliveryDatePolicy = validateDeliveryDateWindow(
    parsed.data.deliveryDate,
    undefined,
    effectiveWindowRole,
    { waybillNumber: parsed.data.waybillNumber },
  );
  if (!deliveryDatePolicy.ok) {
    return NextResponse.json(
      { ok: false, code: "DELIVERY_DATE_OUTSIDE_WINDOW", message: deliveryDatePolicy.message },
      { status: 400 },
    );
  }

  const normDriver = (parsed.data.driverName ?? "").trim().toLowerCase();
  const normHelper1 = (parsed.data.helperName ?? "").trim().toLowerCase();
  const normHelper2 =
    parsed.data.hasSecondHelper && parsed.data.helper2Name
      ? parsed.data.helper2Name.trim().toLowerCase()
      : "";
  if (normDriver && normHelper1 && normDriver === normHelper1) {
    return NextResponse.json(
      {
        ok: false,
        code: "DUPLICATE_CREW_ASSIGNMENT",
        message: "The same employee cannot be assigned as both Driver and Helper on the same trip.",
      },
      { status: 400 },
    );
  }
  if (normDriver && normHelper2 && normDriver === normHelper2) {
    return NextResponse.json(
      {
        ok: false,
        code: "DUPLICATE_CREW_ASSIGNMENT",
        message: "The same employee cannot be assigned as both Driver and Helper 2 on the same trip.",
      },
      { status: 400 },
    );
  }
  if (normHelper1 && normHelper2 && normHelper1 === normHelper2) {
    return NextResponse.json(
      {
        ok: false,
        code: "DUPLICATE_CREW_ASSIGNMENT",
        message: "Helper 1 and Helper 2 must be different employees.",
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

  const runMockCreateDelivery = () => {
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

    const isSubconTruck =
      truck.ownershipType === "Subcontracted" ||
      rawPlate.startsWith("SUB-") ||
      rawPlate.includes("SUBCON");

    let effectiveWaybill = parsed.data.waybillNumber.trim();
    if (!effectiveWaybill) {
      if (isSubconTruck) {
        effectiveWaybill = `WB-SUBCON-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      } else {
        return NextResponse.json(
          { ok: false, code: "WAYBILL_REQUIRED", message: "Waybill number is required for owned trucks." },
          { status: 400 },
        );
      }
    }

    const rawClientName = parsed.data.clientName.trim();
    const client = rawClientName
      ? (getMockClients().find((item) => item.name.toLowerCase() === rawClientName.toLowerCase()) ?? registerMockClient(rawClientName))
      : { id: "pending-client", name: "Pending Client" };

    if (
      SMALL_MOCK_DATABASE.deliveries.some((item) => item.record.waybillNumber === effectiveWaybill) ||
      dynamicMockDeliveries.some((item) => item.record.waybillNumber === effectiveWaybill)
    ) {
      return NextResponse.json(
        { ok: false, code: "DUPLICATE_WAYBILL", message: `Waybill ${effectiveWaybill} already exists.` },
        { status: 409 },
      );
    }

    // Crew Same-Date Conflict Check (An employee cannot be assigned to multiple trips on the same date)
    const allExistingDeliveries = [
      ...SMALL_MOCK_DATABASE.deliveries.map((d) => ({
        id: d.record.id,
        waybillNumber: d.record.waybillNumber,
        deliveryDate: d.record.deliveryDate,
        driverName: (d as unknown as { driverName?: string | null }).driverName ?? SMALL_MOCK_DATABASE.drivers.find((dr) => dr.id === d.driverId)?.fullName ?? null,
        helperName: (d as unknown as { helperName?: string | null }).helperName ?? SMALL_MOCK_DATABASE.helpers.find((hl) => hl.id === d.helperId)?.fullName ?? null,
      })),
      ...dynamicMockDeliveries.map((d) => ({
        id: d.record.id,
        waybillNumber: d.record.waybillNumber,
        deliveryDate: d.record.deliveryDate,
        driverName: (d as unknown as { driverName?: string | null }).driverName ?? null,
        helperName: (d as unknown as { helperName?: string | null }).helperName ?? null,
      })),
    ];

    if (parsed.data.driverName.trim()) {
      const driverEligibility = isCrewMemberEligibleForNewDelivery(parsed.data.driverName);
      if (!driverEligibility.ok) {
        return NextResponse.json({ ok: false, code: "CREW_INACTIVE", message: driverEligibility.message }, { status: 400 });
      }
      const driverConflict = checkCrewDateAvailability({
        employeeName: parsed.data.driverName,
        deliveryDate: parsed.data.deliveryDate,
        currentWaybillOrId: effectiveWaybill,
        deliveries: allExistingDeliveries,
      });
      if (!driverConflict.ok) {
        return NextResponse.json({ ok: false, code: "CREW_DATE_CONFLICT", message: driverConflict.message }, { status: 409 });
      }
    }

    if (parsed.data.helperName.trim()) {
      const helper1Eligibility = isCrewMemberEligibleForNewDelivery(parsed.data.helperName);
      if (!helper1Eligibility.ok) {
        return NextResponse.json({ ok: false, code: "CREW_INACTIVE", message: helper1Eligibility.message }, { status: 400 });
      }
      const helper1Conflict = checkCrewDateAvailability({
        employeeName: parsed.data.helperName,
        deliveryDate: parsed.data.deliveryDate,
        currentWaybillOrId: effectiveWaybill,
        deliveries: allExistingDeliveries,
      });
      if (!helper1Conflict.ok) {
        return NextResponse.json({ ok: false, code: "CREW_DATE_CONFLICT", message: helper1Conflict.message }, { status: 409 });
      }
    }

    if (parsed.data.hasSecondHelper && parsed.data.helper2Name && parsed.data.helper2Name.trim()) {
      const helper2Eligibility = isCrewMemberEligibleForNewDelivery(parsed.data.helper2Name);
      if (!helper2Eligibility.ok) {
        return NextResponse.json({ ok: false, code: "CREW_INACTIVE", message: helper2Eligibility.message }, { status: 400 });
      }
      const helper2Conflict = checkCrewDateAvailability({
        employeeName: parsed.data.helper2Name,
        deliveryDate: parsed.data.deliveryDate,
        currentWaybillOrId: effectiveWaybill,
        deliveries: allExistingDeliveries,
      });
      if (!helper2Conflict.ok) {
        return NextResponse.json({ ok: false, code: "CREW_DATE_CONFLICT", message: helper2Conflict.message }, { status: 409 });
      }
    }

    const dropoffsList = parsed.data.dropoffs ?? [];
    const calculatedEntryFees = dropoffsList.reduce((sum, d) => sum + (d.entryFee ?? 0), 0);
    const hasUnknownEntry = dropoffsList.some((d) => d.entryFeeStatus === "unknown");
    const calculatedEntryFeesStatus: ExpenseResolutionStatus = hasUnknownEntry ? "unknown" : "confirmed";

    const record = buildDeliveryTripRecord({
      id: parsed.data.idempotencyKey,
      waybillNumber: effectiveWaybill,
      deliveryDate: parsed.data.deliveryDate,
      recordingDelayed: parsed.data.recordingDelayed || deliveryDatePolicy.isLate,
      clientName: client.name,
      plateNumber: truck.plateNumber,
      truckType: truck.truckType,
      truckTemperature: (parsed.data.truckTemperature || "Ambient") as TruckTemperature,
      truckOwnership: truck.ownershipType,
      rateBasis: truck.rateBasis,
      origin: parsed.data.origin || "Pending Origin",
      distanceKm: parsed.data.distanceKm ?? 0,
      fuelRate: parsed.data.fuelRate ?? 0,
      deliveryRate: parsed.data.deliveryRate ?? 0,
      expenses: {
        dieselExpenses: parsed.data.dieselExpenses,
        tollGateExpenses: parsed.data.tollGateExpenses,
        tollGateBreakdown: parsed.data.tollGateBreakdown,
        entryFees: calculatedEntryFees,
        driverAllowance: parsed.data.driverAllowance,
        driverDailyRate: parsed.data.driverDailyRate,
        helperAllowance: combinedHelperAllowance,
        helperDailyRate: combinedHelperDailyRate,
        otherExpenses: parsed.data.otherExpenses,
      },
      expenseStates: {
        dieselExpenses: parsed.data.dieselExpensesStatus,
        tollGateExpenses: parsed.data.tollGateExpensesStatus,
        entryFees: calculatedEntryFeesStatus,
        driverAllowance: parsed.data.driverAllowanceStatus,
        driverDailyRate: parsed.data.driverDailyRateStatus,
        helperAllowance: combinedHelperAllowanceStatus,
        helperDailyRate: combinedHelperDailyRateStatus,
        otherExpenses: parsed.data.otherExpensesStatus,
      },
      dropoffs: dropoffsList.map((dropoff, index) => ({
        ...dropoff,
        id: `${parsed.data.idempotencyKey}-stop-${index + 1}`,
        sequence: index + 1,
      })),
      supportingDocuments: parsed.data.supportingDocuments,
      notes: parsed.data.notes?.trim() || null,
    });
    recordAuditEntry({ actorId: auth.actor.id, actorEmail: auth.actor.email, action: "delivery.created", entityType: "delivery", entityId: record.id, summary: `Recorded delivery ${record.waybillNumber}.`, changes: { clientName: record.clientName, plateNumber: record.plateNumber, deliveryRate: record.deliveryRate } });
    if (parsed.data.driverName.trim()) {
      registerFleetDriver({ fullName: parsed.data.driverName.trim(), assignmentType: "Driver" });
    }
    if (parsed.data.helperName.trim()) {
      registerFleetDriver({ fullName: parsed.data.helperName.trim(), assignmentType: "Helper" });
    }
    if (parsed.data.helper2Name && parsed.data.helper2Name.trim()) {
      registerFleetDriver({ fullName: parsed.data.helper2Name.trim(), assignmentType: "Helper" });
    }
    dynamicMockDeliveries.push({
      record,
      clientId: client.id,
      truckId: truck.id,
      driverId: "",
      helperId: "",
      driverName: parsed.data.driverName || null,
      helperName: helperNames,
      scenario: "User-recorded delivery.",
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
        driverName: parsed.data.driverName || null,
        helperName: helperNames,
      },
      recordedBy: { id: auth.actor.id, email: auth.actor.email, role: auth.actor.role },
    }, { status: 201 });
  }

  if (!isSupabaseConfigured()) {
    return runMockCreateDelivery();
  }

  const supabase = await getMutationSupabaseClient();
  const rawClientName = parsed.data.clientName.trim();

  // Ensure new client exists in public.clients if client name is provided
  let clientId: string | null = null;
  if (rawClientName) {
    const { data: existingClient, error: clientLookupError } = await supabase
      .from("clients")
      .select("id")
      .ilike("name", rawClientName)
      .eq("is_active", true)
      .maybeSingle();

    if (
      clientLookupError &&
      (clientLookupError.message.includes("schema cache") ||
        clientLookupError.message.includes("does not exist") ||
        clientLookupError.message.includes("relation") ||
        clientLookupError.message.includes("clients"))
    ) {
      return runMockCreateDelivery();
    }

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const clientCode =
        rawClientName
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .replace(/[^A-Za-z0-9]/g, "")
          .toUpperCase()
          .slice(0, 6) || "CLI";

      const { data: insertedClient, error: clientInsertError } = await supabase.from("clients").insert({
        name: rawClientName,
        client_code: clientCode,
        code: clientCode,
        is_active: true,
      }).select("id").maybeSingle();

      if (clientInsertError && clientInsertError.code !== "23505") {
        if (
          clientInsertError.message.includes("schema cache") ||
          clientInsertError.message.includes("does not exist") ||
          clientInsertError.message.includes("relation")
        ) {
          return runMockCreateDelivery();
        }
        return NextResponse.json(
          { ok: false, code: "CLIENT_CREATE_FAILED", message: clientInsertError.message },
          { status: 400 },
        );
      }
      clientId = insertedClient?.id ?? null;
    }
  }

  // Ensure truck exists in public.trucks so RPC does not throw INVALID_TRUCK
  const rawPlate = parsed.data.plateNumber.trim().toUpperCase();
  const { data: existingTruck } = await supabase
    .from("trucks")
    .select("id, ownership_type")
    .ilike("plate_number", rawPlate)
    .eq("is_active", true)
    .maybeSingle();

  const isSubconTruck =
    existingTruck?.ownership_type === "Subcontracted" ||
    rawPlate.startsWith("SUB-") ||
    rawPlate.includes("SUBCON");

  let effectiveWaybill = parsed.data.waybillNumber.trim();
  if (!effectiveWaybill) {
    if (isSubconTruck) {
      effectiveWaybill = `WB-SUBCON-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    } else {
      return NextResponse.json(
        { ok: false, code: "WAYBILL_REQUIRED", message: "Waybill number is required for owned trucks." },
        { status: 400 },
      );
    }
  }

  if (!existingTruck) {
    const { error: truckInsertError } = await supabase.from("trucks").insert({
      plate_number: rawPlate,
      truck_type: "6-Wheeler",
      ownership_type: isSubconTruck ? "Subcontracted" : "Owned",
      rate_basis: isSubconTruck ? "Trucker Rate" : "Redeemed Rate",
      is_active: true,
    });
    if (truckInsertError && truckInsertError.code !== "23505") {
      if (
        truckInsertError.message.includes("schema cache") ||
        truckInsertError.message.includes("does not exist") ||
        truckInsertError.message.includes("relation")
      ) {
        return runMockCreateDelivery();
      }
      return NextResponse.json(
        { ok: false, code: "TRUCK_CREATE_FAILED", message: truckInsertError.message },
        { status: 400 },
      );
    }
  }

  const normalizedDriverName = parsed.data.driverName.trim();
  let driverId: string | null = null;
  if (normalizedDriverName) {
    const { data: existingDriver, error: driverLookupError } = await supabase
      .from("employees")
      .select("id")
      .ilike("full_name", normalizedDriverName)
      .eq("assignment_type", "Driver")
      .eq("is_active", true)
      .maybeSingle();
    if (driverLookupError) {
      if (
        driverLookupError.message.includes("schema cache") ||
        driverLookupError.message.includes("does not exist") ||
        driverLookupError.message.includes("relation")
      ) {
        return runMockCreateDelivery();
      }
      return NextResponse.json(
        { ok: false, code: "DRIVER_LOOKUP_FAILED", message: driverLookupError.message },
        { status: 400 },
      );
    }
    driverId = existingDriver?.id ?? null;
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
        if (
          driverInsertError?.message.includes("schema cache") ||
          driverInsertError?.message.includes("does not exist") ||
          driverInsertError?.message.includes("relation")
        ) {
          return runMockCreateDelivery();
        }
        return NextResponse.json(
          { ok: false, code: "DRIVER_CREATE_FAILED", message: driverInsertError?.message ?? "Unable to save driver." },
          { status: 400 },
        );
      } else {
        driverId = createdDriver.id;
      }
    }
  }

  const normalizedHelperName = parsed.data.helperName?.trim();
  let helperId: string | null = null;
  if (normalizedHelperName) {
    const { data: existingHelper } = await supabase
      .from("employees")
      .select("id")
      .ilike("full_name", normalizedHelperName)
      .eq("assignment_type", "Helper")
      .eq("is_active", true)
      .maybeSingle();

    if (existingHelper) {
      helperId = existingHelper.id;
    } else {
      const { data: createdHelper } = await supabase
        .from("employees")
        .insert({
          employee_code: `HLP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          full_name: normalizedHelperName,
          assignment_type: "Helper",
          is_active: true,
        })
        .select("id")
        .maybeSingle();
      helperId = createdHelper?.id ?? null;
    }
  }

  const dropoffsList = parsed.data.dropoffs ?? [];
  const calculatedEntryFees = dropoffsList.reduce((sum, d) => sum + (d.entryFee ?? 0), 0);
  const hasUnknownEntry = dropoffsList.some((d) => d.entryFeeStatus === "unknown");
  const calculatedEntryFeesStatus: ExpenseResolutionStatus = hasUnknownEntry ? "unknown" : "confirmed";

  const { data: deliveryId, error } = await supabase.rpc("create_delivery_record", {
    p_record: {
      ...parsed.data,
      waybillNumber: effectiveWaybill,
      entryFees: calculatedEntryFees,
      entryFeesStatus: calculatedEntryFeesStatus,
      helperAllowance: combinedHelperAllowance,
      helperAllowanceStatus: combinedHelperAllowanceStatus,
      helperDailyRate: combinedHelperDailyRate,
      helperDailyRateStatus: combinedHelperDailyRateStatus,
      driverId,
      helperId,
    },
    p_dropoffs: parsed.data.dropoffs,
  });

  if (error) {
    if (
      error.message.includes("schema cache") ||
      error.message.includes("does not exist") ||
      error.message.includes("create_delivery_record")
    ) {
      return runMockCreateDelivery();
    }
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
      ? `Waybill ${effectiveWaybill} already exists.`
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

  recordAuditEntry({ actorId: auth.actor.id, actorEmail: auth.actor.email, action: "delivery.created", entityType: "delivery", entityId: String(deliveryId), summary: `Recorded delivery ${effectiveWaybill}.`, changes: { clientName: parsed.data.clientName, plateNumber: parsed.data.plateNumber, deliveryRate: parsed.data.deliveryRate } });

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

  const mutation = parsed.data;

  const requiredPermission =
    mutation.action === "finalize_financials" ? "deliveries:complete" : "deliveries:edit";
  let auth = await verifyServerPermission(requiredPermission);
  if (!auth.ok && mutation.action === "correct_financials") {
    auth = await verifyServerPermission("deliveries:complete");
  }
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const actor = auth.actor;

  const runMockDeliveryMutation = () => {
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
        actorId: actor.id,
        actorEmail: actor.email,
        action: "delivery.financials_finalized",
        entityType: "delivery",
        entityId: mutation.deliveryId,
        summary: `Finalized trip financials for delivery ${mutation.deliveryId}.`,
        changes: { version: mutation.expectedVersion + 1 },
      });
    } else {
      recordAuditEntry({
        actorId: actor.id,
        actorEmail: actor.email,
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
      changedBy: { id: actor.id, email: actor.email, role: actor.role },
    });
  };

  if (!isSupabaseConfigured()) {
    return runMockDeliveryMutation();
  }

  const supabase = await getMutationSupabaseClient();
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
    if (
      error.message.includes("schema cache") ||
      error.message.includes("does not exist") ||
      error.message.includes("correct_delivery_financials") ||
      error.message.includes("finalize_delivery_financials")
    ) {
      return runMockDeliveryMutation();
    }
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
            employee_code: `DRV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
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
            employee_code: `HLP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
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

  if (mutation.action === "correct_financials" && (typeof mutation.changes.notes === "string" || mutation.changes.notes === null)) {
    try {
      await supabase.from("deliveries").update({ notes: mutation.changes.notes }).eq("id", mutation.deliveryId);
    } catch {
      // ignore
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
            dropoff_count: Math.max(1, Number(d.dropoffCount) || 1),
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

  // Deletion decisions strictly restricted to Admin & Superadmin
  const isSuperadminOrAdmin =
    auth.actor.isSuperadmin ||
    auth.actor.role === "admin" ||
    auth.actor.roles.includes("admin");
  if (!isSuperadminOrAdmin) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        message: "Only System Administrators and Superadmins are authorized to make delivery deletion decisions.",
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

  const supabase = await getMutationSupabaseClient();
  // Delete cascading child records first to satisfy foreign key constraints
  await supabase.from("delivery_dropoffs").delete().eq("delivery_id", deliveryId);
  await supabase.from("delivery_activity").delete().eq("delivery_id", deliveryId);
  await supabase.from("delivery_mutation_requests").delete().eq("delivery_id", deliveryId);
  await supabase.from("delivery_documents").delete().eq("delivery_id", deliveryId);

  const { data: deletedDelivery, error } = await supabase
    .from("deliveries")
    .delete()
    .eq("id", deliveryId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (
      error.message.includes("schema cache") ||
      error.message.includes("does not exist") ||
      error.message.includes("relation")
    ) {
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
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }
  if (!deletedDelivery && !isBrowserLocal) {
    const res = deleteSmallMockDelivery(deliveryId);
    if (res.ok) {
      recordAuditEntry({
        actorId: auth.actor.id,
        actorEmail: auth.actor.email,
        action: "delivery.deleted",
        entityType: "delivery",
        entityId: deliveryId,
        summary: `Deleted delivery record ID ${deliveryId}.`,
        changes: { storage: "bundled-mock" },
      });
      return NextResponse.json({ ok: true, message: "Delivery record deleted successfully.", deliveryId, source: "bundled-mock" });
    }
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
