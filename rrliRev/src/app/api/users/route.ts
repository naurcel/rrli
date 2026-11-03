import { NextResponse } from "next/server";

import {
  createUserAccountSchema,
  updateUserRoleSchema,
} from "@/lib/auth/auth-schemas";
import { getRoleMetadata, isValidUserRole, type UserRole } from "@/lib/auth/rbac";
import {
  createServerAccountProfile,
  listServerAccountProfiles,
  updateServerAccountProfile,
} from "@/lib/auth/server-account-store";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, is_active, created_at, updated_at")
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const users = (data ?? [])
        .filter((row) => isValidUserRole(row.role))
        .map((row) => {
          const meta = getRoleMetadata(row.role);
          return {
            id: row.id,
            email: row.email,
            fullName: row.full_name,
            role: row.role,
            roleLabel: meta.label,
            accessLevel: meta.accessLevel,
            accessLevelLabel: meta.accessLevelLabel,
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        });

      return NextResponse.json({ ok: true, users });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          code: "USER_QUERY_FAILED",
          message: err instanceof Error ? err.message : "Unable to load user accounts.",
        },
        { status: 500 },
      );
    }
  }

  const users = listServerAccountProfiles().map((profile) => {
    const meta = getRoleMetadata(profile.role);
    return {
      ...profile,
      roleLabel: meta.label,
      accessLevel: meta.accessLevel,
      accessLevelLabel: meta.accessLevelLabel,
    };
  });

  return NextResponse.json({ ok: true, users });
}

export async function POST(request: Request) {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createUserAccountSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Review user account details.",
      },
      { status: 400 },
    );
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("user_profiles")
        .insert({
          id: newId,
          email: parsed.data.email.trim().toLowerCase(),
          full_name: parsed.data.fullName.trim(),
          role: parsed.data.role,
          is_active: true,
          created_at: now,
          updated_at: now,
        })
        .select("id, email, full_name, role, is_active, created_at")
        .single();

      if (error) {
        const isConflict = error.code === "23505" || error.message.includes("unique");
        return NextResponse.json(
          {
            ok: false,
            code: isConflict ? "CONFLICT" : "USER_CREATION_FAILED",
            message: isConflict
              ? "An account with this email address already exists."
              : error.message,
          },
          { status: isConflict ? 409 : 400 },
        );
      }

      const meta = getRoleMetadata(data.role as UserRole);
      return NextResponse.json(
        {
          ok: true,
          user: {
            id: data.id,
            email: data.email,
            fullName: data.full_name,
            role: data.role,
            roleLabel: meta.label,
            accessLevel: meta.accessLevel,
            accessLevelLabel: meta.accessLevelLabel,
            isActive: data.is_active,
            createdAt: data.created_at,
          },
        },
        { status: 201 },
      );
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          code: "USER_CREATION_FAILED",
          message: err instanceof Error ? err.message : "Unable to create user.",
        },
        { status: 500 },
      );
    }
  }

  const created = createServerAccountProfile(parsed.data);
  if (!created.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "CONFLICT",
        message: created.message,
      },
      { status: 409 },
    );
  }

  const meta = getRoleMetadata(created.profile.role);
  return NextResponse.json(
    {
      ok: true,
      user: {
        ...created.profile,
        roleLabel: meta.label,
        accessLevel: meta.accessLevel,
        accessLevelLabel: meta.accessLevelLabel,
      },
    },
    { status: 201 },
  );
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
  const parsed = updateUserRoleSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid role update request.",
      },
      { status: 400 },
    );
  }

  if (parsed.data.userId === auth.actor.id) {
    if (parsed.data.isActive === false || (parsed.data.role && parsed.data.role !== "admin")) {
      return NextResponse.json(
        {
          ok: false,
          code: "SELF_LOCKOUT_PREVENTED",
          message: "You cannot deactivate or remove Admin access from your own active session.",
        },
        { status: 400 },
      );
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (parsed.data.role) updates.role = parsed.data.role;
      if (typeof parsed.data.isActive === "boolean") updates.is_active = parsed.data.isActive;

      const { data, error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("id", parsed.data.userId)
        .select("id, email, full_name, role, is_active, created_at, updated_at")
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { ok: false, code: "USER_UPDATE_FAILED", message: error.message },
          { status: 400 },
        );
      }

      if (!data) {
        return NextResponse.json(
          { ok: false, code: "NOT_FOUND", message: "The specified user account was not found." },
          { status: 404 },
        );
      }

      const meta = getRoleMetadata(data.role as UserRole);
      return NextResponse.json({
        ok: true,
        user: {
          id: data.id,
          email: data.email,
          fullName: data.full_name,
          role: data.role,
          roleLabel: meta.label,
          accessLevel: meta.accessLevel,
          accessLevelLabel: meta.accessLevelLabel,
          isActive: data.is_active,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          code: "USER_UPDATE_FAILED",
          message: err instanceof Error ? err.message : "Unable to update user profile.",
        },
        { status: 500 },
      );
    }
  }

  const updated = updateServerAccountProfile(parsed.data);
  if (!updated.ok) {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", message: updated.message },
      { status: 404 },
    );
  }

  const meta = getRoleMetadata(updated.profile.role);
  return NextResponse.json({
    ok: true,
    user: {
      ...updated.profile,
      roleLabel: meta.label,
      accessLevel: meta.accessLevel,
      accessLevelLabel: meta.accessLevelLabel,
    },
  });
}

