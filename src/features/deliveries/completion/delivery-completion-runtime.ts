import "server-only";

import type { VerifiedIdentity } from "@/lib/auth/verified-identity";

import type {
  CompletionActor,
  DeliveryCompletionService,
} from "./delivery-completion-service";

/**
 * This is the only composition point for the production completion service.
 * It deliberately has no browser-preview fallback: a delivery must never be
 * marked complete in local storage or a client-only fixture.
 *
 * When the data model is approved, wire a Supabase/PostgreSQL transactional
 * repository and an active-workspace-member permission resolver here.
 */
export type DeliveryCompletionRuntime = {
  service: DeliveryCompletionService;
  resolveActor(identity: VerifiedIdentity): Promise<CompletionActor | null>;
};

export async function getDeliveryCompletionRuntime(): Promise<DeliveryCompletionRuntime | null> {
  return null;
}
