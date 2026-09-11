import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index';
import { verifyKey } from '../src/licence';
import type { KeyRecord } from '../src/env';
import { NOW, deps, memoryKv, signedWebhook, testEnv, testSigningKey, type FakeStripe } from './helpers';

function stripeFixture(): FakeStripe {
  return {
    sessions: {
      cs_paid: { id: 'cs_paid', payment_status: 'paid', created: NOW - 100, payment_intent: 'pi_1', customer_details: { email: 'Buyer@Example.com' } },
      cs_open: { id: 'cs_open', payment_status: 'unpaid', customer_details: { email: 'buyer@example.com' } },
    },
    byEmail: {
      'buyer@example.com': [
        { id: 'cs_old', payment_status: 'paid', created: NOW - 5000, payment_intent: 'pi_old', customer_details: { email: 'buyer@example.com' } },
        { id: 'cs_paid', payment_status: 'paid', created: NOW - 100, payment_intent: 'pi_1', customer_details: { email: 'buyer@example.com' } },
      ],
    },
    last4: { pi_1: '4242', pi_old: '1111' },
    calls: [],
  };
}

const get = (path: string, headers: Record<string, string> = {}) => new Request(`https://licence.example${path}`, { headers });
const form = (path: string, fields: Record<string, string>, ip = '203.0.113.5') =>
  new Request(`https://licence.example${path}`, {
    method: 'POST',
    body: new URLSearchParams(fields).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': ip },
  });

test('GET /health mints and verifies a throwaway key with the configured signing key', async () => {
  const { pkcs8Base64 } = await testSigningKey();
  const ok = await handleRequest(get('/health'), testEnv(memoryKv(), pkcs8Base64), deps(stripeFixture()));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true });
  const missing = await handleRequest(get('/health'), testEnv(memoryKv(), pkcs8Base64, { LICENCE_SIGNING_KEY: undefined }), deps(stripeFixture()));
  assert.equal(missing.status, 500);
});

test('GET /buy redirects to the Payment Link, or 503 before gate-04', async () => {
  const { pkcs8Base64 } = await testSigningKey();
  const redirect = await handleRequest(get('/buy'), testEnv(memoryKv(), pkcs8Base64), deps(stripeFixture()));
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'https://buy.stripe.com/test_link');
  const unset = await handleRequest(get('/buy'), testEnv(memoryKv(), pkcs8Base64, { PAYMENT_LINK_URL: 'REPLACE_AT_GATE_04' }), deps(stripeFixture()));
  assert.equal(unset.status, 503);
});

test('GET /success issues a key for a paid session, stores it, and is idempotent', async () => {
  const { pkcs8Base64, publicRaw } = await testSigningKey();
  const kv = memoryKv();
  const stripe = stripeFixture();
  const env = testEnv(kv, pkcs8Base64);

  const first = await handleRequest(get('/success?session_id=cs_paid'), env, deps(stripe));
  assert.equal(first.status, 200);
  const page = await first.text();
  const key = page.match(/<code class="key">(SNAP-[^<]+)<\/code>/)?.[1];
  assert.ok(key, 'page shows the key');
  const payload = await verifyKey(key, publicRaw);
  assert.ok(payload, 'the shown key verifies');
  assert.match(page, /Enter Licence Key/);
  assert.match(page, /Bookmark this page/);
  assert.doesNotMatch(page, /rk_test|whsec/);

  const records = [...kv.data.entries()].filter(([k]) => k.startsWith('key:'));
  assert.equal(records.length, 1);
  const record = JSON.parse(records[0][1]) as KeyRecord;
  assert.deepEqual(record, { key, sessionId: 'cs_paid', issuedAt: NOW, revoked: false });
  assert.equal(kv.data.get('session:cs_paid'), records[0][0].slice('key:'.length));

  const second = await handleRequest(get('/success?session_id=cs_paid'), env, deps(stripe, NOW + 500));
  assert.match(await second.text(), new RegExp(key.replace(/[-_]/g, '\\$&')), 'same key on reload');
  assert.equal([...kv.data.keys()].filter((k) => k.startsWith('key:')).length, 1);
});

test('GET /success refuses unpaid, unknown and malformed sessions without touching KV', async () => {
  const { pkcs8Base64 } = await testSigningKey();
  const kv = memoryKv();
  const env = testEnv(kv, pkcs8Base64);
  assert.equal((await handleRequest(get('/success?session_id=cs_open'), env, deps(stripeFixture()))).status, 402);
  assert.equal((await handleRequest(get('/success?session_id=cs_nope'), env, deps(stripeFixture()))).status, 404);
  assert.equal((await handleRequest(get('/success?session_id=../../etc'), env, deps(stripeFixture()))).status, 404);
  assert.equal((await handleRequest(get('/success'), env, deps(stripeFixture()))).status, 404);
  assert.equal(kv.data.size, 0);
});

test('POST /webhook mints on checkout.session.completed and revokes on charge.refunded; bad signatures are rejected', async () => {
  const { pkcs8Base64 } = await testSigningKey();
  const kv = memoryKv();
  const env = testEnv(kv, pkcs8Base64);
  const stripe = stripeFixture();

  const completed = JSON.stringify({ type: 'checkout.session.completed', data: { object: stripe.sessions.cs_paid } });
  const ok = await handleRequest(await signedWebhook(completed, env.STRIPE_WEBHOOK_SECRET as string, NOW), env, deps(stripe));
  assert.equal(ok.status, 200);
  const stored = [...kv.data.entries()].find(([k]) => k.startsWith('key:'));
  assert.ok(stored, 'key minted from the webhook alone');

  const forged = await signedWebhook(completed, 'test-webhook-wrong-secret', NOW);
  assert.equal((await handleRequest(forged, env, deps(stripe))).status, 400);

  const refunded = JSON.stringify({ type: 'charge.refunded', data: { object: { billing_details: { email: 'buyer@example.com' } } } });
  assert.equal((await handleRequest(await signedWebhook(refunded, env.STRIPE_WEBHOOK_SECRET as string, NOW), env, deps(stripe))).status, 200);
  assert.equal((JSON.parse(kv.data.get(stored[0]) as string) as KeyRecord).revoked, true);

  // A refunded purchase no longer shows its key on the success page.
  assert.equal((await handleRequest(get('/success?session_id=cs_paid'), env, deps(stripe))).status, 410);
});

test('POST /lost-key shows the key for a matching email + last4, a neutral page otherwise, and rate-limits per IP', async () => {
  const { pkcs8Base64 } = await testSigningKey();
  const kv = memoryKv();
  const env = testEnv(kv, pkcs8Base64);
  const stripe = stripeFixture();

  const formPage = await handleRequest(get('/lost-key'), env, deps(stripe));
  assert.equal(formPage.status, 200);
  assert.match(await formPage.text(), /<form method="post" action="\/lost-key">/);

  const wrong = await handleRequest(form('/lost-key', { email: 'buyer@example.com', last4: '1111' }), env, deps(stripe));
  assert.equal(wrong.status, 404, 'old card digits do not match the latest paid session');
  assert.match(await wrong.text(), /No matching purchase found/);

  const unknown = await handleRequest(form('/lost-key', { email: 'nobody@example.com', last4: '4242' }), env, deps(stripe));
  assert.equal(unknown.status, 404);

  const right = await handleRequest(form('/lost-key', { email: 'Buyer@Example.com', last4: '4242' }), env, deps(stripe));
  assert.equal(right.status, 200);
  assert.match(await right.text(), /SNAP-/);
  assert.ok(stripe.calls.some((c) => c.startsWith('/v1/payment_intents/pi_1')), 'checked the latest session\'s card');

  for (let i = 0; i < 2; i++) {
    await handleRequest(form('/lost-key', { email: 'buyer@example.com', last4: '0000' }), env, deps(stripe));
  }
  const sixth = await handleRequest(form('/lost-key', { email: 'buyer@example.com', last4: '4242' }), env, deps(stripe));
  assert.equal(sixth.status, 429, 'sixth attempt in the hour is refused even with correct details');
  const otherIp = await handleRequest(form('/lost-key', { email: 'buyer@example.com', last4: '4242' }, '198.51.100.9'), env, deps(stripe));
  assert.equal(otherIp.status, 200, 'the limit is per IP');
  const nextHour = await handleRequest(form('/lost-key', { email: 'buyer@example.com', last4: '4242' }), env, deps(stripe, NOW + 3600));
  assert.equal(nextHour.status, 200, 'the limit resets with the hour bucket');
});

test('GET /stats reports aggregate counts only', async () => {
  const { pkcs8Base64 } = await testSigningKey();
  const kv = memoryKv();
  await kv.put('key:aaaaaaaaaaaa', JSON.stringify({ key: 'SNAP-a.b', sessionId: 'cs_a', issuedAt: NOW - 86400, revoked: false }));
  await kv.put('key:bbbbbbbbbbbb', JSON.stringify({ key: 'SNAP-c.d', sessionId: 'cs_b', issuedAt: NOW - 20 * 86400, revoked: true }));
  await kv.put('key:cccccccccccc', JSON.stringify({ key: 'SNAP-e.f', sessionId: 'cs_c', issuedAt: NOW - 40 * 86400, revoked: false }));
  await kv.put('session:cs_a', 'aaaaaaaaaaaa');
  const response = await handleRequest(get('/stats'), testEnv(kv, pkcs8Base64), deps(stripeFixture()));
  const body = await response.text();
  assert.deepEqual(JSON.parse(body), { issued: 3, revoked: 1, last7: 1, last30: 2 });
  assert.doesNotMatch(body, /SNAP-|@/);
});

test('unknown routes are 404 and a thrown error becomes a generic 500 page', async () => {
  const { pkcs8Base64 } = await testSigningKey();
  const env = testEnv(memoryKv(), pkcs8Base64);
  assert.equal((await handleRequest(get('/nope'), env, deps(stripeFixture()))).status, 404);
  const broken = deps(stripeFixture());
  broken.fetch = (async () => new Response('boom', { status: 500 })) as typeof fetch;
  const failed = await handleRequest(get('/success?session_id=cs_paid'), env, broken);
  assert.equal(failed.status, 500);
  assert.doesNotMatch(await failed.text(), /boom|Stripe/);
});
