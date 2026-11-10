import { NextResponse } from "next/server";

import { validateCompanyExpenseInput } from "@/features/finance/company-expense-domain";
import {
  createCompanyExpense,
  listCompanyExpenses,
  type CompanyExpenseQuery,
} from "@/features/finance/server/company-expense-repository";
import { verifyServerPermission } from "@/lib/auth/server-session";

export async function GET(request: Request) {
  const auth = await verifyServerPermission("finance:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const query: CompanyExpenseQuery = {
    search: searchParams.get("search") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    sort: (searchParams.get("sort") as CompanyExpenseQuery["sort"]) ?? undefined,
    direction: (searchParams.get("direction") as CompanyExpenseQuery["direction"]) ?? undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
    pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
  };

  try {
    const result = await listCompanyExpenses(query);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to list company expenses." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await verifyServerPermission("finance:manage");
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

  const validation = validateCompanyExpenseInput(body);
  if (!validation.success) {
    return NextResponse.json(
      { ok: false, message: validation.errors[0], errors: validation.errors },
      { status: 422 },
    );
  }

  try {
    const actorEmail = auth.actor?.email ?? "operations@routex.local";
    const expense = await createCompanyExpense(validation.data, actorEmail);
    return NextResponse.json({ ok: true, expense }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to record company expense." },
      { status: 500 },
    );
  }
}
