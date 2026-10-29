"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountControl } from "@/components/account-control";
import { Icon } from "@/components/route-x-ui";
import { useSidebarState } from "@/components/sidebar-state";

const primaryNavigation = [
  { label: "Overview", href: "/dashboard", symbol: "⌂" },
  { label: "Deliveries", href: "/deliveries", symbol: "▤" },
  { label: "Fleet", href: "/fleet", symbol: "▱" },
  { label: "Transactions", href: "/transactions", symbol: "₱" },
  { label: "Reports", href: "/reports", symbol: "▥" },
] as const;

const managementNavigation = [
  { label: "Administration", href: "/administration", symbol: "◎" },
  { label: "Settings", href: "/settings", symbol: "⚙" },
] as const;

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OperationalSidebar() {
  const pathname = usePathname();
  const {
    width,
    collapsed,
    resizing,
    startResize,
    handleResizeKeyDown,
  } = useSidebarState();

  function renderNavigationItem(item: {
    readonly label: string;
    readonly href: string;
    readonly symbol: string;
  }) {
    const active = isActiveRoute(pathname, item.href);

    return (
      <Link
        className={active ? "nav-item active" : "nav-item"}
        href={item.href}
        aria-current={active ? "page" : undefined}
        key={item.href}
      >
        <Icon>{item.symbol}</Icon>
        <span className="nav-label">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside
      className={`sidebar${collapsed ? " collapsed" : ""}${resizing ? " resizing" : ""}`}
      style={{ "--sidebar-width": `${collapsed ? 72 : width}px` } as React.CSSProperties}
    >
      <div className="sidebar-brand-space" aria-hidden="true" />
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Primary navigation">
        {primaryNavigation.map(renderNavigationItem)}
      </nav>
      <div className="workspace-label lower">MANAGE</div>
      <nav aria-label="Management navigation">
        {managementNavigation.map(renderNavigationItem)}
      </nav>
      <div className="sidebar-footer">
        <AccountControl />
      </div>
      <div
        className="sidebar-resize-handle"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={72}
        aria-valuemax={360}
        aria-valuenow={collapsed ? 72 : width}
        tabIndex={0}
        onKeyDown={handleResizeKeyDown}
        onPointerDown={startResize}
      />
    </aside>
  );
}
