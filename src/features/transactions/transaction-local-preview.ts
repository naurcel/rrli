"use client";

const STORAGE_KEY = "routex-created-transaction-preview";
export const TRANSACTION_PREVIEW_UPDATED_EVENT = "routex-transaction-preview-updated";

export type CreatedTransactionPreview = {
  id: string;
  company: string;
  category: string;
  date: string;
  amount: string;
  status: "Pending";
  createdAt: string;
};

function isCreatedTransactionPreview(value: unknown): value is CreatedTransactionPreview {
  if (!value || typeof value !== "object") return false;
  const transaction = value as Record<string, unknown>;
  return typeof transaction.id === "string"
    && typeof transaction.company === "string"
    && typeof transaction.category === "string"
    && typeof transaction.date === "string"
    && typeof transaction.amount === "string"
    && transaction.status === "Pending"
    && typeof transaction.createdAt === "string";
}

export function readCreatedTransactions(): CreatedTransactionPreview[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isCreatedTransactionPreview) : [];
  } catch {
    return [];
  }
}

export function saveCreatedTransaction(transaction: CreatedTransactionPreview): void {
  const current = readCreatedTransactions().filter((item) => item.id !== transaction.id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([transaction, ...current]));
  window.dispatchEvent(new Event(TRANSACTION_PREVIEW_UPDATED_EVENT));
}
