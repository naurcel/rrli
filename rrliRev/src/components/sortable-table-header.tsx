"use client";

export type TableSortDirection = "asc" | "desc";

export function SortableTableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  defaultDirection = "asc",
  onSort,
  onReset,
  className = "",
}: {
  label: string;
  sortKey: string;
  activeSortKey: string;
  direction: TableSortDirection;
  defaultDirection?: TableSortDirection;
  onSort: (key: string, direction: TableSortDirection) => void;
  onReset?: () => void;
  className?: string;
}) {
  const active = sortKey === activeSortKey;

  function handleClick() {
    if (!active) {
      // First click: activate in defaultDirection (asc or desc)
      onSort(sortKey, defaultDirection);
      return;
    }

    if (direction === defaultDirection) {
      // Second click: toggle to opposite direction
      const opposite: TableSortDirection = defaultDirection === "asc" ? "desc" : "asc";
      onSort(sortKey, opposite);
      return;
    }

    // Third click: return to default visual state
    if (onReset) {
      onReset();
    } else {
      onSort(sortKey, defaultDirection);
    }
  }

  const sortAria = active
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  const sortTooltip = active
    ? direction === defaultDirection
      ? (direction === "asc" ? "Sort descending" : "Sort ascending")
      : "Reset sort"
    : `Sort by ${label}`;

  return (
    <th
      aria-sort={sortAria}
      className={className ? `th-${sortKey} ${className}` : `th-${sortKey}`}
    >
      <button
        className={`sortable-table-header${active ? ` ${direction} active-sort` : ""}`}
        type="button"
        onClick={handleClick}
        title={sortTooltip}
        aria-label={sortTooltip}
      >
        <span className="sort-label">{label}</span>
        <span aria-hidden="true" className="sort-arrow-icon">
          {active ? (
            direction === "asc" ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 15-6-6-6 6" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            )
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m7 15 5 5 5-5" opacity="0.45" />
              <path d="m7 9 5-5 5 5" opacity="0.45" />
            </svg>
          )}
        </span>
      </button>
    </th>
  );
}
