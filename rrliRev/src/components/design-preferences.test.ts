import test from "node:test";
import assert from "node:assert/strict";

import {
  applyDesignPreferences,
  DEFAULT_DESIGN_PREFERENCES,
  DESIGN_PREFERENCES_EVENT,
  DESIGN_PREFERENCES_STORAGE_PREFIX,
  getDefaultDesignPreferences,
  getDesignPreferencesStorageKey,
  loadDesignPreferences,
  resetDesignPreferences,
} from "./design-preferences.ts";

test("RouteX: Design Preferences System", async (t) => {
  // Mock localStorage and DOM environment for node test runner
  const storageMap = new Map<string, string>();
  const dataset: Record<string, string> = {};
  const eventListeners: { [type: string]: ((e: any) => void)[] } = {};

  const mockWindow = {
    matchMedia: (query: string) => ({
      matches: false,
      media: query,
    }),
    localStorage: {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, val: string) => {
        storageMap.set(key, val);
      },
      removeItem: (key: string) => {
        storageMap.delete(key);
      },
      clear: () => storageMap.clear(),
      get length() {
        return storageMap.size;
      },
      key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
    },
    dispatchEvent: (event: any) => {
      const listeners = eventListeners[event.type] || [];
      listeners.forEach((fn) => fn(event));
      return true;
    },
    addEventListener: (type: string, fn: (e: any) => void) => {
      if (!eventListeners[type]) eventListeners[type] = [];
      eventListeners[type].push(fn);
    },
    removeEventListener: (type: string, fn: (e: any) => void) => {
      if (!eventListeners[type]) return;
      eventListeners[type] = eventListeners[type].filter((cb) => cb !== fn);
    },
  };

  const mockDocument = {
    documentElement: {
      dataset,
    },
  };

  // Set globals
  (globalThis as any).window = mockWindow;
  (globalThis as any).document = mockDocument;
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };

  t.afterEach(() => {
    storageMap.clear();
    for (const k of Object.keys(dataset)) {
      delete dataset[k];
    }
    for (const k of Object.keys(eventListeners)) {
      delete eventListeners[k];
    }
  });

  await t.test("getDesignPreferencesStorageKey generates isolated user keys", () => {
    assert.equal(
      getDesignPreferencesStorageKey("usr_admin_1"),
      `${DESIGN_PREFERENCES_STORAGE_PREFIX}usr_admin_1`
    );
    assert.equal(
      getDesignPreferencesStorageKey(""),
      `${DESIGN_PREFERENCES_STORAGE_PREFIX}default`
    );
    assert.equal(
      getDesignPreferencesStorageKey(undefined),
      `${DESIGN_PREFERENCES_STORAGE_PREFIX}default`
    );
    assert.equal(
      getDesignPreferencesStorageKey("  usr_ops_2  "),
      `${DESIGN_PREFERENCES_STORAGE_PREFIX}usr_ops_2`
    );
  });

  await t.test("getDefaultDesignPreferences provides standard RouteX baseline", () => {
    const defaults = getDefaultDesignPreferences();
    assert.equal(defaults.fontSize, "default");
    assert.equal(defaults.compactness, "comfortable");
    assert.equal(defaults.reduceMotion, false);
  });

  await t.test("loadDesignPreferences returns defaults when storage is empty", () => {
    const prefs = loadDesignPreferences("usr_test");
    assert.deepEqual(prefs, DEFAULT_DESIGN_PREFERENCES);
  });

  await t.test("loadDesignPreferences validates and clamps invalid values", () => {
    storageMap.set(
      getDesignPreferencesStorageKey("usr_invalid"),
      JSON.stringify({
        fontSize: "super-giant", // invalid
        compactness: "ultra-dense", // invalid
        reduceMotion: "not-a-boolean", // invalid
      })
    );

    const prefs = loadDesignPreferences("usr_invalid");
    assert.equal(prefs.fontSize, "default");
    assert.equal(prefs.compactness, "comfortable");
    assert.equal(prefs.reduceMotion, false);
  });

  await t.test("applyDesignPreferences updates DOM dataset, saves to storage, and dispatches event", () => {
    let capturedEvent: any = null;
    mockWindow.addEventListener(DESIGN_PREFERENCES_EVENT, (e) => {
      capturedEvent = e;
    });

    applyDesignPreferences(
      {
        fontSize: "large",
        compactness: "compact",
        reduceMotion: true,
      },
      "usr_admin"
    );

    // Verify DOM dataset
    assert.equal(dataset.fontSize, "large");
    assert.equal(dataset.compactness, "compact");
    assert.equal(dataset.reduceMotion, "true");

    // Verify Storage
    const stored = JSON.parse(storageMap.get(getDesignPreferencesStorageKey("usr_admin"))!);
    assert.equal(stored.fontSize, "large");
    assert.equal(stored.compactness, "compact");
    assert.equal(stored.reduceMotion, true);

    // Verify fallback default key was also populated
    const defaultStored = JSON.parse(
      storageMap.get(getDesignPreferencesStorageKey(null))!
    );
    assert.equal(defaultStored.fontSize, "large");

    // Verify custom event
    assert.ok(capturedEvent);
    assert.equal(capturedEvent.type, DESIGN_PREFERENCES_EVENT);
    assert.equal(capturedEvent.detail.fontSize, "large");
  });

  await t.test("resetDesignPreferences restores defaults and clears overrides", () => {
    // First apply customized settings
    applyDesignPreferences(
      {
        fontSize: "small",
        compactness: "compact",
        reduceMotion: true,
      },
      "usr_reset"
    );

    assert.equal(dataset.fontSize, "small");

    // Then reset
    const result = resetDesignPreferences("usr_reset");

    assert.equal(result.fontSize, "default");
    assert.equal(result.compactness, "comfortable");
    assert.equal(result.reduceMotion, false);

    assert.equal(dataset.fontSize, "default");
    assert.equal(dataset.compactness, "comfortable");
    assert.equal(dataset.reduceMotion, "false");
  });
});
