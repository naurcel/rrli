"use client";

import type { SortState } from "./table-sorting";

export { getNextSortState, type SortDirection, type SortState } from "./table-sorting";

type SortableTableHeaderProps<Key extends string> = {
  column: Key;
  label: string;
  onSort: (column: Key) => void;
  sort: SortState<Key>;
};

export function SortableTableHeader<Key extends string>({ column, label, onSort, sort }: SortableTableHeaderProps<Key>) {
  const isActive = sort.key === column;
  const direction = isActive ? sort.direction : null;
  const nextAction = !isActive ? "sort ascending" : direction === "asc" ? "sort descending" : "restore default order";
  const indicator = direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕";

  return (
    <th aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
      <button className={`sortable-table-header${direction ? ` ${direction}` : ""}`} type="button" onClick={() => onSort(column)} aria-label={`${label}: ${nextAction}`}>
        <span>{label}</span><b aria-hidden="true">{indicator}</b>
      </button>
    </th>
  );
}
