/**
 * RouteX Preferences System
 * 
 * Provides centralized storage, DOM state reflection, and synchronization for
 * user interface customizations: Font Size (Small, Default, Large),
 * Compactness (Comfortable, Compact), Reduce Motion, and Theme (Light, Dark).
 *
 * All settings are strictly scoped per-user to prevent preferences from leaking
 * across different user accounts on the same machine/browser.
 */

export type FontSizePreference = "small" | "default" | "large";
export type CompactnessPreference = "comfortable" | "compact";
export type ThemePreference = "light" | "dark";

export interface DesignPreferences {
  fontSize: FontSizePreference;
  compactness: CompactnessPreference;
  reduceMotion: boolean;
  theme?: ThemePreference;
}

export const DESIGN_PREFERENCES_EVENT = "routex:design-preferences-changed";
export const ROUTEX_THEME_CHANGED_EVENT = "routex:theme-changed";
export const DESIGN_PREFERENCES_STORAGE_PREFIX = "routex.design-preferences.";
export const THEME_STORAGE_PREFIX = "routex.theme.";

export const DEFAULT_DESIGN_PREFERENCES: DesignPreferences = {
  fontSize: "default",
  compactness: "comfortable",
  reduceMotion: false,
};

/**
 * Returns the localStorage key for a specific user ID, with fallback to default for unauthenticated views.
 */
export function getDesignPreferencesStorageKey(userId?: string | null): string {
  const normalizedId = userId?.trim();
  return `${DESIGN_PREFERENCES_STORAGE_PREFIX}${normalizedId || "default"}`;
}

/**
 * Returns the user-scoped localStorage key for theme.
 */
export function getThemeStorageKey(userId?: string | null): string {
  const normalizedId = userId?.trim();
  return normalizedId ? `${THEME_STORAGE_PREFIX}${normalizedId}` : "routex-theme";
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

function parsePreferences(raw: string, defaults: DesignPreferences): DesignPreferences {
  try {
    const parsed = JSON.parse(raw);
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

    const theme: ThemePreference | undefined =
      parsed.theme === "dark" || parsed.theme === "light" ? parsed.theme : undefined;

    return { fontSize, compactness, reduceMotion, ...(theme ? { theme } : {}) };
  } catch {
    return defaults;
  }
}

/**
 * Loads preferences from localStorage for the given user.
 * Strictly isolates user preferences: if the user hasn't configured preferences yet,
 * returns clean defaults rather than inheriting another user's saved state.
 */
export function loadDesignPreferences(userId?: string | null): DesignPreferences {
  const defaults = getDefaultDesignPreferences();
  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const normalizedId = userId?.trim();
    if (normalizedId) {
      const key = `${DESIGN_PREFERENCES_STORAGE_PREFIX}${normalizedId}`;
      const stored = window.localStorage.getItem(key);
      if (!stored) {
        return defaults;
      }
      return parsePreferences(stored, defaults);
    }

    // Unauthenticated fallback: only read default key if present
    const unauthStored = window.localStorage.getItem(`${DESIGN_PREFERENCES_STORAGE_PREFIX}default`);
    if (unauthStored) {
      return parsePreferences(unauthStored, defaults);
    }
    return defaults;
  } catch {
    return defaults;
  }
}

/**
 * Loads the user-scoped theme ("light" | "dark").
 * Defaults to "light" for new users and does NOT inherit another user's theme.
 */
export function loadTheme(userId?: string | null): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const normalizedId = userId?.trim();
    if (normalizedId) {
      const key = getThemeStorageKey(normalizedId);
      const stored = window.localStorage.getItem(key);
      if (stored === "dark" || stored === "light") {
        return stored;
      }
      return "light";
    }

    // Unauthenticated fallback
    const globalStored = window.localStorage.getItem("routex-theme");
    if (globalStored === "dark" || globalStored === "light") {
      return globalStored;
    }
    return "light";
  } catch {
    return "light";
  }
}

/**
 * Applies the user-scoped theme immediately to the documentElement
 * and persists strictly to the user's storage key.
 */
export function applyTheme(theme: "light" | "dark", userId?: string | null): void {
  if (typeof window === "undefined" || !document?.documentElement) {
    return;
  }

  document.documentElement.dataset.theme = theme;

  try {
    const key = getThemeStorageKey(userId);
    window.localStorage.setItem(key, theme);

    if (!userId) {
      window.localStorage.setItem("routex-theme", theme);
    }
  } catch {
    // Ignore storage errors
  }

  try {
    window.dispatchEvent(
      new CustomEvent<"light" | "dark">(ROUTEX_THEME_CHANGED_EVENT, {
        detail: theme,
      })
    );
  } catch {
    // Ignore custom event errors
  }
}

/**
 * Applies preferences immediately to the root documentElement
 * and persists them strictly to the given user's storage key.
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
  if (preferences.theme) {
    document.documentElement.dataset.theme = preferences.theme;
  }

  // 2. Persist strictly for THIS user (never overwrite global default key when userId is set)
  try {
    const key = getDesignPreferencesStorageKey(userId);
    window.localStorage.setItem(key, JSON.stringify(preferences));

    if (!userId) {
      window.localStorage.setItem(
        `${DESIGN_PREFERENCES_STORAGE_PREFIX}default`,
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
 * Resets preferences to defaults and applies them immediately for this user.
 */
export function resetDesignPreferences(userId?: string | null): DesignPreferences {
  const defaults = getDefaultDesignPreferences();
  applyDesignPreferences(defaults, userId);
  return defaults;
}
