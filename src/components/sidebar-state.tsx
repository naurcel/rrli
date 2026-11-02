"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const COLLAPSED_STORAGE_KEY = "routex-sidebar-collapsed";
const EXPANDED_WIDTH = 248;
const COLLAPSED_WIDTH = 84;

type SidebarState = {
  width: number;
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarState | null>(null);

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--operational-sidebar-width", `${collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}px`);
  }, [collapsed]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  };

  const value = useMemo(() => ({ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH, collapsed, toggleCollapsed }), [collapsed]);
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebarState() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebarState must be used within SidebarStateProvider");
  return context;
}
