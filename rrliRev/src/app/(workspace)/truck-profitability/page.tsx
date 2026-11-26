"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

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
  getTripTotalDropoffs,
  isDeliveryFinanciallyComplete,
  summarizeTruckProfitability,
} from "@/features/deliveries/delivery-domain";
import {
  getFleetCrew,
  type FleetCrewMember,
} from "@/features/deliveries/driver-registry";
import {
  getTruckStorageCapability,
  TRUCK_CLASSIFICATION_FILTER_OPTIONS,
  TRUCK_PERFORMANCE_FILTER_OPTIONS,
  getAllAvailableTruckTypes,
  readCustomTruckTypes,
  saveCustomTruckType,
  ROUTEX_TRUCK_TYPES_CHANGED_EVENT,
  type FleetTruck,
  type TruckClassificationFilterKey,
  type TruckPerformanceFilterKey,
  type TruckStorageCapability,
} from "@/features/deliveries/truck-registry";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import { canManageTrucks } from "@/lib/auth/rbac";
import { formatPercent, formatPeso } from "@/lib/format";
import { CompactMoney } from "@/components/compact-money";

type SubcontractedTruckSortKey =
  | "plateNumber"
  | "truckType"
  | "classification"
  | "provider"
  | "driverName"
  | "helperName"
  | "contactPerson";

export default function TruckProfitabilityPage() {
  const router = useRouter();
  const actor = useAuthenticatedActor();
  const canAdd = canManageTrucks(actor);
  const canDeleteTruck = Boolean(
    actor.isSuperadmin || actor.role === "admin" || actor.roles?.includes("admin"),
  );

  const { range, setRange } = useGlobalDateRange();
  const { deliveries: dateFilteredTrips, loading, error } = usePersistedDeliveries(range);

  // Filter & sort states - Owned Trucks search
  const {
    value: plateSearch,
    setValue: setPlateSearch,
    bufferedQuery: debouncedPlateSearch,
    isBuffering: isPlateSearchBuffering,
    clear: clearPlateSearch,
    reset: resetPlateSearch,
  } = useSearchBuffer({ delay: 500 });

  // Subcontracted Trucks search
  const {
    value: subconSearch,
    setValue: setSubconSearch,
    bufferedQuery: debouncedSubconSearch,
    isBuffering: isSubconSearchBuffering,
    clear: clearSubconSearch,
  } = useSearchBuffer({ delay: 500 });
  const [classificationFilter, setClassificationFilter] = useState<TruckClassificationFilterKey>("all");
  const [performanceFilter, setPerformanceFilter] = useState<TruckPerformanceFilterKey>("all");
  const [vehicleSizeFilter, setVehicleSizeFilter] = useState<string>("all");
  const [ownedTruckSort, setOwnedTruckSort] = useState<OwnedTruckSort>("plate");
  const [ownedViewMode, setOwnedViewMode] = useState<"grid" | "list">("grid");
  const [selectedSubconPlates, setSelectedSubconPlates] = useState<Set<string>>(new Set());
  const [selectedOwnedPlates, setSelectedOwnedPlates] = useState<Set<string>>(new Set());

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
  const [crew, setCrew] = useState<FleetCrewMember[]>([]);
  const [crewRoleFilter, setCrewRoleFilter] = useState<"All" | "Driver" | "Helper">("All");
  const {
    value: crewSearch,
    setValue: setCrewSearch,
    bufferedQuery: debouncedCrewSearch,
    isBuffering: isCrewSearchBuffering,
    clear: clearCrewSearch,
  } = useSearchBuffer({ delay: 500 });
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
  const [editStorageCapability, setEditStorageCapability] = useState<TruckStorageCapability>("Freezer");
  const [editOwnershipType, setEditOwnershipType] = useState<FleetTruck["ownershipType"]>("Owned");
  const [editProvider, setEditProvider] = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editDriverName, setEditDriverName] = useState("");
  const [editHelperName, setEditHelperName] = useState("");
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

  const deduplicatedCrew = useMemo(() => {
    const map = new Map<string, FleetCrewMember>();
    for (const c of crew) {
      const key = (c.fullName ?? "").trim().toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, c);
      } else if (c.assignmentType === "Driver" && existing.assignmentType === "Helper") {
        map.set(key, c);
      }
    }
    return Array.from(map.values());
  }, [crew]);

  const filteredCrew = useMemo(() => {
    let list = deduplicatedCrew;
    if (crewRoleFilter !== "All") {
      list = list.filter((c) => c.assignmentType === crewRoleFilter);
    }
    if (debouncedCrewSearch.trim()) {
      const q = debouncedCrewSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          (c.contactNumber && c.contactNumber.toLowerCase().includes(q)) ||
          c.assignmentType.toLowerCase().includes(q),
      );
    }
    return list;
  }, [crew, crewRoleFilter, debouncedCrewSearch]);

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
  }, [crewRoleFilter, debouncedCrewSearch]);

  const paginatedCrew = useMemo(() => {
    const start = (crewPage - 1) * CREW_PAGE_SIZE;
    return filteredCrew.slice(start, start + CREW_PAGE_SIZE);
  }, [filteredCrew, crewPage]);

  const driverCount = useMemo(
    () => deduplicatedCrew.filter((c) => c.assignmentType === "Driver").length,
    [deduplicatedCrew],
  );
  const helperCount = useMemo(
    () => deduplicatedCrew.filter((c) => c.assignmentType === "Helper").length,
    [deduplicatedCrew],
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
      toast.success(`${editCrewRole} updated`, {
        description: `"${normalizedName}" details updated successfully.`,
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
      toast.success("Crew member deleted", {
        description: `${crewToDelete.assignmentType} "${crewToDelete.fullName}" was removed from the fleet roster.`,
      });
      setCrewToDelete(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete crew member.";
      setFeedback({
        tone: "error",
        text: msg,
      });
      toast.error(msg);
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
          toast.success("Copied to clipboard", {
            description: `Contact number (${member.contactNumber}) copied.`,
          });
        })
        .catch(() => {
          setFeedback({
            tone: "error",
            text: "Unable to copy to clipboard.",
          });
          toast.error("Unable to copy to clipboard");
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
      toast.success("Crew status changed", {
        description: `${member.fullName} is now ${nextActive ? "Active" : "Inactive"}.`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to update crew status.";
      setFeedback({ tone: "error", text: msg });
      toast.error(msg);
    } finally {
      setCrewStatusPendingId(null);
    }
  }

  // Add Truck Form states
  const [plateNumber, setPlateNumber] = useState("");
  const [truckType, setTruckType] = useState<FleetTruck["truckType"]>("6-Wheeler");
  const [storageCapability, setStorageCapability] = useState<TruckStorageCapability>("Freezer");
  const [ownershipType, setOwnershipType] = useState<FleetTruck["ownershipType"]>("Owned");
  const [provider, setProvider] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [driverName, setDriverName] = useState("");
  const [helperName, setHelperName] = useState("");
  const [truckPhotoFile, setTruckPhotoFile] = useState<File | null>(null);
  const [truckPhotoPreview, setTruckPhotoPreview] = useState<string | null>(null);

  // Automatically harvest any drivers and helpers already recorded in deliveries
  useEffect(() => {
    const localDeliveries = readBrowserPreviewDeliveries();
    const allDeliveries = [...localDeliveries, ...(dateFilteredTrips || [])];

    setCrew((prev) => {
      // Deduplicate by person's normalized full name
      // A person must only appear ONCE in the crew roster!
      const crewMap = new Map<string, FleetCrewMember>();
      for (const c of prev) {
        const norm = c.fullName.trim().toLowerCase();
        if (!norm) continue;
        const existing = crewMap.get(norm);
        if (!existing) {
          crewMap.set(norm, c);
        } else if (c.assignmentType === "Driver" && existing.assignmentType === "Helper") {
          crewMap.set(norm, c);
        }
      }

      for (const trip of allDeliveries) {
        if (trip.driverName) {
          const names = parsePersonnelNames(trip.driverName);
          for (const name of names) {
            const key = name.trim().toLowerCase();
            if (!key) continue;
            const existing = crewMap.get(key);
            if (!existing) {
              const count = Array.from(crewMap.values()).filter((c) => c.assignmentType === "Driver").length + 1;
              crewMap.set(key, {
                id: `driver-${key.replace(/[^a-z0-9]+/g, "-")}`,
                employeeCode: `DRV-${String(count).padStart(2, "0")}`,
                fullName: name.trim(),
                assignmentType: "Driver",
                contactNumber: null,
                isActive: true,
              });
            } else if (existing.assignmentType === "Helper") {
              // A driver should not also be listed as a helper: ensure role is Driver
              crewMap.set(key, { ...existing, assignmentType: "Driver" });
            }
          }
        }

        if (trip.helperName) {
          const names = parsePersonnelNames(trip.helperName);
          for (const name of names) {
            const key = name.trim().toLowerCase();
            if (!key) continue;
            const existing = crewMap.get(key);
            if (!existing) {
              const count = Array.from(crewMap.values()).filter((c) => c.assignmentType === "Helper").length + 1;
              crewMap.set(key, {
                id: `helper-${key.replace(/[^a-z0-9]+/g, "-")}`,
                employeeCode: `HLP-${String(count).padStart(2, "0")}`,
                fullName: name.trim(),
                assignmentType: "Helper",
                contactNumber: null,
                isActive: true,
              });
            }
            // If existing is already Driver, do NOT duplicate or overwrite with Helper!
          }
        }
      }

      return Array.from(crewMap.values());
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
          setExtraTrucks(data.trucks);
        }
      })
      .catch(() => {});

    fetch("/api/drivers")
      .then((res) => res.json())
      .then((data: { ok?: boolean; drivers?: FleetCrewMember[]; crew?: FleetCrewMember[] }) => {
        const incoming = data?.crew ?? data?.drivers;
        if (data?.ok && Array.isArray(incoming)) {
          // Deduplicate by normalized name (case-insensitive)
          // A driver should not also be listed as a helper
          const uniqueMap = new Map<string, FleetCrewMember>();
          for (const m of incoming) {
            const norm = (m.fullName ?? "").trim().toLowerCase();
            if (!norm) continue;
            const existing = uniqueMap.get(norm);
            if (!existing) {
              uniqueMap.set(norm, m);
            } else if (m.assignmentType === "Driver" && existing.assignmentType === "Helper") {
              uniqueMap.set(norm, m);
            }
          }
          setCrew(applyBrowserCrewStatuses(Array.from(uniqueMap.values())));
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
    return extraTrucks.filter((t) => !deletedPlates.has(t.plateNumber.trim().toUpperCase()));
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
      const dropoffsCount = truckTrips.reduce((sum, t) => sum + getTripTotalDropoffs(t.dropoffs), 0);
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
            const leftCap = getTruckStorageCapability(left.plateNumber, left.storageCapability);
            const rightCap = getTruckStorageCapability(right.plateNumber, right.storageCapability);
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

  const [customSizes, setCustomSizes] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    return readCustomTruckTypes();
  });

  useEffect(() => {
    const syncTypes = () => setCustomSizes(readCustomTruckTypes());
    window.addEventListener(ROUTEX_TRUCK_TYPES_CHANGED_EVENT, syncTypes);
    window.addEventListener("storage", syncTypes);
    return () => {
      window.removeEventListener(ROUTEX_TRUCK_TYPES_CHANGED_EVENT, syncTypes);
      window.removeEventListener("storage", syncTypes);
    };
  }, []);

  const availableTruckSizes = useMemo(() => {
    return getAllAvailableTruckTypes([...allOwnedTrucks, ...allSubcontractedTrucks]);
  }, [allOwnedTrucks, allSubcontractedTrucks, customSizes]);

  const vehicleSizeFilterOptions = useMemo(() => {
    return [
      { value: "all", label: "All Vehicle Sizes" },
      ...availableTruckSizes.map((size) => ({ value: size, label: size })),
    ];
  }, [availableTruckSizes]);

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

      // 2. Classification Filter (Freezer, Chilled, Dry)
      if (classificationFilter !== "all") {
        const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
        const normCap = capability.toLowerCase();
        if (classificationFilter === "cold" || classificationFilter === "refrigerated") {
          if (normCap !== "freezer" && normCap !== "chilled") return false;
        } else if (normCap !== classificationFilter) {
          return false;
        }
      }

      // 3. Vehicle Size Filter (Middle Truck Filter)
      if (vehicleSizeFilter !== "all" && truck.truckType.toLowerCase() !== vehicleSizeFilter.toLowerCase()) {
        return false;
      }

      // 4. Performance / Value Filter (if URL param set)
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
  }, [classificationFilter, vehicleSizeFilter, performanceFilter, debouncedPlateSearch, sortedTruckSummaries]);

  const sortedSubcontractedTrucks = useMemo(() => {
    const direction = subcontractedSort.direction === "asc" ? 1 : -1;

    return [...allSubcontractedTrucks].sort((left, right) => {
      if (subcontractedSort.key === "classification") {
        const leftCap = getTruckStorageCapability(left.plateNumber, left.storageCapability);
        const rightCap = getTruckStorageCapability(right.plateNumber, right.storageCapability);
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
        const normCap = capability.toLowerCase();
        if (classificationFilter === "cold" || classificationFilter === "refrigerated") {
          return normCap === "freezer" || normCap === "chilled";
        }
        return normCap === classificationFilter;
      });
    }
    if (!debouncedSubconSearch.trim()) return result;
    const clean = debouncedSubconSearch.trim().toLowerCase().replace(/\s+/g, "");
    const q = debouncedSubconSearch.trim().toLowerCase();
    return result.filter(
      (t) =>
        t.plateNumber.toLowerCase().includes(q) ||
        t.plateNumber.replace(/\s+/g, "").toLowerCase().includes(clean) ||
        (t.provider && t.provider.toLowerCase().includes(q)) ||
        (t.driverName && t.driverName.toLowerCase().includes(q)) ||
        (t.helperName && t.helperName.toLowerCase().includes(q)) ||
        (t.contactPerson && t.contactPerson.toLowerCase().includes(q)) ||
        (t.truckType && t.truckType.toLowerCase().includes(q)),
    );
  }, [classificationFilter, debouncedSubconSearch, sortedSubcontractedTrucks]);

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
  }, [debouncedSubconSearch, classificationFilter, subcontractedSort]);

  const isInitialUrlHydrated = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || isInitialUrlHydrated.current) return;
    isInitialUrlHydrated.current = true;
    const params = new URLSearchParams(window.location.search);

    const qParam = params.get("q") || params.get("search");
    if (qParam) resetPlateSearch(qParam);

    const classParam = params.get("class");
    if (
      classParam === "all" ||
      classParam === "freezer" ||
      classParam === "chilled" ||
      classParam === "dry" ||
      classParam === "cold" ||
      classParam === "refrigerated"
    ) {
      setClassificationFilter(classParam as TruckClassificationFilterKey);
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

  // Summary counts across all owned trucks (so clicking a classification pill doesn't zero out the other pills)
  const { totalOwnedCount, freezerCount, chilledCount, dryCount } = useMemo(() => {
    let freezer = 0;
    let chilled = 0;
    let dry = 0;
    for (const t of sortedTruckSummaries) {
      const cap = getTruckStorageCapability(t.plateNumber, t.storageCapability);
      if (cap === "Freezer") freezer++;
      else if (cap === "Chilled") chilled++;
      else dry++;
    }
    return {
      totalOwnedCount: sortedTruckSummaries.length,
      freezerCount: freezer,
      chilledCount: chilled,
      dryCount: dry,
    };
  }, [sortedTruckSummaries]);

  const hasActiveFilters = Boolean(
    plateSearch.trim() ||
    classificationFilter !== "all" ||
    vehicleSizeFilter !== "all" ||
    performanceFilter !== "all" ||
    range.startDate ||
    range.endDate
  );

  function handleResetFilters() {
    clearPlateSearch();
    setClassificationFilter("all");
    setVehicleSizeFilter("all");
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
          driverName: ownershipType === "Subcontracted" ? driverName : null,
          helperName: ownershipType === "Subcontracted" ? helperName : null,
          contactPerson: ownershipType === "Subcontracted" ? (driverName || contactPerson || null) : null,
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
      setStorageCapability("Freezer");
      setOwnershipType("Owned");
      setProvider("");
      setContactPerson("");
      setDriverName("");
      setHelperName("");
      setTruckPhotoFile(null);
      setTruckPhotoPreview(null);
      setIsAddTruckOpen(false);

      setFeedback({
        tone: "success",
        text: `Truck ${payload.truck.plateNumber} (${payload.truck.ownershipType} ${payload.truck.truckType} · ${storageCapability}) successfully registered into the fleet.`,
      });
      toast.success("Truck registered", {
        description: `Truck ${payload.truck.plateNumber} (${payload.truck.ownershipType} ${payload.truck.truckType} · ${storageCapability}) registered into the fleet.`,
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
    driverName?: string | null;
    helperName?: string | null;
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
    const resolvedDriver = truck.driverName ?? fullRecord?.driverName ?? truck.contactPerson ?? fullRecord?.contactPerson ?? "";
    const resolvedHelper = truck.helperName ?? fullRecord?.helperName ?? "";
    const resolvedContact = truck.contactPerson ?? fullRecord?.contactPerson ?? resolvedDriver ?? "";

    setEditingTruck({
      id: fullRecord?.id ?? truck.id ?? truck.plateNumber,
      plateNumber: truck.plateNumber,
      truckType: resolvedType,
      storageCapability: resolvedCapability,
      ownershipType: resolvedOwnership,
      rateBasis: resolvedOwnership === "Owned" ? "Redeemed Rate" : "Trucker Rate",
      provider: resolvedProvider || null,
      driverName: resolvedDriver || null,
      helperName: resolvedHelper || null,
      contactPerson: resolvedContact || null,
    });
    setEditPlateNumber(truck.plateNumber);
    setEditTruckType(resolvedType);
    setEditStorageCapability(resolvedCapability);
    setEditOwnershipType(resolvedOwnership);
    setEditProvider(resolvedProvider);
    setEditContactPerson(resolvedContact);
    setEditDriverName(resolvedDriver);
    setEditHelperName(resolvedHelper);
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
      setEditTruckError("Trucker is required for subcontracted trucks.");
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
          driverName: editOwnershipType === "Subcontracted" ? (editDriverName.trim() || null) : null,
          helperName: editOwnershipType === "Subcontracted" ? (editHelperName.trim() || null) : null,
          contactPerson: editOwnershipType === "Subcontracted" ? (editDriverName.trim() || editContactPerson.trim() || null) : null,
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
        text: `Truck ${updatedTruck.plateNumber} (${updatedTruck.ownershipType} ${updatedTruck.truckType} · ${editStorageCapability}) updated successfully.`,
      });
      toast.success("Truck updated", {
        description: `Truck ${updatedTruck.plateNumber} updated successfully.`,
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
      toast.success("Truck deleted", {
        description: `Truck ${truckToDelete.plateNumber} was removed from the fleet.`,
      });
      setTruckToDelete(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete truck.";
      setFeedback({
        tone: "error",
        text: msg,
      });
      toast.error("Failed to delete truck", {
        description: msg,
      });
    } finally {
      setIsDeletingTruck(false);
    }
  }

  async function handleBulkDeleteOwnedTrucks() {
    if (selectedOwnedPlates.size === 0 || isDeletingTruck) return;
    const count = selectedOwnedPlates.size;
    if (!window.confirm(`Are you sure you want to delete ${count} selected truck${count > 1 ? "s" : ""}?`)) return;
    setIsDeletingTruck(true);
    try {
      for (const plate of Array.from(selectedOwnedPlates)) {
        deleteBrowserPreviewTruck(plate);
      }
      setDeletedPlates((prev) => new Set([...prev, ...Array.from(selectedOwnedPlates).map((p) => p.toUpperCase())]));
      setSelectedOwnedPlates(new Set());
      toast.success(`Deleted ${count} truck(s) from fleet registry`);
    } finally {
      setIsDeletingTruck(false);
    }
  }

  async function handleBulkDeleteSubconTrucks() {
    if (selectedSubconPlates.size === 0 || isDeletingTruck) return;
    const count = selectedSubconPlates.size;
    if (!window.confirm(`Are you sure you want to delete ${count} selected subcontracted truck${count > 1 ? "s" : ""}?`)) return;
    setIsDeletingTruck(true);
    try {
      for (const plate of Array.from(selectedSubconPlates)) {
        deleteBrowserPreviewTruck(plate);
      }
      setDeletedPlates((prev) => new Set([...prev, ...Array.from(selectedSubconPlates).map((p) => p.toUpperCase())]));
      setSelectedSubconPlates(new Set());
      toast.success(`Deleted ${count} subcontracted truck(s) from fleet registry`);
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

    const existingCrew = crew.find((c) => c.fullName.trim().toLowerCase() === normalizedName.toLowerCase());
    if (existingCrew) {
      setCrewFormError(`Crew member "${normalizedName}" is already registered as a ${existingCrew.assignmentType}.`);
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
        if (prev.some((c) => c.fullName.toLowerCase() === registered.fullName.toLowerCase())) {
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
      toast.success(`${registered.assignmentType} registered`, {
        description: `"${registered.fullName}" added to fleet roster.`,
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
                <div className="ledger-total-badge interactive-classification-badge" role="group" aria-label="Quick filter by truck classification">
                  <button
                    type="button"
                    className={`classification-badge-segment${classificationFilter === "all" ? " is-active" : ""}`}
                    onClick={() => setClassificationFilter("all")}
                    title="Show all owned trucks"
                  >
                    {totalOwnedCount} trucks
                  </button>
                  <span className="classification-badge-dot" aria-hidden="true">·</span>
                  <button
                    type="button"
                    className={`classification-badge-segment is-freezer${classificationFilter === "freezer" ? " is-active" : ""}`}
                    onClick={() => setClassificationFilter((curr) => (curr === "freezer" ? "all" : "freezer"))}
                    title="Filter by Freezer trucks"
                  >
                    {freezerCount} Freezer
                  </button>
                  <span className="classification-badge-dot" aria-hidden="true">·</span>
                  <button
                    type="button"
                    className={`classification-badge-segment is-chilled${classificationFilter === "chilled" ? " is-active" : ""}`}
                    onClick={() => setClassificationFilter((curr) => (curr === "chilled" ? "all" : "chilled"))}
                    title="Filter by Chilled trucks"
                  >
                    {chilledCount} Chilled
                  </button>
                  <span className="classification-badge-dot" aria-hidden="true">·</span>
                  <button
                    type="button"
                    className={`classification-badge-segment is-dry${classificationFilter === "dry" ? " is-active" : ""}`}
                    onClick={() => setClassificationFilter((curr) => (curr === "dry" ? "all" : "dry"))}
                    title="Filter by Dry trucks"
                  >
                    {dryCount} Dry
                  </button>
                </div>
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

              <div className="filter-select-wrapper">
                <RoundedSelect
                  value={classificationFilter}
                  options={TRUCK_CLASSIFICATION_FILTER_OPTIONS}
                  onChange={(val) => setClassificationFilter(val as TruckClassificationFilterKey)}
                  ariaLabel="Filter trucks by classification"
                  placeholder="All Classifications"
                />
              </div>

              <div className="filter-select-wrapper">
                <RoundedSelect
                  value={vehicleSizeFilter}
                  options={vehicleSizeFilterOptions}
                  onChange={(val) => setVehicleSizeFilter(val)}
                  ariaLabel="Filter trucks by vehicle size"
                  placeholder="All Vehicle Sizes"
                />
              </div>

              <div className="filter-select-wrapper">
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
                      (classificationFilter === "refrigerated" || classificationFilter === "cold" ? "Cold Chain" : classificationFilter)}
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
                {vehicleSizeFilter !== "all" && (
                  <span className="filter-chip">
                    <span className="filter-chip-category">Vehicle Size:</span>{" "}
                    {vehicleSizeFilter}
                    <button
                      type="button"
                      className="filter-chip-remove"
                      aria-label="Remove vehicle size filter"
                      title="Clear vehicle size filter"
                      onClick={() => setVehicleSizeFilter("all")}
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

          {error ? null : (loading && sortedTruckSummaries.length === 0) ? (
            <SimpleLoading message="Loading trucks…" />
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
                                <span className="truck-spec-text">
                                  {truck.truckType} · {capability}
                                </span>
                              </div>
                            </div>
                            <span className={`fleet-trips-text ${ownedTruckSort === "deliveries" ? "highlight-metric" : ""}`}>
                              {truck.completedTrips} trip{truck.completedTrips === 1 ? "" : "s"}
                            </span>
                          </div>
                          <dl>
                            <div className={`truck-card-revenue truck-card-metric ${ownedTruckSort === "revenue" ? "highlight-active-sort" : ""}`}>
                              <dt>Revenue</dt>
                              <dd><CompactMoney value={truck.totalEarnings} /></dd>
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
                                  + <CompactMoney value={truck.pendingEarnings} />
                                </span>
                              ) : null}
                            </div>
                            <div className={`truck-card-metric ${ownedTruckSort === "expenses" ? "highlight-active-sort" : ""}`}>
                              <dt>Expenses</dt>
                              <dd><CompactMoney value={truck.totalExpenses} /></dd>
                            </div>
                            <div className={`truck-card-metric ${ownedTruckSort === "netProfit" ? "highlight-active-sort" : ""}`}>
                              <dt>Net Profit</dt>
                              <dd><CompactMoney value={truck.netProfit} /></dd>
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
                          {canDeleteTruck && (
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
              {selectedOwnedPlates.size > 0 && (
                <div className="bulk-selection-bar" role="region" aria-label="Selected owned trucks actions">
                  <span className="bulk-selection-count">
                    <strong>{selectedOwnedPlates.size}</strong> owned truck{selectedOwnedPlates.size === 1 ? "" : "s"} selected
                  </span>
                  <div className="bulk-selection-actions" style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ minHeight: "28px", fontSize: "11.5px", padding: "0 10px", color: "var(--color-danger, #dc2626)", borderColor: "rgba(220, 38, 38, 0.3)" }}
                      onClick={handleBulkDeleteOwnedTrucks}
                      disabled={isDeletingTruck}
                    >
                      {isDeletingTruck ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ minHeight: "28px", fontSize: "11.5px", padding: "0 10px" }}
                      onClick={() => setSelectedOwnedPlates(new Set())}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="records-card owned-trucks-table-card" style={{ padding: 0, overflow: "hidden", marginTop: "12px" }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: "36px", textAlign: "center", paddingLeft: "12px", paddingRight: "4px" }}>
                          <input
                            type="checkbox"
                            className="table-select-checkbox"
                            aria-label="Select all owned trucks on page"
                            checked={
                              paginatedOwnedTrucks.length > 0 &&
                              paginatedOwnedTrucks.every((t) => selectedOwnedPlates.has(t.plateNumber))
                            }
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedOwnedPlates((prev) => {
                                const next = new Set(prev);
                                for (const t of paginatedOwnedTrucks) {
                                  if (checked) next.add(t.plateNumber);
                                  else next.delete(t.plateNumber);
                                }
                                return next;
                              });
                            }}
                          />
                        </th>
                        <SortableTableHeader label="Plate Number" sortKey="plate" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Vehicle Size" sortKey="truckType" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Classification" sortKey="classification" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Trips" sortKey="deliveries" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Revenue" sortKey="revenue" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Expenses" sortKey="expenses" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Net Profit" sortKey="netProfit" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        <SortableTableHeader label="Margin" sortKey="margin" activeSortKey={ownedListSort.key} direction={ownedListSort.direction} onSort={sortOwnedList} />
                        {canAdd && (
                          <th style={{ width: canDeleteTruck ? "76px" : "44px", textAlign: "right" }}>
                            <span className="sr-only">Actions</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOwnedTrucks.map((truck) => {
                        const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
                        const isRowSelected = selectedOwnedPlates.has(truck.plateNumber);

                        return (
                          <tr
                            key={truck.plateNumber}
                            className={`clickable-table-row${isRowSelected ? " is-selected" : ""}`}
                            onClick={() => router.push(buildTruckDetailHref(truck.plateNumber))}
                            style={{
                              position: "relative",
                              cursor: "pointer",
                            }}
                          >
                            <td
                              style={{ width: "36px", textAlign: "center", paddingLeft: "12px", paddingRight: "4px" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="table-select-checkbox"
                                aria-label={`Select truck ${truck.plateNumber}`}
                                checked={isRowSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSelectedOwnedPlates((prev) => {
                                    const next = new Set(prev);
                                    if (checked) next.add(truck.plateNumber);
                                    else next.delete(truck.plateNumber);
                                    return next;
                                  });
                                }}
                              />
                            </td>
                            <td>
                              <strong className="truck-code">{truck.plateNumber}</strong>
                            </td>
                            <td><span className="truck-table-spec">{truck.truckType}</span></td>
                            <td>{capability}</td>
                            <td>
                              <span className="fleet-trips-text">
                                {truck.completedTrips} trip{truck.completedTrips === 1 ? "" : "s"}
                              </span>
                            </td>
                            <td>
                              <div>
                                <strong><CompactMoney value={truck.totalEarnings} /></strong>
                                {truck.pendingEarnings > 0 ? (
                                  <span
                                    style={{
                                      display: "block",
                                      fontSize: "11px",
                                      color: "var(--color-accent, #d97706)",
                                      fontWeight: 500,
                                    }}
                                  >
                                    + <CompactMoney value={truck.pendingEarnings} />
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td><CompactMoney value={truck.totalExpenses} /></td>
                            <td>
                              <strong style={{ color: truck.netProfit >= 0 ? "var(--color-success, #10b981)" : "var(--color-danger, #ef4444)" }}>
                                <CompactMoney value={truck.netProfit} />
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
                                  {canDeleteTruck && (
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

          <div className="filters subcontracted-filters">
            <label className={`search-box${isSubconSearchBuffering ? " is-buffering" : ""}`}>
              <span className="sr-only">Search subcontracted trucks</span>
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
                placeholder="Search subcontracted trucks by plate, trucker, or driver…"
                aria-label="Filter subcontracted trucks by plate, trucker, or driver"
                value={subconSearch}
                onChange={(e) => setSubconSearch(e.target.value)}
              />
              {isSubconSearchBuffering && (
                <span className="search-buffer-indicator" title="Buffering search…" aria-label="Buffering search…" />
              )}
            </label>
          </div>

          {selectedSubconPlates.size > 0 && (
            <div className="bulk-selection-bar" role="region" aria-label="Selected subcontracted trucks actions">
              <span className="bulk-selection-count">
                <strong>{selectedSubconPlates.size}</strong> subcontracted truck{selectedSubconPlates.size === 1 ? "" : "s"} selected
              </span>
              <div className="bulk-selection-actions" style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ minHeight: "28px", fontSize: "11.5px", padding: "0 10px", color: "var(--color-danger, #dc2626)", borderColor: "rgba(220, 38, 38, 0.3)" }}
                  onClick={handleBulkDeleteSubconTrucks}
                  disabled={isDeletingTruck}
                >
                  {isDeletingTruck ? "Deleting..." : "Delete"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ minHeight: "28px", fontSize: "11.5px", padding: "0 10px" }}
                  onClick={() => setSelectedSubconPlates(new Set())}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "36px", textAlign: "center", paddingLeft: "12px", paddingRight: "4px" }}>
                    <input
                      type="checkbox"
                      className="table-select-checkbox"
                      aria-label="Select all subcontracted trucks on page"
                      checked={
                        paginatedSubcontractedTrucks.length > 0 &&
                        paginatedSubcontractedTrucks.every((t) => selectedSubconPlates.has(t.plateNumber))
                      }
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedSubconPlates((prev) => {
                          const next = new Set(prev);
                          for (const t of paginatedSubcontractedTrucks) {
                            if (checked) next.add(t.plateNumber);
                            else next.delete(t.plateNumber);
                          }
                          return next;
                        });
                      }}
                    />
                  </th>
                  <SortableTableHeader label="Trucker" sortKey="provider" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Plate Number" sortKey="plateNumber" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Vehicle Size" sortKey="truckType" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Classification" sortKey="classification" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Driver" sortKey="driverName" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  <SortableTableHeader label="Helper/s" sortKey="helperName" activeSortKey={subcontractedSort.key} direction={subcontractedSort.direction} onSort={sortSubcontractedTrucks} />
                  {canAdd && (
                    <th style={{ width: canDeleteTruck ? "76px" : "44px", textAlign: "right" }}>
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedSubcontractedTrucks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canAdd ? 8 : 7}
                      className="table-empty-cell"
                    >
                      <div className="empty-state minimal" title="No subcontracted trucks">
                        <strong className="empty-state-title">No subcontracted trucks found</strong>
                        <span className="empty-state-desc">
                          {debouncedSubconSearch.trim()
                            ? `No subcontracted trucks matching "${debouncedSubconSearch.trim()}".`
                            : "Subcontracted trucks will appear here once added."}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedSubcontractedTrucks.map((truck) => {
                  const capability = getTruckStorageCapability(truck.plateNumber, truck.storageCapability);
                  const isRowSelected = selectedSubconPlates.has(truck.plateNumber);

                  return (
                    <tr
                      key={truck.plateNumber}
                      className={isRowSelected ? "is-selected" : undefined}
                      style={{
                        position: "relative",
                      }}
                    >
                      <td
                        style={{ width: "36px", textAlign: "center", paddingLeft: "12px", paddingRight: "4px" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="table-select-checkbox"
                          aria-label={`Select subcontracted truck ${truck.plateNumber}`}
                          checked={isRowSelected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedSubconPlates((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(truck.plateNumber);
                              else next.delete(truck.plateNumber);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="subcon-trucker-cell">
                        <strong className="subcon-trucker-primary">{truck.provider || "—"}</strong>
                      </td>
                      <td className="subcon-plate-cell">
                        <strong className="truck-code">{truck.plateNumber}</strong>
                      </td>
                      <td className="subcon-secondary-cell"><span className="truck-table-spec">{truck.truckType}</span></td>
                      <td className="subcon-secondary-cell">{capability}</td>
                      <td className="subcon-secondary-cell">{truck.driverName || truck.contactPerson || "—"}</td>
                      <td className="subcon-secondary-cell">{truck.helperName || "—"}</td>
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
                                  driverName: truck.driverName || truck.contactPerson,
                                  helperName: truck.helperName,
                                  contactPerson: truck.contactPerson,
                                });
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                              </svg>
                            </button>
                            {canDeleteTruck && (
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

          <div className="filters crew-filters" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <label className={`search-box${isCrewSearchBuffering ? " is-buffering" : ""}`}>
              <span className="sr-only">Search crew members</span>
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
                placeholder="Search crew members by name or contact…"
                aria-label="Filter crew members by name or contact"
                value={crewSearch}
                onChange={(e) => setCrewSearch(e.target.value)}
              />
              {isCrewSearchBuffering && (
                <span className="search-buffer-indicator" title="Buffering search…" aria-label="Buffering search…" />
              )}
            </label>

            <div className="crew-role-filter-pills" role="tablist" aria-label="Filter crew by role">
              <button
                type="button"
                role="tab"
                aria-selected={crewRoleFilter === "All"}
                className={`crew-role-tab ${crewRoleFilter === "All" ? "active" : ""}`}
                title="All crew"
                onClick={() => setCrewRoleFilter("All")}
              >
                All ({deduplicatedCrew.length})
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
                          {debouncedCrewSearch.trim()
                            ? `No crew members matching "${debouncedCrewSearch.trim()}".`
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
                      options={availableTruckSizes.map((s) => ({ value: s, label: s }))}
                      onChange={(value) => {
                        const trimmed = value ? value.trim() : "";
                        setTruckType(trimmed as FleetTruck["truckType"]);
                        if (trimmed) {
                          saveCustomTruckType(trimmed);
                          setCustomSizes(readCustomTruckTypes());
                        }
                      }}
                      ariaLabel="Select or type vehicle size"
                      searchable
                      allowCustomValue
                      searchPlaceholder="Type or select size..."
                      customValueLabel={(query) => (
                        <>
                          <span>Add </span>
                          <strong>{query}</strong>
                        </>
                      )}
                    />
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="new-truck-capability" style={{ fontWeight: 600, fontSize: "12px" }}>
                      Classification *
                    </label>
                    <RoundedSelect
                      value={storageCapability}
                      options={[
                        { value: "Freezer", label: "Freezer" },
                        { value: "Chilled", label: "Chilled" },
                        { value: "Dry", label: "Dry" },
                      ]}
                      onChange={(value) => setStorageCapability(value as TruckStorageCapability)}
                      ariaLabel="Select or type truck classification"
                      searchable
                      allowCustomValue
                      searchPlaceholder="Type or select classification..."
                    />
                  </div>
                </div>

                {ownershipType === "Subcontracted" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="routex-dialog-field">
                      <label htmlFor="new-truck-provider" style={{ fontWeight: 600, fontSize: "12px" }}>
                        Trucker *
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

                    <div className="routex-dialog-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div className="routex-dialog-field">
                        <label htmlFor="new-truck-driver" style={{ fontWeight: 600, fontSize: "12px" }}>
                          Driver
                        </label>
                        <input
                          id="new-truck-driver"
                          type="text"
                          placeholder="e.g. Adrian Cruz"
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
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
                        <label htmlFor="new-truck-helpers" style={{ fontWeight: 600, fontSize: "12px" }}>
                          Helper/s
                        </label>
                        <input
                          id="new-truck-helpers"
                          type="text"
                          placeholder="e.g. Rogelio Ramos"
                          value={helperName}
                          onChange={(e) => setHelperName(e.target.value)}
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
                      options={availableTruckSizes.map((s) => ({ value: s, label: s }))}
                      onChange={(value) => {
                        const trimmed = value ? value.trim() : "";
                        setEditTruckType(trimmed as FleetTruck["truckType"]);
                        if (trimmed) {
                          saveCustomTruckType(trimmed);
                          setCustomSizes(readCustomTruckTypes());
                        }
                      }}
                      ariaLabel="Select or type vehicle size"
                      searchable
                      allowCustomValue
                      searchPlaceholder="Type or select size..."
                      customValueLabel={(query) => (
                        <>
                          <span>Add </span>
                          <strong>{query}</strong>
                        </>
                      )}
                    />
                  </div>

                  <div className="routex-dialog-field">
                    <label htmlFor="edit-truck-capability" style={{ fontWeight: 600, fontSize: "12px" }}>
                      Classification *
                    </label>
                    <RoundedSelect
                      value={editStorageCapability}
                      options={[
                        { value: "Freezer", label: "Freezer" },
                        { value: "Chilled", label: "Chilled" },
                        { value: "Dry", label: "Dry" },
                      ]}
                      onChange={(value) => setEditStorageCapability(value as TruckStorageCapability)}
                      ariaLabel="Select or type truck classification"
                      searchable
                      allowCustomValue
                      searchPlaceholder="Type or select classification..."
                    />
                  </div>
                </div>

                {editOwnershipType === "Subcontracted" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="routex-dialog-field">
                      <label htmlFor="edit-truck-provider" style={{ fontWeight: 600, fontSize: "12px" }}>
                        Trucker *
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

                    <div className="routex-dialog-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div className="routex-dialog-field">
                        <label htmlFor="edit-truck-driver" style={{ fontWeight: 600, fontSize: "12px" }}>
                          Driver
                        </label>
                        <input
                          id="edit-truck-driver"
                          type="text"
                          placeholder="e.g. Adrian Cruz"
                          value={editDriverName}
                          onChange={(e) => setEditDriverName(e.target.value)}
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
                        <label htmlFor="edit-truck-helpers" style={{ fontWeight: 600, fontSize: "12px" }}>
                          Helper/s
                        </label>
                        <input
                          id="edit-truck-helpers"
                          type="text"
                          placeholder="e.g. Rogelio Ramos"
                          value={editHelperName}
                          onChange={(e) => setEditHelperName(e.target.value)}
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
