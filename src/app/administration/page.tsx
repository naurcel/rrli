"use client";

import { useMemo, useState } from "react";

import { AuditTrailPreview } from "@/components/audit-trail-preview";
import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RecordDetailDrawer, type RecordDetailSection } from "@/components/record-detail-drawer";
import { RoundedSelect } from "@/components/rounded-select";
import { Icon } from "@/components/route-x-ui";
import { getNextSortState, SortableTableHeader, type SortState } from "@/components/sortable-table-header";

type WorkspaceMember = { name: string; department: string; status: "Active" | "Pending" };
type MemberSortKey = keyof WorkspaceMember;

const workspaceMembers: WorkspaceMember[] = [
  { name: "Shinryu", department: "Admin", status: "Active" },
  { name: "Marc Rancel", department: "Finance", status: "Active" },
  { name: "Azula Joy", department: "Operations", status: "Pending" },
  { name: "Jelene Punongbayan", department: "Operations", status: "Pending" },
  { name: "Zean Kurt", department: "HR", status: "Pending" },
];

const memberStatuses = ["All statuses", ...Array.from(new Set(workspaceMembers.map((member) => member.status)))];
const memberDepartments = ["All departments", ...Array.from(new Set(workspaceMembers.map((member) => member.department)))];

function getMemberSections(member: WorkspaceMember): RecordDetailSection[] {
  return [
    { title: "Workspace member", fields: [{ label: "Name", value: member.name }, { label: "Department", value: member.department }, { label: "Access status", value: member.status, tone: member.status === "Pending" ? "warning" : "success" }] },
    { title: "Access readiness", note: "Member updates, invitations, permission enforcement, and account lifecycle controls remain unavailable until the approved access boundary is connected." },
  ];
}

export default function AdministrationPage() {
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [sort, setSort] = useState<SortState<MemberSortKey>>({ key: null, direction: "desc" });
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null);
  const filteredMembers = useMemo(() => {
    const filtered = workspaceMembers.filter((member) => (statusFilter === "All statuses" || member.status === statusFilter) && (departmentFilter === "All departments" || member.department === departmentFilter));
    if (!sort.key) return filtered;
    return [...filtered].sort((left, right) => left[sort.key!].localeCompare(right[sort.key!], undefined, { sensitivity: "base" }) * (sort.direction === "asc" ? 1 : -1));
  }, [departmentFilter, sort, statusFilter]);

  return <div className="app-shell">
    <OperationalSidebar />
    <main className="main-content">
      <OperationalTopbar />
      <div className="content-wrap">
        <section className="page-intro">
          <div><h1>Administration</h1><p className="subtitle">Review workspace members, departments, access readiness, and local activity.</p></div>
          <button className="secondary-button" disabled><Icon>＋</Icon> Invite member <span className="lock">◌</span></button>
        </section>
        <div className="notice" role="status"><span className="notice-icon">i</span><div><strong>Local data only</strong><span>Authentication and authorization controls are unavailable until the approved access boundary is finalized.</span></div></div>
        <section className="records-card">
          <div className="records-heading"><div><h2>Workspace members</h2><p>Filter and sort local members; access controls remain unavailable.</p></div></div>
          <div className="filters member-filters"><RoundedSelect ariaLabel="Filter workspace members by status" options={memberStatuses} value={statusFilter} onChange={setStatusFilter} /><RoundedSelect ariaLabel="Filter workspace members by department" options={memberDepartments} value={departmentFilter} onChange={setDepartmentFilter} />{(statusFilter !== "All statuses" || departmentFilter !== "All departments") && <button className="filter-button filter-clear" type="button" onClick={() => { setStatusFilter("All statuses"); setDepartmentFilter("All departments"); }}>Clear filters</button>}</div>
          <div className="table-wrap"><table><thead><tr><SortableTableHeader column="name" label="Member" sort={sort} onSort={(column) => setSort((current) => getNextSortState(current, column))} /><SortableTableHeader column="department" label="Department" sort={sort} onSort={(column) => setSort((current) => getNextSortState(current, column))} /><SortableTableHeader column="status" label="Status" sort={sort} onSort={(column) => setSort((current) => getNextSortState(current, column))} /></tr></thead><tbody>{filteredMembers.map((member) => <tr className="record-row" tabIndex={0} role="button" aria-label={`View ${member.name} details`} key={member.name} onClick={() => setSelectedMember(member)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedMember(member); } }}><td className="record-link">{member.name}</td><td>{member.department}</td><td><span className={`pod-status ${member.status === "Pending" ? "missing" : "attached"}`}><i />{member.status}</span></td></tr>)}</tbody></table>{filteredMembers.length === 0 && <div className="empty-state"><strong>No members found</strong><span>Try a different member filter.</span></div>}</div>
          <div className="table-footer"><span>{filteredMembers.length} local members {sort.key ? `· sorted by ${sort.key} ${sort.direction === "asc" ? "ascending" : "descending"}` : "· default workspace order"}</span><div className="pagination"><button disabled aria-label="Previous page">‹</button><span>1</span><button disabled aria-label="Next page">›</button></div></div>
        </section>
        <AuditTrailPreview />
        <p className="scope-note"><span>●</span> Access data is local only · Invites, member updates, and permission enforcement are intentionally unavailable.</p>
      </div>
    </main>
    <RecordDetailDrawer record={selectedMember ? { title: selectedMember.name, subtitle: "WORKSPACE MEMBER", status: { label: selectedMember.status, tone: selectedMember.status === "Pending" ? "warning" : "success" }, sections: getMemberSections(selectedMember) } : null} onClose={() => setSelectedMember(null)} />
  </div>;
}
