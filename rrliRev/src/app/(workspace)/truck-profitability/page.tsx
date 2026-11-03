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
import { TruckPhoto } from "@/components/truck-photo";
import {
  BROWSER_PREVIEW_TRUCKS_CHANGED,
  readBrowserPreviewTrucks,
  saveBrowserPreviewTruck,
} from "@/features/deliveries/browser-preview-trucks";
import { summarizeTruckProfitability } from "@/features/deliveries/delivery-domain";
import {
  OWNED_TRUCKS,
  SUBCONTRACTED_TRUCKS,
  type FleetTruck,
} from "@/features/deliveries/truck-registry";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { canManageTrucks } from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";

type SubcontractedTruckSortKey = Extract<
  keyof FleetTruck,
  "plateNumber" | "truckType" | "provider" | "contactPerson"
>;

type OwnedTruckSort =
  | "plate"
  | "revenue"
  | "expenses"
  | "netProfit"
  | "margin"
  | "deliveries";

const OWNED_TRUCK_SORT_OPTIONS = [
  { value: "plate", label: "Plate A–Z" },
  { value: "revenue", label: "Highest revenue" },
  { value: "expenses", label: "Highest expenses" },
  { value: "netProfit", label: "Highest net profit" },
  { value: "margin", label: "Highest profit margin" },
  { value: "deliveries", label: "Most deliveries" },
] as const;

export default function TruckProfitabilityPage() {
  const actor = useAuthenticatedActor();
  const canAdd = canManageTrucks(actor.role);

  const { range } = useGlobalDateRange();
  const { deliveries: dateFilteredTrips, loading, error } = usePersistedDeliveries(range);
  const [ownedTruckSort, setOwnedTruckSort] = useState<OwnedTruckSort>("plate");
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

  // Form states
  const [plateNumber, setPlateNumber] = useState("");
  const [truckType, setTruckType] = useState<FleetTruck["truckType"]>("6-Wheeler");
  const [ownershipType, setOwnershipType] = useState<FleetTruck["ownershipType"]>("Owned");
  const [provider, setProvider] = useState("");
  const [contactPerson, setContactPerson] = useState("");

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
      if (existing) return existing;
      return {
        plateNumber: truck.plateNumber,
        truckType: truck.truckType,
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
        merged.push(summary);
      }
    }

    return merged.sort((left, right) => {
      switch (ownedTruckSort) {
        case "revenue":
          return right.totalEarnings - left.totalEarnings;
        case "expenses":
          return right.totalExpenses - left.totalExpenses;
        case "netProfit":
          return right.netProfit - left.netProfit;
        case "margin":
          return (right.marginPercent ?? Number.NEGATIVE_INFINITY) -
            (left.marginPercent ?? Number.NEGATIVE_INFINITY);
        case "deliveries":
          return right.completedTrips - left.completedTrips ||
            left.plateNumber.localeCompare(right.plateNumber);
        case "plate":
        default:
          return left.plateNumber.localeCompare(right.plateNumber);
      }
    });
  }, [allOwnedTrucks, ownedTruckSort, truckSummaries]);

  const sortedSubcontractedTrucks = useMemo(() => {
    const direction = subcontractedSort.direction === "asc" ? 1 : -1;

    return [...allSubcontractedTrucks].sort((left, right) =>
      String(left[subcontractedSort.key] ?? "").localeCompare(
        String(right[subcontractedSort.key] ?? ""),
      ) * direction,
    );
  }, [allSubcontractedTrucks, subcontractedSort]);

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

      saveBrowserPreviewTruck(payload.truck);
      setExtraTrucks((prev) => [...prev, payload.truck!]);

      setPlateNumber("");
      setTruckType("6-Wheeler");
      setOwnershipType("Owned");
      setProvider("");
      setContactPerson("");
      setIsAddTruckOpen(false);

      setFeedback({
        tone: "success",
        text: `Truck ${payload.truck.plateNumber} (${payload.truck.ownershipType} ${payload.truck.truckType}) successfully registered into the fleet.`,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to register truck.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <OperationalTopbar contextLabel="Trucks" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <h1>Trucks</h1>
            <p className="subtitle">
              View owned and subcontracted trucks.
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
          <div className="records-heading">
            <div>
              <h2>Owned Trucks</h2>
              <p>Select a truck to view details.</p>
            </div>
            <RoundedSelect
              value={ownedTruckSort}
              options={OWNED_TRUCK_SORT_OPTIONS}
              onChange={(value) => setOwnedTruckSort(value as OwnedTruckSort)}
              ariaLabel="Sort owned trucks"
              className="owned-truck-sort"
            />
          </div>

          {loading || error ? null : sortedTruckSummaries.length === 0 ? (
            <div className="empty-state">
              <strong>No owned trucks in fleet</strong>
              <span>Add a truck using the button above to begin tracking fleet profitability.</span>
            </div>
          ) : (
            <div className="fleet-card-grid truck-profitability-card-grid">
              {sortedTruckSummaries.map((truck) => (
                <Link
                  className="fleet-card fleet-card-link truck-profitability-card"
                  href={`/truck-profitability/${truck.plateNumber}`}
                  key={truck.plateNumber}
                >
                  <TruckPhoto plateNumber={truck.plateNumber} />
                  <div className="fleet-card-body">
                    <div className="fleet-card-title">
                      <div>
                        <h2>{truck.plateNumber}</h2>
                        <p>{truck.truckType}</p>
                      </div>
                      <span className="fleet-status">
                        {truck.completedTrips} trip{truck.completedTrips === 1 ? "" : "s"}
                      </span>
                    </div>
                    <dl>
                      <div className="truck-card-revenue"><dt>Revenue</dt><dd>{formatPeso(truck.totalEarnings)}</dd></div>
                      <div><dt>Total expenses</dt><dd>{formatPeso(truck.totalExpenses)}</dd></div>
                      <div><dt>Net profit</dt><dd>{formatPeso(truck.netProfit)}</dd></div>
                      <div><dt>Profit margin</dt><dd>{formatPercent(truck.marginPercent)}</dd></div>
                    </dl>
                    <span className="fleet-card-detail-link">View details <b>›</b></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="records-card fleet-subcontracted subcontracted-trucks-table" aria-label="Subcontracted trucks">
          <div className="records-heading">
            <div>
              <h2>Subcontracted Trucks</h2>
              <p>Reference list of external trucks.</p>
            </div>
            <span className="truck-history-count">{allSubcontractedTrucks.length} trucks</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortableTableHeader label="Plate Number" sortKey="plateNumber" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Vehicle Type" sortKey="truckType" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Provider" sortKey="provider" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Contact Person" sortKey="contactPerson" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                </tr>
              </thead>
              <tbody>
                {sortedSubcontractedTrucks.map((truck) => (
                  <tr key={truck.plateNumber}>
                    <td><strong className="truck-code">{truck.plateNumber}</strong></td>
                    <td>{truck.truckType}</td>
                    <td>{truck.provider}</td>
                    <td>{truck.contactPerson}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span>Showing {allSubcontractedTrucks.length} subcontracted trucks</span>
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
                      Vehicle Type *
                    </label>
                    <select
                      id="new-truck-type"
                      value={truckType}
                      onChange={(e) => setTruckType(e.target.value as FleetTruck["truckType"])}
                      style={{
                        minHeight: "42px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border)",
                        background: "var(--glass-surface-strong)",
                        cursor: "pointer",
                      }}
                    >
                      <option value="4-Wheeler">4-Wheeler</option>
                      <option value="6-Wheeler">6-Wheeler</option>
                      <option value="10-Wheeler">10-Wheeler</option>
                    </select>
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="new-truck-ownership" style={{ fontWeight: 600, fontSize: "12px" }}>
                      Fleet Ownership *
                    </label>
                    <select
                      id="new-truck-ownership"
                      value={ownershipType}
                      onChange={(e) => setOwnershipType(e.target.value as FleetTruck["ownershipType"])}
                      style={{
                        minHeight: "42px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--color-border)",
                        background: "var(--glass-surface-strong)",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Owned">Owned (Company Fleet Asset · Redeemed Rate)</option>
                      <option value="Subcontracted">Subcontracted (Third-Party Hauler · Trucker Rate)</option>
                    </select>
                  </div>
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
