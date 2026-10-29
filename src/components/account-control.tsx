"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getAuthenticationMode } from "@/features/auth/auth-model";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function AccountControl() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const router = useRouter();
  const authenticationMode = getAuthenticationMode({
    isSupabaseConfigured: isSupabaseConfigured(),
    nodeEnvironment: process.env.NODE_ENV,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        !avatarButtonRef.current?.contains(target) &&
        !moreButtonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        returnFocusRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function toggleMenu(trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    setErrorMessage(null);
    setIsOpen((value) => !value);
  }

  async function handleSessionExit() {
    if (isSigningOut) {
      return;
    }

    if (authenticationMode !== "supabase") {
      setIsOpen(false);
      router.push("/login");
      return;
    }

    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });

      if (error) {
        setErrorMessage("Sign-out could not be completed. Please try again.");
        return;
      }

      setIsOpen(false);
      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage("Sign-out could not be completed. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <button
        ref={avatarButtonRef}
        className="avatar account-avatar-button"
        type="button"
        aria-label="Open account menu"
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={(event) => toggleMenu(event.currentTarget)}
      >
        <img src="/profiles/shinryu.png" alt="" />
      </button>
      <div className="account-identity">
        <strong>Shinryu</strong>
        <small>Operations</small>
      </div>
      <button
        ref={moreButtonRef}
        className="more-button"
        type="button"
        aria-label="Open account menu"
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={(event) => toggleMenu(event.currentTarget)}
      >
        •••
      </button>
      {isOpen ? (
        <div
          ref={menuRef}
          className="account-menu-popover"
          id={menuId}
          role="menu"
          aria-label="Account menu"
        >
          <div className="account-menu-heading" role="presentation">
            <strong>Shinryu</strong>
            <small>
              {authenticationMode === "supabase"
                ? "Authenticated session"
                : "Development preview"}
            </small>
          </div>
          <button
            type="button"
            role="menuitem"
            disabled={isSigningOut}
            onClick={handleSessionExit}
          >
            {isSigningOut
              ? "Signing out…"
              : authenticationMode === "supabase"
                ? "Sign out"
                : "Exit preview"}
          </button>
          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        </div>
      ) : null}
    </>
  );
}
