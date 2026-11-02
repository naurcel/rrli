"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import {
  isDateInRange,
  useGlobalDateRange,
} from "@/components/global-date-range-picker";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import {
  derivePodVerificationStatus,
} from "@/features/deliveries/delivery-domain";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";
import { canVerifyPodDocuments } from "@/lib/auth/rbac";

export default function PodDocumentsPage() {
  const actor = useAuthenticatedActor();
  const { range } = useGlobalDateRange();
  const canVerify = canVerifyPodDocuments(actor.role);

  const [deliveries, setDeliveries] = useState<readonly DeliveryLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("All Drop-off Statuses");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [updatingStopId, setUpdatingStopId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    fetch("/api/deliveries?page=1&pageSize=100", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          ok?: boolean;
          items?: DeliveryLedgerItem[];
          message?: string;
        };
        if (!response.ok || !data.ok) {
          throw new Error(data.message ?? "Unable to load POD records.");
        }
        setDeliveries(data.items ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Unable to load POD records.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const dateFilteredDeliveries = useMemo(
    () => deliveries.filter((trip) => isDateInRange(trip.deliveryDate, range)),
    [deliveries, range],
  );

  const flattenedStops = useMemo(() => {
    return dateFilteredDeliveries.flatMap((trip) =>
      trip.dropoffs.map((stop) => ({
        tripId: trip.id,
        waybillNumber: trip.waybillNumber,
        deliveryDate: trip.deliveryDate,
        clientName: trip.clientName,
        plateNumber: trip.plateNumber,
        stop,
        isComplete: stop.podSubmitted && stop.supportingDocsComplete,
      })),
    );
  }, [dateFilteredDeliveries]);

  const filteredStops = useMemo(() => {
    if (filterStatus === "Verified Only") {
      return flattenedStops.filter((item) => item.isComplete);
    }
    if (filterStatus === "Needs Follow-up") {
      return flattenedStops.filter((item) => !item.isComplete);
    }
    return flattenedStops;
  }, [flattenedStops, filterStatus]);

  const counts = useMemo(() => {
    const verified = flattenedStops.filter((item) => item.isComplete).length;
    const pending = flattenedStops.length - verified;
    return { total: flattenedStops.length, verified, pending };
  }, [flattenedStops]);

  async function toggleStopVerification(item: (typeof flattenedStops)[number]) {
    if (!canVerify || updatingStopId) {
      return;
    }

    setUpdatingStopId(item.stop.id);
    setFeedback(null);
    const nextState = !item.isComplete;

    try {
      const response = await fetch("/api/deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryId: item.tripId,
          dropoffId: item.stop.id,
          podSubmitted: nextState,
          supportingDocsComplete: nextState,
          documentRef: nextState
            ? `POD-${item.waybillNumber}-S${item.stop.sequence}.pdf`
            : "Awaiting verification",
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        deliveryId?: string;
        podStatus?: string;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setFeedback({
          tone: "error",
          text: payload?.message ?? "Could not update POD verification status.",
        });
        return;
      }

      setDeliveries((current) =>
        current.map((trip) =>
          trip.id === item.tripId
            ? (() => {
                const nextDropoffs = trip.dropoffs.map((stop) =>
                  stop.id === item.stop.id
                    ? {
                        ...stop,
                        podSubmitted: nextState,
                        supportingDocsComplete: nextState,
                        documentRef: nextState
                          ? `POD-${item.waybillNumber}-S${item.stop.sequence}.pdf`
                          : "Awaiting verification",
                      }
                    : stop,
                );
                return {
                  ...trip,
                  dropoffs: nextDropoffs,
                  podStatus: derivePodVerificationStatus(nextDropoffs),
                };
              })()
            : trip,
        ),
      );
      setFeedback({
        tone: "success",
        text: `Updated POD & supporting document status for ${item.stop.storeName} (${item.waybillNumber}).`,
      });
    } catch {
      setFeedback({
        tone: "error",
        text: "Network error while updating POD verification status.",
      });
    } finally {
      setUpdatingStopId(null);
    }
  }

  return (
    <>
      <OperationalTopbar contextLabel="POD & Supporting Document Verification" />

      <div className="content-wrap">
        <header className="page-intro">
          <div>
            <p className="eyebrow">DOCUMENT COMPLETENESS CHECKING</p>
            <h1>POD & Supporting Documents</h1>
            <p className="subtitle">
              Verify store-by-store Proof of Delivery (POD) slips and supporting documents across
              every completed trip.
            </p>
          </div>
          {canVerify ? (
            <span className="access-pill operations">
              Verification Enabled ({actor.roleLabel})
            </span>
          ) : (
            <span className="settings-readonly-pill">
              View-Only Mode ({actor.roleLabel})
            </span>
          )}
        </header>

        {feedback ? (
          <section className="notice" role={feedback.tone === "error" ? "alert" : "status"}>
            <span className="notice-icon" aria-hidden="true">
              {feedback.tone === "error" ? "!" : "i"}
            </span>
            <div>
              <strong>
                {feedback.tone === "error" ? "Action Blocked:" : "Verification Updated:"}
              </strong>
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setFeedback(null)}
            >
              ×
            </button>
          </section>
        ) : null}

        <section className="stat-grid" aria-label="POD verification totals">
          <article className="stat-card">
            <span className="stat-label">TOTAL STORE DROP-OFFS</span>
            <strong>{counts.total}</strong>
            <span className="stat-meta">Across {deliveries.length} completed deliveries</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">VERIFIED POD & DOCS</span>
            <strong>{counts.verified}</strong>
            <span className="stat-meta positive">Complete receiving slip & waybill</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">NEEDS FOLLOW-UP</span>
            <strong>{counts.pending}</strong>
            <span className={`stat-meta ${counts.pending > 0 ? "warning" : "positive"}`}>
              {counts.pending > 0
                ? "Missing POD or incomplete supporting document"
                : "All store documents verified"}
            </span>
          </article>
        </section>

        <section className={`records-card${loading ? " is-loading" : ""}`} aria-label="Store POD verification checklist">
          <div className="records-heading">
            <div>
              <h2>Store-Level Document Verification Queue</h2>
              <p>
                Each store drop-off within a delivery is checked for both POD submission and
                supporting document completeness.
              </p>
            </div>
            <RoundedSelect
              value={filterStatus}
              options={["All Drop-off Statuses", "Needs Follow-up", "Verified Only"]}
              onChange={setFilterStatus}
              ariaLabel="Filter drop-offs by document status"
            />
          </div>

          {loadError ? (
            <div className="empty-state" role="alert">
              <strong>POD records are unavailable</strong>
              <span>{loadError}</span>
            </div>
          ) : loading ? (
            <div className="empty-state" role="status">
              <strong>Loading document queue…</strong>
              <span>Retrieving completed deliveries and store-level document states.</span>
            </div>
          ) : filteredStops.length === 0 ? (
            <div className="empty-state">
              <strong>No drop-offs match this view</strong>
              <span>Change the document filter or selected date range.</span>
            </div>
          ) : <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waybill & Date</th>
                  <th>Client</th>
                  <th>Truck</th>
                  <th>Stop # & Store Name</th>
                  <th>POD Submitted</th>
                  <th>Supporting Docs</th>
                  <th>Document Reference</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStops.map((item) => (
                  <tr key={item.stop.id}>
                    <td>
                      <strong>{item.waybillNumber}</strong>
                      <br />
                      <small>{item.deliveryDate}</small>
                    </td>
                    <td>{item.clientName}</td>
                    <td className="truck-code">{item.plateNumber}</td>
                    <td>
                      <strong>
                        Stop #{item.stop.sequence}: {item.stop.storeName}
                      </strong>
                      <br />
                      <small>{item.stop.destinationArea}</small>
                    </td>
                    <td>
                      <span
                        className={`pod-status ${
                          item.stop.podSubmitted ? "attached" : "missing"
                        }`}
                      >
                        <i aria-hidden="true" />
                        {item.stop.podSubmitted ? "Submitted" : "Missing"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`pod-status ${
                          item.stop.supportingDocsComplete ? "attached" : "missing"
                        }`}
                      >
                        <i aria-hidden="true" />
                        {item.stop.supportingDocsComplete ? "Complete" : "Incomplete"}
                      </span>
                    </td>
                    <td>{item.stop.documentRef}</td>
                    <td>
                      {canVerify ? (
                        <button
                          type="button"
                          className="filter-button"
                          disabled={updatingStopId === item.stop.id}
                          onClick={() => toggleStopVerification(item)}
                        >
                          {updatingStopId === item.stop.id
                            ? "Updating…"
                            : item.isComplete
                              ? "Mark Follow-up"
                              : "Verify Complete"}
                        </button>
                      ) : (
                        <span className="settings-readonly-pill">View-Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </section>
      </div>
    </>
  );
}

