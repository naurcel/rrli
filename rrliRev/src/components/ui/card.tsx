"use client";

import Link from "next/link";
import React, { type HTMLAttributes, type ReactNode } from "react";

export type CardVariant = "default" | "elevated" | "subtle" | "outlined";
export type CardPadding = "none" | "sm" | "md" | "lg";

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "div" | "article";
  variant?: CardVariant;
  padding?: CardPadding;
  children: ReactNode;
  className?: string;
};

/**
 * RouteX Standard Card Component
 * Enforces unified border-radius, background, subtle border, and elevation tokens.
 */
export function Card({
  as: Component = "section",
  variant = "default",
  padding = "none",
  children,
  className = "",
  ...rest
}: CardProps) {
  const classNames = [
    "records-card",
    "routex-card",
    `variant-${variant}`,
    padding !== "none" ? `pad-${padding}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classNames} {...rest}>
      {children}
    </Component>
  );
}

export type CardHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function CardHeader({
  title,
  subtitle,
  badge,
  actions,
  children,
  className = "",
  ...rest
}: CardHeaderProps) {
  return (
    <div className={`records-heading routex-card-header ${className}`} {...rest}>
      {children ? (
        children
      ) : (
        <>
          <div className="routex-card-header-main">
            <div className="routex-card-title-row">
              {typeof title === "string" ? <h2>{title}</h2> : title}
              {badge}
            </div>
            {subtitle ? (
              typeof subtitle === "string" ? (
                <p>{subtitle}</p>
              ) : (
                subtitle
              )
            ) : null}
          </div>
          {actions ? <div className="routex-card-actions">{actions}</div> : null}
        </>
      )}
    </div>
  );
}

export type CardContentProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  className?: string;
  padding?: CardPadding;
};

export function CardContent({
  children,
  className = "",
  padding = "none",
  ...rest
}: CardContentProps) {
  const classNames = [
    "routex-card-content",
    padding !== "none" ? `pad-${padding}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} {...rest}>
      {children}
    </div>
  );
}

export type CardFooterProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  className?: string;
};

export function CardFooter({ children, className = "", ...rest }: CardFooterProps) {
  return (
    <div className={`routex-card-footer ${className}`} {...rest}>
      {children}
    </div>
  );
}

export type StatCardProps = {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  metaTone?: "positive" | "warning" | "neutral";
  valueTone?: "default" | "warning" | "success";
  href?: string;
  className?: string;
  children?: ReactNode;
};

/**
 * RouteX Standard Stat KPI Card Component
 * Consistent typography, padding, hover affordance, and responsive layout.
 */
export function StatCard({
  label,
  value,
  meta,
  metaTone = "neutral",
  valueTone = "default",
  href,
  className = "",
  children,
}: StatCardProps) {
  const classNames = [
    "stat-card",
    "routex-stat-card",
    href ? "stat-card-link" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="stat-label">{label}</span>
      <strong className={valueTone !== "default" ? valueTone : undefined}>
        {value}
      </strong>
      {meta ? (
        <span
          className={`stat-meta${metaTone === "positive" ? " positive" : metaTone === "warning" ? " warning" : ""}`}
        >
          {meta}
        </span>
      ) : null}
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classNames}>
        {content}
      </Link>
    );
  }

  return <div className={classNames}>{content}</div>;
}
