/// <reference lib="dom" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { renderShell } from '../webview/shell';
import { DEFAULT_PRO_FRAME_OPTIONS, buildFrameSvg, type FrameContent, type FrameSettings, type TextRun } from '../frame/svg';
import { buildPdf, splitRgba } from '../export/pdf';

/**
 * Golden-image suite (BUILD.md Slice 2 sub-step 4): loads the real webview
 * shell in headless Chromium via Playwright and drives it exactly as the
 * extension host does — paste-fallback on load, a `render` message, then
 * the `svg` message built from what the shell measured — and checks that a
 * decodable PNG of the right size and colours comes back. Nothing in this
 * sandbox or in `node:test` runs browser JS otherwise, so this is the only
 * place the paste-fallback, DOM-walk, measure, dims-regex and rasterise
 * paths are exercised for real.
 *
 * History: the first version of this file found that the original
 * `<foreignObject>`-based frame could never be exported — browsers
 * unconditionally taint any canvas such an SVG image is drawn into. The
 * frame is now native SVG text (see frame/svg.ts); the "produces a real PNG"
 * assertions below are the regression guard for that.
 */

// The sandbox this suite develops in ships a pinned Chromium build outside
// Playwright's own download cache; prefer it over triggering a download,
// which this sandbox's network policy blocks. CI has no such path, installs
// its own Chromium (see .github/workflows/ci.yml) and falls through to
// Playwright's default resolution.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';

function launchOptions(): { executablePath?: string } {
  return existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {};
}

// A fixed URL fulfilled locally (never actually fetched) rather than a
// data: navigation: a data: document has an opaque origin, and blob: URLs
// minted from one taint canvases on their own, which would mask real
// problems in the export path. Routing a real https URL keeps the origin
// ordinary — like a real webview's vscode-webview:// origin — while still
// giving addInitScript a real navigation to hook.
const SHELL_URL = 'https://snapframe.invalid/preview';

interface Measured {
  lines: TextRun[][];
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  background: string;
  fileName: string;
  lineCount: number;
}

async function loadShell(browser: Browser, quick: boolean): Promise<Page> {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    (window as unknown as { __messages: unknown[] }).__messages = [];
    (window as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
      postMessage: (message: unknown) => {
        (window as unknown as { __messages: unknown[] }).__messages.push(message);
      },
      setState: () => undefined,
      getState: () => undefined,
    });
  });
  const html = renderShell('https://vscode-resource.test', quick);
  await page.route(SHELL_URL, (route) => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(SHELL_URL);
  await waitForMessageType(page, 'captured-html');
  return page;
}

function messages(page: Page): Promise<Array<{ type: string; [key: string]: unknown }>> {
  return page.evaluate(() => (window as unknown as { __messages: Array<{ type: string }> }).__messages);
}

async function waitForMessageType(page: Page, ...types: string[]): Promise<void> {
  await page.waitForFunction(
    (wanted) => (window as unknown as { __messages: Array<{ type: string }> }).__messages.some((m) => wanted.includes(m.type)),
    types,
  );
}

async function render(page: Page, html: string | null, fallbackText: string, fileName: string, rawLineCount: number): Promise<Measured> {
  await page.evaluate(
    (args) => {
      window.postMessage({ type: 'render', ...args }, '*');
    },
    { html, fallbackText, fileName, rawLineCount },
  );
  await waitForMessageType(page, 'measured');
  const found = (await messages(page)).find((m) => m.type === 'measured');
  return found as unknown as Measured;
}

function toContent(measured: Measured, startLine: number): FrameContent {
  return {
    lines: measured.lines,
    width: measured.width,
    height: measured.height,
    startLine,
    lineCount: measured.lineCount,
    fontFamily: measured.fontFamily,
    fontSize: measured.fontSize,
    color: measured.color,
    background: measured.background,
  };
}

async function sendSvg(page: Page, svg: string, scale: number, autoExport: boolean, pro = false): Promise<void> {
  await page.evaluate(
    (args) => {
      window.postMessage(
        { type: 'svg', svg: args.svg, scale: args.scale, copyToClipboardAfterExport: false, autoExport: args.autoExport, pro: args.pro },
        '*',
      );
    },
    { svg, scale, autoExport, pro },
  );
}

function buttonDisplay(page: Page, id: string): Promise<string | undefined> {
  return page.evaluate((buttonId) => document.getElementById(buttonId)?.style.display, id);
}

async function exportedImage(page: Page, format: 'png' | 'webp'): Promise<Buffer> {
  await waitForMessageType(page, 'export-image', 'export-failed');
  const exported = (await messages(page)).find((m) => m.type === 'export-image' || m.type === 'export-failed') as {
    type: string;
    format?: string;
    bytes?: string;
    message?: string;
  };
  assert.equal(exported.type, 'export-image', exported.message ? `export failed: ${exported.message}` : undefined);
  assert.equal(exported.format, format);
  const bytes = Buffer.from(exported.bytes ?? '', 'base64');
  if (format === 'png') {
    assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'starts with the PNG magic number');
  } else {
    assert.equal(bytes.toString('latin1', 0, 4), 'RIFF');
    assert.equal(bytes.toString('latin1', 8, 12), 'WEBP');
  }
  return bytes;
}

const exportedPng = (page: Page): Promise<Buffer> => exportedImage(page, 'png');

async function clearMessages(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __messages: unknown[] }).__messages.length = 0;
  });
}

function pngSize(bytes: Buffer): { width: number; height: number } {
  // IHDR is always the first chunk: 8-byte signature, 4-byte length, "IHDR", then width and height.
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** Decodes a PNG in the page and samples pixels, returned as [r, g, b, a]. */
async function samplePixels(page: Page, png: Buffer, points: Array<[number, number]>): Promise<number[][]> {
  return page.evaluate(
    async (args) => {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('png decode failed'));
        img.src = 'data:image/png;base64,' + args.base64;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return args.points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
    },
    { base64: png.toString('base64'), points },
  );
}

function svgDims(svg: string): { width: number; height: number } {
  const match = svg.match(/<svg[^>]*\swidth="(\d+)"[^>]*\sheight="(\d+)"/);
  assert.ok(match, 'svg carries integer width/height');
  return { width: Number(match[1]), height: Number(match[2]) };
}

const TEST_FRAME_SETTINGS: FrameSettings = {
  backgroundType: 'solid',
  backgroundColor: '#ff0000',
  backgroundGradient: ['#8caaee', '#ca9ee6'],
  padding: 16,
  shadow: false,
  cornerRadius: 0,
  windowControls: true,
  titleBar: true,
  lineNumbers: true,
  pro: DEFAULT_PRO_FRAME_OPTIONS,
};

// A 1x1 opaque blue PNG.
const BLUE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

// What VS Code's "Copy With Syntax Highlighting" puts on the clipboard: a
// wrapper carrying the editor's font/colours, one <div> per line, <br> for
// an empty line, and a <span style="color"> per token.
const HIGHLIGHTED_HTML =
  '<div style="color: #d4d4d4;background-color: #1e1e1e;font-family: monospace;font-weight: normal;font-size: 14px;line-height: 19px;white-space: pre;">' +
  '<div><span style="color: #569cd6;">const</span><span style="color: #d4d4d4;"> answer = </span><span style="color: #b5cea8;">42</span><span style="color: #d4d4d4;">;</span></div>' +
  '<div><br></div>' +
  '<div><span style="color: #d4d4d4;">  </span><span style="color: #6a9955; font-style: italic;">// done</span></div>' +
  '</div>';

test('webview shell: paste-fallback on load, then measuring the plain-text fallback', async () => {
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await loadShell(browser, false);

    // With no real clipboard permission, execCommand('paste') fails and the
    // shell reports a null capture instead of hanging.
    const initial = await messages(page);
    assert.equal(initial[0]?.type, 'captured-html');
    assert.equal(initial[0]?.html, null);

    const measured = await render(page, null, 'const answer = 42;\nconsole.log(answer);', 'demo.ts', 99);
    assert.ok(measured.width > 0, 'measured a positive width');
    assert.ok(measured.height > 0, 'measured a positive height');
    assert.equal(measured.lineCount, 2, 'plain-text fallback line count comes from the text, not rawLineCount');
    assert.equal(measured.fileName, 'demo.ts');
    assert.deepEqual(measured.lines, [[{ text: 'const answer = 42;' }], [{ text: 'console.log(answer);' }]]);
    assert.equal(measured.fontSize, 14);
    assert.equal(measured.color, 'rgb(212, 212, 212)', 'fallback text uses the editor-foreground default');
    assert.equal(measured.background, 'rgb(30, 30, 30)', 'fallback card uses the editor-background default');

    await page.close();
  } finally {
    await browser.close();
  }
});

test('webview shell: syntax-highlighted HTML becomes per-line styled runs with the wrapper defaults stripped', async () => {
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await loadShell(browser, false);
    const measured = await render(page, HIGHLIGHTED_HTML, 'ignored fallback', 'demo.ts', 3);

    assert.equal(measured.lineCount, 3, 'highlighted HTML row count is the raw selection span');
    assert.equal(measured.color, 'rgb(212, 212, 212)');
    assert.equal(measured.background, 'rgb(30, 30, 30)');
    assert.equal(measured.fontSize, 14);
    assert.deepEqual(measured.lines, [
      [{ text: 'const', color: 'rgb(86, 156, 214)' }, { text: ' answer = ' }, { text: '42', color: 'rgb(181, 206, 168)' }, { text: ';' }],
      [],
      [{ text: '  ' }, { text: '// done', color: 'rgb(106, 153, 85)', italic: true }],
    ]);

    await page.close();
  } finally {
    await browser.close();
  }
});

test('webview shell: full pipeline exports a PNG of the frame at 1x and 2x', async () => {
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await loadShell(browser, false);
    const measured = await render(page, HIGHLIGHTED_HTML, '', 'demo.ts', 3);
    const svg = buildFrameSvg(toContent(measured, 40), 'demo.ts', TEST_FRAME_SETTINGS);
    const dims = svgDims(svg);

    await sendSvg(page, svg, 1, false);
    await page.waitForFunction(() => document.getElementById('export-btn')?.style.display === 'inline-block');
    await page.click('#export-btn');
    const png1x = await exportedPng(page);
    assert.deepEqual(pngSize(png1x), dims, '1x PNG matches the SVG size');

    // Frame background is solid red; the card (16px in) is the captured
    // editor background; the title bar's first window dot is red-ish too.
    const [corner, card, dot] = await samplePixels(page, png1x, [
      [2, 2],
      [dims.width - 20, dims.height - 20],
      [16 + 20, 16 + 18],
    ]);
    assert.deepEqual(corner, [255, 0, 0, 255], 'frame background pixel is the configured solid colour');
    assert.deepEqual(card, [30, 30, 30, 255], 'card pixel is the captured editor background');
    assert.deepEqual(dot, [255, 95, 86, 255], 'first window dot is drawn');

    // Text actually rendered: some pixel in the first text row is neither
    // background nor card colour.
    const rowY = 16 + 36 + 16 + Math.floor(measured.height / 3 / 2);
    const gutter = String(42).length * 9 + 20;
    const textStart = 16 + gutter + 16;
    const row = await samplePixels(
      page,
      png1x,
      Array.from({ length: 40 }, (_, i) => [textStart + i, rowY] as [number, number]),
    );
    assert.ok(
      row.some(([r, g, b]) => !(r === 30 && g === 30 && b === 30)),
      'at least one pixel in the first code row is not the card colour, so text was drawn',
    );

    // 2x: same frame, double the pixels.
    await clearMessages(page);
    await sendSvg(page, svg, 2, false);
    await page.click('#export-btn');
    const png2x = await exportedPng(page);
    assert.deepEqual(pngSize(png2x), { width: dims.width * 2, height: dims.height * 2 }, '2x PNG is double the SVG size');

    await page.close();
  } finally {
    await browser.close();
  }
});

test('webview shell: quick snap auto-exports on the svg message without ever showing the button', async () => {
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await loadShell(browser, true);
    const measured = await render(page, null, 'quick();', 'quick.ts', 1);
    const svg = buildFrameSvg(toContent(measured, 1), 'quick.ts', TEST_FRAME_SETTINGS);

    await sendSvg(page, svg, 1, true);
    const png = await exportedPng(page);
    assert.deepEqual(pngSize(png), svgDims(svg));
    const buttonDisplay = await page.evaluate(() => document.getElementById('export-btn')?.style.display);
    assert.equal(buttonDisplay, 'none');

    await page.close();
  } finally {
    await browser.close();
  }
});

test('webview shell: Pro export buttons appear only for Pro; SVG asks the host to save', async () => {
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await loadShell(browser, false);
    const measured = await render(page, null, 'vector();', 'v.ts', 1);
    const svg = buildFrameSvg(toContent(measured, 1), 'v.ts', TEST_FRAME_SETTINGS);

    await sendSvg(page, svg, 1, false, false);
    await page.waitForFunction(() => document.getElementById('export-btn')?.style.display === 'inline-block');
    for (const id of ['export-svg-btn', 'export-webp-btn', 'export-pdf-btn']) {
      assert.equal(await buttonDisplay(page, id), 'none', `free tier: PNG only, no ${id}`);
    }

    await sendSvg(page, svg, 1, false, true);
    await page.waitForFunction(() => document.getElementById('export-pdf-btn')?.style.display === 'inline-block');
    for (const id of ['export-btn', 'export-svg-btn', 'export-webp-btn', 'export-pdf-btn']) {
      assert.equal(await buttonDisplay(page, id), 'inline-block', `Pro shows ${id}`);
    }

    await page.click('#export-svg-btn');
    await waitForMessageType(page, 'export-svg');

    await page.close();
  } finally {
    await browser.close();
  }
});

test('webview shell: Pro WebP export encodes a WebP; PDF export hands the host the raw pixels', async () => {
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await loadShell(browser, false);
    const measured = await render(page, null, 'pro();', 'p.ts', 1);
    const svg = buildFrameSvg(toContent(measured, 1), 'p.ts', { ...TEST_FRAME_SETTINGS, backgroundType: 'transparent' });
    const dims = svgDims(svg);

    await sendSvg(page, svg, 2, false, true);
    await page.waitForFunction(() => document.getElementById('export-webp-btn')?.style.display === 'inline-block');
    await page.click('#export-webp-btn');
    await exportedImage(page, 'webp');

    await clearMessages(page);
    await page.click('#export-pdf-btn');
    await waitForMessageType(page, 'export-pixels', 'export-failed');
    const pixels = (await messages(page)).find((m) => m.type === 'export-pixels') as unknown as {
      width: number;
      height: number;
      cssWidth: number;
      cssHeight: number;
      rgba: string;
    };
    assert.ok(pixels, 'pixels were posted');
    assert.deepEqual({ width: pixels.width, height: pixels.height }, { width: dims.width * 2, height: dims.height * 2 });
    assert.deepEqual({ width: pixels.cssWidth, height: pixels.cssHeight }, dims);
    const rgba = Buffer.from(pixels.rgba, 'base64');
    assert.equal(rgba.length, pixels.width * pixels.height * 4);
    // Transparent background: the corner pixel has zero alpha, the card is opaque.
    assert.equal(rgba[3], 0, 'corner is transparent');
    const cardIndex = ((16 + 36 + 8) * 2 * pixels.width + (16 + 8) * 2) * 4;
    assert.equal(rgba[cardIndex + 3], 255, 'card is opaque');
    // And the host-side writer accepts exactly this shape.
    const { rgb, alpha, opaque } = splitRgba(rgba);
    assert.equal(opaque, false);
    const pdf = buildPdf({ pageWidth: dims.width, pageHeight: dims.height, pixelWidth: pixels.width, pixelHeight: pixels.height, rgb, alpha });
    assert.equal(pdf.toString('latin1', 0, 8), '%PDF-1.4');

    await page.close();
  } finally {
    await browser.close();
  }
});

test('webview shell: a Pro background image (data URI) and caption still export without tainting the canvas', async () => {
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await loadShell(browser, false);
    const measured = await render(page, null, 'brand();', 'b.ts', 1);
    const svg = buildFrameSvg(toContent(measured, 1), 'b.ts', {
      ...TEST_FRAME_SETTINGS,
      pro: { ...DEFAULT_PRO_FRAME_OPTIONS, backgroundImage: BLUE_PIXEL_PNG, caption: { text: '@snapframe', color: '#ffffff', position: 'right' } },
    });
    const dims = svgDims(svg);
    await sendSvg(page, svg, 1, false, true);
    await page.waitForFunction(() => document.getElementById('export-btn')?.style.display === 'inline-block');
    await page.click('#export-btn');
    const png = await exportedPng(page);
    assert.deepEqual(pngSize(png), dims);
    const [corner] = await samplePixels(page, png, [[2, 2]]);
    assert.deepEqual(corner, [0, 0, 255, 255], 'the background image covers the red backdrop');

    await page.close();
  } finally {
    await browser.close();
  }
});

test('webview shell: an svg without measurable dimensions reports export-failed instead of hanging', async () => {
  const browser = await chromium.launch(launchOptions());
  try {
    const page = await loadShell(browser, true);
    await sendSvg(page, '<svg xmlns="http://www.w3.org/2000/svg"></svg>', 1, true);
    await waitForMessageType(page, 'export-png', 'export-failed');
    const exported = (await messages(page)).find((m) => m.type === 'export-failed');
    assert.ok(exported, 'reported the failure');
    assert.equal(exported.message, 'frame has no measurable size');

    await page.close();
  } finally {
    await browser.close();
  }
});
