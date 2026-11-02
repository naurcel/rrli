import assert from "node:assert/strict";
import test from "node:test";

import {
  hasValidPreviewCredentials,
  isPreviewSession,
} from "./preview-session.ts";

test("temporary preview credentials accept only the documented preview account", () => {
  assert.equal(hasValidPreviewCredentials("admin", "admin"), true);
  assert.equal(hasValidPreviewCredentials("admin", "incorrect"), false);
  assert.equal(hasValidPreviewCredentials("other", "admin"), false);
});

test("temporary preview session check rejects arbitrary cookie values", () => {
  assert.equal(isPreviewSession("routex-preview-ui-v1"), true);
  assert.equal(isPreviewSession("invalid"), false);
  assert.equal(isPreviewSession(undefined), false);
});
