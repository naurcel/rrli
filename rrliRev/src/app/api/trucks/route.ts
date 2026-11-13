import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import * as z from "zod";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";

import {
  deleteFleetTruck,
  getFleetTrucks,
  registerFleetTruck,
  updateFleetTruck,
  type FleetTruck,
} from "@/features/deliveries/truck-registry";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createTruckSchema = z.object({
  plateNumber: z
    .string()
    .trim()
    .min(3, "Plate number must be at least 3 characters.")
    .max(12, "Plate number must not exceed 12 characters.")
    .regex(/^[A-Za-z0-9\s-]+$/, "Plate number contains invalid characters."),
  truckType: z.enum(["4-Wheeler", "6-Wheeler", "10-Wheeler"]),
  storageCapability: z.enum(["Refrigerated", "Dry"]),
  ownershipType: z.enum(["Owned", "Subcontracted"]).default("Owned"),
  rateBasis: z.enum(["Redeemed Rate", "Trucker Rate"]).optional(),
  provider: z.string().trim().nullable().optional(),
  contactPerson: z.string().trim().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.ownershipType === "Subcontracted" && (!data.provider || !data.provider.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["provider"],
      message: "Provider is required for subcontracted trucks.",
    });
  }
});

const updateTruckSchema = z.object({
  originalPlateNumber: z.string().trim().min(1, "Original plate number is required."),
  plateNumber: z
    .string()
    .trim()
    .min(3, "Plate number must be at least 3 characters.")
    .max(12, "Plate number must not exceed 12 characters.")
    .regex(/^[A-Za-z0-9\s-]+$/, "Plate number contains invalid characters."),
  truckType: z.enum(["4-Wheeler", "6-Wheeler", "10-Wheeler"]),
  storageCapability: z.enum(["Refrigerated", "Dry"]),
  ownershipType: z.enum(["Owned", "Subcontracted"]),
  rateBasis: z.enum(["Redeemed Rate", "Trucker Rate"]).optional(),
  provider: z.string().trim().nullable().optional(),
  contactPerson: z.string().trim().nullable().optional(),
  browserLocal: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.ownershipType === "Subcontracted" && (!data.provider || !data.provider.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["provider"],
      message: "Provider is required for subcontracted trucks.",
    });
  }
});

export async function GET() {
  const auth = await verifyServerPermission("profitability:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      source: "bundled-mock",
      trucks: getFleetTrucks(),
    });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: rows, error } = await supabase
      .from("trucks")
      .select("id, plate_number, truck_type, storage_capability, ownership_type, rate_basis, provider, contact_person, is_active")
      .eq("is_active", true)
      .order("plate_number");

    if (error) {
      throw error;
    }

    const trucks: FleetTruck[] = (rows ?? []).map((row) => ({
      id: row.id,
      plateNumber: row.plate_number,
      truckType: row.truck_type as FleetTruck["truckType"],
      storageCapability: row.storage_capability === "Dry" ? "Dry" : "Refrigerated",
      ownershipType: row.ownership_type === "Subcontracted" ? "Subcontracted" : "Owned",
      rateBasis: row.rate_basis === "Trucker Rate" ? "Trucker Rate" : "Redeemed Rate",
      provider: row.provider ?? null,
      contactPerson: row.contact_person ?? null,
    }));

    return NextResponse.json({ ok: true, source: "database", trucks });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "TRUCKS_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Unable to load trucks.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await verifyServerPermission("profitability:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createTruckSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid truck payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const normalizedPlate = parsed.data.plateNumber.trim().toUpperCase();
  const rateBasis =
    parsed.data.rateBasis ??
    (parsed.data.ownershipType === "Owned" ? "Redeemed Rate" : "Trucker Rate");

  const newTruck: FleetTruck = {
    id: randomUUID(),
    plateNumber: normalizedPlate,
    truckType: parsed.data.truckType,
    storageCapability: parsed.data.storageCapability,
    ownershipType: parsed.data.ownershipType,
    rateBasis,
    provider: parsed.data.ownershipType === "Subcontracted" ? (parsed.data.provider?.trim() ?? null) : null,
    contactPerson: parsed.data.ownershipType === "Subcontracted" ? (parsed.data.contactPerson?.trim() ?? null) : null,
  };

  if (!isSupabaseConfigured()) {
    const registerResult = registerFleetTruck(newTruck);
    if (!registerResult.ok) {
      return NextResponse.json(
        { ok: false, code: "DUPLICATE_PLATE", message: registerResult.error },
        { status: 409 },
      );
    }

    recordAuditEntry({ actorId: auth.actor.id, actorEmail: auth.actor.email, action: "truck.created", entityType: "truck", entityId: registerResult.truck.id, summary: `Registered truck ${registerResult.truck.plateNumber}.`, changes: { truckType: registerResult.truck.truckType, ownershipType: registerResult.truck.ownershipType } });

    return NextResponse.json(
      {
        ok: true,
        truck: registerResult.truck,
        recordedBy: {
          id: auth.actor.id,
          email: auth.actor.email,
          role: auth.actor.role,
        },
      },
      { status: 201 },
    );
  }

  try {
    const supabase = await createServerSupabaseClient();

    // Check for duplicate plate number
    const { data: existing } = await supabase
      .from("trucks")
      .select("id")
      .eq("plate_number", normalizedPlate)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          code: "DUPLICATE_PLATE",
          message: `Truck with plate number "${normalizedPlate}" already exists.`,
        },
        { status: 409 },
      );
    }

    const { error: insertError } = await supabase.from("trucks").insert({
      id: newTruck.id,
      plate_number: newTruck.plateNumber,
      truck_type: newTruck.truckType,
      storage_capability: newTruck.storageCapability,
      ownership_type: newTruck.ownershipType,
      rate_basis: newTruck.rateBasis,
      provider: newTruck.provider,
      contact_person: newTruck.contactPerson,
      is_active: true,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            ok: false,
            code: "DUPLICATE_PLATE",
            message: `Truck with plate number "${normalizedPlate}" already exists.`,
          },
          { status: 409 },
        );
      }
      throw insertError;
    }

    recordAuditEntry({ actorId: auth.actor.id, actorEmail: auth.actor.email, action: "truck.created", entityType: "truck", entityId: newTruck.id, summary: `Registered truck ${newTruck.plateNumber}.`, changes: { truckType: newTruck.truckType, ownershipType: newTruck.ownershipType } });

    return NextResponse.json(
      {
        ok: true,
        truck: newTruck,
        recordedBy: {
          id: auth.actor.id,
          email: auth.actor.email,
          role: auth.actor.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "TRUCK_CREATE_FAILED",
        message: error instanceof Error ? error.message : "Unable to register truck.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await verifyServerPermission("profitability:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  // Deletion decisions strictly restricted to Admin role
  if (auth.actor.role !== "admin") {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        message: "Only System Administrators are authorized to make truck deletion decisions.",
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const identifier = searchParams.get("id") || searchParams.get("plateNumber");
  const isBrowserLocal = searchParams.get("browserLocal") === "true";
  if (!identifier) {
    return NextResponse.json(
      { ok: false, message: "Truck plate number or ID is required." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    const deleteResult = deleteFleetTruck(identifier);
    if (!deleteResult.ok && !isBrowserLocal) {
      return NextResponse.json({ ok: false, message: "Truck not found." }, { status: 404 });
    }
    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "truck.deleted",
      entityType: "truck",
      entityId: identifier,
      summary: `Admin deleted truck ${identifier}.`,
      changes: {
        isDeleted: true,
        storage: isBrowserLocal && !deleteResult.ok ? "browser-local" : "bundled-mock",
      },
    });
    return NextResponse.json({
      ok: true,
      source: isBrowserLocal && !deleteResult.ok ? "browser-local" : "bundled-mock",
    });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: deactivatedTruck, error } = await supabase
      .from("trucks")
      .update({ is_active: false })
      .or(`id.eq.${identifier},plate_number.eq.${identifier.toUpperCase()}`)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!deactivatedTruck && !isBrowserLocal) {
      return NextResponse.json({ ok: false, code: "TRUCK_NOT_FOUND", message: "Truck not found." }, { status: 404 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "truck.deleted",
      entityType: "truck",
      entityId: identifier,
      summary: `Admin deleted truck ${identifier}.`,
      changes: { isDeleted: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to delete truck." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await verifyServerPermission("profitability:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  // Editing trucks strictly restricted to Admin role
  if (auth.actor.role !== "admin") {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        message: "Only System Administrators are authorized to edit trucks.",
      },
      { status: 403 },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = updateTruckSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid truck update payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const normalizedOriginal = parsed.data.originalPlateNumber.trim().toUpperCase();
  const normalizedPlate = parsed.data.plateNumber.trim().toUpperCase();
  const rateBasis =
    parsed.data.rateBasis ??
    (parsed.data.ownershipType === "Owned" ? "Redeemed Rate" : "Trucker Rate");

  if (!isSupabaseConfigured()) {
    const updateResult = updateFleetTruck(normalizedOriginal, {
      plateNumber: normalizedPlate,
      truckType: parsed.data.truckType,
      storageCapability: parsed.data.storageCapability,
      ownershipType: parsed.data.ownershipType,
      rateBasis,
      provider: parsed.data.ownershipType === "Subcontracted" ? (parsed.data.provider?.trim() ?? null) : null,
      contactPerson: parsed.data.ownershipType === "Subcontracted" ? (parsed.data.contactPerson?.trim() ?? null) : null,
    });

    if (!updateResult.ok) {
      if (updateResult.code === "NOT_FOUND" && parsed.data.browserLocal) {
        const fallbackTruck: FleetTruck = {
          id: randomUUID(),
          plateNumber: normalizedPlate,
          truckType: parsed.data.truckType,
          storageCapability: parsed.data.storageCapability,
          ownershipType: parsed.data.ownershipType,
          rateBasis,
          provider: parsed.data.ownershipType === "Subcontracted" ? (parsed.data.provider?.trim() ?? null) : null,
          contactPerson: parsed.data.ownershipType === "Subcontracted" ? (parsed.data.contactPerson?.trim() ?? null) : null,
        };
        const reg = registerFleetTruck(fallbackTruck);
        if (!reg.ok) {
          return NextResponse.json(
            { ok: false, code: "DUPLICATE_PLATE", message: reg.error },
            { status: 409 },
          );
        }
        recordAuditEntry({
          actorId: auth.actor.id,
          actorEmail: auth.actor.email,
          action: "truck.updated",
          entityType: "truck",
          entityId: reg.truck.id,
          summary: `Updated truck ${normalizedOriginal} (${reg.truck.plateNumber}).`,
          changes: {
            plateNumber: reg.truck.plateNumber,
            truckType: reg.truck.truckType,
            storageCapability: reg.truck.storageCapability,
            ownershipType: reg.truck.ownershipType,
          },
        });
        return NextResponse.json({ ok: true, truck: reg.truck });
      }

      return NextResponse.json(
        { ok: false, code: updateResult.code, message: updateResult.error },
        { status: updateResult.code === "DUPLICATE_PLATE" ? 409 : updateResult.code === "NOT_FOUND" ? 404 : 400 },
      );
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "truck.updated",
      entityType: "truck",
      entityId: updateResult.truck.id,
      summary: `Updated truck ${updateResult.truck.plateNumber}.`,
      changes: {
        plateNumber: updateResult.truck.plateNumber,
        truckType: updateResult.truck.truckType,
        storageCapability: updateResult.truck.storageCapability,
        ownershipType: updateResult.truck.ownershipType,
      },
    });

    return NextResponse.json({ ok: true, truck: updateResult.truck });
  }

  try {
    const supabase = await createServerSupabaseClient();

    if (normalizedOriginal !== normalizedPlate) {
      const { data: existing } = await supabase
        .from("trucks")
        .select("id")
        .eq("plate_number", normalizedPlate)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          {
            ok: false,
            code: "DUPLICATE_PLATE",
            message: `Truck with plate number "${normalizedPlate}" already exists.`,
          },
          { status: 409 },
        );
      }
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("trucks")
      .update({
        plate_number: normalizedPlate,
        truck_type: parsed.data.truckType,
        storage_capability: parsed.data.storageCapability,
        ownership_type: parsed.data.ownershipType,
        rate_basis: rateBasis,
        provider: parsed.data.ownershipType === "Subcontracted" ? (parsed.data.provider?.trim() ?? null) : null,
        contact_person: parsed.data.ownershipType === "Subcontracted" ? (parsed.data.contactPerson?.trim() ?? null) : null,
      })
      .eq("plate_number", normalizedOriginal)
      .select("id, plate_number, truck_type, storage_capability, ownership_type, rate_basis, provider, contact_person")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedRow && !parsed.data.browserLocal) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Truck not found." },
        { status: 404 },
      );
    }

    const updatedTruck: FleetTruck = {
      id: updatedRow?.id ?? randomUUID(),
      plateNumber: normalizedPlate,
      truckType: parsed.data.truckType,
      storageCapability: parsed.data.storageCapability,
      ownershipType: parsed.data.ownershipType,
      rateBasis,
      provider: parsed.data.ownershipType === "Subcontracted" ? (parsed.data.provider?.trim() ?? null) : null,
      contactPerson: parsed.data.ownershipType === "Subcontracted" ? (parsed.data.contactPerson?.trim() ?? null) : null,
    };

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "truck.updated",
      entityType: "truck",
      entityId: updatedTruck.id,
      summary: `Updated truck ${updatedTruck.plateNumber}.`,
      changes: {
        plateNumber: updatedTruck.plateNumber,
        truckType: updatedTruck.truckType,
        storageCapability: updatedTruck.storageCapability,
        ownershipType: updatedTruck.ownershipType,
      },
    });

    return NextResponse.json({ ok: true, truck: updatedTruck });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "TRUCK_UPDATE_FAILED",
        message: error instanceof Error ? error.message : "Unable to update truck.",
      },
      { status: 500 },
    );
  }
}

