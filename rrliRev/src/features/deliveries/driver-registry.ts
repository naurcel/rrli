export type FleetCrewMember = {
  id: string;
  employeeCode: string;
  fullName: string;
  assignmentType: "Driver" | "Helper";
  contactNumber?: string | null;
  isActive: boolean;
};

export type FleetDriver = FleetCrewMember;

export const BASE_DRIVERS: readonly FleetCrewMember[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    employeeCode: "DRV-01",
    fullName: "Mateo Dela Vega",
    assignmentType: "Driver",
    contactNumber: null,
    isActive: true,
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    employeeCode: "DRV-02",
    fullName: "Nico Serrano",
    assignmentType: "Driver",
    contactNumber: null,
    isActive: true,
  },
] as const;

export const BASE_HELPERS: readonly FleetCrewMember[] = [
  {
    id: "30000000-0000-4000-8000-000000000003",
    employeeCode: "HLP-01",
    fullName: "Ira Santos",
    assignmentType: "Helper",
    contactNumber: null,
    isActive: true,
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    employeeCode: "HLP-02",
    fullName: "Paolo Reyes",
    assignmentType: "Helper",
    contactNumber: null,
    isActive: true,
  },
] as const;

export const dynamicFleetCrew: FleetCrewMember[] = [];
export const dynamicFleetDrivers = dynamicFleetCrew;
const inactiveFleetCrewIds = new Set<string>();
const deletedFleetCrewIds = new Set<string>();
const overriddenFleetCrew = new Map<string, Partial<FleetCrewMember>>();

export function getFleetCrew(): readonly FleetCrewMember[] {
  return [...BASE_DRIVERS, ...BASE_HELPERS, ...dynamicFleetCrew]
    .filter((member) => !deletedFleetCrewIds.has(member.id))
    .map((member) => {
      const overrides = overriddenFleetCrew.get(member.id);
      return {
        ...member,
        ...overrides,
        isActive:
          overrides?.isActive !== undefined
            ? overrides.isActive
            : !inactiveFleetCrewIds.has(member.id) && member.isActive,
      };
    });
}

export function getFleetDrivers(): readonly FleetCrewMember[] {
  return getFleetCrew().filter((member) => member.isActive);
}

export function setFleetCrewActive(
  identifier: string,
  isActive: boolean,
): { ok: true; crewMember: FleetCrewMember } | { ok: false; error: string } {
  const normalized = identifier.trim().toLowerCase();
  const member = getFleetCrew().find(
    (candidate) =>
      candidate.id.toLowerCase() === normalized ||
      candidate.employeeCode.toLowerCase() === normalized,
  );
  if (!member) return { ok: false, error: "CREW_MEMBER_NOT_FOUND" };

  if (isActive) inactiveFleetCrewIds.delete(member.id);
  else inactiveFleetCrewIds.add(member.id);

  const existingOverrides = overriddenFleetCrew.get(member.id) ?? {};
  overriddenFleetCrew.set(member.id, { ...existingOverrides, isActive });

  return { ok: true, crewMember: { ...member, isActive } };
}

export function updateFleetCrewMember(
  id: string,
  updates: {
    fullName?: string;
    assignmentType?: "Driver" | "Helper";
    contactNumber?: string | null;
    isActive?: boolean;
  },
): { ok: true; crewMember: FleetCrewMember } | { ok: false; error: string } {
  const normalized = id.trim().toLowerCase();
  const all = getFleetCrew();
  const existing = all.find((candidate) => candidate.id.toLowerCase() === normalized);
  if (!existing) {
    return { ok: false, error: "CREW_MEMBER_NOT_FOUND" };
  }

  if (updates.fullName !== undefined) {
    const trimmed = updates.fullName.trim();
    if (trimmed.length < 2) {
      return { ok: false, error: "Name must be at least 2 characters." };
    }
    const duplicate = all.some(
      (c) =>
        c.id.toLowerCase() !== normalized &&
        c.fullName.toLowerCase() === trimmed.toLowerCase() &&
        (updates.assignmentType ? c.assignmentType === updates.assignmentType : c.assignmentType === existing.assignmentType),
    );
    if (duplicate) {
      return { ok: false, error: `Crew member "${trimmed}" already exists.` };
    }
  }

  const existingOverrides = overriddenFleetCrew.get(existing.id) ?? {};
  const newOverrides: Partial<FleetCrewMember> = {
    ...existingOverrides,
    ...(updates.fullName !== undefined ? { fullName: updates.fullName.trim() } : {}),
    ...(updates.assignmentType !== undefined ? { assignmentType: updates.assignmentType } : {}),
    ...(updates.contactNumber !== undefined
      ? { contactNumber: updates.contactNumber ? updates.contactNumber.trim() : null }
      : {}),
    ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
  };
  overriddenFleetCrew.set(existing.id, newOverrides);

  const dynamicIndex = dynamicFleetCrew.findIndex((c) => c.id.toLowerCase() === normalized);
  if (dynamicIndex >= 0) {
    dynamicFleetCrew[dynamicIndex] = {
      ...dynamicFleetCrew[dynamicIndex],
      ...newOverrides,
    };
  }

  const updatedMember = getFleetCrew().find((c) => c.id.toLowerCase() === normalized)!;
  return { ok: true, crewMember: updatedMember };
}

export function deleteFleetCrewMember(id: string): { ok: true } | { ok: false; error: string } {
  const normalized = id.trim().toLowerCase();
  const all = getFleetCrew();
  const existing = all.find((candidate) => candidate.id.toLowerCase() === normalized);
  if (!existing) {
    return { ok: false, error: "CREW_MEMBER_NOT_FOUND" };
  }

  deletedFleetCrewIds.add(existing.id);
  const dynamicIndex = dynamicFleetCrew.findIndex((c) => c.id.toLowerCase() === normalized);
  if (dynamicIndex >= 0) {
    dynamicFleetCrew.splice(dynamicIndex, 1);
  }

  return { ok: true };
}

export function registerFleetCrewMember(input: {
  fullName: string;
  assignmentType?: "Driver" | "Helper";
  employeeCode?: string | null;
  contactNumber?: string | null;
}): { ok: true; driver: FleetCrewMember; crewMember: FleetCrewMember } | { ok: false; error: string } {
  const normalizedName = input.fullName.trim();
  const role: "Driver" | "Helper" = input.assignmentType === "Helper" ? "Helper" : "Driver";

  if (normalizedName.length < 2) {
    return { ok: false, error: `${role} name must be at least 2 characters.` };
  }

  const allCrew = getFleetCrew();
  const existing = allCrew.some(
    (d) => d.fullName.toLowerCase() === normalizedName.toLowerCase(),
  );
  if (existing) {
    return { ok: false, error: `${role} "${normalizedName}" already exists.` };
  }

  const prefix = role === "Helper" ? "HLP" : "DRV";
  const existingWithRole = allCrew.filter((c) => c.assignmentType === role);
  const count = existingWithRole.length + 1;
  const employeeCode =
    input.employeeCode?.trim().toUpperCase() ||
    `${prefix}-${String(count).padStart(2, "0")}`;

  const registered: FleetCrewMember = {
    id: `30000000-0000-4000-8000-${String(allCrew.length + 1).padStart(12, "0")}`,
    employeeCode,
    fullName: normalizedName,
    assignmentType: role,
    contactNumber: input.contactNumber?.trim() || null,
    isActive: true,
  };

  dynamicFleetCrew.push(registered);
  return { ok: true, driver: registered, crewMember: registered };
}

export const registerFleetDriver = registerFleetCrewMember;

export function resetDynamicFleetDrivers(): void {
  dynamicFleetCrew.length = 0;
  inactiveFleetCrewIds.clear();
  deletedFleetCrewIds.clear();
  overriddenFleetCrew.clear();
}
export const resetDynamicFleetCrew = resetDynamicFleetDrivers;
