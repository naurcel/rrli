import { NextResponse } from "next/server";

import { getVerifiedIdentity } from "@/lib/auth/verified-identity";
import { isSupabaseConfigured } from "@/lib/config/env";
import { getDeliveryCompletionRuntime } from "@/features/deliveries/completion/delivery-completion-runtime";

function statusForResult(code: string): number {
  if (code === "VALIDATION_FAILED") return 400;
  if (code === "FORBIDDEN") return 403;
  if (code === "NOT_FOUND") return 404;
  if (code === "CONFLICT") return 409;
  return 500;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ deliveryId: string }> },
) {
  const { deliveryId } = await context.params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "CONFIGURATION_ERROR",
          message: "Delivery completion is unavailable until the secure data service is configured.",
        },
      },
      { status: 503 },
    );
  }

  const identity = await getVerifiedIdentity();
  if (!identity) {
    return NextResponse.json(
      { error: { code: "AUTHENTICATION_REQUIRED", message: "You must sign in to continue." } },
      { status: 401 },
    );
  }

  const runtime = await getDeliveryCompletionRuntime();
  if (!runtime) {
    return NextResponse.json(
      {
        error: {
          code: "CONFIGURATION_ERROR",
          message: "Delivery completion is unavailable until the transactional delivery repository is configured.",
        },
      },
      { status: 503 },
    );
  }

  const actor = await runtime.resolveActor(identity);
  const body = await request.json().catch(() => null) as {
    expectedVersion?: unknown;
    idempotencyKey?: unknown;
  } | null;
  const result = await runtime.service.complete(actor, {
    deliveryId,
    expectedVersion: body?.expectedVersion as number,
    idempotencyKey: body?.idempotencyKey as string,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : statusForResult(result.code) });
}
