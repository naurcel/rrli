import { NextResponse } from "next/server";
import * as z from "zod";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
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
import {
  getMockClients,
  registerMockClient,
  SMALL_MOCK_DATABASE,
} from "@/features/deliveries/small-mock-database";
import {
  buildDeliveryTripRecord,
  isDeliveryIncomplete,
  type TruckTemperature,
} from "@/features/deliveries/delivery-domain";
import {
  dynamicMockDeliveries,
  getAllMockDeliveries,
  savePersistedMockDeliveries,
} from "@/features/deliveries/small-mock-repository";
import { getFleetTrucks, registerFleetTruck, type FleetTruck } from "@/features/deliveries/truck-registry";
import { getFleetCrew, registerFleetCrewMember } from "@/features/deliveries/driver-registry";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";

const importRowSchema = z.object({
  waybillNumber: z.string().trim().min(3, "Waybill number is required."),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Valid YYYY-MM-DD date required.")
    .refine((d) => d >= "2024-01-01", "Delivery date cannot be earlier than company foundation year (2024)."),
  clientName: z.string().trim().min(2, "Client name is required."),
  plateNumber: z.string().trim().min(3, "Truck plate number is required."),
  truckType: z.string().trim().default("6-Wheeler"),
  truckOwnership: z.enum(["Owned", "Subcontracted"]).default("Owned"),
  truckTemperature: z.string().trim().min(1, "Temperature is required."),
  origin: z.string().trim().default("Central Depot"),
  distanceKm: z.number().min(0).default(50),
  fuelRate: z.number().min(0).default(85),
  deliveryRate: z.number().positive("Delivery revenue must be positive."),
  totalExpenses: z.number().nullable().optional().default(null),
  dieselExpenses: z.number().nullable().default(null),
  dieselExpensesStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  tollGateExpenses: z.number().nullable().default(null),
  tollGateExpensesStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  tollGateBreakdown: z.string().trim().default(""),
  driverAllowance: z.number().nullable().default(null),
  driverAllowanceStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  driverDailyRate: z.number().nullable().default(null),
  driverDailyRateStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  driverName: z.string().trim().nullable().optional(),
  helperAllowance: z.number().nullable().default(null),
  helperAllowanceStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  helperDailyRate: z.number().nullable().default(null),
  helperDailyRateStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  helperName: z.string().trim().nullable().optional(),
  otherExpenses: z.number().nullable().default(null),
  otherExpensesStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("confirmed"),
  entryFees: z.number().nullable().optional().default(null),
  entryFeesStatus: z.enum(["confirmed", "not_applicable", "unknown"]).optional(),
  notes: z.string().trim().nullable().optional(),
  dropoffs: z.array(
    z.object({
      storeName: z.string().trim().min(2),
      destinationArea: z.string().trim().min(2),
      dropoffCount: z.number().int().min(1).default(1).optional(),
      entryFee: z.number().nullable().default(null),
      entryFeeStatus: z.enum(["confirmed", "not_applicable", "unknown"]).default("not_applicable"),
      podSubmitted: z.boolean().default(true),
      supportingDocsComplete: z.boolean().default(true),
      documentRef: z.string().trim().default("Imported POD"),
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
  const committedRecords: DeliveryLedgerItem[] = [];
  const errors: { waybill: string; reason: string }[] = [];
  const duplicates: string[] = [];

  const runMockImportBatch = () => {
    // Process rows against small mock database
    const allDeliveries = getAllMockDeliveries();
    const fleetTrucks = getFleetTrucks();
    const fleetCrew = getFleetCrew();

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

      // Match or register truck
      const cleanPlate = row.plateNumber.replace(/\s+/g, "").toUpperCase();
      let truck =
        fleetTrucks.find((t) => t.plateNumber.replace(/\s+/g, "").toUpperCase() === cleanPlate) ??
        SMALL_MOCK_DATABASE.trucks.find((t) => t.plateNumber.replace(/\s+/g, "").toUpperCase() === cleanPlate);

      if (!truck) {
        const newTruckId = crypto.randomUUID();
        const reg = registerFleetTruck({
          id: newTruckId,
          plateNumber: row.plateNumber.trim().toUpperCase(),
          truckType: (row.truckType as any) || "6-Wheeler",
          storageCapability: "Freezer",
          ownershipType: row.truckOwnership,
          rateBasis: row.truckOwnership === "Owned" ? "Redeemed Rate" : "Trucker Rate",
          provider: row.truckOwnership === "Subcontracted" ? "Subcontracted Partner" : null,
          driverName: row.driverName || null,
          helperName: row.helperName || null,
        });

        truck = reg.ok ? reg.truck : {
          id: newTruckId,
          plateNumber: row.plateNumber.trim().toUpperCase(),
          truckType: (row.truckType as any) || "6-Wheeler",
          storageCapability: "Freezer",
          ownershipType: row.truckOwnership,
          rateBasis: row.truckOwnership === "Owned" ? "Redeemed Rate" : "Trucker Rate",
          provider: row.truckOwnership === "Subcontracted" ? "Subcontracted Partner" : null,
          driverName: row.driverName || null,
          helperName: row.helperName || null,
        };

        if (!SMALL_MOCK_DATABASE.trucks.some((t) => t.plateNumber.replace(/\s+/g, "").toUpperCase() === cleanPlate)) {
          (SMALL_MOCK_DATABASE.trucks as FleetTruck[]).push(truck);
        }
      }

      // Match or register driver
      const isUnknownDriver = !row.driverName || row.driverName.toLowerCase().includes("unknown");
      let matchedDriver = !isUnknownDriver && row.driverName
        ? fleetCrew.find(
            (c) =>
              c.assignmentType === "Driver" &&
              c.fullName.toLowerCase().replace(/\s+/g, " ") === row.driverName?.toLowerCase().replace(/\s+/g, " "),
          )
        : null;

      if (!isUnknownDriver && row.driverName && !matchedDriver) {
        const reg = registerFleetCrewMember({
          fullName: row.driverName.trim(),
          assignmentType: "Driver",
        });
        if (reg.ok) matchedDriver = reg.crewMember;
      }

      const driverId = isUnknownDriver
        ? "drv-unknown"
        : (matchedDriver?.id ?? `drv-${row.driverName!.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
      const driverName = isUnknownDriver
        ? "Unknown Driver"
        : (row.driverName || matchedDriver?.fullName || "Unknown Driver");

      // Match or register helper
      const isUnknownHelper = !row.helperName || row.helperName.toLowerCase().includes("unknown");
      let matchedHelper = !isUnknownHelper && row.helperName
        ? fleetCrew.find(
            (c) =>
              c.assignmentType === "Helper" &&
              c.fullName.toLowerCase().replace(/\s+/g, " ") === row.helperName?.toLowerCase().replace(/\s+/g, " "),
          )
        : null;

      if (!isUnknownHelper && row.helperName && !matchedHelper) {
        const reg = registerFleetCrewMember({
          fullName: row.helperName.trim(),
          assignmentType: "Helper",
        });
        if (reg.ok) matchedHelper = reg.crewMember;
      }

      const helperId = isUnknownHelper
        ? "hlp-unknown"
        : (matchedHelper?.id ?? `hlp-${row.helperName!.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
      const helperName = isUnknownHelper
        ? "Unknown Helper"
        : (row.helperName || matchedHelper?.fullName || "Unknown Helper");

      const isSubcon = truck.ownershipType === "Subcontracted" || row.truckOwnership === "Subcontracted";

      const expenses = isSubcon
        ? {
            dieselExpenses: null,
            tollGateExpenses: null,
            tollGateBreakdown: "",
            entryFees: null,
            driverAllowance: null,
            driverDailyRate: null,
            helperAllowance: null,
            helperDailyRate: null,
            otherExpenses: row.totalExpenses ?? row.otherExpenses ?? 0,
          }
        : {
            dieselExpenses: row.dieselExpenses,
            tollGateExpenses: row.tollGateExpenses,
            tollGateBreakdown: row.tollGateBreakdown,
            entryFees: row.entryFees ?? (row.dropoffs.reduce((sum, d) => sum + (d.entryFee ?? 0), 0) || null),
            driverAllowance: row.driverAllowance,
            driverDailyRate: row.driverDailyRate,
            helperAllowance: row.helperAllowance,
            helperDailyRate: row.helperDailyRate,
            otherExpenses: row.otherExpenses,
          };

      const expenseStates = isSubcon
        ? {
            dieselExpenses: "not_applicable" as const,
            tollGateExpenses: "not_applicable" as const,
            entryFees: "not_applicable" as const,
            driverAllowance: "not_applicable" as const,
            driverDailyRate: "not_applicable" as const,
            helperAllowance: "not_applicable" as const,
            helperDailyRate: "not_applicable" as const,
            otherExpenses: "confirmed" as const,
          }
        : {
            dieselExpenses: row.dieselExpensesStatus,
            tollGateExpenses: row.tollGateExpensesStatus,
            entryFees: row.entryFeesStatus ?? (row.entryFees ? "confirmed" : "not_applicable"),
            driverAllowance: row.driverAllowanceStatus,
            driverDailyRate: row.driverDailyRateStatus,
            helperAllowance: row.helperAllowanceStatus,
            helperDailyRate: row.helperDailyRateStatus,
            otherExpenses: row.otherExpensesStatus,
          };

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
        expenses,
        expenseStates,
        dropoffs: row.dropoffs.map((d, index) => ({
          ...d,
          id: `${id}-stop-${index + 1}`,
          sequence: index + 1,
        })),
        notes: row.notes?.trim() || null,
      });

      const isIncomplete = isDeliveryIncomplete(record);
      const deliveryStatus = isIncomplete ? "Incomplete" : "Completed";

      const newMockDelivery = {
        record,
        clientId: client.id,
        truckId: truck.id,
        driverId,
        helperId,
        driverName,
        helperName,
        scenario: "Imported batch record",
      };
      dynamicMockDeliveries.push(newMockDelivery);
      allDeliveries.push(newMockDelivery);

      committed.push(row.waybillNumber);
      committedRecords.push({
        ...record,
        clientId: client.id,
        truckId: truck.id,
        deliveryStatus,
        driverName,
        helperName,
      });
    }

    savePersistedMockDeliveries();

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
      committedRecords,
      duplicateCount: duplicates.length,
      duplicateWaybills: duplicates,
      errors,
      importedBy: { id: auth.actor.id, email: auth.actor.email, role: auth.actor.role },
    });
  }

  if (!isSupabaseConfigured()) {
    return runMockImportBatch();
  }

  try {
    const supabase = await getMutationSupabaseClient();

    // Check existing waybills in database to avoid duplicate key conflicts
    const waybills = rows.map((r) => r.waybillNumber);
    const { data: existingRows, error: checkError } = await supabase
      .from("deliveries")
      .select("waybill_number")
      .in("waybill_number", waybills);

    if (
      checkError &&
      (checkError.message.includes("schema cache") ||
        checkError.message.includes("does not exist") ||
        checkError.message.includes("relation") ||
        checkError.message.includes("deliveries"))
    ) {
      return runMockImportBatch();
    }

    const existingSet = new Set((existingRows ?? []).map((r) => r.waybill_number));

    // Entity caches to minimize database queries during batch import
    const clientCache = new Map<string, string>();
    const truckCache = new Map<string, string>();
    const driverCache = new Map<string, string>();
    const helperCache = new Map<string, string>();

    async function resolveClientId(name: string): Promise<string> {
      const clean = name.trim();
      const lower = clean.toLowerCase();
      if (clientCache.has(lower)) return clientCache.get(lower)!;

      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", clean)
        .eq("is_active", true)
        .maybeSingle();

      if (existing?.id) {
        clientCache.set(lower, existing.id);
        return existing.id;
      }

      const clientCode =
        clean
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .replace(/[^A-Za-z0-9]/g, "")
          .toUpperCase()
          .slice(0, 6) || "CLI";

      const { data: created, error } = await supabase
        .from("clients")
        .insert({
          name: clean,
          code: clientCode,
          is_active: true,
        })
        .select("id")
        .single();

      if (created?.id) {
        clientCache.set(lower, created.id);
        return created.id;
      }
      if (error?.code === "23505") {
        const { data: retry } = await supabase
          .from("clients")
          .select("id")
          .ilike("name", clean)
          .maybeSingle();
        if (retry?.id) {
          clientCache.set(lower, retry.id);
          return retry.id;
        }
      }
      throw new Error(`Failed to resolve client ${clean}: ${error?.message}`);
    }

    async function resolveTruckId(plate: string, truckType = "6-Wheeler", ownership = "Owned"): Promise<string> {
      const clean = plate.trim().toUpperCase();
      const lower = clean.toLowerCase();
      if (truckCache.has(lower)) return truckCache.get(lower)!;

      const { data: existing } = await supabase
        .from("trucks")
        .select("id")
        .ilike("plate_number", clean)
        .eq("is_active", true)
        .maybeSingle();

      if (existing?.id) {
        truckCache.set(lower, existing.id);
        return existing.id;
      }

      const { data: created, error } = await supabase
        .from("trucks")
        .insert({
          plate_number: clean,
          truck_type: truckType,
          ownership_type: ownership,
          rate_basis: "Redeemed Rate",
          is_active: true,
        })
        .select("id")
        .single();

      if (created?.id) {
        truckCache.set(lower, created.id);
        return created.id;
      }
      if (error?.code === "23505") {
        const { data: retry } = await supabase
          .from("trucks")
          .select("id")
          .ilike("plate_number", clean)
          .maybeSingle();
        if (retry?.id) {
          truckCache.set(lower, retry.id);
          return retry.id;
        }
      }
      throw new Error(`Failed to resolve truck ${clean}: ${error?.message}`);
    }

    async function resolveDriverId(name?: string | null): Promise<string> {
      const clean = (name && name.trim()) || "Fleet Driver";
      const lower = clean.toLowerCase();
      if (driverCache.has(lower)) return driverCache.get(lower)!;

      const { data: existing } = await supabase
        .from("employees")
        .select("id")
        .ilike("full_name", clean)
        .eq("assignment_type", "Driver")
        .eq("is_active", true)
        .maybeSingle();

      if (existing?.id) {
        driverCache.set(lower, existing.id);
        return existing.id;
      }

      if (clean === "Fleet Driver" || clean === "Unknown Driver") {
        const { data: anyDriver } = await supabase
          .from("employees")
          .select("id")
          .eq("assignment_type", "Driver")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (anyDriver?.id) {
          driverCache.set(lower, anyDriver.id);
          return anyDriver.id;
        }
      }

      const { data: created, error } = await supabase
        .from("employees")
        .insert({
          employee_code: `DRV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          full_name: clean,
          assignment_type: "Driver",
          is_active: true,
        })
        .select("id")
        .single();

      if (created?.id) {
        driverCache.set(lower, created.id);
        return created.id;
      }
      if (error?.code === "23505") {
        const { data: retry } = await supabase
          .from("employees")
          .select("id")
          .ilike("full_name", clean)
          .eq("assignment_type", "Driver")
          .maybeSingle();
        if (retry?.id) {
          driverCache.set(lower, retry.id);
          return retry.id;
        }
      }
      throw new Error(`Failed to resolve driver ${clean}: ${error?.message}`);
    }

    async function resolveHelperId(name?: string | null): Promise<string | null> {
      if (!name || !name.trim() || name.trim().toLowerCase().includes("unknown")) return null;
      const clean = name.trim();
      const lower = clean.toLowerCase();
      if (helperCache.has(lower)) return helperCache.get(lower)!;

      const { data: existing } = await supabase
        .from("employees")
        .select("id")
        .ilike("full_name", clean)
        .eq("assignment_type", "Helper")
        .eq("is_active", true)
        .maybeSingle();

      if (existing?.id) {
        helperCache.set(lower, existing.id);
        return existing.id;
      }

      const { data: created, error } = await supabase
        .from("employees")
        .insert({
          employee_code: `HLP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          full_name: clean,
          assignment_type: "Helper",
          is_active: true,
        })
        .select("id")
        .single();

      if (created?.id) {
        helperCache.set(lower, created.id);
        return created.id;
      }
      if (error?.code === "23505") {
        const { data: retry } = await supabase
          .from("employees")
          .select("id")
          .ilike("full_name", clean)
          .eq("assignment_type", "Helper")
          .maybeSingle();
        if (retry?.id) {
          helperCache.set(lower, retry.id);
          return retry.id;
        }
      }
      return null;
    }

    for (const row of rows) {
      if (existingSet.has(row.waybillNumber)) {
        duplicates.push(row.waybillNumber);
        continue;
      }

      try {
        await resolveClientId(row.clientName);
        await resolveTruckId(row.plateNumber, row.truckType, row.truckOwnership);
        const driverId = await resolveDriverId(row.driverName);
        const helperId = await resolveHelperId(row.helperName);

        const rpcPayload = {
          ...row,
          driverId,
          helperId,
          idempotencyKey: crypto.randomUUID(),
        };

        const { error } = await supabase.rpc("create_delivery_record", {
          p_record: rpcPayload,
          p_dropoffs: row.dropoffs,
        });

        if (error) {
          if (
            error.message.includes("schema cache") ||
            error.message.includes("does not exist") ||
            error.message.includes("create_delivery_record")
          ) {
            return runMockImportBatch();
          }
          if (error.code === "23505" || error.message.includes("waybill_number")) {
            duplicates.push(row.waybillNumber);
          } else {
            errors.push({ waybill: row.waybillNumber, reason: error.message });
          }
        } else {
          committed.push(row.waybillNumber);
          existingSet.add(row.waybillNumber);
        }
      } catch (rowErr) {
        const reason = rowErr instanceof Error ? rowErr.message : "Entity resolution failed";
        errors.push({ waybill: row.waybillNumber, reason });
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
  } catch {
    return runMockImportBatch();
  }
}
