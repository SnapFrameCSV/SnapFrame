import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_BACKGROUNDS,
  FREE_FORMATS,
  FREE_SCALES,
  PRO_FORMATS,
  PRO_SCALES,
  allowedBackgroundType,
  allowedProFrameOptions,
  allowedScale,
  isFormatAllowed,
} from '../export/formats';
import { DEFAULT_PRO_FRAME_OPTIONS } from '../frame/svg';

test('Pro frame extras (gradient angle/stops, background image, caption) collapse to the free defaults without a key', () => {
  const requested = {
    ...DEFAULT_PRO_FRAME_OPTIONS,
    gradientAngle: 20,
    gradientStops: ['#000', '#111', '#222'],
    backgroundImage: 'data:image/png;base64,AAAA',
    caption: { text: '@me', color: '#fff', position: 'right' as const },
    highlightLines: [3],
    focusDim: true,
    callouts: [{ line: 3, text: 'here' }],
  };
  assert.deepEqual(allowedProFrameOptions(requested, false, DEFAULT_PRO_FRAME_OPTIONS), DEFAULT_PRO_FRAME_OPTIONS);
  assert.deepEqual(allowedProFrameOptions(requested, true, DEFAULT_PRO_FRAME_OPTIONS), requested);
  assert.deepEqual(
    DEFAULT_PRO_FRAME_OPTIONS,
    { gradientAngle: 135, gradientStops: [], highlightLines: [], highlightColor: 'rgba(255,255,255,0.08)', focusDim: false, callouts: [] },
    'the free defaults are the diagonal two-stop gradient and nothing else',
  );
});

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

test('the free tier keeps solid and gradient backgrounds; transparent is Pro', () => {
  assert.deepEqual([...FREE_BACKGROUNDS], ['solid', 'gradient']);
  assert.equal(allowedBackgroundType('gradient', false), 'gradient');
  assert.equal(allowedBackgroundType('solid', false), 'solid');
  assert.equal(allowedBackgroundType('transparent', false), 'solid');
  assert.equal(allowedBackgroundType('transparent', true), 'transparent');
  assert.equal(allowedBackgroundType('plaid', true), 'solid');
});

test('an unknown scale value falls back to 2x either way', () => {
  assert.equal(allowedScale(7, false), 2);
  assert.equal(allowedScale(7, true), 2);
  assert.equal(allowedScale(Number.NaN, true), 2);
});
