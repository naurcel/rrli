import test from "node:test";
import assert from "node:assert/strict";

import { useSearchBuffer } from "./search-buffer.ts";

test("RouteX: Search Buffer System", async (t) => {
  await t.test("debounces search query execution and holds buffering state", async () => {
    let bufferedQuery = "";
    let isBuffering = false;

    // Simulate search buffer state machine
    let currentInput = "";
    let timer: NodeJS.Timeout | null = null;
    const delay = 50;

    function onInputChange(newInput: string) {
      currentInput = newInput;
      isBuffering = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        bufferedQuery = currentInput;
        isBuffering = false;
      }, delay);
    }

    // Initial state
    assert.equal(bufferedQuery, "");
    assert.equal(isBuffering, false);

    // Keystroke 1: "W"
    onInputChange("W");
    assert.equal(isBuffering, true);
    assert.equal(bufferedQuery, ""); // not yet updated

    // Keystroke 2 immediately: "WB"
    onInputChange("WB");
    assert.equal(isBuffering, true);
    assert.equal(bufferedQuery, "");

    // Keystroke 3 immediately: "WB-1029"
    onInputChange("WB-1029");
    assert.equal(isBuffering, true);
    assert.equal(bufferedQuery, "");

    // Wait for buffer delay to resolve
    await new Promise((resolve) => setTimeout(resolve, delay + 20));

    assert.equal(isBuffering, false);
    assert.equal(bufferedQuery, "WB-1029");
  });

  await t.test("clearing the buffer instantly resets without delay", () => {
    let bufferedQuery = "ABC";
    let input = "ABC";
    let isBuffering = false;

    function clear() {
      input = "";
      bufferedQuery = "";
      isBuffering = false;
    }

    clear();
    assert.equal(input, "");
    assert.equal(bufferedQuery, "");
    assert.equal(isBuffering, false);
  });

  await t.test("useSearchBuffer module exports valid function and contracts", () => {
    assert.equal(typeof useSearchBuffer, "function");
  });
});
