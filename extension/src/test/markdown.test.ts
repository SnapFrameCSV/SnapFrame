import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownImageLink } from '../export/markdown';

test('markdownImageLink makes workspace paths relative with forward slashes', () => {
  assert.equal(markdownImageLink('panel', '/home/me/repo/docs/snapframe-panel-1.png', '/home/me/repo'), '![panel](docs/snapframe-panel-1.png)');
  assert.equal(markdownImageLink('panel', 'C:\\repo\\img\\a.png', 'C:\\repo\\'), '![panel](img/a.png)');
});

test('markdownImageLink keeps paths outside the workspace absolute', () => {
  assert.equal(markdownImageLink('x', '/tmp/out/a.png', '/home/me/repo'), '![x](/tmp/out/a.png)');
  assert.equal(markdownImageLink('x', '/tmp/out/a.png'), '![x](/tmp/out/a.png)');
});

test('markdownImageLink wraps paths with spaces or parentheses and sanitises the alt text', () => {
  assert.equal(markdownImageLink('a [b]\nc', '/My Pics/shot (1).png'), '![a  b  c](</My Pics/shot (1).png>)');
  assert.equal(markdownImageLink('   ', '/a.png'), '![code](/a.png)');
});
