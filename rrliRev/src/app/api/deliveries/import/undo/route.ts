import { NextResponse } from "next/server";
import * as z from "zod";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { getServiceRoleKey, isSupabaseConfigured } from "@/lib/config/env";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  dynamicMockDeliveries,
  savePersistedMockDeliveries,
} from "@/features/deliveries/small-mock-repository";

const undoBatchSchema = z.object({
  batchName: z.string().optional(),
  waybillNumbers: z.array(z.string().trim().min(1)).min(1, "At least one waybill number is required."),
});

async function getMutationSupabaseClient() {
  const serviceRoleKey = getServiceRoleKey();
  if (serviceRoleKey) {
    return createAdminSupabaseClient();
  }
  return await createServerSupabaseClient();
}

/**
 * POST /api/deliveries/import/undo
 * Undoes / rolls back a committed batch of imported deliveries by waybill numbers.
 * Enforces `imports:upload` server-side permission.
 */
export async function POST(request: Request) {
  const auth = await verifyServerPermission("imports:upload");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = undoBatchSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid undo payload.",
      },
      { status: 400 },
    );
  }

  const { batchName, waybillNumbers } = parsed.data;
  const removedWaybills: string[] = [];
  let removedCount = 0;

  // 1. Remove from local file/memory mock persistence
  const initialDynCount = dynamicMockDeliveries.length;
  const waybillSet = new Set(waybillNumbers);
  for (let i = dynamicMockDeliveries.length - 1; i >= 0; i--) {
    if (waybillSet.has(dynamicMockDeliveries[i].record.waybillNumber)) {
      removedWaybills.push(dynamicMockDeliveries[i].record.waybillNumber);
      dynamicMockDeliveries.splice(i, 1);
    }
  }
  if (dynamicMockDeliveries.length !== initialDynCount) {
    savePersistedMockDeliveries();
  }

  // 2. Remove from Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getMutationSupabaseClient();

      const { data: deliveries, error: selectError } = await supabase
        .from("deliveries")
        .select("id, waybill_number")
        .in("waybill_number", waybillNumbers);

      if (!selectError && deliveries && deliveries.length > 0) {
        const ids = deliveries.map((d) => d.id);
        for (const d of deliveries) {
          if (!removedWaybills.includes(d.waybill_number)) {
            removedWaybills.push(d.waybill_number);
          }
        }

        // Delete cascading child records
        await supabase.from("delivery_dropoffs").delete().in("delivery_id", ids);
        await supabase.from("delivery_activity").delete().in("delivery_id", ids);
        await supabase.from("delivery_mutation_requests").delete().in("delivery_id", ids);
        await supabase.from("delivery_documents").delete().in("delivery_id", ids);

        // Delete parent deliveries
        const { error: delError } = await supabase.from("deliveries").delete().in("id", ids);
        if (delError) {
          throw new Error(`Failed to delete deliveries: ${delError.message}`);
        }
      }
    } catch (dbErr) {
      console.warn("Supabase undo deliveries notice:", dbErr);
    }
  }

  removedCount = removedWaybills.length || waybillNumbers.length;

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "delivery.import_undone",
    entityType: "import_batch",
    entityId: batchName || "undo_batch",
    summary: `Undid import batch "${batchName || "Unnamed Batch"}": removed ${removedCount} deliveries.`,
    changes: { removedWaybills },
  });

  return NextResponse.json({
    ok: true,
    batchName,
    removedCount,
    removedWaybills,
  });
}
