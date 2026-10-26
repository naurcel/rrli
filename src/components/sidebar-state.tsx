"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  keyboardResizeTarget,
  resizeSidebar,
  restoreSidebarState,
  settleSidebarWidth,
  sidebarWidths,
} from "@/components/sidebar-state-model";

const WIDTH_STORAGE_KEY = "routex-sidebar-width";
const COLLAPSED_STORAGE_KEY = "routex-sidebar-collapsed";

type SidebarState = {
  width: number;
  collapsed: boolean;
  resizing: boolean;
  startResize: (event: PointerEvent<HTMLDivElement>) => void;
  handleResizeKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

const SidebarContext = createContext<SidebarState | null>(null);

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState<number>(sidebarWidths.default);
  const [collapsed, setCollapsed] = useState(false);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef<number>(sidebarWidths.default);
  const collapsedRef = useRef(false);
  const dragWidthRef = useRef<number>(sidebarWidths.default);

  useEffect(() => {
    const savedWidth = Number(window.localStorage.getItem(WIDTH_STORAGE_KEY));
    const restored = restoreSidebarState(savedWidth, window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");

    widthRef.current = restored.width;
    collapsedRef.current = restored.collapsed;
    dragWidthRef.current = restored.width;
    setWidth(restored.width);
    setCollapsed(restored.collapsed);
  }, []);

  const updateWidth = useCallback((nextWidth: number) => {
    const resized = resizeSidebar(nextWidth);

    widthRef.current = resized.width;
    collapsedRef.current = resized.collapsed;
    dragWidthRef.current = resized.width;
    setWidth(resized.width);
    setCollapsed(resized.collapsed);
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(resized.width));
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(resized.collapsed));
  }, []);

  useEffect(() => {
    if (!resizing) return;

    let frame = 0;
    let pendingWidth = dragWidthRef.current;

    const previewWidth = (nextWidth: number) => {
      const resized = resizeSidebar(nextWidth);
      dragWidthRef.current = resized.width;
      document.documentElement.style.setProperty("--sidebar-drag-width", `${resized.width}px`);

      if (resized.collapsed !== collapsedRef.current) {
        collapsedRef.current = resized.collapsed;
        setCollapsed(resized.collapsed);
      }
    };

    const move = (event: globalThis.PointerEvent) => {
      pendingWidth = event.clientX;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        previewWidth(pendingWidth);
      });
    };
    const stop = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        previewWidth(pendingWidth);
      }

      const resized = resizeSidebar(dragWidthRef.current);
      const settledWidth = settleSidebarWidth(resized.width, resized.collapsed);
      widthRef.current = settledWidth;
      collapsedRef.current = resized.collapsed;
      dragWidthRef.current = settledWidth;
      setResizing(false);
      setWidth(settledWidth);
      setCollapsed(resized.collapsed);
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(settledWidth));
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(resized.collapsed));
      document.documentElement.style.removeProperty("--sidebar-drag-width");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.documentElement.style.removeProperty("--sidebar-drag-width");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [resizing]);

  const startResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const displayedWidth = collapsedRef.current ? sidebarWidths.collapsed : widthRef.current;
    dragWidthRef.current = displayedWidth;
    document.documentElement.style.setProperty("--sidebar-drag-width", `${displayedWidth}px`);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    setResizing(true);
  }, []);

  const handleResizeKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const nextWidth = keyboardResizeTarget(event.key, width, collapsed);
    if (nextWidth === null) return;

    event.preventDefault();
    updateWidth(nextWidth);
  }, [collapsed, updateWidth, width]);

  const value = useMemo(() => ({ width, collapsed, resizing, startResize, handleResizeKeyDown }), [collapsed, handleResizeKeyDown, resizing, startResize, width]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebarState() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebarState must be used within SidebarStateProvider");
  return context;
}

