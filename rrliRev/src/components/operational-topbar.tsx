"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useOptionalAuthenticatedActor } from "@/components/auth-context";
import { GlobalDateRangePicker } from "@/components/global-date-range-picker";
import {
  getDefaultAvatarUrl,
  getProfileStorageKey,
  getUserInitials,
  PROFILE_PHOTO_EVENT,
} from "@/components/profile-photo";

export function OperationalTopbar({
  contextLabel: _contextLabel,
  showDateFilter = true,
}: {
  contextLabel?: string;
  showDateFilter?: boolean;
}) {
  const actor = useOptionalAuthenticatedActor();
  const [isDark, setIsDark] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    return actor ? (actor.avatarUrl ?? getDefaultAvatarUrl(actor.username)) : null;
  });

  useEffect(() => {
    try {
      const current =
        document.documentElement.dataset.theme ??
        window.localStorage.getItem("routex-theme");
      setIsDark(current === "dark");
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  useEffect(() => {
    if (!actor) return;
    const currentUserId = actor.id;
    const currentUsername = actor.username;
    const currentAvatarUrl = actor.avatarUrl;

    try {
      const stored = window.localStorage.getItem(getProfileStorageKey(currentUserId));
      if (stored) {
        setAvatarUrl(stored);
      } else if (currentAvatarUrl) {
        setAvatarUrl(currentAvatarUrl);
      } else {
        setAvatarUrl(getDefaultAvatarUrl(currentUsername));
      }
    } catch {
      // Ignore storage restrictions
    }

    function handlePhotoEvent(e: Event) {
      const ce = e as CustomEvent<{ avatarUrl?: string | null; userId?: string }>;
      if (!ce.detail?.userId || ce.detail.userId === currentUserId) {
        const next = ce.detail?.avatarUrl ?? getDefaultAvatarUrl(currentUsername);
        setAvatarUrl(next);
      }
    }

    window.addEventListener(PROFILE_PHOTO_EVENT, handlePhotoEvent);
    return () => window.removeEventListener(PROFILE_PHOTO_EVENT, handlePhotoEvent);
  }, [actor?.id, actor?.avatarUrl, actor?.username]);

  function toggleTheme() {
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

  return (
    <header className="topbar">
      <div className="topbar-primary">
        {showDateFilter ? (
          <div className="topbar-filter-slot">
            <GlobalDateRangePicker />
          </div>
        ) : null}
      </div>
      <div className="topbar-actions">
        {actor ? (
          <Link
            href="/settings"
            className="topbar-user-chip"
            title={`Account Settings: @${actor.username} (${actor.roleLabel})`}
            aria-label={`Open settings for ${actor.fullName}`}
          >
            <div className="topbar-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                <span>{getUserInitials(actor.fullName, actor.username)}</span>
              )}
            </div>
            <span className="topbar-user-name">@{actor.username}</span>
          </Link>
        ) : null}
        <button
          className="theme-toggle"
          type="button"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
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
              aria-hidden="true"
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
              aria-hidden="true"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}

