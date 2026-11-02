import { NextResponse } from "next/server";

import { getAuthenticatedActor } from "@/lib/auth/server-session";

export async function GET() {
  const actor = await getAuthenticatedActor();

  if (!actor) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHENTICATED",
        message: "No active authenticated session.",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    actor,
  });
}

