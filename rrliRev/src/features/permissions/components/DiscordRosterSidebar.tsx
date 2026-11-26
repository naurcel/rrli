"use client";

import {
  getDefaultAvatarUrl,
  getProfileStorageKey,
  getUserInitials,
} from "@/components/profile-photo";
import type { Permission, UserRole } from "@/lib/auth/rbac";
import type { CustomRoleRecord } from "@/lib/auth/custom-role-store";

export type BuiltInRoleKey = "superadmin" | UserRole;

export type ManagedUserSummary = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  role: UserRole;
  roles?: readonly string[];
  roleLabel: string;
  accessLevel: any;
  accessLevelLabel: string;
  isActive: boolean;
  isSuperadmin?: boolean;
  designation?: string;
  departments?: readonly string[];
  customGrants?: readonly Permission[];
  customRestrictions?: readonly Permission[];
  effectivePermissions?: readonly Permission[];
};

export type DepartmentRecord = {
  id: string;
  code?: string;
  name: string;
  description: string;
  defaultPermissions: Permission[];
  isArchived: boolean;
};

export type SelectedEntity =
  | { kind: "role"; roleKey: BuiltInRoleKey }
  | { kind: "custom_role"; customRoleId: string }
  | { kind: "user"; userId: string };

export function getRoleBadgeColors(key: string): {
  dot: string;
  bg: string;
  border: string;
  text: string;
} {
  const k = key.toLowerCase();
  if (k === "superadmin" || k === "president") {
    return {
      dot: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.32)",
      text: "#b45309",
    };
  }
  if (k === "admin" || k === "dept-admin") {
    return {
      dot: "#8b5cf6",
      bg: "rgba(139, 92, 246, 0.12)",
      border: "rgba(139, 92, 246, 0.32)",
      text: "#6d28d9",
    };
  }
  if (k === "operations" || k === "dept-ops") {
    return {
      dot: "#10b981",
      bg: "rgba(16, 185, 129, 0.12)",
      border: "rgba(16, 185, 129, 0.32)",
      text: "#047857",
    };
  }
  if (k === "finance" || k === "dept-fin") {
    return {
      dot: "#0284c7",
      bg: "rgba(2, 132, 199, 0.12)",
      border: "rgba(2, 132, 199, 0.32)",
      text: "#0369a1",
    };
  }
  if (k === "hr" || k === "dept-hr") {
    return {
      dot: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.32)",
      text: "#b45309",
    };
  }
  if (k === "secretary" || k === "dept-sec") {
    return {
      dot: "#6366f1",
      bg: "rgba(99, 102, 241, 0.12)",
      border: "rgba(99, 102, 241, 0.32)",
      text: "#4338ca",
    };
  }
  if (
    k === "customer_representative" ||
    k === "customer representative" ||
    k === "dept-cs"
  ) {
    return {
      dot: "#ec4899",
      bg: "rgba(236, 72, 153, 0.12)",
      border: "rgba(236, 72, 153, 0.32)",
      text: "#be185d",
    };
  }
  return {
    dot: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.12)",
    border: "rgba(6, 182, 212, 0.32)",
    text: "#0e7490",
  };
}

export function resolveStaffAvatarUrl(user?: ManagedUserSummary | null): string | null {
  if (!user) return null;
  if (user.avatarUrl) return user.avatarUrl;
  if (typeof window !== "undefined") {
    try {
      const local = window.localStorage.getItem(getProfileStorageKey(user.id));
      if (local) return local;
    } catch {
      // Ignore storage error
    }
  }
  return getDefaultAvatarUrl(user.username);
}

interface DiscordRosterSidebarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filteredBuiltInRoles: readonly BuiltInRoleKey[];
  filteredCustomRoles: readonly CustomRoleRecord[];
  filteredUsers: readonly ManagedUserSummary[];
  selectedEntity: SelectedEntity;
  onSelectEntity: (entity: SelectedEntity) => void;
  canCreateRole: boolean;
  onOpenCreateRoleModal: () => void;
  actorId: string;
  builtInRoleConfig: Record<
    BuiltInRoleKey,
    { label: string; description: string; defaultPermissions: readonly Permission[] }
  >;
  users: readonly ManagedUserSummary[];
  departments: readonly DepartmentRecord[];
}

export function DiscordRosterSidebar({
  searchQuery,
  onSearchQueryChange,
  filteredBuiltInRoles,
  filteredCustomRoles,
  filteredUsers,
  selectedEntity,
  onSelectEntity,
  canCreateRole,
  onOpenCreateRoleModal,
  actorId,
  builtInRoleConfig,
  users,
  departments,
}: DiscordRosterSidebarProps) {
  return (
    <aside className="discord-roster-sidebar" aria-label="Roles and Employees list">
      <div className="discord-roster-search-wrap">
        <input
          type="text"
          placeholder="Filter roles or staff..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="discord-roster-search-input"
          aria-label="Filter roles or staff"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchQueryChange("")}
            className="discord-search-clear-btn"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className="discord-roster-scroll-area">
        {/* SECTION 1: BUILT-IN ROLES */}
        <div className="discord-roster-group">
          <div className="discord-roster-group-title">
            <span>Roles</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="discord-roster-count">
                {filteredBuiltInRoles.length + filteredCustomRoles.length}
              </span>
              {canCreateRole && (
                <button
                  type="button"
                  className="discord-add-role-btn"
                  onClick={onOpenCreateRoleModal}
                  title="Create custom role"
                >
                  + New
                </button>
              )}
            </div>
          </div>

          <div className="discord-roster-list" role="list">
            {filteredBuiltInRoles.map((roleKey) => {
              const cfg = builtInRoleConfig[roleKey];
              const isSelected =
                selectedEntity.kind === "role" && selectedEntity.roleKey === roleKey;
              const palette = getRoleBadgeColors(roleKey);
              const memberCount =
                roleKey === "superadmin"
                  ? users.filter((u) => u.isSuperadmin).length
                  : users.filter(
                      (u) =>
                        !u.isSuperadmin &&
                        (u.role === roleKey ||
                          u.roles?.includes(roleKey) ||
                          u.departments?.includes(roleKey) ||
                          departments.some(
                            (d) =>
                              (d.code === roleKey || d.id === roleKey) &&
                              (u.departments?.includes(d.id) || u.roles?.includes(d.id)),
                          )),
                    ).length;

              return (
                <button
                  key={roleKey}
                  type="button"
                  className={`discord-roster-item${isSelected ? " active" : ""}`}
                  onClick={() => onSelectEntity({ kind: "role", roleKey })}
                  aria-selected={isSelected}
                  style={
                    isSelected
                      ? {
                          background: palette.bg,
                          borderColor: palette.border,
                        }
                      : undefined
                  }
                >
                  <div className="discord-roster-item-info">
                    <div
                      className="discord-roster-item-name"
                      style={{ display: "flex", alignItems: "center", gap: "7px" }}
                    >
                      <span
                        className="discord-role-color-dot"
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: palette.dot,
                          boxShadow: `0 0 0 2px ${palette.bg}`,
                          flexShrink: 0,
                        }}
                        aria-hidden="true"
                      />
                      <span>{cfg.label}</span>
                    </div>
                    <div className="discord-roster-item-sub" style={{ paddingLeft: "15px" }}>
                      {memberCount} {memberCount === 1 ? "member" : "members"}
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredCustomRoles.length > 0 && (
              <div className="discord-roster-subheading">Custom Roles</div>
            )}
            {filteredCustomRoles.map((role) => {
              const isSelected =
                selectedEntity.kind === "custom_role" && selectedEntity.customRoleId === role.id;
              const palette = getRoleBadgeColors(role.name);
              const memberCount = users.filter(
                (u) => u.departments?.includes(role.id) || u.roles?.includes(role.id),
              ).length;

              return (
                <button
                  key={role.id}
                  type="button"
                  className={`discord-roster-item${isSelected ? " active" : ""}${
                    !role.isEnabled ? " is-disabled-role" : ""
                  }`}
                  onClick={() => onSelectEntity({ kind: "custom_role", customRoleId: role.id })}
                  aria-selected={isSelected}
                >
                  <div className="discord-roster-item-info">
                    <div
                      className="discord-roster-item-name"
                      style={{ display: "flex", alignItems: "center", gap: "7px" }}
                    >
                      <span
                        className="discord-role-color-dot"
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: palette.dot,
                          flexShrink: 0,
                        }}
                        aria-hidden="true"
                      />
                      <span>{role.name}</span>
                    </div>
                    <div className="discord-roster-item-sub" style={{ paddingLeft: "15px" }}>
                      {role.isEnabled
                        ? `${memberCount} ${memberCount === 1 ? "member" : "members"}`
                        : "Disabled"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: STAFF MEMBERS */}
        <div className="discord-roster-group">
          <div className="discord-roster-group-title">
            <span>Staff</span>
            <span className="discord-roster-count">{filteredUsers.length}</span>
          </div>

          <div className="discord-roster-list" role="list">
            {filteredUsers.map((user) => {
              const isSelected =
                selectedEntity.kind === "user" && selectedEntity.userId === user.id;
              const isMe = actorId === user.id;
              const avatarSrc = resolveStaffAvatarUrl(user);
              const rolePalette = getRoleBadgeColors(user.isSuperadmin ? "superadmin" : user.role);

              return (
                <button
                  key={user.id}
                  type="button"
                  className={`discord-roster-item${isSelected ? " active" : ""}${
                    user.isSuperadmin ? " is-superadmin-pinned" : ""
                  }`}
                  onClick={() => onSelectEntity({ kind: "user", userId: user.id })}
                  aria-selected={isSelected}
                >
                  <div
                    className="discord-member-avatar-circle"
                    style={{
                      overflow: "hidden",
                      position: "relative",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt={user.fullName || user.username}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "50%",
                          display: "block",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: "10.5px" }}>
                        {getUserInitials(user.fullName, user.username)}
                      </span>
                    )}
                  </div>
                  <div className="discord-roster-item-info">
                    <div className="discord-roster-item-name">
                      {user.fullName || user.username}
                      {isMe && <span className="discord-you-tag">(You)</span>}
                    </div>
                    <div
                      className="discord-roster-item-sub"
                      style={{ display: "flex", alignItems: "center", gap: "5px" }}
                    >
                      <span>@{user.username}</span>
                      <span>·</span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: rolePalette.dot,
                          fontWeight: 600,
                        }}
                      >
                        <span
                          style={{
                            width: "5px",
                            height: "5px",
                            borderRadius: "50%",
                            backgroundColor: rolePalette.dot,
                            flexShrink: 0,
                          }}
                          aria-hidden="true"
                        />
                        {user.isSuperadmin ? "President" : user.roleLabel}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
