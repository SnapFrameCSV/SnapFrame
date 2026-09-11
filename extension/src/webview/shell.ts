/**
 * The HTML/CSS/JS shell shown inside the Snapframe capture webview: paste-capture,
 * measurement, SVG preview and PNG export/rasterisation. Pure and vscode-free
 * (takes the webview's CSP source as a plain string) so it can be loaded directly
 * in a real browser for testing — see src/test/webview-shell.test.ts — without
 * stubbing the `vscode` module.
 */
export function renderShell(cspSource: string, quick: boolean): string {
  const nonce = makeNonce();
  const csp = [
    `default-src 'none'`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${cspSource} blob: data:`,
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
      color: var(--vscode-editor-foreground, #d4d4d4);
      background: var(--vscode-editor-background, #1e1e1e);
    }
    #preview { padding: 16px; overflow: auto; }
    #preview svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    #toolbar { padding: 0 12px 8px; }
    #toolbar button {
      display: none;
      font-family: inherit;
      font-size: 12px;
      padding: 4px 10px;
      margin-right: 6px;
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
    #toolbar button:disabled { opacity: 0.6; cursor: default; }
  </style>
</head>
<body>
  <div id="status">${quick ? 'Snapframe — quick snap…' : 'Snapframe — capturing…'}</div>
  <div id="toolbar"${quick ? ' hidden' : ''}><button id="export-btn">Export PNG</button><button id="export-svg-btn">Export SVG</button></div>
  <div id="paste-target" contenteditable="true"></div>
  <div id="measure"></div>
  <div id="preview"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const quick = ${quick ? 'true' : 'false'};
    const pasteTarget = document.getElementById('paste-target');
    const measure = document.getElementById('measure');
    const preview = document.getElementById('preview');
    const status = document.getElementById('status');
    const exportBtn = document.getElementById('export-btn');
    const exportSvgBtn = document.getElementById('export-svg-btn');

    let lastFileName = '';
    let lastSvgText = null;
    let lastDims = null;
    let lastScale = 2;
    let lastCopyToClipboard = false;
    let lastPro = false;

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
        lastPro = !!message.pro;
        const dims = message.svg.match(/<svg[^>]*\\swidth="(\\d+)"[^>]*\\sheight="(\\d+)"/);
        lastDims = dims ? { width: Number(dims[1]), height: Number(dims[2]) } : null;
        exportBtn.style.display = lastDims && !quick ? 'inline-block' : 'none';
        exportSvgBtn.style.display = lastDims && !quick && lastPro ? 'inline-block' : 'none';
        if (message.autoExport) {
          if (lastDims) {
            void exportPng();
          } else {
            vscode.postMessage({ type: 'export-failed', message: 'frame has no measurable size' });
          }
        }
      }
    });

    exportBtn.addEventListener('click', () => { void exportPng(); });
    // The host already holds the SVG it built; it only needs to be told to save it.
    exportSvgBtn.addEventListener('click', () => { vscode.postMessage({ type: 'export-svg' }); });

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
        const reason = err && err.message ? err.message : String(err);
        status.textContent = 'Snapframe — export failed: ' + reason;
        vscode.postMessage({ type: 'export-failed', message: reason });
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
      exportSvgBtn.style.display = 'none';
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

      // VS Code's highlighter wraps the copy in one element carrying the
      // editor's font, colour and background as inline styles; the fallback
      // <pre> inherits #measure's. Either way, read the resolved values.
      const probe = measure.firstElementChild || measure;
      const probeStyle = getComputedStyle(probe);
      const fontFamily = probeStyle.fontFamily || 'monospace';
      const fontSize = parseFloat(probeStyle.fontSize) || 14;
      const color = probeStyle.color || '#d4d4d4';
      const background = opaqueBackground(probeStyle) || opaqueBackground(getComputedStyle(measure)) || '#1e1e1e';

      const lines = extractLines(measure, lineCount);
      vscode.postMessage({ type: 'measured', lines, width, height, fontFamily, fontSize, color, background, fileName, lineCount });
    }

    function opaqueBackground(style) {
      const value = style.backgroundColor;
      if (!value || value === 'transparent' || /^rgba\\(.*,\\s*0\\)$/.test(value)) {
        return null;
      }
      return value;
    }

    // Flattens the measured DOM into rows of styled text runs. Rows come
    // from block boundaries (VS Code emits one <div> per line, with <br> for
    // an empty one) and from literal newlines (the plain-text fallback's
    // <pre>). Each run carries only the style that differs from the
    // wrapper's defaults, resolved via getComputedStyle so nested spans and
    // inherited styles come out right. Trimmed/padded to lineCount so the
    // contenteditable convention of a trailing <div><br></div> never adds a
    // phantom row.
    function extractLines(root, lineCount) {
      const rootStyle = getComputedStyle(root.firstElementChild || root);
      const lines = [[]];
      let pendingBreak = false;

      function currentLine() {
        return lines[lines.length - 1];
      }

      function newLine() {
        lines.push([]);
        pendingBreak = false;
      }

      function pushRun(text, element) {
        if (!text) {
          return;
        }
        if (pendingBreak) {
          newLine();
        }
        const style = getComputedStyle(element);
        const run = { text: text };
        if (style.color && style.color !== rootStyle.color) {
          run.color = style.color;
        }
        const weight = parseInt(style.fontWeight, 10);
        if ((weight >= 600 || style.fontWeight === 'bold') && !(parseInt(rootStyle.fontWeight, 10) >= 600)) {
          run.bold = true;
        }
        if (style.fontStyle === 'italic' && rootStyle.fontStyle !== 'italic') {
          run.italic = true;
        }
        const last = currentLine()[currentLine().length - 1];
        if (last && last.color === run.color && last.bold === run.bold && last.italic === run.italic) {
          last.text += text;
        } else {
          currentLine().push(run);
        }
      }

      function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const parts = node.data.split('\\n');
          for (let i = 0; i < parts.length; i++) {
            if (i > 0) {
              newLine();
            }
            pushRun(parts[i], node.parentElement);
          }
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return;
        }
        if (node.tagName === 'BR') {
          if (pendingBreak) {
            newLine();
          }
          pendingBreak = true;
          return;
        }
        const display = getComputedStyle(node).display;
        const isBlock = display === 'block' || display === 'list-item' || display === 'flex' || display === 'grid';
        if (isBlock && (currentLine().length > 0 || pendingBreak)) {
          newLine();
        }
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
        }
        if (isBlock) {
          pendingBreak = true;
        }
      }

      walk(root);
      while (lines.length > lineCount) {
        const tail = lines[lines.length - 1];
        if (tail.length > 0) {
          break;
        }
        lines.pop();
      }
      while (lines.length < lineCount) {
        lines.push([]);
      }
      return lines.slice(0, lineCount);
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
