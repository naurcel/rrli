"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  formatDateRange,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import { TablePagination } from "@/components/table-pagination";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import {
  getTruckPhotoFromStorage,
  saveTruckPhotoFile,
  storageKey,
  TRUCK_PHOTO_EVENT,
  TruckPhoto,
} from "@/components/truck-photo";
import {
  getDeliveryIncompleteIssues,
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
  summarizeTruckProfitability,
  type ExpenseResolutionStatus,
} from "@/features/deliveries/delivery-domain";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  getFleetTrucks,
  getTruckStorageCapability,
  type FleetTruck,
  type TruckStorageCapability,
} from "@/features/deliveries/truck-registry";
import {
  BROWSER_PREVIEW_TRUCKS_CHANGED,
  deleteBrowserPreviewTruck,
  readBrowserPreviewTrucks,
  updateBrowserPreviewTruck,
} from "@/features/deliveries/browser-preview-trucks";
import { upsertBrowserPreviewDelivery } from "@/features/deliveries/browser-preview-deliveries";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { canManageDocuments, canManageTrucks } from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";

export default function TruckProfilePage({
  params,
}: {
  params: Promise<{ plate: string }>;
}) {
  const router = useRouter();
  const actor = useAuthenticatedActor();
  const { plate } = use(params);
  let decodedPlate = plate;
  try {
    decodedPlate = decodeURIComponent(plate);
  } catch {
    // Keep malformed segments unchanged so they resolve to the unavailable state.
  }
  const normalizedPlate = decodedPlate.replace(/\+/g, " ").trim().replace(/\s+/g, " ").toUpperCase();
  const { range } = useGlobalDateRange();
  const { deliveries, loading, error } = usePersistedDeliveries(range);
  const [historySort, setHistorySort] = useState<{ key: string; direction: TableSortDirection }>({ key: "date", direction: "desc" });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [localTrucks, setLocalTrucks] = useState<FleetTruck[]>([]);
  const canManage = canManageTrucks(actor.role);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editPlateNumber, setEditPlateNumber] = useState("");
  const [editTruckType, setEditTruckType] = useState<FleetTruck["truckType"]>("6-Wheeler");
  const [editStorageCapability, setEditStorageCapability] = useState<TruckStorageCapability>("Refrigerated");
  const [editOwnershipType, setEditOwnershipType] = useState<FleetTruck["ownershipType"]>("Owned");
  const [editProvider, setEditProvider] = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editTruckPhotoFile, setEditTruckPhotoFile] = useState<File | null>(null);
  const [editTruckPhotoPreview, setEditTruckPhotoPreview] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    const syncLocal = () => setLocalTrucks(readBrowserPreviewTrucks());
    syncLocal();
    window.addEventListener(BROWSER_PREVIEW_TRUCKS_CHANGED, syncLocal);
    window.addEventListener("storage", syncLocal);
    return () => {
      window.removeEventListener(BROWSER_PREVIEW_TRUCKS_CHANGED, syncLocal);
      window.removeEventListener("storage", syncLocal);
    };
  }, []);

  const truckTrips = useMemo(
    () =>
      deliveries.filter(
        (trip) =>
          trip.plateNumber.trim().replace(/\s+/g, " ").toUpperCase() === normalizedPlate ||
          trip.plateNumber.replace(/\s+/g, "").toUpperCase() === normalizedPlate.replace(/\s+/g, ""),
      ),
    [deliveries, normalizedPlate],
  );

  const totalDropoffsCount = useMemo(
    () => truckTrips.reduce((sum, trip) => sum + (trip.dropoffs?.length ?? 0), 0),
    [truckTrips],
  );

  const finalizedTripsCount = useMemo(
    () => truckTrips.filter(isDeliveryFinanciallyComplete).length,
    [truckTrips],
  );

  const pendingRevenue = useMemo(
    () =>
      truckTrips
        .filter((t) => !isDeliveryFinanciallyComplete(t))
        .reduce((sum, trip) => sum + (trip.deliveryRate ?? 0), 0),
    [truckTrips],
  );

  const truck = useMemo(
    () =>
      summarizeTruckProfitability(deliveries).find(
        (summary) =>
          summary.plateNumber.trim().replace(/\s+/g, " ").toUpperCase() === normalizedPlate ||
          summary.plateNumber.replace(/\s+/g, "").toUpperCase() === normalizedPlate.replace(/\s+/g, ""),
      ) ?? null,
    [deliveries, normalizedPlate],
  );

  const registeredTruck = useMemo(() => {
    const all = [...localTrucks, ...getFleetTrucks()];
    return all.find((candidate) => candidate.plateNumber.toUpperCase() === normalizedPlate) ?? null;
  }, [normalizedPlate, localTrucks]);

  const activeTruck = useMemo(() => {
    if (truck) {
      return {
        ...truck,
        truckType: registeredTruck?.truckType ?? truck.truckType,
        completedTrips: Math.max(truck.completedTrips, truckTrips.length),
        totalStoresServed: Math.max(truck.totalStoresServed, totalDropoffsCount),
      };
    }
    if (truckTrips.length > 0) {
      const finalized = truckTrips.filter(isDeliveryFinanciallyComplete);
      const totalEarnings = finalized.reduce((sum, trip) => sum + (trip.deliveryRate ?? 0), 0);
      const totalExpenses = finalized.reduce((sum, trip) => sum + (trip.totalExpenses ?? 0), 0);
      const netProfit = totalEarnings - totalExpenses;
      const totalDistance = truckTrips.reduce((sum, trip) => sum + (trip.distanceKm ?? 0), 0);
      return {
        plateNumber: normalizedPlate,
        truckType: truckTrips[0]?.truckType ?? registeredTruck?.truckType ?? "6-Wheeler",
        completedTrips: truckTrips.length,
        totalEarnings,
        totalExpenses,
        netProfit,
        marginPercent: totalEarnings > 0 ? (netProfit / totalEarnings) * 100 : null,
        totalStoresServed: totalDropoffsCount,
        totalDistanceKm: totalDistance,
      };
    }
    return registeredTruck ? {
      plateNumber: registeredTruck.plateNumber,
      truckType: registeredTruck.truckType,
      completedTrips: 0,
      totalEarnings: 0,
      totalExpenses: 0,
      netProfit: 0,
      marginPercent: null,
      totalStoresServed: 0,
      totalDistanceKm: 0,
    } : null;
  }, [truck, truckTrips, totalDropoffsCount, normalizedPlate, registeredTruck]);

  const sortedTruckTrips = useMemo(() => {
    const multiplier = historySort.direction === "asc" ? 1 : -1;
    return [...truckTrips].sort((left, right) => {
      const values: Record<string, [string | number, string | number]> = {
        date: [left.deliveryDate, right.deliveryDate],
        client: [left.clientName, right.clientName],
        dropoffs: [left.dropoffs.length, right.dropoffs.length],
        distance: [left.distanceKm, right.distanceKm],
        revenue: [left.deliveryRate ?? Number.NEGATIVE_INFINITY, right.deliveryRate ?? Number.NEGATIVE_INFINITY],
        expenses: [left.totalExpenses ?? Number.NEGATIVE_INFINITY, right.totalExpenses ?? Number.NEGATIVE_INFINITY],
        netIncome: [left.netIncome ?? Number.NEGATIVE_INFINITY, right.netIncome ?? Number.NEGATIVE_INFINITY],
      };
      const [leftValue, rightValue] = values[historySort.key] ?? values.date;
      const compared = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
      return compared * multiplier || left.id.localeCompare(right.id);
    });
  }, [historySort, truckTrips]);

  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;
  const historyPageCount = Math.max(1, Math.ceil(sortedTruckTrips.length / HISTORY_PAGE_SIZE));

  useEffect(() => {
    setHistoryPage(1);
  }, [range, historySort, normalizedPlate]);

  const paginatedTruckTrips = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return sortedTruckTrips.slice(start, start + HISTORY_PAGE_SIZE);
  }, [sortedTruckTrips, historyPage]);

  function openEditModal() {
    if (!activeTruck) return;
    setEditError(null);
    const resolvedCapability = getTruckStorageCapability(
      activeTruck.plateNumber,
      registeredTruck?.storageCapability,
    );
    const resolvedOwnership = registeredTruck?.ownershipType ?? "Owned";
    setEditPlateNumber(activeTruck.plateNumber);
    setEditTruckType(activeTruck.truckType);
    setEditStorageCapability(resolvedCapability);
    setEditOwnershipType(resolvedOwnership);
    setEditProvider(registeredTruck?.provider ?? "");
    setEditContactPerson(registeredTruck?.contactPerson ?? "");
    setEditTruckPhotoFile(null);
    setEditTruckPhotoPreview(getTruckPhotoFromStorage(activeTruck.plateNumber));
    setIsEditModalOpen(true);
  }

  async function handleUpdateTruck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTruck) return;
    setEditError(null);

    const nextPlate = editPlateNumber.trim().toUpperCase();
    if (!nextPlate) {
      setEditError("Plate number is required.");
      return;
    }
    if (editOwnershipType === "Subcontracted" && !editProvider.trim()) {
      setEditError("Provider is required for subcontracted trucks.");
      return;
    }

    setEditSubmitting(true);
    try {
      const browserLocal = readBrowserPreviewTrucks().some(
        (t) => t.plateNumber.toUpperCase() === activeTruck.plateNumber.toUpperCase(),
      );
      const response = await fetch("/api/trucks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalPlateNumber: activeTruck.plateNumber,
          plateNumber: nextPlate,
          truckType: editTruckType,
          storageCapability: editStorageCapability,
          ownershipType: editOwnershipType,
          provider: editOwnershipType === "Subcontracted" ? editProvider.trim() : null,
          contactPerson: editOwnershipType === "Subcontracted" ? (editContactPerson.trim() || null) : null,
          browserLocal,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        truck?: FleetTruck;
      } | null;

      if (!response.ok || !payload?.ok || !payload.truck) {
        setEditError(payload?.message ?? "Unable to update truck. Please verify input.");
        return;
      }

      const updatedTruck: FleetTruck = {
        ...payload.truck,
        storageCapability: editStorageCapability,
      };

      updateBrowserPreviewTruck(activeTruck.plateNumber, updatedTruck);

      const oldKey = storageKey(activeTruck.plateNumber);
      const newKey = storageKey(updatedTruck.plateNumber);
      if (oldKey !== newKey && !editTruckPhotoFile && typeof window !== "undefined") {
        const existingPhoto = window.localStorage.getItem(oldKey);
        if (existingPhoto) {
          window.localStorage.setItem(newKey, existingPhoto);
          window.dispatchEvent(new Event(TRUCK_PHOTO_EVENT));
        }
      }
      if (editTruckPhotoFile) {
        await saveTruckPhotoFile(updatedTruck.plateNumber, editTruckPhotoFile);
      }

      setLocalTrucks(readBrowserPreviewTrucks());
      setIsEditModalOpen(false);

      if (updatedTruck.ownershipType === "Subcontracted") {
        router.push("/truck-profitability");
      } else if (updatedTruck.plateNumber.toUpperCase() !== activeTruck.plateNumber.toUpperCase()) {
        router.push(`/truck-profitability/${encodeURIComponent(updatedTruck.plateNumber)}`);
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update truck.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteTruck() {
    if (!activeTruck) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const browserLocal = readBrowserPreviewTrucks().some(
        (truck) => truck.plateNumber.toUpperCase() === activeTruck.plateNumber.toUpperCase(),
      );
      const deleteParams = new URLSearchParams({
        plateNumber: activeTruck.plateNumber,
        ...(browserLocal ? { browserLocal: "true" } : {}),
      });
      const response = await fetch(`/api/trucks?${deleteParams.toString()}`, {
        method: "DELETE",
        headers: {
          "x-actor-role": actor.role,
          "x-actor-username": actor.username,
        },
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Failed to delete truck.");
      }

      deleteBrowserPreviewTruck(activeTruck.plateNumber);
      router.push("/truck-profitability");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete truck.");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <OperationalTopbar contextLabel={`Truck ${normalizedPlate}`} />

      <div className="content-wrap fleet-detail-page truck-profile-page">
        <Link className="back-link" href="/truck-profitability" title="Back to Trucks">
          ← Back to Trucks
        </Link>

        {loading ? (
          <section className="notice" role="status">
            <span className="notice-icon" aria-hidden="true">i</span>
            <div><strong>Loading truck profile:</strong><span>Calculating this truck&apos;s delivery performance.</span></div>
          </section>
        ) : error ? (
          <section className="notice" role="alert">
            <span className="notice-icon" aria-hidden="true">!</span>
            <div><strong>Truck profile unavailable:</strong><span>{error}</span></div>
          </section>
        ) : !activeTruck ? (
          <section className="fallback-panel truck-profile-unavailable">
            <h1>Truck profile unavailable</h1>
            <p>No fleet record or finalized deliveries for {normalizedPlate} were found.</p>
            <Link className="fallback-link" href="/truck-profitability">Back to trucks</Link>
          </section>
        ) : (
          <>
            <header className="page-intro truck-profile-page-intro" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1>{activeTruck.plateNumber}</h1>
                <div className="truck-profile-subtitle-wrap">
                  <span className="truck-profile-type-badge">{activeTruck.truckType}</span>
                  <span
                    className={`truck-capability-pill ${
                      getTruckStorageCapability(activeTruck.plateNumber, registeredTruck?.storageCapability) === "Refrigerated"
                        ? "refrigerated"
                        : "ambient"
                    }`}
                    style={{ position: "static", boxShadow: "none" }}
                  >
                    {getTruckStorageCapability(activeTruck.plateNumber, registeredTruck?.storageCapability) === "Refrigerated"
                      ? "Cold"
                      : "Dry"}
                  </span>
                  <span className="truck-profile-date-range" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
                    · {formatDateRange(range)}
                  </span>
                </div>
              </div>

              {actor.role === "admin" && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    title="Edit truck details"
                    onClick={openEditModal}
                  >
                    <span>Edit Truck</span>
                  </button>
                  <button
                    type="button"
                    className="secondary-button danger-action"
                    title="Delete truck"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                    <span>Delete Truck</span>
                  </button>
                </div>
              )}
            </header>

            <section className="truck-profile-hero" aria-label="Truck profile overview">
              <article className="records-card truck-profile-visual">
                <TruckPhoto plateNumber={activeTruck.plateNumber} editable />
              </article>

              <article className="records-card truck-profile-card truck-profile-availability">
                <div className="records-heading">
                  <div>
                    <h2>Operational Summary</h2>
                  </div>
                </div>
                <div className="truck-performance-kpis" aria-label="Truck performance metrics">
                  <article
                    className="stat-card"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      document.getElementById("truck-delivery-history")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    title="View delivery history"
                  >
                    <span className="stat-label">DELIVERIES</span>
                    <strong>{activeTruck.completedTrips}</strong>
                    {finalizedTripsCount < truckTrips.length ? (
                      <span className="stat-meta" style={{ display: "block", fontSize: "11px", marginTop: "2px" }}>
                        {finalizedTripsCount} finalized
                      </span>
                    ) : null}
                  </article>
                  <article className="stat-card">
                    <span className="stat-label">DROP-OFFS</span>
                    <strong>{activeTruck.totalStoresServed}</strong>
                  </article>
                  <article className="stat-card">
                    <span className="stat-label">REVENUE</span>
                    <strong>{formatPeso(activeTruck.totalEarnings)}</strong>
                    {pendingRevenue > 0 ? (
                      <span
                        className="stat-meta"
                        title={`${formatPeso(pendingRevenue)} pending (unresolved expenses)`}
                        style={{ display: "block", fontSize: "11px", color: "var(--color-accent, #d97706)", marginTop: "2px", fontWeight: 500 }}
                      >
                        + {formatPeso(pendingRevenue)} pending
                      </span>
                    ) : null}
                  </article>
                  <article className="stat-card"><span className="stat-label">EXPENSES</span><strong>{formatPeso(activeTruck.totalExpenses)}</strong></article>
                  <article className="stat-card"><span className="stat-label">NET PROFIT</span><strong className={activeTruck.netProfit < 0 ? "warning" : undefined}>{formatPeso(activeTruck.netProfit)}</strong></article>
                  <article className="stat-card"><span className="stat-label">PROFIT MARGIN</span><strong className={activeTruck.netProfit < 0 ? "warning" : undefined}>{formatPercent(activeTruck.marginPercent)}</strong></article>
                </div>
              </article>
            </section>

            <section className="records-card truck-profile-deliveries" id="truck-delivery-history" aria-label="Truck delivery history">
              <div className="records-heading">
                <div>
                  <h2>Delivery History</h2>
                </div>
              </div>
              {sortedTruckTrips.length === 0 ? (
                <div
                  className="empty-state"
                  style={{ padding: "36px 20px" }}
                  title="No deliveries in date range"
                >
                  <strong>No completed deliveries in this range</strong>
                  <span>No finalized trips have been recorded for {activeTruck.plateNumber} within the selected date range.</span>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <SortableTableHeader label="Waybill & Date" sortKey="date" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Client" sortKey="client" activeSortKey={historySort.key} direction={historySort.direction} onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Drop-offs" sortKey="dropoffs" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Distance" sortKey="distance" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Revenue" sortKey="revenue" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Expenses" sortKey="expenses" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                        <SortableTableHeader label="Net Profit" sortKey="netIncome" activeSortKey={historySort.key} direction={historySort.direction} defaultDirection="desc" onSort={(key, direction) => setHistorySort({ key, direction })} />
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTruckTrips.map((trip) => {
                        const isIncomplete = isDeliveryIncomplete(trip);
                        const isFinanciallyIncomplete = !isDeliveryFinanciallyComplete(trip);
                        return (
                          <tr
                            key={trip.id}
                            className={`record-row ${isIncomplete ? "is-incomplete" : ""}`}
                            tabIndex={0}
                            onClick={() => router.push(`/deliveries/${encodeURIComponent(trip.id)}`)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                router.push(`/deliveries/${encodeURIComponent(trip.id)}`);
                              }
                            }}
                            title={`View waybill ${trip.waybillNumber}`}
                          >
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <strong className="record-link">#{trip.waybillNumber}</strong>
                              </div>
                              <small>{trip.deliveryDate}</small>
                            </td>
                            <td>{trip.clientName}</td>
                            <td>{trip.dropoffs.length} drop-offs</td>
                            <td>{trip.distanceKm} km</td>
                            <td className="money">{formatPeso(trip.deliveryRate)}</td>
                            <td>
                              {isFinanciallyIncomplete || trip.totalExpenses == null ? (
                                <span
                                  className="profit-amount warning"
                                  title={`Incomplete expenses: ${trip.financialIntegrityIssues.join(", ") || "Pending confirmation"}`}
                                >
                                  Incomplete
                                </span>
                              ) : (
                                formatPeso(trip.totalExpenses)
                              )}
                            </td>
                            <td className="money">
                              {isFinanciallyIncomplete || trip.netIncome == null ? (
                                <span
                                  className="profit-amount warning"
                                  title="Net profit deferred: pending expenses"
                                >
                                  Incomplete
                                </span>
                              ) : (
                                formatPeso(trip.netIncome)
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {sortedTruckTrips.length > 0 ? (
                <TablePagination
                  page={historyPage}
                  pageCount={historyPageCount}
                  totalItems={sortedTruckTrips.length}
                  pageSize={HISTORY_PAGE_SIZE}
                  onPageChange={setHistoryPage}
                  itemLabel="deliveries"
                  itemCountInPage={paginatedTruckTrips.length}
                />
              ) : null}
            </section>
          </>
        )}
      </div>

      {isDeleteModalOpen && activeTruck && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-truck-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div className="routex-dialog-backdrop" onClick={() => !isDeleting && setIsDeleteModalOpen(false)} />
              <div className="routex-dialog" style={{ maxWidth: "460px" }}>
                <header className="routex-dialog-header" style={{ flexShrink: 0 }}>
                  <div>
                    <h2 id="delete-truck-dialog-title" style={{ fontSize: "17px", color: "var(--color-danger, #dc2626)" }}>
                      Confirm Truck Deletion
                    </h2>
                    <p style={{ margin: "2px 0 0", fontSize: "11px" }}>
                      Action is audited and logged.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="routex-dialog-close"
                    aria-label="Close confirmation dialog"
                    title="Close confirmation dialog (Esc)"
                    disabled={isDeleting}
                    onClick={() => setIsDeleteModalOpen(false)}
                  >
                    ×
                  </button>
                </header>

                <div className="routex-dialog-body" style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  {deleteError && (
                    <div className="notice" role="alert" style={{ marginBottom: "0" }}>
                      <span className="notice-icon" aria-hidden="true">!</span>
                      <div>
                        <strong>Error:</strong>
                        <span>{deleteError}</span>
                      </div>
                    </div>
                  )}

                  <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--color-text-primary)" }}>
                    Are you sure you want to delete truck <strong>{activeTruck.plateNumber}</strong> ({activeTruck.truckType}) from the fleet registry?
                  </p>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      background: "var(--color-surface-subtle)",
                      border: "1px solid var(--color-border)",
                      fontSize: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Plate Number: </span>
                      <strong>{activeTruck.plateNumber}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Vehicle Type: </span>
                      <span>{activeTruck.truckType}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Completed Deliveries: </span>
                      <span>{activeTruck.completedTrips}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      color: "#dc2626",
                      fontSize: "11px",
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>Warning:</strong> Deleting this vehicle removes it from active fleet selection and registers an admin audit entry.
                  </div>
                </div>

                <footer className="routex-dialog-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isDeleting}
                    onClick={() => setIsDeleteModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="danger-confirm-button"
                    disabled={isDeleting}
                    onClick={handleDeleteTruck}
                  >
                    {isDeleting ? "Deleting..." : "Delete Truck"}
                  </button>
                </footer>
              </div>
            </div>,
            document.body
          )
        : null}

      {isEditModalOpen && activeTruck && (
        <div
          className="routex-dialog-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-truck-profile-dialog-title"
        >
          <div
            className="routex-dialog-backdrop"
            onClick={() => !editSubmitting && setIsEditModalOpen(false)}
          />
          <div className="routex-dialog add-truck-dialog">
            <header className="routex-dialog-header">
              <div>
                <h2 id="edit-truck-profile-dialog-title">Edit Truck</h2>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                aria-label="Close dialog"
                title="Close dialog (Esc)"
                disabled={editSubmitting}
                onClick={() => setIsEditModalOpen(false)}
              >
                ×
              </button>
            </header>

            <form onSubmit={handleUpdateTruck}>
              <div className="routex-dialog-body add-truck-dialog-body">
                {editError && (
                  <div className="notice" role="alert" style={{ marginBottom: "0" }}>
                    <span className="notice-icon" aria-hidden="true">!</span>
                    <div>
                      <strong>Validation Error:</strong>
                      <span>{editError}</span>
                    </div>
                  </div>
                )}

                <div className="routex-dialog-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="routex-dialog-field">
                    <label htmlFor="edit-profile-truck-plate" style={{ fontWeight: 600, fontSize: "12px" }}>
                      Plate Number *
                    </label>
                    <input
                      id="edit-profile-truck-plate"
                      type="text"
                      required
                      placeholder="e.g. NBE 4892"
                      value={editPlateNumber}
                      onChange={(e) => setEditPlateNumber(e.target.value.toUpperCase())}
                      style={{
                        minHeight: "38px",
                        height: "38px",
                        padding: "0 12px",
                        borderRadius: "9px",
                        border: "1px solid var(--color-border)",
                        background: "var(--glass-surface-strong)",
                        fontFamily: "var(--font-mono, monospace)",
                        fontWeight: 600,
                        letterSpacing: "0.5px",
                      }}
                    />
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="edit-profile-truck-ownership" style={{ fontWeight: 600, fontSize: "12px" }}>
                      Fleet Ownership *
                    </label>
                    <RoundedSelect
                      value={editOwnershipType}
                      options={[
                        { value: "Owned", label: "Owned" },
                        { value: "Subcontracted", label: "Subcontracted" },
                      ]}
                      onChange={(value) => setEditOwnershipType(value as FleetTruck["ownershipType"])}
                      ariaLabel="Select fleet ownership"
                    />
                  </div>
                </div>

                <div className="routex-dialog-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="routex-dialog-field">
                    <label htmlFor="edit-profile-truck-type" style={{ fontWeight: 600, fontSize: "12px" }}>
                      Vehicle Size *
                    </label>
                    <RoundedSelect
                      value={editTruckType}
                      options={["4-Wheeler", "6-Wheeler", "10-Wheeler"]}
                      onChange={(value) => setEditTruckType(value as FleetTruck["truckType"])}
                      ariaLabel="Select vehicle size"
                    />
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="edit-profile-truck-capability" style={{ fontWeight: 600, fontSize: "12px" }}>
                      Classification *
                    </label>
                    <RoundedSelect
                      value={editStorageCapability}
                      options={[
                        { value: "Refrigerated", label: "Cold" },
                        { value: "Dry", label: "Dry" },
                      ]}
                      onChange={(value) => setEditStorageCapability(value as TruckStorageCapability)}
                      ariaLabel="Select truck classification"
                    />
                  </div>
                </div>

                {editOwnershipType === "Subcontracted" && (
                  <div className="routex-dialog-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="routex-dialog-field">
                      <label htmlFor="edit-profile-truck-provider" style={{ fontWeight: 600, fontSize: "12px" }}>
                        Hauler / Provider *
                      </label>
                      <input
                        id="edit-profile-truck-provider"
                        type="text"
                        required
                        placeholder="e.g. Northline Hauling"
                        value={editProvider}
                        onChange={(e) => setEditProvider(e.target.value)}
                        style={{
                          minHeight: "38px",
                          height: "38px",
                          padding: "0 12px",
                          borderRadius: "9px",
                          border: "1px solid var(--color-border)",
                          background: "var(--glass-surface-strong)",
                        }}
                      />
                    </div>

                    <div className="routex-dialog-field">
                      <label htmlFor="edit-profile-truck-contact" style={{ fontWeight: 600, fontSize: "12px" }}>
                        Contact Person
                      </label>
                      <input
                        id="edit-profile-truck-contact"
                        type="text"
                        placeholder="e.g. Adrian Cruz"
                        value={editContactPerson}
                        onChange={(e) => setEditContactPerson(e.target.value)}
                        style={{
                          minHeight: "38px",
                          height: "38px",
                          padding: "0 12px",
                          borderRadius: "9px",
                          border: "1px solid var(--color-border)",
                          background: "var(--glass-surface-strong)",
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="truck-create-photo-field">
                  <div className="truck-create-photo-preview">
                    {editTruckPhotoPreview ? <img src={editTruckPhotoPreview} alt="Selected truck preview" /> : <span>No photo</span>}
                  </div>
                  <div className="routex-dialog-field">
                    <label htmlFor="edit-profile-truck-photo" style={{ fontWeight: 600, fontSize: "12px" }}>
                      Truck Picture (Optional)
                    </label>
                    <input
                      id="edit-profile-truck-photo"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        if (!file) return;
                        if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
                          setEditError("Choose an image file smaller than 10 MB.");
                          event.target.value = "";
                          return;
                        }
                        setEditError(null);
                        setEditTruckPhotoFile(file);
                        const reader = new FileReader();
                        reader.onload = () => setEditTruckPhotoPreview(String(reader.result));
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                </div>
              </div>

              <footer className="routex-dialog-footer">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={editSubmitting}
                  title="Cancel editing truck and close dialog"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={editSubmitting}
                  title="Save truck changes"
                >
                  {editSubmitting ? "Saving Changes..." : "Save Changes"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
