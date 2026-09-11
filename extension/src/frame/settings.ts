import * as vscode from 'vscode';
import { FrameSettings } from './svg';
import { allowedBackgroundType, allowedScale, type ExportScale } from '../export/formats';
import { isPro } from '../licence/verify';

/**
 * Reads the frame-styling settings declared in package.json, applying the
 * Pro gates (a Pro-only value chosen without a licence falls back to its free
 * equivalent — the setting itself is left untouched). Not pure (reads vscode
 * config), so left untested like source.ts; the gates are tested in
 * formats.test.ts.
 */
export function readFrameSettings(): FrameSettings {
  const config = vscode.workspace.getConfiguration('snapframe');
  return {
    backgroundType: allowedBackgroundType(config.get<string>('background.type', 'gradient'), isPro()),
    backgroundColor: config.get<string>('background.color', '#1e1e2e'),
    backgroundGradient: config.get<[string, string]>('background.gradient', ['#8caaee', '#ca9ee6']),
    padding: config.get<number>('padding', 32),
    shadow: config.get<boolean>('shadow', true),
    cornerRadius: config.get<number>('cornerRadius', 12),
    windowControls: config.get<boolean>('windowControls', true),
    titleBar: config.get<boolean>('titleBar', true),
    lineNumbers: config.get<boolean>('lineNumbers', true),
  };
}

export interface ExportSettings {
  scale: ExportScale;
  exportFolder: string;
  copyToClipboardAfterExport: boolean;
}

/** Reads the export settings with the Pro scale gate applied. Not pure (reads vscode config), so left untested like readFrameSettings. */
export function readExportSettings(): ExportSettings {
  const config = vscode.workspace.getConfiguration('snapframe');
  return {
    scale: allowedScale(config.get<number>('scale', 2), isPro()),
    exportFolder: config.get<string>('exportFolder', ''),
    copyToClipboardAfterExport: config.get<boolean>('copyToClipboardAfterExport', false),
  };
}
