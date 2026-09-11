import * as vscode from 'vscode';
import * as path from 'node:path';
import { resolveCaptureSource } from './source';
import { buildFrameSvg, type TextRun } from '../frame/svg';
import { readFrameSettings, readExportSettings } from '../frame/settings';
import { buildExportFileName } from '../export/filename';
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
interface Session {
  panel: vscode.WebviewPanel;
  quick: boolean;
  capture?: LastCapture;
  returnTo?: ReturnTarget;
}

let previewSession: Session | undefined;
let configListener: vscode.Disposable | undefined;

/**
 * `snapframe.capture`: grabs the current selection (or whole file) as
 * syntax-highlighted HTML via the clipboard, and shows it framed (background,
 * padding, shadow, radius, optional window controls and title bar) in a live
 * preview webview, with an Export PNG button to rasterise and save it.
 */
export function runCapture(context: vscode.ExtensionContext): Promise<void> {
  return startCapture(context, false);
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
  return startCapture(context, true);
}

async function startCapture(context: vscode.ExtensionContext, quick: boolean): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('Snapframe: open a file and place your cursor or make a selection first.');
    return;
  }

  const source = resolveCaptureSource(editor);
  const originalClipboardText = await vscode.env.clipboard.readText();
  const originalSelection = editor.selection;

  if (editor.selection.isEmpty) {
    editor.selection = new vscode.Selection(source.range.start, source.range.end);
  }

  try {
    await vscode.commands.executeCommand('editor.action.clipboardCopyWithSyntaxHighlightingAction');
  } finally {
    editor.selection = originalSelection;
  }

  const session = quick ? createSession(context, true) : getOrCreatePreviewSession(context);
  if (quick) {
    session.returnTo = { document: editor.document, viewColumn: editor.viewColumn, selection: originalSelection };
  }
  session.panel.webview.html = renderShell(session.panel.webview.cspSource, quick);

  const readyDisposable = session.panel.webview.onDidReceiveMessage(async (message: { type: string; html?: string }) => {
    if (message.type !== 'captured-html') {
      return;
    }
    await vscode.env.clipboard.writeText(originalClipboardText);
    session.capture = {
      html: message.html ?? null,
      fallbackText: source.text,
      fileName: source.fileName,
      startLine: source.startLine,
      rawLineCount: source.rawLineCount,
    };
    sendRender(session);
    readyDisposable.dispose();
  });

  if (!quick) {
    ensureConfigListener(context, session);
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
  bytes?: string;
  clipboardAttempted?: boolean;
  clipboardOk?: boolean;
  message?: string;
}

/**
 * Saves the PNG bytes the webview rasterised. Writes straight to
 * `snapframe.exportFolder` when it is set; otherwise asks via `showSaveDialog`
 * (BUILD.md: "leave empty to be asked each time"). The webview already tried
 * the clipboard copy (it needs `navigator.clipboard`, which the extension
 * host does not have) — this only reports the combined outcome.
 */
async function exportPng(
  capture: LastCapture,
  bytesBase64: string,
  clipboardAttempted: boolean,
  clipboardOk: boolean,
): Promise<void> {
  if (!bytesBase64) {
    return;
  }
  const { exportFolder } = readExportSettings();
  const fileName = buildExportFileName(capture.fileName, capture.startLine);

  let targetUri: vscode.Uri;
  if (exportFolder) {
    targetUri = vscode.Uri.file(path.join(exportFolder, fileName));
  } else {
    const chosen = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(fileName),
      filters: { Images: ['png'] },
    });
    if (!chosen) {
      vscode.window.setStatusBarMessage('Snapframe: export cancelled.', 4000);
      return;
    }
    targetUri = chosen;
  }

  try {
    await vscode.workspace.fs.writeFile(targetUri, Buffer.from(bytesBase64, 'base64'));
  } catch (error) {
    void vscode.window.showErrorMessage(`Snapframe: could not save the PNG — ${String(error)}`);
    return;
  }

  const savedMessage = `Snapframe: saved ${targetUri.fsPath}`;
  if (clipboardAttempted && clipboardOk) {
    vscode.window.setStatusBarMessage(`${savedMessage} and copied to clipboard.`, 6000);
  } else if (clipboardAttempted && !clipboardOk) {
    vscode.window.setStatusBarMessage(`${savedMessage} — clipboard copy wasn't supported here, saved the file instead.`, 6000);
  } else {
    vscode.window.setStatusBarMessage(savedMessage, 6000);
  }
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
  const session: Session = { panel, quick };

  panel.webview.onDidReceiveMessage((message: PanelMessage) => {
    void handleMessage(session, message);
  }, null, context.subscriptions);

  return session;
}

async function handleMessage(session: Session, message: PanelMessage): Promise<void> {
  if (message.type === 'measured') {
    const svg = buildFrameSvg(
      {
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
      message.fileName ?? '',
      readFrameSettings(),
    );
    const { scale, copyToClipboardAfterExport } = readExportSettings();
    void session.panel.webview.postMessage({
      type: 'svg',
      svg,
      scale,
      copyToClipboardAfterExport,
      autoExport: session.quick,
    });
    return;
  }

  if (message.type === 'export-png') {
    const capture = session.capture;
    if (!capture) {
      return;
    }
    if (session.quick) {
      // Close the throwaway panel before any save dialog so it is on screen
      // for as short a time as possible; the bytes are already in hand.
      session.panel.dispose();
    }
    await exportPng(capture, message.bytes ?? '', message.clipboardAttempted ?? false, message.clipboardOk ?? false);
    if (session.quick) {
      await returnToEditor(session);
    }
    return;
  }

  if (message.type === 'export-failed') {
    void vscode.window.showErrorMessage(`Snapframe: export failed — ${message.message ?? 'unknown error'}`);
    if (session.quick) {
      session.panel.dispose();
      await returnToEditor(session);
    }
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

