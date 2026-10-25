import assert from "node:assert/strict";
import test from "node:test";

import {
  keyboardResizeTarget,
  resizeSidebar,
  restoreSidebarState,
  settleSidebarWidth,
} from "./sidebar-state-model.ts";

test("restores a valid expanded width", () => {
  assert.deepEqual(restoreSidebarState(286, false), { width: 286, collapsed: false });
});

test("normalizes collapsed and invalid saved states", () => {
  assert.deepEqual(restoreSidebarState(140, false), { width: 72, collapsed: true });
  assert.deepEqual(restoreSidebarState(999, false), { width: 248, collapsed: false });
  assert.deepEqual(restoreSidebarState(248, true), { width: 72, collapsed: true });
});

test("clamps pointer resizing and applies the collapse threshold", () => {
  assert.deepEqual(resizeSidebar(-20), { width: 56, collapsed: true });
  assert.deepEqual(resizeSidebar(179), { width: 179, collapsed: true });
  assert.deepEqual(resizeSidebar(180), { width: 180, collapsed: false });
  assert.deepEqual(resizeSidebar(800), { width: 360, collapsed: false });
});

test("settles a collapsed drag to the visual rail width", () => {
  assert.equal(settleSidebarWidth(130, true), 72);
  assert.equal(settleSidebarWidth(264, false), 264);
});

test("supports keyboard collapse, expansion, and boundaries", () => {
  assert.equal(keyboardResizeTarget("ArrowRight", 72, true), 180);
  assert.equal(keyboardResizeTarget("ArrowLeft", 248, false), 232);
  assert.equal(keyboardResizeTarget("Home", 248, false), 72);
  assert.equal(keyboardResizeTarget("End", 248, false), 360);
  assert.equal(keyboardResizeTarget("Enter", 248, false), null);
});
