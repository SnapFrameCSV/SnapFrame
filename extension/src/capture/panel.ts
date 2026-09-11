import * as vscode from 'vscode';
import { resolveCaptureSource } from './source';
import { buildFrameSvg } from '../frame/svg';
import { readFrameSettings } from '../frame/settings';

let activePanel: vscode.WebviewPanel | undefined;
let configListener: vscode.Disposable | undefined;

interface LastCapture {
  html: string | null;
  fallbackText: string;
  fileName: string;
}

let lastCapture: LastCapture | undefined;

/**
 * `snapframe.capture`: grabs the current selection (or whole file) as
 * syntax-highlighted HTML via the clipboard, and shows it framed (background,
 * padding, shadow, radius, optional window controls and title bar) in a live
 * preview webview. PNG export is not wired yet — that is the next sub-step.
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
    lastCapture = { html: message.html ?? null, fallbackText: source.text, fileName: source.fileName };
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

function sendRender(panel: vscode.WebviewPanel, capture: LastCapture): void {
  void panel.webview.postMessage({
    type: 'render',
    html: capture.html,
    fallbackText: capture.fallbackText,
    fileName: capture.fileName,
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

  activePanel.webview.onDidReceiveMessage((message: { type: string; html?: string; width?: number; height?: number; fileName?: string }) => {
    if (message.type !== 'measured') {
      return;
    }
    const svg = buildFrameSvg(
      { html: message.html ?? '', width: message.width ?? 0, height: message.height ?? 0 },
      message.fileName ?? '',
      readFrameSettings(),
    );
    void activePanel?.webview.postMessage({ type: 'svg', svg });
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
  </style>
</head>
<body>
  <div id="status">Snapframe — capturing…</div>
  <div id="paste-target" contenteditable="true"></div>
  <div id="measure"></div>
  <div id="preview"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const pasteTarget = document.getElementById('paste-target');
    const measure = document.getElementById('measure');
    const preview = document.getElementById('preview');
    const status = document.getElementById('status');

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
        renderCapture(message.html, message.fallbackText, message.fileName);
      } else if (message.type === 'svg') {
        status.textContent = 'Snapframe';
        preview.innerHTML = message.svg;
      }
    });

    function renderCapture(html, fallbackText, fileName) {
      status.textContent = 'Snapframe — ' + fileName;
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
      vscode.postMessage({ type: 'measured', html: measure.innerHTML, width, height, fileName });
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
