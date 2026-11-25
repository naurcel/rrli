"use client";

import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import {
  normalizeSupportingDocument,
  type SupportingDocumentItem,
  type SupportingDocumentRecord,
} from "@/features/deliveries/delivery-domain";
import { generateMockPodSvgReceipt } from "@/features/deliveries/pod-utils";
import { ImageViewerModal } from "@/components/image-viewer-modal";
import { RoundedSelect, type SelectOption } from "@/components/rounded-select";

interface DeliverySupportingDocumentsPaneProps {
  trip: DeliveryLedgerItem;
  canManage: boolean;
  onTripChange: (updatedTrip: DeliveryLedgerItem) => void;
  activeStopId?: string | null;
  onSelectStopId?: (stopId: string | null) => void;
}

function getFileType(filename: string): "pdf" | "image" | "other" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif")
  ) {
    return "image";
  }
  return "other";
}

export function DeliverySupportingDocumentsPane({
  trip,
  canManage,
  onTripChange,
  activeStopId,
  onSelectStopId,
}: DeliverySupportingDocumentsPaneProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingDocIndex, setEditingDocIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [filter, setFilter] = useState<"all" | "trip" | "stores">("all");
  const [targetDropoffId, setTargetDropoffId] = useState<string>("trip");

  const [viewingImage, setViewingImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    filename?: string;
  } | null>(null);

  const rawDocs = trip.supportingDocuments ?? [];
  const normalizedDocs: SupportingDocumentRecord[] = useMemo(() => {
    return rawDocs.map((doc, idx) => {
      const item = normalizeSupportingDocument(doc, idx);
      // Auto-resolve storeName if dropoffId is present
      if (item.dropoffId && !item.storeName) {
        const found = trip.dropoffs.find((d) => d.id === item.dropoffId);
        if (found) item.storeName = found.storeName;
      }
      return item;
    });
  }, [rawDocs, trip.dropoffs]);

  // Counts
  const tripLevelCount = normalizedDocs.filter((d) => !d.dropoffId).length;
  const storeLinkedCount = normalizedDocs.filter((d) => Boolean(d.dropoffId)).length;

  // Filtered documents
  const displayedDocs = useMemo(() => {
    if (filter === "trip") {
      return normalizedDocs.filter((d) => !d.dropoffId);
    }
    if (filter === "stores") {
      return normalizedDocs.filter((d) => Boolean(d.dropoffId));
    }
    return normalizedDocs;
  }, [normalizedDocs, filter]);

  const dropoffOptions: SelectOption[] = useMemo(
    () => [
      { value: "trip", label: "Entire Trip (General)" },
      ...trip.dropoffs.map((stop, i) => ({
        value: stop.id,
        label: `Stop #${stop.sequence || i + 1}: ${stop.storeName}`,
      })),
    ],
    [trip.dropoffs],
  );

  async function persistSupportingDocs(nextDocs: SupportingDocumentItem[], reason: string) {
    const updatedTrip: DeliveryLedgerItem = {
      ...trip,
      version: trip.version + 1,
      supportingDocuments: nextDocs,
    };
    onTripChange(updatedTrip);

    try {
      await fetch("/api/deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "correct_financials",
          deliveryId: trip.id,
          expectedVersion: trip.version ?? 1,
          reason,
          changes: {
            supportingDocuments: nextDocs,
          },
          fallbackRecord: updatedTrip,
        }),
      });
    } catch {
      // Local preview already saved via onTripChange
    }
  }

  function handleFilesAdded(files: FileList | File[]) {
    if (!canManage) return;
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const existingNames = normalizedDocs.map((d) => d.name.toLowerCase());
    const newItems: SupportingDocumentRecord[] = [];

    const selectedStop =
      targetDropoffId && targetDropoffId !== "trip"
        ? trip.dropoffs.find((d) => d.id === targetDropoffId)
        : null;

    for (const f of fileArray) {
      const cleanName = f.name.trim();
      if (!cleanName) continue;
      if (existingNames.includes(cleanName.toLowerCase())) {
        toast.info("Document already attached", {
          description: `"${cleanName}" is already attached to this delivery.`,
        });
        continue;
      }
      existingNames.push(cleanName.toLowerCase());
      newItems.push({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: cleanName,
        dropoffId: selectedStop ? selectedStop.id : null,
        storeName: selectedStop ? selectedStop.storeName : null,
        uploadedAt: new Date().toISOString(),
      });
    }

    if (newItems.length === 0) return;

    const nextDocs = [...normalizedDocs, ...newItems];
    const destinationLabel = selectedStop ? `for ${selectedStop.storeName}` : "for entire trip";
    void persistSupportingDocs(nextDocs, `Attached ${newItems.map((i) => i.name).join(", ")} ${destinationLabel}`);

    toast.success(
      newItems.length === 1 ? "Supporting document added" : `${newItems.length} documents added`,
      {
        description: selectedStop
          ? `Linked to Stop: ${selectedStop.storeName}`
          : "Attached to Entire Trip (General)",
      },
    );
  }

  function handleLinkChange(index: number, newDropoffId: string) {
    if (!canManage) return;
    const targetDoc = normalizedDocs[index];
    if (!targetDoc) return;

    const isTripLevel = newDropoffId === "trip" || !newDropoffId;
    const matchingStop = isTripLevel ? null : trip.dropoffs.find((d) => d.id === newDropoffId);

    const updatedDoc: SupportingDocumentRecord = {
      ...targetDoc,
      dropoffId: matchingStop ? matchingStop.id : null,
      storeName: matchingStop ? matchingStop.storeName : null,
    };

    const nextDocs = normalizedDocs.map((d, i) => (i === index ? updatedDoc : d));
    const actionDesc = matchingStop
      ? `Linked "${targetDoc.name}" to ${matchingStop.storeName}`
      : `Set "${targetDoc.name}" to Entire Trip (General)`;

    void persistSupportingDocs(nextDocs, actionDesc);
    toast.success("Document location updated", { description: actionDesc });
  }

  function handleStartRename(index: number, currentName: string) {
    if (!canManage) return;
    setEditingDocIndex(index);
    setEditingName(currentName);
  }

  function handleSaveRename(index: number) {
    const cleanName = editingName.trim();
    if (!cleanName) {
      setEditingDocIndex(null);
      return;
    }

    const prevDoc = normalizedDocs[index];
    if (!prevDoc || cleanName === prevDoc.name) {
      setEditingDocIndex(null);
      return;
    }

    const nextDocs = normalizedDocs.map((d, i) => (i === index ? { ...d, name: cleanName } : d));
    setEditingDocIndex(null);
    void persistSupportingDocs(nextDocs, `Renamed document "${prevDoc.name}" to "${cleanName}"`);
    toast.success("Document renamed", {
      description: `Renamed to "${cleanName}".`,
    });
  }

  function handleDeleteDoc(index: number) {
    if (!canManage) return;
    const toRemove = normalizedDocs[index];
    if (!toRemove) return;
    const nextDocs = normalizedDocs.filter((_, i) => i !== index);
    void persistSupportingDocs(nextDocs, `Removed supporting document "${toRemove.name}"`);
    toast.success("Document removed", {
      description: `"${toRemove.name}" removed from supporting documents.`,
    });
  }

  function handleViewDoc(doc: SupportingDocumentRecord) {
    const fallbackUrl =
      doc.fileUrl ||
      generateMockPodSvgReceipt(
        trip,
        {
          storeName: doc.storeName || doc.name,
          destinationArea: doc.storeName ? "Store Document" : "Trip Document",
        },
        doc.name,
      );

    setViewingImage({
      url: fallbackUrl,
      title: `Supporting Document · ${doc.name}`,
      subtitle: doc.storeName
        ? `Linked to ${doc.storeName} · Waybill #${trip.waybillNumber}`
        : `Trip-Wide · Waybill #${trip.waybillNumber} · ${trip.clientName}`,
      filename: doc.name,
    });
  }

  return (
    <div className="delivery-supporting-docs-pane">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) {
            handleFilesAdded(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {/* Header Bar */}
      <div className="supporting-docs-header-bar">
        <div className="supporting-docs-header-titles">
          <h3 className="supporting-docs-pane-title">
            Supporting Documents{" "}
            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-muted)" }}>
              ({normalizedDocs.length})
            </span>
          </h3>
          <span className="supporting-docs-pane-hint">
            Receipts, gate passes, fuel invoices &amp; store attachments
          </span>
        </div>
      </div>

      {/* Sleek Upload & Drop Target (shown when documents already exist) */}
      {canManage && normalizedDocs.length > 0 ? (
        <div
          className={`supporting-docs-upload-bar ${isDragging ? "is-drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) {
              handleFilesAdded(e.dataTransfer.files);
            }
          }}
        >
          <div
            className="supporting-docs-upload-left"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="supporting-docs-upload-icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="supporting-docs-upload-copy">
              <span className="supporting-docs-upload-title">Drop files here, or click to browse</span>
              <span className="supporting-docs-upload-hint">PDF, PNG, JPG up to 10MB</span>
            </div>
          </div>

          {trip.dropoffs.length > 0 ? (
            <div
              className="supporting-docs-target-select-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="supporting-docs-target-select-label">Link to:</span>
              <RoundedSelect
                value={targetDropoffId}
                options={dropoffOptions}
                onChange={setTargetDropoffId}
                ariaLabel="Select default store link for new uploads"
                className="supporting-docs-rounded-select"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Filter Tabs (when there are multiple docs and some linked) */}
      {normalizedDocs.length > 1 && storeLinkedCount > 0 ? (
        <div className="supporting-docs-filters" role="tablist" aria-label="Filter supporting documents">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`supporting-docs-filter-btn ${filter === "all" ? "is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({normalizedDocs.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "trip"}
            className={`supporting-docs-filter-btn ${filter === "trip" ? "is-active" : ""}`}
            onClick={() => setFilter("trip")}
          >
            Trip-wide ({tripLevelCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "stores"}
            className={`supporting-docs-filter-btn ${filter === "stores" ? "is-active" : ""}`}
            onClick={() => setFilter("stores")}
          >
            Store drop-offs ({storeLinkedCount})
          </button>
        </div>
      ) : null}

      {/* Documents List */}
      <div className="supporting-docs-items-list" role="list" aria-label="Attached supporting documents">
        {displayedDocs.length === 0 ? (
          canManage && normalizedDocs.length === 0 ? (
            <div
              className={`supporting-docs-empty-card is-interactive-dropzone ${isDragging ? "is-drag-over" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) {
                  handleFilesAdded(e.dataTransfer.files);
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              style={{ cursor: "pointer", padding: "26px 18px", gap: "6px" }}
            >
              <div className="supporting-docs-empty-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="supporting-docs-empty-title">
                Drop receipts, gate passes, or fuel slips here
              </div>
              <div className="supporting-docs-empty-desc">
                PDF, PNG, or JPG up to 10MB. Or click to browse files.
              </div>
              {trip.dropoffs.length > 0 ? (
                <div
                  className="supporting-docs-target-select-wrap"
                  style={{ marginTop: "10px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="supporting-docs-target-select-label">Attach to:</span>
                  <RoundedSelect
                    value={targetDropoffId}
                    options={dropoffOptions}
                    onChange={setTargetDropoffId}
                    ariaLabel="Select default store link for new uploads"
                    className="supporting-docs-rounded-select"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="supporting-docs-empty-card">
              <div className="supporting-docs-empty-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <div className="supporting-docs-empty-title">
                {filter === "all"
                  ? "No supporting documents"
                  : filter === "trip"
                    ? "No trip-wide documents"
                    : "No store-linked documents"}
              </div>
              <div className="supporting-docs-empty-desc">
                {canManage
                  ? "No documents match the selected filter."
                  : "No supporting files have been attached to this trip yet."}
              </div>
            </div>
          )
        ) : (
          displayedDocs.map((doc, displayIndex) => {
            const originalIndex = normalizedDocs.findIndex((d) => d.name === doc.name);
            const isEditing = editingDocIndex === originalIndex;
            const fileType = getFileType(doc.name);
            const isHighlighted = Boolean(activeStopId && doc.dropoffId === activeStopId);

            return (
              <div
                key={doc.id || `${doc.name}-${displayIndex}`}
                className={`supporting-doc-card ${isHighlighted ? "is-highlighted" : ""}`}
                role="listitem"
                onMouseEnter={() => {
                  if (doc.dropoffId) onSelectStopId?.(doc.dropoffId);
                }}
                onMouseLeave={() => {
                  if (doc.dropoffId) onSelectStopId?.(null);
                }}
              >
                <div className="supporting-doc-card-main">
                  {/* File Type Pill */}
                  <div className={`supporting-doc-type-icon ${fileType}`} aria-label={fileType}>
                    {fileType === "pdf" ? "PDF" : fileType === "image" ? "IMG" : "DOC"}
                  </div>

                  <div className="supporting-doc-info-col">
                    {/* File Name or Inline Rename */}
                    {isEditing ? (
                      <div className="supporting-doc-rename-inline" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="supporting-doc-rename-input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveRename(originalIndex);
                            } else if (e.key === "Escape") {
                              setEditingDocIndex(null);
                            }
                          }}
                          autoFocus
                          aria-label="Edit document filename"
                        />
                        <button
                          type="button"
                          className="supporting-doc-rename-btn save"
                          onClick={() => handleSaveRename(originalIndex)}
                          title="Save name"
                          aria-label="Save name"
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="supporting-doc-rename-btn cancel"
                          onClick={() => setEditingDocIndex(null)}
                          title="Cancel"
                          aria-label="Cancel"
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="supporting-doc-title-clickable"
                        onClick={() => handleViewDoc(doc)}
                        title={`Click to preview: ${doc.name}`}
                      >
                        {doc.name}
                      </button>
                    )}

                    {/* Linked Location Dropdown or Badge */}
                    <div className="supporting-doc-location-row">
                      {canManage && trip.dropoffs.length > 0 ? (
                        <div
                          className="supporting-docs-item-select-wrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RoundedSelect
                            value={doc.dropoffId ?? "trip"}
                            options={dropoffOptions}
                            onChange={(val) => handleLinkChange(originalIndex, val)}
                            ariaLabel={`Change linked location for ${doc.name}`}
                            className="supporting-docs-rounded-select is-item-select"
                          />
                        </div>
                      ) : (
                        <span
                          className={`supporting-doc-location-tag ${doc.dropoffId ? "is-store" : ""}`}
                        >
                          {doc.storeName ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              {doc.storeName}
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                              </svg>
                              Entire Trip
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {!isEditing ? (
                  <div className="supporting-doc-card-actions">
                    <button
                      type="button"
                      className="supporting-doc-icon-btn"
                      onClick={() => handleViewDoc(doc)}
                      title={`Preview ${doc.name}`}
                      aria-label={`Preview ${doc.name}`}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>

                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="supporting-doc-icon-btn"
                          onClick={() => handleStartRename(originalIndex, doc.name)}
                          title="Rename document"
                          aria-label={`Rename ${doc.name}`}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          className="supporting-doc-icon-btn delete"
                          onClick={() => handleDeleteDoc(originalIndex)}
                          title="Delete document"
                          aria-label={`Delete ${doc.name}`}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <ImageViewerModal
        isOpen={Boolean(viewingImage)}
        onClose={() => setViewingImage(null)}
        imageUrl={viewingImage?.url ?? ""}
        title={viewingImage?.title ?? ""}
        subtitle={viewingImage?.subtitle}
        filename={viewingImage?.filename}
      />
    </div>
  );
}
