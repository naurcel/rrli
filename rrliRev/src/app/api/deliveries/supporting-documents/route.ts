import { NextResponse } from "next/server";

import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/config/env";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

const BUCKET_NAME = "delivery-documents";

export async function GET(request: Request) {
  const auth = await verifyServerPermission("deliveries:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const storagePath = (searchParams.get("path") ?? "").trim();
  if (!storagePath || !storagePath.startsWith("supporting-docs/") || storagePath.includes("..")) {
    return NextResponse.json(
      { ok: false, message: "Valid supporting document path is required." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Supabase storage is not configured." },
      { status: 404 },
    );
  }

  try {
    const supabase = isSupabaseAdminConfigured()
      ? createAdminSupabaseClient()
      : await createServerSupabaseClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (error || !data) {
      return NextResponse.json(
        { ok: false, message: error?.message ?? "Document not found." },
        { status: 404 },
      );
    }

    const bytes = await data.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": data.type || "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "Unable to load document.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await verifyServerPermission("deliveries:edit");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { ok: false, message: "Multipart form data is required." },
      { status: 400 },
    );
  }

  const deliveryId = String(formData.get("deliveryId") || "").trim();
  const file = formData.get("file") as File | null;
  if (!deliveryId || !file || file.size <= 0) {
    return NextResponse.json(
      { ok: false, message: "Delivery ID and non-empty file are required." },
      { status: 400 },
    );
  }

  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, message: "File exceeds 15 MB maximum limit." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      storagePath: null,
      fileUrl: null,
    });
  }

  try {
    const supabase = isSupabaseAdminConfigured()
      ? createAdminSupabaseClient()
      : await createServerSupabaseClient();

    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeDeliveryId = deliveryId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const storagePath = `supporting-docs/${safeDeliveryId}/${Date.now()}_${cleanName}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, message: uploadError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      storagePath,
      fileUrl: `/api/deliveries/supporting-documents?path=${encodeURIComponent(storagePath)}`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "Unable to upload supporting document.",
      },
      { status: 500 },
    );
  }
}
