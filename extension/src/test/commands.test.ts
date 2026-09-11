import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FREE_COMMANDS, PRO_COMMANDS } from '../commands';

const manifest = JSON.parse(readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8')) as {
  contributes: { commands: Array<{ command: string; title: string }> };
};

test('the free tier keeps exactly the commands Slice 2 shipped (D05: Pro is additive)', () => {
  assert.deepEqual([...FREE_COMMANDS].sort(), ['snapframe.buyPro', 'snapframe.capture', 'snapframe.enterLicence', 'snapframe.openSettings', 'snapframe.quickSnap']);
});

test('every declared command is classified, and Pro ones say so in their title', () => {
  const declared = manifest.contributes.commands;
  assert.deepEqual(
    declared.map((c) => c.command).sort(),
    [...FREE_COMMANDS, ...PRO_COMMANDS].sort(),
    'package.json and commands.ts list the same commands',
  );
  for (const command of declared) {
    if (PRO_COMMANDS.includes(command.command)) {
      assert.match(command.title, /\(Pro\)$/, `${command.command} is Pro and its title must say so`);
    } else {
      assert.doesNotMatch(command.title, /Pro\)/, `${command.command} is free and must not be labelled Pro`);
    }
  }
});

test('free commands are never gated: their source never consults isPro or requirePro', () => {
  // extension.ts wires free commands straight to their handlers; the only
  // isPro consumers are the Pro gates. This pins that the free handlers'
  // modules do not import the licence module at all.
  const source = readFileSync(path.resolve(__dirname, '..', '..', 'src', 'capture', 'source.ts'), 'utf8');
  assert.doesNotMatch(source, /licence/);
  const text = readFileSync(path.resolve(__dirname, '..', '..', 'src', 'text', 'transforms.ts'), 'utf8');
  assert.doesNotMatch(text, /licence/);
  const shell = readFileSync(path.resolve(__dirname, '..', '..', 'src', 'webview', 'shell.ts'), 'utf8');
  assert.doesNotMatch(shell, /licence|isPro/);
  const panel = readFileSync(path.resolve(__dirname, '..', '..', 'src', 'capture', 'panel.ts'), 'utf8');
  // runCapture / runQuickSnap start captures without a gate.
  assert.match(panel, /export function runCapture\([^)]*\)[^{]*\{\s*return startCapture\(context, false, 'single'\);/);
  assert.match(panel, /export function runQuickSnap\([^)]*\)[^{]*\{\s*return startCapture\(context, true, 'single'\);/);
});
