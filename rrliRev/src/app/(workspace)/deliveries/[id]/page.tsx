"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuthenticatedActor } from "@/components/auth-context";
import { ConfirmDeliveryDeletionDialog } from "@/components/confirm-delivery-deletion-dialog";
import { DeliveryDropoffTimeline } from "@/components/delivery-dropoff-timeline";
import { DeliveryFinancialBreakdown } from "@/components/delivery-financial-breakdown";
import { DeliveryNavigator } from "@/components/delivery-navigator";
import { DeliverySupportingDocumentsPane } from "@/components/delivery-supporting-documents-pane";
import { DeliveryTruckTripSection } from "@/components/delivery-truck-trip-section";
import { DeliveryAttentionFlags } from "@/components/delivery-attention-flags";
import {
  countUnresolvedDeliveryAttentionFlags,
  DELIVERY_FLAGS_CHANGED_EVENT,
} from "@/features/deliveries/delivery-attention-flags";
import {
  isDateInRange,
  parseDateValue,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { ImageViewerModal } from "@/components/image-viewer-modal";
import { OperationalTopbar } from "@/components/operational-topbar";
import { generateMockPodSvgReceipt } from "@/features/deliveries/pod-utils";
import {
  derivePodVerificationStatus,
  type DeliveryStoreDropoff,
  getTripTotalDropoffs,
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
} from "@/features/deliveries/delivery-domain";
import { deleteDeliveryRecord } from "@/features/deliveries/delivery-deletion-client";
import { sortDeliveryLedgerItems } from "@/features/deliveries/delivery-sort";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  BROWSER_PREVIEW_DELIVERIES_CHANGED,
  readBrowserPreviewDeliveries,
  upsertBrowserPreviewDelivery,
} from "@/features/deliveries/browser-preview-deliveries";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { canManageDocuments, canMutateDeliveryRecords } from "@/lib/auth/rbac";
import { formatPeso } from "@/lib/format";
import {
  resolveReturnTarget,
  withReturnContext,
} from "@/lib/navigation/return-context";

export default function DeliveryDetailsPageWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="loading-state">Loading delivery details…</div>}>
      <DeliveryDetailsPageContent params={params} />
    </Suspense>
  );
}

function DeliveryDetailsPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const actor = useAuthenticatedActor();
  const canWrite = canMutateDeliveryRecords(actor.role);
  const canManageDocs = canManageDocuments(actor.role);

  const { id } = use(params);
  let decodedId = id;
  try {
    decodedId = decodeURIComponent(id);
  } catch {
    // Keep raw id if decoding fails
  }
  const normalizedId = decodedId.trim();

  const { range } = useGlobalDateRange();

  // Read filter, sort, and context passed from the caller (Deliveries ledger, Truck Details, Dashboard, etc.)
  const fromSource = searchParams.get("from");
  const singleTruckParam = searchParams.get("truck");
  const isFromTruck = fromSource === "truck" || Boolean(singleTruckParam && fromSource !== "deliveries");
  const isFromDashboard = fromSource === "dashboard";
  const isAttentionMode = searchParams.get("attention") === "1";
  const returnToParam = searchParams.get("returnTo");
  const returnLabelParam = searchParams.get("returnLabel");

  const dateFromParam = searchParams.get("dateFrom");
  const dateToParam = searchParams.get("dateTo");

  // Effective reporting range: prefer explicitly passed date range from URL, fallback to global
  const effectiveRange = useMemo(() => {
    if (dateFromParam || dateToParam) {
      return {
        startDate: dateFromParam ? parseDateValue(dateFromParam) : null,
        endDate: dateToParam ? parseDateValue(dateToParam) : null,
      };
    }
    return range;
  }, [dateFromParam, dateToParam, range]);

  const { deliveries: allDeliveries, loading: deliveriesLoading } = usePersistedDeliveries(effectiveRange, { allPages: true });

  const [delivery, setDelivery] = useState<DeliveryLedgerItem | null>(null);
  const [deliveryToDelete, setDeliveryToDelete] = useState<DeliveryLedgerItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [unresolvedFlagCount, setUnresolvedFlagCount] = useState(0);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [viewingImage, setViewingImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    filename?: string;
  } | null>(null);

  useEffect(() => {
    if (!delivery?.id) return;
    function updateCount() {
      if (delivery) {
        setUnresolvedFlagCount(countUnresolvedDeliveryAttentionFlags(delivery.id));
      }
    }
    updateCount();
    window.addEventListener(DELIVERY_FLAGS_CHANGED_EVENT, updateCount);
    window.addEventListener("storage", updateCount);
    return () => {
      window.removeEventListener(DELIVERY_FLAGS_CHANGED_EVENT, updateCount);
      window.removeEventListener("storage", updateCount);
    };
  }, [delivery?.id]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("updated") === "1" || params.get("updated") === "true") {
        setFeedbackMessage("Delivery updated successfully.");
        toast.success("Delivery updated", {
          description: "Trip changes saved successfully.",
        });
        params.delete("updated");
        const remaining = params.toString();
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${remaining ? `?${remaining}` : ""}`,
        );
      }
    }
  }, []);

  // Sync active delivery when id or allDeliveries changes, prioritizing the latest version
  useEffect(() => {
    const previewMatched = readBrowserPreviewDeliveries().find(
      (d) => d.id === normalizedId || d.waybillNumber === normalizedId,
    );
    const repoMatched = allDeliveries.find(
      (d) => d.id === normalizedId || d.waybillNumber === normalizedId,
    );

    let matched: DeliveryLedgerItem | undefined;
    if (previewMatched && repoMatched) {
      matched =
        (previewMatched.version ?? 1) >= (repoMatched.version ?? 1)
          ? previewMatched
          : repoMatched;
    } else {
      matched = previewMatched ?? repoMatched;
    }

    if (matched) {
      setDelivery(matched);
      return;
    }

    // 2. Fallback to direct API lookup if not in preview list
    if (!deliveriesLoading) {
      let isMounted = true;
      fetch(`/api/deliveries?search=${encodeURIComponent(normalizedId)}&pageSize=10`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted) return;
          const found = (data?.items as DeliveryLedgerItem[] | undefined)?.find(
            (d) => d.id === normalizedId || d.waybillNumber === normalizedId,
          );
          if (found) {
            setDelivery(found);
            upsertBrowserPreviewDelivery(found);
          } else {
            setDelivery(null);
          }
        })
        .catch(() => {
          if (isMounted) setDelivery(null);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [allDeliveries, deliveriesLoading, normalizedId]);

  // Reactive listener for local delivery edits across tabs and preview cache
  useEffect(() => {
    function handlePreviewDeliveriesChanged() {
      const updated = readBrowserPreviewDeliveries().find(
        (d) => d.id === normalizedId || d.waybillNumber === normalizedId,
      );
      if (updated) {
        setDelivery(updated);
      }
    }
    window.addEventListener(BROWSER_PREVIEW_DELIVERIES_CHANGED, handlePreviewDeliveriesChanged);
    return () => {
      window.removeEventListener(BROWSER_PREVIEW_DELIVERIES_CHANGED, handlePreviewDeliveriesChanged);
    };
  }, [normalizedId]);

  // Read filter and sort context passed from the caller
  const searchQuery = searchParams.get("search") || searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "all";
  const sortParam = searchParams.get("sort") || "delivery_date:desc";
  const clientsFilter = useMemo(() => {
    const raw = searchParams.get("clients");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);
  const trucksFilter = useMemo(() => {
    const raw = searchParams.get("trucks");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);

  // Helper to normalize truck plate comparison
  function normalizePlate(p?: string | null): string {
    return (p ?? "").trim().replace(/[\s-]+/g, "").toUpperCase();
  }

  // Compute filtered and sorted deliveries for the Delivery Navigator
  const navigatorDeliveries = useMemo(() => {
    let list = [...allDeliveries];

    // If opened from a truck's delivery list, strictly filter to that truck only
    if (isFromTruck && singleTruckParam) {
      const cleanPlate = normalizePlate(singleTruckParam);
      list = list.filter((item) => normalizePlate(item.plateNumber) === cleanPlate);
    } else if (isFromDashboard && isAttentionMode) {
      // If opened from Dashboard Attention Needed, filter to incomplete deliveries
      list = list.filter((d) => isDeliveryIncomplete(d) || !isDeliveryFinanciallyComplete(d));
    } else {
      // If opened from Deliveries ledger, apply clients and trucks multi-filters
      if (clientsFilter.length > 0) {
        list = list.filter((d) => clientsFilter.includes(d.clientName) || clientsFilter.includes(d.clientId));
      }
      if (trucksFilter.length > 0) {
        list = list.filter((d) => {
          const itemPlate = normalizePlate(d.plateNumber);
          return trucksFilter.some((t) => normalizePlate(t) === itemPlate);
        });
      }
    }

    // Filter by date range if explicitly provided in query params
    if (dateFromParam || dateToParam) {
      list = list.filter((item) => isDateInRange(item.deliveryDate, effectiveRange));
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const waybill = (item.waybillNumber || "").toLowerCase();
        const client = (item.clientName || "").toLowerCase();
        const truck = (item.plateNumber || "").toLowerCase();
        const driver = (item.driverName || "").toLowerCase();
        const helper = (item.helperName || "").toLowerCase();
        const origin = (item.origin || "").toLowerCase();
        const stops = (item.dropoffs || []).some(
          (s) =>
            s.storeName.toLowerCase().includes(q) ||
            s.destinationArea.toLowerCase().includes(q),
        );
        return (
          waybill.includes(q) ||
          client.includes(q) ||
          truck.includes(q) ||
          driver.includes(q) ||
          helper.includes(q) ||
          origin.includes(q) ||
          stops
        );
      });
    }

    // Status filter
    if (statusFilter === "completed") {
      list = list.filter((d) => !isDeliveryIncomplete(d) && isDeliveryFinanciallyComplete(d));
    } else if (statusFilter === "incomplete") {
      list = list.filter((d) => isDeliveryIncomplete(d) || !isDeliveryFinanciallyComplete(d));
    }

    // Ensure currently selected delivery is included if it belongs to this truck/context
    if (delivery && !list.some((d) => d.id === delivery.id)) {
      if (!isFromTruck || normalizePlate(delivery.plateNumber) === normalizePlate(singleTruckParam)) {
        list.push(delivery);
      }
    }

    // Sort matching exact ledger/truck/dashboard list order
    const [sortField, direction] = sortParam.split(":") as [string, "asc" | "desc"];
    const sorted = sortDeliveryLedgerItems(list, sortField, direction || "desc");

    if (isFromDashboard && !isAttentionMode) {
      const topRecent = sorted.slice(0, 6);
      if (delivery && !topRecent.some((d) => d.id === delivery.id)) {
        topRecent.push(delivery);
      }
      return topRecent;
    }

    return sorted;
  }, [
    allDeliveries,
    clientsFilter,
    dateFromParam,
    dateToParam,
    delivery,
    effectiveRange,
    isAttentionMode,
    isFromDashboard,
    isFromTruck,
    searchQuery,
    singleTruckParam,
    sortParam,
    statusFilter,
    trucksFilter,
  ]);

  // Return URL and label preserving complete caller context
  const { href: backHref, label: backLabel } = useMemo(() => {
    let fallbackHref = "/deliveries";
    let fallbackLabel = "Back to Deliveries";

    if (isFromTruck && singleTruckParam) {
      const returnParams = new URLSearchParams();
      if (dateFromParam) returnParams.set("dateFrom", dateFromParam);
      if (dateToParam) returnParams.set("dateTo", dateToParam);
      const truckPage = searchParams.get("truckPage") || searchParams.get("page");
      if (truckPage && Number(truckPage) > 1) {
        returnParams.set("page", truckPage);
      }
      if (sortParam) {
        returnParams.set("sort", sortParam);
      }
      const qs = returnParams.toString();
      fallbackHref = `/truck-profitability/${encodeURIComponent(singleTruckParam)}${qs ? `?${qs}` : ""}`;
      fallbackLabel = `Back to ${singleTruckParam}`;
    } else if (isFromDashboard) {
      const dashParams = new URLSearchParams();
      if (dateFromParam) dashParams.set("dateFrom", dateFromParam);
      if (dateToParam) dashParams.set("dateTo", dateToParam);
      if (sortParam) dashParams.set("deliverySort", sortParam);
      const qs = dashParams.toString();
      fallbackHref = `/dashboard${qs ? `?${qs}` : ""}`;
      fallbackLabel = "Back to Dashboard";
    } else {
      const ledgerParams = new URLSearchParams(searchParams.toString());
      ledgerParams.delete("returnTo");
      ledgerParams.delete("returnLabel");
      ledgerParams.delete("from");
      const qs = ledgerParams.toString();
      fallbackHref = `/deliveries${qs ? `?${qs}` : ""}`;
      fallbackLabel = "Back to Deliveries";
    }

    return resolveReturnTarget({
      returnTo: returnToParam,
      returnLabel: returnLabelParam,
      fallbackHref,
      fallbackLabel,
    });
  }, [
    dateFromParam,
    dateToParam,
    isFromDashboard,
    isFromTruck,
    returnLabelParam,
    returnToParam,
    searchParams,
    singleTruckParam,
    sortParam,
  ]);

  const [switchDirection, setSwitchDirection] = useState<"next" | "prev" | "jump">("jump");

  function handleNavigateToDelivery(targetId: string, explicitDirection?: "next" | "prev" | "jump") {
    let dir = explicitDirection;
    if (!dir) {
      const currentIdx = navigatorDeliveries.findIndex(
        (d) => d.id === delivery?.id || d.waybillNumber === delivery?.id,
      );
      const targetIdx = navigatorDeliveries.findIndex(
        (d) => d.id === targetId || d.waybillNumber === targetId,
      );
      if (currentIdx !== -1 && targetIdx !== -1) {
        dir = targetIdx > currentIdx ? "next" : targetIdx < currentIdx ? "prev" : "jump";
      } else {
        dir = "jump";
      }
    }
    setSwitchDirection(dir);

    // Immediate reactive switch so the animation triggers smoothly without lag
    const nextDelivery =
      navigatorDeliveries.find((d) => d.id === targetId || d.waybillNumber === targetId) ??
      allDeliveries.find((d) => d.id === targetId || d.waybillNumber === targetId);

    if (nextDelivery) {
      setDelivery(nextDelivery);
    }

    // Preserve the exact query string context (caller, filters, sort, date range)
    const query = searchParams.toString();
    router.push(`/deliveries/${encodeURIComponent(targetId)}${query ? `?${query}` : ""}`, { scroll: false });
  }

  // Keyboard navigation for switching deliveries: Left/Right arrows and [/]
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (deliveryToDelete) {
        return;
      }

      const currentIndex = navigatorDeliveries.findIndex(
        (d) => d.id === delivery?.id || d.waybillNumber === delivery?.id,
      );
      if (currentIndex === -1) return;

      if ((e.key === "ArrowLeft" || e.key === "[") && currentIndex > 0) {
        e.preventDefault();
        handleNavigateToDelivery(navigatorDeliveries[currentIndex - 1].id, "prev");
      } else if (
        (e.key === "ArrowRight" || e.key === "]") &&
        currentIndex < navigatorDeliveries.length - 1
      ) {
        e.preventDefault();
        handleNavigateToDelivery(navigatorDeliveries[currentIndex + 1].id, "next");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [delivery?.id, delivery?.waybillNumber, deliveryToDelete, navigatorDeliveries]);

  async function handleConfirmDelete() {
    if (!deliveryToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteDeliveryRecord(deliveryToDelete.id);
      toast.success("Delivery deleted", {
        description: `Waybill #${deliveryToDelete.waybillNumber} was successfully deleted.`,
      });
      // Navigate back to the caller with preserved context
      router.push(backHref);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete delivery.";
      setDeleteError(msg);
      toast.error("Failed to delete delivery", {
        description: msg,
      });
      setIsDeleting(false);
    }
  }

  function handleTripUpdated(updatedTrip: DeliveryLedgerItem) {
    setDelivery(updatedTrip);
    upsertBrowserPreviewDelivery(updatedTrip);
    toast.success("Trip documents updated");
  }

  async function handleSaveNotes() {
    if (!delivery || savingNotes) return;
    setSavingNotes(true);
    const trimmed = noteDraft.trim() || null;
    const updatedTrip: DeliveryLedgerItem = {
      ...delivery,
      notes: trimmed,
      version: delivery.version + 1,
    };

    try {
      await fetch("/api/deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "correct_financials",
          deliveryId: delivery.id,
          expectedVersion: delivery.version,
          idempotencyKey: crypto.randomUUID(),
          reason: "Updated trip notes",
          changes: {
            notes: trimmed,
          },
          fallbackRecord: delivery,
        }),
      });
    } catch {
      // preview/offline fallback
    }

    setDelivery(updatedTrip);
    upsertBrowserPreviewDelivery(updatedTrip);
    setIsEditingNotes(false);
    setSavingNotes(false);
    toast.success(trimmed ? "Trip note saved" : "Trip note cleared", {
      description: `Waybill #${delivery.waybillNumber} notes updated.`,
    });
  }

  async function handleViewPod(stop: DeliveryStoreDropoff) {
    if (!delivery) return;
    try {
      const res = await fetch(`/api/deliveries/documents?deliveryId=${delivery.id}&dropoffId=${stop.id}`);
      const data = (await res.json().catch(() => null)) as { ok?: boolean; document?: { downloadUrl?: string; filename?: string } } | null;
      if (res.ok && data?.ok && data.document?.downloadUrl) {
        setViewingImage({
          url: data.document.downloadUrl,
          title: `Proof of Delivery · ${stop.storeName}`,
          subtitle: `Waybill #${delivery.waybillNumber} · Drop-off #${stop.sequence} (${stop.destinationArea})`,
          filename: stop.documentRef || data.document.filename || "pod.pdf",
        });
        return;
      }
    } catch {
      // fallback
    }
    const fallbackUrl = generateMockPodSvgReceipt(delivery, stop, stop.documentRef || "pod.pdf");
    setViewingImage({
      url: fallbackUrl,
      title: `Proof of Delivery Receipt · ${stop.storeName}`,
      subtitle: `Waybill #${delivery.waybillNumber} · Drop-off #${stop.sequence} (${stop.destinationArea})`,
      filename: stop.documentRef || "pod.svg",
    });
  }

  async function handleAttachPod(stopId: string, file: File) {
    if (!delivery) return;
    const stop = delivery.dropoffs.find((s) => s.id === stopId);
    const storeLabel = stop ? stop.storeName : `Stop`;

    try {
      const formData = new FormData();
      formData.append("deliveryId", delivery.id);
      formData.append("dropoffId", stopId);
      formData.append("action", "upload");
      formData.append("file", file);

      const response = await fetch("/api/deliveries/documents", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        document?: { filename?: string };
        dropoff?: Partial<DeliveryStoreDropoff>;
      } | null;

      const newFilename = payload?.dropoff?.documentRef ?? payload?.document?.filename ?? file.name;

      const nextDropoffs = delivery.dropoffs.map((s) => {
        if (s.id !== stopId) return s;
        return {
          ...s,
          podSubmitted: true,
          documentRef: newFilename,
        };
      });

      const updatedTrip: DeliveryLedgerItem = {
        ...delivery,
        version: delivery.version + 1,
        dropoffs: nextDropoffs,
        podStatus: derivePodVerificationStatus(nextDropoffs),
      };

      setDelivery(updatedTrip);
      upsertBrowserPreviewDelivery(updatedTrip);
      toast.success("POD attached", {
        description: `Attached ${file.name} to ${storeLabel}.`,
      });
    } catch {
      const nextDropoffs = delivery.dropoffs.map((s) => {
        if (s.id !== stopId) return s;
        return {
          ...s,
          podSubmitted: true,
          documentRef: file.name,
        };
      });

      const updatedTrip: DeliveryLedgerItem = {
        ...delivery,
        version: delivery.version + 1,
        dropoffs: nextDropoffs,
        podStatus: derivePodVerificationStatus(nextDropoffs),
      };

      setDelivery(updatedTrip);
      upsertBrowserPreviewDelivery(updatedTrip);
      toast.success("POD attached", {
        description: `Attached ${file.name} to ${storeLabel}.`,
      });
    }
  }

  // Not Found State
  if (!deliveriesLoading && !delivery) {
    return (
      <>
        <OperationalTopbar contextLabel="Deliveries / Record Not Found" showDateFilter={false} />
        <div className="content-wrap delivery-detail-page">
          <div className="delivery-detail-not-found records-card">
            <div className="not-found-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <h2>Delivery Record Not Found</h2>
            <p>
              The requested delivery record (<strong>{normalizedId}</strong>) could not be found. It may have been deleted or the link is invalid.
            </p>
            <Link href={backHref} className="primary-action-button">
              ← {backLabel}
            </Link>
          </div>
        </div>
      </>
    );
  }

  // Loading State
  if (!delivery) {
    return (
      <>
        <OperationalTopbar contextLabel="Deliveries / Loading" showDateFilter={false} />
        <div className="content-wrap delivery-detail-page">
          <div className="loading-state">Loading delivery record…</div>
        </div>
      </>
    );
  }

  const isIncomplete = isDeliveryIncomplete(delivery);
  const isFinanciallyComplete = isDeliveryFinanciallyComplete(delivery);
  const isComplete = !isIncomplete && isFinanciallyComplete;
  const totalDropoffs = getTripTotalDropoffs(delivery.dropoffs);

  return (
    <>
      <OperationalTopbar contextLabel={`Deliveries / Waybill #${delivery.waybillNumber}`} showDateFilter={false} />

      <div className="content-wrap delivery-detail-page">
        {/* Top Control Bar: Back Link + Compact Delivery Navigator */}
        <div className="delivery-detail-subnav">
          <Link
            href={backHref}
            className="delivery-back-link"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>{backLabel}</span>
          </Link>

          {navigatorDeliveries.length > 0 ? (
            <DeliveryNavigator
              currentDeliveryId={delivery.id}
              deliveries={navigatorDeliveries}
              onNavigate={handleNavigateToDelivery}
            />
          ) : null}
        </div>

        {/* Animated Delivery Details Container */}
        <div
          key={delivery.id}
          className={`delivery-detail-animated-content is-${switchDirection}`}
        >
          {/* Feedback Alert Banner */}
        {feedbackMessage ? (
          <div className="notice" role="status" style={{ marginBottom: "18px" }}>
            <span className="notice-icon" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <span>{feedbackMessage}</span>
              <button
                type="button"
                onClick={() => setFeedbackMessage(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}
              >
                ×
              </button>
            </div>
          </div>
        ) : null}

        {/* Delivery Hero Banner */}
        <header className="delivery-hero-card records-card">
          <div className="delivery-hero-main">
            <div className="delivery-hero-eyebrow-row">
              <span className="waybill-tag">WAYBILL #{delivery.waybillNumber}</span>
              <span className="delivery-date-tag">Date: {delivery.deliveryDate}</span>
              {delivery.recordingDelayed ? (
                <span className="late-recording-pill" title="Recorded past 2-day window">
                  Late Recording
                </span>
              ) : null}
            </div>

            <h1 className="delivery-hero-title">{delivery.clientName}</h1>

            <div className="delivery-hero-status-pills">
              <span
                className={`simple-hero-badge ${isComplete ? "positive" : "warning"}`}
                title={
                  !isComplete
                    ? `Incomplete: ${delivery.financialIntegrityIssues.join(", ") || "incomplete expenses"}`
                    : undefined
                }
              >
                {isComplete ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
                <span>{isComplete ? "Complete" : "Incomplete"}</span>
              </span>

              <span className="simple-hero-badge-sep">·</span>

              <span
                className={`simple-hero-badge ${delivery.podStatus === "Verified" ? "positive" : "warning"}`}
              >
                {delivery.podStatus === "Verified" ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
                <span>{delivery.podStatus === "Verified" ? "POD Attached" : "Missing POD"}</span>
              </span>

              <span className="simple-hero-badge-sep">·</span>

              <span className="simple-hero-badge neutral">
                {totalDropoffs} {totalDropoffs === 1 ? "Drop-off" : "Drop-offs"}
                {totalDropoffs !== delivery.dropoffs.length ? ` (${delivery.dropoffs.length} ${delivery.dropoffs.length === 1 ? "Location" : "Locations"})` : ""}
              </span>

              <span className="simple-hero-badge-sep">·</span>

              <span className="simple-hero-badge neutral">
                Version {delivery.version}
              </span>

              {unresolvedFlagCount > 0 ? (
                <>
                  <span className="simple-hero-badge-sep">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("delivery-attention-flags-card");
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="simple-hero-badge warning"
                    style={{
                      cursor: "pointer",
                      background: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: "6px",
                      padding: "2px 8px",
                      color: "var(--color-accent-deep, #b45309)",
                      fontWeight: 700,
                    }}
                    title="Click to view attention flags and missing items"
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                        <line x1="4" y1="22" x2="4" y2="15" />
                      </svg>
                      {unresolvedFlagCount} {unresolvedFlagCount === 1 ? "Item Needs Attention" : "Items Need Attention"}
                    </span>
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {canWrite ? (
            <div className="delivery-header-actions" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: "12px", padding: "5px 11px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                onClick={() => {
                  const el = document.getElementById("delivery-attention-flags-card");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  const input = el?.querySelector("input");
                  input?.focus();
                }}
                title="Flag missing document or attention item for this delivery"
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  Flag Item
                </span>
              </button>
              <button
                type="button"
                className="truck-action-icon-btn"
                aria-label={`Edit delivery #${delivery.waybillNumber}`}
                title="Edit delivery"
                onClick={() => {
                  const qs = searchParams.toString();
                  const currentUrl = `/deliveries/${encodeURIComponent(delivery.id)}${qs ? `?${qs}` : ""}`;
                  router.push(
                    withReturnContext(
                      `/deliveries/${encodeURIComponent(delivery.id)}/edit`,
                      currentUrl,
                      `Waybill #${delivery.waybillNumber}`,
                    ),
                  );
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
              {actor.role === "admin" && (
                <button
                  type="button"
                  className="truck-action-icon-btn danger"
                  aria-label={`Delete delivery #${delivery.waybillNumber}`}
                  title="Delete delivery"
                  onClick={() => {
                    setDeliveryToDelete(delivery);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              )}
            </div>
          ) : null}
        </header>

        {/* 1. Primary Financial Performance & Analytics Card (Full-Width, High Visibility) */}
        <section className="records-card delivery-section-card delivery-financial-analytics-card">
          <div className="section-card-header delivery-analytics-header">
            <div>
              <h2 className="section-card-title">Financial Breakdown</h2>
              <p className="section-card-subtitle">
                Trip revenue, expenses, and net profit
              </p>
            </div>
            <div className="delivery-analytics-badges" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isComplete && delivery.marginPercent != null ? (
                <span className="routex-badge tone-primary" style={{ fontWeight: 700 }}>
                  {delivery.marginPercent.toFixed(1)}% MARGIN
                </span>
              ) : null}
            </div>
          </div>
          <DeliveryFinancialBreakdown trip={delivery} />
        </section>

        {/* 2. Unified Vehicle & Trip Specifications Card */}
        <section className="records-card delivery-section-card delivery-truck-trip-card">
          <div className="section-card-header">
            <div>
              <h2 className="section-card-title">Truck &amp; Trip Information</h2>
              <p className="section-card-subtitle">
                Vehicle assignment, technical specifications, and trip routing parameters
              </p>
            </div>
          </div>
          <DeliveryTruckTripSection
            plateNumber={delivery.plateNumber}
            truckType={delivery.truckType}
            truckTemperature={delivery.truckTemperature}
            truckOwnership={delivery.truckOwnership}
            rateBasis={delivery.rateBasis}
            truckHref={withReturnContext(
              `/truck-profitability/${encodeURIComponent(delivery.plateNumber)}`,
              `/deliveries/${encodeURIComponent(delivery.id)}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
              `Waybill #${delivery.waybillNumber}`,
            )}
            clientName={delivery.clientName}
            origin={delivery.origin}
            distanceKm={delivery.distanceKm}
            fuelRate={delivery.fuelRate}
            deliveryDate={delivery.deliveryDate}
            formatPeso={formatPeso}
          />
        </section>

        {/* 2b. Operational Notes & Remarks Card */}
        <section className="records-card delivery-section-card delivery-notes-card">
          <div className="section-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 className="section-card-title">Trip Notes &amp; Remarks</h2>
              <p className="section-card-subtitle">
                Operational instructions, dispatch remarks, and road conditions
              </p>
            </div>
            {canWrite && !isEditingNotes && (
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: "12px", padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => {
                  setNoteDraft(delivery.notes ?? "");
                  setIsEditingNotes(true);
                }}
              >
                <span>{delivery.notes ? "Edit Note" : "+ Add Note"}</span>
              </button>
            )}
          </div>

          <div style={{ padding: "0 20px 20px" }}>
            {isEditingNotes ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <textarea
                  rows={3}
                  className="correction-reason-textarea"
                  style={{ width: "100%", resize: "vertical", fontSize: "13.5px", lineHeight: "1.5" }}
                  placeholder="Enter operational notes, special handling, or dispatch instructions for this delivery..."
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  autoFocus
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={savingNotes}
                    onClick={() => setIsEditingNotes(false)}
                    style={{ fontSize: "12px", padding: "6px 14px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-action-button"
                    disabled={savingNotes}
                    onClick={handleSaveNotes}
                    style={{ fontSize: "12px", padding: "6px 16px" }}
                  >
                    {savingNotes ? "Saving…" : "Save Note"}
                  </button>
                </div>
              </div>
            ) : delivery.notes ? (
              <div
                style={{
                  background: "var(--color-surface-subtle, rgba(0, 0, 0, 0.02))",
                  border: "1px solid var(--line, #e2e8f0)",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  fontSize: "13.5px",
                  lineHeight: "1.6",
                  color: "var(--color-text, #1e293b)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {delivery.notes}
              </div>
            ) : (
              <div
                style={{
                  color: "var(--color-text-muted, #64748b)",
                  fontSize: "13px",
                  fontStyle: "italic",
                  padding: "8px 0",
                }}
              >
                No operational notes recorded for this delivery trip.
              </div>
            )}
          </div>
        </section>

        {/* 3. Attention & Missing Items Card */}
        <DeliveryAttentionFlags
          deliveryId={delivery.id}
          waybillNumber={delivery.waybillNumber}
          canManage={canWrite}
          currentUser={actor.username || actor.email || "Operations"}
        />

        {/* 4. Unified Store Drop-offs & Documents Card (Scalable Bottom Section) */}
        <section
          className="records-card delivery-section-card delivery-fulfillment-unified-card"
          aria-label="Store Drop-offs and POD Documents"
        >
          <div className="section-card-header delivery-fulfillment-header">
            <div>
              <h2 className="section-card-title">
                Store Drop-offs &amp; Documents
              </h2>
              <p className="section-card-subtitle">
                Stop sequence, entry fees, and proof of delivery records
              </p>
            </div>
            <div className="delivery-fulfillment-summary-badges">
              <span className="routex-badge tone-primary">
                {totalDropoffs} {totalDropoffs === 1 ? "DROP-OFF" : "DROP-OFFS"}
              </span>
              {totalDropoffs !== delivery.dropoffs.length ? (
                <span className="routex-badge tone-neutral">
                  {delivery.dropoffs.length} {delivery.dropoffs.length === 1 ? "LOCATION" : "LOCATIONS"}
                </span>
              ) : null}
              <span
                className={`routex-badge ${
                  delivery.dropoffs.every((s) => s.podSubmitted) ? "tone-success" : "tone-warning"
                }`}
              >
                {delivery.dropoffs.filter((s) => s.podSubmitted).length}/{delivery.dropoffs.length} POD
              </span>
            </div>
          </div>

          <div className="delivery-fulfillment-split-grid">
            {/* Left Pane: Store Drop-offs Sequence & POD */}
            <div className="delivery-fulfillment-pane is-dropoffs">
              <div className="delivery-fulfillment-pane-header">
                <h3 className="delivery-fulfillment-pane-title">
                  Store Drop-offs &amp; POD ({totalDropoffs} across {delivery.dropoffs.length} {delivery.dropoffs.length === 1 ? "location" : "locations"})
                </h3>
                <span className="delivery-fulfillment-pane-hint">
                  Click drop-off to view POD document
                </span>
              </div>
              <div className="delivery-fulfillment-scroll">
                <DeliveryDropoffTimeline
                  dropoffs={delivery.dropoffs}
                  supportingDocuments={delivery.supportingDocuments}
                  activeStopId={activeStopId}
                  onHoverStop={setActiveStopId}
                  onSelectStop={(stop) => {
                    setActiveStopId(stop.id);
                  }}
                  onViewPod={handleViewPod}
                  onAttachPod={handleAttachPod}
                  canManage={canManageDocs}
                />
              </div>
            </div>

            {/* Right Pane: Supporting Documents */}
            <div className="delivery-fulfillment-pane is-documents">
              <DeliverySupportingDocumentsPane
                trip={delivery}
                canManage={canManageDocs}
                onTripChange={handleTripUpdated}
                activeStopId={activeStopId}
                onSelectStopId={setActiveStopId}
              />
            </div>
          </div>
        </section>
        </div>
      </div>

      {/* Audited Deletion Dialog */}
      <ConfirmDeliveryDeletionDialog
        delivery={deliveryToDelete}
        pending={isDeleting}
        error={deleteError}
        onCancel={() => setDeliveryToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <ImageViewerModal
        isOpen={Boolean(viewingImage)}
        onClose={() => setViewingImage(null)}
        imageUrl={viewingImage?.url ?? ""}
        title={viewingImage?.title ?? ""}
        subtitle={viewingImage?.subtitle}
        filename={viewingImage?.filename}
      />
    </>
  );
}
