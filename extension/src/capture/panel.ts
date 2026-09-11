import * as vscode from 'vscode';
import * as path from 'node:path';
import { resolveCaptureSource } from './source';
import { buildFrameSvg } from '../frame/svg';
import { readFrameSettings, readExportSettings } from '../frame/settings';
import { buildExportFileName } from '../export/filename';

let activePanel: vscode.WebviewPanel | undefined;
let configListener: vscode.Disposable | undefined;

interface LastCapture {
  html: string | null;
  fallbackText: string;
  fileName: string;
  startLine: number;
  rawLineCount: number;
}

let lastCapture: LastCapture | undefined;

/**
 * `snapframe.capture`: grabs the current selection (or whole file) as
 * syntax-highlighted HTML via the clipboard, and shows it framed (background,
 * padding, shadow, radius, optional window controls and title bar) in a live
 * preview webview, with an Export PNG button to rasterise and save it.
 */
export async function runCapture(context: vscode.ExtensionContext): Promise<void> {
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

  const panel = getOrCreatePanel(context);
  panel.webview.html = renderShell(panel.webview);

  const readyDisposable = panel.webview.onDidReceiveMessage(async (message: { type: string; html?: string }) => {
    if (message.type !== 'captured-html') {
      return;
    }
    await vscode.env.clipboard.writeText(originalClipboardText);
    lastCapture = {
      html: message.html ?? null,
      fallbackText: source.text,
      fileName: source.fileName,
      startLine: source.startLine,
      rawLineCount: source.rawLineCount,
    };
    sendRender(panel, lastCapture);
    readyDisposable.dispose();
  });

  ensureConfigListener(context, panel);
}

function ensureConfigListener(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): void {
  if (configListener) {
    return;
  }
  configListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (!lastCapture || !event.affectsConfiguration('snapframe')) {
      return;
    }
    sendRender(panel, lastCapture);
  });
  context.subscriptions.push(configListener);
  panel.onDidDispose(() => {
    configListener?.dispose();
    configListener = undefined;
  });
}

interface PanelMessage {
  type: string;
  html?: string;
  width?: number;
  height?: number;
  fileName?: string;
  lineCount?: number;
  bytes?: string;
  clipboardAttempted?: boolean;
  clipboardOk?: boolean;
}

/**
 * Saves the PNG bytes the webview rasterised. Writes straight to
 * `snapframe.exportFolder` when it is set; otherwise asks via `showSaveDialog`
 * (BUILD.md: "leave empty to be asked each time"). The webview already tried
 * the clipboard copy (it needs `navigator.clipboard`, which the extension
 * host does not have) — this only reports the combined outcome.
 */
async function exportPng(bytesBase64: string, clipboardAttempted: boolean, clipboardOk: boolean): Promise<void> {
  if (!lastCapture || !bytesBase64) {
    return;
  }
  const { exportFolder } = readExportSettings();
  const fileName = buildExportFileName(lastCapture.fileName, lastCapture.startLine);

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

function sendRender(panel: vscode.WebviewPanel, capture: LastCapture): void {
  void panel.webview.postMessage({
    type: 'render',
    html: capture.html,
    fallbackText: capture.fallbackText,
    fileName: capture.fileName,
    rawLineCount: capture.rawLineCount,
  });
}

function getOrCreatePanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  if (activePanel) {
    activePanel.reveal(vscode.ViewColumn.Beside);
    return activePanel;
  }

  activePanel = vscode.window.createWebviewPanel('snapframe.preview', 'Snapframe', vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [],
  });

  activePanel.webview.onDidReceiveMessage((message: PanelMessage) => {
    if (message.type === 'measured') {
      const svg = buildFrameSvg(
        {
          html: message.html ?? '',
          width: message.width ?? 0,
          height: message.height ?? 0,
          startLine: lastCapture?.startLine ?? 1,
          lineCount: message.lineCount ?? 1,
        },
        message.fileName ?? '',
        readFrameSettings(),
      );
      const { scale, copyToClipboardAfterExport } = readExportSettings();
      void activePanel?.webview.postMessage({ type: 'svg', svg, scale, copyToClipboardAfterExport });
      return;
    }
    if (message.type === 'export-png') {
      void exportPng(message.bytes ?? '', message.clipboardAttempted ?? false, message.clipboardOk ?? false);
    }
  });

  activePanel.onDidDispose(() => {
    activePanel = undefined;
    lastCapture = undefined;
  }, null, context.subscriptions);

  return activePanel;
}

function renderShell(webview: vscode.Webview): string {
  const nonce = makeNonce();
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${webview.cspSource} blob: data:`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>Snapframe preview</title>
  <style>
    body { font-family: var(--vscode-editor-font-family, monospace); padding: 0; margin: 0; background: var(--vscode-editor-background); }
    #status { padding: 8px 12px; color: var(--vscode-descriptionForeground); font-size: 12px; }
    #paste-target { position: absolute; opacity: 0; pointer-events: none; top: 0; left: 0; height: 1px; width: 1px; overflow: hidden; }
    #measure {
      position: absolute;
      visibility: hidden;
      pointer-events: none;
      top: 0;
      left: 0;
      display: inline-block;
      white-space: pre;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 14px);
      line-height: 1.5;
      padding: 16px;
    }
    #preview { padding: 16px; overflow: auto; }
    #preview svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    #toolbar { padding: 0 12px 8px; }
    #export-btn {
      display: none;
      font-family: inherit;
      font-size: 12px;
      padding: 4px 10px;
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
    #export-btn:disabled { opacity: 0.6; cursor: default; }
  </style>
</head>
<body>
  <div id="status">Snapframe — capturing…</div>
  <div id="toolbar"><button id="export-btn">Export PNG</button></div>
  <div id="paste-target" contenteditable="true"></div>
  <div id="measure"></div>
  <div id="preview"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const pasteTarget = document.getElementById('paste-target');
    const measure = document.getElementById('measure');
    const preview = document.getElementById('preview');
    const status = document.getElementById('status');
    const exportBtn = document.getElementById('export-btn');

    let lastFileName = '';
    let lastSvgText = null;
    let lastDims = null;
    let lastScale = 2;
    let lastCopyToClipboard = false;

    pasteTarget.addEventListener('paste', (event) => {
      event.preventDefault();
      const html = event.clipboardData ? event.clipboardData.getData('text/html') : '';
      vscode.postMessage({ type: 'captured-html', html: html || null });
    });

    pasteTarget.focus();
    const pasted = document.execCommand('paste');
    if (!pasted) {
      vscode.postMessage({ type: 'captured-html', html: null });
    }

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'render') {
        renderCapture(message.html, message.fallbackText, message.fileName, message.rawLineCount);
      } else if (message.type === 'svg') {
        status.textContent = 'Snapframe — ' + lastFileName;
        preview.innerHTML = message.svg;
        lastSvgText = message.svg;
        lastScale = message.scale || 2;
        lastCopyToClipboard = !!message.copyToClipboardAfterExport;
        const dims = message.svg.match(/<svg[^>]*\\swidth="(\\d+)"[^>]*\\sheight="(\\d+)"/);
        lastDims = dims ? { width: Number(dims[1]), height: Number(dims[2]) } : null;
        exportBtn.style.display = lastDims ? 'inline-block' : 'none';
      }
    });

    exportBtn.addEventListener('click', () => { void exportPng(); });

    async function exportPng() {
      if (!lastSvgText || !lastDims) {
        return;
      }
      exportBtn.disabled = true;
      const previousStatus = status.textContent;
      status.textContent = 'Snapframe — exporting…';
      let objectUrl;
      try {
        const svgBlob = new Blob([lastSvgText], { type: 'image/svg+xml' });
        objectUrl = URL.createObjectURL(svgBlob);
        const img = new Image();
        const loaded = new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('image decode failed'));
        });
        img.src = objectUrl;
        await loaded;

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(lastDims.width * lastScale));
        canvas.height = Math.max(1, Math.round(lastDims.height * lastScale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) {
          throw new Error('canvas produced no image data');
        }

        let clipboardAttempted = false;
        let clipboardOk = false;
        if (lastCopyToClipboard) {
          clipboardAttempted = true;
          try {
            if (navigator.clipboard && window.ClipboardItem) {
              await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
              clipboardOk = true;
            }
          } catch (err) {
            clipboardOk = false;
          }
        }

        const buffer = await blob.arrayBuffer();
        const byteArray = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < byteArray.length; i++) {
          binary += String.fromCharCode(byteArray[i]);
        }
        const base64 = btoa(binary);
        vscode.postMessage({ type: 'export-png', bytes: base64, clipboardAttempted, clipboardOk });
        status.textContent = previousStatus;
      } catch (err) {
        status.textContent = 'Snapframe — export failed: ' + (err && err.message ? err.message : String(err));
      } finally {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
        exportBtn.disabled = false;
      }
    }

    function renderCapture(html, fallbackText, fileName, rawLineCount) {
      status.textContent = 'Snapframe — ' + fileName;
      lastFileName = fileName;
      exportBtn.style.display = 'none';
      measure.innerHTML = '';
      if (html) {
        measure.innerHTML = html;
      } else {
        const pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.textContent = fallbackText;
        measure.appendChild(pre);
      }
      const width = Math.ceil(measure.scrollWidth);
      const height = Math.ceil(measure.scrollHeight);
      // The highlighted-HTML path is never re-wrapped, so its row count is the
      // raw selection's line span; the plain-text fallback went through
      // soft-wrap, so its row count must come from the text actually shown.
      const lineCount = html ? rawLineCount : Math.max(1, fallbackText.split('\\n').length);
      vscode.postMessage({ type: 'measured', html: measure.innerHTML, width, height, fileName, lineCount });
    }
  </script>
</body>
</html>`;
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
