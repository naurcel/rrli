import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "neutral";

export type BadgeVariant = "subtle" | "outline" | "solid" | "counter";
export type BadgeSize = "xs" | "sm" | "md";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  showDot?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * RouteX Standard Compact Badge Component
 * Follows the compact, minimal, lightly-tinted design benchmark (18px-22px height, 4px-5px modest corners, uppercase semibold).
 */
export function Badge({
  tone = "neutral",
  variant = "subtle",
  size = "sm",
  showDot = false,
  icon,
  children,
  className = "",
  ...rest
}: BadgeProps) {
  const classNames = [
    "routex-badge",
    `tone-${tone}`,
    variant !== "subtle" ? `variant-${variant}` : "",
    size !== "sm" ? `size-${size}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classNames} {...rest}>
      {showDot ? (
        <span className={`routex-badge-dot dot-${tone}`} aria-hidden="true" />
      ) : null}
      {icon ? (
        <span className="routex-badge-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
