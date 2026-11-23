import { NextResponse } from "next/server";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { resetSmallMockDatabase } from "@/features/deliveries/small-mock-repository";
import { resetCompanyExpensesStore } from "@/features/finance/server/company-expense-repository";
import {
  SMALL_MOCK_COMPANY_EXPENSES,
  SMALL_MOCK_DATABASE,
} from "@/features/deliveries/small-mock-database";
import { isSupabaseAdminConfigured } from "@/lib/config/env";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await verifyServerPermission("settings:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  // 1. Reset file-based and in-memory delivery & finance mock repositories
  resetSmallMockDatabase();
  resetCompanyExpensesStore();

  // 2. If Supabase is configured with Admin privileges, clear and repopulate tables
  let supabaseSeeded = false;
  if (isSupabaseAdminConfigured()) {
    try {
      const admin = createAdminSupabaseClient();
      await admin.from("delivery_documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("delivery_dropoffs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("deliveries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("company_expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      const expenseInserts = SMALL_MOCK_COMPANY_EXPENSES.map((exp) => ({
        id: exp.id,
        description: exp.description,
        amount: exp.amount,
        expense_date: exp.expenseDate,
        category: exp.category,
        notes: exp.notes,
        created_by: exp.createdBy,
        created_at: exp.createdAt,
        updated_at: exp.updatedAt,
      }));
      await admin.from("company_expenses").insert(expenseInserts);

      const deliveryInserts = SMALL_MOCK_DATABASE.deliveries.map(({ record, clientId, truckId, driverId, helperId }) => ({
        id: record.id,
        waybill_number: record.waybillNumber,
        delivery_date: record.deliveryDate,
        client_id: clientId,
        truck_id: truckId,
        truck_type_snapshot: record.truckType,
        truck_temperature_snapshot: record.truckTemperature,
        origin: record.origin,
        distance_km: record.distanceKm,
        fuel_rate: record.fuelRate,
        delivery_rate: record.deliveryRate,
        pod_status: record.podStatus,
        driver_id: driverId,
        helper_id: helperId,
        delivery_status: "Completed",
        version: 1,
        financial_state: record.financialState,
      }));
      await admin.from("deliveries").insert(deliveryInserts);
      supabaseSeeded = true;
    } catch (err) {
      console.warn("Supabase database refresh notice:", err);
    }
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "database.refreshed",
    entityType: "database",
    entityId: "delivery_and_finance",
    summary: `Administrator @${auth.actor.username} refreshed the Delivery and Finance databases to original seed state.`,
    changes: {
      deliveriesCount: SMALL_MOCK_DATABASE.deliveries.length,
      companyExpensesCount: SMALL_MOCK_COMPANY_EXPENSES.length,
      supabaseSeeded,
      refreshedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Delivery and Finance databases have been cleared and repopulated successfully.",
    deliveriesCount: SMALL_MOCK_DATABASE.deliveries.length,
    companyExpensesCount: SMALL_MOCK_COMPANY_EXPENSES.length,
    supabaseSeeded,
  });
}
