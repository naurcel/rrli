"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { Icon } from "@/components/route-x-ui";
import { useSidebarState } from "@/components/sidebar-state";
import {
  getAuthorizedNavigationForRole,
  type NavigationItem,
} from "@/lib/auth/rbac";

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OperationalSidebar() {
  const pathname = usePathname();
  const actor = useAuthenticatedActor();
  const { width, collapsed, toggleCollapsed } = useSidebarState();
  const [headerHovered, setHeaderHovered] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);
  const navigation = getAuthorizedNavigationForRole(actor.role);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSidebarReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function renderNavigationItem(item: NavigationItem) {
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

  return (
    <aside
      className={`sidebar${sidebarReady ? " sidebar-ready" : ""}${collapsed ? " collapsed" : ""}${collapsed && headerHovered ? " collapsed-hovered" : ""}`}
      style={{ "--sidebar-width": `${width}px` } as React.CSSProperties}
    >
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
        >
          <Icon>{collapsed ? "›" : "‹"}</Icon>
        </button>
      </div>

      <nav aria-label="Primary navigation">
        {navigation.primary.map(renderNavigationItem)}
      </nav>

      {navigation.management.length > 0 && (
        <div className="sidebar-divider" role="separator" aria-orientation="horizontal" />
      )}
      {navigation.management.length > 0 && (
        <nav className="management-navigation" aria-label="Management navigation">
          {navigation.management.map(renderNavigationItem)}
        </nav>
      )}

      {/* Radiating rays animated gradient in the bottom of the expanded sidebar */}
      <div className="sidebar-radiating-rays" aria-hidden="true">
        <div className="sidebar-rays-beam" />
        <div className="sidebar-rays-glow" />
      </div>
    </aside>
  );
}

