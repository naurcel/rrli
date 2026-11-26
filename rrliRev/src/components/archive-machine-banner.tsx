"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  activateArchiveMachineSnapshot,
  type ArchiveMachineSnapshot,
  clearArchiveMachineSnapshot,
  parseArchiveMachineText,
  parseArchiveMachineWorkbook,
  readArchiveMachineSnapshot,
  ROUTEX_ARCHIVE_MACHINE_CHANGED,
} from "@/features/archive/archive-machine";
import {
  parseDateValue,
  presetRange,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";

export function ArchiveMachineBanner() {
  const { setRange } = useGlobalDateRange();
  const [snapshot, setSnapshot] = useState<ArchiveMachineSnapshot | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSnapshot(readArchiveMachineSnapshot());
    const handleSync = () => {
      setSnapshot(readArchiveMachineSnapshot());
    };
    window.addEventListener(ROUTEX_ARCHIVE_MACHINE_CHANGED, handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener(ROUTEX_ARCHIVE_MACHINE_CHANGED, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  function applySnapshotAndSyncDateRange(next: ArchiveMachineSnapshot) {
    activateArchiveMachineSnapshot(next);
    setSnapshot(next);
    if (next.dateFrom && next.dateTo) {
      setRange({
        startDate: parseDateValue(next.dateFrom),
        endDate: parseDateValue(next.dateTo),
        preset: "custom",
      });
    } else {
      const refDate = parseDateValue(next.referenceDate);
      setRange({
        ...presetRange("year", refDate),
        preset: "year",
      });
    }
    toast.success(`Entered Archive Machine (${next.archiveYear})`, {
      description: `Viewing ${next.deliveries.length} trips and ${next.companyExpenses.length} finance records from ${next.fileName}.`,
    });
  }

  function handleFileSelected(file: File) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buf = e.target?.result;
          if (buf instanceof ArrayBuffer) {
            const parsed = parseArchiveMachineWorkbook(buf, file.name);
            applySnapshotAndSyncDateRange(parsed);
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to load archive workbook.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result;
          if (typeof text === "string") {
            const parsed = parseArchiveMachineText(text, file.name);
            applySnapshotAndSyncDateRange(parsed);
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to load archive file.");
        }
      };
      reader.readAsText(file);
    }
  }

  function handleExitArchive() {
    clearArchiveMachineSnapshot();
    setSnapshot(null);
    setRange({ ...presetRange("month"), preset: "month" });
    toast.info("Returned to Live Workspace", {
      description: "Archive Machine exited; showing current live RouteX records.",
    });
  }

  if (!snapshot) return null;

  return (
    <div
      role="region"
      aria-label="Archive Machine Active Mode"
      className="no-print"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        padding: "10px 28px",
        background: "linear-gradient(90deg, rgba(180, 83, 9, 0.14), rgba(245, 158, 11, 0.08))",
        borderBottom: "1px solid rgba(217, 119, 6, 0.32)",
        color: "var(--color-text-primary)",
        fontSize: "12.5px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: 750,
            color: "var(--color-accent-deep, #92400e)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            fontSize: "11.5px",
          }}
        >
          <Archive size={14} strokeWidth={2.2} aria-hidden="true" />
          Archive Machine · {snapshot.archiveYear}
        </span>
        <span style={{ color: "var(--color-text-secondary)" }}>
          Viewing exported snapshot <strong>{snapshot.fileName}</strong> ({snapshot.periodLabel} ·{" "}
          {snapshot.deliveries.length} trips · {snapshot.companyExpenses.length} finance records)
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json,.sql,.html"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelected(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="secondary-button"
          style={{
            minHeight: "28px",
            height: "28px",
            padding: "0 10px",
            fontSize: "11.5px",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={12} strokeWidth={2} aria-hidden="true" />
          Switch Archive
        </button>
        <button
          type="button"
          className="primary-action-button"
          style={{
            minHeight: "28px",
            height: "28px",
            padding: "0 12px",
            fontSize: "11.5px",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
          onClick={handleExitArchive}
        >
          <RotateCcw size={12} strokeWidth={2.2} aria-hidden="true" />
          Exit Archive Machine
        </button>
      </div>
    </div>
  );
}
