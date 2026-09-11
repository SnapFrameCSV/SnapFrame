import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareTerminalText } from '../capture/terminal';

test('prepareTerminalText trims trailing spaces and surrounding blank lines and counts rows', () => {
  const result = prepareTerminalText('\n\n$ npm test   \nok 1 - x  \n\n\n', 0);
  assert.equal(result.text, '$ npm test\nok 1 - x');
  assert.equal(result.lineCount, 2);
});

test('prepareTerminalText strips ANSI colour and OSC sequences and normalises CRLF', () => {
  const result = prepareTerminalText('[32mPASS[0m src/a.ts\r\n]0;titledone', 0);
  assert.equal(result.text, 'PASS src/a.ts\ndone');
});

test('prepareTerminalText expands tabs to terminal stops and soft-wraps when asked', () => {
  assert.equal(prepareTerminalText('a\tb', 0).text, 'a       b');
  const wrapped = prepareTerminalText('one two three four five six', 10);
  assert.equal(wrapped.lineCount, 3);
});

test('prepareTerminalText reports zero lines for an empty copy', () => {
  assert.deepEqual(prepareTerminalText('   \n  ', 0), { text: '', lineCount: 0 });
});
