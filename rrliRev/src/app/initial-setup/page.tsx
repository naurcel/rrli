import { redirect } from "next/navigation";
import { requireAuthenticatedActor } from "@/lib/auth/server-session";
import { InitialSetupSoloWizard } from "./initial-setup-solo-wizard";

export const metadata = {
  title: "Welcome — Initial Setup",
  description: "Complete your one-time permanent password and account recovery setup.",
};

export default async function InitialSetupPage() {
  const actor = await requireAuthenticatedActor();

  // If already set up, bypass directly to dashboard
  if (!actor.mustChangePassword && actor.hasSecurityQuestion) {
    redirect("/dashboard");
  }

  return (
    <main className="solo-setup-viewport">
      <InitialSetupSoloWizard
        actor={{
          id: actor.id,
          username: actor.username,
          fullName: actor.fullName,
          role: actor.role,
        }}
      />
    </main>
  );
}
