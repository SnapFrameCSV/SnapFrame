import * as vscode from 'vscode';
import * as path from 'node:path';
import { resolveCaptureSource } from './source';
import { prepareTerminalText } from './terminal';
import { buildFrameSvg, buildMultiFrameSvg, type FrameContent, type TextRun } from '../frame/svg';
import { readFrameSettings, readExportSettings, readLayoutSettings, readProFrameOptions } from '../frame/settings';
import { buildExportFileName } from '../export/filename';
import { FORMAT_LABELS, isFormatAllowed, type ExportFormat } from '../export/formats';
import { buildPdf, splitRgba } from '../export/pdf';
import { markdownImageLink } from '../export/markdown';
import { isPro } from '../licence/verify';
import { renderShell } from '../webview/shell';

interface LastCapture {
  html: string | null;
  fallbackText: string;
  fileName: string;
  startLine: number;
  rawLineCount: number;
}

interface ReturnTarget {
  document: vscode.TextDocument;
  viewColumn: vscode.ViewColumn | undefined;
  selection: vscode.Selection;
}

/**
 * One webview doing capture work. The preview session (from `snapframe.capture`)
 * is a long-lived singleton that re-renders on settings changes; a quick-snap
 * session is short-lived, auto-exports as soon as its frame is built, and
 * closes itself.
 */
type CaptureRole = 'single' | 'before' | 'after';

interface Session {
  panel: vscode.WebviewPanel;
  quick: boolean;
  /** Pro before/after: which half of a comparison this capture is. */
  role: CaptureRole;
  capture?: LastCapture;
  returnTo?: ReturnTarget;
  /** The last frame SVG built for this session, for vector export. */
  svg?: string;
  /** Batch export: save here without asking, and resolve `done` when the export has finished or failed. */
  exportFolder?: string;
  done?: () => void;
}

interface MeasuredPanel {
  content: FrameContent;
  fileName: string;
}

let previewSession: Session | undefined;
let configListener: vscode.Disposable | undefined;
/** The "before" half of a comparison, waiting for its "after". */
let pendingBefore: MeasuredPanel | undefined;
/** Both halves once compared, so settings changes re-render the comparison rather than the last single capture. */
let lastComparison: [MeasuredPanel, MeasuredPanel] | undefined;

/**
 * `snapframe.capture`: grabs the current selection (or whole file) as
 * syntax-highlighted HTML via the clipboard, and shows it framed (background,
 * padding, shadow, radius, optional window controls and title bar) in a live
 * preview webview, with an Export PNG button to rasterise and save it.
 */
export function runCapture(context: vscode.ExtensionContext): Promise<void> {
  return startCapture(context, false, 'single');
}

/**
 * Pro before/after: `snapframe.captureBefore` captures and previews the first
 * snippet and remembers it; `snapframe.captureAfter` captures the second and
 * renders both cards together (side by side or stacked, per settings), which
 * then exports like any other frame.
 */
export function runCaptureBefore(context: vscode.ExtensionContext): Promise<void> {
  if (!requirePro('Before/after comparison')) {
    return Promise.resolve();
  }
  return startCapture(context, false, 'before');
}

export function runCaptureAfter(context: vscode.ExtensionContext): Promise<void> {
  if (!requirePro('Before/after comparison')) {
    return Promise.resolve();
  }
  if (!pendingBefore) {
    void vscode.window.showInformationMessage('Snapframe: capture the "before" snippet first (Snapframe: Capture as \'Before\').');
    return Promise.resolve();
  }
  return startCapture(context, false, 'after');
}

function requirePro(feature: string): boolean {
  if (isPro()) {
    return true;
  }
  void vscode.window.showInformationMessage(`Snapframe: ${feature} is a Pro feature. Run "Snapframe: Buy Pro…" to unlock it.`);
  return false;
}

/**
 * `snapframe.quickSnap`: capture + export with the current settings and no
 * interactive preview. VS Code has no offscreen webview and the extension host
 * has no `Image`/`canvas`, and the clipboard-HTML capture itself needs a
 * focused webview for its paste event — so this runs the same pipeline in a
 * throwaway panel that exports the moment its frame is rendered, then closes
 * and hands focus back to the editor. Any open preview panel is left alone.
 */
export function runQuickSnap(context: vscode.ExtensionContext): Promise<void> {
  return startCapture(context, true, 'single');
}

/** Text that did not come from an editor (e.g. the terminal): rendered on the plain-text path, never via clipboard HTML. */
interface PlainSource {
  text: string;
  fileName: string;
  lineCount: number;
}

/**
 * `snapframe.captureTerminal` (Pro): the integrated terminal's selection,
 * copied via VS Code's own command (the only public way to read it), then
 * rendered on the plain-text path with the terminal's name as the title.
 */
export async function runCaptureTerminal(context: vscode.ExtensionContext): Promise<void> {
  if (!requirePro('Terminal capture')) {
    return;
  }
  const terminal = vscode.window.activeTerminal;
  if (!terminal) {
    void vscode.window.showWarningMessage('Snapframe: open a terminal and select some text in it first.');
    return;
  }
  const original = await vscode.env.clipboard.readText();
  await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
  const copied = await vscode.env.clipboard.readText();
  await vscode.env.clipboard.writeText(original);
  const wrapColumn = vscode.workspace.getConfiguration('snapframe').get<number>('wrapColumn', 0);
  const prepared = prepareTerminalText(copied === original ? '' : copied, wrapColumn);
  if (prepared.lineCount === 0) {
    void vscode.window.showWarningMessage('Snapframe: select some text in the terminal first.');
    return;
  }
  await startCapture(context, false, 'single', { text: prepared.text, fileName: terminal.name || 'terminal', lineCount: prepared.lineCount });
}

interface BatchOptions {
  exportFolder: string;
}

/**
 * `snapframe.exportAllSelections` (Pro): one image per selection (multi-cursor)
 * in the active editor, exported without prompting into the export folder —
 * asked for once if the setting is empty.
 */
export async function runExportAllSelections(context: vscode.ExtensionContext): Promise<void> {
  if (!requirePro('Batch export')) {
    return;
  }
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('Snapframe: open a file and make one or more selections first.');
    return;
  }
  const selections = editor.selections.filter((s) => !s.isEmpty);
  if (selections.length === 0) {
    void vscode.window.showWarningMessage('Snapframe: make one or more selections first (hold Alt/Option to add more).');
    return;
  }
  const folder = await resolveBatchFolder();
  if (!folder) {
    return;
  }
  const original = editor.selections;
  let exported = 0;
  try {
    for (const selection of selections) {
      editor.selections = [selection];
      await startCapture(context, true, 'single', undefined, { exportFolder: folder });
      exported++;
    }
  } finally {
    editor.selections = original;
  }
  vscode.window.setStatusBarMessage(`Snapframe: exported ${exported} image${exported === 1 ? '' : 's'} to ${folder}.`, 8000);
}

/** `snapframe.exportAllEditors` (Pro): one whole-file image per open text editor tab. */
export async function runExportAllEditors(context: vscode.ExtensionContext): Promise<void> {
  if (!requirePro('Batch export')) {
    return;
  }
  const uris: vscode.Uri[] = [];
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if (input instanceof vscode.TabInputText && !uris.some((u) => u.toString() === input.uri.toString())) {
        uris.push(input.uri);
      }
    }
  }
  if (uris.length === 0) {
    void vscode.window.showWarningMessage('Snapframe: no text editors are open.');
    return;
  }
  const folder = await resolveBatchFolder();
  if (!folder) {
    return;
  }
  const previous = vscode.window.activeTextEditor;
  let exported = 0;
  for (const uri of uris) {
    const editor = await vscode.window.showTextDocument(uri, { preview: false, preserveFocus: false });
    editor.selections = [new vscode.Selection(0, 0, 0, 0)];
    await startCapture(context, true, 'single', undefined, { exportFolder: folder });
    exported++;
  }
  if (previous && !previous.document.isClosed) {
    await vscode.window.showTextDocument(previous.document, { viewColumn: previous.viewColumn, preserveFocus: false });
  }
  vscode.window.setStatusBarMessage(`Snapframe: exported ${exported} image${exported === 1 ? '' : 's'} to ${folder}.`, 8000);
}

async function resolveBatchFolder(): Promise<string | undefined> {
  const { exportFolder } = readExportSettings();
  if (exportFolder) {
    return exportFolder;
  }
  const chosen = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, title: 'Folder for the exported images' });
  return chosen?.[0]?.fsPath;
}

async function startCapture(context: vscode.ExtensionContext, quick: boolean, role: CaptureRole, plain?: PlainSource, batch?: BatchOptions): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!plain && !editor) {
    void vscode.window.showWarningMessage('Snapframe: open a file and place your cursor or make a selection first.');
    return;
  }

  const originalClipboardText = await vscode.env.clipboard.readText();
  let source: LastCapture;
  let returnTo: ReturnTarget | undefined;
  if (plain) {
    source = { html: null, fallbackText: plain.text, fileName: plain.fileName, startLine: 1, rawLineCount: plain.lineCount };
  } else {
    const activeEditor = editor as vscode.TextEditor;
    const resolved = resolveCaptureSource(activeEditor);
    const originalSelection = activeEditor.selection;
    if (activeEditor.selection.isEmpty) {
      activeEditor.selection = new vscode.Selection(resolved.range.start, resolved.range.end);
    }
    try {
      await vscode.commands.executeCommand('editor.action.clipboardCopyWithSyntaxHighlightingAction');
    } finally {
      activeEditor.selection = originalSelection;
    }
    source = { html: null, fallbackText: resolved.text, fileName: resolved.fileName, startLine: resolved.startLine, rawLineCount: resolved.rawLineCount };
    returnTo = { document: activeEditor.document, viewColumn: activeEditor.viewColumn, selection: originalSelection };
  }

  const session = quick ? createSession(context, true) : getOrCreatePreviewSession(context);
  session.role = role;
  if (role !== 'after') {
    lastComparison = undefined;
  }
  if (quick) {
    session.returnTo = returnTo;
  }
  let finished: Promise<void> | undefined;
  if (batch) {
    session.exportFolder = batch.exportFolder;
    finished = new Promise<void>((resolve) => {
      session.done = resolve;
    });
    session.panel.onDidDispose(() => session.done?.());
  }
  session.panel.webview.html = renderShell(session.panel.webview.cspSource, quick);

  const readyDisposable = session.panel.webview.onDidReceiveMessage(async (message: { type: string; html?: string }) => {
    if (message.type !== 'captured-html') {
      return;
    }
    await vscode.env.clipboard.writeText(originalClipboardText);
    // A plain source ignores whatever HTML the paste happened to find on the clipboard.
    session.capture = { ...source, html: plain ? null : (message.html ?? null) };
    sendRender(session);
    readyDisposable.dispose();
  });

  if (!quick) {
    ensureConfigListener(context, session);
  }
  if (finished) {
    await finished;
  }
}

function ensureConfigListener(context: vscode.ExtensionContext, session: Session): void {
  if (configListener) {
    return;
  }
  configListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (!session.capture || !event.affectsConfiguration('snapframe')) {
      return;
    }
    sendRender(session);
  });
  context.subscriptions.push(configListener);
  session.panel.onDidDispose(() => {
    configListener?.dispose();
    configListener = undefined;
  });
}

interface PanelMessage {
  type: string;
  html?: string;
  lines?: TextRun[][];
  width?: number;
  height?: number;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  background?: string;
  fileName?: string;
  lineCount?: number;
  format?: string;
  bytes?: string;
  rgba?: string;
  cssWidth?: number;
  cssHeight?: number;
  clipboardAttempted?: boolean;
  clipboardOk?: boolean;
  message?: string;
}

const RASTER_FORMATS: ReadonlySet<string> = new Set(['png', 'webp']);

interface ClipboardOutcome {
  attempted: boolean;
  ok: boolean;
}

/**
 * Saves exported bytes in the given format. Writes straight to
 * `snapframe.exportFolder` when it is set; otherwise asks via `showSaveDialog`
 * (BUILD.md: "leave empty to be asked each time"). For rasters the webview
 * already tried the clipboard copy (it needs `navigator.clipboard`, which the
 * extension host does not have) — this only reports the combined outcome.
 * Pro-only formats are refused here too, so a stray message can't bypass the
 * webview's gating.
 */
async function saveExport(
  capture: LastCapture,
  bytes: Uint8Array,
  format: ExportFormat,
  clipboard: ClipboardOutcome,
  folderOverride?: string,
): Promise<void> {
  if (bytes.length === 0) {
    return;
  }
  const label = FORMAT_LABELS[format];
  if (!isFormatAllowed(format, isPro())) {
    void vscode.window.showInformationMessage(`Snapframe: ${label} export is a Pro feature. Run "Snapframe: Buy Pro…" to unlock it.`);
    return;
  }
  const settings = readExportSettings();
  const exportFolder = folderOverride ?? settings.exportFolder;
  const fileName = buildExportFileName(capture.fileName, capture.startLine, format);

  let targetUri: vscode.Uri;
  if (exportFolder) {
    targetUri = vscode.Uri.file(path.join(exportFolder, fileName));
  } else {
    const chosen = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(fileName),
      filters: { [label]: [format] },
    });
    if (!chosen) {
      vscode.window.setStatusBarMessage('Snapframe: export cancelled.', 4000);
      return;
    }
    targetUri = chosen;
  }

  try {
    await vscode.workspace.fs.writeFile(targetUri, bytes);
  } catch (error) {
    void vscode.window.showErrorMessage(`Snapframe: could not save the ${label} — ${String(error)}`);
    return;
  }

  const savedMessage = `Snapframe: saved ${targetUri.fsPath}`;
  if (settings.copyMarkdownLink && !clipboard.attempted) {
    // Pro: a ready-to-paste Markdown image link (never when the image itself
    // was just copied — the two would fight over the clipboard).
    const workspaceRoot = vscode.workspace.getWorkspaceFolder(targetUri)?.uri.fsPath;
    await vscode.env.clipboard.writeText(markdownImageLink(capture.fileName, targetUri.fsPath, workspaceRoot));
    vscode.window.setStatusBarMessage(`${savedMessage} and copied a Markdown link.`, 6000);
  } else if (clipboard.attempted && clipboard.ok) {
    vscode.window.setStatusBarMessage(`${savedMessage} and copied to clipboard.`, 6000);
  } else if (clipboard.attempted && !clipboard.ok) {
    vscode.window.setStatusBarMessage(`${savedMessage} — clipboard copy wasn't supported here, saved the file instead.`, 6000);
  } else {
    vscode.window.setStatusBarMessage(savedMessage, 6000);
  }
}

/** A standalone SVG file: the frame as built, with an XML declaration so any viewer opens it. */
function svgFileBytes(svg: string): Uint8Array {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`, 'utf8');
}

function sendRender(session: Session): void {
  if (!session.capture) {
    return;
  }
  void session.panel.webview.postMessage({
    type: 'render',
    html: session.capture.html,
    fallbackText: session.capture.fallbackText,
    fileName: session.capture.fileName,
    rawLineCount: session.capture.rawLineCount,
  });
}

function getOrCreatePreviewSession(context: vscode.ExtensionContext): Session {
  if (previewSession) {
    previewSession.panel.reveal(vscode.ViewColumn.Beside);
    return previewSession;
  }
  previewSession = createSession(context, false);
  previewSession.panel.onDidDispose(() => {
    previewSession = undefined;
  }, null, context.subscriptions);
  return previewSession;
}

function createSession(context: vscode.ExtensionContext, quick: boolean): Session {
  const panel = vscode.window.createWebviewPanel(
    quick ? 'snapframe.quickSnap' : 'snapframe.preview',
    quick ? 'Snapframe quick snap' : 'Snapframe',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: !quick,
      localResourceRoots: [],
    },
  );
  const session: Session = { panel, quick, role: 'single' };

  panel.webview.onDidReceiveMessage((message: PanelMessage) => {
    void handleMessage(session, message);
  }, null, context.subscriptions);

  return session;
}

async function handleMessage(session: Session, message: PanelMessage): Promise<void> {
  if (message.type === 'measured') {
    const panel: MeasuredPanel = {
      content: {
        lines: message.lines ?? [],
        width: message.width ?? 0,
        height: message.height ?? 0,
        startLine: session.capture?.startLine ?? 1,
        lineCount: message.lineCount ?? 1,
        fontFamily: message.fontFamily ?? 'monospace',
        fontSize: message.fontSize ?? 14,
        color: message.color ?? '#d4d4d4',
        background: message.background ?? '#1e1e1e',
      },
      fileName: message.fileName ?? '',
    };
    const settings = { ...readFrameSettings(), pro: await readProFrameOptions() };
    let svg: string;
    if (session.role === 'before') {
      pendingBefore = panel;
      svg = buildFrameSvg(panel.content, panel.fileName, settings);
      vscode.window.setStatusBarMessage('Snapframe: "before" captured — now select the "after" code and run Snapframe: Capture as \'After\'.', 8000);
    } else if (session.role === 'after' && (pendingBefore || lastComparison)) {
      // A settings change re-renders the "after" session; keep comparing the same pair.
      const pair: [MeasuredPanel, MeasuredPanel] = lastComparison && !pendingBefore ? [lastComparison[0], panel] : [pendingBefore as MeasuredPanel, panel];
      pendingBefore = undefined;
      lastComparison = pair;
      const layout = readLayoutSettings();
      svg = buildMultiFrameSvg(
        [
          { ...pair[0], label: layout.labels[0] },
          { ...pair[1], label: layout.labels[1] },
        ],
        settings,
        layout.comparison,
      );
    } else {
      svg = buildFrameSvg(panel.content, panel.fileName, settings);
    }
    session.svg = svg;
    const { scale, copyToClipboardAfterExport } = readExportSettings();
    void session.panel.webview.postMessage({
      type: 'svg',
      svg,
      scale,
      copyToClipboardAfterExport,
      autoExport: session.quick,
      pro: isPro(),
    });
    return;
  }

  if (message.type === 'export-image') {
    const capture = session.capture;
    const format = message.format ?? 'png';
    if (!capture || !RASTER_FORMATS.has(format)) {
      return;
    }
    if (session.quick) {
      // Close the throwaway panel before any save dialog so it is on screen
      // for as short a time as possible; the bytes are already in hand.
      session.panel.dispose();
    }
    await saveExport(
      capture,
      Buffer.from(message.bytes ?? '', 'base64'),
      format as ExportFormat,
      { attempted: message.clipboardAttempted ?? false, ok: message.clipboardOk ?? false },
      session.exportFolder,
    );
    if (session.quick) {
      await returnToEditor(session);
    }
    session.done?.();
    return;
  }

  if (message.type === 'export-pixels') {
    const capture = session.capture;
    if (!capture || !message.rgba || !message.width || !message.height) {
      return;
    }
    const { rgb, alpha, opaque } = splitRgba(Buffer.from(message.rgba, 'base64'));
    const pdf = buildPdf({
      pageWidth: message.cssWidth ?? message.width,
      pageHeight: message.cssHeight ?? message.height,
      pixelWidth: message.width,
      pixelHeight: message.height,
      rgb,
      alpha: opaque ? undefined : alpha,
    });
    await saveExport(capture, pdf, 'pdf', { attempted: false, ok: false });
    return;
  }

  if (message.type === 'export-svg') {
    if (!session.capture || !session.svg) {
      return;
    }
    await saveExport(session.capture, svgFileBytes(session.svg), 'svg', { attempted: false, ok: false });
    return;
  }

  if (message.type === 'export-failed') {
    void vscode.window.showErrorMessage(`Snapframe: export failed — ${message.message ?? 'unknown error'}`);
    if (session.quick) {
      session.panel.dispose();
      await returnToEditor(session);
    }
    session.done?.();
  }
}

async function returnToEditor(session: Session): Promise<void> {
  if (!session.returnTo || session.returnTo.document.isClosed) {
    return;
  }
  await vscode.window.showTextDocument(session.returnTo.document, {
    viewColumn: session.returnTo.viewColumn,
    selection: session.returnTo.selection,
    preserveFocus: false,
  });
}

