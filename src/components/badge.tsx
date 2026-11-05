import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "neutral";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

/**
 * RouteX Standard Compact Badge
 * Follows the compact, minimal, lightly-tinted design benchmark (18px height, 4px modest corners, uppercase semibold).
 */
export function Badge({
  tone = "neutral",
  children,
  className = "",
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`routex-badge tone-${tone}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </span>
  );
}
