import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAnonymousAccess, ToolScopes } from "./scopes.js";

/** HTTP with auth disabled and the write opt-in off — the 1.5.0 default shape. */
const httpOpen = {
  httpMode: true,
  authEnabled: false,
  allowSharedCredentialWrites: false,
  hasSharedCredentials: true,
} as const;

test("HTTP without auth and without the opt-in stays read-only (1.5.0 behaviour)", () => {
  const access = resolveAnonymousAccess(httpOpen);
  assert.deepEqual(access.scopes, [ToolScopes.READ]);
  assert.equal(access.notice, "read_only");
});

test("opt-in without shared credentials fails closed to read-only", () => {
  const access = resolveAnonymousAccess({
    ...httpOpen,
    allowSharedCredentialWrites: true,
    hasSharedCredentials: false,
  });
  assert.deepEqual(access.scopes, [ToolScopes.READ]);
  assert.equal(access.notice, "opt_in_no_credentials");
});

test("opt-in with shared credentials leaves anonymous access unrestricted", () => {
  const access = resolveAnonymousAccess({ ...httpOpen, allowSharedCredentialWrites: true });
  assert.equal(access.scopes, undefined); // undefined = no scope gating (same as stdio)
  assert.equal(access.notice, "opt_in_active");
});

test("opt-in is ignored (and reported) when per-user auth is enabled", () => {
  const access = resolveAnonymousAccess({ ...httpOpen, authEnabled: true, allowSharedCredentialWrites: true });
  assert.equal(access.scopes, undefined);
  assert.equal(access.notice, "opt_in_ignored_auth_enabled");
});

test("auth enabled without the opt-in is silent", () => {
  const access = resolveAnonymousAccess({ ...httpOpen, authEnabled: true });
  assert.equal(access.scopes, undefined);
  assert.equal(access.notice, "none");
});

test("stdio is unrestricted and silent, opt-in or not", () => {
  for (const allowSharedCredentialWrites of [false, true]) {
    const access = resolveAnonymousAccess({ ...httpOpen, httpMode: false, allowSharedCredentialWrites });
    assert.equal(access.scopes, undefined);
    assert.equal(access.notice, "none");
  }
});
