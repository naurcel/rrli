"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    return actor.avatarUrl ?? getDefaultAvatarUrl(actor.username);
  });

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

  // Close dropdown on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Close on route navigation
  useEffect(() => {
    setIsOpen(false);
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
        title={`@${actor.username} (${actor.roleLabel})`}
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
          className="topbar-profile-dropdown"
          role="menu"
          aria-label="Profile options"
        >
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

          {/* Settings link item */}
          <Link
            href="/settings"
            role="menuitem"
            className="profile-dropdown-link"
            onClick={() => setIsOpen(false)}
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
        </div>
      ) : null}
    </div>
  );
}

export { AccountControl as TopbarProfileArea, AccountControl as SidebarProfileArea };
