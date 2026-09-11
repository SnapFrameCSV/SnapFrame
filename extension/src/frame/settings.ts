import * as vscode from 'vscode';
import * as path from 'node:path';
import { DEFAULT_PRO_FRAME_OPTIONS, FrameSettings, QR_MAX_SIZE, QR_MIN_SIZE, type FrameCallout, type ProFrameOptions } from './svg';
import { parseLineRanges } from './ranges';
import { MAX_QR_BYTES, encodeQr } from './qr';
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
    highlightLines: parseLineRanges(config.get<string>('highlightLines', '')),
    highlightColor: config.get<string>('highlightColor', DEFAULT_PRO_FRAME_OPTIONS.highlightColor),
    focusDim: config.get<boolean>('focusDim', false),
    callouts: readCallouts(config.get<unknown>('callouts', [])),
    qr: readQr(config.get<string>('qr.text', ''), config.get<number>('qr.size', 80)),
  };
  const pro = isPro();
  const imagePath = config.get<string>('background.image', '').trim();
  if (pro && imagePath) {
    requested.backgroundImage = await loadBackgroundImage(imagePath);
  }
  return allowedProFrameOptions(requested, pro, DEFAULT_PRO_FRAME_OPTIONS);
}

export interface LayoutSettings {
  comparison: 'side-by-side' | 'stacked';
  labels: [string, string];
}

/** Layout for the Pro before/after comparison. */
export function readLayoutSettings(): LayoutSettings {
  const config = vscode.workspace.getConfiguration('snapframe');
  const comparison = config.get<string>('layout.comparison', 'side-by-side');
  const labels = config.get<unknown>('layout.labels', ['Before', 'After']);
  const [before, after] = Array.isArray(labels) && labels.length === 2 && labels.every((l) => typeof l === 'string') ? (labels as [string, string]) : ['Before', 'After'];
  return { comparison: comparison === 'stacked' ? 'stacked' : 'side-by-side', labels: [before, after] };
}

let warnedQrText: string | undefined;

/** Validates the QR text once up front so an unencodable value warns instead of silently drawing nothing. */
function readQr(text: string, size: number): ProFrameOptions['qr'] {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    encodeQr(trimmed);
  } catch {
    if (warnedQrText !== trimmed) {
      warnedQrText = trimmed;
      void vscode.window.showWarningMessage(`Snapframe: the QR text is too long to encode (max ${MAX_QR_BYTES} bytes); skipping the QR code.`);
    }
    return undefined;
  }
  return { text: trimmed, size: Math.min(QR_MAX_SIZE, Math.max(QR_MIN_SIZE, Number.isFinite(size) ? size : 80)) };
}

function readCallouts(value: unknown): FrameCallout[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((c): c is { line: number; text: string } => typeof c === 'object' && c !== null && Number.isInteger((c as { line?: unknown }).line) && typeof (c as { text?: unknown }).text === 'string')
    .map((c) => ({ line: c.line, text: c.text }));
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
  /** Pro: copy a `![name](path)` link after saving. Always false without a key. */
  copyMarkdownLink: boolean;
}

/** Reads the export settings with the Pro gates applied. Not pure (reads vscode config), so left untested like readFrameSettings. */
export function readExportSettings(): ExportSettings {
  const config = vscode.workspace.getConfiguration('snapframe');
  const pro = isPro();
  return {
    scale: allowedScale(config.get<number>('scale', 2), pro),
    exportFolder: config.get<string>('exportFolder', ''),
    copyToClipboardAfterExport: config.get<boolean>('copyToClipboardAfterExport', false),
    copyMarkdownLink: pro && config.get<boolean>('copyMarkdownLinkAfterExport', false),
  };
}
