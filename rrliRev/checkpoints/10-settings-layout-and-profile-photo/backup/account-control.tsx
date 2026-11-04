"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";

export function AccountControl() {
  const actor = useAuthenticatedActor();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

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

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        setErrorMessage("Sign-out could not be completed. Please try again.");
        return;
      }

      setIsOpen(false);
      window.location.replace("/login");
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
        <strong>{actor.fullName}</strong>
        <small>
          {actor.roleLabel} · {actor.accessLevelLabel}
        </small>
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
            <strong>{actor.fullName}</strong>
            <small>{actor.email}</small>
            <small>
              Role: {actor.roleLabel} ({actor.accessLevelLabel})
            </small>
          </div>
          <button
            type="button"
            role="menuitem"
            disabled={isSigningOut}
            onClick={handleSignOut}
          >
            {isSigningOut ? "Signing out…" : "Log out"}
          </button>
          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        </div>
      ) : null}
    </>
  );
}

