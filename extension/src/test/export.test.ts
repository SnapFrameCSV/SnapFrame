import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExportFileName } from '../export/filename';

test('buildExportFileName strips the extension and joins the start line', () => {
  assert.equal(buildExportFileName('panel.ts', 42), 'snapframe-panel-42.png');
});

test('buildExportFileName handles a file name with no extension', () => {
  assert.equal(buildExportFileName('Makefile', 3), 'snapframe-Makefile-3.png');
});

test('buildExportFileName sanitises characters unsafe in a file name', () => {
  assert.equal(buildExportFileName('weird:name?.ts', 1), 'snapframe-weird_name_-1.png');
});

test('buildExportFileName only strips the final extension', () => {
  assert.equal(buildExportFileName('archive.tar.gz', 7), 'snapframe-archive.tar-7.png');
});

test('buildExportFileName takes the export format as the extension', () => {
  assert.equal(buildExportFileName('panel.ts', 42, 'svg'), 'snapframe-panel-42.svg');
  assert.equal(buildExportFileName('panel.ts', 42, 'webp'), 'snapframe-panel-42.webp');
});
