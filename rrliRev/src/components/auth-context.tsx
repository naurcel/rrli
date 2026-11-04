"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AuthenticatedActor } from "@/lib/auth/server-session";

const AuthActorContext = createContext<AuthenticatedActor | null>(null);

export function AuthActorProvider({
  actor,
  children,
}: {
  actor: AuthenticatedActor;
  children: ReactNode;
}) {
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

