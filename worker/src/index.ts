import type { Deps, Env, KeyRecord } from './env';
import { emailHash, importSigningKey, mintKey, publicKeyOf, verifyKey } from './licence';
import { errorPage, lostKeyForm, pendingPage, refundedPage, successPage } from './pages';
import { stripeClient, type CheckoutSession } from './stripe';
import { verifyStripeSignature } from './webhook';

/**
 * Routes (design §2 "How a purchase works", BUILD.md Slice 5):
 *   GET  /health            mints and verifies a throwaway key → 200 / 500
 *   GET  /buy               302 to the Stripe Payment Link
 *   GET  /success?session_id=cs_…   verify paid with Stripe, mint-if-missing, show the key
 *   POST /webhook           checkout.session.completed → mint-if-missing; charge.refunded → revoke
 *   GET|POST /lost-key      email + last4 → show the key (5/hour per IP)
 *   GET  /stats             aggregate counts only
 * KV layout: key:<emailHash> → KeyRecord; session:<cs_id> → emailHash; rl:<ip>:<hour> → count.
 */
const LOST_KEY_LIMIT_PER_HOUR = 5;

const defaultDeps: Deps = { fetch: (...args) => fetch(...args), now: () => Math.floor(Date.now() / 1000) };

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, defaultDeps);
  },
};

export async function handleRequest(request: Request, env: Env, deps: Deps): Promise<Response> {
  try {
    // Awaited here so a rejected route lands in the catch below.
    return await route(request, env, deps);
  } catch (error) {
    // Never leak internals; the run reads Worker logs if needed.
    console.error(String(error));
    return html(errorPage('Something went wrong', 'Please try again in a minute. If it keeps happening, open an issue.', env.SUPPORT_URL), 500);
  }
}

async function route(request: Request, env: Env, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  switch (`${request.method} ${url.pathname}`) {
    case 'GET /health':
      return health(env, deps);
    case 'GET /buy':
      return env.PAYMENT_LINK_URL && env.PAYMENT_LINK_URL.startsWith('https://')
        ? Response.redirect(env.PAYMENT_LINK_URL, 302)
        : text('Buy Pro is not available yet.', 503);
    case 'GET /success':
      return success(url.searchParams.get('session_id') ?? '', env, deps);
    case 'POST /webhook':
      return webhook(request, env, deps);
    case 'GET /lost-key':
      return html(lostKeyForm(env.SUPPORT_URL));
    case 'POST /lost-key':
      return lostKey(request, env, deps);
    case 'GET /stats':
      return stats(env, deps);
    default:
      return text('Not found', 404);
  }
}

async function health(env: Env, deps: Deps): Promise<Response> {
  if (!env.LICENCE_SIGNING_KEY) {
    return json({ ok: false, reason: 'LICENCE_SIGNING_KEY not set' }, 500);
  }
  const privateKey = await importSigningKey(env.LICENCE_SIGNING_KEY);
  const publicKey = await publicKeyOf(privateKey);
  const { key } = await mintKey('health@example.invalid', privateKey, deps.now());
  const payload = await verifyKey(key, publicKey);
  return payload ? json({ ok: true }) : json({ ok: false, reason: 'self-test key did not verify' }, 500);
}

async function issueForSession(session: CheckoutSession, env: Env, deps: Deps): Promise<{ record: KeyRecord; emailHashed: string } | null> {
  const email = session.customer_details?.email;
  if (session.payment_status !== 'paid' || !email || !env.LICENCE_SIGNING_KEY) {
    return null;
  }
  const emailHashed = await emailHash(email);
  const existing = await env.KEYS.get(`key:${emailHashed}`);
  if (existing) {
    return { record: JSON.parse(existing) as KeyRecord, emailHashed };
  }
  const privateKey = await importSigningKey(env.LICENCE_SIGNING_KEY);
  const { key } = await mintKey(email, privateKey, deps.now());
  const record: KeyRecord = { key, sessionId: session.id, issuedAt: deps.now(), revoked: false };
  await env.KEYS.put(`key:${emailHashed}`, JSON.stringify(record));
  await env.KEYS.put(`session:${session.id}`, emailHashed);
  return { record, emailHashed };
}

async function success(sessionId: string, env: Env, deps: Deps): Promise<Response> {
  if (!env.STRIPE_RESTRICTED_KEY) {
    return html(errorPage('Not configured', 'Key issuing is not switched on yet.', env.SUPPORT_URL), 503);
  }
  const stripe = stripeClient(env.STRIPE_RESTRICTED_KEY, deps.fetch);
  const session = await stripe.getCheckoutSession(sessionId);
  if (!session) {
    return html(errorPage('Checkout not found', 'That checkout session does not exist.', env.SUPPORT_URL), 404);
  }
  if (session.payment_status !== 'paid') {
    return html(pendingPage(env.SUPPORT_URL), 402);
  }
  const issued = await issueForSession(session, env, deps);
  if (!issued) {
    return html(errorPage('Not configured', 'Key issuing is not switched on yet.', env.SUPPORT_URL), 503);
  }
  if (issued.record.revoked) {
    return html(refundedPage(env.SUPPORT_URL), 410);
  }
  return html(successPage(issued.record.key, env.SUPPORT_URL));
}

async function webhook(request: Request, env: Env, deps: Deps): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return text('Webhook not configured', 503);
  }
  const rawBody = await request.text();
  const valid = await verifyStripeSignature(rawBody, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET, deps.now());
  if (!valid) {
    return text('Bad signature', 400);
  }
  const event = JSON.parse(rawBody) as { type?: string; data?: { object?: unknown } };
  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object as CheckoutSession | undefined;
    if (session?.id) {
      await issueForSession(session, env, deps);
    }
  } else if (event.type === 'charge.refunded') {
    const charge = event.data?.object as { billing_details?: { email?: string | null }; receipt_email?: string | null } | undefined;
    const email = charge?.billing_details?.email ?? charge?.receipt_email;
    if (email) {
      const emailHashed = await emailHash(email);
      const existing = await env.KEYS.get(`key:${emailHashed}`);
      if (existing) {
        const record = JSON.parse(existing) as KeyRecord;
        await env.KEYS.put(`key:${emailHashed}`, JSON.stringify({ ...record, revoked: true }));
      }
    }
  }
  return json({ received: true });
}

async function lostKey(request: Request, env: Env, deps: Deps): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const bucket = `rl:${ip}:${Math.floor(deps.now() / 3600)}`;
  const used = Number((await env.KEYS.get(bucket)) ?? '0');
  if (used >= LOST_KEY_LIMIT_PER_HOUR) {
    return html(lostKeyForm(env.SUPPORT_URL, 'Too many attempts — try again in an hour.'), 429);
  }
  await env.KEYS.put(bucket, String(used + 1), { expirationTtl: 3600 });

  const form = await request.formData();
  // Lower-cased like emailHash, so the Stripe lookup and the stored hash agree.
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const last4 = String(form.get('last4') ?? '').trim();
  if (!email || !/^\d{4}$/.test(last4) || !env.STRIPE_RESTRICTED_KEY) {
    return html(lostKeyForm(env.SUPPORT_URL, 'No matching purchase found.'), 404);
  }
  const stripe = stripeClient(env.STRIPE_RESTRICTED_KEY, deps.fetch);
  const session = await stripe.latestPaidSessionForEmail(email);
  const actualLast4 = session?.payment_intent ? await stripe.last4ForPaymentIntent(session.payment_intent) : null;
  if (!session || actualLast4 !== last4) {
    return html(lostKeyForm(env.SUPPORT_URL, 'No matching purchase found.'), 404);
  }
  const issued = await issueForSession(session, env, deps);
  if (!issued || issued.record.revoked) {
    return html(lostKeyForm(env.SUPPORT_URL, 'No matching purchase found.'), 404);
  }
  return html(successPage(issued.record.key, env.SUPPORT_URL));
}

async function stats(env: Env, deps: Deps): Promise<Response> {
  const now = deps.now();
  let issued = 0;
  let revoked = 0;
  let last7 = 0;
  let last30 = 0;
  let cursor: string | undefined;
  do {
    const page = await env.KEYS.list({ prefix: 'key:', cursor, limit: 1000 });
    for (const { name } of page.keys) {
      const raw = await env.KEYS.get(name);
      if (!raw) {
        continue;
      }
      const record = JSON.parse(raw) as KeyRecord;
      issued++;
      if (record.revoked) {
        revoked++;
      }
      if (now - record.issuedAt <= 7 * 86400) {
        last7++;
      }
      if (now - record.issuedAt <= 30 * 86400) {
        last30++;
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return json({ issued, revoked, last7, last30 });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
