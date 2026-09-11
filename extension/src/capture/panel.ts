import * as vscode from 'vscode';
import { resolveCaptureSource } from './source';

let activePanel: vscode.WebviewPanel | undefined;

/**
 * `snapframe.capture`: grabs the current selection (or whole file) as
 * syntax-highlighted HTML via the clipboard, and shows it in a plain preview
 * webview. No frame styling and no export yet — those land in the next slice.
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
  panel.webview.html = renderShell(panel.webview, context, source.fileName, source.startLine);

  const disposable = panel.webview.onDidReceiveMessage(async (message: { type: string; html?: string }) => {
    if (message.type !== 'captured-html') {
      return;
    }
    await vscode.env.clipboard.writeText(originalClipboardText);
    void panel.webview.postMessage({
      type: 'render',
      html: message.html ?? null,
      fallbackText: source.text,
    });
    disposable.dispose();
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
  activePanel.onDidDispose(() => {
    activePanel = undefined;
  }, null, context.subscriptions);

  return activePanel;
}

function renderShell(webview: vscode.Webview, _context: vscode.ExtensionContext, fileName: string, startLine: number): string {
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
    body { font-family: var(--vscode-editor-font-family, monospace); padding: 0; margin: 0; }
    #status { padding: 8px 12px; color: var(--vscode-descriptionForeground); font-size: 12px; }
    #paste-target { position: absolute; opacity: 0; pointer-events: none; top: 0; left: 0; height: 1px; width: 1px; overflow: hidden; }
    #preview { padding: 16px; overflow: auto; }
    #preview pre { white-space: pre-wrap; }
  </style>
</head>
<body>
  <div id="status">Snapframe — ${escapeHtml(fileName)} (from line ${startLine})</div>
  <div id="paste-target" contenteditable="true"></div>
  <div id="preview">Capturing…</div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const pasteTarget = document.getElementById('paste-target');
    const preview = document.getElementById('preview');

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
      if (message.type !== 'render') {
        return;
      }
      if (message.html) {
        preview.innerHTML = message.html;
      } else {
        const pre = document.createElement('pre');
        pre.textContent = message.fallbackText;
        preview.replaceChildren(pre);
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
