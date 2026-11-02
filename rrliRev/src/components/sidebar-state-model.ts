export const SIDEBAR_COLLAPSED_WIDTH = 76;
export const SIDEBAR_DEFAULT_WIDTH = 248;

export type SidebarStateSnapshot = {
  width: number;
  collapsed: boolean;
};

export function getInitialSidebarState(): SidebarStateSnapshot {
  return {
    width: SIDEBAR_DEFAULT_WIDTH,
    collapsed: false,
  };
}

export function toggleSidebarCollapsedState(
  current: SidebarStateSnapshot,
): SidebarStateSnapshot {
  const nextCollapsed = !current.collapsed;
  return {
    width: nextCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_DEFAULT_WIDTH,
    collapsed: nextCollapsed,
  };
}

