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
          {isDark ? "☀" : "◐"}
        </button>
      </div>
    </header>
  );
}

