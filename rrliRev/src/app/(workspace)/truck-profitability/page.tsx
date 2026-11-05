"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { useGlobalDateRange } from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import {
  SortableTableHeader,
  type TableSortDirection,
} from "@/components/sortable-table-header";
import { saveTruckPhotoFile, TruckPhoto } from "@/components/truck-photo";
import {
  BROWSER_PREVIEW_TRUCKS_CHANGED,
  readBrowserPreviewTrucks,
  saveBrowserPreviewTruck,
} from "@/features/deliveries/browser-preview-trucks";
import { summarizeTruckProfitability } from "@/features/deliveries/delivery-domain";
import {
  getTruckStorageCapability,
  OWNED_TRUCKS,
  SUBCONTRACTED_TRUCKS,
  TRUCK_CLASSIFICATION_FILTER_OPTIONS,
  TRUCK_PERFORMANCE_FILTER_OPTIONS,
  type FleetTruck,
  type TruckClassificationFilterKey,
  type TruckPerformanceFilterKey,
  type TruckStorageCapability,
} from "@/features/deliveries/truck-registry";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { canManageTrucks } from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";

type SubcontractedTruckSortKey = Extract<
  keyof FleetTruck,
  "plateNumber" | "truckType" | "provider" | "contactPerson"
>;

type OwnedTruckSort =
  | "netProfit"
  | "revenue"
  | "margin"
  | "deliveries"
  | "expenses"
  | "plate";

const OWNED_TRUCK_SORT_OPTIONS = [
  { value: "netProfit", label: "Highest Net Profit" },
  { value: "revenue", label: "Highest Revenue" },
  { value: "margin", label: "Highest Profit Margin" },
  { value: "deliveries", label: "Most Deliveries" },
  { value: "expenses", label: "Highest Expenses" },
  { value: "plate", label: "Plate A–Z" },
] as const;

export default function TruckProfitabilityPage() {
  const actor = useAuthenticatedActor();
  const canAdd = canManageTrucks(actor.role);

  const { range } = useGlobalDateRange();
  const { deliveries: dateFilteredTrips, loading, error } = usePersistedDeliveries(range);

  // Filter & sort states
  const [plateSearch, setPlateSearch] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<TruckClassificationFilterKey>("all");
  const [performanceFilter, setPerformanceFilter] = useState<TruckPerformanceFilterKey>("all");
  const [ownedTruckSort, setOwnedTruckSort] = useState<OwnedTruckSort>("netProfit");

  const [subcontractedSort, setSubcontractedSort] = useState<{
    key: SubcontractedTruckSortKey;
    direction: TableSortDirection;
  }>({ key: "plateNumber", direction: "asc" });

  const [extraTrucks, setExtraTrucks] = useState<FleetTruck[]>([]);
  const [isAddTruckOpen, setIsAddTruckOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  // Add Truck Form states
  const [plateNumber, setPlateNumber] = useState("");
  const [truckType, setTruckType] = useState<FleetTruck["truckType"]>("6-Wheeler");
  const [storageCapability, setStorageCapability] = useState<TruckStorageCapability>("Refrigerated");
  const [ownershipType, setOwnershipType] = useState<FleetTruck["ownershipType"]>("Owned");
  const [provider, setProvider] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [truckPhotoFile, setTruckPhotoFile] = useState<File | null>(null);
  const [truckPhotoPreview, setTruckPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    const syncLocal = () => setExtraTrucks(readBrowserPreviewTrucks());
    syncLocal();

    fetch("/api/trucks")
      .then((res) => res.json())
      .then((data: { ok?: boolean; trucks?: FleetTruck[] }) => {
        if (data?.ok && Array.isArray(data.trucks)) {
          const basePlates = new Set([
            ...OWNED_TRUCKS.map((t) => t.plateNumber.toUpperCase()),
            ...SUBCONTRACTED_TRUCKS.map((t) => t.plateNumber.toUpperCase()),
          ]);
          const newFromApi = data.trucks.filter(
            (t) => !basePlates.has(t.plateNumber.toUpperCase()),
          );
          setExtraTrucks((prev) => {
            const seen = new Set(prev.map((t) => t.plateNumber.toUpperCase()));
            const toAdd = newFromApi.filter((t) => !seen.has(t.plateNumber.toUpperCase()));
            return [...prev, ...toAdd];
          });
        }
      })
      .catch(() => {});

    window.addEventListener(BROWSER_PREVIEW_TRUCKS_CHANGED, syncLocal);
    window.addEventListener("storage", syncLocal);
    return () => {
      window.removeEventListener(BROWSER_PREVIEW_TRUCKS_CHANGED, syncLocal);
      window.removeEventListener("storage", syncLocal);
    };
  }, []);

  const allOwnedTrucks = useMemo(() => {
    const extra = extraTrucks.filter((t) => t.ownershipType === "Owned");
    const seen = new Set(OWNED_TRUCKS.map((t) => t.plateNumber.toUpperCase()));
    return [
      ...OWNED_TRUCKS,
      ...extra.filter((t) => !seen.has(t.plateNumber.toUpperCase())),
    ];
  }, [extraTrucks]);

  const allSubcontractedTrucks = useMemo(() => {
    const extra = extraTrucks.filter((t) => t.ownershipType === "Subcontracted");
    const seen = new Set(SUBCONTRACTED_TRUCKS.map((t) => t.plateNumber.toUpperCase()));
    return [
      ...SUBCONTRACTED_TRUCKS,
      ...extra.filter((t) => !seen.has(t.plateNumber.toUpperCase())),
    ];
  }, [extraTrucks]);

  const truckSummaries = useMemo(
    () => summarizeTruckProfitability(
      dateFilteredTrips.filter((trip) => trip.truckOwnership === "Owned"),
    ),
    [dateFilteredTrips],
  );

  const sortedTruckSummaries = useMemo(() => {
    const summariesMap = new Map(truckSummaries.map((s) => [s.plateNumber.toUpperCase(), s]));

    const merged = allOwnedTrucks.map((truck) => {
      const existing = summariesMap.get(truck.plateNumber.toUpperCase());
      const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
      if (existing) {
        return {
          ...existing,
          storageCapability: capability,
        };
      }
      return {
        plateNumber: truck.plateNumber,
        truckType: truck.truckType,
        storageCapability: capability,
        completedTrips: 0,
        totalEarnings: 0,
        totalExpenses: 0,
        netProfit: 0,
        marginPercent: null,
        totalStoresServed: 0,
        totalDistanceKm: 0,
      };
    });

    for (const summary of truckSummaries) {
      if (!merged.some((t) => t.plateNumber.toUpperCase() === summary.plateNumber.toUpperCase())) {
        const capability = getTruckStorageCapability(summary.plateNumber);
        merged.push({
          ...summary,
          storageCapability: capability,
        });
      }
    }

    return merged.sort((left, right) => {
      switch (ownedTruckSort) {
        case "revenue": {
          const diff = right.totalEarnings - left.totalEarnings;
          if (diff !== 0) return diff;
          return left.plateNumber.localeCompare(right.plateNumber);
        }
        case "expenses": {
          const diff = right.totalExpenses - left.totalExpenses;
          if (diff !== 0) return diff;
          return left.plateNumber.localeCompare(right.plateNumber);
        }
        case "netProfit": {
          const diff = right.netProfit - left.netProfit;
          if (diff !== 0) return diff;
          const revDiff = right.totalEarnings - left.totalEarnings;
          if (revDiff !== 0) return revDiff;
          return left.plateNumber.localeCompare(right.plateNumber);
        }
        case "margin": {
          const leftMargin = left.marginPercent ?? Number.NEGATIVE_INFINITY;
          const rightMargin = right.marginPercent ?? Number.NEGATIVE_INFINITY;
          const diff = rightMargin - leftMargin;
          if (diff !== 0) return diff;
          return left.plateNumber.localeCompare(right.plateNumber);
        }
        case "deliveries": {
          const diff = right.completedTrips - left.completedTrips;
          if (diff !== 0) return diff;
          return left.plateNumber.localeCompare(right.plateNumber);
        }
        case "plate":
        default:
          return left.plateNumber.localeCompare(right.plateNumber);
      }
    });
  }, [allOwnedTrucks, ownedTruckSort, truckSummaries]);

  const filteredOwnedTrucks = useMemo(() => {
    const cleanSearch = plateSearch.trim().toLowerCase().replace(/\s+/g, "");

    return sortedTruckSummaries.filter((truck) => {
      // 1. Plate Search
      if (cleanSearch) {
        const plateNorm = truck.plateNumber.toLowerCase();
        const plateClean = plateNorm.replace(/\s+/g, "");
        if (!plateNorm.includes(cleanSearch) && !plateClean.includes(cleanSearch)) {
          return false;
        }
      }

      // 2. Classification Filter (valid classifications only, no bare per-wheel options)
      const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
      if (classificationFilter === "refrigerated" && capability !== "Refrigerated") {
        return false;
      }
      if (classificationFilter === "dry" && capability !== "Dry") {
        return false;
      }
      if (classificationFilter === "reefer-6w" && (capability !== "Refrigerated" || truck.truckType !== "6-Wheeler")) {
        return false;
      }
      if (classificationFilter === "reefer-4w" && (capability !== "Refrigerated" || truck.truckType !== "4-Wheeler")) {
        return false;
      }
      if (classificationFilter === "dry-10w" && (capability !== "Dry" || truck.truckType !== "10-Wheeler")) {
        return false;
      }
      if (classificationFilter === "dry-4w" && (capability !== "Dry" || truck.truckType !== "4-Wheeler")) {
        return false;
      }

      // 3. Performance / Value Filter
      if (performanceFilter === "top_performing" && truck.netProfit <= 0) {
        return false;
      }
      if (performanceFilter === "high_value" && truck.totalEarnings < 50000) {
        return false;
      }
      if (performanceFilter === "active" && truck.completedTrips < 1) {
        return false;
      }

      return true;
    });
  }, [classificationFilter, performanceFilter, plateSearch, sortedTruckSummaries]);

  const sortedSubcontractedTrucks = useMemo(() => {
    const direction = subcontractedSort.direction === "asc" ? 1 : -1;

    return [...allSubcontractedTrucks].sort((left, right) =>
      String(left[subcontractedSort.key] ?? "").localeCompare(
        String(right[subcontractedSort.key] ?? ""),
      ) * direction,
    );
  }, [allSubcontractedTrucks, subcontractedSort]);

  const filteredSubcontractedTrucks = useMemo(() => {
    if (!plateSearch.trim()) return sortedSubcontractedTrucks;
    const clean = plateSearch.trim().toLowerCase().replace(/\s+/g, "");
    return sortedSubcontractedTrucks.filter(
      (t) =>
        t.plateNumber.toLowerCase().includes(plateSearch.trim().toLowerCase()) ||
        t.plateNumber.replace(/\s+/g, "").toLowerCase().includes(clean) ||
        (t.provider && t.provider.toLowerCase().includes(plateSearch.trim().toLowerCase())) ||
        (t.contactPerson &&
          t.contactPerson.toLowerCase().includes(plateSearch.trim().toLowerCase())),
    );
  }, [plateSearch, sortedSubcontractedTrucks]);

  // Summary counts
  const refrigeratedCount = useMemo(() => {
    return filteredOwnedTrucks.filter(
      (t) => getTruckStorageCapability(t.plateNumber, t.storageCapability) === "Refrigerated",
    ).length;
  }, [filteredOwnedTrucks]);

  const dryCount = useMemo(() => {
    return filteredOwnedTrucks.length - refrigeratedCount;
  }, [filteredOwnedTrucks.length, refrigeratedCount]);

  const hasActiveFilters = Boolean(
    plateSearch.trim() ||
    classificationFilter !== "all" ||
    performanceFilter !== "all" ||
    ownedTruckSort !== "netProfit"
  );

  function handleResetFilters() {
    setPlateSearch("");
    setClassificationFilter("all");
    setPerformanceFilter("all");
    setOwnedTruckSort("netProfit");
  }

  function sortSubcontractedTrucks(key: string, direction: TableSortDirection) {
    setSubcontractedSort({
      key: key as SubcontractedTruckSortKey,
      direction,
    });
  }

  async function handleCreateTruck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const normalizedPlate = plateNumber.trim().toUpperCase();
    if (!normalizedPlate) {
      setFormError("Plate number is required.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plateNumber: normalizedPlate,
          truckType,
          ownershipType,
          provider: ownershipType === "Subcontracted" ? provider : null,
          contactPerson: ownershipType === "Subcontracted" ? contactPerson : null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        truck?: FleetTruck;
      } | null;

      if (!response.ok || !payload?.ok || !payload.truck) {
        setFormError(payload?.message ?? "Unable to add truck. Please verify input.");
        return;
      }

      const registeredTruck: FleetTruck = {
        ...payload.truck,
        storageCapability,
      };

      saveBrowserPreviewTruck(registeredTruck);
      if (truckPhotoFile) {
        await saveTruckPhotoFile(payload.truck.plateNumber, truckPhotoFile);
      }
      setExtraTrucks((prev) => [...prev, registeredTruck]);

      setPlateNumber("");
      setTruckType("6-Wheeler");
      setStorageCapability("Refrigerated");
      setOwnershipType("Owned");
      setProvider("");
      setContactPerson("");
      setTruckPhotoFile(null);
      setTruckPhotoPreview(null);
      setIsAddTruckOpen(false);

      setFeedback({
        tone: "success",
        text: `Truck ${payload.truck.plateNumber} (${payload.truck.ownershipType} ${payload.truck.truckType} · ${storageCapability === "Refrigerated" ? "Cold Storage" : "Dry Cargo"}) successfully registered into the fleet.`,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to register truck.");
    } finally {
      setSubmitting(false);
    }
  }

  const isPerformanceSort = ownedTruckSort !== "plate";

  return (
    <>
      <OperationalTopbar contextLabel="Trucks" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <h1>Trucks</h1>
            <p className="subtitle">
              Manage owned and subcontracted fleet vehicles, cold storage capabilities, and profitability.
            </p>
          </div>
          {canAdd && (
            <button
              type="button"
              className="primary-action-button page-intro-action"
              onClick={() => {
                setFormError(null);
                setIsAddTruckOpen(true);
              }}
            >
              + Add Truck
            </button>
          )}
        </header>

        {feedback ? (
          <section className="notice" role={feedback.tone === "error" ? "alert" : "status"}>
            <span className="notice-icon" aria-hidden="true">
              {feedback.tone === "error" ? "!" : "i"}
            </span>
            <div>
              <strong>
                {feedback.tone === "error" ? "Action Error:" : "Fleet Updated:"}
              </strong>
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss notice"
              onClick={() => setFeedback(null)}
            >
              ×
            </button>
          </section>
        ) : null}

        {error ? (
          <section className="notice" role="alert">
            <span className="notice-icon" aria-hidden="true">!</span>
            <div><strong>Profitability data unavailable:</strong><span>{error}</span></div>
          </section>
        ) : loading ? (
          <section className="notice" role="status">
            <span className="notice-icon" aria-hidden="true">i</span>
            <div><strong>Loading trucks:</strong><span>Calculating performance from completed delivery records.</span></div>
          </section>
        ) : null}

        <section
          className={`truck-profitability-card-section${loading ? " is-loading" : ""}`}
          aria-label="Truck profitability cards"
        >
          {/* Improved Filter Toolbar */}
          <div className="truck-management-toolbar">
            <div className="records-heading">
              <div>
                <h2>Owned Trucks</h2>
                <p>Performance, financial breakdown, and cargo storage capabilities.</p>
              </div>
              <div className="truck-toolbar-summary-pill">
                <span>{filteredOwnedTrucks.length} of {allOwnedTrucks.length} trucks</span>
              </div>
            </div>

            <div className="truck-filter-controls-row">
              {/* Plate Search */}
              <div className="truck-filter-field truck-search-field">
                <label htmlFor="truck-plate-search" className="truck-filter-label">Search Plate</label>
                <div className="truck-plate-search-wrap">
                  <span className="truck-search-icon" aria-hidden="true">⌕</span>
                  <input
                    id="truck-plate-search"
                    type="search"
                    placeholder="Search by plate number…"
                    aria-label="Filter trucks by plate number"
                    value={plateSearch}
                    onChange={(e) => setPlateSearch(e.target.value)}
                  />
                  {plateSearch && (
                    <button
                      type="button"
                      onClick={() => setPlateSearch("")}
                      aria-label="Clear plate search"
                      className="truck-search-clear"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Truck Classification & Capability Filter */}
              <div className="truck-filter-field">
                <label className="truck-filter-label">Truck Classification</label>
                <RoundedSelect
                  value={classificationFilter}
                  options={TRUCK_CLASSIFICATION_FILTER_OPTIONS}
                  onChange={(value) => setClassificationFilter(value as TruckClassificationFilterKey)}
                  ariaLabel="Filter owned trucks by valid classification"
                  className="truck-classification-select"
                />
              </div>

              {/* Performance / Value Filter */}
              <div className="truck-filter-field">
                <label className="truck-filter-label">Performance Tier</label>
                <RoundedSelect
                  value={performanceFilter}
                  options={TRUCK_PERFORMANCE_FILTER_OPTIONS}
                  onChange={(value) => setPerformanceFilter(value as TruckPerformanceFilterKey)}
                  ariaLabel="Filter owned trucks by performance"
                  className="truck-performance-select"
                />
              </div>

              {/* Sort / Ranking Criteria */}
              <div className="truck-filter-field">
                <label className="truck-filter-label">Sort & Ranking</label>
                <RoundedSelect
                  value={ownedTruckSort}
                  options={OWNED_TRUCK_SORT_OPTIONS}
                  onChange={(value) => setOwnedTruckSort(value as OwnedTruckSort)}
                  ariaLabel="Sort owned trucks"
                  className="owned-truck-sort"
                />
              </div>

              {/* Reset Filters button if any filter active */}
              {hasActiveFilters && (
                <div className="truck-filter-field truck-reset-wrap">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="filter-button filter-clear truck-reset-button"
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>

            {/* Active Criteria Indicator */}
            <div className="truck-active-criteria-bar">
              <span className="truck-criteria-text">
                Ranked by: <strong>{OWNED_TRUCK_SORT_OPTIONS.find((o) => o.value === ownedTruckSort)?.label}</strong>
              </span>
              <span className="truck-criteria-count">
                {refrigeratedCount} Cold Storage · {dryCount} Dry Cargo
              </span>
            </div>
          </div>

          {loading || error ? null : filteredOwnedTrucks.length === 0 ? (
            <div className="empty-state">
              <strong>No owned trucks match the selected filters</strong>
              <span>Try clearing filters or adjusting your search criteria.</span>
            </div>
          ) : (
            <div className="fleet-card-grid truck-profitability-card-grid">
              {filteredOwnedTrucks.map((truck, index) => {
                const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
                const isRefrigerated = capability === "Refrigerated";

                return (
                  <Link
                    className="fleet-card fleet-card-link truck-profitability-card"
                    href={`/truck-profitability/${truck.plateNumber}`}
                    key={truck.plateNumber}
                  >
                    <div className="truck-card-photo-wrap">
                      <TruckPhoto plateNumber={truck.plateNumber} />
                      <span className={`truck-capability-pill ${isRefrigerated ? "refrigerated" : "ambient"}`}>
                        {isRefrigerated ? "Cold Storage" : "Dry Cargo"}
                      </span>
                      {isPerformanceSort && (
                        <span className="truck-rank-badge">
                          #{index + 1}
                        </span>
                      )}
                    </div>
                    <div className="fleet-card-body">
                      <div className="fleet-card-title">
                        <div>
                          <h2>{truck.plateNumber}</h2>
                          <div className="truck-type-meta-row">
                            <span className="truck-spec-badge">{truck.truckType}</span>
                          </div>
                        </div>
                        <span className={`fleet-status ${ownedTruckSort === "deliveries" ? "highlight-metric" : ""}`}>
                          {truck.completedTrips} trip{truck.completedTrips === 1 ? "" : "s"}
                        </span>
                      </div>
                      <dl>
                        <div className={`truck-card-revenue truck-card-metric ${ownedTruckSort === "revenue" ? "highlight-active-sort" : ""}`}>
                          <dt>Revenue</dt>
                          <dd>{formatPeso(truck.totalEarnings)}</dd>
                        </div>
                        <div className={`truck-card-metric ${ownedTruckSort === "expenses" ? "highlight-active-sort" : ""}`}>
                          <dt>Total expenses</dt>
                          <dd>{formatPeso(truck.totalExpenses)}</dd>
                        </div>
                        <div className={`truck-card-metric ${ownedTruckSort === "netProfit" ? "highlight-active-sort" : ""}`}>
                          <dt>Net profit</dt>
                          <dd>{formatPeso(truck.netProfit)}</dd>
                        </div>
                        <div className={`truck-card-metric ${ownedTruckSort === "margin" ? "highlight-active-sort" : ""}`}>
                          <dt>Profit margin</dt>
                          <dd>{formatPercent(truck.marginPercent)}</dd>
                        </div>
                      </dl>
                      <span className="fleet-card-detail-link">View details <b>›</b></span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="records-card fleet-subcontracted subcontracted-trucks-table" aria-label="Subcontracted trucks">
          <div className="records-heading">
            <div>
              <h2>Subcontracted Trucks</h2>
              <p>Reference list of external trucks, cargo capabilities, and haulers.</p>
            </div>
            <span className="truck-history-count">
              {filteredSubcontractedTrucks.length} truck
              {filteredSubcontractedTrucks.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortableTableHeader label="Plate Number" sortKey="plateNumber" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Vehicle Type" sortKey="truckType" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <th>Storage Capability</th>
                  <SortableTableHeader label="Provider" sortKey="provider" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Contact Person" sortKey="contactPerson" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                </tr>
              </thead>
              <tbody>
                {filteredSubcontractedTrucks.map((truck) => {
                  const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
                  const isRefrigerated = capability === "Refrigerated";

                  return (
                    <tr key={truck.plateNumber}>
                      <td><strong className="truck-code">{truck.plateNumber}</strong></td>
                      <td><span className="truck-table-spec">{truck.truckType}</span></td>
                      <td>
                        <span className={`truck-capability-pill-small ${isRefrigerated ? "refrigerated" : "ambient"}`}>
                          {isRefrigerated ? "Cold Storage (Reefer)" : "Dry Cargo (Ambient)"}
                        </span>
                      </td>
                      <td>{truck.provider}</td>
                      <td>{truck.contactPerson}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span>
              Showing {filteredSubcontractedTrucks.length} of {allSubcontractedTrucks.length} subcontracted trucks
            </span>
          </div>
        </section>
      </div>

      {isAddTruckOpen && (
        <div
          className="routex-dialog-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-truck-dialog-title"
        >
          <div
            className="routex-dialog-backdrop"
            onClick={() => !submitting && setIsAddTruckOpen(false)}
          />
          <div className="routex-dialog" style={{ width: "min(100%, 540px)" }}>
            <header className="routex-dialog-header">
              <div>
                <h2 id="add-truck-dialog-title">Add Fleet Truck</h2>
                <p>Register a new owned or subcontracted vehicle into the RouteX fleet.</p>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                aria-label="Close dialog"
                disabled={submitting}
                onClick={() => setIsAddTruckOpen(false)}
              >
                ×
              </button>
            </header>

            <form onSubmit={handleCreateTruck}>
              <div className="routex-dialog-body" style={{ display: "grid", gap: "16px", padding: "20px 24px" }}>
                {formError && (
                  <div className="notice" role="alert" style={{ marginBottom: "0" }}>
                    <span className="notice-icon" aria-hidden="true">!</span>
                    <div>
                      <strong>Validation Error:</strong>
                      <span>{formError}</span>
                    </div>
                  </div>
                )}

                <div className="truck-create-photo-field">
                  <div className="truck-create-photo-preview">
                    {truckPhotoPreview ? <img src={truckPhotoPreview} alt="Selected truck preview" /> : <span>No photo selected</span>}
                  </div>
                  <div className="routex-dialog-field">
                    <label htmlFor="new-truck-photo">Truck Picture</label>
                    <input
                      id="new-truck-photo"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        if (!file) return;
                        if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
                          setFormError("Choose an image file smaller than 10 MB.");
                          event.target.value = "";
                          return;
                        }
                        setFormError(null);
                        setTruckPhotoFile(file);
                        const reader = new FileReader();
                        reader.onload = () => setTruckPhotoPreview(String(reader.result));
                        reader.readAsDataURL(file);
                      }}
                    />
                    <small>You can replace the picture before saving.</small>
                  </div>
                </div>

                <div className="routex-dialog-field">
                  <label htmlFor="new-truck-plate" style={{ fontWeight: 600, fontSize: "12px" }}>
                    Plate Number *
                  </label>
                  <input
                    id="new-truck-plate"
                    type="text"
                    required
                    placeholder="e.g. NBE 4892"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                    style={{
                      minHeight: "42px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--color-border)",
                      background: "var(--glass-surface-strong)",
                      fontFamily: "var(--font-mono, monospace)",
                      fontWeight: 600,
                      letterSpacing: "0.5px",
                    }}
                  />
                  <small style={{ color: "var(--color-text-muted)", fontSize: "11px" }}>
                    Official Philippine LTO vehicle plate registration number.
                  </small>
                </div>

                <div className="routex-dialog-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div className="routex-dialog-field">
                    <label htmlFor="new-truck-type" style={{ fontWeight: 600, fontSize: "12px" }}>
                      Vehicle Size *
                    </label>
                    <RoundedSelect
                      value={truckType}
                      options={["4-Wheeler", "6-Wheeler", "10-Wheeler"]}
                      onChange={(value) => setTruckType(value as FleetTruck["truckType"])}
                      ariaLabel="Select vehicle size"
                    />
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="new-truck-capability" style={{ fontWeight: 600, fontSize: "12px" }}>
                      Storage Capability *
                    </label>
                    <RoundedSelect
                      value={storageCapability}
                      options={[
                        { value: "Refrigerated", label: "Cold Storage (Reefer)" },
                        { value: "Dry", label: "Dry / Ambient Cargo" },
                      ]}
                      onChange={(value) => setStorageCapability(value as TruckStorageCapability)}
                      ariaLabel="Select storage capability"
                    />
                  </div>
                </div>

                <div className="routex-dialog-field">
                  <label htmlFor="new-truck-ownership" style={{ fontWeight: 600, fontSize: "12px" }}>
                    Fleet Ownership *
                  </label>
                  <RoundedSelect
                    value={ownershipType}
                    options={[
                      { value: "Owned", label: "Owned" },
                      { value: "Subcontracted", label: "Subcontracted" },
                    ]}
                    onChange={(value) => setOwnershipType(value as FleetTruck["ownershipType"])}
                    ariaLabel="Select fleet ownership"
                  />
                </div>

                {ownershipType === "Subcontracted" && (
                  <div className="routex-dialog-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <div className="routex-dialog-field">
                      <label htmlFor="new-truck-provider" style={{ fontWeight: 600, fontSize: "12px" }}>
                        Hauler / Provider *
                      </label>
                      <input
                        id="new-truck-provider"
                        type="text"
                        required
                        placeholder="e.g. Northline Hauling"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        style={{
                          minHeight: "42px",
                          padding: "0 12px",
                          borderRadius: "10px",
                          border: "1px solid var(--color-border)",
                          background: "var(--glass-surface-strong)",
                        }}
                      />
                    </div>

                    <div className="routex-dialog-field">
                      <label htmlFor="new-truck-contact" style={{ fontWeight: 600, fontSize: "12px" }}>
                        Contact Person
                      </label>
                      <input
                        id="new-truck-contact"
                        type="text"
                        placeholder="e.g. Adrian Cruz"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        style={{
                          minHeight: "42px",
                          padding: "0 12px",
                          borderRadius: "10px",
                          border: "1px solid var(--color-border)",
                          background: "var(--glass-surface-strong)",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <footer className="routex-dialog-footer">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={submitting}
                  onClick={() => setIsAddTruckOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={submitting}
                >
                  {submitting ? "Adding Truck..." : "Add Truck"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
