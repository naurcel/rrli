import assert from "node:assert/strict";
import test from "node:test";

import {
  getDeliveryDateWindow,
  validateDeliveryDateWindow,
} from "./delivery-recording-policy.ts";

const reference = new Date("2026-11-05T03:00:00.000Z");

test("delivery recording window includes today and the previous two calendar dates", () => {
  assert.deepEqual(getDeliveryDateWindow(reference), {
    min: "2026-11-03",
    max: "2026-11-05",
  });
  assert.deepEqual(validateDeliveryDateWindow("2026-11-05", reference), {
    ok: true,
    isLate: false,
  });
  assert.deepEqual(validateDeliveryDateWindow("2026-11-03", reference), {
    ok: true,
    isLate: true,
  });
});

test("delivery recording window rejects future and older dates for non-admins", () => {
  assert.equal(validateDeliveryDateWindow("2026-11-02", reference).ok, false);
  assert.equal(validateDeliveryDateWindow("2026-11-06", reference).ok, false);
  assert.equal(validateDeliveryDateWindow("2026-10-01", reference, "operations").ok, false);
});

test("admin role can record deliveries with no date range restriction", () => {
  assert.deepEqual(validateDeliveryDateWindow("2026-01-01", reference, "admin"), {
    ok: true,
    isLate: true,
  });
  assert.deepEqual(validateDeliveryDateWindow("2026-11-05", reference, "admin"), {
    ok: true,
    isLate: false,
  });
  assert.deepEqual(validateDeliveryDateWindow("2026-12-01", reference, "admin"), {
    ok: true,
    isLate: false,
  });
  assert.equal(validateDeliveryDateWindow("not-a-date", reference, "admin").ok, false);
});
