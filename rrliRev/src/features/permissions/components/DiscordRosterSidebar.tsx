"use client";

import { getUserInitials } from "@/components/profile-photo";
import type { Permission, UserRole } from "@/lib/auth/rbac";
import type { CustomRoleRecord } from "@/lib/auth/custom-role-store";

export type BuiltInRoleKey = "superadmin" | UserRole;

export type ManagedUserSummary = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
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
              const memberCount =
                roleKey === "superadmin"
                  ? users.filter((u) => u.isSuperadmin).length
                  : users.filter(
                      (u) =>
                        !u.isSuperadmin &&
                        (u.role === roleKey ||
                          u.departments?.includes(roleKey) ||
                          departments.some(
                            (d) =>
                              (d.code === roleKey || d.id === roleKey) &&
                              u.departments?.includes(d.id),
                          )),
                    ).length;

              return (
                <button
                  key={roleKey}
                  type="button"
                  className={`discord-roster-item${isSelected ? " active" : ""}`}
                  onClick={() => onSelectEntity({ kind: "role", roleKey })}
                  aria-selected={isSelected}
                >
                  <div className="discord-roster-item-info">
                    <div className="discord-roster-item-name">{cfg.label}</div>
                    <div className="discord-roster-item-sub">
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
              const memberCount = users.filter((u) => u.departments?.includes(role.id)).length;

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
                    <div className="discord-roster-item-name">{role.name}</div>
                    <div className="discord-roster-item-sub">
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
                  <div className="discord-member-avatar-circle">
                    <span>{getUserInitials(user.fullName || user.username)}</span>
                  </div>
                  <div className="discord-roster-item-info">
                    <div className="discord-roster-item-name">
                      {user.fullName || user.username}
                      {isMe && <span className="discord-you-tag">(You)</span>}
                    </div>
                    <div className="discord-roster-item-sub">
                      @{user.username} · {user.isSuperadmin ? "President" : user.roleLabel}
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
