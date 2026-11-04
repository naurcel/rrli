"use client";

export type TableSortDirection = "asc" | "desc";

export function SortableTableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  defaultDirection = "asc",
  onSort,
}: {
  label: string;
  sortKey: string;
  activeSortKey: string;
  direction: TableSortDirection;
  defaultDirection?: TableSortDirection;
  onSort: (key: string, direction: TableSortDirection) => void;
}) {
  const active = sortKey === activeSortKey;
  const nextDirection = active
    ? direction === "asc" ? "desc" : "asc"
    : defaultDirection;

  return (
    <th aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        className={`sortable-table-header${active ? ` ${direction}` : ""}`}
        type="button"
        onClick={() => onSort(sortKey, nextDirection)}
      >
        {label}
        <b aria-hidden="true">{active ? direction === "asc" ? "↑" : "↓" : "↕"}</b>
      </button>
    </th>
  );
}
