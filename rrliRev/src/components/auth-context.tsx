"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

import {
  applyDesignPreferences,
  applyTheme,
  loadDesignPreferences,
  loadTheme,
} from "@/components/design-preferences";
import type { AuthenticatedActor } from "@/lib/auth/server-session";

const AuthActorContext = createContext<AuthenticatedActor | null>(null);

export function AuthActorProvider({
  actor,
  children,
}: {
  actor: AuthenticatedActor;
  children: ReactNode;
}) {
  useEffect(() => {
    if (typeof window === "undefined" || !actor?.id) return;
    const userPrefs = loadDesignPreferences(actor.id);
    applyDesignPreferences(userPrefs, actor.id);

    const userStored = window.localStorage.getItem(`routex.theme.${actor.id}`);
    if (userStored === "dark" || userStored === "light") {
      applyTheme(userStored, actor.id);
    } else {
      const activeTheme =
        (document.documentElement.dataset.theme as "light" | "dark") ||
        (window.localStorage.getItem("routex-theme") as "light" | "dark") ||
        "light";
      applyTheme(activeTheme, actor.id);
    }
  }, [actor?.id]);

  return (
    <AuthActorContext.Provider value={actor}>
      {children}
    </AuthActorContext.Provider>
  );
}

export function useOptionalAuthenticatedActor(): AuthenticatedActor | null {
  return useContext(AuthActorContext);
}

export function useAuthenticatedActor(): AuthenticatedActor {
  const actor = useContext(AuthActorContext);
  if (!actor) {
    throw new Error(
      "useAuthenticatedActor must be used inside an authenticated workspace layout.",
    );
  }
  return actor;
}

