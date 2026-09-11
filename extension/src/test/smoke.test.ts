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

test('activate() registers every declared command and finishes well under 200 ms', () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'snapframe-activate-'));
  const outfile = path.join(outDir, 'extension.js');
  const registered: string[] = [];
  const vscodeStub = {
    commands: {
      registerCommand: (id: string) => {
        registered.push(id);
        return { dispose: () => undefined };
      },
      executeCommand: async () => undefined,
    },
    window: {
      createStatusBarItem: () => ({ show: () => undefined, hide: () => undefined, dispose: () => undefined }),
    },
    workspace: {},
    env: {},
    Uri: {},
    ViewColumn: {},
    StatusBarAlignment: { Left: 1, Right: 2 },
  };
  const fakeContext = {
    subscriptions: [] as unknown[],
    secrets: {
      get: async () => undefined,
      store: async () => undefined,
      onDidChange: () => ({ dispose: () => undefined }),
    },
  };
  // Swap in a stub for the `vscode` module the bundle requires, the same way
  // the real extension host provides it.
  const moduleLoader = require('node:module') as { _load: (request: string, ...rest: unknown[]) => unknown };
  const originalLoad = moduleLoader._load;
  moduleLoader._load = function (this: unknown, request: string, ...rest: unknown[]) {
    return request === 'vscode' ? vscodeStub : originalLoad.call(this, request, ...rest);
  };
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
    const started = performance.now();
    const extension = require(outfile) as { activate: (context: typeof fakeContext) => void };
    extension.activate(fakeContext);
    const elapsedMs = performance.now() - started;
    assert.ok(elapsedMs < 200, `activation took ${elapsedMs.toFixed(1)} ms`);

    const manifest = JSON.parse(readFileSync(path.join(extensionRoot, 'package.json'), 'utf8')) as {
      contributes: { commands: Array<{ command: string }> };
    };
    assert.deepEqual(registered.sort(), manifest.contributes.commands.map((c) => c.command).sort());
  } finally {
    moduleLoader._load = originalLoad;
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
    'snapframe.applyPreset',
    'snapframe.buyPro',
    'snapframe.capture',
    'snapframe.captureAfter',
    'snapframe.captureBefore',
    'snapframe.captureTerminal',
    'snapframe.deletePreset',
    'snapframe.enterLicence',
    'snapframe.exportPresets',
    'snapframe.importPresets',
    'snapframe.openSettings',
    'snapframe.quickSnap',
    'snapframe.savePreset',
  ]);
  assert.equal(manifest.main, './dist/extension.js');
  assert.match(manifest.engines.vscode, /^\^1\.90\.0$/);
});
