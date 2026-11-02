import { NextResponse } from "next/server";
import * as z from "zod";

import { verifyServerPermission } from "@/lib/auth/server-session";
import { getSmallMockProfitabilitySummary } from "@/features/deliveries/small-mock-repository";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const querySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function GET(request: Request) {
  const auth = await verifyServerPermission("profitability:view");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, message: auth.message }, { status: auth.status });
  }
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    dateFrom: params.get("dateFrom"),
    dateTo: params.get("dateTo"),
  });
  if (!parsed.success || (parsed.data.dateFrom && parsed.data.dateTo && parsed.data.dateFrom > parsed.data.dateTo)) {
    return NextResponse.json({ ok: false, code: "INVALID_QUERY", message: "Invalid reporting date range." }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      source: "bundled-mock",
      summary: getSmallMockProfitabilitySummary(parsed.data),
    });
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("delivery_profitability_summary", {
    p_date_from: parsed.data.dateFrom,
    p_date_to: parsed.data.dateTo,
  });
  if (error) {
    return NextResponse.json({ ok: false, code: "SUMMARY_FAILED", message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, summary: data });
}
