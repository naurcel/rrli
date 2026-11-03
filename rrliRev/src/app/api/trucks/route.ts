import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import * as z from "zod";

import {
  getFleetTrucks,
  registerFleetTruck,
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
      .select("id, plate_number, truck_type, is_active")
      .eq("is_active", true)
      .order("plate_number");

    if (error) {
      throw error;
    }

    const trucks: FleetTruck[] = (rows ?? []).map((row) => ({
      id: row.id,
      plateNumber: row.plate_number,
      truckType: row.truck_type as FleetTruck["truckType"],
      ownershipType: "Owned",
      rateBasis: "Redeemed Rate",
      provider: null,
      contactPerson: null,
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

