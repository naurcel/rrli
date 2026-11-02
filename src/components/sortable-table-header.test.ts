import assert from "node:assert/strict";
import test from "node:test";

import { getNextSortState } from "./table-sorting.ts";

test("cycles a table column from ascending to descending to default order", () => {
  const initial = { key: null, direction: "desc" } as const;
  const ascending = getNextSortState(initial, "date");
  const descending = getNextSortState(ascending, "date");
  const restored = getNextSortState(descending, "date");

  assert.deepEqual(ascending, { key: "date", direction: "asc" });
  assert.deepEqual(descending, { key: "date", direction: "desc" });
  assert.deepEqual(restored, { key: null, direction: "desc" });
});

test("starts a new column in ascending order", () => {
  assert.deepEqual(getNextSortState({ key: "date", direction: "desc" }, "amount"), { key: "amount", direction: "asc" });
});
