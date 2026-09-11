import type { Deps, Env, KVStore } from '../src/env';
import { hmacHex } from '../src/webhook';

/** In-memory KV with the same list/prefix/cursor shape as Workers KV. */
export function memoryKv(): KVStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      data.set(key, value);
    },
    async list(options) {
      const prefix = options?.prefix ?? '';
      const limit = options?.limit ?? 1000;
      const keys = [...data.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = options?.cursor ? Number(options.cursor) : 0;
      const page = keys.slice(start, start + limit);
      const complete = start + limit >= keys.length;
      return { keys: page.map((name) => ({ name })), list_complete: complete, cursor: complete ? undefined : String(start + limit) };
    },
  };
}

export async function testSigningKey(): Promise<{ pkcs8Base64: string; publicRaw: Uint8Array<ArrayBuffer> }> {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { pkcs8Base64: Buffer.from(pkcs8).toString('base64'), publicRaw };
}

export const NOW = 1_800_000_000;

/** A fake Stripe: sessions by id, sessions by email, last4 by payment intent. */
export interface FakeStripe {
  sessions: Record<string, unknown>;
  byEmail: Record<string, unknown[]>;
  last4: Record<string, string>;
  calls: string[];
}

export function fakeFetch(stripe: FakeStripe): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    stripe.calls.push(url.pathname + url.search);
    const auth = new Headers(init?.headers).get('Authorization');
    if (auth !== 'Bearer rk_test_fake') {
      return new Response('{"error":"unauthorised"}', { status: 401 });
    }
    const sessionMatch = url.pathname.match(/^\/v1\/checkout\/sessions\/(cs_\w+)$/);
    if (sessionMatch) {
      const session = stripe.sessions[sessionMatch[1]];
      return session ? Response.json(session) : new Response('{}', { status: 404 });
    }
    if (url.pathname === '/v1/checkout/sessions') {
      const email = url.searchParams.get('customer_details[email]') ?? '';
      return Response.json({ data: stripe.byEmail[email] ?? [] });
    }
    const piMatch = url.pathname.match(/^\/v1\/payment_intents\/(pi_\w+)$/);
    if (piMatch) {
      const last4 = stripe.last4[piMatch[1]];
      return last4 ? Response.json({ latest_charge: { payment_method_details: { card: { last4 } } } }) : new Response('{}', { status: 404 });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
}

export function testEnv(kv: KVStore, signingKey: string, overrides: Partial<Env> = {}): Env {
  return {
    KEYS: kv,
    PAYMENT_LINK_URL: 'https://buy.stripe.com/test_link',
    SUPPORT_URL: 'https://github.com/SnapFrameCSV/snapframe/issues',
    STRIPE_RESTRICTED_KEY: 'rk_test_fake',
    STRIPE_WEBHOOK_SECRET: 'test-webhook-secret-not-real',
    LICENCE_SIGNING_KEY: signingKey,
    ...overrides,
  };
}

export function deps(stripe: FakeStripe, now = NOW): Deps {
  return { fetch: fakeFetch(stripe), now: () => now };
}

export async function signedWebhook(body: string, secret: string, timestamp: number): Promise<Request> {
  const signature = await hmacHex(secret, `${timestamp}.${body}`);
  return new Request('https://licence.example/webhook', {
    method: 'POST',
    body,
    headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}`, 'content-type': 'application/json' },
  });
}
