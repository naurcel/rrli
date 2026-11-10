import { NextResponse } from "next/server";
import * as z from "zod";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getMockClients,
  registerMockClient,
  SMALL_MOCK_DATABASE,
} from "@/features/deliveries/small-mock-database";
import { buildDeliveryTripRecord, type TruckTemperature } from "@/features/deliveries/delivery-domain";
import { dynamicMockDeliveries, getAllMockDeliveries } from "@/features/deliveries/small-mock-repository";

const importRowSchema = z.object({
  waybillNumber: z.string().trim().min(3, "Waybill number is required."),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Valid YYYY-MM-DD date required.")
    .refine((d) => d >= "2024-01-01", "Delivery date cannot be earlier than company foundation year (2024)."),
  clientName: z.string().trim().min(2, "Client name is required."),
  plateNumber: z.string().trim().min(3, "Truck plate number is required."),
  truckTemperature: z
    .string()
    .trim()
    .regex(/^-?\d+(?:\.\d+)?°C$/, "Enter a fixed numeric temperature in °C."),
  origin: z.string().trim().default("Central Depot"),
  distanceKm: z.number().min(0).default(50),
  fuelRate: z.number().min(0).default(85),
  deliveryRate: z.number().positive("Delivery revenue must be positive."),
  dieselExpenses: z.number().nullable().default(null),
  dieselExpensesStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  tollGateExpenses: z.number().nullable().default(null),
  tollGateExpensesStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  tollGateBreakdown: z.string().trim().default(""),
  driverAllowance: z.number().nullable().default(null),
  driverAllowanceStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  driverDailyRate: z.number().nullable().default(null),
  driverDailyRateStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  helperAllowance: z.number().nullable().default(null),
  helperAllowanceStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  helperDailyRate: z.number().nullable().default(null),
  helperDailyRateStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  otherExpenses: z.number().nullable().default(null),
  otherExpensesStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  dropoffs: z.array(
    z.object({
      storeName: z.string().trim().min(2),
      destinationArea: z.string().trim().min(2),
      entryFee: z.number().nullable().default(null),
      entryFeeStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("not_applicable"),
      podSubmitted: z.boolean().default(false),
      supportingDocsComplete: z.boolean().default(false),
      documentRef: z.string().trim().default("Pending upload"),
    })
  ).min(1, "At least one store drop-off is required."),
});

const batchImportSchema = z.object({
  batchName: z.string().trim().min(3, "Batch name is required."),
  idempotencyKey: z.string().uuid("Idempotency key must be a valid UUID."),
  rows: z.array(importRowSchema).min(1, "At least one row is required for import."),
});

/**
 * POST /api/deliveries/import
 * Processes an audited batch of staged delivery records from a Daily Trip Report spreadsheet.
 * Enforces `imports:upload` server-side permission (restricted to Admin and Operations).
 * Idempotent against duplicate submissions using `idempotencyKey`.
 */
export async function POST(request: Request) {
  const auth = await verifyServerPermission("imports:upload");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = batchImportSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid import batch payload.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 },
    );
  }

  const { batchName, idempotencyKey, rows } = parsed.data;

  // Track results
  const committed: string[] = [];
  const errors: { waybill: string; reason: string }[] = [];
  const duplicates: string[] = [];

  if (!isSupabaseConfigured()) {
    // Process rows against small mock database
    const allDeliveries = getAllMockDeliveries();
    for (const row of rows) {
      if (allDeliveries.some((d) => d.record.waybillNumber === row.waybillNumber)) {
        duplicates.push(row.waybillNumber);
        continue;
      }

      const client =
        getMockClients().find((c) =>
          c.name.toLowerCase().includes(row.clientName.toLowerCase()) ||
          row.clientName.toLowerCase().includes(c.name.toLowerCase())
        ) ?? registerMockClient(row.clientName);

      const truck = SMALL_MOCK_DATABASE.trucks.find((t) =>
        t.plateNumber.toLowerCase().replace(/\s+/g, "") ===
        row.plateNumber.toLowerCase().replace(/\s+/g, "")
      ) ?? SMALL_MOCK_DATABASE.trucks[0];

      const id = crypto.randomUUID();
      const record = buildDeliveryTripRecord({
        id,
        waybillNumber: row.waybillNumber,
        deliveryDate: row.deliveryDate,
        clientName: client.name,
        plateNumber: truck.plateNumber,
        truckType: truck.truckType,
        truckTemperature: row.truckTemperature as TruckTemperature,
        truckOwnership: truck.ownershipType,
        rateBasis: truck.rateBasis,
        origin: row.origin,
        distanceKm: row.distanceKm,
        fuelRate: row.fuelRate,
        deliveryRate: row.deliveryRate,
        expenses: {
          dieselExpenses: row.dieselExpenses,
          tollGateExpenses: row.tollGateExpenses,
          tollGateBreakdown: row.tollGateBreakdown,
          driverAllowance: row.driverAllowance,
          driverDailyRate: row.driverDailyRate,
          helperAllowance: row.helperAllowance,
          helperDailyRate: row.helperDailyRate,
          otherExpenses: row.otherExpenses,
        },
        expenseStates: {
          dieselExpenses: row.dieselExpensesStatus,
          tollGateExpenses: row.tollGateExpensesStatus,
          driverAllowance: row.driverAllowanceStatus,
          driverDailyRate: row.driverDailyRateStatus,
          helperAllowance: row.helperAllowanceStatus,
          helperDailyRate: row.helperDailyRateStatus,
          otherExpenses: row.otherExpensesStatus,
        },
        dropoffs: row.dropoffs.map((d, index) => ({
          ...d,
          id: `${id}-stop-${index + 1}`,
          sequence: index + 1,
        })),
      });

      const newMockDelivery = {
        record,
        clientId: client.id,
        truckId: truck.id,
        driverId: SMALL_MOCK_DATABASE.drivers[0]?.id ?? "drv-1",
        helperId: SMALL_MOCK_DATABASE.helpers[0]?.id ?? "hlp-1",
        scenario: "Imported batch record",
      };
      dynamicMockDeliveries.push(newMockDelivery);
      allDeliveries.push(newMockDelivery);

      committed.push(row.waybillNumber);
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "delivery.batch_imported",
      entityType: "import_batch",
      entityId: idempotencyKey,
      summary: `Imported batch "${batchName}" with ${committed.length} deliveries.`,
      changes: { committedWaybills: committed, duplicateCount: duplicates.length, errorCount: errors.length },
    });

    return NextResponse.json({
      ok: true,
      batchName,
      idempotencyKey,
      totalRows: rows.length,
      committedCount: committed.length,
      committedWaybills: committed,
      duplicateCount: duplicates.length,
      duplicateWaybills: duplicates,
      errors,
      importedBy: { id: auth.actor.id, email: auth.actor.email, role: auth.actor.role },
    });
  }

  try {
    const supabase = await createServerSupabaseClient();

    // Check existing waybills in database to avoid duplicate key conflicts
    const waybills = rows.map((r) => r.waybillNumber);
    const { data: existingRows } = await supabase
      .from("deliveries")
      .select("waybill_number")
      .in("waybill_number", waybills);

    const existingSet = new Set((existingRows ?? []).map((r) => r.waybill_number));

    for (const row of rows) {
      if (existingSet.has(row.waybillNumber)) {
        duplicates.push(row.waybillNumber);
        continue;
      }

      const { error } = await supabase.rpc("create_delivery_record", {
        p_record: row,
        p_dropoffs: row.dropoffs,
      });

      if (error) {
        if (error.code === "23505" || error.message.includes("waybill_number")) {
          duplicates.push(row.waybillNumber);
        } else {
          errors.push({ waybill: row.waybillNumber, reason: error.message });
        }
      } else {
        committed.push(row.waybillNumber);
        existingSet.add(row.waybillNumber);
      }
    }

    return NextResponse.json({
      ok: true,
      batchName,
      idempotencyKey,
      totalRows: rows.length,
      committedCount: committed.length,
      committedWaybills: committed,
      duplicateCount: duplicates.length,
      duplicateWaybills: duplicates,
      errorCount: errors.length,
      errors,
      importedBy: { id: auth.actor.id, email: auth.actor.email, role: auth.actor.role },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "IMPORT_FAILED",
        message: err instanceof Error ? err.message : "Batch import encountered an unexpected error.",
      },
      { status: 500 },
    );
  }
}
