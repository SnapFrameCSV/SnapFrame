import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLineRanges } from '../frame/ranges';

test('parseLineRanges expands ranges and single lines, sorted and de-duplicated', () => {
  assert.deepEqual(parseLineRanges('3-5, 8, 4'), [3, 4, 5, 8]);
  assert.deepEqual(parseLineRanges('12 10-11'), [10, 11, 12]);
});

test('parseLineRanges tolerates junk, reversed ranges and blanks', () => {
  assert.deepEqual(parseLineRanges(''), []);
  assert.deepEqual(parseLineRanges('abc, 7-x, 0, -2'), []);
  assert.deepEqual(parseLineRanges('9-7'), [7, 8, 9]);
  assert.deepEqual(parseLineRanges(' , 2 , , 1 '), [1, 2]);
});

test('parseLineRanges caps a single range so a typo cannot allocate millions of lines', () => {
  assert.equal(parseLineRanges('1-99999999').length, 10_000);
});
