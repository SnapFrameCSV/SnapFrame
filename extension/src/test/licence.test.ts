import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { FUTURE_TOLERANCE_SECONDS, activeLicencePayload, describeFailure, isPro, setActiveLicence, verifyKey, type LicencePayload } from '../licence/verify';
import { licencePublicKey } from '../licence/publicKey';

// A throwaway key pair generated per test run: the real public key is not
// in the repo until gate-05, and tests must never depend on it.
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicRaw32 = Uint8Array.from((publicKey.export({ type: 'spki', format: 'der' }) as Buffer).subarray(-32));
const { publicKey: otherPublicKey } = generateKeyPairSync('ed25519');
const otherRaw32 = Uint8Array.from((otherPublicKey.export({ type: 'spki', format: 'der' }) as Buffer).subarray(-32));

const NOW = 1_800_000_000;
const payload: LicencePayload = { p: 'pro', v: 1, iat: NOW - 3600, e: '0123456789ab' };

function mint(body: unknown, key: KeyObject = privateKey): string {
  const bytes = Buffer.from(JSON.stringify(body), 'utf8');
  const signature = sign(null, bytes, key);
  return `SNAP-${bytes.toString('base64url')}.${signature.toString('base64url')}`;
}

test('a key signed by the matching private key verifies and returns its payload', () => {
  const result = verifyKey(mint(payload), publicRaw32, NOW);
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, payload);
  assert.equal(result.reason, undefined);
});

test('surrounding whitespace is tolerated (keys get pasted)', () => {
  assert.equal(verifyKey(`  ${mint(payload)}\n`, publicRaw32, NOW).ok, true);
});

test('a tampered payload fails the signature check', () => {
  const key = mint(payload);
  const [prefixAndPayload, signature] = key.split('.');
  const tampered = Buffer.from(JSON.stringify({ ...payload, e: 'ffffffffffff' }), 'utf8').toString('base64url');
  const result = verifyKey(`${prefixAndPayload.slice(0, 5)}${tampered}.${signature}`, publicRaw32, NOW);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'bad-signature');
});

test('a key signed by a different private key is rejected', () => {
  const { privateKey: otherPrivate } = generateKeyPairSync('ed25519');
  const result = verifyKey(mint(payload, otherPrivate), publicRaw32, NOW);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'bad-signature');
});

test('the same key checked against the wrong public key is rejected', () => {
  const result = verifyKey(mint(payload), otherRaw32, NOW);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'bad-signature');
});

test('malformed strings are rejected without throwing', () => {
  const malformed = [
    '',
    'not a key',
    'SNAP-',
    'SNAP-onlypayload',
    'SNAP-.sig',
    'SNAP-payload.',
    'SNAP-pay.load.sig',
    'SNAP-abc$def.ghi',
    `SNAP-${Buffer.from('{}').toString('base64url')}.${Buffer.from('short').toString('base64url')}`,
    mint(payload).replace('SNAP-', 'snap-'),
  ];
  for (const key of malformed) {
    const result = verifyKey(key, publicRaw32, NOW);
    assert.equal(result.ok, false, `rejected ${JSON.stringify(key)}`);
    assert.equal(result.reason, 'malformed', `reason for ${JSON.stringify(key)}`);
  }
});

test('a correctly signed payload that is not a licence is rejected as malformed', () => {
  for (const body of [{ p: 'free', v: 1, iat: NOW, e: '0123456789ab' }, { p: 'pro', v: '1', iat: NOW, e: '0123456789ab' }, { p: 'pro', v: 1, iat: NOW }, 'pro', 42]) {
    const result = verifyKey(mint(body), publicRaw32, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'malformed');
  }
});

test('an iat slightly in the future is tolerated, well in the future is not', () => {
  const soon = verifyKey(mint({ ...payload, iat: NOW + FUTURE_TOLERANCE_SECONDS - 1 }), publicRaw32, NOW);
  assert.equal(soon.ok, true);
  const later = verifyKey(mint({ ...payload, iat: NOW + FUTURE_TOLERANCE_SECONDS + 1 }), publicRaw32, NOW);
  assert.equal(later.ok, false);
  assert.equal(later.reason, 'issued-in-future');
});

test('a public key of the wrong size reports no-public-key rather than a signature failure', () => {
  const result = verifyKey(mint(payload), new Uint8Array(31), NOW);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-public-key');
});

test('the committed public key is still the gate-05 placeholder, so nothing can activate yet', () => {
  assert.equal(licencePublicKey(), null);
});

test('isPro follows the active licence set after verification', () => {
  setActiveLicence(null);
  assert.equal(isPro(), false);
  assert.equal(activeLicencePayload(), null);
  const result = verifyKey(mint(payload), publicRaw32, NOW);
  setActiveLicence(result.payload ?? null);
  assert.equal(isPro(), true);
  assert.deepEqual(activeLicencePayload(), payload);
  setActiveLicence(null);
  assert.equal(isPro(), false);
});

test('every failure reason has a plain-English description that mentions no server', () => {
  for (const reason of ['malformed', 'bad-signature', 'issued-in-future', 'no-public-key', undefined] as const) {
    const text = describeFailure(reason);
    assert.ok(text.length > 10);
    assert.doesNotMatch(text, /server|online|internet/i);
  }
});
