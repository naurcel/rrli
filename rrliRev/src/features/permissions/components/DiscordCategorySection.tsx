"use client";

import type { Permission } from "@/lib/auth/rbac";
import type {
  FriendlyPermissionDefinition,
  PermissionCategory,
} from "../permission-ui-model";
import type { SelectedEntity, ManagedUserSummary } from "./DiscordRosterSidebar";

interface DiscordCategorySectionProps {
  cat: { id: PermissionCategory; label: string };
  perms: readonly FriendlyPermissionDefinition[];
  isCollapsed: boolean;
  onToggleCollapse: (catId: PermissionCategory) => void;
  canModifySelected: boolean;
  onSelectAll: (catId: PermissionCategory) => void;
  onClearAll: (catId: PermissionCategory) => void;
  selectedEntity: SelectedEntity;
  selectedUser?: ManagedUserSummary | null;
  currentRolePerms: readonly Permission[];
  currentUserGrants: readonly Permission[];
  currentUserRestrictions: readonly Permission[];
  effectiveUserPerms: ReadonlySet<Permission>;
  onToggleRolePermission: (permKey: Permission) => void;
  onToggleUserPermission: (permKey: Permission) => void;
  onResetUserPermission: (permKey: Permission) => void;
}

export function DiscordCategorySection({
  cat,
  perms,
  isCollapsed,
  onToggleCollapse,
  canModifySelected,
  onSelectAll,
  onClearAll,
  selectedEntity,
  selectedUser,
  currentRolePerms,
  currentUserGrants,
  currentUserRestrictions,
  effectiveUserPerms,
  onToggleRolePermission,
  onToggleUserPermission,
  onResetUserPermission,
}: DiscordCategorySectionProps) {
  if (perms.length === 0) return null;

  // Count enabled permissions in this module
  const enabledCount = perms.filter((def) => {
    if (selectedEntity.kind === "role" || selectedEntity.kind === "custom_role") {
      return currentRolePerms.includes(def.key);
    }
    return effectiveUserPerms.has(def.key);
  }).length;

  return (
    <section key={cat.id} className="discord-category-card" aria-labelledby={`cat-${cat.id}`}>
      {/* Module Category Header */}
      <div className="discord-category-header">
        <div
          className="discord-category-title-wrap"
          onClick={() => onToggleCollapse(cat.id)}
          role="button"
          tabIndex={0}
          aria-expanded={!isCollapsed}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleCollapse(cat.id);
            }
          }}
        >
          <button
            type="button"
            className={`discord-collapse-btn${isCollapsed ? " is-collapsed" : ""}`}
            aria-label={isCollapsed ? `Expand ${cat.label}` : `Collapse ${cat.label}`}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <h3 id={`cat-${cat.id}`} className="discord-category-title">
            {cat.label}
          </h3>
          <span className="discord-cat-count-chip">
            {enabledCount} / {perms.length}
          </span>
        </div>

        {/* Module-level Selection Controls: Select All / Clear All */}
        {canModifySelected && (
          <div className="discord-category-quick-actions">
            <button
              type="button"
              className="discord-quick-btn"
              onClick={() => onSelectAll(cat.id)}
              title={`Select all permissions in ${cat.label}`}
            >
              Select All
            </button>
            <button
              type="button"
              className="discord-quick-btn reset"
              onClick={() => onClearAll(cat.id)}
              title={`Clear all permissions in ${cat.label}`}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Permission Rows (Collapsible) */}
      {!isCollapsed && (
        <div className="discord-permissions-list">
          {perms.map((def) => {
            const isRole = selectedEntity.kind === "role" || selectedEntity.kind === "custom_role";
            const isSuperRole =
              selectedEntity.kind === "role" && selectedEntity.roleKey === "superadmin";
            const isSuperUser = selectedEntity.kind === "user" && selectedUser?.isSuperadmin;
            const isLocked = isSuperRole || isSuperUser || !canModifySelected;

            // Active state
            const roleAllowed = currentRolePerms.includes(def.key);
            const userAllowed = effectiveUserPerms.has(def.key);
            const isSwitchOn = isSuperRole || isSuperUser ? true : isRole ? roleAllowed : userAllowed;

            // Overrides
            const isCustomGrant = currentUserGrants.includes(def.key);
            const isCustomRestricted = currentUserRestrictions.includes(def.key);
            const isOverridden = isCustomGrant || isCustomRestricted;

            return (
              <div
                key={def.key}
                className={`discord-perm-row${isSwitchOn ? " enabled" : ""}`}
              >
                <div className="discord-perm-info">
                  <div className="discord-perm-title">{def.title}</div>
                  <p className="discord-perm-description">{def.description}</p>
                </div>

                <div className="discord-perm-actions">
                  {!isRole && !isLocked && isOverridden && (
                    <button
                      type="button"
                      className="discord-perm-reset-link"
                      onClick={() => onResetUserPermission(def.key)}
                      title="Reset to role default"
                    >
                      Reset
                    </button>
                  )}

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isSwitchOn}
                    aria-label={`Toggle ${def.title}`}
                    disabled={isLocked}
                    className={`discord-switch${isSwitchOn ? " active" : ""}`}
                    onClick={() => {
                      if (isRole) {
                        onToggleRolePermission(def.key);
                      } else {
                        onToggleUserPermission(def.key);
                      }
                    }}
                  >
                    <span className="discord-switch-knob" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
