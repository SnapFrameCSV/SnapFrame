/**
 * Named presets (Pro): a snapshot of the `snapframe.*` frame settings under a
 * name, kept as JSON in globalState and importable/exportable as a file. Pure
 * — the vscode reads/writes live in presets/commands.ts — so parsing and
 * merging are unit-tested directly. Unknown keys are dropped and every value
 * is type-checked, so a hand-edited or hostile file can only ever change the
 * settings this table names, to values of the right shape.
 */

export const PRESET_FILE_VERSION = 1;

/** Setting key (without the `snapframe.` prefix) → validator for its value. */
const PRESET_SETTING_VALIDATORS: Record<string, (value: unknown) => boolean> = {
  'background.type': (v) => v === 'solid' || v === 'gradient' || v === 'transparent',
  'background.color': isCssColour,
  'background.gradient': (v) => Array.isArray(v) && v.length === 2 && v.every(isCssColour),
  'background.gradientAngle': (v) => isNumberIn(v, 0, 360),
  'background.gradientStops': (v) => Array.isArray(v) && v.length <= 8 && v.every(isCssColour),
  'caption.text': (v) => typeof v === 'string' && v.length <= 80 && !/[\r\n]/.test(v),
  'caption.color': isCssColour,
  'caption.position': (v) => v === 'left' || v === 'center' || v === 'right',
  highlightColor: isCssColour,
  focusDim: isBoolean,
  'qr.text': (v) => typeof v === 'string' && v.length <= 213 && !/[\r\n]/.test(v),
  'qr.size': (v) => isNumberIn(v, 48, 240),
  padding: (v) => isNumberIn(v, 0, 256),
  shadow: isBoolean,
  cornerRadius: (v) => isNumberIn(v, 0, 64),
  windowControls: isBoolean,
  lineNumbers: isBoolean,
  titleBar: isBoolean,
  wrapColumn: (v) => isNumberIn(v, 0, 200),
  scale: (v) => v === 1 || v === 2 || v === 3 || v === 4,
};

export const PRESET_SETTING_KEYS: readonly string[] = Object.keys(PRESET_SETTING_VALIDATORS);

export type PresetSettings = Record<string, unknown>;

export interface Preset {
  name: string;
  settings: PresetSettings;
}

export interface PresetFile {
  version: number;
  presets: Preset[];
}

export const MAX_PRESET_NAME_LENGTH = 60;

export function isValidPresetName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= MAX_PRESET_NAME_LENGTH && !/[\r\n]/.test(name);
}

/** Keeps only known keys with well-typed values. */
export function sanitiseSettings(candidate: unknown): PresetSettings {
  const out: PresetSettings = {};
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return out;
  }
  for (const [key, validator] of Object.entries(PRESET_SETTING_VALIDATORS)) {
    const value = (candidate as Record<string, unknown>)[key];
    if (value !== undefined && validator(value)) {
      out[key] = value;
    }
  }
  return out;
}

export function serialisePresets(presets: readonly Preset[]): string {
  const file: PresetFile = { version: PRESET_FILE_VERSION, presets: presets.map((p) => ({ name: p.name, settings: sanitiseSettings(p.settings) })) };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export interface ParseResult {
  presets: Preset[];
  /** Human-readable reason when nothing usable was found; presets is then empty. */
  error?: string;
}

/** Accepts a full preset file or a bare array of presets; never throws. */
export function parsePresets(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { presets: [], error: 'not valid JSON' };
  }
  const list = Array.isArray(data) ? data : typeof data === 'object' && data !== null ? (data as { presets?: unknown }).presets : undefined;
  if (!Array.isArray(list)) {
    return { presets: [], error: 'no "presets" list found' };
  }
  const presets: Preset[] = [];
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const { name, settings } = entry as { name?: unknown; settings?: unknown };
    if (!isValidPresetName(name)) {
      continue;
    }
    const clean = sanitiseSettings(settings);
    if (Object.keys(clean).length === 0) {
      continue;
    }
    presets.push({ name: name.trim(), settings: clean });
  }
  if (presets.length === 0) {
    return { presets: [], error: 'no usable presets in the file' };
  }
  return { presets: dedupeByName(presets) };
}

/** Adds or replaces by name (exact match), keeping list order for existing entries. */
export function upsertPreset(presets: readonly Preset[], preset: Preset): Preset[] {
  const index = presets.findIndex((p) => p.name === preset.name);
  if (index === -1) {
    return [...presets, preset];
  }
  const next = [...presets];
  next[index] = preset;
  return next;
}

export function removePreset(presets: readonly Preset[], name: string): Preset[] {
  return presets.filter((p) => p.name !== name);
}

/** Merges imported presets over existing ones; imported names win. Returns the count that were new. */
export function mergePresets(existing: readonly Preset[], imported: readonly Preset[]): { presets: Preset[]; added: number; replaced: number } {
  let presets = [...existing];
  let added = 0;
  let replaced = 0;
  for (const preset of imported) {
    const before = presets.length;
    presets = upsertPreset(presets, preset);
    if (presets.length > before) {
      added++;
    } else {
      replaced++;
    }
  }
  return { presets, added, replaced };
}

function dedupeByName(presets: Preset[]): Preset[] {
  let out: Preset[] = [];
  for (const preset of presets) {
    out = upsertPreset(out, preset);
  }
  return out;
}

function isBoolean(value: unknown): boolean {
  return typeof value === 'boolean';
}

function isNumberIn(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isCssColour(value: unknown): boolean {
  // Hex, rgb()/rgba()/hsl()/hsla(), or a plain colour keyword — enough for the settings UI, and never markup.
  return typeof value === 'string' && value.length <= 64 && /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\([0-9.,\s%]+\)|[a-zA-Z]{3,20})$/.test(value.trim());
}
