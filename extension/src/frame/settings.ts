import * as vscode from 'vscode';
import { FrameSettings } from './svg';

/** Reads the frame-styling settings declared in package.json. Not pure (reads vscode config), so left untested like source.ts. */
export function readFrameSettings(): FrameSettings {
  const config = vscode.workspace.getConfiguration('snapframe');
  return {
    backgroundType: config.get<'solid' | 'gradient'>('background.type', 'gradient'),
    backgroundColor: config.get<string>('background.color', '#1e1e2e'),
    backgroundGradient: config.get<[string, string]>('background.gradient', ['#8caaee', '#ca9ee6']),
    padding: config.get<number>('padding', 32),
    shadow: config.get<boolean>('shadow', true),
    cornerRadius: config.get<number>('cornerRadius', 12),
    windowControls: config.get<boolean>('windowControls', true),
    titleBar: config.get<boolean>('titleBar', true),
  };
}

export interface ExportSettings {
  scale: 1 | 2;
  exportFolder: string;
  copyToClipboardAfterExport: boolean;
}

/** Reads the PNG-export settings. Not pure (reads vscode config), so left untested like readFrameSettings. */
export function readExportSettings(): ExportSettings {
  const config = vscode.workspace.getConfiguration('snapframe');
  return {
    scale: config.get<1 | 2>('scale', 2),
    exportFolder: config.get<string>('exportFolder', ''),
    copyToClipboardAfterExport: config.get<boolean>('copyToClipboardAfterExport', false),
  };
}
