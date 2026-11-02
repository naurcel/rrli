import assert from "node:assert/strict";
import test from "node:test";

import {
  hasPermission,
  type Permission,
} from "./rbac.ts";
import {
  findServerAccountById,
  updateServerAccountProfile,
  verifyServerAccountCredentials,
} from "./server-account-store.ts";
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from "./session-token.ts";

function evaluateDirectServerRequest(
  rawSessionToken: string | undefined,
  requiredPermission: Permission,
): { ok: true; role: string } | { ok: false; status: 401 | 403; code: string } {
  const payload = verifySignedSessionToken(rawSessionToken);
  if (!payload) {
    return { ok: false, status: 401, code: "UNAUTHENTICATED" };
  }
  const account = findServerAccountById(payload.sub);
  if (!account || !account.isActive) {
    return { ok: false, status: 401, code: "UNAUTHENTICATED" };
  }
  if (!hasPermission(account.role, requiredPermission)) {
    return { ok: false, status: 403, code: "FORBIDDEN" };
  }
  return { ok: true, role: account.role };
}

test("signs and verifies HMAC-SHA256 session tokens and rejects tampering or expiry", () => {
  const secret = "unit-test-hmac-secret";
  const now = 1_700_000_000_000;

  const token = createSignedSessionToken(
    {
      userId: "usr-admin-001",
      rememberMe: true,
      nowMs: now,
      durationMs: 60_000,
    },
    secret,
  );

  const valid = verifySignedSessionToken(token, {
    nowMs: now + 30_000,
    secretOverride: secret,
  });
  assert.ok(valid);
  assert.equal(valid.sub, "usr-admin-001");
  assert.equal(valid.rem, true);

  // Expired token must be rejected
  const expired = verifySignedSessionToken(token, {
    nowMs: now + 61_000,
    secretOverride: secret,
  });
  assert.equal(expired, null);

  // Wrong secret / tampered signature must be rejected
  const wrongSecret = verifySignedSessionToken(token, {
    nowMs: now + 1_000,
    secretOverride: "different-secret",
  });
  assert.equal(wrongSecret, null);

  // Tampered payload must be rejected
  const [, sig] = token.split(".");
  const forgedPayload = Buffer.from(
    JSON.stringify({ sub: "usr-forged", iat: now, exp: now + 60_000, rem: true }),
    "utf8",
  ).toString("base64url");
  assert.equal(
    verifySignedSessionToken(`${forgedPayload}.${sig}`, {
      nowMs: now + 1_000,
      secretOverride: secret,
    }),
    null,
  );
});

test("verifies server account credentials across Admin, Operations, and View-Only roles", () => {
  const adminAuth = verifyServerAccountCredentials("admin@routex.local", "admin");
  assert.equal(adminAuth.ok, true);
  if (adminAuth.ok) {
    assert.equal(adminAuth.profile.role, "admin");
  }

  const opsAuth = verifyServerAccountCredentials("operations@routex.local", "operations");
  assert.equal(opsAuth.ok, true);
  if (opsAuth.ok) {
    assert.equal(opsAuth.profile.role, "operations");
  }

  const financeAuth = verifyServerAccountCredentials("finance@routex.local", "finance");
  assert.equal(financeAuth.ok, true);
  if (financeAuth.ok) {
    assert.equal(financeAuth.profile.role, "finance");
  }

  const badPassword = verifyServerAccountCredentials("admin@routex.local", "wrong-password");
  assert.equal(badPassword.ok, false);
});

test("rejects direct mutation requests from all View-Only roles with 403 Forbidden and enforces deactivation", () => {
  // 1. Unauthenticated direct request -> 401
  assert.deepEqual(evaluateDirectServerRequest(undefined, "deliveries:view"), {
    ok: false,
    status: 401,
    code: "UNAUTHENTICATED",
  });

  // 2. View-Only roles (Finance, HR, Secretary, Customer Rep) can view but are blocked (403) on direct mutations
  const viewOnlyAccounts = [
    { email: "finance@routex.local", password: "finance" },
    { email: "hr@routex.local", password: "humanresources" },
    { email: "secretary@routex.local", password: "secretary" },
    { email: "csrep@routex.local", password: "customerrep" },
  ];
  const restrictedMutations: Permission[] = [
    "deliveries:create",
    "deliveries:edit",
    "dropoffs:manage",
    "imports:upload",
    "imports:review_confirm",
    "pod:verify",
    "users:manage",
  ];

  for (const { email, password } of viewOnlyAccounts) {
    const login = verifyServerAccountCredentials(email, password);
    assert.equal(login.ok, true);
    if (!login.ok) continue;

    const token = createSignedSessionToken({
      userId: login.profile.id,
      rememberMe: false,
    });

    // View permissions succeed
    assert.equal(evaluateDirectServerRequest(token, "deliveries:view").ok, true);
    assert.equal(evaluateDirectServerRequest(token, "profitability:view").ok, true);

    // Every restricted mutation returns 403 FORBIDDEN on the server
    for (const perm of restrictedMutations) {
      const result = evaluateDirectServerRequest(token, perm);
      assert.deepEqual(result, {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
      });
    }
  }

  // 3. Operations role can mutate deliveries, imports, and PODs, but is blocked (403) from User Management
  const opsLogin = verifyServerAccountCredentials("operations@routex.local", "operations");
  assert.equal(opsLogin.ok, true);
  if (opsLogin.ok) {
    const opsToken = createSignedSessionToken({
      userId: opsLogin.profile.id,
      rememberMe: true,
    });
    assert.equal(evaluateDirectServerRequest(opsToken, "deliveries:create").ok, true);
    assert.equal(evaluateDirectServerRequest(opsToken, "imports:upload").ok, true);
    assert.equal(evaluateDirectServerRequest(opsToken, "pod:verify").ok, true);
    assert.deepEqual(evaluateDirectServerRequest(opsToken, "users:manage"), {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
    });
  }

  // 4. Deactivated user session token is immediately invalidated on the server (401)
  updateServerAccountProfile({ userId: "usr-csr-006", isActive: false });
  try {
    const csrToken = createSignedSessionToken({
      userId: "usr-csr-006",
      rememberMe: true,
    });
    assert.deepEqual(evaluateDirectServerRequest(csrToken, "deliveries:view"), {
      ok: false,
      status: 401,
      code: "UNAUTHENTICATED",
    });
  } finally {
    updateServerAccountProfile({ userId: "usr-csr-006", isActive: true });
  }
});


