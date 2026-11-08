import {
  deleteBrowserPreviewDelivery,
  readBrowserPreviewDeliveries,
} from "@/features/deliveries/browser-preview-deliveries";

export async function deleteDeliveryRecord(deliveryId: string): Promise<{
  source: "server" | "browser-local";
}> {
  const hasBrowserRecord = readBrowserPreviewDeliveries().some((item) => item.id === deliveryId);
  const params = new URLSearchParams({
    id: deliveryId,
    ...(hasBrowserRecord ? { browserLocal: "true" } : {}),
  });
  const response = await fetch(`/api/deliveries?${params.toString()}`, {
    method: "DELETE",
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    message?: string;
  } | null;

  if (response.ok && payload?.ok) {
    // Also emits the shared change event so dashboard/list hooks refetch.
    deleteBrowserPreviewDelivery(deliveryId);
    return { source: "server" };
  }

  // Local preview records can outlive the in-memory development repository.
  // Only treat a server 404 as a local deletion when the exact ID exists in storage.
  if (response.status === 404 && hasBrowserRecord) {
    deleteBrowserPreviewDelivery(deliveryId);
    return { source: "browser-local" };
  }

  throw new Error(payload?.message ?? "Could not delete delivery record.");
}
