import * as vscode from 'vscode';
import { isPro } from '../licence/verify';
import {
  PRESET_SETTING_KEYS,
  isValidPresetName,
  mergePresets,
  parsePresets,
  removePreset,
  sanitiseSettings,
  serialisePresets,
  upsertPreset,
  type Preset,
} from './presets';

const STORAGE_KEY = 'snapframe.presets';

function readPresets(context: vscode.ExtensionContext): Preset[] {
  const stored = context.globalState.get<unknown>(STORAGE_KEY);
  return Array.isArray(stored) ? (stored as Preset[]).filter((p) => isValidPresetName(p?.name)).map((p) => ({ name: p.name, settings: sanitiseSettings(p.settings) })) : [];
}

async function writePresets(context: vscode.ExtensionContext, presets: Preset[]): Promise<void> {
  await context.globalState.update(STORAGE_KEY, presets);
}

function requirePro(feature: string): boolean {
  if (isPro()) {
    return true;
  }
  void vscode.window.showInformationMessage(`Snapframe: ${feature} is a Pro feature. Run "Snapframe: Buy Pro…" to unlock it.`);
  return false;
}

/** The current `snapframe.*` values for every preset-able key. */
function currentSettings(): Record<string, unknown> {
  const config = vscode.workspace.getConfiguration('snapframe');
  const out: Record<string, unknown> = {};
  for (const key of PRESET_SETTING_KEYS) {
    out[key] = config.get(key);
  }
  return sanitiseSettings(out);
}

async function applySettings(settings: Record<string, unknown>): Promise<void> {
  const config = vscode.workspace.getConfiguration('snapframe');
  for (const [key, value] of Object.entries(settings)) {
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }
}

async function pickPreset(context: vscode.ExtensionContext, placeHolder: string): Promise<Preset | undefined> {
  const presets = readPresets(context);
  if (presets.length === 0) {
    void vscode.window.showInformationMessage('Snapframe: no presets saved yet. Use "Snapframe: Save Preset…" first.');
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    presets.map((p) => ({ label: p.name, description: summarise(p), preset: p })),
    { placeHolder },
  );
  return picked?.preset;
}

function summarise(preset: Preset): string {
  const s = preset.settings;
  const parts = [
    typeof s['background.type'] === 'string' ? String(s['background.type']) : undefined,
    typeof s.padding === 'number' ? `pad ${s.padding}` : undefined,
    s.shadow === false ? 'no shadow' : undefined,
    s.lineNumbers === false ? 'no line numbers' : undefined,
    typeof s.scale === 'number' ? `${s.scale}×` : undefined,
  ];
  return parts.filter(Boolean).join(' · ');
}

export async function savePreset(context: vscode.ExtensionContext): Promise<void> {
  if (!requirePro('Presets')) {
    return;
  }
  const name = await vscode.window.showInputBox({
    title: 'Snapframe: Save Preset',
    prompt: 'Name for the current frame settings',
    validateInput: (value) => (isValidPresetName(value) ? null : 'Give the preset a short, single-line name'),
  });
  if (!name) {
    return;
  }
  const preset: Preset = { name: name.trim(), settings: currentSettings() };
  await writePresets(context, upsertPreset(readPresets(context), preset));
  vscode.window.setStatusBarMessage(`Snapframe: saved preset "${preset.name}".`, 4000);
}

export async function applyPreset(context: vscode.ExtensionContext): Promise<void> {
  if (!requirePro('Presets')) {
    return;
  }
  const preset = await pickPreset(context, 'Apply which preset?');
  if (!preset) {
    return;
  }
  await applySettings(preset.settings);
  vscode.window.setStatusBarMessage(`Snapframe: applied preset "${preset.name}".`, 4000);
}

export async function deletePreset(context: vscode.ExtensionContext): Promise<void> {
  if (!requirePro('Presets')) {
    return;
  }
  const preset = await pickPreset(context, 'Delete which preset?');
  if (!preset) {
    return;
  }
  await writePresets(context, removePreset(readPresets(context), preset.name));
  vscode.window.setStatusBarMessage(`Snapframe: deleted preset "${preset.name}".`, 4000);
}

export async function exportPresets(context: vscode.ExtensionContext): Promise<void> {
  if (!requirePro('Presets')) {
    return;
  }
  const presets = readPresets(context);
  if (presets.length === 0) {
    void vscode.window.showInformationMessage('Snapframe: no presets to export yet.');
    return;
  }
  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file('snapframe-presets.json'),
    filters: { JSON: ['json'] },
  });
  if (!target) {
    return;
  }
  await vscode.workspace.fs.writeFile(target, Buffer.from(serialisePresets(presets), 'utf8'));
  vscode.window.setStatusBarMessage(`Snapframe: exported ${presets.length} preset${presets.length === 1 ? '' : 's'} to ${target.fsPath}.`, 6000);
}

export async function importPresets(context: vscode.ExtensionContext): Promise<void> {
  if (!requirePro('Presets')) {
    return;
  }
  const chosen = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { JSON: ['json'] }, title: 'Import Snapframe presets' });
  if (!chosen || chosen.length === 0) {
    return;
  }
  const text = Buffer.from(await vscode.workspace.fs.readFile(chosen[0])).toString('utf8');
  const parsed = parsePresets(text);
  if (parsed.error) {
    void vscode.window.showErrorMessage(`Snapframe: could not import presets — ${parsed.error}.`);
    return;
  }
  const merged = mergePresets(readPresets(context), parsed.presets);
  await writePresets(context, merged.presets);
  vscode.window.setStatusBarMessage(`Snapframe: imported ${merged.added} new preset${merged.added === 1 ? '' : 's'}, updated ${merged.replaced}.`, 6000);
}
