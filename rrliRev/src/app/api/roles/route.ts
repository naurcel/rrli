import { NextResponse } from "next/server";

import {
  createCustomRole,
  deleteCustomRole,
  listCustomRoles,
  updateCustomRole,
} from "@/lib/auth/custom-role-store";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { USER_ROLES, type Permission } from "@/lib/auth/rbac";
import { recordAuditEntry } from "@/lib/audit/server-audit-store";

export async function GET() {
  const auth = await verifyServerPermission("settings:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const customRoles = listCustomRoles(true);
  return NextResponse.json({ ok: true, customRoles });
}

export async function POST(request: Request) {
  const auth = await verifyServerPermission("settings:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON request payload." },
      { status: 400 },
    );
  }

  const raw = body as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const permissions = Array.isArray(raw.permissions) ? (raw.permissions as Permission[]) : [];

  if (!name) {
    return NextResponse.json(
      { ok: false, message: "Role name is required." },
      { status: 422 },
    );
  }

  // Check if name collides with built-in roles
  if (USER_ROLES.some((r) => r.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json(
      { ok: false, message: `"${name}" is a protected built-in role name.` },
      { status: 422 },
    );
  }

  // Custom roles cannot be granted protected role-management authority
  if (permissions.includes("users:manage")) {
    return NextResponse.json(
      { ok: false, message: "Custom roles cannot be granted protected role-management authority (users:manage)." },
      { status: 403 },
    );
  }

  // Creator authority: cannot grant permissions beyond creator's own authority
  if (!auth.actor.isSuperadmin) {
    const unauthorized = permissions.filter((p) => !auth.actor.permissions.includes(p));
    if (unauthorized.length > 0) {
      return NextResponse.json(
        { ok: false, message: `Cannot grant permissions beyond your own authority: ${unauthorized.join(", ")}` },
        { status: 403 },
      );
    }
  }

  const creatorName = auth.actor?.fullName || auth.actor?.username || "Admin";
  const result = createCustomRole({
    name,
    description,
    permissions,
    createdBy: creatorName,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 422 });
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "role.created",
    entityType: "role",
    entityId: result.role.id,
    summary: `@${auth.actor.username} created custom role '${name}'.`,
    changes: { name, description, permissions },
  });

  return NextResponse.json({ ok: true, role: result.role }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await verifyServerPermission("settings:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON request payload." },
      { status: 400 },
    );
  }

  const raw = body as Record<string, unknown>;
  const roleId = typeof raw.roleId === "string" ? raw.roleId.trim() : "";
  if (!roleId) {
    return NextResponse.json(
      { ok: false, message: "Role ID is required." },
      { status: 422 },
    );
  }

  // Permissions validation
  if (Array.isArray(raw.permissions)) {
    const perms = raw.permissions as Permission[];
    if (perms.includes("users:manage")) {
      return NextResponse.json(
        { ok: false, message: "Custom roles cannot be granted protected role-management authority (users:manage)." },
        { status: 403 },
      );
    }

    if (!auth.actor.isSuperadmin) {
      const unauthorized = perms.filter((p) => !auth.actor.permissions.includes(p));
      if (unauthorized.length > 0) {
        return NextResponse.json(
          { ok: false, message: `Cannot grant permissions beyond your own authority: ${unauthorized.join(", ")}` },
          { status: 403 },
        );
      }
    }
  }

  const result = updateCustomRole(roleId, {
    name: typeof raw.name === "string" ? raw.name : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    permissions: Array.isArray(raw.permissions) ? (raw.permissions as Permission[]) : undefined,
    isEnabled: typeof raw.isEnabled === "boolean" ? raw.isEnabled : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 422 });
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "role.updated",
    entityType: "role",
    entityId: roleId,
    summary: `@${auth.actor.username} updated custom role '${result.role.name}'.`,
    changes: {
      name: raw.name,
      description: raw.description,
      permissions: raw.permissions,
      isEnabled: raw.isEnabled,
    },
  });

  return NextResponse.json({ ok: true, role: result.role });
}

export async function DELETE(request: Request) {
  const auth = await verifyServerPermission("settings:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON request payload." },
      { status: 400 },
    );
  }

  const raw = body as Record<string, unknown>;
  const roleId = typeof raw.roleId === "string" ? raw.roleId.trim() : "";
  const assignedUserCount = typeof raw.assignedUserCount === "number" ? raw.assignedUserCount : 0;

  if (!roleId) {
    return NextResponse.json(
      { ok: false, message: "Role ID is required." },
      { status: 422 },
    );
  }

  const result = deleteCustomRole(roleId, assignedUserCount);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 422 });
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "role.deleted",
    entityType: "role",
    entityId: roleId,
    summary: `@${auth.actor.username} deleted custom role '${roleId}'.`,
  });

  return NextResponse.json({ ok: true });
}
