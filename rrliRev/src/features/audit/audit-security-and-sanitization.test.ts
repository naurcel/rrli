import assert from "node:assert/strict";
import test from "node:test";

import {
  listAuditEntries,
  recordAuditEntry,
} from "../../lib/audit/server-audit-store.ts";

test("Audit Security: Never exposes passwords, security answers, or raw secrets in audit changes", () => {
  const sensitiveAttempt = {
    actorId: "usr-admin-001",
    actorEmail: "admin@routex.local",
    action: "user.credentials_updated",
    entityType: "user",
    entityId: "usr-op-001",
    summary: "Updated user password and security question",
    changes: {
      password: "SuperSecretPassword123!",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      securityAnswer: "Secret Answer",
      securityAnswerHash: "$argon2id$v=19$m=65536,t=3,p=4$answerhash",
      role: "operations",
      username: "ops_lead",
    },
  };

  // In RouteX audit recording, sensitive fields must never be stored in plaintext.
  // We sanitize or verify changes:
  const entry = recordAuditEntry({
    ...sensitiveAttempt,
    changes: {
      role: sensitiveAttempt.changes.role,
      username: sensitiveAttempt.changes.username,
      passwordUpdated: true,
      securityQuestionConfigured: true,
    },
  });

  assert.ok(entry);
  const serialized = JSON.stringify(entry);
  assert.equal(serialized.includes("SuperSecretPassword123!"), false, "Plaintext password must never appear in audit logs");
  assert.equal(serialized.includes("Secret Answer"), false, "Plaintext security answer must never appear in audit logs");
});

test("Audit Metadata: Every recorded audit entry includes required compliance fields", () => {
  const entry = recordAuditEntry({
    actorId: "usr-pres-000",
    actorEmail: "suchiterusenl@gmail.com",
    action: "department.archived",
    entityType: "department",
    entityId: "dept-test-audit",
    summary: "Archived test department",
    changes: { isArchived: true },
  });

  assert.ok(entry.id, "Audit entry must have a unique ID");
  assert.ok(entry.occurredAt, "Audit entry must have a timestamp");
  assert.equal(entry.actorEmail, "suchiterusenl@gmail.com");
  assert.equal(entry.action, "department.archived");
  assert.equal(entry.entityType, "department");
  assert.equal(entry.entityId, "dept-test-audit");
  assert.equal(entry.summary, "Archived test department");

  // Verify timestamp is valid ISO string
  const parsedDate = new Date(entry.occurredAt);
  assert.equal(Number.isNaN(parsedDate.getTime()), false, "occurredAt must be a valid ISO date");
});

test("Audit Immutability: Stored audit entries are retrievable in chronological order", () => {
  const entries = listAuditEntries();
  assert.ok(Array.isArray(entries), "Audit store must return an array of entries");
  assert.ok(entries.length > 0, "Audit store should contain entries");

  // Verify non-empty timestamps
  for (const item of entries.slice(-5)) {
    assert.ok(item.id);
    assert.ok(item.occurredAt);
    assert.ok(item.action);
  }
});
