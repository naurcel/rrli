import { NextResponse } from "next/server";

import {
  getPreviewSessionCookieOptions,
  getPreviewSessionValue,
  hasValidPreviewCredentials,
  PREVIEW_SESSION_COOKIE,
} from "@/lib/auth/preview-session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;

  if (!body || !hasValidPreviewCredentials(body.username, body.password)) {
    return NextResponse.json({ error: "Invalid preview credentials." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    PREVIEW_SESSION_COOKIE,
    getPreviewSessionValue(),
    getPreviewSessionCookieOptions(),
  );
  return response;
}

export function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PREVIEW_SESSION_COOKIE, "", {
    ...getPreviewSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
