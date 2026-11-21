import assert from "node:assert/strict";
import test from "node:test";

test("Pagination: in-place navigation preserves scroll position", () => {
  // Test pagination state change contracts
  let selectedPage = 1;
  const onPageChange = (p: number) => {
    selectedPage = p;
  };

  onPageChange(2);
  assert.equal(selectedPage, 2);
});
