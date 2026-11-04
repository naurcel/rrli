import "server-only";

export type AuditEntry = {
  id: string;
  occurredAt: string;
  actorId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  changes?: Record<string, unknown>;
};

const INITIAL_AUDIT_ENTRIES: readonly AuditEntry[] = [
  {
    id: "aud-0012",
    occurredAt: "2026-10-31T15:20:00.000Z",
    actorId: "usr-oper-01",
    actorEmail: "operations@routex.local",
    action: "delivery.financials_corrected",
    entityType: "delivery",
    entityId: "40000000-0000-4000-8000-000000000002",
    summary: "Audited financial correction: adjusted toll gate receipts to match physical RFID slip.",
    changes: { tollGateExpenses: 1600, previousToll: 1750, version: 2 },
  },
  {
    id: "aud-0011",
    occurredAt: "2026-10-30T10:30:00.000Z",
    actorId: "usr-admin-01",
    actorEmail: "admin@routex.local",
    action: "user.created",
    entityType: "user",
    entityId: "usr-fin-01",
    summary: "Provisioned view-only account for Finance Officer.",
    changes: { role: "finance", email: "finance@routex.local", isActive: true },
  },
  {
    id: "aud-0010",
    occurredAt: "2026-10-29T09:00:00.000Z",
    actorId: "usr-oper-01",
    actorEmail: "operations@routex.local",
    action: "delivery.created",
    entityType: "delivery",
    entityId: "40000000-0000-4000-8000-000000000003",
    summary: "Recorded subcontracted delivery WB-261029 for MCCI (BCD 8642).",
    changes: { clientName: "MCCI", plateNumber: "BCD 8642", truckOwnership: "Subcontracted", deliveryRate: 6325 },
  },
  {
    id: "aud-0009",
    occurredAt: "2026-10-28T18:00:00.000Z",
    actorId: "usr-oper-01",
    actorEmail: "operations@routex.local",
    action: "delivery.created",
    entityType: "delivery",
    entityId: "40000000-0000-4000-8000-000000000007",
    summary: "Recorded completed delivery WB-261032 for Landers (Arcovia).",
    changes: { clientName: "Landers", plateNumber: "CBL 4412", deliveryRate: 16000 },
  },
  {
    id: "aud-0008",
    occurredAt: "2026-10-28T16:45:00.000Z",
    actorId: "usr-oper-01",
    actorEmail: "operations@routex.local",
    action: "delivery.financials_finalized",
    entityType: "delivery",
    entityId: "40000000-0000-4000-8000-000000000002",
    summary: "Finalized trip financials for delivery WB-261028.",
    changes: { financialState: "finalized", netIncome: 19100, marginPercent: 68.2 },
  },
  {
    id: "aud-0007",
    occurredAt: "2026-10-28T08:15:00.000Z",
    actorId: "usr-oper-01",
    actorEmail: "operations@routex.local",
    action: "delivery.created",
    entityType: "delivery",
    entityId: "40000000-0000-4000-8000-000000000002",
    summary: "Recorded completed multi-store delivery WB-261028 for Landers (Alabang & Vermosa).",
    changes: { clientName: "Landers", plateNumber: "NBM 3012", deliveryRate: 28000 },
  },
  {
    id: "aud-0006",
    occurredAt: "2026-10-27T17:00:00.000Z",
    actorId: "usr-oper-01",
    actorEmail: "operations@routex.local",
    action: "delivery.financials_finalized",
    entityType: "delivery",
    entityId: "40000000-0000-4000-8000-000000000001",
    summary: "Finalized trip financials for delivery WB-261027.",
    changes: { financialState: "finalized", netIncome: 15300, marginPercent: 63.8 },
  },
  {
    id: "aud-0005",
    occurredAt: "2026-10-27T14:30:00.000Z",
    actorId: "usr-oper-01",
    actorEmail: "operations@routex.local",
    action: "document.uploaded",
    entityType: "delivery",
    entityId: "40000000-0000-4000-8000-000000000001",
    summary: "Uploaded POD receiving slip for Stop #1 (Landers BGC).",
    changes: { filename: "SAMPLE-POD-LND-01.pdf" },
  },
  {
    id: "aud-0004",
    occurredAt: "2026-10-27T08:00:00.000Z",
    actorId: "usr-oper-01",
    actorEmail: "operations@routex.local",
    action: "delivery.created",
    entityType: "delivery",
    entityId: "40000000-0000-4000-8000-000000000001",
    summary: "Recorded completed delivery WB-261027 for Landers.",
    changes: { clientName: "Landers", plateNumber: "NGS 4281", origin: "Calamba Hub", deliveryRate: 24000 },
  },
  {
    id: "aud-0003",
    occurredAt: "2026-10-27T07:45:00.000Z",
    actorId: "usr-admin-01",
    actorEmail: "admin@routex.local",
    action: "truck.created",
    entityType: "truck",
    entityId: "XCY 6612",
    summary: "Registered owned fleet asset XCY 6612 (4-Wheeler).",
    changes: { plateNumber: "XCY 6612", truckType: "4-Wheeler", ownershipType: "Owned", rateBasis: "Redeemed Rate" },
  },
  {
    id: "aud-0002",
    occurredAt: "2026-10-27T07:30:00.000Z",
    actorId: "usr-admin-01",
    actorEmail: "admin@routex.local",
    action: "truck.created",
    entityType: "truck",
    entityId: "NGS 4281",
    summary: "Registered owned fleet asset NGS 4281 (6-Wheeler).",
    changes: { plateNumber: "NGS 4281", truckType: "6-Wheeler", ownershipType: "Owned", rateBasis: "Redeemed Rate" },
  },
  {
    id: "aud-0001",
    occurredAt: "2026-10-27T06:15:00.000Z",
    actorId: "usr-admin-01",
    actorEmail: "admin@routex.local",
    action: "system.bootstrap",
    entityType: "system",
    entityId: "routex-core",
    summary: "RouteX operations platform initialized with RBAC security policies.",
    changes: { roles: ["admin", "operations", "finance", "hr", "secretary", "customer_representative"] },
  },
];

const auditGlobal = globalThis as typeof globalThis & { __routexAuditEntries?: AuditEntry[] };
const entries = auditGlobal.__routexAuditEntries ?? [...INITIAL_AUDIT_ENTRIES];
auditGlobal.__routexAuditEntries = entries;

export function recordAuditEntry(input: Omit<AuditEntry, "id" | "occurredAt">): AuditEntry {
  const entry: AuditEntry = { ...input, id: `aud-${crypto.randomUUID().slice(0, 8)}`, occurredAt: new Date().toISOString() };
  entries.unshift(entry);
  if (entries.length > 500) entries.length = 500;
  return entry;
}

export function listAuditEntries(): readonly AuditEntry[] {
  return entries;
}
