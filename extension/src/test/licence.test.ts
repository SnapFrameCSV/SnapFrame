import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPro, verifyKey } from '../licence/verify';

test('licence stub rejects every key until Slice 3 lands', () => {
  const result = verifyKey('SNAP-anything.signature', new Uint8Array(32));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-implemented');
  assert.equal(result.payload, undefined);
});

test('isPro is false while no verifier exists', () => {
  assert.equal(isPro(), false);
});
