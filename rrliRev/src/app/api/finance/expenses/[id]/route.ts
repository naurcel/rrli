import { NextResponse } from "next/server";

import { validateCompanyExpenseInput } from "@/features/finance/company-expense-domain";
import {
  deleteCompanyExpense,
  getCompanyExpenseById,
  updateCompanyExpense,
} from "@/features/finance/server/company-expense-repository";
import { verifyServerPermission } from "@/lib/auth/server-session";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const auth = await verifyServerPermission("finance:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const { id } = await props.params;
  const expense = await getCompanyExpenseById(id);
  if (!expense) {
    return NextResponse.json(
      { ok: false, message: "Company expense not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, expense });
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const auth = await verifyServerPermission("finance:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const { id } = await props.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON request payload." },
      { status: 400 },
    );
  }

  const validation = validateCompanyExpenseInput(body);
  if (!validation.success) {
    return NextResponse.json(
      { ok: false, message: validation.errors[0], errors: validation.errors },
      { status: 422 },
    );
  }

  try {
    const actorEmail = auth.actor?.email ?? "operations@routex.local";
    const updated = await updateCompanyExpense(id, validation.data, actorEmail);
    if (!updated) {
      return NextResponse.json(
        { ok: false, message: "Company expense not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, expense: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to update company expense." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const auth = await verifyServerPermission("finance:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const { id } = await props.params;
  let reason: string | undefined;
  try {
    const body = (await request.json()) as { reason?: string };
    reason = body?.reason;
  } catch {
    // Body is optional
  }

  try {
    const actorEmail = auth.actor?.email ?? "operations@routex.local";
    const deleted = await deleteCompanyExpense(id, actorEmail, reason);
    if (!deleted) {
      return NextResponse.json(
        { ok: false, message: "Company expense not found or already deleted." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, message: "Company expense deleted successfully." });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to delete company expense." },
      { status: 500 },
    );
  }
}
