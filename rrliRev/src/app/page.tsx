import { redirect } from "next/navigation";

import { getAuthenticatedActor } from "@/lib/auth/server-session";

export default async function HomePage() {
  const actor = await getAuthenticatedActor();

  if (actor) {
    redirect("/dashboard");
  }

  redirect("/login");
}
