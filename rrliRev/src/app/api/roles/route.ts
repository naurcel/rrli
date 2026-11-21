import { NextResponse } from "next/server";

import {
  createCustomRole,
  deleteCustomRole,
  listCustomRoles,
  updateCustomRole,
} from "@/lib/auth/custom-role-store";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { USER_ROLES } from "@/lib/auth/rbac";

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
  const permissions = Array.isArray(raw.permissions) ? raw.permissions : [];

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

  const result = updateCustomRole(roleId, {
    name: typeof raw.name === "string" ? raw.name : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    permissions: Array.isArray(raw.permissions) ? raw.permissions : undefined,
    isEnabled: typeof raw.isEnabled === "boolean" ? raw.isEnabled : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 422 });
  }

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

  return NextResponse.json({ ok: true });
}
