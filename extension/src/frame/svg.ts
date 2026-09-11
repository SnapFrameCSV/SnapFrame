/**
 * Builds the frame SVG that is the source of truth for both the live preview
 * and PNG export. Pure and vscode-free so it can be unit tested directly:
 * given the captured code as styled text runs, its measured size and the
 * frame settings, it returns a self-contained SVG string.
 *
 * The code is drawn as native SVG <text>/<tspan> runs, never a
 * <foreignObject>: browsers unconditionally taint any canvas an SVG image
 * containing a foreignObject is drawn into, which makes canvas.toBlob — the
 * export path — throw. Native text has no such restriction, and it also
 * renders identically in any SVG renderer rather than only in a browser.
 */

import { encodeQr, type QrMatrix } from './qr';

export interface FrameSettings {
  /** `transparent` (Pro) draws no backdrop at all, so PNG/WebP/PDF keep alpha. */
  backgroundType: 'solid' | 'gradient' | 'transparent';
  backgroundColor: string;
  backgroundGradient: [string, string];
  padding: number;
  shadow: boolean;
  cornerRadius: number;
  windowControls: boolean;
  titleBar: boolean;
  lineNumbers: boolean;
  /** Pro extras; the free tier always renders with `DEFAULT_PRO_FRAME_OPTIONS`. */
  pro: ProFrameOptions;
}

export interface FrameCaption {
  text: string;
  /** CSS colour (the "brand colour"). */
  color: string;
  position: 'left' | 'center' | 'right';
}

export interface FrameCallout {
  /** Absolute file line number, as shown in the gutter. */
  line: number;
  text: string;
}

export interface ProFrameOptions {
  /** Gradient direction in CSS degrees (0 = to top, 90 = to right); 135 is the free tier's fixed diagonal. */
  gradientAngle: number;
  /** Two or more colours, evenly spaced; empty means "use backgroundGradient". */
  gradientStops: string[];
  /** A data: URI drawn over the backdrop, covering the whole image. */
  backgroundImage?: string;
  caption?: FrameCaption;
  /** Absolute file line numbers to highlight with a translucent band. */
  highlightLines: number[];
  highlightColor: string;
  /** With highlights present, fade every other row. */
  focusDim: boolean;
  /** Small labels pinned to the right edge of a row. */
  callouts: FrameCallout[];
  /** A QR code (URL or text) drawn in a band under the card, right-aligned. */
  qr?: { text: string; size: number };
}

export const DEFAULT_PRO_FRAME_OPTIONS: ProFrameOptions = {
  gradientAngle: 135,
  gradientStops: [],
  highlightLines: [],
  highlightColor: 'rgba(255,255,255,0.08)',
  focusDim: false,
  callouts: [],
};

/** One stretch of text with a single style, as VS Code's highlighter emits it. */
export interface TextRun {
  text: string;
  /** CSS colour; falls back to `FrameContent.color` when absent. */
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface FrameContent {
  /** One entry per displayed row, each a sequence of styled runs (empty for a blank row). */
  lines: TextRun[][];
  /** Measured natural width of the text block in CSS pixels, without any padding. */
  width: number;
  /** Measured natural height of the text block in CSS pixels, without any padding. */
  height: number;
  /** 1-based number of the first displayed line, for the gutter. */
  startLine: number;
  /**
   * Number of rows actually rendered. Callers must count rows the same way
   * the content was produced — the raw selection's line span for
   * syntax-highlighted HTML (never re-wrapped), or the normalised text's own
   * line count for the plain-text fallback (which can gain rows from
   * soft-wrap) — otherwise rows and gutter drift out of alignment.
   */
  lineCount: number;
  /** The editor's font, as the webview resolved it. */
  fontFamily: string;
  /** Font size in CSS pixels. */
  fontSize: number;
  /** Default text colour for runs without their own. */
  color: string;
  /** Fill of the code card (the editor background the capture came from). */
  background: string;
}

const TITLE_BAR_HEIGHT = 36;
const WINDOW_DOT_COLORS = ['#ff5f56', '#ffbd2e', '#27c93f'];
const WINDOW_DOT_RADIUS = 6;
const WINDOW_DOT_GAP = 20;
const WINDOW_DOT_INSET = 20;
/** Space between the card edge and the text block, on every side. */
export const CODE_PADDING = 16;
const LINE_NUMBER_FONT_SIZE = 12;
const LINE_NUMBER_CHAR_WIDTH = 9;
const LINE_NUMBER_GUTTER_PADDING = 20;
const LINE_NUMBER_RIGHT_INSET = 12;
const LINE_NUMBER_COLOR = 'rgba(255,255,255,0.35)';
const CAPTION_BAND_HEIGHT = 28;
const CAPTION_FONT_SIZE = 13;
const DIM_OPACITY = 0.35;
const CALLOUT_FONT_SIZE = 11;
const CALLOUT_CHAR_WIDTH = 6.5;
const CALLOUT_PADDING_X = 8;
const CALLOUT_HEIGHT = 18;
const CALLOUT_MAX_CHARS = 40;
const QR_BAND_PADDING = 8;
const QR_QUIET_MODULES = 2;
export const QR_MIN_SIZE = 48;
export const QR_MAX_SIZE = 240;

export interface FramePanel {
  content: FrameContent;
  fileName: string;
  /** Shown above the card (e.g. "Before"); omitted when empty. */
  label?: string;
}

export type FrameLayout = 'side-by-side' | 'stacked';

const PANEL_GAP = 24;
const LABEL_BAND_HEIGHT = 24;
const LABEL_FONT_SIZE = 13;

export function buildFrameSvg(content: FrameContent, fileName: string, settings: FrameSettings): string {
  return buildMultiFrameSvg([{ content, fileName }], settings, 'side-by-side');
}

/**
 * One or more cards on a shared backdrop — a single capture, or two (or
 * more) laid out side by side / stacked for before/after comparisons. Each
 * card is built by `buildCard` at its own origin; everything around the
 * cards (backdrop, gradient, background image, caption/QR band) is shared.
 */
export function buildMultiFrameSvg(panels: FramePanel[], settings: FrameSettings, layout: FrameLayout): string {
  if (panels.length === 0) {
    throw new Error('at least one panel is required');
  }
  const padding = Math.max(0, settings.padding);
  const pro = settings.pro ?? DEFAULT_PRO_FRAME_OPTIONS;
  const qr = pro.qr && pro.qr.text.trim() ? encodeQrOrNull(pro.qr.text.trim()) : null;
  const qrSize = qr ? clamp(pro.qr?.size ?? 80, QR_MIN_SIZE, QR_MAX_SIZE) : 0;
  const caption = pro.caption && pro.caption.text.trim() ? pro.caption : undefined;
  const hasLabels = panels.some((p) => p.label && p.label.trim());
  const labelBand = hasLabels ? LABEL_BAND_HEIGHT : 0;

  // Lay the cards out first so the canvas can be sized around them.
  const sizes = panels.map((p) => measureCard(p.content, settings));
  const cards: string[] = [];
  let cursorX = padding;
  let cursorY = padding + labelBand;
  let cardsWidth = 0;
  let cardsHeight = 0;
  panels.forEach((panel, index) => {
    const { width, height } = sizes[index];
    const labelMarkup =
      panel.label && panel.label.trim()
        ? `<text x="${cursorX}" y="${cursorY - LABEL_BAND_HEIGHT / 2}" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="${LABEL_FONT_SIZE}" font-weight="600" fill="#ffffff" opacity="0.85">${escapeXml(panel.label.trim())}</text>`
        : '';
    cards.push(labelMarkup + buildCard(panel.content, panel.fileName, settings, pro, cursorX, cursorY, panels.length === 1 ? '' : `-${index}`));
    if (layout === 'side-by-side') {
      cardsWidth += width + (index > 0 ? PANEL_GAP : 0);
      cardsHeight = Math.max(cardsHeight, height);
      cursorX += width + PANEL_GAP;
    } else {
      cardsHeight += height + (index > 0 ? PANEL_GAP : 0);
      cardsWidth = Math.max(cardsWidth, width);
      cursorY += height + PANEL_GAP + labelBand;
    }
  });
  const stackedLabelBands = layout === 'stacked' ? labelBand * panels.length : labelBand;

  // The band under the cards holds the caption and/or the QR code.
  const bandHeight = Math.max(caption ? CAPTION_BAND_HEIGHT : 0, qr ? qrSize + QR_BAND_PADDING * 2 : 0);
  const totalWidth = cardsWidth + padding * 2;
  const totalHeight = cardsHeight + stackedLabelBands + padding * 2 + bandHeight;
  const bandTop = padding + stackedLabelBands + cardsHeight + padding / 2;

  const backgroundFill = settings.backgroundType === 'gradient' ? 'url(#sf-bg-gradient)' : settings.backgroundColor;
  const stops = pro.gradientStops.length >= 2 ? pro.gradientStops : settings.backgroundGradient;
  const { x1, y1, x2, y2 } = gradientVector(pro.gradientAngle);
  const gradientDefs =
    settings.backgroundType === 'gradient'
      ? `<linearGradient id="sf-bg-gradient" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      ${stops
        .map((color, index) => `<stop offset="${Math.round((index / (stops.length - 1)) * 100)}%" stop-color="${escapeAttr(color)}" />`)
        .join('\n      ')}
    </linearGradient>`
      : '';
  const backgroundImageMarkup =
    pro.backgroundImage && pro.backgroundImage.startsWith('data:image/')
      ? `<image href="${escapeAttr(pro.backgroundImage)}" x="0" y="0" width="${totalWidth}" height="${totalHeight}" preserveAspectRatio="xMidYMid slice" />`
      : '';
  // With a QR on the right, a right-aligned caption moves left so they never overlap.
  const captionMarkup = caption
    ? buildCaption(qr && caption.position === 'right' ? { ...caption, position: 'left' } : caption, padding, totalWidth, bandTop + bandHeight / 2)
    : '';
  const qrMarkup = qr ? buildQr(qr, totalWidth - padding - qrSize, bandTop + (bandHeight - qrSize) / 2, qrSize) : '';

  const shadowFilter = settings.shadow
    ? `<filter id="sf-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000000" flood-opacity="0.35" />
    </filter>`
    : '';

  const backdrop =
    settings.backgroundType === 'transparent'
      ? ''
      : `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${escapeAttr(backgroundFill)}" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
  <defs>${gradientDefs}${shadowFilter}</defs>
  ${backdrop}
  ${backgroundImageMarkup}
  ${captionMarkup}
  ${qrMarkup}
  ${cards.join('\n  ')}
</svg>`;
}

interface CardGeometry {
  titleBarHeight: number;
  lineCount: number;
  gutterWidth: number;
  textWidth: number;
  textHeight: number;
  width: number;
  height: number;
}

function measureCard(content: FrameContent, settings: FrameSettings): CardGeometry {
  const titleBarHeight = settings.titleBar ? TITLE_BAR_HEIGHT : 0;
  const lineCount = Math.max(1, content.lineCount);
  const lastLine = content.startLine + lineCount - 1;
  const gutterWidth = settings.lineNumbers ? String(lastLine).length * LINE_NUMBER_CHAR_WIDTH + LINE_NUMBER_GUTTER_PADDING : 0;
  const textWidth = Math.max(1, content.width);
  const textHeight = Math.max(1, content.height);
  return {
    titleBarHeight,
    lineCount,
    gutterWidth,
    textWidth,
    textHeight,
    width: gutterWidth + textWidth + CODE_PADDING * 2,
    height: textHeight + CODE_PADDING * 2 + titleBarHeight,
  };
}

/** One card (shadow, rounded clip, title bar, highlights, gutter, text, callouts) with its top-left at (x, y). */
function buildCard(content: FrameContent, fileName: string, settings: FrameSettings, pro: ProFrameOptions, x: number, y: number, idSuffix: string): string {
  const { titleBarHeight, lineCount, gutterWidth, textWidth, textHeight, width: cardWidth, height: cardHeight } = measureCard(content, settings);
  const radius = clamp(settings.cornerRadius, 0, Math.min(cardWidth, cardHeight) / 2);
  const textX = x + gutterWidth + CODE_PADDING;
  const textTop = y + titleBarHeight + CODE_PADDING;
  const rowHeight = textHeight / lineCount;
  const lineNumbersMarkup = settings.lineNumbers ? buildLineNumbers(content, lineCount, rowHeight, x + gutterWidth - LINE_NUMBER_RIGHT_INSET, textTop) : '';
  const titleBarMarkup = settings.titleBar
    ? `<rect x="${x}" y="${y}" width="${cardWidth}" height="${titleBarHeight}" fill="rgba(255,255,255,0.06)" />
    ${settings.windowControls ? windowDots(x, y, titleBarHeight) : ''}
    <text x="${x + cardWidth / 2}" y="${y + titleBarHeight / 2 + 4}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" fill="rgba(255,255,255,0.65)">${escapeXml(fileName)}</text>`
    : '';
  const clipId = `sf-card-clip${idSuffix}`;

  return `<g${settings.shadow ? ' filter="url(#sf-shadow)"' : ''}>
    <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="${radius}" ry="${radius}" fill="${escapeAttr(content.background)}" />
  </g>
  <clipPath id="${clipId}">
    <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="${radius}" ry="${radius}" />
  </clipPath>
  <g clip-path="url(#${clipId})">
    ${titleBarMarkup}
    ${buildHighlights(content, lineCount, rowHeight, pro, x, textTop, cardWidth)}
    ${lineNumbersMarkup}
    ${buildCodeText(content, lineCount, rowHeight, textX, textTop, dimmedRows(content, lineCount, pro))}
    ${buildCallouts(content, lineCount, rowHeight, pro, textX + textWidth, textTop)}
  </g>`;
}

/** Rows to fade: every row without a highlight, but only when focus-dim is on and there is at least one highlight. */
function dimmedRows(content: FrameContent, lineCount: number, pro: ProFrameOptions): Set<number> {
  const dimmed = new Set<number>();
  if (!pro.focusDim || pro.highlightLines.length === 0) {
    return dimmed;
  }
  const highlighted = new Set(pro.highlightLines);
  for (let i = 0; i < lineCount; i++) {
    if (!highlighted.has(content.startLine + i)) {
      dimmed.add(i);
    }
  }
  return dimmed;
}

function buildHighlights(content: FrameContent, lineCount: number, rowHeight: number, pro: ProFrameOptions, x: number, top: number, width: number): string {
  const rows: string[] = [];
  for (const line of pro.highlightLines) {
    const index = line - content.startLine;
    if (index < 0 || index >= lineCount) {
      continue;
    }
    rows.push(`<rect x="${x}" y="${top + rowHeight * index}" width="${width}" height="${rowHeight}" fill="${escapeAttr(pro.highlightColor)}" />`);
  }
  return rows.join('\n    ');
}

/** A label pill at the right edge of the code area, vertically centred on its row. */
function buildCallouts(content: FrameContent, lineCount: number, rowHeight: number, pro: ProFrameOptions, rightEdge: number, top: number): string {
  const rows: string[] = [];
  for (const callout of pro.callouts) {
    const index = callout.line - content.startLine;
    const text = callout.text.trim().slice(0, CALLOUT_MAX_CHARS);
    if (index < 0 || index >= lineCount || !text) {
      continue;
    }
    const width = Math.round(text.length * CALLOUT_CHAR_WIDTH + CALLOUT_PADDING_X * 2);
    const x = rightEdge - width;
    const centreY = top + rowHeight * index + rowHeight / 2;
    rows.push(
      `<g class="sf-callout"><rect x="${x}" y="${centreY - CALLOUT_HEIGHT / 2}" width="${width}" height="${CALLOUT_HEIGHT}" rx="9" ry="9" fill="#ffbd2e" />` +
        `<text x="${x + width / 2}" y="${centreY}" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="${CALLOUT_FONT_SIZE}" font-weight="600" fill="#1e1e1e">${escapeXml(text)}</text></g>`,
    );
  }
  return rows.join('\n    ');
}

/**
 * One <text> per row, one <tspan> per run. Consecutive tspans with no x/y
 * flow on from each other, so a row's runs lay out exactly as inline HTML
 * spans would. No whitespace may appear between the tags: with
 * xml:space="preserve" it would render as extra spaces.
 */
function buildCodeText(content: FrameContent, lineCount: number, rowHeight: number, x: number, top: number, dimmed: Set<number>): string {
  const rows: string[] = [];
  const family = escapeAttr(content.fontFamily);
  for (let i = 0; i < lineCount; i++) {
    const runs = content.lines[i] ?? [];
    if (runs.length === 0) {
      continue;
    }
    const y = top + rowHeight * i + rowHeight / 2;
    const dim = dimmed.has(i) ? ` opacity="${DIM_OPACITY}"` : '';
    const spans = runs
      .map((run) => {
        const attrs = [
          run.color ? ` fill="${escapeAttr(run.color)}"` : '',
          run.bold ? ' font-weight="bold"' : '',
          run.italic ? ' font-style="italic"' : '',
        ].join('');
        return `<tspan${attrs}>${escapeXml(run.text)}</tspan>`;
      })
      .join('');
    rows.push(
      `<text x="${x}" y="${y}" xml:space="preserve" dominant-baseline="central" font-family="${family}" font-size="${content.fontSize}" fill="${escapeAttr(content.color)}"${dim}>${spans}</text>`,
    );
  }
  return rows.join('\n    ');
}

/**
 * Maps a CSS-style angle (0 = to top, 90 = to right) onto objectBoundingBox
 * gradient coordinates, scaled so the line reaches the edge/corner — 135
 * yields exactly the (0,0)→(1,1) diagonal the free tier has always drawn.
 */
export function gradientVector(angleDegrees: number): { x1: string; y1: string; x2: string; y2: string } {
  const radians = (((angleDegrees % 360) + 360) % 360) * (Math.PI / 180);
  let dx = Math.sin(radians);
  let dy = -Math.cos(radians);
  const scale = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  dx /= scale;
  dy /= scale;
  const fmt = (v: number) => String(Math.round(v * 1000) / 1000 + 0);
  return { x1: fmt(0.5 - dx / 2), y1: fmt(0.5 - dy / 2), x2: fmt(0.5 + dx / 2), y2: fmt(0.5 + dy / 2) };
}

function encodeQrOrNull(text: string): QrMatrix | null {
  try {
    return encodeQr(text);
  } catch {
    return null;
  }
}

/**
 * The QR as vector squares on a white tile with a two-module quiet zone, so
 * it stays sharp in SVG/PDF and scans against any backdrop. Dark modules are
 * merged into per-row runs to keep the markup small.
 */
function buildQr(qr: QrMatrix, x: number, y: number, size: number): string {
  const moduleSize = size / (qr.size + QR_QUIET_MODULES * 2);
  const originX = x + moduleSize * QR_QUIET_MODULES;
  const originY = y + moduleSize * QR_QUIET_MODULES;
  const fmt = (v: number) => String(Math.round(v * 100) / 100);
  const runs: string[] = [];
  for (let row = 0; row < qr.size; row++) {
    let col = 0;
    while (col < qr.size) {
      if (!qr.modules[row][col]) {
        col++;
        continue;
      }
      const start = col;
      while (col < qr.size && qr.modules[row][col]) {
        col++;
      }
      runs.push(
        `<rect x="${fmt(originX + start * moduleSize)}" y="${fmt(originY + row * moduleSize)}" width="${fmt((col - start) * moduleSize)}" height="${fmt(moduleSize)}" />`,
      );
    }
  }
  return `<g class="sf-qr"><rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}" rx="${fmt(moduleSize)}" fill="#ffffff" /><g fill="#000000" shape-rendering="crispEdges">${runs.join('')}</g></g>`;
}

function buildCaption(caption: FrameCaption, padding: number, totalWidth: number, y: number): string {
  const x = caption.position === 'left' ? padding : caption.position === 'center' ? totalWidth / 2 : totalWidth - padding;
  const anchor = caption.position === 'left' ? 'start' : caption.position === 'center' ? 'middle' : 'end';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="${CAPTION_FONT_SIZE}" fill="${escapeAttr(caption.color)}" opacity="0.9">${escapeXml(caption.text.trim())}</text>`;
}

function buildLineNumbers(content: FrameContent, lineCount: number, rowHeight: number, textX: number, top: number): string {
  const rows: string[] = [];
  for (let i = 0; i < lineCount; i++) {
    const y = top + rowHeight * i + rowHeight / 2 + LINE_NUMBER_FONT_SIZE * 0.35;
    rows.push(
      `<text x="${textX}" y="${y}" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, monospace" font-size="${LINE_NUMBER_FONT_SIZE}" fill="${LINE_NUMBER_COLOR}">${content.startLine + i}</text>`,
    );
  }
  return rows.join('\n    ');
}

function windowDots(originX: number, originY: number, barHeight: number): string {
  const cy = originY + barHeight / 2;
  return WINDOW_DOT_COLORS.map((color, index) => {
    const cx = originX + WINDOW_DOT_INSET + index * WINDOW_DOT_GAP;
    return `<circle cx="${cx}" cy="${cy}" r="${WINDOW_DOT_RADIUS}" fill="${color}" />`;
  }).join('\n    ');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function escapeXml(value: string): string {
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

function escapeAttr(value: string): string {
  return escapeXml(value);
}
