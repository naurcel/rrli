"use client";

import React, { createContext, useContext, type ReactNode } from "react";

type TabsContextValue = {
  value?: string;
  onValueChange?: (value: string) => void;
  variant: "pills" | "line";
  size: "sm" | "md";
};

const TabsContext = createContext<TabsContextValue | null>(null);

export type TabsProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: "pills" | "line";
  size?: "sm" | "md";
  children: ReactNode;
  className?: string;
};

export function Tabs({
  value,
  onValueChange,
  variant = "pills",
  size = "md",
  children,
  className = "",
}: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange, variant, size }}>
      <div className={`routex-tabs ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export type TabListProps = {
  "aria-label": string;
  children: ReactNode;
  className?: string;
  role?: "tablist" | "group";
};

export function TabList({
  "aria-label": ariaLabel,
  children,
  className = "",
  role = "tablist",
}: TabListProps) {
  const ctx = useContext(TabsContext);
  const variant = ctx?.variant ?? "pills";

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={`metric-tabs routex-tab-list tab-variant-${variant} ${className}`}
    >
      {children}
    </div>
  );
}

export type TabTriggerProps = {
  value: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  badge?: ReactNode;
};

export function TabTrigger({
  value,
  active: explicitActive,
  onClick,
  disabled = false,
  children,
  className = "",
  badge,
}: TabTriggerProps) {
  const ctx = useContext(TabsContext);
  const isActive =
    explicitActive !== undefined
      ? explicitActive
      : ctx?.value !== undefined
        ? ctx.value === value
        : false;

  const handleClick = () => {
    if (disabled) return;
    if (onClick) onClick();
    if (ctx?.onValueChange) ctx.onValueChange(value);
  };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      className={`routex-tab-trigger${isActive ? " active" : ""}${className ? ` ${className}` : ""}`}
      onClick={handleClick}
    >
      <span>{children}</span>
      {badge ? <span className="tab-trigger-badge">{badge}</span> : null}
    </button>
  );
}

export type TabContentProps = {
  value: string;
  children: ReactNode;
  className?: string;
};

export function TabContent({ value, children, className = "" }: TabContentProps) {
  const ctx = useContext(TabsContext);
  if (ctx && ctx.value !== undefined && ctx.value !== value) {
    return null;
  }

  return (
    <div role="tabpanel" className={`routex-tab-content ${className}`}>
      {children}
    </div>
  );
}
