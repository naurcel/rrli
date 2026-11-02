"use client";

import { dashboardPreviewDeliveries, type DashboardDelivery } from "@/features/dashboard/dashboard-preview-data";

const STORAGE_KEY = "routex-created-delivery-preview";
export const DELIVERY_PREVIEW_UPDATED_EVENT = "routex-delivery-preview-updated";

export type CreatedDeliveryPreview = {
  id: string;
  client: string;
  truck: string;
  driver: string;
  completed: string;
  revenue: string;
  expenses?: string;
  pod: "Attached" | "Missing";
  podAttachmentName?: string;
  createdAt: string;
};

function toIsoDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

export function createdDeliveryToDashboardDelivery(delivery: CreatedDeliveryPreview): DashboardDelivery {
  const revenue = Number(delivery.revenue.replace(/[^\d.-]/g, "")) || 0;
  const expenses = Number(delivery.expenses?.replace(/[^\d.-]/g, "")) || 0;
  return {
    id: delivery.id,
    client: delivery.client,
    completedOn: toIsoDate(delivery.completed),
    truck: delivery.truck,
    driver: delivery.driver,
    revenue,
    expenses,
    pod: delivery.pod,
  };
}

export function mergeWithDashboardDeliveries(created: readonly CreatedDeliveryPreview[]): DashboardDelivery[] {
  return [...created.map(createdDeliveryToDashboardDelivery), ...dashboardPreviewDeliveries];
}

function isCreatedDeliveryPreview(value: unknown): value is CreatedDeliveryPreview {
  if (!value || typeof value !== "object") return false;
  const delivery = value as Record<string, unknown>;
  return typeof delivery.id === "string"
    && typeof delivery.client === "string"
    && typeof delivery.truck === "string"
    && typeof delivery.driver === "string"
    && typeof delivery.completed === "string"
    && typeof delivery.revenue === "string"
    && (delivery.pod === "Attached" || delivery.pod === "Missing")
    && typeof delivery.createdAt === "string";
}

export function readCreatedDeliveries(): CreatedDeliveryPreview[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isCreatedDeliveryPreview) : [];
  } catch {
    return [];
  }
}

export function saveCreatedDelivery(delivery: CreatedDeliveryPreview): void {
  const current = readCreatedDeliveries().filter((item) => item.id !== delivery.id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([delivery, ...current]));
  window.dispatchEvent(new Event(DELIVERY_PREVIEW_UPDATED_EVENT));
}
