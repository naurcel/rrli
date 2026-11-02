"use client";

import { ChangeEvent, PointerEvent, useEffect, useId, useRef, useState } from "react";

const PHOTO_WIDTH = 1200;
const PHOTO_HEIGHT = 760;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type TruckPhotoManagerProps = {
  truckId: string;
  truckType: string;
  ownership?: "Owned" | "Subcontracted";
};

function storageKey(truckId: string) {
  return `routex-preview-truck-photo:${truckId}`;
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be prepared for cropping."));
    image.src = source;
  });
}

export function TruckPhotoManager({ truckId, truckType, ownership = "Owned" }: TruckPhotoManagerProps) {
  const inputId = useId();
  const [photo, setPhoto] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0);
  const [vertical, setVertical] = useState(0);
  const [message, setMessage] = useState("Photos are saved only in this browser.");
  const [isSaving, setIsSaving] = useState(false);
  const dragStart = useRef<{ x: number; y: number; horizontal: number; vertical: number } | null>(null);

  useEffect(() => {
    try {
      setPhoto(window.localStorage.getItem(storageKey(truckId)));
    } catch {
      setMessage("Browser storage is unavailable, so this photo will last until you leave the page.");
    }
  }, [truckId]);

  const startEditing = (source: string) => {
    setDraft(source);
    setZoom(1);
    setHorizontal(0);
    setVertical(0);
    setMessage("Adjust the framing, then apply the crop when it looks right.");
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose an image file such as JPG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setMessage("Choose an image smaller than 10 MB.");
      return;
    }

    try {
      startEditing(await readFile(file));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The image could not be read.");
    }
  };

  const applyCrop = async () => {
    if (!draft) return;
    setIsSaving(true);

    try {
      const image = await loadImage(draft);
      const canvas = document.createElement("canvas");
      canvas.width = PHOTO_WIDTH;
      canvas.height = PHOTO_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser cannot prepare this crop.");

      const coverScale = Math.max(PHOTO_WIDTH / image.naturalWidth, PHOTO_HEIGHT / image.naturalHeight);
      const scaledWidth = image.naturalWidth * coverScale * zoom;
      const scaledHeight = image.naturalHeight * coverScale * zoom;
      const overflowX = Math.max(0, scaledWidth - PHOTO_WIDTH);
      const overflowY = Math.max(0, scaledHeight - PHOTO_HEIGHT);
      const drawX = -overflowX / 2 + horizontal * overflowX / 2;
      const drawY = -overflowY / 2 + vertical * overflowY / 2;

      context.fillStyle = "#e8f1f8";
      context.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
      context.drawImage(image, drawX, drawY, scaledWidth, scaledHeight);
      const croppedPhoto = canvas.toDataURL("image/jpeg", 0.86);

      setPhoto(croppedPhoto);
      setDraft(null);
      setMessage("Photo crop applied in this browser.");
      try {
        window.localStorage.setItem(storageKey(truckId), croppedPhoto);
      } catch {
        setMessage("Photo crop applied for this page only. Browser storage is full or unavailable.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The photo crop could not be applied.");
    } finally {
      setIsSaving(false);
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setDraft(null);
    try {
      window.localStorage.removeItem(storageKey(truckId));
    } catch {
      // The visible preview is still cleared even when storage is unavailable.
    }
    setMessage("Photo removed from this browser.");
  };

  const editorScale = 1 + (zoom - 1) * 0.72;

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!draft || isSaving || event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    dragStart.current = { x: event.clientX, y: event.clientY, horizontal, vertical };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveCrop = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setHorizontal(Math.max(-1, Math.min(1, start.horizontal + ((event.clientX - start.x) / bounds.width) * 2)));
    setVertical(Math.max(-1, Math.min(1, start.vertical + ((event.clientY - start.y) / bounds.height) * 2)));
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <article className="records-card truck-profile-visual truck-photo-manager">
      <div
        className={`truck-photo-canvas${draft ? " is-editing" : ""}`}
        aria-label={`${truckId} photo`}
        onPointerDown={beginDrag}
        onPointerMove={moveCrop}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        {draft ? (
          <>
            <img src={draft} alt="Crop area" draggable={false} style={{ transform: `translate(${horizontal * 14}%, ${vertical * 14}%) scale(${editorScale})` }} />
            <div className="truck-photo-crop-frame" aria-hidden="true" />
            <div className="truck-photo-crop-hint">Drag to position</div>
            <label className="truck-photo-resize-control">
              <span className="sr-only">Resize photo</span>
              <input aria-label="Resize photo" type="range" min="1" max="2" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
              <i aria-hidden="true" />
            </label>
            <div className="truck-photo-crop-actions">
              <button className="truck-photo-button" type="button" onClick={() => setDraft(null)} disabled={isSaving}>Cancel</button>
              <button className="truck-photo-button truck-photo-button-primary" type="button" onClick={applyCrop} disabled={isSaving}>{isSaving ? "Applying…" : "Apply crop"}</button>
            </div>
          </>
        ) : photo ? <img src={photo} alt={`${truckId} vehicle`} /> : <span>No photo added</span>}
      </div>

      <div className="truck-profile-visual-copy">
        <span className="eyebrow">{ownership === "Owned" ? "OWNED FLEET VEHICLE" : "SUBCONTRACTED VEHICLE"}</span>
        <strong>{truckId}</strong>
        <p>{truckType}</p>
      </div>

      <div className="truck-photo-actions">
        <input id={inputId} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
        <label className="truck-photo-button truck-photo-button-primary" htmlFor={inputId}>{photo ? "Replace photo" : "Add photo"}</label>
        {photo && <button className="truck-photo-button" type="button" onClick={() => startEditing(photo)}>Adjust crop</button>}
        {photo && <button className="truck-photo-button truck-photo-button-danger" type="button" onClick={removePhoto}>Remove</button>}
      </div>

      <p className="truck-photo-message" aria-live="polite">{message}</p>
    </article>
  );
}
