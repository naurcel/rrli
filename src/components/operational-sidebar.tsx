"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AccountControl } from "@/components/account-control";
import { Icon } from "@/components/route-x-ui";
import { useSidebarState } from "@/components/sidebar-state";

const primaryNavigation = [
  { label: "Dashboard", href: "/dashboard", symbol: "\u2302" },
  { label: "Deliveries", href: "/deliveries", symbol: "\u25a4" },
  { label: "Fleet", href: "/fleet", symbol: "\u25b1" },
  { label: "Transactions", href: "/transactions", symbol: "\u20b1" },
  { label: "Reports", href: "/reports", symbol: "\u25a5" },
] as const;

const managementNavigation = [
  { label: "Administration", href: "/administration", symbol: "\u25ce" },
  { label: "Human resources", href: "/hr", symbol: "\u25c9" },
  { label: "Settings", href: "/settings", symbol: "\u2699" },
] as const;

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/administration") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OperationalSidebar() {
  const pathname = usePathname();
  const { width, collapsed, toggleCollapsed } = useSidebarState();
  const [headerHovered, setHeaderHovered] = useState(false);

  function renderNavigationItem(item: { readonly label: string; readonly href: string; readonly symbol: string }) {
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
        <span className="nav-tooltip" role="tooltip" aria-hidden="true">
          {item.label}
        </span>
      </Link>
    );
  }

  return <aside className={`sidebar${collapsed ? " collapsed" : ""}${collapsed && headerHovered ? " collapsed-hovered" : ""}`} style={{ "--sidebar-width": `${width}px` } as React.CSSProperties}>
    <div
      className="sidebar-header"
      onMouseEnter={() => setHeaderHovered(true)}
      onMouseLeave={() => setHeaderHovered(false)}
      onFocus={() => setHeaderHovered(true)}
      onBlur={() => setHeaderHovered(false)}
    >
      <div className="sidebar-brand-space" aria-hidden="true" />
      <button
        className="sidebar-collapse-toggle"
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
        tabIndex={collapsed && !headerHovered ? -1 : 0}
      ><Icon>{collapsed ? "›" : "‹"}</Icon></button>
    </div>
    <nav aria-label="Primary navigation">{primaryNavigation.map(renderNavigationItem)}</nav>
    <nav className="management-navigation" aria-label="Management navigation">{managementNavigation.map(renderNavigationItem)}</nav>
    <div className="sidebar-footer"><AccountControl /></div>
  </aside>;
}
