"use client";

import React, {
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  type ReactNode,
} from "react";

export type TableProps = HTMLAttributes<HTMLTableElement> & {
  wrapperClassName?: string;
};

export function Table({ children, className = "", wrapperClassName = "", ...rest }: TableProps) {
  return (
    <div className={`table-wrap routex-table-wrap ${wrapperClassName}`}>
      <table className={`routex-table ${className}`} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = "", ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`routex-table-header ${className}`} {...rest}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = "", ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`routex-table-body ${className}`} {...rest}>
      {children}
    </tbody>
  );
}

export type TableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  interactive?: boolean;
};

export function TableRow({ children, className = "", interactive = false, ...rest }: TableRowProps) {
  return (
    <tr
      className={`record-row routex-table-row ${interactive ? "is-interactive" : ""} ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className = "", ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`routex-table-head ${className}`} {...rest}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = "", ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`routex-table-cell ${className}`} {...rest}>
      {children}
    </td>
  );
}

export type TableEmptyStateProps = {
  colSpan: number;
  title?: string;
  description?: string;
  children?: ReactNode;
};

export function TableEmptyState({
  colSpan,
  title = "No records found",
  description = "No data available in this range.",
  children,
}: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="table-empty-cell">
        <div className="empty-state minimal">
          <strong className="empty-state-title">{title}</strong>
          <span className="empty-state-desc">{description}</span>
          {children}
        </div>
      </td>
    </tr>
  );
}
