export const sidebarWidths = {
  min: 56,
  max: 360,
  collapseThreshold: 180,
  collapsed: 72,
  default: 248,
} as const;

export type SidebarSnapshot = {
  width: number;
  collapsed: boolean;
};

export function clampSidebarWidth(width: number) {
  return Math.min(sidebarWidths.max, Math.max(sidebarWidths.min, width));
}

export function restoreSidebarState(savedWidth: number, savedCollapsed: boolean): SidebarSnapshot {
  const validWidth = savedWidth >= sidebarWidths.min && savedWidth <= sidebarWidths.max;
  const width = validWidth ? savedWidth : sidebarWidths.default;
  const collapsed = savedCollapsed || width < sidebarWidths.collapseThreshold;

  return {
    width: collapsed ? sidebarWidths.collapsed : width,
    collapsed,
  };
}

export function resizeSidebar(width: number): SidebarSnapshot {
  const clampedWidth = clampSidebarWidth(width);
  return {
    width: clampedWidth,
    collapsed: clampedWidth < sidebarWidths.collapseThreshold,
  };
}

export function settleSidebarWidth(width: number, collapsed: boolean) {
  return collapsed ? sidebarWidths.collapsed : clampSidebarWidth(width);
}

export function keyboardResizeTarget(key: string, width: number, collapsed: boolean) {
  if (key === "ArrowLeft") return collapsed ? sidebarWidths.collapsed : width - 16;
  if (key === "ArrowRight") return collapsed ? sidebarWidths.collapseThreshold : width + 16;
  if (key === "Home") return sidebarWidths.collapsed;
  if (key === "End") return sidebarWidths.max;
  return null;
}
