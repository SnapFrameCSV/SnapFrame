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
}

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

export function buildFrameSvg(content: FrameContent, fileName: string, settings: FrameSettings): string {
  const titleBarHeight = settings.titleBar ? TITLE_BAR_HEIGHT : 0;
  const lineCount = Math.max(1, content.lineCount);
  const lastLine = content.startLine + lineCount - 1;
  const gutterWidth = settings.lineNumbers ? String(lastLine).length * LINE_NUMBER_CHAR_WIDTH + LINE_NUMBER_GUTTER_PADDING : 0;
  const textWidth = Math.max(1, content.width);
  const textHeight = Math.max(1, content.height);
  const cardWidth = gutterWidth + textWidth + CODE_PADDING * 2;
  const cardHeight = textHeight + CODE_PADDING * 2 + titleBarHeight;
  const padding = Math.max(0, settings.padding);
  const totalWidth = cardWidth + padding * 2;
  const totalHeight = cardHeight + padding * 2;
  const radius = clamp(settings.cornerRadius, 0, Math.min(cardWidth, cardHeight) / 2);
  const textX = padding + gutterWidth + CODE_PADDING;
  const textTop = padding + titleBarHeight + CODE_PADDING;
  const rowHeight = textHeight / lineCount;
  const lineNumbersMarkup = settings.lineNumbers
    ? buildLineNumbers(content, lineCount, rowHeight, padding + gutterWidth - LINE_NUMBER_RIGHT_INSET, textTop)
    : '';

  const backgroundFill = settings.backgroundType === 'gradient' ? 'url(#sf-bg-gradient)' : settings.backgroundColor;
  const gradientDefs =
    settings.backgroundType === 'gradient'
      ? `<linearGradient id="sf-bg-gradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeAttr(settings.backgroundGradient[0])}" />
      <stop offset="100%" stop-color="${escapeAttr(settings.backgroundGradient[1])}" />
    </linearGradient>`
      : '';

  const shadowFilter = settings.shadow
    ? `<filter id="sf-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000000" flood-opacity="0.35" />
    </filter>`
    : '';

  const titleBarMarkup = settings.titleBar
    ? `<rect x="${padding}" y="${padding}" width="${cardWidth}" height="${titleBarHeight}" fill="rgba(255,255,255,0.06)" />
    ${settings.windowControls ? windowDots(padding, padding, titleBarHeight) : ''}
    <text x="${padding + cardWidth / 2}" y="${padding + titleBarHeight / 2 + 4}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" fill="rgba(255,255,255,0.65)">${escapeXml(fileName)}</text>`
    : '';

  const backdrop =
    settings.backgroundType === 'transparent'
      ? ''
      : `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${escapeAttr(backgroundFill)}" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
  <defs>${gradientDefs}${shadowFilter}</defs>
  ${backdrop}
  <g${settings.shadow ? ' filter="url(#sf-shadow)"' : ''}>
    <rect x="${padding}" y="${padding}" width="${cardWidth}" height="${cardHeight}" rx="${radius}" ry="${radius}" fill="${escapeAttr(content.background)}" />
  </g>
  <clipPath id="sf-card-clip">
    <rect x="${padding}" y="${padding}" width="${cardWidth}" height="${cardHeight}" rx="${radius}" ry="${radius}" />
  </clipPath>
  <g clip-path="url(#sf-card-clip)">
    ${titleBarMarkup}
    ${lineNumbersMarkup}
    ${buildCodeText(content, lineCount, rowHeight, textX, textTop)}
  </g>
</svg>`;
}

/**
 * One <text> per row, one <tspan> per run. Consecutive tspans with no x/y
 * flow on from each other, so a row's runs lay out exactly as inline HTML
 * spans would. No whitespace may appear between the tags: with
 * xml:space="preserve" it would render as extra spaces.
 */
function buildCodeText(content: FrameContent, lineCount: number, rowHeight: number, x: number, top: number): string {
  const rows: string[] = [];
  const family = escapeAttr(content.fontFamily);
  for (let i = 0; i < lineCount; i++) {
    const runs = content.lines[i] ?? [];
    if (runs.length === 0) {
      continue;
    }
    const y = top + rowHeight * i + rowHeight / 2;
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
      `<text x="${x}" y="${y}" xml:space="preserve" dominant-baseline="central" font-family="${family}" font-size="${content.fontSize}" fill="${escapeAttr(content.color)}">${spans}</text>`,
    );
  }
  return rows.join('\n    ');
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
