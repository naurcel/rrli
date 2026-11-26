"use client";

import { useState, useRef, useEffect, type PointerEvent as ReactPointerEvent } from "react";

interface CropBox {
  x: number;
  y: number;
  size: number;
}

type DragMode =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "nw"
  | "ne"
  | "sw"
  | "se";

interface DragState {
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startCrop: CropBox;
}

const MAX_STAGE_WIDTH = 380;
const MAX_STAGE_HEIGHT = 340;
const MIN_CROP_SIZE = 56;

export function ProfilePhotoCropperModal({
  imageSrc,
  onCancel,
  onConfirm,
  saving = false,
}: {
  imageSrc: string | null;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
  saving?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number }>({
    width: 320,
    height: 320,
  });
  const [crop, setCrop] = useState<CropBox>({ x: 30, y: 30, size: 260 });
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (!imageSrc) {
      setNaturalSize(null);
    }
  }, [imageSrc]);

  if (!imageSrc) return null;

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const el = e.currentTarget;
    const natW = el.naturalWidth || 320;
    const natH = el.naturalHeight || 320;
    setNaturalSize({ width: natW, height: natH });

    const scale = Math.min(MAX_STAGE_WIDTH / natW, MAX_STAGE_HEIGHT / natH, 1);
    const dispW = Math.max(160, Math.round(natW * scale));
    const dispH = Math.max(160, Math.round(natH * scale));
    setDisplaySize({ width: dispW, height: dispH });

    const minDim = Math.min(dispW, dispH);
    const initialSize = Math.max(MIN_CROP_SIZE, Math.round(minDim * 0.82));
    setCrop({
      x: Math.round((dispW - initialSize) / 2),
      y: Math.round((dispH - initialSize) / 2),
      size: initialSize,
    });
  }

  function startDrag(mode: DragMode, e: ReactPointerEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCrop: { ...crop },
    };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLElement>) {
    const state = dragRef.current;
    if (!state) return;

    const dx = e.clientX - state.startClientX;
    const dy = e.clientY - state.startClientY;
    const { x: sx, y: sy, size: sSize } = state.startCrop;
    const { width: maxW, height: maxH } = displaySize;
    const minSize = Math.min(MIN_CROP_SIZE, Math.min(maxW, maxH));

    if (state.mode === "move") {
      const nextX = Math.max(0, Math.min(maxW - sSize, sx + dx));
      const nextY = Math.max(0, Math.min(maxH - sSize, sy + dy));
      setCrop({ x: nextX, y: nextY, size: sSize });
      return;
    }

    let nextX = sx;
    let nextY = sy;
    let nextSize = sSize;

    if (state.mode === "e") {
      const maxAllowed = Math.min(maxW - sx, maxH - sy);
      nextSize = Math.max(minSize, Math.min(maxAllowed, sSize + dx));
    } else if (state.mode === "s") {
      const maxAllowed = Math.min(maxW - sx, maxH - sy);
      nextSize = Math.max(minSize, Math.min(maxAllowed, sSize + dy));
    } else if (state.mode === "w") {
      const rightEdge = sx + sSize;
      const maxAllowed = Math.min(rightEdge, maxH - sy);
      nextSize = Math.max(minSize, Math.min(maxAllowed, sSize - dx));
      nextX = rightEdge - nextSize;
    } else if (state.mode === "n") {
      const bottomEdge = sy + sSize;
      const maxAllowed = Math.min(bottomEdge, maxW - sx);
      nextSize = Math.max(minSize, Math.min(maxAllowed, sSize - dy));
      nextY = bottomEdge - nextSize;
    } else if (state.mode === "se") {
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      const maxAllowed = Math.min(maxW - sx, maxH - sy);
      nextSize = Math.max(minSize, Math.min(maxAllowed, sSize + delta));
    } else if (state.mode === "nw") {
      const delta = Math.abs(dx) > Math.abs(dy) ? -dx : -dy;
      const rightEdge = sx + sSize;
      const bottomEdge = sy + sSize;
      const maxAllowed = Math.min(rightEdge, bottomEdge);
      nextSize = Math.max(minSize, Math.min(maxAllowed, sSize + delta));
      nextX = rightEdge - nextSize;
      nextY = bottomEdge - nextSize;
    } else if (state.mode === "ne") {
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : -dy;
      const bottomEdge = sy + sSize;
      const maxAllowed = Math.min(maxW - sx, bottomEdge);
      nextSize = Math.max(minSize, Math.min(maxAllowed, sSize + delta));
      nextY = bottomEdge - nextSize;
    } else if (state.mode === "sw") {
      const delta = Math.abs(dx) > Math.abs(dy) ? -dx : dy;
      const rightEdge = sx + sSize;
      const maxAllowed = Math.min(rightEdge, maxH - sy);
      nextSize = Math.max(minSize, Math.min(maxAllowed, sSize + delta));
      nextX = rightEdge - nextSize;
    }

    setCrop({
      x: Math.round(nextX),
      y: Math.round(nextY),
      size: Math.round(nextSize),
    });
  }

  function endDrag(e: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if not captured
      }
      dragRef.current = null;
    }
  }

  function handleApplyCrop() {
    const imgEl = imgRef.current;
    if (!imgEl || !naturalSize) return;

    const targetSize = 320;
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scaleX = naturalSize.width / displaySize.width;
    const scaleY = naturalSize.height / displaySize.height;

    const sx = Math.max(0, crop.x * scaleX);
    const sy = Math.max(0, crop.y * scaleY);
    const sWidth = Math.min(naturalSize.width - sx, crop.size * scaleX);
    const sHeight = Math.min(naturalSize.height - sy, crop.size * scaleY);

    ctx.drawImage(imgEl, sx, sy, sWidth, sHeight, 0, 0, targetSize, targetSize);
    const croppedUrl = canvas.toDataURL("image/jpeg", 0.9);
    onConfirm(croppedUrl);
  }

  const cx = crop.x + crop.size / 2;
  const cy = crop.y + crop.size / 2;
  const r = crop.size / 2;

  // SVG path with evenodd rule: outer rectangle minus inner circle
  const maskPath = `M 0 0 H ${displaySize.width} V ${displaySize.height} H 0 Z M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy + r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z`;

  return (
    <div
      className="profile-cropper-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Move and crop profile picture"
    >
      <div className="profile-cropper-dialog">
        <div className="profile-cropper-header">
          <h3>Adjust Profile Picture</h3>
          <p>Drag inside to move, or drag the edges to crop. The greyed-out area will be excluded.</p>
        </div>

        <div className="profile-cropper-stage-wrap">
          <div
            className="profile-cropper-stage"
            style={{
              width: `${displaySize.width}px`,
              height: `${displaySize.height}px`,
            }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop source"
              onLoad={handleImageLoad}
              className="profile-cropper-source-img"
              draggable={false}
            />

            {/* Greyed-out area outside the actual circular profile area */}
            <svg
              className="profile-cropper-mask-svg"
              width={displaySize.width}
              height={displaySize.height}
              viewBox={`0 0 ${displaySize.width} ${displaySize.height}`}
              aria-hidden="true"
            >
              <path
                d={maskPath}
                fill="rgba(15, 23, 21, 0.64)"
                fillRule="evenodd"
              />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="rgba(255, 255, 255, 0.92)"
                strokeWidth="2"
              />
            </svg>

            {/* Draggable Crop Box & Edge/Corner Controls */}
            <div
              className="profile-cropper-box"
              style={{
                left: `${crop.x}px`,
                top: `${crop.y}px`,
                width: `${crop.size}px`,
                height: `${crop.size}px`,
              }}
              onPointerDown={(e) => startDrag("move", e)}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {/* Subtle guide grid */}
              <div className="profile-cropper-grid" aria-hidden="true" />

              {/* 4 Edge Handles */}
              <div
                className="crop-handle crop-edge-n"
                onPointerDown={(e) => startDrag("n", e)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
              <div
                className="crop-handle crop-edge-s"
                onPointerDown={(e) => startDrag("s", e)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
              <div
                className="crop-handle crop-edge-e"
                onPointerDown={(e) => startDrag("e", e)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
              <div
                className="crop-handle crop-edge-w"
                onPointerDown={(e) => startDrag("w", e)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />

              {/* 4 Corner Handles */}
              <div
                className="crop-handle crop-corner-nw"
                onPointerDown={(e) => startDrag("nw", e)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
              <div
                className="crop-handle crop-corner-ne"
                onPointerDown={(e) => startDrag("ne", e)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
              <div
                className="crop-handle crop-corner-sw"
                onPointerDown={(e) => startDrag("sw", e)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
              <div
                className="crop-handle crop-corner-se"
                onPointerDown={(e) => startDrag("se", e)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            </div>
          </div>
        </div>

        <div className="profile-cropper-actions">
          <button
            type="button"
            className="profile-cropper-cancel-btn"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="profile-cropper-save-btn"
            onClick={handleApplyCrop}
            disabled={saving}
          >
            {saving ? "Saving..." : "Apply Crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
