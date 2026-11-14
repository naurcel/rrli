"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  applyDesignPreferences,
  DESIGN_PREFERENCES_EVENT,
  DesignPreferences,
  loadDesignPreferences,
  resetDesignPreferences,
} from "@/components/design-preferences";
import {
  getDefaultAvatarUrl,
  getProfileStorageKey,
  getUserInitials,
  PROFILE_PHOTO_EVENT,
} from "@/components/profile-photo";

export function AccountControl({ className = "" }: { className?: string; collapsed?: boolean }) {
  const actor = useAuthenticatedActor();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<"menu" | "preferences">("menu");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    return actor.avatarUrl ?? getDefaultAvatarUrl(actor.username);
  });
  const [preferences, setPreferences] = useState<DesignPreferences>(() =>
    loadDesignPreferences(actor.id)
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Initialize theme state from DOM / localStorage
  useEffect(() => {
    try {
      const current =
        document.documentElement.dataset.theme ??
        window.localStorage.getItem("routex-theme");
      setIsDark(current === "dark");
    } catch {
      // Ignore storage restrictions
    }

    function handleStorage(e: StorageEvent) {
      if (e.key === "routex-theme" && e.newValue) {
        setIsDark(e.newValue === "dark");
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Update avatar and listen for profile photo events
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(getProfileStorageKey(actor.id));
      if (stored) {
        setAvatarUrl(stored);
      } else if (actor.avatarUrl) {
        setAvatarUrl(actor.avatarUrl);
      } else {
        setAvatarUrl(getDefaultAvatarUrl(actor.username));
      }
    } catch {
      // Ignore storage restrictions
    }

    function handlePhotoEvent(e: Event) {
      const ce = e as CustomEvent<{ avatarUrl?: string | null; userId?: string }>;
      if (!ce.detail?.userId || ce.detail.userId === actor.id) {
        const next = ce.detail?.avatarUrl ?? getDefaultAvatarUrl(actor.username);
        setAvatarUrl(next);
      }
    }

    window.addEventListener(PROFILE_PHOTO_EVENT, handlePhotoEvent);
    return () => window.removeEventListener(PROFILE_PHOTO_EVENT, handlePhotoEvent);
  }, [actor.id, actor.avatarUrl, actor.username]);

  // Sync design preferences across windows and user changes
  useEffect(() => {
    setPreferences(loadDesignPreferences(actor.id));

    function handlePrefsChange(e: Event) {
      const ce = e as CustomEvent<DesignPreferences>;
      if (ce.detail) {
        setPreferences(ce.detail);
      }
    }

    function handleStorage(e: StorageEvent) {
      if (e.key && e.key.startsWith("routex.design-preferences")) {
        setPreferences(loadDesignPreferences(actor.id));
      }
    }

    window.addEventListener(DESIGN_PREFERENCES_EVENT, handlePrefsChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(DESIGN_PREFERENCES_EVENT, handlePrefsChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [actor.id]);

  // Close dropdown on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
        setActiveView("menu");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (activeView === "preferences") {
          setActiveView("menu");
        } else {
          setIsOpen(false);
          setActiveView("menu");
          triggerButtonRef.current?.focus();
        }
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, activeView]);

  // Close on route navigation
  useEffect(() => {
    setIsOpen(false);
    setActiveView("menu");
  }, [pathname]);

  function handleToggleTheme(e?: React.MouseEvent) {
    e?.stopPropagation();
    setIsDark((prev) => {
      const next = !prev;
      const nextTheme = next ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      try {
        window.localStorage.setItem("routex-theme", nextTheme);
      } catch {
        // Ignore storage restrictions
      }
      return next;
    });
  }

  function handleUpdatePreferences(partial: Partial<DesignPreferences>) {
    const next: DesignPreferences = {
      ...preferences,
      ...partial,
    };
    setPreferences(next);
    applyDesignPreferences(next, actor.id);
  }

  function handleResetPreferences(e?: React.MouseEvent) {
    e?.stopPropagation();
    const defaults = resetDesignPreferences(actor.id);
    setPreferences(defaults);
  }

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        setErrorMessage("Sign-out failed. Please try again.");
        return;
      }

      setIsOpen(false);
      setActiveView("menu");
      window.location.replace("/login");
    } catch {
      setErrorMessage("Sign-out failed. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className={`topbar-profile-section${className ? ` ${className}` : ""}`}
    >
      <button
        ref={triggerButtonRef}
        type="button"
        className="topbar-user-chip"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={`User menu for @${actor.username}`}
        title={!isOpen ? `${actor.fullName || actor.username} · ${actor.roleLabel}` : undefined}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="topbar-avatar">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={26}
              height={26}
              style={{
                width: "26px",
                height: "26px",
                maxWidth: "26px",
                maxHeight: "26px",
                objectFit: "cover",
                borderRadius: "50%",
                display: "block",
              }}
            />
          ) : (
            <span>
              {getUserInitials(actor.fullName, actor.username)}
            </span>
          )}
        </div>
        <span className="topbar-user-name">@{actor.username}</span>
        <span className="topbar-profile-chevron" aria-hidden="true">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {isOpen ? (
        <div
          id={menuId}
          className={`topbar-profile-dropdown${activeView === "preferences" ? " is-preferences-view" : ""}`}
          role="menu"
          aria-label={activeView === "preferences" ? "Design Preferences" : "Profile options"}
        >
          {activeView === "preferences" ? (
            <div className="profile-dropdown-prefs-panel">
              <div className="profile-prefs-header">
                <button
                  type="button"
                  className="profile-prefs-back-btn"
                  onClick={() => setActiveView("menu")}
                  aria-label="Back to profile menu"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>Back</span>
                </button>
                <span className="profile-prefs-title">Design Preferences</span>
                <button
                  type="button"
                  className="profile-prefs-reset-btn"
                  onClick={handleResetPreferences}
                  title="Reset all preferences to defaults"
                >
                  Reset
                </button>
              </div>

              <div className="profile-dropdown-divider" />

              {/* Font Size */}
              <div className="profile-prefs-section">
                <div className="profile-prefs-label-row">
                  <span className="profile-prefs-label">Font Size</span>
                  <span className="profile-prefs-current-val">
                    {preferences.fontSize === "small"
                      ? "Small"
                      : preferences.fontSize === "large"
                      ? "Large"
                      : "Default"}
                  </span>
                </div>
                <div
                  className="profile-segmented-control"
                  role="radiogroup"
                  aria-label="Font Size options"
                >
                  {(["small", "default", "large"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={preferences.fontSize === opt}
                      className={`profile-segmented-btn${preferences.fontSize === opt ? " active" : ""}`}
                      onClick={() => handleUpdatePreferences({ fontSize: opt })}
                    >
                      {opt === "small" ? "Small" : opt === "large" ? "Large" : "Default"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compactness */}
              <div className="profile-prefs-section">
                <div className="profile-prefs-label-row">
                  <span className="profile-prefs-label">Compactness</span>
                  <span className="profile-prefs-current-val">
                    {preferences.compactness === "compact" ? "Compact" : "Comfortable"}
                  </span>
                </div>
                <div
                  className="profile-segmented-control"
                  role="radiogroup"
                  aria-label="Compactness options"
                >
                  {(["comfortable", "compact"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={preferences.compactness === opt}
                      className={`profile-segmented-btn${preferences.compactness === opt ? " active" : ""}`}
                      onClick={() => handleUpdatePreferences({ compactness: opt })}
                    >
                      {opt === "comfortable" ? "Comfortable" : "Compact"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reduce Motion */}
              <div className="profile-prefs-section profile-prefs-toggle-section">
                <div className="profile-prefs-toggle-text">
                  <span className="profile-prefs-label">Reduce Motion</span>
                  <span className="profile-prefs-sublabel">Minimize non-essential animations</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.reduceMotion}
                  aria-label={
                    preferences.reduceMotion
                      ? "Disable reduced motion"
                      : "Enable reduced motion"
                  }
                  className={`profile-theme-switch${preferences.reduceMotion ? " active" : ""}`}
                  onClick={() =>
                    handleUpdatePreferences({ reduceMotion: !preferences.reduceMotion })
                  }
                >
                  <span className="profile-theme-knob" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-dropdown-user-header" role="presentation">
                <strong>{actor.fullName.replace(/\s*\([^)]*\)/g, "").trim() || actor.fullName}</strong>
                <small>
                  @{actor.username} · {actor.roleLabel}
                </small>
              </div>

              <div className="profile-dropdown-divider" />

              {/* Dark Mode toggle item */}
              <div
                className="profile-dropdown-row profile-dropdown-theme-row"
                role="menuitem"
                tabIndex={0}
                onClick={handleToggleTheme}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggleTheme();
                  }
                }}
              >
                <div className="profile-dropdown-item-left">
                  <span className="profile-dropdown-icon" aria-hidden="true">
                    {isDark ? (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                    ) : (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    )}
                  </span>
                  <span>Dark Mode</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isDark}
                  aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                  className={`profile-theme-switch${isDark ? " active" : ""}`}
                  onClick={handleToggleTheme}
                >
                  <span className="profile-theme-knob" />
                </button>
              </div>

              {/* Design Preferences trigger item */}
              <button
                type="button"
                role="menuitem"
                className="profile-dropdown-row profile-dropdown-prefs-trigger"
                onClick={() => setActiveView("preferences")}
              >
                <div className="profile-dropdown-item-left">
                  <span className="profile-dropdown-icon" aria-hidden="true">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="4" y1="21" x2="4" y2="14" />
                      <line x1="4" y1="10" x2="4" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12" y2="3" />
                      <line x1="20" y1="21" x2="20" y2="16" />
                      <line x1="20" y1="12" x2="20" y2="3" />
                      <line x1="1" y1="14" x2="7" y2="14" />
                      <line x1="9" y1="8" x2="15" y2="8" />
                      <line x1="17" y1="16" x2="23" y2="16" />
                    </svg>
                  </span>
                  <span>Design Preferences</span>
                </div>
                <span className="profile-dropdown-arrow" aria-hidden="true">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
              </button>

              {/* Settings link item */}
              <Link
                href="/settings"
                role="menuitem"
                className="profile-dropdown-link"
                onClick={() => {
                  setIsOpen(false);
                  setActiveView("menu");
                }}
              >
                <span className="profile-dropdown-icon" aria-hidden="true">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </span>
                <span>Settings</span>
              </Link>

              <div className="profile-dropdown-divider" />

              {/* Log Out button */}
              <button
                type="button"
                role="menuitem"
                className="profile-dropdown-logout"
                disabled={isSigningOut}
                onClick={handleSignOut}
              >
                <span className="profile-dropdown-icon" aria-hidden="true">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span>{isSigningOut ? "Signing out…" : "Log Out"}</span>
              </button>

              {errorMessage ? (
                <p className="profile-dropdown-error" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export { AccountControl as TopbarProfileArea, AccountControl as SidebarProfileArea };
