import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSync } from 'esbuild';

const extensionRoot = path.resolve(__dirname, '..', '..');

test('extension bundles with esbuild and keeps vscode external', () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'snapframe-bundle-'));
  const outfile = path.join(outDir, 'extension.js');
  try {
    buildSync({
      entryPoints: [path.join(extensionRoot, 'src', 'extension.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      external: ['vscode'],
      outfile,
      logLevel: 'silent',
    });
    assert.ok(existsSync(outfile), 'bundle file was written');
    assert.ok(statSync(outfile).size > 0, 'bundle is not empty');
    const bundle = readFileSync(outfile, 'utf8');
    assert.match(bundle, /require\("vscode"\)/, 'vscode stays an external require');
    assert.match(bundle, /snapframe\.capture/, 'command ids survive bundling');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('package.json declares every command the extension registers', () => {
  const manifest = JSON.parse(readFileSync(path.join(extensionRoot, 'package.json'), 'utf8')) as {
    contributes: { commands: Array<{ command: string }> };
    main: string;
    engines: { vscode: string };
  };
  const declared = manifest.contributes.commands.map((c) => c.command).sort();
  assert.deepEqual(declared, [
    'snapframe.buyPro',
    'snapframe.capture',
    'snapframe.enterLicence',
    'snapframe.openSettings',
    'snapframe.quickSnap',
  ]);
  assert.equal(manifest.main, './dist/extension.js');
  assert.match(manifest.engines.vscode, /^\^1\.90\.0$/);
});
