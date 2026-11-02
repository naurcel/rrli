import assert from "node:assert/strict";
import test from "node:test";

import { auditPreviewEvents } from "./audit-preview-data.ts";

test("audit preview events have unique identifiers and parseable timestamps", () => {
  assert.equal(new Set(auditPreviewEvents.map((event) => event.id)).size, auditPreviewEvents.length);
  assert.ok(auditPreviewEvents.every((event) => Number.isFinite(Date.parse(event.occurredAt))));
});
