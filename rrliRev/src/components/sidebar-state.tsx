"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  getInitialSidebarState,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  toggleSidebarCollapsedState,
} from "./sidebar-state-model";

const SIDEBAR_STORAGE_KEY = "routex.sidebar.collapsed";

type SidebarContextValue = {
  width: number;
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(getInitialSidebarState);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === "1") {
        setState({ width: SIDEBAR_COLLAPSED_WIDTH, collapsed: true });
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--operational-sidebar-width",
      `${state.width}px`,
    );
  }, [state.width]);

  function toggleCollapsed() {
    setState((current) => {
      const next = toggleSidebarCollapsedState(current);
      try {
        window.localStorage.setItem(
          SIDEBAR_STORAGE_KEY,
          next.collapsed ? "1" : "0",
        );
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  return (
    <SidebarContext.Provider
      value={{
        width: state.collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_DEFAULT_WIDTH,
        collapsed: state.collapsed,
        toggleCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarState(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarState must be used within SidebarStateProvider.");
  }
  return context;
}

