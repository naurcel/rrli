/**
 * RouteX Design Preferences System
 * 
 * Provides centralized storage, DOM state reflection, and synchronization for
 * user interface customizations: Font Size (Small, Default, Large),
 * Compactness (Comfortable, Compact), and Reduce Motion.
 */

export type FontSizePreference = "small" | "default" | "large";
export type CompactnessPreference = "comfortable" | "compact";

export interface DesignPreferences {
  fontSize: FontSizePreference;
  compactness: CompactnessPreference;
  reduceMotion: boolean;
}

export const DESIGN_PREFERENCES_EVENT = "routex:design-preferences-changed";
export const DESIGN_PREFERENCES_STORAGE_PREFIX = "routex.design-preferences.";

export const DEFAULT_DESIGN_PREFERENCES: DesignPreferences = {
  fontSize: "default",
  compactness: "comfortable",
  reduceMotion: false,
};

/**
 * Returns the localStorage key for a specific user ID, with fallback to global default.
 */
export function getDesignPreferencesStorageKey(userId?: string | null): string {
  const normalizedId = userId?.trim();
  return `${DESIGN_PREFERENCES_STORAGE_PREFIX}${normalizedId || "default"}`;
}

/**
 * Checks system preferences for prefers-reduced-motion.
 */
export function getSystemPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Returns default preferences, taking into account OS motion preferences.
 */
export function getDefaultDesignPreferences(): DesignPreferences {
  return {
    fontSize: "default",
    compactness: "comfortable",
    reduceMotion: getSystemPrefersReducedMotion(),
  };
}

/**
 * Loads preferences from localStorage for the given user, falling back to defaults.
 */
export function loadDesignPreferences(userId?: string | null): DesignPreferences {
  const defaults = getDefaultDesignPreferences();
  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const key = getDesignPreferencesStorageKey(userId);
    let stored = window.localStorage.getItem(key);
    
    // If not found for specific user, check fallback default key
    if (!stored && userId) {
      stored = window.localStorage.getItem(getDesignPreferencesStorageKey(null));
    }

    if (!stored) {
      return defaults;
    }

    const parsed = JSON.parse(stored);
    const fontSize: FontSizePreference =
      parsed.fontSize === "small" || parsed.fontSize === "large" || parsed.fontSize === "default"
        ? parsed.fontSize
        : defaults.fontSize;

    const compactness: CompactnessPreference =
      parsed.compactness === "compact" || parsed.compactness === "comfortable"
        ? parsed.compactness
        : defaults.compactness;

    const reduceMotion =
      typeof parsed.reduceMotion === "boolean" ? parsed.reduceMotion : defaults.reduceMotion;

    return { fontSize, compactness, reduceMotion };
  } catch {
    return defaults;
  }
}

/**
 * Applies the design preferences immediately to the root documentElement
 * and persists them to localStorage.
 */
export function applyDesignPreferences(
  preferences: DesignPreferences,
  userId?: string | null
): void {
  if (typeof window === "undefined" || !document?.documentElement) {
    return;
  }

  // 1. Reflect onto documentElement data attributes for immediate CSS activation
  document.documentElement.dataset.fontSize = preferences.fontSize;
  document.documentElement.dataset.compactness = preferences.compactness;
  document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);

  // 2. Persist to localStorage
  try {
    const key = getDesignPreferencesStorageKey(userId);
    window.localStorage.setItem(key, JSON.stringify(preferences));

    // Also update default key if authenticated user so shared unauth pages have matching feel
    if (userId) {
      window.localStorage.setItem(
        getDesignPreferencesStorageKey(null),
        JSON.stringify(preferences)
      );
    }
  } catch {
    // Ignore localStorage quota / restriction errors
  }

  // 3. Dispatch custom event for active component listeners
  try {
    window.dispatchEvent(
      new CustomEvent<DesignPreferences>(DESIGN_PREFERENCES_EVENT, {
        detail: preferences,
      })
    );
  } catch {
    // Ignore custom event errors
  }
}

/**
 * Resets preferences to defaults and applies them immediately.
 */
export function resetDesignPreferences(userId?: string | null): DesignPreferences {
  const defaults = getDefaultDesignPreferences();
  applyDesignPreferences(defaults, userId);
  return defaults;
}
