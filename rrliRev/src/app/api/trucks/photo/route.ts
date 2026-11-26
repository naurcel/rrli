import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const BUCKET_NAME = "delivery-documents";
const LOCAL_PHOTO_DIR = path.join(process.cwd(), "data", "truck-photos");
const memoryTruckPhotos = new Map<string, string>();

function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase();
}

function safePlateKey(plate: string): string {
  return normalizePlate(plate).replace(/[^A-Z0-9_-]/g, "_");
}

function storagePathForPlate(plate: string): string {
  return `truck-photos/${safePlateKey(plate)}.jpg`;
}

function localFilePathForPlate(plate: string): string {
  return path.join(LOCAL_PHOTO_DIR, `${safePlateKey(plate)}.txt`);
}

function readLocalTruckPhoto(plate: string): string | null {
  const key = normalizePlate(plate);
  const mem = memoryTruckPhotos.get(key);
  if (mem) return mem;
  try {
    const filePath = localFilePathForPlate(key);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8").trim();
      if (content) {
        memoryTruckPhotos.set(key, content);
        return content;
      }
    }
  } catch {
    // Ignore read-only or unavailable local fs
  }
  return null;
}

function writeLocalTruckPhoto(plate: string, dataUrl: string): void {
  const key = normalizePlate(plate);
  memoryTruckPhotos.set(key, dataUrl);
  try {
    fs.mkdirSync(LOCAL_PHOTO_DIR, { recursive: true });
    fs.writeFileSync(localFilePathForPlate(key), dataUrl, "utf8");
  } catch {
    // Ignore read-only filesystem (e.g. serverless)
  }
}

function deleteLocalTruckPhoto(plate: string): void {
  const key = normalizePlate(plate);
  memoryTruckPhotos.delete(key);
  try {
    const filePath = localFilePathForPlate(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore read-only filesystem
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

export async function GET(request: Request) {
  const auth = await verifyServerPermission("profitability:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const plate = (searchParams.get("plate") ?? "").trim();
  if (!plate) {
    return NextResponse.json(
      { ok: false, message: "Truck plate is required." },
      { status: 400 },
    );
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminSupabaseClient();
      const { data: signed, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePathForPlate(plate), 60 * 60);

      if (!error && signed?.signedUrl) {
        return NextResponse.json({
          ok: true,
          plateNumber: normalizePlate(plate),
          photoUrl: signed.signedUrl,
        });
      }
    } catch {
      // Fallback to local store if storage lookup fails
    }
  }

  const localPhoto = readLocalTruckPhoto(plate);
  return NextResponse.json({
    ok: true,
    plateNumber: normalizePlate(plate),
    photoUrl: localPhoto,
  });
}

export async function POST(request: Request) {
  const auth = await verifyServerPermission("profitability:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    plateNumber?: unknown;
    photoDataUrl?: unknown;
  } | null;

  const plate = typeof body?.plateNumber === "string" ? body.plateNumber.trim() : "";
  const photoDataUrl = typeof body?.photoDataUrl === "string" ? body.photoDataUrl.trim() : "";

  if (!plate) {
    return NextResponse.json(
      { ok: false, message: "Truck plate is required." },
      { status: 400 },
    );
  }
  if (!photoDataUrl.startsWith("data:image/")) {
    return NextResponse.json(
      { ok: false, message: "Valid image data URL is required." },
      { status: 400 },
    );
  }
  if (photoDataUrl.length > 3 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, message: "Truck photo is too large. Maximum size is 3 MB." },
      { status: 400 },
    );
  }

  const parsed = parseDataUrl(photoDataUrl);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, message: "Invalid base64 image format." },
      { status: 400 },
    );
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminSupabaseClient();
      const storagePath = storagePathForPlate(plate);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, parsed.buffer, {
          contentType: parsed.mimeType,
          upsert: true,
        });

      if (!uploadError) {
        const { data: signed } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(storagePath, 60 * 60);

        writeLocalTruckPhoto(plate, photoDataUrl);
        return NextResponse.json({
          ok: true,
          plateNumber: normalizePlate(plate),
          photoUrl: signed?.signedUrl ?? photoDataUrl,
        });
      }
    } catch {
      // Fallback to local store
    }
  }

  writeLocalTruckPhoto(plate, photoDataUrl);
  return NextResponse.json({
    ok: true,
    plateNumber: normalizePlate(plate),
    photoUrl: photoDataUrl,
  });
}

export async function DELETE(request: Request) {
  const auth = await verifyServerPermission("profitability:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const plate = (searchParams.get("plate") ?? "").trim();
  if (!plate) {
    return NextResponse.json(
      { ok: false, message: "Truck plate is required." },
      { status: 400 },
    );
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminSupabaseClient();
      await supabase.storage.from(BUCKET_NAME).remove([storagePathForPlate(plate)]);
    } catch {
      // Ignore storage deletion error
    }
  }

  deleteLocalTruckPhoto(plate);
  return NextResponse.json({
    ok: true,
    plateNumber: normalizePlate(plate),
  });
}
