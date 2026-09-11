import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublicKey, verify as nodeVerify } from 'node:crypto';
import { emailHash, fromBase64url, importSigningKey, mintKey, publicKeyOf, verifyKey } from '../src/licence';
import { NOW, testSigningKey } from './helpers';

test('mintKey produces the extension key format and verifies with the raw public key', async () => {
  const { pkcs8Base64, publicRaw } = await testSigningKey();
  const privateKey = await importSigningKey(pkcs8Base64);
  const { key, payload } = await mintKey('Someone@Example.com ', privateKey, NOW);
  assert.match(key, /^SNAP-[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(payload, { p: 'pro', v: 1, iat: NOW, e: await emailHash('someone@example.com') });
  assert.deepEqual(await verifyKey(key, publicRaw), payload);
  assert.equal(await verifyKey(key.replace('SNAP-', 'SNAP-x'), publicRaw), null);
});

test('publicKeyOf derives the same 32 bytes the key pair exported', async () => {
  const { pkcs8Base64, publicRaw } = await testSigningKey();
  assert.deepEqual(await publicKeyOf(await importSigningKey(pkcs8Base64)), publicRaw);
});

test('a minted key is accepted by the exact algorithm the extension uses (Node crypto.verify over an SPKI from the raw key)', async () => {
  // Mirrors extension/src/licence/verify.ts byte for byte: DER prefix + raw
  // key → SPKI; signature over the payload bytes; base64url parts.
  const { pkcs8Base64, publicRaw } = await testSigningKey();
  const { key } = await mintKey('buyer@example.com', await importSigningKey(pkcs8Base64), NOW);
  const [payloadPart, signaturePart] = key.slice('SNAP-'.length).split('.');
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicRaw)]);
  const ok = nodeVerify(null, Buffer.from(fromBase64url(payloadPart)), createPublicKey({ key: spki, format: 'der', type: 'spki' }), Buffer.from(fromBase64url(signaturePart)));
  assert.equal(ok, true);
  const parsed = JSON.parse(Buffer.from(fromBase64url(payloadPart)).toString('utf8')) as { p: string; v: number; iat: number; e: string };
  assert.equal(parsed.p, 'pro');
  assert.equal(parsed.v, 1);
  assert.match(parsed.e, /^[0-9a-f]{12}$/);
  assert.equal(Buffer.from(fromBase64url(signaturePart)).length, 64);
});

test('emailHash is case- and whitespace-insensitive and 12 hex chars', async () => {
  const a = await emailHash('  Buyer@Example.COM ');
  assert.equal(a, await emailHash('buyer@example.com'));
  assert.match(a, /^[0-9a-f]{12}$/);
  assert.notEqual(a, await emailHash('other@example.com'));
});
