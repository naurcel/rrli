"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { ConfirmDeliveryDeletionDialog } from "@/components/confirm-delivery-deletion-dialog";
import { DeliveryDropoffTimeline } from "@/components/delivery-dropoff-timeline";
import { DeliveryFinancialBreakdown } from "@/components/delivery-financial-breakdown";
import { DeliveryNavigator } from "@/components/delivery-navigator";
import { DeliveryPodDocuments } from "@/components/delivery-pod-documents";
import { DeliveryTruckInfoSection } from "@/components/delivery-truck-info-section";
import {
  isDateInRange,
  parseDateValue,
  toDateKey,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import {
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
} from "@/features/deliveries/delivery-domain";
import { deleteDeliveryRecord } from "@/features/deliveries/delivery-deletion-client";
import { sortDeliveryLedgerItems } from "@/features/deliveries/delivery-sort";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  readBrowserPreviewDeliveries,
  upsertBrowserPreviewDelivery,
} from "@/features/deliveries/browser-preview-deliveries";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { canManageDocuments, canMutateDeliveryRecords } from "@/lib/auth/rbac";
import { formatPeso } from "@/lib/format";

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

  // Read filter, sort, and context passed from the caller (Deliveries ledger or Truck Details)
  const fromSource = searchParams.get("from");
  const singleTruckParam = searchParams.get("truck");
  const isFromTruck = fromSource === "truck" || Boolean(singleTruckParam && fromSource !== "deliveries");

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("updated") === "1" || params.get("updated") === "true") {
        setFeedbackMessage("Delivery updated successfully.");
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  // Sync active delivery when id or allDeliveries changes
  useEffect(() => {
    // 1. Try finding in reactive deliveries
    const matched =
      allDeliveries.find((d) => d.id === normalizedId || d.waybillNumber === normalizedId) ??
      readBrowserPreviewDeliveries().find((d) => d.id === normalizedId || d.waybillNumber === normalizedId);

    if (matched) {
      setDelivery(matched);
      return;
    }

    // 2. Fallback to direct API lookup if not in preview list
    if (!deliveriesLoading) {
      let isMounted = true;
      fetch(`/api/deliveries?id=${encodeURIComponent(normalizedId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted) return;
          if (data?.ok && data.delivery) {
            setDelivery(data.delivery);
            upsertBrowserPreviewDelivery(data.delivery);
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

    // Sort matching exact ledger/truck list order
    const [sortField, direction] = sortParam.split(":") as [string, "asc" | "desc"];
    return sortDeliveryLedgerItems(list, sortField, direction || "desc");
  }, [
    allDeliveries,
    clientsFilter,
    dateFromParam,
    dateToParam,
    delivery,
    effectiveRange,
    isFromTruck,
    searchQuery,
    singleTruckParam,
    sortParam,
    statusFilter,
    trucksFilter,
  ]);

  // Return URL and label preserving complete caller context
  const backHref = useMemo(() => {
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
      return `/truck-profitability/${encodeURIComponent(singleTruckParam)}${qs ? `?${qs}` : ""}`;
    }

    const ledgerQueryString = searchParams.toString();
    return `/deliveries${ledgerQueryString ? `?${ledgerQueryString}` : ""}`;
  }, [dateFromParam, dateToParam, isFromTruck, searchParams, singleTruckParam, sortParam]);

  const backLabel = useMemo(() => {
    if (isFromTruck && singleTruckParam) {
      return `Back to ${singleTruckParam}`;
    }
    return "Back to Deliveries";
  }, [isFromTruck, singleTruckParam]);

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
      // Navigate back to the caller with preserved context
      router.push(backHref);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete delivery.");
      setIsDeleting(false);
    }
  }

  function handleTripUpdated(updatedTrip: DeliveryLedgerItem) {
    setDelivery(updatedTrip);
    upsertBrowserPreviewDelivery(updatedTrip);
  }

  // Not Found State
  if (!deliveriesLoading && !delivery) {
    return (
      <>
        <OperationalTopbar contextLabel="Deliveries / Record Not Found" showDateFilter={false} />
        <div className="content-wrap delivery-detail-page">
          <div className="delivery-detail-not-found records-card">
            <div className="not-found-icon">🔍</div>
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
            <span className="notice-icon" aria-hidden="true">✓</span>
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
                {delivery.dropoffs.length} {delivery.dropoffs.length === 1 ? "Drop-off" : "Drop-offs"}
              </span>

              <span className="simple-hero-badge-sep">·</span>

              <span className="simple-hero-badge neutral">
                Version {delivery.version}
              </span>
            </div>
          </div>

          {canWrite ? (
            <div className="delivery-header-actions" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                className="truck-action-icon-btn"
                aria-label={`Edit delivery #${delivery.waybillNumber}`}
                title="Edit delivery"
                onClick={() => {
                  router.push(`/deliveries/${encodeURIComponent(delivery.id)}/edit`);
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
            <div className="delivery-analytics-badges">
              {isComplete && delivery.marginPercent != null ? (
                <span className="routex-badge tone-primary" style={{ fontWeight: 700 }}>
                  {delivery.marginPercent.toFixed(1)}% MARGIN
                </span>
              ) : null}
            </div>
          </div>
          <DeliveryFinancialBreakdown trip={delivery} />
        </section>

        {/* 2. Operational Fulfillment & Fleet Specifications (Balanced 2-Column Grid) */}
        <div className="delivery-detail-grid">
          {/* Left Column: Store Drop-offs Fulfillment & POD Documents */}
          <div className="delivery-detail-column">
            {/* Store Drop-offs Sequence */}
            <section className="records-card delivery-section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">
                  Store Drop-offs ({delivery.dropoffs.length})
                </h2>
              </div>
              <DeliveryDropoffTimeline dropoffs={delivery.dropoffs} />
            </section>

            {/* POD & Supporting Documents */}
            <section className="records-card delivery-section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">POD &amp; Supporting Documents</h2>
              </div>
              <DeliveryPodDocuments
                trip={delivery}
                canVerify={canManageDocs}
                roleLabel={actor.roleLabel}
                onTripChange={handleTripUpdated}
              />
            </section>
          </div>

          {/* Right Column: Route, Vehicle & Crew Specifications */}
          <div className="delivery-detail-column">
            {/* Trip Overview Card */}
            <section className="records-card delivery-section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">Trip Information</h2>
              </div>
              <div className="detail-meta-grid">
                <div className="detail-meta-item">
                  <span className="meta-label">Client</span>
                  <strong className="meta-value">{delivery.clientName}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Origin</span>
                  <strong className="meta-value">{delivery.origin || "Default Origin"}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Distance</span>
                  <strong className="meta-value">{delivery.distanceKm} km</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Fuel Rate</span>
                  <strong className="meta-value">{formatPeso(delivery.fuelRate)} / L</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Date</span>
                  <strong className="meta-value">{delivery.deliveryDate}</strong>
                </div>
              </div>
            </section>

            {/* Truck */}
            <section className="records-card delivery-section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">Truck</h2>
              </div>
              <DeliveryTruckInfoSection
                plateNumber={delivery.plateNumber}
                truckType={delivery.truckType}
                truckTemperature={delivery.truckTemperature}
                truckOwnership={delivery.truckOwnership}
                rateBasis={delivery.rateBasis}
              />
            </section>
          </div>
        </div>
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
    </>
  );
}
