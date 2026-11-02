export type SortDirection = "asc" | "desc";

export type SortState<Key extends string> = {
  key: Key | null;
  direction: SortDirection;
};

export function getNextSortState<Key extends string>(current: SortState<Key>, key: Key): SortState<Key> {
  if (current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return { key: null, direction: "desc" };
}
