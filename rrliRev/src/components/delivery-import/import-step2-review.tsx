"use client";

import { useId } from "react";
import type { StagedDeliveryRow } from "@/features/deliveries/delivery-import-parser";
import type { FleetTruck } from "@/features/deliveries/truck-registry";
import type { FleetCrewMember } from "@/features/deliveries/driver-registry";

type FilterTab = "all" | "ready" | "attention" | "duplicate";

interface ImportStep2ReviewProps {
  stagedRows: StagedDeliveryRow[];
  fileName: string | null;
  missingWaybillCount: number;
  readyCount: number;
  attentionCount: number;
  duplicateCount: number;
  activeTab: FilterTab;
  onActiveTabChange: (tab: FilterTab) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onAutoGenerateMissingWaybills: () => void;
  onReplaceFile: () => void;
  onProceed: () => void;
  visibleRows: StagedDeliveryRow[];
  updateRowField: <K extends keyof StagedDeliveryRow>(
    id: string,
    field: K,
    value: StagedDeliveryRow[K],
  ) => void;
  removeStagedRow: (id: string) => void;
  liveClients: string[];
  liveTrucks: FleetTruck[];
  liveCrew: FleetCrewMember[];
}

export function ImportStep2Review({
  stagedRows,
  fileName,
  missingWaybillCount,
  readyCount,
  attentionCount,
  duplicateCount,
  activeTab,
  onActiveTabChange,
  searchQuery,
  onSearchQueryChange,
  onAutoGenerateMissingWaybills,
  onReplaceFile,
  onProceed,
  visibleRows,
  updateRowField,
  removeStagedRow,
  liveClients,
  liveTrucks,
  liveCrew,
}: ImportStep2ReviewProps) {
  const searchInputId = useId();

  return (
    <section className="records-card" aria-label="Review and Validate Staged Deliveries">
      <div className="records-heading">
        <div>
          <h2>2. Staged Deliveries ({stagedRows.length} trips parsed)</h2>
          <p>
            File: <strong>{fileName}</strong> — Correct any highlighted errors before proceeding.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {missingWaybillCount > 0 ? (
            <button
              type="button"
              className="secondary-button"
              onClick={onAutoGenerateMissingWaybills}
              title="Generate waybill IDs for rows that don't have one"
              style={{ color: "#d97706", borderColor: "#f59e0b" }}
            >
              Auto-Fill {missingWaybillCount} Missing Waybills
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onReplaceFile}>
            Replace File
          </button>
          <button
            type="button"
            className="primary-action-button"
            disabled={readyCount === 0}
            onClick={onProceed}
          >
            Proceed to Confirmation ({readyCount} Ready)
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        className="delivery-status-tabs"
        role="tablist"
        aria-label="Filter staged rows by validation status"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "all"}
          className={`delivery-status-tab${activeTab === "all" ? " active" : ""}`}
          onClick={() => onActiveTabChange("all")}
        >
          All Deliveries
          <span className="tab-count-badge">{stagedRows.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ready"}
          className={`delivery-status-tab${activeTab === "ready" ? " active" : ""}`}
          onClick={() => onActiveTabChange("ready")}
        >
          Ready to Import
          <span className="tab-count-badge">{readyCount}</span>
        </button>
        {attentionCount > 0 ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "attention"}
            className={`delivery-status-tab is-incomplete-tab${
              activeTab === "attention" ? " active" : ""
            }`}
            onClick={() => onActiveTabChange("attention")}
          >
            Needs Attention
            <span className="tab-count-badge">{attentionCount}</span>
          </button>
        ) : null}
        {duplicateCount > 0 ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "duplicate"}
            className={`delivery-status-tab${activeTab === "duplicate" ? " active" : ""}`}
            onClick={() => onActiveTabChange("duplicate")}
          >
            Duplicates (Skip)
            <span className="tab-count-badge">{duplicateCount}</span>
          </button>
        ) : null}
      </div>

      {/* Quick Search inside staged table */}
      <div className="filters">
        <div className="search-box">
          <input
            id={searchInputId}
            type="search"
            placeholder="Search waybill, client, plate, or stop…"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
          />
        </div>
        {searchQuery ? (
          <button
            type="button"
            className="secondary-button"
            style={{ fontSize: "12px", padding: "6px 12px" }}
            onClick={() => onSearchQueryChange("")}
          >
            Clear Search
          </button>
        ) : null}
      </div>

      {/* Staged Deliveries Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Date</th>
              <th>Waybill</th>
              <th>Client</th>
              <th>Plate</th>
              <th>Temp</th>
              <th>Revenue</th>
              <th>Diesel</th>
              <th>Tolls</th>
              <th>Crew (Driver / Helper)</th>
              <th>Stops</th>
              <th style={{ width: "40px" }} aria-label="Row Actions" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  style={{
                    textAlign: "center",
                    padding: "36px 16px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  No deliveries matching current filter.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  style={{
                    background:
                      row.status === "needs_attention"
                        ? "rgba(239, 68, 68, 0.04)"
                        : row.status === "duplicate"
                          ? "rgba(255, 255, 255, 0.02)"
                          : undefined,
                  }}
                >
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <span
                        className={`pod-status ${
                          row.status === "ready"
                            ? "attached"
                            : row.status === "duplicate"
                              ? "missing"
                              : "pending"
                        }`}
                        style={{ width: "fit-content" }}
                      >
                        {row.status === "ready"
                          ? "Ready"
                          : row.status === "duplicate"
                            ? "Duplicate"
                            : "Needs Attention"}
                      </span>
                      {row.issues.length > 0 ? (
                        <span className="import-row-error-badge">
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          {row.issues.map((i) => i.message).join(", ")}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <input
                      type="date"
                      min="2024-01-01"
                      className="import-table-input"
                      value={row.deliveryDate}
                      onChange={(e) => updateRowField(row.id, "deliveryDate", e.target.value)}
                      style={{ width: "125px" }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className={`import-table-input${!row.waybillNumber.trim() ? " has-error" : ""}`}
                      value={row.waybillNumber}
                      onChange={(e) => updateRowField(row.id, "waybillNumber", e.target.value)}
                      style={{
                        width: "115px",
                        fontFamily: "var(--font-mono, monospace)",
                        fontWeight: 600,
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      list="registered-clients-datalist"
                      className={`import-table-input${!row.clientName.trim() ? " has-error" : ""}`}
                      value={row.clientName}
                      onChange={(e) => updateRowField(row.id, "clientName", e.target.value)}
                      style={{ width: "135px" }}
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <input
                        type="text"
                        list="registered-trucks-datalist"
                        className={`import-table-input${!row.plateNumber.trim() ? " has-error" : ""}`}
                        value={row.plateNumber}
                        onChange={(e) => {
                          const newPlate = e.target.value.toUpperCase();
                          const matched = liveTrucks.find(
                            (t) =>
                              t.plateNumber.replace(/\s+/g, "").toUpperCase() ===
                              newPlate.replace(/\s+/g, ""),
                          );
                          if (matched) {
                            updateRowField(row.id, "plateNumber", newPlate);
                            updateRowField(row.id, "truckOwnership", matched.ownershipType);
                            updateRowField(row.id, "truckType", matched.truckType);
                            if (matched.driverName && !row.driverName) {
                              updateRowField(row.id, "driverName", matched.driverName);
                            }
                            if (matched.helperName && !row.helperName) {
                              updateRowField(row.id, "helperName", matched.helperName);
                            }
                          } else {
                            updateRowField(row.id, "plateNumber", newPlate);
                          }
                        }}
                        style={{ width: "95px", textTransform: "uppercase", fontWeight: 600 }}
                      />
                      <span
                        className="routex-badge"
                        style={{
                          fontSize: "9px",
                          width: "fit-content",
                          color: row.truckOwnership === "Owned" ? "#059669" : "#d97706",
                        }}
                      >
                        {row.truckOwnership === "Owned" ? "Owned" : "Subcon"}
                        {row.isNewTruck ? " (New)" : ""}
                      </span>
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      className="import-table-input"
                      value={row.truckTemperature}
                      placeholder="Temp"
                      onChange={(e) => updateRowField(row.id, "truckTemperature", e.target.value)}
                      style={{ width: "80px", textAlign: "center" }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className={`import-table-input${row.deliveryRate <= 0 ? " has-error" : ""}`}
                      min="0"
                      value={row.deliveryRate || ""}
                      placeholder="0"
                      onChange={(e) =>
                        updateRowField(row.id, "deliveryRate", Number(e.target.value) || 0)
                      }
                      style={{
                        width: "90px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="import-table-input"
                      min="0"
                      value={row.dieselExpenses ?? ""}
                      placeholder="Optional"
                      onChange={(e) =>
                        updateRowField(
                          row.id,
                          "dieselExpenses",
                          e.target.value !== "" ? Number(e.target.value) : null,
                        )
                      }
                      style={{
                        width: "80px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="import-table-input"
                      min="0"
                      value={row.tollGateExpenses ?? ""}
                      placeholder="Optional"
                      onChange={(e) =>
                        updateRowField(
                          row.id,
                          "tollGateExpenses",
                          e.target.value !== "" ? Number(e.target.value) : null,
                        )
                      }
                      style={{
                        width: "80px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <input
                        type="text"
                        list="registered-drivers-datalist"
                        className="import-table-input"
                        value={row.driverName ?? ""}
                        placeholder="Driver"
                        onChange={(e) =>
                          updateRowField(
                            row.id,
                            "driverName",
                            e.target.value.trim() ? e.target.value : null,
                          )
                        }
                        style={{ width: "110px", fontSize: "11px", padding: "3px 6px" }}
                      />
                      <input
                        type="text"
                        list="registered-helpers-datalist"
                        className="import-table-input"
                        value={row.helperName ?? ""}
                        placeholder="Helper"
                        onChange={(e) =>
                          updateRowField(
                            row.id,
                            "helperName",
                            e.target.value.trim() ? e.target.value : null,
                          )
                        }
                        style={{ width: "110px", fontSize: "11px", padding: "3px 6px" }}
                      />
                    </div>
                  </td>
                  <td>
                    <div style={{ maxWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="routex-badge" style={{ fontSize: "10px" }}>
                          {(() => {
                            const totalDrops = row.dropoffs.reduce(
                              (sum, d) => sum + Math.max(1, d.dropoffCount || 1),
                              0,
                            );
                            return totalDrops === row.dropoffs.length
                              ? `${totalDrops} ${totalDrops === 1 ? "Drop-off" : "Drop-offs"}`
                              : `${totalDrops} Drops (${row.dropoffs.length} locs)`;
                          })()}
                        </span>
                      </div>
                      <span
                        style={{
                          display: "block",
                          color: "var(--color-text-muted)",
                          fontSize: "11px",
                          marginTop: "3px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={row.dropoffs.map((d) => d.storeName).join(", ")}
                      >
                        {row.dropoffs.map((d) => d.storeName).join(", ")}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      className="truck-action-icon-btn danger"
                      aria-label={`Remove row for waybill ${row.waybillNumber}`}
                      title="Remove staged row"
                      onClick={() => removeStagedRow(row.id)}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <datalist id="registered-clients-datalist">
          {liveClients.map((client) => (
            <option key={client} value={client} />
          ))}
        </datalist>
        <datalist id="registered-trucks-datalist">
          {liveTrucks.map((t) => (
            <option key={t.id} value={t.plateNumber}>
              {t.plateNumber} ({t.ownershipType} - {t.truckType})
            </option>
          ))}
        </datalist>
        <datalist id="registered-drivers-datalist">
          {liveCrew
            .filter((c) => c.assignmentType === "Driver")
            .map((c) => (
              <option key={c.id} value={c.fullName} />
            ))}
        </datalist>
        <datalist id="registered-helpers-datalist">
          {liveCrew
            .filter((c) => c.assignmentType === "Helper")
            .map((c) => (
              <option key={c.id} value={c.fullName} />
            ))}
        </datalist>
      </div>
    </section>
  );
}
