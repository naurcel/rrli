"use client";

import Link from "next/link";
import React, { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "subtle";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  href?: string;
  active?: boolean;
};

/**
 * RouteX Standard Button Component
 * Encapsulates variants, sizes, loading states, and Next.js link navigation
 * while guaranteeing consistent RouteX design tokens and preventing browser-default fallbacks.
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      icon,
      iconRight,
      loading = false,
      fullWidth = false,
      active = false,
      href,
      disabled,
      className = "",
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const classNames = [
      "routex-btn",
      `variant-${variant}`,
      `size-${size}`,
      fullWidth ? "full-width" : "",
      active ? "is-active" : "",
      loading ? "is-loading" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const content = (
      <>
        {loading ? (
          <span className="routex-btn-spinner" aria-hidden="true">
            ◌
          </span>
        ) : icon ? (
          <span className="routex-btn-icon left" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {children ? <span className="routex-btn-label">{children}</span> : null}
        {iconRight && !loading ? (
          <span className="routex-btn-icon right" aria-hidden="true">
            {iconRight}
          </span>
        ) : null}
      </>
    );

    if (href && !disabled) {
      return (
        <Link
          href={href}
          className={classNames}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          aria-disabled={disabled}
          {...(rest as any)}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        type={type}
        className={classNames}
        disabled={disabled || loading}
        {...rest}
      >
        {content}
      </button>
    );
  },
);

export type IconButtonProps = Omit<ButtonProps, "icon" | "iconRight" | "fullWidth"> & {
  "aria-label": string;
  tooltip?: string;
};

/**
 * RouteX Standard Icon Button Component
 * Compact, accessible button for icon-only actions (toggles, controls, dismissals).
 */
export const IconButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, IconButtonProps>(
  function IconButton(
    {
      variant = "ghost",
      size = "sm",
      className = "",
      tooltip,
      children,
      ...rest
    },
    ref,
  ) {
    const classNames = [
      "routex-btn",
      "icon-btn",
      `variant-${variant}`,
      `size-${size}`,
      tooltip ? "ui-tooltip" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={classNames}
        data-tooltip={tooltip}
        {...rest}
      >
        {children}
      </Button>
    );
  },
);
