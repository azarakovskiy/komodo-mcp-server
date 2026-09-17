/**
 * Tool Scopes
 *
 * Three-tier RBAC scope strings attached to every tool via `requiredScopes`.
 * The MCP-Server-Framework filters tools/resources/prompts based on the
 * authenticated session's `AuthContext.permissions` using a subset check
 * (`hasAllRequiredScopes`).
 *
 * **Active**: When MCP OAuth 2.1 is configured, `mapUserInfo` in `src/index.ts`
 * grants all three scopes to every authenticated user. Komodo enforces
 * fine-grained permissions server-side; these scopes act as a coarse pre-screen.
 *
 * **Tier semantics** (lowest sufficient tier per tool):
 * - `komodo:read`     — read-only operations (list, info, inspect, logs, stats, health)
 * - `komodo:operate`  — lifecycle operations (`*_action` tools)
 * - `komodo:admin`    — destructive / structural changes (create, update, delete, prune, exec)
 *
 * Tier inclusion (admin > operate > read) is **not** enforced by the
 * framework — it must be expressed by the IdP (e.g. an `admin` user gets
 * all three scopes in the token), or by a future scope-expansion helper.
 *
 * @module config/scopes
 */

export const ToolScopes = {
  READ: "komodo:read",
  OPERATE: "komodo:operate",
  ADMIN: "komodo:admin",
} as const;

export type ToolScope = (typeof ToolScopes)[keyof typeof ToolScopes];

// ============================================================================
// Anonymous-access decision
// ============================================================================

/**
 * Anonymous-access decision for one server run: the scopes anonymous callers get,
 * plus the startup notice that spells out what index.ts should log and audit.
 *
 * `scopes: undefined` means **no scope gating at all** — the framework then skips both
 * the `tools/list` scope filter and call-time scope enforcement (it treats an absent
 * `anonymousScopes` as "unrestricted anonymous"), which is the behaviour stdio has always
 * had. `[READ]` instead hides and rejects every operate/admin tool.
 */
export type AnonymousAccessNotice =
  | "none" // nothing to report (stdio, or auth enabled without the opt-in)
  | "read_only" // open network server, default: reads only
  | "opt_in_active" // open network server with the write opt-in effective
  | "opt_in_ignored_auth_enabled" // opt-in set but per-user auth is on → ignored
  | "opt_in_no_credentials"; // opt-in set but no shared identity → fail closed to reads

export interface AnonymousAccessInput {
  /** Transport is http/https. stdio is local & trusted and never scope-gated. */
  httpMode: boolean;
  /** Per-user auth (local login / OAuth) is active for this run. */
  authEnabled: boolean;
  /** `MCP_ALLOW_SHARED_CREDENTIAL_WRITES` — explicit opt-in to write access on an open server. */
  allowSharedCredentialWrites: boolean;
  /** Shared Komodo credentials are configured (`resolveAuth(...) !== null`). */
  hasSharedCredentials: boolean;
}

export interface AnonymousAccess {
  /** Scopes granted to anonymous callers; `undefined` = unrestricted. */
  scopes: ToolScope[] | undefined;
  /** What index.ts should log/audit at startup. */
  notice: AnonymousAccessNotice;
}

/**
 * Decide anonymous access for the configured operating mode. Pure — no logging, no I/O —
 * so the security-relevant combinations are unit-testable without booting the server.
 *
 * Only an open network server (HTTP + auth disabled) is ever scope-gated, and only then does
 * the opt-in matter: it is ignored under per-user auth and fails closed to `[READ]` when no
 * shared identity is configured.
 */
export function resolveAnonymousAccess(input: AnonymousAccessInput): AnonymousAccess {
  if (!input.httpMode) return { scopes: undefined, notice: "none" };

  if (input.authEnabled) {
    return { scopes: undefined, notice: input.allowSharedCredentialWrites ? "opt_in_ignored_auth_enabled" : "none" };
  }

  if (!input.allowSharedCredentialWrites) return { scopes: [ToolScopes.READ], notice: "read_only" };
  if (!input.hasSharedCredentials) return { scopes: [ToolScopes.READ], notice: "opt_in_no_credentials" };

  return { scopes: undefined, notice: "opt_in_active" };
}
