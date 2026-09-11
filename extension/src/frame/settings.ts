import * as vscode from 'vscode';
import * as path from 'node:path';
import { DEFAULT_PRO_FRAME_OPTIONS, FrameSettings, type ProFrameOptions } from './svg';
import { allowedBackgroundType, allowedProFrameOptions, allowedScale, type ExportScale } from '../export/formats';
import { isPro } from '../licence/verify';

const MAX_BACKGROUND_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * Reads the Pro frame extras. The background image file is read here and
 * embedded as a data: URI so the SVG stays self-contained (and so the
 * rasteriser never fetches a file: URL, which would taint the canvas).
 * A missing/oversized/unsupported file is reported once and skipped.
 */
export async function readProFrameOptions(): Promise<ProFrameOptions> {
  const config = vscode.workspace.getConfiguration('snapframe');
  const captionText = config.get<string>('caption.text', '').trim();
  const requested: ProFrameOptions = {
    gradientAngle: config.get<number>('background.gradientAngle', 135),
    gradientStops: config.get<string[]>('background.gradientStops', []).filter((c) => typeof c === 'string' && c.trim()),
    caption: captionText
      ? {
          text: captionText,
          color: config.get<string>('caption.color', '#ffffff'),
          position: config.get<'left' | 'center' | 'right'>('caption.position', 'right'),
        }
      : undefined,
  };
  const pro = isPro();
  const imagePath = config.get<string>('background.image', '').trim();
  if (pro && imagePath) {
    requested.backgroundImage = await loadBackgroundImage(imagePath);
  }
  return allowedProFrameOptions(requested, pro, DEFAULT_PRO_FRAME_OPTIONS);
}

async function loadBackgroundImage(imagePath: string): Promise<string | undefined> {
  const mime = IMAGE_MIME_BY_EXTENSION[path.extname(imagePath).toLowerCase()];
  if (!mime) {
    void vscode.window.showWarningMessage(`Snapframe: background image must be a .png, .jpg, .webp or .gif file (got ${path.basename(imagePath)}).`);
    return undefined;
  }
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(imagePath));
    if (bytes.byteLength > MAX_BACKGROUND_IMAGE_BYTES) {
      void vscode.window.showWarningMessage('Snapframe: background image is larger than 5 MB; skipping it.');
      return undefined;
    }
    return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  } catch {
    void vscode.window.showWarningMessage(`Snapframe: could not read the background image at ${imagePath}.`);
    return undefined;
  }
}

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
    pro: DEFAULT_PRO_FRAME_OPTIONS,
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
