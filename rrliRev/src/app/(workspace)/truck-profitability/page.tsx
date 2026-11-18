"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  formatDateRange,
  GlobalDateRangePicker,
  parseDateValue,
  toDateKey,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { withReturnContext } from "@/lib/navigation/return-context";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import { TablePagination } from "@/components/table-pagination";
import { useSearchBuffer } from "@/components/search-buffer";
import { SimpleLoading } from "@/components/simple-loading";
import {
  SortableTableHeader,
  type TableSortDirection,
} from "@/components/sortable-table-header";
import {
  OWNED_TRUCK_SORT_OPTIONS,
  type OwnedTruckSort,
} from "@/components/truck-filter-dropdown";
import {
  getTruckPhotoFromStorage,
  saveTruckPhotoFile,
  storageKey,
  TRUCK_PHOTO_EVENT,
  TruckPhoto,
} from "@/components/truck-photo";
import {
  BROWSER_PREVIEW_TRUCKS_CHANGED,
  deleteBrowserPreviewTruck,
  readBrowserDeletedTrucks,
  readBrowserPreviewTrucks,
  saveBrowserPreviewTruck,
  updateBrowserPreviewTruck,
} from "@/features/deliveries/browser-preview-trucks";
import { readBrowserPreviewDeliveries } from "@/features/deliveries/browser-preview-deliveries";
import {
  applyBrowserCrewStatuses,
  BROWSER_CREW_STATUS_CHANGED,
  saveBrowserCrewDeletion,
  saveBrowserCrewEdit,
  saveBrowserCrewStatus,
} from "@/features/deliveries/browser-preview-crew";
import { parsePersonnelNames } from "@/components/delivery-crew-section";
import {
  isDeliveryFinanciallyComplete,
  summarizeTruckProfitability,
} from "@/features/deliveries/delivery-domain";
import {
  getFleetCrew,
  type FleetCrewMember,
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

type SubcontractedTruckSortKey =
  | "plateNumber"
  | "truckType"
  | "classification"
  | "provider"
  | "contactPerson";

export default function TruckProfitabilityPage() {
  const router = useRouter();
  const actor = useAuthenticatedActor();
  const canAdd = canManageTrucks(actor.role);

  const { range, setRange } = useGlobalDateRange();
  const { deliveries: dateFilteredTrips, loading, error } = usePersistedDeliveries(range);

  // Filter & sort states
  const {
    value: plateSearch,
    setValue: setPlateSearch,
    bufferedQuery: debouncedPlateSearch,
    isBuffering: isPlateSearchBuffering,
    clear: clearPlateSearch,
    reset: resetPlateSearch,
  } = useSearchBuffer({ delay: 280 });
  const [classificationFilter, setClassificationFilter] = useState<TruckClassificationFilterKey>("all");
  const [performanceFilter, setPerformanceFilter] = useState<TruckPerformanceFilterKey>("all");
  const [ownedTruckSort, setOwnedTruckSort] = useState<OwnedTruckSort>("netProfit");
  const [ownedViewMode, setOwnedViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("routex-owned-trucks-view-mode");
      if (saved === "grid" || saved === "list") {
        setOwnedViewMode(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  function handleOwnedViewModeChange(mode: "grid" | "list") {
    setOwnedViewMode(mode);
    try {
      localStorage.setItem("routex-owned-trucks-view-mode", mode);
    } catch {
      // ignore
    }
  }

  const [ownedListSort, setOwnedListSort] = useState<{
    key: string;
    direction: TableSortDirection;
  }>({ key: "netProfit", direction: "desc" });

  function sortOwnedList(key: string, direction: TableSortDirection) {
    setOwnedListSort({ key, direction });
    if (key === "plateNumber" || key === "plate") {
      setOwnedTruckSort("plate");
    } else if (key === "totalEarnings" || key === "revenue") {
      setOwnedTruckSort("revenue");
    } else if (key === "totalExpenses" || key === "expenses") {
      setOwnedTruckSort("expenses");
    } else if (key === "netProfit") {
      setOwnedTruckSort("netProfit");
    } else if (key === "marginPercent" || key === "margin") {
      setOwnedTruckSort("margin");
    } else if (key === "completedTrips" || key === "deliveries") {
      setOwnedTruckSort("deliveries");
    }
  }

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
  const [crewSearch, setCrewSearch] = useState("");
  const [isAddCrewOpen, setIsAddCrewOpen] = useState(false);
  const [crewFullName, setCrewFullName] = useState("");
  const [crewRole, setCrewRole] = useState<"Driver" | "Helper">("Driver");
  const [crewContact, setCrewContact] = useState("");
  const [crewSubmitting, setCrewSubmitting] = useState(false);
  const [crewFormError, setCrewFormError] = useState<string | null>(null);
  const [openCrewActionId, setOpenCrewActionId] = useState<string | null>(null);
  const [crewActionOpensAbove, setCrewActionOpensAbove] = useState(false);
  const [crewStatusPendingId, setCrewStatusPendingId] = useState<string | null>(null);
  // Editing Truck state
  const [editingTruck, setEditingTruck] = useState<FleetTruck | null>(null);
  const [editPlateNumber, setEditPlateNumber] = useState("");
  const [editTruckType, setEditTruckType] = useState<FleetTruck["truckType"]>("6-Wheeler");
  const [editStorageCapability, setEditStorageCapability] = useState<TruckStorageCapability>("Refrigerated");
  const [editOwnershipType, setEditOwnershipType] = useState<FleetTruck["ownershipType"]>("Owned");
  const [editProvider, setEditProvider] = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editTruckPhotoFile, setEditTruckPhotoFile] = useState<File | null>(null);
  const [editTruckPhotoPreview, setEditTruckPhotoPreview] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editTruckError, setEditTruckError] = useState<string | null>(null);

  // Editing Crew state
  const [editingCrewMember, setEditingCrewMember] = useState<FleetCrewMember | null>(null);
  const [editCrewFullName, setEditCrewFullName] = useState("");
  const [editCrewRole, setEditCrewRole] = useState<"Driver" | "Helper">("Driver");
  const [editCrewContact, setEditCrewContact] = useState("");
  const [editCrewSubmitting, setEditCrewSubmitting] = useState(false);
  const [editCrewError, setEditCrewError] = useState<string | null>(null);

  // Deleting Crew state
  const [crewToDelete, setCrewToDelete] = useState<FleetCrewMember | null>(null);
  const [isDeletingCrew, setIsDeletingCrew] = useState(false);

  useEffect(() => {
    if (!openCrewActionId) return;
    function handleClickOutside() {
      setOpenCrewActionId(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenCrewActionId(null);
      }
    }
    document.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openCrewActionId]);

  const hasActiveModal = Boolean(
    isAddTruckOpen ||
    editingTruck ||
    truckToDelete ||
    isAddCrewOpen ||
    editingCrewMember ||
    crewToDelete,
  );

  useEffect(() => {
    if (!hasActiveModal) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isAddTruckOpen && !submitting) setIsAddTruckOpen(false);
        if (editingTruck && !editSubmitting) setEditingTruck(null);
        if (truckToDelete && !isDeletingTruck) setTruckToDelete(null);
        if (isAddCrewOpen && !crewSubmitting) setIsAddCrewOpen(false);
        if (editingCrewMember && !editCrewSubmitting) setEditingCrewMember(null);
        if (crewToDelete && !isDeletingCrew) setCrewToDelete(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    hasActiveModal,
    isAddTruckOpen,
    submitting,
    editingTruck,
    editSubmitting,
    truckToDelete,
    isDeletingTruck,
    isAddCrewOpen,
    crewSubmitting,
    editingCrewMember,
    editCrewSubmitting,
    crewToDelete,
    isDeletingCrew,
  ]);

  useEffect(() => {
    if (!hasActiveModal) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [hasActiveModal]);

  const filteredCrew = useMemo(() => {
    let list = crew;
    if (crewRoleFilter !== "All") {
      list = list.filter((c) => c.assignmentType === crewRoleFilter);
    }
    if (crewSearch.trim()) {
      const q = crewSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          (c.contactNumber && c.contactNumber.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [crew, crewRoleFilter, crewSearch]);

  const [crewPage, setCrewPage] = useState(1);
  const CREW_PAGE_SIZE = 10;
  const crewPageCount = Math.max(1, Math.ceil(filteredCrew.length / CREW_PAGE_SIZE));
  const isCrewMountedRef = useRef(false);

  useEffect(() => {
    if (!isCrewMountedRef.current) {
      isCrewMountedRef.current = true;
      return;
    }
    setCrewPage(1);
  }, [crewRoleFilter, crewSearch]);

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

  function openEditCrewModal(member: FleetCrewMember) {
    setOpenCrewActionId(null);
    setEditCrewError(null);
    setEditingCrewMember(member);
    setEditCrewFullName(member.fullName);
    setEditCrewRole(member.assignmentType);
    setEditCrewContact(member.contactNumber || "");
  }

  async function handleUpdateCrew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCrewMember) return;
    setEditCrewError(null);
    const normalizedName = editCrewFullName.trim();
    if (normalizedName.length < 2) {
      setEditCrewError(`${editCrewRole} name must be at least 2 characters.`);
      return;
    }

    setEditCrewSubmitting(true);
    const browserLocal = /^(driver|helper)-/.test(editingCrewMember.id);
    try {
      const response = await fetch("/api/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewMemberId: editingCrewMember.id,
          fullName: normalizedName,
          assignmentType: editCrewRole,
          contactNumber: editCrewContact.trim() || null,
          browserLocal,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        crewMember?: FleetCrewMember;
      } | null;

      if (!response.ok || !data?.ok) {
        setEditCrewError(data?.message ?? "Unable to update crew member.");
        return;
      }

      saveBrowserCrewEdit(editingCrewMember.id, {
        fullName: normalizedName,
        assignmentType: editCrewRole,
        contactNumber: editCrewContact.trim() || null,
      });

      setCrew((current) =>
        current.map((item) =>
          item.id === editingCrewMember.id
            ? {
                ...item,
                fullName: normalizedName,
                assignmentType: editCrewRole,
                contactNumber: editCrewContact.trim() || null,
              }
            : item,
        ),
      );

      setFeedback({
        tone: "success",
        text: `${editCrewRole} "${normalizedName}" details updated successfully.`,
      });
      setEditingCrewMember(null);
    } catch (err) {
      setEditCrewError(err instanceof Error ? err.message : "Failed to update crew member.");
    } finally {
      setEditCrewSubmitting(false);
    }
  }

  async function handleConfirmDeleteCrew() {
    if (!crewToDelete) return;
    setIsDeletingCrew(true);
    const browserLocal = /^(driver|helper)-/.test(crewToDelete.id);
    try {
      const response = await fetch(
        `/api/drivers?id=${encodeURIComponent(crewToDelete.id)}&browserLocal=${browserLocal ? "true" : "false"}`,
        { method: "DELETE" },
      );
      const data = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message ?? "Failed to delete crew member.");
      }

      saveBrowserCrewDeletion(crewToDelete.id);
      setCrew((current) => current.filter((item) => item.id !== crewToDelete.id));
      setFeedback({
        tone: "success",
        text: `${crewToDelete.assignmentType} "${crewToDelete.fullName}" was deleted from fleet roster.`,
      });
      setCrewToDelete(null);
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to delete crew member.",
      });
    } finally {
      setIsDeletingCrew(false);
    }
  }

  function handleCopyContact(member: FleetCrewMember) {
    setOpenCrewActionId(null);
    if (!member.contactNumber) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(member.contactNumber)
        .then(() => {
          setFeedback({
            tone: "success",
            text: `Contact number (${member.contactNumber}) for ${member.fullName} copied to clipboard.`,
          });
        })
        .catch(() => {
          setFeedback({
            tone: "error",
            text: "Unable to copy to clipboard.",
          });
        });
    }
  }

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

  const allFleetTrucks = useMemo(() => {
    const byId = new Map<string, FleetTruck>();
    for (const truck of [...OWNED_TRUCKS, ...SUBCONTRACTED_TRUCKS]) {
      byId.set(truck.id, truck);
    }
    for (const truck of extraTrucks) {
      for (const [key, existing] of byId.entries()) {
        if (existing.plateNumber.trim().toUpperCase() === truck.plateNumber.trim().toUpperCase()) {
          byId.delete(key);
        }
      }
      byId.set(truck.id, truck);
    }
    return [...byId.values()].filter((t) => !deletedPlates.has(t.plateNumber.trim().toUpperCase()));
  }, [extraTrucks, deletedPlates]);

  const allOwnedTrucks = useMemo(
    () => allFleetTrucks.filter((t) => t.ownershipType === "Owned"),
    [allFleetTrucks],
  );

  const allSubcontractedTrucks = useMemo(
    () => allFleetTrucks.filter((t) => t.ownershipType === "Subcontracted"),
    [allFleetTrucks],
  );

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
          plateNumber: truck.plateNumber,
          truckType: truck.truckType,
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
      if (allSubcontractedTrucks.some((t) => t.plateNumber.toUpperCase() === summary.plateNumber.toUpperCase())) continue;
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
      if (ownedViewMode === "list") {
        const mult = ownedListSort.direction === "asc" ? 1 : -1;
        switch (ownedListSort.key) {
          case "plate":
          case "plateNumber":
            return left.plateNumber.localeCompare(right.plateNumber) * mult;
          case "truckType":
            return String(left.truckType).localeCompare(String(right.truckType)) * mult;
          case "classification": {
            const leftCap = getTruckStorageCapability(left.plateNumber, left.storageCapability) === "Refrigerated" ? "Cold" : "Dry";
            const rightCap = getTruckStorageCapability(right.plateNumber, right.storageCapability) === "Refrigerated" ? "Cold" : "Dry";
            const diff = leftCap.localeCompare(rightCap);
            if (diff !== 0) return diff * mult;
            return left.plateNumber.localeCompare(right.plateNumber);
          }
          case "deliveries":
          case "completedTrips": {
            const diff = left.completedTrips - right.completedTrips;
            if (diff !== 0) return diff * mult;
            return left.plateNumber.localeCompare(right.plateNumber);
          }
          case "revenue":
          case "totalEarnings": {
            const diff = left.totalEarnings - right.totalEarnings;
            if (diff !== 0) return diff * mult;
            return left.plateNumber.localeCompare(right.plateNumber);
          }
          case "expenses":
          case "totalExpenses": {
            const diff = left.totalExpenses - right.totalExpenses;
            if (diff !== 0) return diff * mult;
            return left.plateNumber.localeCompare(right.plateNumber);
          }
          case "netProfit": {
            const diff = left.netProfit - right.netProfit;
            if (diff !== 0) return diff * mult;
            return left.plateNumber.localeCompare(right.plateNumber);
          }
          case "margin":
          case "marginPercent": {
            const leftMargin = left.marginPercent ?? Number.NEGATIVE_INFINITY;
            const rightMargin = right.marginPercent ?? Number.NEGATIVE_INFINITY;
            const diff = leftMargin - rightMargin;
            if (diff !== 0) return diff * mult;
            return left.plateNumber.localeCompare(right.plateNumber);
          }
          default:
            return left.plateNumber.localeCompare(right.plateNumber) * mult;
        }
      }

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
  }, [allOwnedTrucks, deletedPlates, ownedTruckSort, truckSummaries, ownedViewMode, ownedListSort]);

  const filteredOwnedTrucks = useMemo(() => {
    const cleanSearch = debouncedPlateSearch.trim().toLowerCase().replace(/\s+/g, "");

    return sortedTruckSummaries.filter((truck) => {
      // 1. Plate Search
      if (cleanSearch) {
        const plateNorm = truck.plateNumber.toLowerCase();
        const plateClean = plateNorm.replace(/\s+/g, "");
        if (!plateNorm.includes(cleanSearch) && !plateClean.includes(cleanSearch)) {
          return false;
        }
      }

      // 2. Classification Filter (Simplified: only Dry / Cold)
      const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
      if (
        (classificationFilter === "cold" || classificationFilter === "refrigerated") &&
        capability !== "Refrigerated"
      ) {
        return false;
      }
      if (classificationFilter === "dry" && capability !== "Dry") {
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
  }, [classificationFilter, performanceFilter, debouncedPlateSearch, sortedTruckSummaries]);

  const sortedSubcontractedTrucks = useMemo(() => {
    const direction = subcontractedSort.direction === "asc" ? 1 : -1;

    return [...allSubcontractedTrucks].sort((left, right) => {
      if (subcontractedSort.key === "classification") {
        const leftCap = getTruckStorageCapability(left.plateNumber, left.storageCapability) === "Refrigerated" ? "Cold" : "Dry";
        const rightCap = getTruckStorageCapability(right.plateNumber, right.storageCapability) === "Refrigerated" ? "Cold" : "Dry";
        const diff = leftCap.localeCompare(rightCap);
        if (diff !== 0) return diff * direction;
        return left.plateNumber.localeCompare(right.plateNumber);
      }
      return (
        String(left[subcontractedSort.key as keyof FleetTruck] ?? "").localeCompare(
          String(right[subcontractedSort.key as keyof FleetTruck] ?? ""),
        ) * direction
      );
    });
  }, [allSubcontractedTrucks, subcontractedSort]);

  const filteredSubcontractedTrucks = useMemo(() => {
    let result = sortedSubcontractedTrucks;
    if (classificationFilter !== "all") {
      result = result.filter((truck) => {
        const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
        if (
          (classificationFilter === "cold" || classificationFilter === "refrigerated") &&
          capability !== "Refrigerated"
        ) {
          return false;
        }
        if (classificationFilter === "dry" && capability !== "Dry") {
          return false;
        }
        return true;
      });
    }
    if (!debouncedPlateSearch.trim()) return result;
    const clean = debouncedPlateSearch.trim().toLowerCase().replace(/\s+/g, "");
    return result.filter(
      (t) =>
        t.plateNumber.toLowerCase().includes(debouncedPlateSearch.trim().toLowerCase()) ||
        t.plateNumber.replace(/\s+/g, "").toLowerCase().includes(clean) ||
        (t.provider && t.provider.toLowerCase().includes(debouncedPlateSearch.trim().toLowerCase())) ||
        (t.contactPerson &&
          t.contactPerson.toLowerCase().includes(debouncedPlateSearch.trim().toLowerCase())),
    );
  }, [classificationFilter, debouncedPlateSearch, sortedSubcontractedTrucks]);

  const [ownedPage, setOwnedPage] = useState(1);
  const OWNED_PAGE_SIZE = 10;
  const ownedPageCount = Math.max(1, Math.ceil(filteredOwnedTrucks.length / OWNED_PAGE_SIZE));
  const isOwnedMountedRef = useRef(false);

  useEffect(() => {
    if (!isOwnedMountedRef.current) {
      isOwnedMountedRef.current = true;
      return;
    }
    setOwnedPage(1);
  }, [debouncedPlateSearch, classificationFilter, performanceFilter, ownedTruckSort]);

  const paginatedOwnedTrucks = useMemo(() => {
    const start = (ownedPage - 1) * OWNED_PAGE_SIZE;
    return filteredOwnedTrucks.slice(start, start + OWNED_PAGE_SIZE);
  }, [filteredOwnedTrucks, ownedPage]);

  const [subcontractedPage, setSubcontractedPage] = useState(1);
  const SUBCONTRACTED_PAGE_SIZE = 10;
  const subcontractedPageCount = Math.max(1, Math.ceil(filteredSubcontractedTrucks.length / SUBCONTRACTED_PAGE_SIZE));
  const isSubMountedRef = useRef(false);

  useEffect(() => {
    if (!isSubMountedRef.current) {
      isSubMountedRef.current = true;
      return;
    }
    setSubcontractedPage(1);
  }, [debouncedPlateSearch, subcontractedSort]);

  const isInitialUrlHydrated = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || isInitialUrlHydrated.current) return;
    isInitialUrlHydrated.current = true;
    const params = new URLSearchParams(window.location.search);

    const qParam = params.get("q") || params.get("search");
    if (qParam) resetPlateSearch(qParam);

    const classParam = params.get("class");
    if (classParam === "all" || classParam === "cold" || classParam === "dry" || classParam === "refrigerated") {
      setClassificationFilter(classParam);
    }

    const perfParam = params.get("perf");
    if (perfParam === "all" || perfParam === "top_performing" || perfParam === "high_value" || perfParam === "active") {
      setPerformanceFilter(perfParam);
    }

    const sortParam = params.get("sort") as OwnedTruckSort | null;
    if (sortParam && OWNED_TRUCK_SORT_OPTIONS.some((o) => o.value === sortParam)) {
      setOwnedTruckSort(sortParam);
    }

    const listSortParam = params.get("listSort");
    if (listSortParam) {
      const [key, dir] = listSortParam.split(":");
      if (key) {
        setOwnedListSort({ key, direction: dir === "asc" ? "asc" : "desc" });
      }
    }

    const viewParam = params.get("view");
    if (viewParam === "grid" || viewParam === "list") {
      setOwnedViewMode(viewParam);
    }

    const pageParam = params.get("page");
    if (pageParam && Number(pageParam) > 1) {
      setOwnedPage(Number(pageParam));
    }

    const subSortParam = params.get("subSort");
    if (subSortParam) {
      const [key, dir] = subSortParam.split(":");
      if (key) {
        setSubcontractedSort({
          key: key as SubcontractedTruckSortKey,
          direction: dir === "desc" ? "desc" : "asc",
        });
      }
    }

    const subPageParam = params.get("subPage");
    if (subPageParam && Number(subPageParam) > 1) {
      setSubcontractedPage(Number(subPageParam));
    }

    const crewQParam = params.get("crewQ");
    if (crewQParam) setCrewSearch(crewQParam);

    const crewRoleParam = params.get("crewRole");
    if (crewRoleParam === "All" || crewRoleParam === "Driver" || crewRoleParam === "Helper") {
      setCrewRoleFilter(crewRoleParam);
    }

    const crewPageParam = params.get("crewPage");
    if (crewPageParam && Number(crewPageParam) > 1) {
      setCrewPage(Number(crewPageParam));
    }

    const dateFromParam = params.get("dateFrom");
    const dateToParam = params.get("dateTo");
    if (dateFromParam || dateToParam) {
      setRange({
        startDate: dateFromParam ? parseDateValue(dateFromParam) : null,
        endDate: dateToParam ? parseDateValue(dateToParam) : null,
      });
    }
  }, [resetPlateSearch, setRange]);

  function buildCurrentTrucksPageUrl(): string {
    const params = new URLSearchParams();
    if (plateSearch.trim()) params.set("q", plateSearch.trim());
    if (classificationFilter !== "all") params.set("class", classificationFilter);
    if (performanceFilter !== "all") params.set("perf", performanceFilter);
    if (ownedTruckSort !== "netProfit") params.set("sort", ownedTruckSort);
    if (ownedViewMode === "list") {
      params.set("view", "list");
      params.set("listSort", `${ownedListSort.key}:${ownedListSort.direction}`);
    }
    if (ownedPage > 1) params.set("page", String(ownedPage));
    if (subcontractedSort.key !== "plateNumber" || subcontractedSort.direction !== "asc") {
      params.set("subSort", `${subcontractedSort.key}:${subcontractedSort.direction}`);
    }
    if (subcontractedPage > 1) params.set("subPage", String(subcontractedPage));
    if (crewSearch.trim()) params.set("crewQ", crewSearch.trim());
    if (crewRoleFilter !== "All") params.set("crewRole", crewRoleFilter);
    if (crewPage > 1) params.set("crewPage", String(crewPage));
    if (range.startDate) params.set("dateFrom", toDateKey(range.startDate));
    if (range.endDate) params.set("dateTo", toDateKey(range.endDate));
    const qs = params.toString();
    return `/truck-profitability${qs ? `?${qs}` : ""}`;
  }

  function buildTruckDetailHref(plate: string): string {
    const params = new URLSearchParams();
    params.set("from", "trucks");
    if (range.startDate) params.set("dateFrom", toDateKey(range.startDate));
    if (range.endDate) params.set("dateTo", toDateKey(range.endDate));
    params.set("returnTo", buildCurrentTrucksPageUrl());
    params.set("returnLabel", "Trucks");
    return `/truck-profitability/${encodeURIComponent(plate)}?${params.toString()}`;
  }

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
    range.startDate ||
    range.endDate
  );

  function handleResetFilters() {
    clearPlateSearch();
    setClassificationFilter("all");
    setPerformanceFilter("all");
    setRange({ startDate: null, endDate: null });
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
        text: `Truck ${payload.truck.plateNumber} (${payload.truck.ownershipType} ${payload.truck.truckType} · ${storageCapability === "Refrigerated" ? "Cold" : "Dry"}) successfully registered into the fleet.`,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to register truck.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditTruckModal(truck: {
    id?: string;
    plateNumber: string;
    truckType: FleetTruck["truckType"];
    storageCapability?: TruckStorageCapability;
    ownershipType?: FleetTruck["ownershipType"];
    provider?: string | null;
    contactPerson?: string | null;
  }) {
    setEditTruckError(null);

    const fullRecord =
      allFleetTrucks.find(
        (t) => t.plateNumber.trim().toUpperCase() === truck.plateNumber.trim().toUpperCase(),
      ) ?? null;

    const resolvedOwnership = truck.ownershipType ?? fullRecord?.ownershipType ?? "Owned";
    const resolvedType = truck.truckType ?? fullRecord?.truckType ?? "6-Wheeler";
    const resolvedCapability = getTruckStorageCapability(
      truck.plateNumber,
      truck.storageCapability ?? fullRecord?.storageCapability,
    );
    const resolvedProvider = truck.provider ?? fullRecord?.provider ?? "";
    const resolvedContact = truck.contactPerson ?? fullRecord?.contactPerson ?? "";

    setEditingTruck({
      id: fullRecord?.id ?? truck.id ?? truck.plateNumber,
      plateNumber: truck.plateNumber,
      truckType: resolvedType,
      storageCapability: resolvedCapability,
      ownershipType: resolvedOwnership,
      rateBasis: resolvedOwnership === "Owned" ? "Redeemed Rate" : "Trucker Rate",
      provider: resolvedProvider || null,
      contactPerson: resolvedContact || null,
    });
    setEditPlateNumber(truck.plateNumber);
    setEditTruckType(resolvedType);
    setEditStorageCapability(resolvedCapability);
    setEditOwnershipType(resolvedOwnership);
    setEditProvider(resolvedProvider);
    setEditContactPerson(resolvedContact);
    setEditTruckPhotoFile(null);
    setEditTruckPhotoPreview(getTruckPhotoFromStorage(truck.plateNumber));
  }

  async function handleUpdateTruck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTruck) return;
    setEditTruckError(null);

    const normalizedPlate = editPlateNumber.trim().toUpperCase();
    if (!normalizedPlate) {
      setEditTruckError("Plate number is required.");
      return;
    }
    if (editOwnershipType === "Subcontracted" && !editProvider.trim()) {
      setEditTruckError("Provider is required for subcontracted trucks.");
      return;
    }

    setEditSubmitting(true);
    try {
      const browserLocal = readBrowserPreviewTrucks().some(
        (t) => t.plateNumber.toUpperCase() === editingTruck.plateNumber.toUpperCase(),
      );
      const response = await fetch("/api/trucks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalPlateNumber: editingTruck.plateNumber,
          plateNumber: normalizedPlate,
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
        setEditTruckError(payload?.message ?? "Unable to update truck. Please verify input.");
        return;
      }

      const updatedTruck: FleetTruck = {
        ...payload.truck,
        storageCapability: editStorageCapability,
      };

      updateBrowserPreviewTruck(editingTruck.plateNumber, updatedTruck);

      const oldKey = storageKey(editingTruck.plateNumber);
      const newKey = storageKey(updatedTruck.plateNumber);
      if (!editTruckPhotoPreview && !editTruckPhotoFile && typeof window !== "undefined") {
        window.localStorage.removeItem(oldKey);
        window.localStorage.removeItem(newKey);
        window.dispatchEvent(new Event(TRUCK_PHOTO_EVENT));
      } else if (oldKey !== newKey && !editTruckPhotoFile && typeof window !== "undefined") {
        const existingPhoto = window.localStorage.getItem(oldKey);
        if (existingPhoto) {
          window.localStorage.setItem(newKey, existingPhoto);
          window.dispatchEvent(new Event(TRUCK_PHOTO_EVENT));
        }
      }
      if (editTruckPhotoFile) {
        await saveTruckPhotoFile(updatedTruck.plateNumber, editTruckPhotoFile);
      }

      setExtraTrucks(readBrowserPreviewTrucks());
      setDeletedPlates(new Set(readBrowserDeletedTrucks().map((p) => p.toUpperCase())));
      setEditingTruck(null);

      setFeedback({
        tone: "success",
        text: `Truck ${updatedTruck.plateNumber} (${updatedTruck.ownershipType} ${updatedTruck.truckType} · ${editStorageCapability === "Refrigerated" ? "Cold" : "Dry"}) updated successfully.`,
      });
    } catch (err) {
      setEditTruckError(err instanceof Error ? err.message : "Failed to update truck.");
    } finally {
      setEditSubmitting(false);
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
      <OperationalTopbar contextLabel="Trucks" showDateFilter={false} />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <h1>Trucks</h1>
            <p className="subtitle">
              Fleet performance and crew registry.
            </p>
          </div>
          {canAdd && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                className="secondary-button page-intro-action"
                onClick={() => {
                  setCrewFormError(null);
                  setCrewFullName("");
                  setCrewContact("");
                  setCrewRole("Driver");
                  setIsAddCrewOpen(true);
                }}
              >
                + Add Crew
              </button>
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
              title="Dismiss"
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
              </div>
              <div className="records-heading-meta">
                <span className="ledger-total-badge">
                  {filteredOwnedTrucks.length} trucks · {refrigeratedCount} Cold · {dryCount} Dry
                </span>
                <div className="chart-view-mode-toggle" role="group" aria-label="Owned trucks display view">
                  <button
                    type="button"
                    className={`ui-tooltip ${ownedViewMode === "grid" ? "active" : ""}`}
                    onClick={() => handleOwnedViewModeChange("grid")}
                    data-tooltip="Grid view"
                    aria-label="Grid view"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`ui-tooltip ${ownedViewMode === "list" ? "active" : ""}`}
                    onClick={() => handleOwnedViewModeChange("list")}
                    data-tooltip="List view"
                    aria-label="List view"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="filters truck-filters">
              <label className={`search-box${isPlateSearchBuffering ? " is-buffering" : ""}`}>
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
                  value={plateSearch}
                  onChange={(e) => setPlateSearch(e.target.value)}
                />
                {isPlateSearchBuffering && (
                  <span className="search-buffer-indicator" title="Buffering search…" aria-label="Buffering search…" />
                )}
              </label>

              <GlobalDateRangePicker />

              <div className="filter-select-wrapper" style={{ minWidth: "165px" }}>
                <RoundedSelect
                  value={classificationFilter}
                  options={TRUCK_CLASSIFICATION_FILTER_OPTIONS}
                  onChange={(val) => setClassificationFilter(val as TruckClassificationFilterKey)}
                  ariaLabel="Filter trucks by classification"
                  placeholder="All Classifications"
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
            </div>

            {hasActiveFilters && (
              <div className="active-filter-chips" aria-label="Active filters">
                <span className="active-chips-label">Active filters:</span>
                {(range.startDate || range.endDate) && (
                  <span className="filter-chip">
                    <span className="filter-chip-category">Date:</span>{" "}
                    {formatDateRange(range)}
                    <button
                      type="button"
                      className="filter-chip-remove"
                      aria-label="Remove date range filter"
                      title="Clear date filter"
                      onClick={() =>
                        setRange({ startDate: null, endDate: null })
                      }
                    >
                      ×
                    </button>
                  </span>
                )}
                {plateSearch.trim() && (
                  <span className="filter-chip">
                    <span className="filter-chip-category">Plate:</span> {plateSearch.trim()}
                    <button
                      type="button"
                      className="filter-chip-remove"
                      aria-label="Remove plate search"
                      title="Clear plate filter"
                      onClick={() => clearPlateSearch()}
                    >
                      ×
                    </button>
                  </span>
                )}
                {classificationFilter !== "all" && (
                  <span className="filter-chip">
                    <span className="filter-chip-category">Classification:</span>{" "}
                    {TRUCK_CLASSIFICATION_FILTER_OPTIONS.find((o) => o.value === classificationFilter)?.label ??
                      (classificationFilter === "refrigerated" ? "Cold" : classificationFilter)}
                    <button
                      type="button"
                      className="filter-chip-remove"
                      aria-label="Remove classification filter"
                      title="Clear classification"
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
                      title="Clear tier filter"
                      onClick={() => setPerformanceFilter("all")}
                    >
                      ×
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  className="filter-chip-clear-all"
                  title="Clear all filters"
                  onClick={handleResetFilters}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {error ? null : (loading || isPlateSearchBuffering) ? (
            <SimpleLoading message={isPlateSearchBuffering ? "Searching trucks…" : "Loading trucks…"} />
          ) : filteredOwnedTrucks.length === 0 ? (
            <div className="empty-state minimal" title="No matching trucks">
              <strong className="empty-state-title">No owned trucks match the selected filters</strong>
              <span className="empty-state-desc">Try clearing filters or adjusting your search criteria.</span>
            </div>
          ) : ownedViewMode === "grid" ? (
            <>
              <div className="fleet-card-grid truck-profitability-card-grid">
                {paginatedOwnedTrucks.map((truck, index) => {
                  const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
                  const isRefrigerated = capability === "Refrigerated";

                  return (
                    <div
                      className="fleet-card truck-profitability-card"
                      key={truck.plateNumber}
                      style={{
                        position: "relative",
                      }}
                    >
                      <Link
                        className="fleet-card-link"
                        href={buildTruckDetailHref(truck.plateNumber)}
                        title={`View ${truck.plateNumber} details`}
                      >
                        <div className="truck-card-photo-wrap" style={{ overflow: "hidden", borderRadius: "23px 23px 0 0" }}>
                          <TruckPhoto plateNumber={truck.plateNumber} />
                          <span className={`truck-capability-pill ${isRefrigerated ? "refrigerated" : "ambient"}`}>
                            {isRefrigerated ? "Cold" : "Dry"}
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
                                  title={`${formatPeso(truck.pendingEarnings)} pending (unresolved expenses)`}
                                  style={{
                                    display: "block",
                                    fontSize: "11px",
                                    color: "var(--color-accent, #d97706)",
                                    marginTop: "2px",
                                    fontWeight: 500,
                                  }}
                                >
                                  + {formatPeso(truck.pendingEarnings)}
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

                      {canAdd && (
                        <div
                          className="truck-card-actions"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <button
                            type="button"
                            className="truck-action-icon-btn"
                            aria-label={`Edit truck ${truck.plateNumber}`}
                            title="Edit truck"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openEditTruckModal({
                                plateNumber: truck.plateNumber,
                                truckType: truck.truckType,
                                storageCapability: capability,
                                ownershipType: "Owned",
                              });
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
                              aria-label={`Delete truck ${truck.plateNumber}`}
                              title="Delete truck"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setTruckToDelete({
                                  plateNumber: truck.plateNumber,
                                  truckType: truck.truckType,
                                });
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
                      )}
                    </div>
                  );
                })}
              </div>

              {ownedPageCount > 1 && (
                <TablePagination
                  page={ownedPage}
                  pageCount={ownedPageCount}
                  totalItems={filteredOwnedTrucks.length}
                  pageSize={OWNED_PAGE_SIZE}
                  onPageChange={setOwnedPage}
                  itemLabel="owned trucks"
                  itemCountInPage={paginatedOwnedTrucks.length}
                />
              )}
            </>
          ) : (
            <>
              <div className="records-card owned-trucks-table-card" style={{ padding: 0, overflow: "hidden", marginTop: "12px" }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <SortableTableHeader label="Plate Number" sortKey="plate" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Vehicle Size" sortKey="truckType" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Classification" sortKey="classification" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Trips" sortKey="deliveries" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Revenue" sortKey="revenue" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Expenses" sortKey="expenses" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Net Profit" sortKey="netProfit" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Margin" sortKey="margin" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        {canAdd && (
                          <th style={{ width: actor.role === "admin" ? "76px" : "44px", textAlign: "right" }}>
                            <span className="sr-only">Actions</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOwnedTrucks.map((truck) => {
                        const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
                        const isRefrigerated = capability === "Refrigerated";

                        return (
                          <tr
                            key={truck.plateNumber}
                            className="clickable-table-row"
                            onClick={() => router.push(buildTruckDetailHref(truck.plateNumber))}
                            style={{
                              position: "relative",
                              cursor: "pointer",
                            }}
                          >
                            <td>
                              <strong className="truck-code">{truck.plateNumber}</strong>
                            </td>
                            <td><span className="truck-table-spec">{truck.truckType}</span></td>
                            <td>{isRefrigerated ? "Cold" : "Dry"}</td>
                            <td>
                              <span className="fleet-status">
                                {truck.completedTrips} trip{truck.completedTrips === 1 ? "" : "s"}
                              </span>
                            </td>
                            <td>
                              <div>
                                <strong>{formatPeso(truck.totalEarnings)}</strong>
                                {truck.pendingEarnings > 0 ? (
                                  <span
                                    style={{
                                      display: "block",
                                      fontSize: "11px",
                                      color: "var(--color-accent, #d97706)",
                                      fontWeight: 500,
                                    }}
                                  >
                                    + {formatPeso(truck.pendingEarnings)}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td>{formatPeso(truck.totalExpenses)}</td>
                            <td>
                              <strong style={{ color: truck.netProfit >= 0 ? "var(--color-success, #10b981)" : "var(--color-danger, #ef4444)" }}>
                                {formatPeso(truck.netProfit)}
                              </strong>
                            </td>
                            <td>{formatPercent(truck.marginPercent)}</td>
                            {canAdd && (
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                                <div className="truck-row-actions">
                                  <button
                                    type="button"
                                    className="truck-action-icon-btn"
                                    aria-label={`Edit truck ${truck.plateNumber}`}
                                    title="Edit truck"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditTruckModal({
                                        plateNumber: truck.plateNumber,
                                        truckType: truck.truckType,
                                        storageCapability: capability,
                                        ownershipType: "Owned",
                                      });
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
                                      aria-label={`Delete truck ${truck.plateNumber}`}
                                      title="Delete truck"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTruckToDelete({
                                          plateNumber: truck.plateNumber,
                                          truckType: truck.truckType,
                                        });
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
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {ownedPageCount > 1 && (
                <TablePagination
                  page={ownedPage}
                  pageCount={ownedPageCount}
                  totalItems={filteredOwnedTrucks.length}
                  pageSize={OWNED_PAGE_SIZE}
                  onPageChange={setOwnedPage}
                  itemLabel="owned trucks"
                  itemCountInPage={paginatedOwnedTrucks.length}
                />
              )}
            </>
          )}
        </section>

        <section className="records-card fleet-subcontracted subcontracted-trucks-table" aria-label="Subcontracted trucks">
          <div className="records-heading">
            <div>
              <h2>Subcontracted Trucks</h2>
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
                  <SortableTableHeader label="Vehicle Size" sortKey="truckType" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Classification" sortKey="classification" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Provider" sortKey="provider" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Contact Person" sortKey="contactPerson" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  {canAdd && (
                    <th style={{ width: actor.role === "admin" ? "76px" : "44px", textAlign: "right" }}>
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedSubcontractedTrucks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canAdd ? 6 : 5}
                      className="table-empty-cell"
                    >
                      <div className="empty-state minimal" title="No subcontracted trucks">
                        <strong className="empty-state-title">No subcontracted trucks registered</strong>
                        <span className="empty-state-desc">Subcontracted trucks will appear here once added.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedSubcontractedTrucks.map((truck) => {
                  const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
                  const isRefrigerated = capability === "Refrigerated";

                  return (
                    <tr
                      key={truck.plateNumber}
                      style={{
                        position: "relative",
                      }}
                    >
                      <td><strong className="truck-code">{truck.plateNumber}</strong></td>
                      <td><span className="truck-table-spec">{truck.truckType}</span></td>
                      <td>{isRefrigerated ? "Cold" : "Dry"}</td>
                      <td>{truck.provider}</td>
                      <td>{truck.contactPerson}</td>
                      {canAdd && (
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                          <div className="truck-row-actions">
                            <button
                              type="button"
                              className="truck-action-icon-btn"
                              aria-label={`Edit truck ${truck.plateNumber}`}
                              title="Edit truck"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditTruckModal({
                                  plateNumber: truck.plateNumber,
                                  truckType: truck.truckType,
                                  storageCapability: capability,
                                  ownershipType: "Subcontracted",
                                  provider: truck.provider,
                                  contactPerson: truck.contactPerson,
                                });
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
                                aria-label={`Delete truck ${truck.plateNumber}`}
                                title="Delete truck"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTruckToDelete({
                                    plateNumber: truck.plateNumber,
                                    truckType: truck.truckType,
                                  });
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
              <h2>Crew</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="search"
                className="crew-search-input"
                placeholder="Search crew members..."
                value={crewSearch}
                onChange={(e) => setCrewSearch(e.target.value)}
                aria-label="Search crew members"
              />

              <div className="crew-role-filter-pills" role="tablist" aria-label="Filter crew by role">
                <button
                  type="button"
                  role="tab"
                  aria-selected={crewRoleFilter === "All"}
                  className={`crew-role-tab ${crewRoleFilter === "All" ? "active" : ""}`}
                  title="All crew"
                  onClick={() => setCrewRoleFilter("All")}
                >
                  All ({crew.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={crewRoleFilter === "Driver"}
                  className={`crew-role-tab ${crewRoleFilter === "Driver" ? "active" : ""}`}
                  onClick={() => setCrewRoleFilter("Driver")}
                >
                  Drivers ({driverCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={crewRoleFilter === "Helper"}
                  className={`crew-role-tab ${crewRoleFilter === "Helper" ? "active" : ""}`}
                  onClick={() => setCrewRoleFilter("Helper")}
                >
                  Helpers ({helperCount})
                </button>
              </div>

              {canAdd && (
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={() => {
                    setCrewFormError(null);
                    setCrewFullName("");
                    setCrewContact("");
                    setCrewRole("Driver");
                    setIsAddCrewOpen(true);
                  }}
                >
                  + Add Crew Member
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
                  <th>Contact Number</th>
                  <th>Status</th>
                  <th style={{ width: "48px", textAlign: "right" }}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCrew.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty-cell">
                      <div className="empty-state minimal">
                        <strong className="empty-state-title">No crew members found</strong>
                        <span className="empty-state-desc">
                          {crewSearch.trim()
                            ? `No crew members matching "${crewSearch.trim()}".`
                            : `No ${crewRoleFilter === "All" ? "crew members" : crewRoleFilter.toLowerCase() + "s"} registered yet.`}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCrew.map((member, memberIndex) => (
                    <tr
                      key={member.id || `${member.assignmentType}-${member.fullName}`}
                      style={{
                        position: "relative",
                        zIndex: openCrewActionId === member.id ? 150 : undefined,
                      }}
                    >
                      <td><strong className="truck-code">{member.fullName}</strong></td>
                      <td>
                        <span className="crew-role-text">
                          {member.assignmentType}
                        </span>
                      </td>
                      <td title={member.contactNumber ? undefined : "No contact number recorded"}>
                        {member.contactNumber || "—"}
                      </td>
                      <td>
                        <span className={`crew-status-text ${member.isActive ? "active" : "inactive"}`}>
                          {member.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="table-row-actions" style={{ position: "relative", display: "inline-block" }}>
                          <button
                            type="button"
                            className="row-action-more-btn"
                            aria-label={`More actions for ${member.fullName}`}
                            title="More actions"
                            aria-haspopup="menu"
                            aria-expanded={openCrewActionId === member.id}
                            disabled={crewStatusPendingId === member.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const isNearBottom = spaceBelow < 220 || memberIndex >= paginatedCrew.length - 2;
                              setCrewActionOpensAbove(isNearBottom);
                              setOpenCrewActionId((current) => current === member.id ? null : member.id);
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                              <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
                            </svg>
                          </button>
                          {openCrewActionId === member.id ? (
                            <div className={`row-action-menu${crewActionOpensAbove ? " opens-above" : ""}`} role="menu" aria-label={`Actions for ${member.fullName}`}>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenCrewActionId(null);
                                  router.push(
                                    withReturnContext(
                                      `/deliveries?search=${encodeURIComponent(member.fullName)}`,
                                      buildCurrentTrucksPageUrl(),
                                      "Trucks",
                                    ),
                                  );
                                }}
                              >
                                View Deliveries
                              </button>
                              {canAdd && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => openEditCrewModal(member)}
                                >
                                  Edit Details
                                </button>
                              )}
                              {member.contactNumber && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => handleCopyContact(member)}
                                >
                                  Copy Contact Number
                                </button>
                              )}
                              {canAdd && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => handleToggleCrewActive(member)}
                                >
                                  {member.isActive ? `Deactivate ${member.assignmentType}` : `Reactivate ${member.assignmentType}`}
                                </button>
                              )}
                              {canAdd && (
                                <>
                                  <div className="row-action-menu-divider" role="separator" />
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="row-action-menu-danger"
                                    onClick={() => {
                                      setOpenCrewActionId(null);
                                      setCrewToDelete(member);
                                    }}
                                  >
                                    Delete {member.assignmentType}
                                  </button>
                                </>
                              )}
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

      {isAddTruckOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-truck-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div
                className="routex-dialog-backdrop"
                onClick={() => !submitting && setIsAddTruckOpen(false)}
              />
              <div className="routex-dialog add-truck-dialog">
            <header className="routex-dialog-header">
              <div>
                <h2 id="add-truck-dialog-title">Add Truck</h2>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                aria-label="Close dialog"
                title="Close (Esc)"
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

                {/* Centered, enlarged truck photo uploader at top */}
                <div className="truck-dialog-photo-upload-wrap">
                  <label
                    htmlFor="new-truck-photo"
                    className={`truck-dialog-photo-card ${truckPhotoPreview ? "has-photo" : "empty"}`}
                    title={truckPhotoPreview ? "Change photo" : "Select photo"}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        document.getElementById("new-truck-photo")?.click();
                      }
                    }}
                  >
                    {truckPhotoPreview ? (
                      <>
                        <img src={truckPhotoPreview} alt="Selected truck preview" className="truck-dialog-photo-img" />
                        <span className="truck-dialog-photo-change-badge">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                          Change Photo
                        </span>
                      </>
                    ) : (
                      <div className="truck-dialog-photo-empty-content">
                        <div className="truck-dialog-photo-icon-wrap">
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="1" y="3" width="15" height="13" rx="1.5" />
                            <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
                            <circle cx="5.5" cy="18.5" r="2.5" />
                            <circle cx="18.5" cy="18.5" r="2.5" />
                          </svg>
                        </div>
                        <span className="truck-dialog-photo-label">Upload Truck Picture</span>
                        <span className="truck-dialog-photo-subtext">Optional · PNG, JPG up to 10MB</span>
                      </div>
                    )}
                  </label>

                  <input
                    id="new-truck-photo"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    tabIndex={-1}
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

                  {truckPhotoPreview && (
                    <button
                      type="button"
                      className="truck-dialog-photo-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTruckPhotoFile(null);
                        setTruckPhotoPreview(null);
                        const input = document.getElementById("new-truck-photo") as HTMLInputElement | null;
                        if (input) input.value = "";
                      }}
                      title="Remove photo"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      Remove photo
                    </button>
                  )}
                </div>

                {/* Truck detail fields placed below the photo */}
                <div className="routex-dialog-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
                </div>

                <div className="routex-dialog-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
                      Classification *
                    </label>
                    <RoundedSelect
                      value={storageCapability}
                      options={[
                        { value: "Refrigerated", label: "Cold" },
                        { value: "Dry", label: "Dry" },
                      ]}
                      onChange={(value) => setStorageCapability(value as TruckStorageCapability)}
                      ariaLabel="Select truck classification"
                    />
                  </div>
                </div>

                {ownershipType === "Subcontracted" && (
                  <div className="routex-dialog-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
        </div>,
        document.body,
      ) : null}

      {editingTruck && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-truck-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div
                className="routex-dialog-backdrop"
                onClick={() => !editSubmitting && setEditingTruck(null)}
              />
              <div className="routex-dialog add-truck-dialog">
            <header className="routex-dialog-header">
              <div>
                <h2 id="edit-truck-dialog-title">Edit Truck</h2>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                aria-label="Close dialog"
                title="Close (Esc)"
                disabled={editSubmitting}
                onClick={() => setEditingTruck(null)}
              >
                ×
              </button>
            </header>

            <form onSubmit={handleUpdateTruck}>
              <div className="routex-dialog-body add-truck-dialog-body">
                {editTruckError && (
                  <div className="notice" role="alert" style={{ marginBottom: "0" }}>
                    <span className="notice-icon" aria-hidden="true">!</span>
                    <div>
                      <strong>Validation Error:</strong>
                      <span>{editTruckError}</span>
                    </div>
                  </div>
                )}

                {/* Centered, enlarged truck photo uploader at top */}
                <div className="truck-dialog-photo-upload-wrap">
                  <label
                    htmlFor="edit-truck-photo"
                    className={`truck-dialog-photo-card ${editTruckPhotoPreview ? "has-photo" : "empty"}`}
                    title={editTruckPhotoPreview ? "Change photo" : "Select photo"}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        document.getElementById("edit-truck-photo")?.click();
                      }
                    }}
                  >
                    {editTruckPhotoPreview ? (
                      <>
                        <img src={editTruckPhotoPreview} alt="Selected truck preview" className="truck-dialog-photo-img" />
                        <span className="truck-dialog-photo-change-badge">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                          Change Photo
                        </span>
                      </>
                    ) : (
                      <div className="truck-dialog-photo-empty-content">
                        <div className="truck-dialog-photo-icon-wrap">
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="1" y="3" width="15" height="13" rx="1.5" />
                            <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
                            <circle cx="5.5" cy="18.5" r="2.5" />
                            <circle cx="18.5" cy="18.5" r="2.5" />
                          </svg>
                        </div>
                        <span className="truck-dialog-photo-label">Upload Truck Picture</span>
                        <span className="truck-dialog-photo-subtext">Optional · PNG, JPG up to 10MB</span>
                      </div>
                    )}
                  </label>

                  <input
                    id="edit-truck-photo"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (!file) return;
                      if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
                        setEditTruckError("Choose an image file smaller than 10 MB.");
                        event.target.value = "";
                        return;
                      }
                      setEditTruckError(null);
                      setEditTruckPhotoFile(file);
                      const reader = new FileReader();
                      reader.onload = () => setEditTruckPhotoPreview(String(reader.result));
                      reader.readAsDataURL(file);
                    }}
                  />

                  {editTruckPhotoPreview && (
                    <button
                      type="button"
                      className="truck-dialog-photo-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditTruckPhotoFile(null);
                        setEditTruckPhotoPreview(null);
                        const input = document.getElementById("edit-truck-photo") as HTMLInputElement | null;
                        if (input) input.value = "";
                      }}
                      title="Remove photo"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      Remove photo
                    </button>
                  )}
                </div>

                {/* Truck detail fields placed below the photo */}
                <div className="routex-dialog-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="routex-dialog-field">
                    <label htmlFor="edit-truck-plate" style={{ fontWeight: 600, fontSize: "12px" }}>
                      Plate Number *
                    </label>
                    <input
                      id="edit-truck-plate"
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
                    <label htmlFor="edit-truck-ownership" style={{ fontWeight: 600, fontSize: "12px" }}>
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
                    <label htmlFor="edit-truck-type" style={{ fontWeight: 600, fontSize: "12px" }}>
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
                    <label htmlFor="edit-truck-capability" style={{ fontWeight: 600, fontSize: "12px" }}>
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
                      <label htmlFor="edit-truck-provider" style={{ fontWeight: 600, fontSize: "12px" }}>
                        Hauler / Provider *
                      </label>
                      <input
                        id="edit-truck-provider"
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
                      <label htmlFor="edit-truck-contact" style={{ fontWeight: 600, fontSize: "12px" }}>
                        Contact Person
                      </label>
                      <input
                        id="edit-truck-contact"
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
              </div>

              <footer className="routex-dialog-footer">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={editSubmitting}
                  onClick={() => setEditingTruck(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? "Saving Changes..." : "Save Changes"}
                </button>
              </footer>
            </form>
          </div>
        </div>,
        document.body,
      ) : null}

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
                      Delete Truck
                    </h2>
                    <p style={{ margin: "2px 0 0", fontSize: "11px" }}>
                      Action is audited and logged.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="routex-dialog-close"
                    aria-label="Close confirmation dialog"
                    title="Close (Esc)"
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
                    style={{ minHeight: "38px", padding: "0 16px", fontSize: "13px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-action-button"
                    disabled={isDeletingTruck}
                    onClick={handleConfirmDeleteTruck}
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

      {isAddCrewOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-crew-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div
                className="routex-dialog-backdrop"
                onClick={() => !crewSubmitting && setIsAddCrewOpen(false)}
              />
              <div className="routex-dialog" style={{ width: "min(100%, 480px)" }}>
            <header className="routex-dialog-header">
              <div>
                <h2 id="add-crew-dialog-title">Add Crew Member</h2>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                aria-label="Close dialog"
                title="Close (Esc)"
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
                      className={`crew-role-toggle-btn ${crewRole === "Driver" ? "active" : ""}`}
                      onClick={() => setCrewRole("Driver")}
                    >
                      Driver
                    </button>
                    <button
                      type="button"
                      className={`crew-role-toggle-btn ${crewRole === "Helper" ? "active" : ""}`}
                      onClick={() => setCrewRole("Helper")}
                    >
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
                >
                  {crewSubmitting ? `Adding ${crewRole}...` : `+ Add ${crewRole}`}
                </button>
              </footer>
            </form>
          </div>
        </div>,
        document.body,
      ) : null}

      {editingCrewMember && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-crew-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div
                className="routex-dialog-backdrop"
                onClick={() => !editCrewSubmitting && setEditingCrewMember(null)}
              />
              <div className="routex-dialog" style={{ width: "min(100%, 480px)" }}>
            <header className="routex-dialog-header">
              <div>
                <h2 id="edit-crew-dialog-title">Edit Crew Member</h2>
              </div>
              <button
                type="button"
                className="routex-dialog-close"
                aria-label="Close dialog"
                title="Close (Esc)"
                disabled={editCrewSubmitting}
                onClick={() => setEditingCrewMember(null)}
              >
                ×
              </button>
            </header>

            <form onSubmit={handleUpdateCrew}>
              <div className="routex-dialog-body" style={{ display: "grid", gap: "16px", padding: "20px 24px" }}>
                {editCrewError && (
                  <div className="notice" role="alert" style={{ marginBottom: "0" }}>
                    <span className="notice-icon" aria-hidden="true">!</span>
                    <div>
                      <strong>Validation Error:</strong>
                      <span>{editCrewError}</span>
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
                      className={`crew-role-toggle-btn ${editCrewRole === "Driver" ? "active" : ""}`}
                      onClick={() => setEditCrewRole("Driver")}
                    >
                      Driver
                    </button>
                    <button
                      type="button"
                      className={`crew-role-toggle-btn ${editCrewRole === "Helper" ? "active" : ""}`}
                      onClick={() => setEditCrewRole("Helper")}
                    >
                      Helper
                    </button>
                  </div>
                </div>

                <div className="routex-dialog-field">
                  <label htmlFor="edit-fleet-crew-name" style={{ fontWeight: 600, fontSize: "12px" }}>
                    {editCrewRole} Full Name *
                  </label>
                  <input
                    id="edit-fleet-crew-name"
                    type="text"
                    required
                    value={editCrewFullName}
                    onChange={(e) => setEditCrewFullName(e.target.value)}
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
                  <label htmlFor="edit-fleet-crew-contact" style={{ fontWeight: 600, fontSize: "12px" }}>
                    Contact Number (Optional)
                  </label>
                  <input
                    id="edit-fleet-crew-contact"
                    type="tel"
                    placeholder="e.g. 0917-123-4567"
                    value={editCrewContact}
                    onChange={(e) => setEditCrewContact(e.target.value)}
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
                  disabled={editCrewSubmitting}
                  title="Cancel editing crew member and close dialog"
                  onClick={() => setEditingCrewMember(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={editCrewSubmitting || editCrewFullName.trim().length < 2}
                >
                  {editCrewSubmitting ? "Saving Changes..." : "Save Changes"}
                </button>
              </footer>
            </form>
          </div>
        </div>,
        document.body,
      ) : null}

      {crewToDelete && typeof document !== "undefined"
        ? createPortal(
            <div
              className="routex-dialog-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-crew-dialog-title"
              style={{ zIndex: 1000 }}
            >
              <div className="routex-dialog-backdrop" onClick={() => !isDeletingCrew && setCrewToDelete(null)} />
              <div className="routex-dialog" style={{ maxWidth: "460px" }}>
                <header className="routex-dialog-header" style={{ flexShrink: 0 }}>
                  <div>
                    <h2 id="delete-crew-dialog-title" style={{ fontSize: "17px", color: "var(--color-danger, #dc2626)" }}>
                      Delete Crew Member
                    </h2>
                    <p style={{ margin: "2px 0 0", fontSize: "11px" }}>
                      Action is audited and logged.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="routex-dialog-close"
                    aria-label="Close confirmation dialog"
                    title="Close (Esc)"
                    disabled={isDeletingCrew}
                    onClick={() => setCrewToDelete(null)}
                  >
                    ×
                  </button>
                </header>

                <div className="routex-dialog-body" style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--color-text-primary)" }}>
                    Are you sure you want to delete {crewToDelete.assignmentType.toLowerCase()} <strong>{crewToDelete.fullName}</strong> from the fleet roster?
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
                      <span style={{ color: "var(--color-text-muted)" }}>Role: </span>
                      <strong>{crewToDelete.assignmentType}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Name: </span>
                      <span>{crewToDelete.fullName}</span>
                    </div>
                    {crewToDelete.contactNumber ? (
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>Contact: </span>
                        <span>{crewToDelete.contactNumber}</span>
                      </div>
                    ) : null}
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
                    <strong>Warning:</strong> Removing this crew member will delete them from active fleet selection and registers an audit entry.
                  </div>
                </div>

                <footer className="routex-dialog-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isDeletingCrew}
                    onClick={() => setCrewToDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="danger-confirm-button"
                    disabled={isDeletingCrew}
                    onClick={handleConfirmDeleteCrew}
                  >
                    {isDeletingCrew ? "Deleting..." : `Delete ${crewToDelete.assignmentType}`}
                  </button>
                </footer>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
