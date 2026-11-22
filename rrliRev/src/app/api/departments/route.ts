import { NextResponse } from "next/server";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import {
  archiveDepartment,
  createDepartment,
  duplicateDepartment,
  findDepartmentById,
  listDepartments,
  restoreDepartment,
  updateDepartment,
} from "@/lib/auth/department-store";
import { type Permission } from "@/lib/auth/rbac";
import { verifyServerPermission, verifySuperadminOnly } from "@/lib/auth/server-session";

export async function GET(request: Request) {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const departments = listDepartments(includeArchived);
  return NextResponse.json({ ok: true, departments });
}

export async function POST(request: Request) {
  const auth = await verifySuperadminOnly();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const action = typeof rawBody?.action === "string" ? rawBody.action : "create";

  if (action === "duplicate") {
    const sourceDepartmentId = typeof rawBody?.sourceDepartmentId === "string" ? rawBody.sourceDepartmentId : "";
    const name = typeof rawBody?.name === "string" ? rawBody.name.trim() : "";
    const description = typeof rawBody?.description === "string" ? rawBody.description.trim() : "";

    if (!sourceDepartmentId || !name) {
      return NextResponse.json(
        { ok: false, message: "Source department ID and new department name are required." },
        { status: 400 },
      );
    }

    const res = duplicateDepartment(sourceDepartmentId, name, description);
    if (!res.ok) {
      return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "department.duplicated",
      entityType: "department",
      entityId: res.department.id,
      summary: `Superadmin @${auth.actor.username} duplicated department ${sourceDepartmentId} into '${name}'.`,
      changes: { sourceDepartmentId, newDepartmentId: res.department.id, name },
    });

    return NextResponse.json({ ok: true, department: res.department }, { status: 201 });
  }

  // Normal create
  const name = typeof rawBody?.name === "string" ? rawBody.name.trim() : "";
  const description = typeof rawBody?.description === "string" ? rawBody.description.trim() : "";
  const defaultPermissions = Array.isArray(rawBody?.defaultPermissions)
    ? (rawBody.defaultPermissions as Permission[])
    : [];

  if (!name) {
    return NextResponse.json({ ok: false, message: "Department name is required." }, { status: 400 });
  }

  const res = createDepartment({ name, description, defaultPermissions });
  if (!res.ok) {
    return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "department.created",
    entityType: "department",
    entityId: res.department.id,
    summary: `Superadmin @${auth.actor.username} created department '${name}'.`,
    changes: { name, description, defaultPermissions },
  });

  return NextResponse.json({ ok: true, department: res.department }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const action = typeof rawBody?.action === "string" ? rawBody.action : "update";
  const departmentId = typeof rawBody?.departmentId === "string" ? rawBody.departmentId : "";

  if (!departmentId) {
    return NextResponse.json({ ok: false, message: "Department ID is required." }, { status: 400 });
  }

  // Superadmin protection: only Superadmin can edit or archive the Admin role
  if (departmentId === "admin" || departmentId === "superadmin") {
    if (!auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, message: "Access Denied: Only Superadmin (President) can modify the Admin role." },
        { status: 403 },
      );
    }
  }

  // Built-in roles cannot be archived
  if (action === "archive") {
    if (["admin", "operations", "finance", "hr", "secretary", "customer_representative"].includes(departmentId)) {
      return NextResponse.json(
        { ok: false, message: "Built-in roles cannot be archived or deleted." },
        { status: 400 },
      );
    }
    if (!auth.actor.isSuperadmin) {
      return NextResponse.json(
        { ok: false, message: "Only Superadmin can archive departments." },
        { status: 403 },
      );
    }
    const res = archiveDepartment(departmentId);
    if (!res.ok) {
      return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "department.archived",
      entityType: "department",
      entityId: departmentId,
      summary: `Superadmin @${auth.actor.username} archived department '${res.department.name}'.`,
      changes: { departmentId, isArchived: true },
    });

    return NextResponse.json({ ok: true, message: `Department '${res.department.name}' archived.`, department: res.department });
  }

  if (action === "restore") {
    const updatedPermissions = Array.isArray(rawBody?.defaultPermissions)
      ? (rawBody.defaultPermissions as Permission[])
      : undefined;

    const res = restoreDepartment(departmentId, updatedPermissions);
    if (!res.ok) {
      return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "department.restored",
      entityType: "department",
      entityId: departmentId,
      summary: `Superadmin @${auth.actor.username} restored department '${res.department.name}'.`,
      changes: { departmentId, isArchived: false, defaultPermissions: res.department.defaultPermissions },
    });

    return NextResponse.json({ ok: true, message: `Department '${res.department.name}' restored.`, department: res.department });
  }

  // Update details & permissions
  const existing = findDepartmentById(departmentId);
  if (!existing) {
    return NextResponse.json({ ok: false, message: "Department not found." }, { status: 404 });
  }

  const name = typeof rawBody?.name === "string" ? rawBody.name.trim() : undefined;
  const description = typeof rawBody?.description === "string" ? rawBody.description.trim() : undefined;
  const defaultPermissions = Array.isArray(rawBody?.defaultPermissions)
    ? (rawBody.defaultPermissions as Permission[])
    : undefined;

  // Authority check: Admin cannot grant permissions beyond their own authority
  if (defaultPermissions && !auth.actor.isSuperadmin) {
    const unauthorized = defaultPermissions.filter((p) => !auth.actor.permissions.includes(p));
    if (unauthorized.length > 0) {
      return NextResponse.json(
        { ok: false, message: `Cannot grant permissions beyond your own authority: ${unauthorized.join(", ")}` },
        { status: 403 },
      );
    }
  }

  const res = updateDepartment(departmentId, { name, description, defaultPermissions });
  if (!res.ok) {
    return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "department.updated",
    entityType: "department",
    entityId: departmentId,
    summary: `Superadmin @${auth.actor.username} updated department '${res.department.name}'.`,
    changes: { name, description, defaultPermissions },
  });

  return NextResponse.json({ ok: true, department: res.department });
}
