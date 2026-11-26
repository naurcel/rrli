import { NextResponse } from "next/server";
import * as z from "zod";

import { verifyServerPermission } from "@/lib/auth/server-session";
import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import { isSupabaseConfigured, getServiceRoleKey } from "@/lib/config/env";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  deletedDeliveryIds,
  dynamicMockDeliveries,
  savePersistedMockDeliveries,
} from "@/features/deliveries/small-mock-repository";
import { SMALL_MOCK_DATABASE } from "@/features/deliveries/small-mock-database";
import { clearAllCompanyExpensesStore } from "@/features/finance/server/company-expense-repository";

const clearDataSchema = z.object({
  scope: z.enum(["deliveries", "transactions", "all"]),
  reason: z.string().trim().max(300).optional(),
});

async function getMutationSupabaseClient() {
  const serviceRoleKey = getServiceRoleKey();
  if (serviceRoleKey) {
    return createAdminSupabaseClient();
  }
  return await createServerSupabaseClient();
}

export async function POST(request: Request) {
  const auth = await verifyServerPermission("users:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  if (!auth.actor.isSuperadmin) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN_SUPERADMIN_ONLY",
        message: "Only the Superadmin (President) can clear system data.",
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = clearDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid clear-data request.",
      },
      { status: 400 },
    );
  }

  const { scope, reason } = parsed.data;
  const clearDeliveries = scope === "deliveries" || scope === "all";
  const clearTransactions = scope === "transactions" || scope === "all";

  if (clearDeliveries) {
    dynamicMockDeliveries.length = 0;
    for (const d of SMALL_MOCK_DATABASE.deliveries) {
      deletedDeliveryIds.add(d.record.id);
    }
    savePersistedMockDeliveries();
  }

  if (clearTransactions) {
    clearAllCompanyExpensesStore();
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await getMutationSupabaseClient();
      const NIL_UUID = "00000000-0000-0000-0000-000000000000";

      if (clearDeliveries) {
        await supabase.from("delivery_documents").delete().neq("id", NIL_UUID);
        await supabase.from("delivery_dropoffs").delete().neq("id", NIL_UUID);
        const { error: delErr } = await supabase.from("deliveries").delete().neq("id", NIL_UUID);
        if (delErr && !delErr.message.includes("schema cache") && !delErr.message.includes("does not exist")) {
          return NextResponse.json(
            { ok: false, code: "CLEAR_DELIVERIES_FAILED", message: delErr.message },
            { status: 500 },
          );
        }
      }

      if (clearTransactions) {
        const { error: expErr } = await supabase.from("company_expenses").delete().neq("id", NIL_UUID);
        if (expErr && !expErr.message.includes("schema cache") && !expErr.message.includes("does not exist")) {
          return NextResponse.json(
            { ok: false, code: "CLEAR_TRANSACTIONS_FAILED", message: expErr.message },
            { status: 500 },
          );
        }
      }
    } catch {
      // Mock store already cleared above
    }
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "system.data_cleared",
    entityType: "system",
    entityId: scope,
    summary: `Superadmin @${auth.actor.username} cleared ${
      scope === "all" ? "all deliveries and finance transactions" : `all ${scope}`
    }.${reason ? ` Reason: ${reason}` : ""}`,
    changes: { scope, reason: reason || null },
  });

  return NextResponse.json({
    ok: true,
    scope,
    clearedDeliveries: clearDeliveries,
    clearedTransactions: clearTransactions,
  });
}
