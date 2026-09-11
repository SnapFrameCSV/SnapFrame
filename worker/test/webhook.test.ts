import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGNATURE_TOLERANCE_SECONDS, hmacHex, verifyStripeSignature } from '../src/webhook';

const secret = 'test-webhook-fixture-secret';
const body = '{"id":"evt_1","type":"checkout.session.completed"}';
const ts = 1_800_000_000;

test('verifyStripeSignature accepts a correctly signed body inside the tolerance window', async () => {
  const header = `t=${ts},v1=${await hmacHex(secret, `${ts}.${body}`)}`;
  assert.equal(await verifyStripeSignature(body, header, secret, ts + 10), true);
  assert.equal(await verifyStripeSignature(body, header, secret, ts + SIGNATURE_TOLERANCE_SECONDS), true);
});

test('verifyStripeSignature rejects tampering, wrong secrets, stale timestamps and missing headers', async () => {
  const good = await hmacHex(secret, `${ts}.${body}`);
  assert.equal(await verifyStripeSignature(body.replace('evt_1', 'evt_2'), `t=${ts},v1=${good}`, secret, ts), false);
  assert.equal(await verifyStripeSignature(body, `t=${ts},v1=${good}`, 'test-webhook-other-secret', ts), false);
  assert.equal(await verifyStripeSignature(body, `t=${ts},v1=${good}`, secret, ts + SIGNATURE_TOLERANCE_SECONDS + 1), false);
  assert.equal(await verifyStripeSignature(body, null, secret, ts), false);
  assert.equal(await verifyStripeSignature(body, 't=abc,v1=zz', secret, ts), false);
  assert.equal(await verifyStripeSignature(body, `v1=${good}`, secret, ts), false);
});

test('verifyStripeSignature accepts any of several v1 signatures (secret rotation)', async () => {
  const good = await hmacHex(secret, `${ts}.${body}`);
  assert.equal(await verifyStripeSignature(body, `t=${ts},v1=${'0'.repeat(64)},v1=${good}`, secret, ts), true);
});

test('hmacHex matches the known HMAC-SHA256 test vector', async () => {
  // RFC 4231 test case 2: key "Jefe", data "what do ya want for nothing?"
  assert.equal(await hmacHex('Jefe', 'what do ya want for nothing?'), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
});
