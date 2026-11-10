import { NextResponse } from "next/server";

import { getCompanyExpensesSummary } from "@/features/finance/server/company-expense-repository";
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
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  try {
    const summary = await getCompanyExpensesSummary(dateFrom, dateTo);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to compute company expense summary." },
      { status: 500 },
    );
  }
}
