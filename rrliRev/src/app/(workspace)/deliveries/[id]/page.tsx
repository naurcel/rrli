"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { ConfirmDeliveryDeletionDialog } from "@/components/confirm-delivery-deletion-dialog";
import { DeliveryCrewSection } from "@/components/delivery-crew-section";
import { DeliveryDropoffTimeline } from "@/components/delivery-dropoff-timeline";
import { DeliveryFinancialBreakdown } from "@/components/delivery-financial-breakdown";
import { DeliveryNavigator } from "@/components/delivery-navigator";
import { DeliveryPodDocuments } from "@/components/delivery-pod-documents";
import { DeliveryTruckInfoSection } from "@/components/delivery-truck-info-section";
import { useGlobalDateRange } from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import {
  type ExpenseResolutionStatus,
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

function formatExpenseResolution(
  value: number | null | undefined,
  status: ExpenseResolutionStatus | null | undefined,
): string {
  if (status === "not_applicable") return "N/A";
  if (status === "unknown" || value == null || !Number.isFinite(value)) return "Incomplete";
  return formatPeso(value);
}

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
  const { deliveries: allDeliveries, loading: deliveriesLoading } = usePersistedDeliveries(range, { allPages: true });

  const [delivery, setDelivery] = useState<DeliveryLedgerItem | null>(null);
  const [deliveryToDelete, setDeliveryToDelete] = useState<DeliveryLedgerItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("updated") === "1" || params.get("updated") === "true") {
        setFeedbackMessage("Delivery updated successfully.");
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (!isActionMenuOpen) return;
    function handleGlobalClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".table-row-actions")) {
        setIsActionMenuOpen(false);
      }
    }
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsActionMenuOpen(false);
      }
    }
    document.addEventListener("click", handleGlobalClick);
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("click", handleGlobalClick);
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [isActionMenuOpen]);

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

  // Read filter and sort context passed from the delivery ledger
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

  // Compute filtered and sorted deliveries for the Delivery Navigator
  const navigatorDeliveries = useMemo(() => {
    let list = [...allDeliveries];

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

    // Clients filter
    if (clientsFilter.length > 0) {
      list = list.filter((d) => clientsFilter.includes(d.clientName));
    }

    // Trucks filter
    if (trucksFilter.length > 0) {
      list = list.filter((d) => trucksFilter.includes(d.plateNumber));
    }

    // Sort
    const [sortField, direction] = sortParam.split(":") as [string, "asc" | "desc"];
    return sortDeliveryLedgerItems(list, sortField, direction || "desc");
  }, [allDeliveries, clientsFilter, searchQuery, sortParam, statusFilter, trucksFilter]);

  // Ledger query string to preserve all filter/sort state when navigating
  const ledgerQueryString = searchParams.toString();
  const backToLedgerHref = `/deliveries${ledgerQueryString ? `?${ledgerQueryString}` : ""}`;

  function handleNavigateToDelivery(targetId: string) {
    const query = searchParams.toString();
    router.push(`/deliveries/${encodeURIComponent(targetId)}${query ? `?${query}` : ""}`);
  }

  async function handleConfirmDelete() {
    if (!deliveryToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteDeliveryRecord(deliveryToDelete.id);
      // Navigate back to the delivery ledger with preserved filter context
      router.push(backToLedgerHref);
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
            <Link href={backToLedgerHref} className="primary-action-button">
              ← Return to Deliveries
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
            href={backToLedgerHref}
            className="delivery-back-link"
            title="Return to the deliveries ledger while preserving search and filters"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Deliveries</span>
          </Link>

          {navigatorDeliveries.length > 0 ? (
            <DeliveryNavigator
              currentDeliveryId={delivery.id}
              deliveries={navigatorDeliveries}
              onNavigate={handleNavigateToDelivery}
            />
          ) : null}
        </div>

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
                <span className="late-recording-pill" title="Recorded past the standard 3-day operational window">
                  Late Recording
                </span>
              ) : null}
            </div>

            <h1 className="delivery-hero-title">{delivery.clientName}</h1>

            <div className="delivery-hero-status-pills">
              <span
                className={`simple-hero-badge ${isComplete ? "positive" : "warning"}`}
                title={
                  isComplete
                    ? "Delivery record complete"
                    : `Incomplete financials: ${delivery.financialIntegrityIssues.join(", ") || "incomplete expenses"}`
                }
              >
                <span className="simple-badge-dot" />
                {isComplete ? "Complete" : "Incomplete"}
              </span>

              <span className="simple-hero-badge-sep">·</span>

              <span
                className={`simple-hero-badge ${delivery.podStatus === "Verified" ? "positive" : "warning"}`}
                title={delivery.podStatus === "Verified" ? "Proof of delivery attached for all stops" : "Missing POD on one or more stops"}
              >
                {delivery.podStatus === "Verified" ? "POD Attached" : "Missing POD"}
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
            <div className="table-row-actions" style={{ position: "relative", display: "inline-block" }}>
              <button
                type="button"
                className="row-action-more-btn"
                aria-label={`Actions for waybill ${delivery.waybillNumber}`}
                title="More actions"
                aria-haspopup="menu"
                aria-expanded={isActionMenuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsActionMenuOpen((curr) => !curr);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <circle cx="8" cy="3" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="8" cy="13" r="1.5" />
                </svg>
              </button>

              {isActionMenuOpen && (
                <div
                  className="row-action-menu"
                  role="menu"
                  aria-label={`Actions for waybill ${delivery.waybillNumber}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      router.push(`/deliveries/${encodeURIComponent(delivery.id)}/edit`);
                    }}
                  >
                    Edit Delivery
                  </button>
                  {actor.role === "admin" && (
                    <>
                      <div className="row-action-menu-divider" role="separator" />
                      <button
                        type="button"
                        role="menuitem"
                        className="row-action-menu-danger"
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          setDeliveryToDelete(delivery);
                        }}
                      >
                        Delete Delivery
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </header>

        {/* 1. Primary Financial Performance & Analytics Card (Full-Width, High Visibility) */}
        <section className="records-card delivery-section-card delivery-financial-analytics-card">
          <div className="section-card-header delivery-analytics-header">
            <div>
              <h2 className="section-card-title">Financial Performance &amp; Analytics</h2>
              <p className="section-card-subtitle">
                Waybill profitability, revenue realization, and trip expense distribution
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
                  <span className="meta-label">Client Account</span>
                  <strong className="meta-value">{delivery.clientName}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Origin Hub</span>
                  <strong className="meta-value">{delivery.origin || "Default Origin Hub"}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Transit Distance</span>
                  <strong className="meta-value">{delivery.distanceKm} km</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Fuel Benchmark Rate</span>
                  <strong className="meta-value">{formatPeso(delivery.fuelRate)} / L</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Delivery Date</span>
                  <strong className="meta-value">{delivery.deliveryDate}</strong>
                </div>
                <div className="detail-meta-item">
                  <span className="meta-label">Financial Status</span>
                  <strong className={`meta-value ${isComplete ? "tone-success" : "tone-warning"}`}>
                    {isComplete ? "Complete" : "Incomplete"}
                  </strong>
                </div>
              </div>
            </section>

            {/* Assigned Vehicle */}
            <section className="records-card delivery-section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">Assigned Vehicle</h2>
              </div>
              <DeliveryTruckInfoSection
                plateNumber={delivery.plateNumber}
                truckType={delivery.truckType}
                truckTemperature={delivery.truckTemperature}
                truckOwnership={delivery.truckOwnership}
                rateBasis={delivery.rateBasis}
              />
            </section>

            {/* Delivery Crew */}
            <section className="records-card delivery-section-card">
              <div className="section-card-header">
                <h2 className="section-card-title">Delivery Crew</h2>
              </div>
              <DeliveryCrewSection
                driverName={delivery.driverName}
                helperName={delivery.helperName}
                driverRateText={`${formatExpenseResolution(delivery.expenses.driverDailyRate, delivery.expenseStates?.driverDailyRate)} + ${formatExpenseResolution(delivery.expenses.driverAllowance, delivery.expenseStates?.driverAllowance)}`}
                helperRateText={`${formatExpenseResolution(delivery.expenses.helperDailyRate, delivery.expenseStates?.helperDailyRate)} + ${formatExpenseResolution(delivery.expenses.helperAllowance, delivery.expenseStates?.helperAllowance)}`}
              />
            </section>
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
