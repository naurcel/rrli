"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  TRUCK_PHOTO_EVENT,
  getTruckPhotoStorageKey,
  getTruckPhotoFromStorage,
  storageKey,
} from "./truck-photo-storage";
import { ImageViewerModal } from "@/components/image-viewer-modal";

export {
  TRUCK_PHOTO_EVENT,
  getTruckPhotoStorageKey,
  getTruckPhotoFromStorage,
  storageKey,
};

const PHOTO_EVENT = TRUCK_PHOTO_EVENT;

export async function resizeTruckPhoto(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read this photo."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Unable to open this photo."));
    element.src = source;
  });
  const scale = Math.min(1, 1280 / image.naturalWidth, 960 / image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo processing is unavailable in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

const serverPhotoCache = new Map<string, string | null>();

export async function fetchTruckPhoto(plateNumber: string): Promise<string | null> {
  const normalized = plateNumber.trim().toUpperCase();
  if (!normalized) return null;
  if (serverPhotoCache.has(normalized)) {
    return serverPhotoCache.get(normalized) ?? null;
  }
  try {
    const response = await fetch(`/api/trucks/photo?plate=${encodeURIComponent(normalized)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      photoUrl?: string | null;
    } | null;
    const url = payload?.ok ? (payload.photoUrl ?? null) : null;
    serverPhotoCache.set(normalized, url);
    return url;
  } catch {
    return null;
  }
}

export async function saveTruckPhotoFile(plateNumber: string, file: File): Promise<void> {
  const normalized = plateNumber.trim().toUpperCase();
  const photo = await resizeTruckPhoto(file);
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(storageKey(normalized), photo);
  }
  serverPhotoCache.set(normalized, photo);

  const response = await fetch("/api/trucks/photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plateNumber: normalized,
      photoDataUrl: photo,
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    message?: string;
    photoUrl?: string | null;
  } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message ?? "Unable to upload truck photo.");
  }
  if (payload.photoUrl) {
    serverPhotoCache.set(normalized, payload.photoUrl);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PHOTO_EVENT));
  }
}

export async function deleteTruckPhoto(plateNumber: string): Promise<void> {
  const normalized = plateNumber.trim().toUpperCase();
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(storageKey(normalized));
  }
  serverPhotoCache.set(normalized, null);
  try {
    await fetch(`/api/trucks/photo?plate=${encodeURIComponent(normalized)}`, {
      method: "DELETE",
    });
  } catch {
    // Ignore network error on cleanup
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PHOTO_EVENT));
  }
}

export function TruckPhoto({
  plateNumber,
  editable = false,
}: {
  plateNumber: string;
  editable?: boolean;
}) {
  const inputId = useId();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const normalizedPlate = plateNumber.trim().toUpperCase();

  useEffect(() => {
    let cancelled = false;
    const key = storageKey(plateNumber);
    const syncPhoto = () => {
      const cached = serverPhotoCache.get(normalizedPlate);
      if (cached !== undefined) {
        setPhoto(cached ?? window.localStorage.getItem(key));
      } else {
        setPhoto(window.localStorage.getItem(key));
      }
    };
    syncPhoto();
    void fetchTruckPhoto(normalizedPlate).then((remoteUrl) => {
      if (cancelled) return;
      if (remoteUrl) {
        setPhoto(remoteUrl);
      } else if (!window.localStorage.getItem(key)) {
        setPhoto(null);
      }
    });
    window.addEventListener(PHOTO_EVENT, syncPhoto);
    window.addEventListener("storage", syncPhoto);
    return () => {
      cancelled = true;
      window.removeEventListener(PHOTO_EVENT, syncPhoto);
      window.removeEventListener("storage", syncPhoto);
    };
  }, [normalizedPlate, plateNumber]);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    if (menuRef.current) menuRef.current.open = false;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage("Choose an image smaller than 10 MB.");
      return;
    }
    setProcessing(true);
    setMessage(null);
    try {
      await saveTruckPhotoFile(plateNumber, file);
      setPhoto(serverPhotoCache.get(normalizedPlate) ?? window.localStorage.getItem(storageKey(plateNumber)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save this photo.");
    } finally {
      setProcessing(false);
    }
  }

  function removePhoto() {
    if (menuRef.current) menuRef.current.open = false;
    setPhoto(null);
    setMessage(null);
    void deleteTruckPhoto(plateNumber);
  }

  return (
    <div
      className={`fleet-photo truck-photo${editable ? " is-editable" : ""}`}
      data-plate={normalizedPlate}
    >
      {photo ? (
        <img
          src={photo}
          alt={`Assigned truck ${plateNumber}`}
          className="truck-photo-img"
          onClick={() => setIsViewerOpen(true)}
          style={{ cursor: "pointer" }}
          title="View photo"
        />
      ) : (
        <div
          className="truck-photo-fallback"
          aria-label={`No photo on file for truck ${plateNumber}`}
        >
          <svg
            className="truck-fallback-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1" y="3" width="15" height="13" rx="1.5" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          <span className="truck-fallback-text">No picture on file</span>
          <span className="truck-fallback-plate">{plateNumber}</span>
        </div>
      )}
      {editable ? (
        <>
          <details className="truck-photo-options" ref={menuRef}>
            <summary aria-label="Truck photo options" title="Photo options">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </summary>
            <div className="truck-photo-options-menu">
              <label htmlFor={inputId} aria-disabled={processing}>
                {processing ? "Saving…" : photo ? "Change photo" : "Add photo"}
              </label>
              {photo ? (
                <button type="button" onClick={removePhoto}>
                  Remove photo
                </button>
              ) : null}
            </div>
          </details>
          <input
            className="truck-photo-input"
            id={inputId}
            type="file"
            accept="image/*"
            disabled={processing}
            onChange={handlePhoto}
          />
        </>
      ) : null}
      {editable && message ? (
        <p className="truck-photo-error" role="alert">
          {message}
        </p>
      ) : null}

      {photo ? (
        <ImageViewerModal
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          imageUrl={photo}
          title={`Truck Photo · ${plateNumber}`}
          subtitle="Official fleet vehicle photo on file"
          filename={`truck-${plateNumber.replace(/\s+/g, "-")}.jpg`}
        />
      ) : null}
    </div>
  );
}
