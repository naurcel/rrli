"use client";

export const PROFILE_PHOTO_EVENT = "routex:profile-photo-updated";

export function getProfileStorageKey(userId: string): string {
  return `routex.user-avatar.${userId}`;
}

export function getUserInitials(fullName?: string | null, username?: string | null): string {
  const name = (fullName || username || "").trim();
  if (!name) return "U";

  // Clean title/parentheses like "Shinryu (System Admin)" -> "Shinryu"
  const cleanName = name.replace(/\([^)]*\)/g, "").trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getDefaultAvatarUrl(username?: string | null): string | null {
  const norm = (username || "").trim().toLowerCase();
  if (norm === "admin" || norm === "shinryu") {
    return "/profiles/shinryu.png";
  }
  return null;
}

export async function validateAndReadProfilePhotoFile(file: File): Promise<string> {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    throw new Error("Invalid image format. Supported formats are JPG, PNG, and WebP.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image file is too large. Maximum allowed size is 5MB.");
  }

  // Use fast object URL decoding and pre-scale large 4K/phone photos to max 1024px
  // so the interactive cropper renders and drags with zero texture lag.
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Unable to open image file."));
      el.src = objectUrl;
    });

    const maxWorkingDim = 1024;
    const natW = image.naturalWidth || 320;
    const natH = image.naturalHeight || 320;
    const scale = Math.min(1, maxWorkingDim / Math.max(natW, natH));
    const targetW = Math.max(1, Math.round(natW * scale));
    const targetH = Math.max(1, Math.round(natH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Photo processing is unavailable in this browser.");
    }

    ctx.drawImage(image, 0, 0, targetW, targetH);
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Validates, resizes, and center-crops an uploaded photo to a standardized square avatar.
 * Returns a compact JPEG data URL suitable for immediate preview and server storage.
 */
export async function resizeProfilePhotoFile(file: File, targetSize = 320): Promise<string> {
  const source = await validateAndReadProfilePhotoFile(file);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Unable to open image file."));
    el.src = source;
  });

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Photo processing is unavailable in this browser.");
  }

  // Calculate centered square crop
  const minDim = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = (image.naturalWidth - minDim) / 2;
  const sy = (image.naturalHeight - minDim) / 2;

  ctx.drawImage(image, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
  return canvas.toDataURL("image/jpeg", 0.88);
}
