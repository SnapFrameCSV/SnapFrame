import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// The webview's JavaScript lives inside a TypeScript template literal in
// capture/panel.ts. A single backslash there is interpreted by the TS
// compiler, not the browser: `\s` is a "non-escape character" that compiles to
// a bare `s`, so a regex like /\swidth/ silently reaches the browser as
// /swidth/. Only doubled backslashes (`\\s`) survive. This caught a real bug
// once (the Export PNG button could never appear); this test stops it recurring.
const panelSource = readFileSync(path.resolve(__dirname, '..', '..', 'src', 'capture', 'panel.ts'), 'utf8');

function webviewScriptBlock(): string {
  const start = panelSource.indexOf('<script nonce=');
  const end = panelSource.indexOf('</script>', start);
  assert.ok(start > 0 && end > start, 'found the inline webview <script> block');
  return panelSource.slice(start, end);
}

test('webview script contains no single-backslash escapes that TypeScript would eat', () => {
  const script = webviewScriptBlock();
  const offenders: string[] = [];
  // Walk every backslash; a doubled pair `\\` is one unit and is fine.
  for (let i = 0; i < script.length; i++) {
    if (script[i] !== '\\') {
      continue;
    }
    const next = script[i + 1];
    if (next === '\\') {
      i++;
      continue;
    }
    // `${` interpolation of the outer template is TS, not browser JS; an
    // escaped backtick or dollar is a legitimate outer-literal escape.
    if (next === '`' || next === '$') {
      continue;
    }
    const context = script.slice(Math.max(0, i - 20), i + 10).replace(/\n/g, ' ');
    offenders.push(`…${context}…`);
  }
  assert.deepEqual(offenders, [], 'every backslash meant for the browser must be doubled');
});

test('webview script has the doubled escapes the export path relies on', () => {
  const script = webviewScriptBlock();
  assert.match(script, /\\\\swidth="\(\\\\d\+\)"/, 'dims regex uses \\\\s and \\\\d');
  assert.match(script, /split\('\\\\n'\)/, 'fallback line count splits on \\\\n');
});
