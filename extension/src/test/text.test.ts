import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedent, expandTabs, softWrap } from '../text/transforms';

test('dedent removes the common leading whitespace from every line', () => {
  const input = ['    function f() {', '      return 1;', '    }'].join('\n');
  const expected = ['function f() {', '  return 1;', '}'].join('\n');
  assert.equal(dedent(input), expected);
});

test('dedent ignores blank lines when computing the common prefix', () => {
  const input = ['    a', '', '    b'].join('\n');
  const expected = ['a', '', 'b'].join('\n');
  assert.equal(dedent(input), expected);
});

test('dedent is a no-op when there is no shared indentation', () => {
  const input = ['a', '  b', 'c'].join('\n');
  assert.equal(dedent(input), input);
});

test('expandTabs aligns to tab stops rather than a flat replace', () => {
  assert.equal(expandTabs('a\tb', 4), 'a   b');
  assert.equal(expandTabs('ab\tc', 4), 'ab  c');
  assert.equal(expandTabs('abcd\te', 4), 'abcd    e');
});

test('expandTabs handles multiple lines independently', () => {
  assert.equal(expandTabs('\ta\n\tb', 2), '  a\n  b');
});

test('softWrap leaves short lines untouched', () => {
  assert.equal(softWrap('short line', 80), 'short line');
});

test('softWrap breaks long lines at the last space before the column', () => {
  const input = 'the quick brown fox jumps over the lazy dog';
  const wrapped = softWrap(input, 20);
  const rows = wrapped.split('\n');
  assert.ok(rows.every((row) => row.length <= 20));
  assert.equal(rows.join(' '), input);
});

test('softWrap hard-breaks a single word longer than the column', () => {
  const input = 'a'.repeat(30);
  const wrapped = softWrap(input, 10);
  assert.deepEqual(wrapped.split('\n'), ['a'.repeat(10), 'a'.repeat(10), 'a'.repeat(10)]);
});

test('softWrap with column <= 0 is a no-op', () => {
  const input = 'the quick brown fox';
  assert.equal(softWrap(input, 0), input);
});
