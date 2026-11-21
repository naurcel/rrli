"use client";

export type DeliveryFlagCategory = "missing_document" | "attention_needed" | "general_note";

export type DeliveryAttentionFlag = {
  id: string;
  deliveryId: string;
  text: string;
  category: DeliveryFlagCategory;
  createdAt: string; // ISO string
  createdBy: string; // e.g. "aidzz" or "Operations"
  resolved: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
};

const STORAGE_KEY = "routex-delivery-flags-v1";
export const DELIVERY_FLAGS_CHANGED_EVENT = "routex:delivery-flags-changed";

export const PRESET_FLAG_SUGGESTIONS = [
  { label: "Missing Gate Pass", category: "missing_document" as const, text: "Awaiting security gate pass copy" },
  { label: "Client Receiving Copy", category: "missing_document" as const, text: "Awaiting signed client receiving copy" },
  { label: "Return Slip (RTV)", category: "missing_document" as const, text: "Waiting for Return to Vendor (RTV) slip" },
  { label: "Fuel Receipt Copy", category: "missing_document" as const, text: "Pending physical fuel replenishment receipt" },
  { label: "Incident / Dent Report", category: "attention_needed" as const, text: "Follow up on trip incident / transit inspection note" },
  { label: "BIR 2307 Certificate", category: "missing_document" as const, text: "Awaiting BIR 2307 withholding certificate" },
];

function readAllStoredFlags(): Record<string, DeliveryAttentionFlag[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllStoredFlags(data: Record<string, DeliveryAttentionFlag[]>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(DELIVERY_FLAGS_CHANGED_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

export function getDeliveryAttentionFlags(deliveryId: string): DeliveryAttentionFlag[] {
  if (!deliveryId) return [];
  const all = readAllStoredFlags();
  return all[deliveryId] ?? [];
}

export function addDeliveryAttentionFlag(
  deliveryId: string,
  text: string,
  options: {
    category?: DeliveryFlagCategory;
    createdBy?: string;
  } = {},
): DeliveryAttentionFlag {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error("Attention flag text cannot be empty.");
  }

  const all = readAllStoredFlags();
  const current = all[deliveryId] ?? [];
  const newFlag: DeliveryAttentionFlag = {
    id: `flag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    deliveryId,
    text: cleanText,
    category: options.category ?? "missing_document",
    createdAt: new Date().toISOString(),
    createdBy: options.createdBy?.trim() || "Operations",
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
  };

  all[deliveryId] = [newFlag, ...current];
  writeAllStoredFlags(all);
  return newFlag;
}

export function toggleDeliveryAttentionFlag(
  deliveryId: string,
  flagId: string,
  resolvedBy?: string,
): DeliveryAttentionFlag | null {
  const all = readAllStoredFlags();
  const list = all[deliveryId] ?? [];
  const index = list.findIndex((f) => f.id === flagId);
  if (index === -1) return null;

  const target = list[index];
  const nextResolved = !target.resolved;
  const updated: DeliveryAttentionFlag = {
    ...target,
    resolved: nextResolved,
    resolvedAt: nextResolved ? new Date().toISOString() : null,
    resolvedBy: nextResolved ? resolvedBy?.trim() || "Operations" : null,
  };

  list[index] = updated;
  all[deliveryId] = [...list];
  writeAllStoredFlags(all);
  return updated;
}

export function deleteDeliveryAttentionFlag(deliveryId: string, flagId: string): boolean {
  const all = readAllStoredFlags();
  const list = all[deliveryId] ?? [];
  const filtered = list.filter((f) => f.id !== flagId);
  if (filtered.length === list.length) return false;

  all[deliveryId] = filtered;
  writeAllStoredFlags(all);
  return true;
}

export function countUnresolvedDeliveryAttentionFlags(deliveryId: string): number {
  const flags = getDeliveryAttentionFlags(deliveryId);
  return flags.filter((f) => !f.resolved).length;
}
