import assert from "node:assert/strict";
import test from "node:test";

import { AppError, toPublicErrorPayload } from "./app-error.ts";

test("toPublicErrorPayload exposes an intentional client-safe error", () => {
  const payload = toPublicErrorPayload(
    new AppError("VALIDATION_FAILED", "Review the submitted fields.", 400),
    "request-123",
  );

  assert.deepEqual(payload, {
    error: {
      code: "VALIDATION_FAILED",
      message: "Review the submitted fields.",
      requestId: "request-123",
    },
  });
});

test("toPublicErrorPayload redacts unexpected error details", () => {
  const payload = toPublicErrorPayload(
    new Error("database password was accidentally included"),
  );

  assert.deepEqual(payload, {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again.",
    },
  });
  assert.doesNotMatch(payload.error.message, /password/);
});

test("server errors are redacted unless explicitly marked safe", () => {
  const payload = toPublicErrorPayload(
    new AppError("CONFIGURATION_ERROR", "Missing internal setting.", 500),
  );

  assert.equal(payload.error.code, "INTERNAL_ERROR");
  assert.doesNotMatch(payload.error.message, /setting/i);
});
