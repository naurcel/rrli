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
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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

      {/* Radiating crack fissures & animated ambient glow filling the whole bottom of the expanded sidebar */}
      <div className="sidebar-radiating-rays" aria-hidden="true">
        <svg
          className="sidebar-cracks-svg"
          viewBox="0 0 240 220"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="sidebarCrackGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="var(--crack-stop-1, #f59e0b)" stopOpacity="0.88" />
              <stop offset="30%" stopColor="var(--crack-stop-2, #fbbf24)" stopOpacity="0.65" />
              <stop offset="70%" stopColor="var(--crack-stop-3, #d97706)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--crack-stop-4, #b45309)" stopOpacity="0" />
            </linearGradient>
            <filter id="sidebarCrackGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Base fissure line spanning entire width */}
          <path
            className="sidebar-crack-base"
            d="M 0 219 L 24 218 L 48 220 L 76 217 L 104 219 L 136 218 L 168 220 L 196 217 L 220 219 L 240 218"
            stroke="url(#sidebarCrackGrad)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#sidebarCrackGlow)"
          />
          {/* Fissure 1 (Left flank) */}
          <path
            className="sidebar-crack-line fissure-1"
            d="M 16 218 L 22 188 L 18 158 L 28 122 L 24 92 L 32 62 M 22 188 L 34 168 L 40 142"
            stroke="url(#sidebarCrackGrad)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Fissure 2 (Mid-left) */}
          <path
            className="sidebar-crack-line fissure-2"
            d="M 56 219 L 62 182 L 58 148 L 70 108 L 66 78 L 74 42 M 62 182 L 76 162 L 82 132"
            stroke="url(#sidebarCrackGrad)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Fissure 3 (Center-left) */}
          <path
            className="sidebar-crack-line fissure-3"
            d="M 98 218 L 94 178 L 102 142 L 96 102 L 106 68 L 102 32 M 94 178 L 84 152 L 82 122"
            stroke="url(#sidebarCrackGrad)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Fissure 4 (Center-right) */}
          <path
            className="sidebar-crack-line fissure-4"
            d="M 142 218 L 148 182 L 142 142 L 154 108 L 150 72 L 158 38 M 148 182 L 160 158 L 166 128"
            stroke="url(#sidebarCrackGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Fissure 5 (Mid-right) */}
          <path
            className="sidebar-crack-line fissure-5"
            d="M 186 219 L 180 182 L 190 148 L 184 112 L 194 78 L 190 48 M 180 182 L 172 158 L 170 132"
            stroke="url(#sidebarCrackGrad)"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Fissure 6 (Right flank) */}
          <path
            className="sidebar-crack-line fissure-6"
            d="M 224 218 L 218 188 L 226 152 L 220 118 L 228 82 L 224 58 M 218 188 L 208 162 L 206 138"
            stroke="url(#sidebarCrackGrad)"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="sidebar-rays-beam" />
        <div className="sidebar-rays-glow" />
      </div>
    </aside>
  );
}

