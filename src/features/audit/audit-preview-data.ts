export type AuditEvent = {
  id: string;
  occurredAt: string;
  actor: string;
  area: "Authentication" | "Deliveries" | "Fleet" | "Transactions" | "Administration";
  action: string;
  subject: string;
  outcome: "Recorded" | "Local only" | "Preview only";
  details: string;
};

export const auditPreviewEvents: readonly AuditEvent[] = [
  { id: "AUD-0105", occurredAt: "Oct 29, 2026, 10:24 AM", actor: "Shinryu", area: "Deliveries", action: "Opened record", subject: "DLV-0248", outcome: "Recorded", details: "Opened the completed-delivery detail record." },
  { id: "AUD-0104", occurredAt: "Oct 29, 2026, 10:16 AM", actor: "Shinryu", area: "Fleet", action: "Viewed vehicle", subject: "NGS 4281", outcome: "Recorded", details: "Viewed the owned-truck profile." },
  { id: "AUD-0103", occurredAt: "Oct 29, 2026, 9:58 AM", actor: "Shinryu", area: "Transactions", action: "Applied filter", subject: "Posted transactions", outcome: "Local only", details: "Changed a local filter; this is not persisted." },
  { id: "AUD-0102", occurredAt: "Oct 29, 2026, 9:45 AM", actor: "Shinryu", area: "Authentication", action: "Signed in", subject: "Temporary workspace", outcome: "Local only", details: "Temporary access was used. Provider-backed authentication is not connected." },
  { id: "AUD-0101", occurredAt: "Oct 28, 2026, 5:32 PM", actor: "Marc Rancel", area: "Administration", action: "Viewed members", subject: "Workspace members", outcome: "Recorded", details: "Reviewed the workspace-member table." },
  { id: "AUD-0100", occurredAt: "Oct 28, 2026, 4:18 PM", actor: "Alex Morgan", area: "Fleet", action: "Opened assignment", subject: "MMC 6667", outcome: "Recorded", details: "Opened the subcontracted-truck assignment." },
] as const;
