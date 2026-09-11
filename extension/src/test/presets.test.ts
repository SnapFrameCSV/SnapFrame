import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PRESET_NAME_LENGTH,
  PRESET_FILE_VERSION,
  PRESET_SETTING_KEYS,
  isValidPresetName,
  mergePresets,
  parsePresets,
  removePreset,
  sanitiseSettings,
  serialisePresets,
  upsertPreset,
  type Preset,
} from '../presets/presets';

const dark: Preset = {
  name: 'Dark talk',
  settings: { 'background.type': 'solid', 'background.color': '#101010', padding: 48, shadow: false, lineNumbers: true, scale: 3 },
};
const social: Preset = {
  name: 'Social',
  settings: { 'background.type': 'gradient', 'background.gradient': ['#8caaee', '#ca9ee6'], cornerRadius: 16, titleBar: false },
};

test('presets round-trip through the JSON file format', () => {
  const text = serialisePresets([dark, social]);
  const file = JSON.parse(text) as { version: number; presets: Preset[] };
  assert.equal(file.version, PRESET_FILE_VERSION);
  assert.deepEqual(parsePresets(text).presets, [dark, social]);
});

test('every preset-able key is a real snapframe setting name', () => {
  // background.image (a machine-local path), highlightLines and callouts
  // (per-snippet) are deliberately absent.
  const declared = [
    'highlightColor',
    'focusDim',
    'qr.text',
    'qr.size',
    'background.type',
    'background.color',
    'background.gradient',
    'background.gradientAngle',
    'background.gradientStops',
    'caption.text',
    'caption.color',
    'caption.position',
    'padding',
    'shadow',
    'cornerRadius',
    'windowControls',
    'lineNumbers',
    'titleBar',
    'wrapColumn',
    'scale',
  ];
  assert.deepEqual([...PRESET_SETTING_KEYS].sort(), declared.sort());
});

test('sanitiseSettings drops unknown keys and badly typed or out-of-range values', () => {
  const clean = sanitiseSettings({
    padding: 32,
    shadow: 'yes',
    cornerRadius: 999,
    'background.color': '<script>',
    'background.gradient': ['#fff'],
    scale: 2.5,
    exportFolder: '/tmp/anything',
    __proto__: { polluted: true },
    lineNumbers: false,
  });
  assert.deepEqual(clean, { padding: 32, lineNumbers: false });
});

test('parsePresets accepts a bare array too, skips junk entries and de-duplicates names', () => {
  const text = JSON.stringify([
    { name: 'A', settings: { padding: 1 } },
    'nonsense',
    { name: '', settings: { padding: 2 } },
    { name: 'B', settings: { unknown: true } },
    { name: 'A', settings: { padding: 3 } },
    { name: '  C  ', settings: { shadow: true } },
  ]);
  assert.deepEqual(parsePresets(text).presets, [
    { name: 'A', settings: { padding: 3 } },
    { name: 'C', settings: { shadow: true } },
  ]);
});

test('parsePresets reports why nothing was imported instead of throwing', () => {
  assert.equal(parsePresets('{not json').error, 'not valid JSON');
  assert.equal(parsePresets('{"version":1}').error, 'no "presets" list found');
  assert.equal(parsePresets('[{"name":"x","settings":{}}]').error, 'no usable presets in the file');
  assert.deepEqual(parsePresets('42').presets, []);
});

test('upsertPreset replaces by exact name and keeps order; removePreset filters', () => {
  const list = upsertPreset([dark, social], { name: 'Dark talk', settings: { padding: 8 } });
  assert.deepEqual(
    list.map((p) => p.name),
    ['Dark talk', 'Social'],
  );
  assert.deepEqual(list[0].settings, { padding: 8 });
  assert.equal(upsertPreset(list, { name: 'dark talk', settings: {} }).length, 3, 'names are case-sensitive');
  assert.deepEqual(removePreset(list, 'Social'), [list[0]]);
});

test('mergePresets counts new and replaced entries, imported values winning', () => {
  const result = mergePresets([dark], [{ name: 'Dark talk', settings: { padding: 1 } }, social]);
  assert.equal(result.added, 1);
  assert.equal(result.replaced, 1);
  assert.deepEqual(result.presets[0].settings, { padding: 1 });
  assert.equal(result.presets.length, 2);
});

test('preset names must be short, single-line and non-blank', () => {
  assert.equal(isValidPresetName('Talk'), true);
  assert.equal(isValidPresetName('   '), false);
  assert.equal(isValidPresetName('two\nlines'), false);
  assert.equal(isValidPresetName('x'.repeat(MAX_PRESET_NAME_LENGTH + 1)), false);
  assert.equal(isValidPresetName(42), false);
});
