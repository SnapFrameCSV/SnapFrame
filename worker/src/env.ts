/**
 * The Worker's bindings, and the smallest KV surface the code needs — declared
 * here rather than pulled from @cloudflare/workers-types so the routes can be
 * exercised by node:test with an in-memory stand-in.
 */
export interface KVListResult {
  keys: Array<{ name: string }>;
  list_complete: boolean;
  cursor?: string;
}

export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<KVListResult>;
}

export interface Env {
  KEYS: KVStore;
  PAYMENT_LINK_URL: string;
  SUPPORT_URL: string;
  STRIPE_RESTRICTED_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  LICENCE_SIGNING_KEY?: string;
}

/** Everything with a side effect or a clock, so tests can substitute it. */
export interface Deps {
  fetch: typeof fetch;
  now: () => number;
}

/** One issued key, stored at `key:<emailHash>`. */
export interface KeyRecord {
  key: string;
  sessionId: string;
  issuedAt: number;
  revoked: boolean;
}
