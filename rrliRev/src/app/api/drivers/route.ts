import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import * as z from "zod";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import {
  getFleetCrew,
  registerFleetCrewMember,
  setFleetCrewActive,
  updateFleetCrewMember,
  deleteFleetCrewMember,
  type FleetCrewMember,
  type FleetDriver,
} from "@/features/deliveries/driver-registry";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createCrewSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name must not exceed 80 characters."),
  assignmentType: z
    .enum(["Driver", "Helper"])
    .default("Driver"),
  employeeCode: z
    .string()
    .trim()
    .max(20, "Employee code must not exceed 20 characters.")
    .optional()
    .nullable(),
  contactNumber: z
    .string()
    .trim()
    .max(30, "Contact number must not exceed 30 characters.")
    .optional()
    .nullable(),
});

export async function GET() {
  let auth = await verifyServerPermission("profitability:view");
  if (!auth.ok) {
    auth = await verifyServerPermission("deliveries:view");
  }
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  if (!isSupabaseConfigured()) {
    const crew = getFleetCrew();
    return NextResponse.json({
      ok: true,
      source: "bundled-mock",
      drivers: crew,
      crew,
    });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: rows, error } = await supabase
      .from("employees")
      .select("id, employee_code, full_name, assignment_type, contact_number, is_active")
      .in("assignment_type", ["Driver", "Helper"])
      .order("full_name");

    if (error) {
      throw error;
    }

    const crew: FleetCrewMember[] = (rows ?? []).map((row) => ({
      id: row.id,
      employeeCode: row.employee_code ?? "",
      fullName: row.full_name,
      assignmentType: (row.assignment_type === "Helper" ? "Helper" : "Driver") as "Driver" | "Helper",
      contactNumber: row.contact_number ?? null,
      isActive: row.is_active ?? true,
    }));

    return NextResponse.json({ ok: true, source: "database", drivers: crew, crew });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "CREW_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Unable to load crew.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let auth = await verifyServerPermission("profitability:manage");
  if (!auth.ok) {
    auth = await verifyServerPermission("deliveries:create");
  }
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createCrewSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid payload.",
      },
      { status: 400 },
    );
  }

  const fullName = parsed.data.fullName.trim();
  const assignmentType = parsed.data.assignmentType;
  const employeeCode = parsed.data.employeeCode?.trim() || null;
  const contactNumber = parsed.data.contactNumber?.trim() || null;

  if (!isSupabaseConfigured()) {
    const registerResult = registerFleetCrewMember({
      fullName,
      assignmentType,
      employeeCode,
      contactNumber,
    });

    if (!registerResult.ok) {
      return NextResponse.json(
        { ok: false, code: "DUPLICATE_CREW", message: registerResult.error },
        { status: 409 },
      );
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: assignmentType === "Helper" ? "helper.created" : "driver.created",
      entityType: assignmentType === "Helper" ? "helper" : "driver",
      entityId: registerResult.driver.id,
      summary: `Registered ${assignmentType.toLowerCase()} ${registerResult.driver.fullName}.`,
      changes: { fullName: registerResult.driver.fullName, assignmentType },
    });

    return NextResponse.json(
      {
        ok: true,
        driver: registerResult.driver,
        crewMember: registerResult.driver,
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

    // Check for duplicate name for this role
    const { data: existing } = await supabase
      .from("employees")
      .select("id")
      .eq("assignment_type", assignmentType)
      .ilike("full_name", fullName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          code: "DUPLICATE_CREW",
          message: `${assignmentType} "${fullName}" already exists.`,
        },
        { status: 409 },
      );
    }

    const newId = randomUUID();
    const countQuery = await supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("assignment_type", assignmentType);
    const prefix = assignmentType === "Helper" ? "HLP" : "DRV";
    const autoCode = employeeCode || `${prefix}-${String((countQuery.count ?? 0) + 1).padStart(2, "0")}`;

    const { error: insertError } = await supabase.from("employees").insert({
      id: newId,
      employee_code: autoCode,
      full_name: fullName,
      assignment_type: assignmentType,
      contact_number: contactNumber,
      is_active: true,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            ok: false,
            code: "DUPLICATE_CREW",
            message: `${assignmentType} with name "${fullName}" or code "${autoCode}" already exists.`,
          },
          { status: 409 },
        );
      }
      throw insertError;
    }

    const newCrewMember: FleetCrewMember = {
      id: newId,
      employeeCode: autoCode,
      fullName,
      assignmentType,
      contactNumber,
      isActive: true,
    };

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: assignmentType === "Helper" ? "helper.created" : "driver.created",
      entityType: assignmentType === "Helper" ? "helper" : "driver",
      entityId: newId,
      summary: `Registered ${assignmentType.toLowerCase()} ${fullName}.`,
      changes: { fullName, assignmentType },
    });

    return NextResponse.json(
      {
        ok: true,
        driver: newCrewMember,
        crewMember: newCrewMember,
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
        code: "CREW_CREATE_FAILED",
        message: error instanceof Error ? error.message : "Unable to register crew member.",
      },
      { status: 500 },
    );
  }
}

const crewUpdateSchema = z.object({
  crewMemberId: z.string().trim().min(1),
  isActive: z.boolean().optional(),
  fullName: z.string().trim().min(2, "Name must be at least 2 characters.").max(80).optional(),
  assignmentType: z.enum(["Driver", "Helper"]).optional(),
  contactNumber: z.string().trim().max(30).optional().nullable(),
  browserLocal: z.boolean().optional().default(false),
});

export async function PATCH(request: Request) {
  const auth = await verifyServerPermission("profitability:manage");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, message: auth.message }, { status: auth.status });
  }

  const parsed = crewUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Valid crew member update required." }, { status: 400 });
  }

  const { crewMemberId, isActive, fullName, assignmentType, contactNumber, browserLocal } = parsed.data;

  if (!isSupabaseConfigured()) {
    let updatedCrewMember: FleetCrewMember | null = null;

    if (fullName !== undefined || assignmentType !== undefined || contactNumber !== undefined) {
      const updateResult = updateFleetCrewMember(crewMemberId, {
        fullName,
        assignmentType,
        contactNumber,
        isActive,
      });
      if (!updateResult.ok && !browserLocal) {
        return NextResponse.json({ ok: false, code: updateResult.error, message: updateResult.error }, { status: 400 });
      }
      if (updateResult.ok) {
        updatedCrewMember = updateResult.crewMember;
      }
    }

    if (isActive !== undefined) {
      const statusResult = setFleetCrewActive(crewMemberId, isActive);
      if (!statusResult.ok && !browserLocal && !updatedCrewMember) {
        return NextResponse.json({ ok: false, code: statusResult.error, message: "Crew member not found." }, { status: 404 });
      }
      if (statusResult.ok) {
        updatedCrewMember = statusResult.crewMember;
      }
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: isActive !== undefined && fullName === undefined ? (isActive ? "crew.reactivated" : "crew.deactivated") : "crew.updated",
      entityType: "crew_member",
      entityId: crewMemberId,
      summary: `Updated crew member ${fullName ?? crewMemberId}.`,
      changes: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(fullName !== undefined ? { fullName } : {}),
        ...(assignmentType !== undefined ? { assignmentType } : {}),
        ...(contactNumber !== undefined ? { contactNumber } : {}),
      },
    });

    return NextResponse.json({ ok: true, crewMember: updatedCrewMember });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const updatePayload: Record<string, unknown> = {};
    if (isActive !== undefined) updatePayload.is_active = isActive;
    if (fullName !== undefined) updatePayload.full_name = fullName;
    if (assignmentType !== undefined) updatePayload.assignment_type = assignmentType;
    if (contactNumber !== undefined) updatePayload.contact_number = contactNumber;

    const { data, error } = await supabase
      .from("employees")
      .update(updatePayload)
      .eq("id", crewMemberId)
      .select("id, employee_code, full_name, assignment_type, contact_number, is_active")
      .maybeSingle();

    if (error) throw error;
    if (!data && !browserLocal) {
      return NextResponse.json({ ok: false, code: "CREW_MEMBER_NOT_FOUND", message: "Crew member not found." }, { status: 404 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: isActive !== undefined && fullName === undefined ? (isActive ? "crew.reactivated" : "crew.deactivated") : "crew.updated",
      entityType: "crew_member",
      entityId: crewMemberId,
      summary: `Updated crew member ${fullName ?? crewMemberId}.`,
      changes: updatePayload,
    });

    const updatedCrewMember: FleetCrewMember | null = data
      ? {
          id: data.id,
          employeeCode: data.employee_code ?? "",
          fullName: data.full_name,
          assignmentType: data.assignment_type,
          contactNumber: data.contact_number,
          isActive: data.is_active ?? true,
        }
      : null;

    return NextResponse.json({ ok: true, crewMember: updatedCrewMember });
  } catch (error) {
    return NextResponse.json({ ok: false, code: "CREW_STATUS_UPDATE_FAILED", message: error instanceof Error ? error.message : "Unable to update crew member." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await verifyServerPermission("profitability:manage");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, message: auth.message }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const browserLocal = searchParams.get("browserLocal") === "true";
  if (!id) {
    return NextResponse.json({ ok: false, code: "MISSING_ID", message: "Crew member ID is required." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    const result = deleteFleetCrewMember(id);
    if (!result.ok && !browserLocal) {
      return NextResponse.json({ ok: false, code: result.error, message: "Crew member not found." }, { status: 404 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "crew.deleted",
      entityType: "crew_member",
      entityId: id,
      summary: `Deleted crew member ${id}.`,
      changes: { deleted: true },
    });

    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) throw error;

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "crew.deleted",
      entityType: "crew_member",
      entityId: id,
      summary: `Deleted crew member ${id}.`,
      changes: { deleted: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: "CREW_DELETE_FAILED", message: error instanceof Error ? error.message : "Unable to delete crew member." },
      { status: 500 },
    );
  }
}
