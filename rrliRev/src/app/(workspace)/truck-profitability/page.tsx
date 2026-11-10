"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useAuthenticatedActor } from "@/components/auth-context";
import { useGlobalDateRange } from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import { TablePagination } from "@/components/table-pagination";
import {
  SortableTableHeader,
  type TableSortDirection,
} from "@/components/sortable-table-header";
import {
  OWNED_TRUCK_SORT_OPTIONS,
  type OwnedTruckSort,
} from "@/components/truck-filter-dropdown";
import { saveTruckPhotoFile, TruckPhoto } from "@/components/truck-photo";
import {
  BROWSER_PREVIEW_TRUCKS_CHANGED,
  deleteBrowserPreviewTruck,
  readBrowserDeletedTrucks,
  readBrowserPreviewTrucks,
  saveBrowserPreviewTruck,
} from "@/features/deliveries/browser-preview-trucks";
import { readBrowserPreviewDeliveries } from "@/features/deliveries/browser-preview-deliveries";
import {
  applyBrowserCrewStatuses,
  BROWSER_CREW_STATUS_CHANGED,
  saveBrowserCrewStatus,
} from "@/features/deliveries/browser-preview-crew";
import { parsePersonnelNames } from "@/components/delivery-crew-section";
import {
  isDeliveryFinanciallyComplete,
  summarizeTruckProfitability,
} from "@/features/deliveries/delivery-domain";
import {
  getFleetCrew,
  getFleetDrivers,
  type FleetCrewMember,
  type FleetDriver,
} from "@/features/deliveries/driver-registry";
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

  // Deletion state
  const [truckToDelete, setTruckToDelete] = useState<{ plateNumber: string; truckType: string } | null>(null);
  const [isDeletingTruck, setIsDeletingTruck] = useState(false);
  const [deletedPlates, setDeletedPlates] = useState<Set<string>>(new Set());

  // Fleet Crew (Drivers & Helpers) state
  const [crew, setCrew] = useState<FleetCrewMember[]>(() => [...getFleetCrew()]);
  const [crewRoleFilter, setCrewRoleFilter] = useState<"All" | "Driver" | "Helper">("All");
  const [isAddCrewOpen, setIsAddCrewOpen] = useState(false);
  const [crewFullName, setCrewFullName] = useState("");
  const [crewRole, setCrewRole] = useState<"Driver" | "Helper">("Driver");
  const [crewContact, setCrewContact] = useState("");
  const [crewSubmitting, setCrewSubmitting] = useState(false);
  const [crewFormError, setCrewFormError] = useState<string | null>(null);
  const [openCrewActionId, setOpenCrewActionId] = useState<string | null>(null);
  const [crewStatusPendingId, setCrewStatusPendingId] = useState<string | null>(null);

  const filteredCrew = useMemo(() => {
    if (crewRoleFilter === "All") return crew;
    return crew.filter((c) => c.assignmentType === crewRoleFilter);
  }, [crew, crewRoleFilter]);

  const [crewPage, setCrewPage] = useState(1);
  const CREW_PAGE_SIZE = 10;
  const crewPageCount = Math.max(1, Math.ceil(filteredCrew.length / CREW_PAGE_SIZE));

  useEffect(() => {
    setCrewPage(1);
  }, [crewRoleFilter]);

  const paginatedCrew = useMemo(() => {
    const start = (crewPage - 1) * CREW_PAGE_SIZE;
    return filteredCrew.slice(start, start + CREW_PAGE_SIZE);
  }, [filteredCrew, crewPage]);

  const driverCount = useMemo(
    () => crew.filter((c) => c.assignmentType === "Driver").length,
    [crew],
  );
  const helperCount = useMemo(
    () => crew.filter((c) => c.assignmentType === "Helper").length,
    [crew],
  );

  async function handleToggleCrewActive(member: FleetCrewMember) {
    if (crewStatusPendingId) return;
    const nextActive = !member.isActive;
    const browserLocal = /^(driver|helper)-/.test(member.id);
    setCrewStatusPendingId(member.id);
    setOpenCrewActionId(null);
    try {
      const response = await fetch("/api/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crewMemberId: member.id, isActive: nextActive, browserLocal }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "Unable to update crew status.");

      saveBrowserCrewStatus(member.id, nextActive);
      setCrew((current) => current.map((item) => item.id === member.id ? { ...item, isActive: nextActive } : item));
      setFeedback({
        tone: "success",
        text: `${member.fullName} was ${nextActive ? "reactivated" : "deactivated"}.`,
      });
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Unable to update crew status." });
    } finally {
      setCrewStatusPendingId(null);
    }
  }

  // Add Truck Form states
  const [plateNumber, setPlateNumber] = useState("");
  const [truckType, setTruckType] = useState<FleetTruck["truckType"]>("6-Wheeler");
  const [storageCapability, setStorageCapability] = useState<TruckStorageCapability>("Refrigerated");
  const [ownershipType, setOwnershipType] = useState<FleetTruck["ownershipType"]>("Owned");
  const [provider, setProvider] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [truckPhotoFile, setTruckPhotoFile] = useState<File | null>(null);
  const [truckPhotoPreview, setTruckPhotoPreview] = useState<string | null>(null);

  // Automatically harvest any drivers and helpers already recorded in deliveries
  useEffect(() => {
    const localDeliveries = readBrowserPreviewDeliveries();
    const allDeliveries = [...localDeliveries, ...(dateFilteredTrips || [])];

    setCrew((prev) => {
      const seen = new Set(prev.map((c) => `${c.assignmentType}:${c.fullName.toLowerCase()}`));
      const additional: FleetCrewMember[] = [];

      for (const trip of allDeliveries) {
        if (trip.driverName) {
          const names = parsePersonnelNames(trip.driverName);
          for (const name of names) {
            const key = `Driver:${name.toLowerCase()}`;
            if (!seen.has(key)) {
              seen.add(key);
              const count =
                prev.filter((c) => c.assignmentType === "Driver").length +
                additional.filter((c) => c.assignmentType === "Driver").length +
                1;
              additional.push({
                id: `driver-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                employeeCode: `DRV-${String(count).padStart(2, "0")}`,
                fullName: name,
                assignmentType: "Driver",
                contactNumber: null,
                isActive: true,
              });
            }
          }
        }

        if (trip.helperName) {
          const names = parsePersonnelNames(trip.helperName);
          for (const name of names) {
            const key = `Helper:${name.toLowerCase()}`;
            if (!seen.has(key)) {
              seen.add(key);
              const count =
                prev.filter((c) => c.assignmentType === "Helper").length +
                additional.filter((c) => c.assignmentType === "Helper").length +
                1;
              additional.push({
                id: `helper-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                employeeCode: `HLP-${String(count).padStart(2, "0")}`,
                fullName: name,
                assignmentType: "Helper",
                contactNumber: null,
                isActive: true,
              });
            }
          }
        }
      }

      if (additional.length === 0) return prev;
      return [...prev, ...additional];
    });
  }, [dateFilteredTrips]);

  useEffect(() => {
    const syncLocal = () => {
      setExtraTrucks(readBrowserPreviewTrucks());
      setDeletedPlates(new Set(readBrowserDeletedTrucks().map((p) => p.toUpperCase())));
    };
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

    fetch("/api/drivers")
      .then((res) => res.json())
      .then((data: { ok?: boolean; drivers?: FleetCrewMember[]; crew?: FleetCrewMember[] }) => {
        const incoming = data?.crew ?? data?.drivers;
        if (data?.ok && Array.isArray(incoming)) {
          setCrew((prev) => {
            const incomingByKey = new Map(incoming.map((member) => [`${member.assignmentType}:${member.fullName.toLowerCase()}`, member]));
            const merged = prev.map((member) => incomingByKey.get(`${member.assignmentType}:${member.fullName.toLowerCase()}`) ?? member);
            const seen = new Set(merged.map((member) => `${member.assignmentType}:${member.fullName.toLowerCase()}`));
            return applyBrowserCrewStatuses([
              ...merged,
              ...incoming.filter((member) => !seen.has(`${member.assignmentType}:${member.fullName.toLowerCase()}`)),
            ]);
          });
        }
      })
      .catch(() => {});

    const syncCrewStatuses = () => setCrew((current) => applyBrowserCrewStatuses(current));

    window.addEventListener(BROWSER_PREVIEW_TRUCKS_CHANGED, syncLocal);
    window.addEventListener(BROWSER_CREW_STATUS_CHANGED, syncCrewStatuses);
    window.addEventListener("storage", syncLocal);
    window.addEventListener("storage", syncCrewStatuses);
    return () => {
      window.removeEventListener(BROWSER_PREVIEW_TRUCKS_CHANGED, syncLocal);
      window.removeEventListener(BROWSER_CREW_STATUS_CHANGED, syncCrewStatuses);
      window.removeEventListener("storage", syncLocal);
      window.removeEventListener("storage", syncCrewStatuses);
    };
  }, []);

  const allOwnedTrucks = useMemo(() => {
    const extra = extraTrucks.filter((t) => t.ownershipType === "Owned");
    const unique = new Map<string, FleetTruck>();
    for (const truck of [...OWNED_TRUCKS, ...extra]) {
      unique.set(truck.plateNumber.trim().toUpperCase(), truck);
    }
    return [...unique.values()].filter((t) => !deletedPlates.has(t.plateNumber.toUpperCase()));
  }, [extraTrucks, deletedPlates]);

  const allSubcontractedTrucks = useMemo(() => {
    const extra = extraTrucks.filter((t) => t.ownershipType === "Subcontracted");
    const unique = new Map<string, FleetTruck>();
    for (const truck of [...SUBCONTRACTED_TRUCKS, ...extra]) {
      unique.set(truck.plateNumber.trim().toUpperCase(), truck);
    }
    return [...unique.values()].filter((t) => !deletedPlates.has(t.plateNumber.toUpperCase()));
  }, [extraTrucks, deletedPlates]);

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
      const truckTrips = dateFilteredTrips.filter(
        (t) =>
          t.plateNumber.trim().replace(/\s+/g, " ").toUpperCase() === truck.plateNumber.trim().replace(/\s+/g, " ").toUpperCase() ||
          t.plateNumber.replace(/\s+/g, "").toUpperCase() === truck.plateNumber.replace(/\s+/g, "").toUpperCase(),
      );
      const dropoffsCount = truckTrips.reduce((sum, t) => sum + (t.dropoffs?.length ?? 0), 0);
      const pendingTrips = truckTrips.filter((t) => !isDeliveryFinanciallyComplete(t));
      const pendingEarnings = pendingTrips.reduce((sum, t) => sum + (t.deliveryRate ?? 0), 0);

      if (existing) {
        return {
          ...existing,
          completedTrips: Math.max(existing.completedTrips, truckTrips.length),
          totalStoresServed: Math.max(existing.totalStoresServed, dropoffsCount),
          storageCapability: capability,
          pendingEarnings,
        };
      }
      const finalizedTrips = truckTrips.filter(isDeliveryFinanciallyComplete);
      const finalizedEarnings = finalizedTrips.reduce((sum, t) => sum + (t.deliveryRate ?? 0), 0);
      const finalizedExpenses = finalizedTrips.reduce((sum, t) => sum + (t.totalExpenses ?? 0), 0);
      const netProfit = finalizedEarnings - finalizedExpenses;

      return {
        plateNumber: truck.plateNumber,
        truckType: truck.truckType,
        storageCapability: capability,
        completedTrips: truckTrips.length,
        totalEarnings: finalizedEarnings,
        pendingEarnings,
        totalExpenses: finalizedExpenses,
        netProfit,
        marginPercent: finalizedEarnings > 0 ? (netProfit / finalizedEarnings) * 100 : null,
        totalStoresServed: dropoffsCount,
        totalDistanceKm: truckTrips.reduce((sum, t) => sum + (t.distanceKm ?? 0), 0),
      };
    });

    for (const summary of truckSummaries) {
      if (deletedPlates.has(summary.plateNumber.toUpperCase())) continue;
      if (!merged.some((t) => t.plateNumber.toUpperCase() === summary.plateNumber.toUpperCase())) {
        const capability = getTruckStorageCapability(summary.plateNumber);
        const truckTrips = dateFilteredTrips.filter(
          (t) =>
            t.plateNumber.trim().replace(/\s+/g, " ").toUpperCase() === summary.plateNumber.trim().replace(/\s+/g, " ").toUpperCase() ||
            t.plateNumber.replace(/\s+/g, "").toUpperCase() === summary.plateNumber.replace(/\s+/g, "").toUpperCase(),
        );
        const pendingTrips = truckTrips.filter((t) => !isDeliveryFinanciallyComplete(t));
        const pendingEarnings = pendingTrips.reduce((sum, t) => sum + (t.deliveryRate ?? 0), 0);
        merged.push({
          ...summary,
          storageCapability: capability,
          pendingEarnings,
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
  }, [allOwnedTrucks, deletedPlates, ownedTruckSort, truckSummaries]);

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

  const [subcontractedPage, setSubcontractedPage] = useState(1);
  const SUBCONTRACTED_PAGE_SIZE = 10;
  const subcontractedPageCount = Math.max(1, Math.ceil(filteredSubcontractedTrucks.length / SUBCONTRACTED_PAGE_SIZE));

  useEffect(() => {
    setSubcontractedPage(1);
  }, [plateSearch, subcontractedSort]);

  const paginatedSubcontractedTrucks = useMemo(() => {
    const start = (subcontractedPage - 1) * SUBCONTRACTED_PAGE_SIZE;
    return filteredSubcontractedTrucks.slice(start, start + SUBCONTRACTED_PAGE_SIZE);
  }, [filteredSubcontractedTrucks, subcontractedPage]);

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
          storageCapability,
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

  async function handleConfirmDeleteTruck() {
    if (!truckToDelete) return;
    setIsDeletingTruck(true);
    try {
      const browserLocal = readBrowserPreviewTrucks().some(
        (truck) => truck.plateNumber.toUpperCase() === truckToDelete.plateNumber.toUpperCase(),
      );
      const deleteParams = new URLSearchParams({
        plateNumber: truckToDelete.plateNumber,
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

      deleteBrowserPreviewTruck(truckToDelete.plateNumber);
      setDeletedPlates((prev) => new Set([...prev, truckToDelete.plateNumber.toUpperCase()]));
      setFeedback({
        tone: "success",
        text: `Truck ${truckToDelete.plateNumber} was deleted successfully.`,
      });
      setTruckToDelete(null);
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to delete truck.",
      });
    } finally {
      setIsDeletingTruck(false);
    }
  }

  async function handleCreateCrew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCrewFormError(null);
    const normalizedName = crewFullName.trim();
    if (normalizedName.length < 2) {
      setCrewFormError(`${crewRole} name must be at least 2 characters.`);
      return;
    }

    setCrewSubmitting(true);
    try {
      const response = await fetch("/api/drivers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-actor-role": actor.role,
          "x-actor-username": actor.username,
        },
        body: JSON.stringify({
          fullName: normalizedName,
          assignmentType: crewRole,
          contactNumber: crewContact.trim() || null,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        driver?: FleetCrewMember;
        crew?: FleetCrewMember;
      } | null;

      const registered = data?.crew ?? data?.driver;

      if (!response.ok || !data?.ok || !registered) {
        setCrewFormError(data?.message ?? `Unable to add ${crewRole.toLowerCase()}. Please verify input.`);
        return;
      }

      setCrew((prev) => {
        if (prev.some((c) => c.assignmentType === registered.assignmentType && c.fullName.toLowerCase() === registered.fullName.toLowerCase())) {
          return prev;
        }
        return [...prev, registered];
      });

      setCrewFullName("");
      setCrewContact("");
      setIsAddCrewOpen(false);

      setFeedback({
        tone: "success",
        text: `${registered.assignmentType} "${registered.fullName}" was successfully registered into the fleet.`,
      });
    } catch (err) {
      setCrewFormError(err instanceof Error ? err.message : `Failed to register ${crewRole.toLowerCase()}.`);
    } finally {
      setCrewSubmitting(false);
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
              Fleet vehicles, storage capabilities, and profitability.
            </p>
          </div>
          {canAdd && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                className="secondary-button page-intro-action"
                data-tooltip="Add new driver or helper to the fleet roster"
                title="Add new driver or helper to the fleet roster"
                onClick={() => {
                  setCrewFormError(null);
                  setCrewFullName("");
                  setCrewContact("");
                  setCrewRole("Driver");
                  setIsAddCrewOpen(true);
                }}
              >
                + Add Driver / Helper
              </button>
              <button
                type="button"
                className="primary-action-button page-intro-action"
                data-tooltip="Register an owned or subcontracted vehicle"
                title="Register an owned or subcontracted vehicle"
                onClick={() => {
                  setFormError(null);
                  setIsAddTruckOpen(true);
                }}
              >
                + Add Truck
              </button>
            </div>
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
              title="Dismiss notice"
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
          {/* Deliveries-style Filter Toolbar */}
          <div className="truck-management-toolbar">
            <div className="records-heading">
              <div className="records-heading-copy">
                <h2>Owned Trucks</h2>
                <p>Performance and storage capabilities.</p>
              </div>
              <div className="records-heading-meta">
                <span className="ledger-total-badge">
                  {filteredOwnedTrucks.length} of {allOwnedTrucks.length} trucks · {refrigeratedCount} Cold Storage · {dryCount} Dry Cargo
                </span>
              </div>
            </div>

            <div className="filters truck-filters">
              <label className="search-box">
                <span className="sr-only">Search by plate number</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  placeholder="Search by plate number…"
                  aria-label="Filter trucks by plate number"
                  title="Filter trucks by plate number"
                  value={plateSearch}
                  onChange={(e) => setPlateSearch(e.target.value)}
                />
              </label>

              <div className="filter-select-wrapper" style={{ minWidth: "165px" }}>
                <RoundedSelect
                  value={classificationFilter}
                  options={TRUCK_CLASSIFICATION_FILTER_OPTIONS}
                  onChange={(val) => setClassificationFilter(val as TruckClassificationFilterKey)}
                  ariaLabel="Filter trucks by vehicle type"
                  placeholder="All Vehicle Types"
                />
              </div>

              <div className="filter-select-wrapper" style={{ minWidth: "185px" }}>
                <RoundedSelect
                  value={performanceFilter}
                  options={TRUCK_PERFORMANCE_FILTER_OPTIONS}
                  onChange={(val) => setPerformanceFilter(val as TruckPerformanceFilterKey)}
                  ariaLabel="Filter trucks by profit margin tier"
                  placeholder="All Margin Tiers"
                />
              </div>

              <div className="filter-select-wrapper" style={{ minWidth: "195px" }}>
                <RoundedSelect
                  value={ownedTruckSort}
                  options={OWNED_TRUCK_SORT_OPTIONS}
                  onChange={(val) => setOwnedTruckSort(val as OwnedTruckSort)}
                  ariaLabel="Sort owned trucks"
                  placeholder="Sort by"
                />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="filter-clear-action-btn"
                  onClick={handleResetFilters}
                  aria-label="Clear all truck filters"
                  title="Clear all active truck filters"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span>Clear filters</span>
                </button>
              )}

            </div>

            {hasActiveFilters && (
              <div className="active-filter-chips" aria-label="Active filters">
                <span className="active-chips-label">Active filters:</span>
                {plateSearch.trim() && (
                  <span className="filter-chip">
                    <span className="filter-chip-category">Plate:</span> {plateSearch.trim()}
                    <button
                      type="button"
                      className="filter-chip-remove"
                      aria-label="Remove plate search"
                      title="Remove plate search filter"
                      onClick={() => setPlateSearch("")}
                    >
                      ×
                    </button>
                  </span>
                )}
                {classificationFilter !== "all" && (
                  <span className="filter-chip">
                    <span className="filter-chip-category">Type:</span>{" "}
                    {TRUCK_CLASSIFICATION_FILTER_OPTIONS.find((o) => o.value === classificationFilter)?.label ?? classificationFilter}
                    <button
                      type="button"
                      className="filter-chip-remove"
                      aria-label="Remove classification filter"
                      title="Remove classification filter"
                      onClick={() => setClassificationFilter("all")}
                    >
                      ×
                    </button>
                  </span>
                )}
                {performanceFilter !== "all" && (
                  <span className="filter-chip">
                    <span className="filter-chip-category">Tier:</span>{" "}
                    {TRUCK_PERFORMANCE_FILTER_OPTIONS.find((o) => o.value === performanceFilter)?.label ?? performanceFilter}
                    <button
                      type="button"
                      className="filter-chip-remove"
                      aria-label="Remove performance tier filter"
                      title="Remove performance tier filter"
                      onClick={() => setPerformanceFilter("all")}
                    >
                      ×
                    </button>
                  </span>
                )}
                {ownedTruckSort !== "netProfit" && (
                  <span className="filter-chip">
                    <span className="filter-chip-category">Sort:</span>{" "}
                    {OWNED_TRUCK_SORT_OPTIONS.find((o) => o.value === ownedTruckSort)?.label ?? ownedTruckSort}
                    <button
                      type="button"
                      className="filter-chip-remove"
                      aria-label="Reset sort to default"
                      title="Reset truck sort order to default"
                      onClick={() => setOwnedTruckSort("netProfit")}
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {loading || error ? null : filteredOwnedTrucks.length === 0 ? (
            <div className="empty-state" title="No owned trucks match the current filter criteria">
              <strong>No owned trucks match the selected filters</strong>
              <span>Try clearing filters or adjusting your search criteria.</span>
            </div>
          ) : (
            <div className="fleet-card-grid truck-profitability-card-grid">
              {filteredOwnedTrucks.map((truck, index) => {
                const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
                const isRefrigerated = capability === "Refrigerated";

                return (
                  <div
                    className="fleet-card truck-profitability-card"
                    key={truck.plateNumber}
                    style={{ position: "relative" }}
                  >
                    <Link
                      className="fleet-card-link"
                      href={`/truck-profitability/${truck.plateNumber}`}
                      title={`View financial and trip details for truck ${truck.plateNumber}`}
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
                            {truck.pendingEarnings > 0 ? (
                              <span
                                className="truck-card-pending-revenue"
                                title={`₱${truck.pendingEarnings.toLocaleString()} pending from incomplete delivery runs not yet included in finalized totals`}
                                style={{
                                  display: "block",
                                  fontSize: "11px",
                                  color: "var(--color-accent, #d97706)",
                                  marginTop: "2px",
                                  fontWeight: 500,
                                }}
                              >
                                + {formatPeso(truck.pendingEarnings)} pending
                              </span>
                            ) : null}
                          </div>
                          <div className={`truck-card-metric ${ownedTruckSort === "expenses" ? "highlight-active-sort" : ""}`}>
                            <dt>Expenses</dt>
                            <dd>{formatPeso(truck.totalExpenses)}</dd>
                          </div>
                          <div className={`truck-card-metric ${ownedTruckSort === "netProfit" ? "highlight-active-sort" : ""}`}>
                            <dt>Net Profit</dt>
                            <dd>{formatPeso(truck.netProfit)}</dd>
                          </div>
                          <div className={`truck-card-metric ${ownedTruckSort === "margin" ? "highlight-active-sort" : ""}`}>
                            <dt>Profit Margin</dt>
                            <dd>{formatPercent(truck.marginPercent)}</dd>
                          </div>
                        </dl>
                        <span className="fleet-card-detail-link">View details <b>›</b></span>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="records-card fleet-subcontracted subcontracted-trucks-table" aria-label="Subcontracted trucks">
          <div className="records-heading">
            <div>
              <h2>Subcontracted Trucks</h2>
              <p>External trucks and haulers.</p>
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
                  {actor.role === "admin" && <th style={{ width: "56px", textAlign: "center" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedSubcontractedTrucks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={actor.role === "admin" ? 6 : 5}
                      style={{ textAlign: "center", padding: "24px", color: "var(--color-text-muted)" }}
                      title="No subcontracted trucks registered in the fleet"
                    >
                      No subcontracted trucks registered yet.
                    </td>
                  </tr>
                ) : (
                  paginatedSubcontractedTrucks.map((truck) => {
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
                      {actor.role === "admin" && (
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="icon-only-action compact danger ui-tooltip"
                            aria-label={`Delete truck ${truck.plateNumber}`}
                            data-tooltip="Delete truck"
                            title={`Delete truck ${truck.plateNumber}`}
                            onClick={() => setTruckToDelete({ plateNumber: truck.plateNumber, truckType: truck.truckType })}
                          >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M4 7h16M9 7V4.5h6V7m3 0-1 13H7L6 7m4 4v5m4-5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
          {filteredSubcontractedTrucks.length > 0 ? (
            <TablePagination
              page={subcontractedPage}
              pageCount={subcontractedPageCount}
              totalItems={filteredSubcontractedTrucks.length}
              pageSize={SUBCONTRACTED_PAGE_SIZE}
              onPageChange={setSubcontractedPage}
              itemLabel="subcontracted trucks"
              itemCountInPage={paginatedSubcontractedTrucks.length}
            />
          ) : null}
        </section>

        <section className="records-card fleet-drivers-section" aria-label="Fleet crew" style={{ marginTop: "24px" }}>
          <div className="records-heading">
            <div>
              <h2>Fleet Crew (Drivers &amp; Helpers)</h2>
              <p>Registered drivers and helpers.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div className="crew-role-filter-pills" role="tablist" aria-label="Filter crew by role">
                <button
                  type="button"
                  role="tab"
                  aria-selected={crewRoleFilter === "All"}
                  className={`crew-role-tab ${crewRoleFilter === "All" ? "active" : ""}`}
                  title="Show all fleet crew members"
                  onClick={() => setCrewRoleFilter("All")}
                >
                  All ({crew.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={crewRoleFilter === "Driver"}
                  className={`crew-role-tab ${crewRoleFilter === "Driver" ? "active" : ""}`}
                  title="Show only drivers"
                  onClick={() => setCrewRoleFilter("Driver")}
                >
                  <span className="crew-role-dot driver" aria-hidden="true" />
                  Drivers ({driverCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={crewRoleFilter === "Helper"}
                  className={`crew-role-tab ${crewRoleFilter === "Helper" ? "active" : ""}`}
                  title="Show only helpers"
                  onClick={() => setCrewRoleFilter("Helper")}
                >
                  <span className="crew-role-dot helper" aria-hidden="true" />
                  Helpers ({helperCount})
                </button>
              </div>

              {canAdd && (
                <button
                  type="button"
                  className="secondary-button ui-tooltip"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  data-tooltip="Add new driver or helper to the fleet roster"
                  title="Add new driver or helper to the fleet roster"
                  onClick={() => {
                    setCrewFormError(null);
                    setCrewFullName("");
                    setCrewContact("");
                    setCrewRole("Driver");
                    setIsAddCrewOpen(true);
                  }}
                >
                  + Add Driver / Helper
                </button>
              )}
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Crew Member</th>
                  <th>Role</th>
                  <th>Employee Code</th>
                  <th>Contact Number</th>
                  <th>Status</th>
                  <th><span className="sr-only">More actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredCrew.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--color-text-muted)" }}>
                      No {crewRoleFilter === "All" ? "crew members" : crewRoleFilter.toLowerCase() + "s"} registered yet.
                    </td>
                  </tr>
                ) : (
                  paginatedCrew.map((member) => (
                    <tr key={member.id || `${member.assignmentType}-${member.fullName}`}>
                      <td><strong className="truck-code">{member.fullName}</strong></td>
                      <td>
                        <span
                          className={`crew-role-badge ${member.assignmentType.toLowerCase()}`}
                          style={{ display: "inline-block", fontSize: "11px", padding: "2px 8px" }}
                        >
                          {member.assignmentType}
                        </span>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "11px", color: "var(--color-text-secondary)" }}>
                        {member.employeeCode}
                      </td>
                      <td title={member.contactNumber ? undefined : "No contact number recorded"}>
                        {member.contactNumber || "—"}
                      </td>
                      <td>
                        <span className={`detail-status ${member.isActive ? "success" : "neutral"}`} style={{ fontSize: "10px" }}>
                          {member.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="table-row-actions" style={{ position: "relative", display: "inline-block" }}>
                          <button
                            type="button"
                            className="row-action-more-btn"
                            aria-label={`More actions for ${member.fullName}`}
                            title={`More actions for ${member.fullName}`}
                            aria-haspopup="menu"
                            aria-expanded={openCrewActionId === member.id}
                            disabled={crewStatusPendingId === member.id}
                            onClick={() => setOpenCrewActionId((current) => current === member.id ? null : member.id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                              <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
                            </svg>
                          </button>
                          {openCrewActionId === member.id ? (
                            <div className="row-action-menu" role="menu" aria-label={`Actions for ${member.fullName}`}>
                              <button type="button" role="menuitem" onClick={() => handleToggleCrewActive(member)}>
                                {member.isActive ? `Deactivate ${member.assignmentType}` : `Reactivate ${member.assignmentType}`}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredCrew.length > 0 ? (
            <TablePagination
              page={crewPage}
              pageCount={crewPageCount}
              totalItems={filteredCrew.length}
              pageSize={CREW_PAGE_SIZE}
              onPageChange={setCrewPage}
              itemLabel="crew members"
              itemCountInPage={paginatedCrew.length}
            />
          ) : null}
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
          <div className="routex-dialog add-truck-dialog">
            <header className="routex-dialog-header">
              <div>
                <h2 id="add-truck-dialog-title">Add Fleet Truck</h2>
                <p>Register vehicle into fleet.</p>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                aria-label="Close dialog"
                title="Close dialog (Esc)"
                disabled={submitting}
                onClick={() => setIsAddTruckOpen(false)}
              >
                ×
              </button>
            </header>

            <form onSubmit={handleCreateTruck}>
              <div className="routex-dialog-body add-truck-dialog-body">
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
                  title="Cancel adding truck and close dialog"
                  onClick={() => setIsAddTruckOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={submitting}
                  title="Save and register this truck in the fleet"
                >
                  {submitting ? "Adding Truck..." : "Add Truck"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {truckToDelete && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-truck-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div className="routex-dialog-backdrop" onClick={() => !isDeletingTruck && setTruckToDelete(null)} />
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
                    disabled={isDeletingTruck}
                    onClick={() => setTruckToDelete(null)}
                  >
                    ×
                  </button>
                </header>

                <div className="routex-dialog-body" style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--color-text-primary)" }}>
                    Are you sure you want to delete truck <strong>{truckToDelete.plateNumber}</strong> ({truckToDelete.truckType}) from the fleet registry?
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
                      <strong>{truckToDelete.plateNumber}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Vehicle Type: </span>
                      <span>{truckToDelete.truckType}</span>
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

                <footer className="routex-dialog-footer" style={{ flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isDeletingTruck}
                    onClick={() => setTruckToDelete(null)}
                    title="Cancel vehicle deletion and close dialog"
                    style={{ minHeight: "38px", padding: "0 16px", fontSize: "13px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-action-button"
                    disabled={isDeletingTruck}
                    onClick={handleConfirmDeleteTruck}
                    title="Permanently remove this vehicle from the fleet"
                    style={{
                      minHeight: "38px",
                      padding: "0 16px",
                      fontSize: "13px",
                      background: "#dc2626",
                      borderColor: "#dc2626",
                      color: "#ffffff",
                    }}
                  >
                    {isDeletingTruck ? "Deleting..." : "Delete Truck"}
                  </button>
                </footer>
              </div>
            </div>,
            document.body
          )
        : null}

      {isAddCrewOpen && (
        <div
          className="routex-dialog-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-crew-dialog-title"
        >
          <div
            className="routex-dialog-backdrop"
            onClick={() => !crewSubmitting && setIsAddCrewOpen(false)}
          />
          <div className="routex-dialog" style={{ width: "min(100%, 480px)" }}>
            <header className="routex-dialog-header">
              <div>
                <h2 id="add-crew-dialog-title">Add Fleet Crew Member</h2>
                <p>Register driver or helper.</p>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                aria-label="Close dialog"
                title="Close dialog (Esc)"
                disabled={crewSubmitting}
                onClick={() => setIsAddCrewOpen(false)}
              >
                ×
              </button>
            </header>

            <form onSubmit={handleCreateCrew}>
              <div className="routex-dialog-body" style={{ display: "grid", gap: "16px", padding: "20px 24px" }}>
                {crewFormError && (
                  <div className="notice" role="alert" style={{ marginBottom: "0" }}>
                    <span className="notice-icon" aria-hidden="true">!</span>
                    <div>
                      <strong>Validation Error:</strong>
                      <span>{crewFormError}</span>
                    </div>
                  </div>
                )}

                <div className="routex-dialog-field">
                  <label style={{ fontWeight: 600, fontSize: "12px", marginBottom: "6px", display: "block" }}>
                    Crew Role *
                  </label>
                  <div className="crew-role-toggle-group" role="group" aria-label="Select crew role">
                    <button
                      type="button"
                      className={`crew-role-toggle-btn ${crewRole === "Driver" ? "active driver" : ""}`}
                      onClick={() => setCrewRole("Driver")}
                    >
                      <span className="crew-role-dot driver" aria-hidden="true" />
                      Driver
                    </button>
                    <button
                      type="button"
                      className={`crew-role-toggle-btn ${crewRole === "Helper" ? "active helper" : ""}`}
                      onClick={() => setCrewRole("Helper")}
                    >
                      <span className="crew-role-dot helper" aria-hidden="true" />
                      Helper
                    </button>
                  </div>
                </div>

                <div className="routex-dialog-field">
                  <label htmlFor="fleet-crew-name" style={{ fontWeight: 600, fontSize: "12px" }}>
                    {crewRole} Full Name *
                  </label>
                  <input
                    id="fleet-crew-name"
                    type="text"
                    required
                    placeholder={crewRole === "Driver" ? "e.g. Carlos Mendoza" : "e.g. Ira Santos"}
                    value={crewFullName}
                    onChange={(e) => setCrewFullName(e.target.value)}
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
                  <label htmlFor="fleet-crew-contact" style={{ fontWeight: 600, fontSize: "12px" }}>
                    Contact Number (Optional)
                  </label>
                  <input
                    id="fleet-crew-contact"
                    type="tel"
                    placeholder="e.g. 0917-123-4567"
                    value={crewContact}
                    onChange={(e) => setCrewContact(e.target.value)}
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

              <footer className="routex-dialog-footer">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={crewSubmitting}
                  title="Cancel adding crew member and close dialog"
                  onClick={() => setIsAddCrewOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={crewSubmitting || crewFullName.trim().length < 2}
                  title={`Register this ${crewRole.toLowerCase()} in the fleet`}
                >
                  {crewSubmitting ? `Adding ${crewRole}...` : `+ Add ${crewRole}`}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
