"use client";

import { useMemo, useState } from "react";

import { isDateInRange, useGlobalDateRange } from "@/components/global-date-range-picker";
import { RecordDetailDrawer, type RecordDetailSection } from "@/components/record-detail-drawer";
import { RoundedSelect } from "@/components/rounded-select";
import { Icon } from "@/components/route-x-ui";
import { getNextSortState, SortableTableHeader, type SortState } from "@/components/sortable-table-header";
import { auditPreviewEvents, type AuditEvent } from "@/features/audit/audit-preview-data";

type AuditSortKey = Exclude<keyof AuditEvent, "details">;

const outcomes = ["All outcomes", ...Array.from(new Set(auditPreviewEvents.map((event) => event.outcome)))];
const areas = ["All areas", ...Array.from(new Set(auditPreviewEvents.map((event) => event.area)))];
const actors = ["All actors", ...Array.from(new Set(auditPreviewEvents.map((event) => event.actor)))];
const actions = ["All actions", ...Array.from(new Set(auditPreviewEvents.map((event) => event.action)))];

function compareAuditEvents(left: AuditEvent, right: AuditEvent, key: AuditSortKey) {
  if (key === "occurredAt") return Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
  return left[key].localeCompare(right[key], undefined, { numeric: true, sensitivity: "base" });
}

function statusTone(outcome: AuditEvent["outcome"]) {
  return outcome === "Local only" ? "warning" : "success";
}

function getAuditSections(event: AuditEvent): RecordDetailSection[] {
  return [
    { title: "Event", fields: [{ label: "Event ID", value: event.id }, { label: "Occurred", value: event.occurredAt }, { label: "Actor", value: event.actor }, { label: "Outcome", value: event.outcome, tone: statusTone(event.outcome) }] },
    { title: "Context", fields: [{ label: "Area", value: event.area }, { label: "Action", value: event.action }, { label: "Record", value: event.subject }], note: event.details },
    { title: "Audit boundary", note: "This is local sample activity for interface review. It is not an immutable, retained, or server-authorized audit record." },
  ];
}

export function AuditTrailPreview() {
  const { range } = useGlobalDateRange();
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("All outcomes");
  const [areaFilter, setAreaFilter] = useState("All areas");
  const [actorFilter, setActorFilter] = useState("All actors");
  const [actionFilter, setActionFilter] = useState("All actions");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [sort, setSort] = useState<SortState<AuditSortKey>>({ key: null, direction: "desc" });
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const hasAdvancedFilters = actorFilter !== "All actors" || actionFilter !== "All actions";
  const events = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = auditPreviewEvents.filter((event) => {
      const matchesQuery = !normalized || Object.values(event).some((value) => value.toLowerCase().includes(normalized));
      return matchesQuery
        && (outcomeFilter === "All outcomes" || event.outcome === outcomeFilter)
        && (areaFilter === "All areas" || event.area === areaFilter)
        && (actorFilter === "All actors" || event.actor === actorFilter)
        && (actionFilter === "All actions" || event.action === actionFilter)
        && isDateInRange(event.occurredAt, range);
    });
    if (!sort.key) return filtered;
    return [...filtered].sort((left, right) => compareAuditEvents(left, right, sort.key!) * (sort.direction === "asc" ? 1 : -1));
  }, [actionFilter, actorFilter, areaFilter, outcomeFilter, query, range, sort]);

  const clearAdvancedFilters = () => {
    setActorFilter("All actors");
    setActionFilter("All actions");
  };

  return <section className="administration-audit" id="audit-trail" aria-labelledby="audit-trail-heading">
    <div className="section-intro"><div><h2 id="audit-trail-heading">Audit trail</h2><p>Review local activity while the production audit policy is still pending.</p></div></div>
    <div className="notice audit-notice" role="status"><span className="notice-icon">i</span><div><strong>Local activity only</strong><span>These sample events are not retained, immutable, or connected to server-side authorization. Audit event schema and retention require approval.</span></div></div>
    <section className="records-card audit-records">
      <div className="records-heading"><div><h2>Activity events</h2><p>Filter sample events, sort a column, or select a row for its available context.</p></div></div>
      <div className="filters">
        <label className="search-box"><Icon>⌕</Icon><input aria-label="Search audit events" placeholder="Search by event, actor, area, action, or record" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <RoundedSelect ariaLabel="Filter audit events by outcome" options={outcomes} value={outcomeFilter} onChange={setOutcomeFilter} />
        <RoundedSelect ariaLabel="Filter audit events by area" options={areas} value={areaFilter} onChange={setAreaFilter} />
        <div className="more-filters-control">
          <button className="filter-button" type="button" aria-expanded={showMoreFilters} onClick={() => setShowMoreFilters((visible) => !visible)}><Icon>≡</Icon> More filters</button>
          {showMoreFilters && <div className="more-filters-popover"><span>Refine by</span><RoundedSelect ariaLabel="Filter audit events by actor" options={actors} value={actorFilter} onChange={setActorFilter} /><RoundedSelect ariaLabel="Filter audit events by action" options={actions} value={actionFilter} onChange={setActionFilter} /></div>}
        </div>
        {hasAdvancedFilters && <button className="filter-button filter-clear" type="button" onClick={clearAdvancedFilters}>Clear filters</button>}
      </div>
      <div className="table-wrap"><table><thead><tr><SortableTableHeader column="occurredAt" label="Occurred" sort={sort} onSort={(column) => setSort((current) => getNextSortState(current, column))} /><SortableTableHeader column="actor" label="Actor" sort={sort} onSort={(column) => setSort((current) => getNextSortState(current, column))} /><SortableTableHeader column="area" label="Area" sort={sort} onSort={(column) => setSort((current) => getNextSortState(current, column))} /><SortableTableHeader column="action" label="Action" sort={sort} onSort={(column) => setSort((current) => getNextSortState(current, column))} /><SortableTableHeader column="subject" label="Record" sort={sort} onSort={(column) => setSort((current) => getNextSortState(current, column))} /><SortableTableHeader column="outcome" label="Outcome" sort={sort} onSort={(column) => setSort((current) => getNextSortState(current, column))} /></tr></thead><tbody>{events.map((event) => <tr className="record-row" tabIndex={0} role="button" aria-label={`View ${event.id} audit event details`} key={event.id} onClick={() => setSelectedEvent(event)} onKeyDown={(keyboardEvent) => { if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") { keyboardEvent.preventDefault(); setSelectedEvent(event); } }}><td className="record-link">{event.occurredAt}</td><td>{event.actor}</td><td>{event.area}</td><td>{event.action}</td><td>{event.subject}</td><td><span className={`pod-status ${statusTone(event.outcome) === "warning" ? "missing" : "attached"}`}><i />{event.outcome}</span></td></tr>)}</tbody></table>{events.length === 0 && <div className="empty-state"><strong>No sample events found</strong><span>Try a different date range or audit filter.</span></div>}</div>
      <div className="table-footer"><span>{events.length} of {auditPreviewEvents.length} sample events {sort.key ? `· sorted by ${sort.key} ${sort.direction === "asc" ? "ascending" : "descending"}` : "· default newest-first order"}</span><div className="pagination"><button disabled aria-label="Previous page">‹</button><span>1</span><button disabled aria-label="Next page">›</button></div></div>
    </section>
    <p className="scope-note"><span>●</span> Local audit trail only · Production capture, tamper resistance, access control, export, and retention are intentionally unavailable.</p>
    <RecordDetailDrawer record={selectedEvent ? { title: selectedEvent.id, subtitle: "AUDIT EVENT", status: { label: selectedEvent.outcome, tone: statusTone(selectedEvent.outcome) }, sections: getAuditSections(selectedEvent) } : null} onClose={() => setSelectedEvent(null)} />
  </section>;
}
