import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FREE_FORMATS, FREE_SCALES, PRO_FORMATS, PRO_SCALES, allowedScale, isFormatAllowed } from '../export/formats';

// D05: the free tier must keep everything Slice 2 shipped. These assertions
// are the contract — widening FREE_* is fine, shrinking it is not.
test('the free tier keeps PNG export at 1x and 2x, exactly as Slice 2 shipped it', () => {
  assert.deepEqual([...FREE_FORMATS], ['png']);
  assert.deepEqual([...FREE_SCALES], [1, 2]);
  assert.equal(isFormatAllowed('png', false), true);
  assert.equal(allowedScale(1, false), 1);
  assert.equal(allowedScale(2, false), 2);
});

test('free and Pro sets never overlap', () => {
  for (const format of FREE_FORMATS) {
    assert.equal(PRO_FORMATS.includes(format), false);
  }
  for (const scale of FREE_SCALES) {
    assert.equal(PRO_SCALES.includes(scale), false);
  }
});

test('Pro formats are refused without a licence and allowed with one', () => {
  for (const format of PRO_FORMATS) {
    assert.equal(isFormatAllowed(format, false), false, `${format} is Pro-only`);
    assert.equal(isFormatAllowed(format, true), true, `${format} is allowed for Pro`);
  }
});

test('Pro scales fall back to 2x without a licence and are honoured with one', () => {
  for (const scale of PRO_SCALES) {
    assert.equal(allowedScale(scale, false), 2);
    assert.equal(allowedScale(scale, true), scale);
  }
});

test('an unknown scale value falls back to 2x either way', () => {
  assert.equal(allowedScale(7, false), 2);
  assert.equal(allowedScale(7, true), 2);
  assert.equal(allowedScale(Number.NaN, true), 2);
});
