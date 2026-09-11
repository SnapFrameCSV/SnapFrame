/**
 * Builds the frame SVG that is the source of truth for both the live preview
 * and (a later sub-step) PNG export. Pure and vscode-free so it can be unit
 * tested directly: given a measured content size and the frame settings, it
 * returns a self-contained SVG string with the captured HTML embedded in a
 * <foreignObject>.
 */

export interface FrameSettings {
  backgroundType: 'solid' | 'gradient';
  backgroundColor: string;
  backgroundGradient: [string, string];
  padding: number;
  shadow: boolean;
  cornerRadius: number;
  windowControls: boolean;
  titleBar: boolean;
  lineNumbers: boolean;
}

export interface FrameContent {
  /** Already-normalised HTML for the code block, sized to width x height. */
  html: string;
  /** Measured natural width of the code block in CSS pixels, before padding/chrome. */
  width: number;
  /** Measured natural height of the code block in CSS pixels, before padding/chrome. */
  height: number;
  /** 1-based number of the first displayed line, for the gutter. */
  startLine: number;
  /**
   * Number of rows actually rendered in `html`. Callers must count rows the
   * same way the content was produced — the raw selection's line span for
   * syntax-highlighted HTML (which is never re-wrapped), or the normalised
   * text's own line count for the plain-text fallback (which can gain rows
   * from soft-wrap) — otherwise the gutter drifts out of alignment.
   */
  lineCount: number;
}

const TITLE_BAR_HEIGHT = 36;
const WINDOW_DOT_COLORS = ['#ff5f56', '#ffbd2e', '#27c93f'];
const WINDOW_DOT_RADIUS = 6;
const WINDOW_DOT_GAP = 20;
const WINDOW_DOT_INSET = 20;
const CARD_BACKGROUND = '#1e1e1e';
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
  const codeWidth = Math.max(1, content.width);
  const cardWidth = gutterWidth + codeWidth;
  const cardHeight = Math.max(1, content.height) + titleBarHeight;
  const padding = Math.max(0, settings.padding);
  const totalWidth = cardWidth + padding * 2;
  const totalHeight = cardHeight + padding * 2;
  const radius = clamp(settings.cornerRadius, 0, Math.min(cardWidth, cardHeight) / 2);
  const codeX = padding + gutterWidth;
  const lineNumbersMarkup = settings.lineNumbers
    ? buildLineNumbers(content, lineCount, padding + gutterWidth - LINE_NUMBER_RIGHT_INSET, padding + titleBarHeight)
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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
  <defs>${gradientDefs}${shadowFilter}</defs>
  <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${escapeAttr(backgroundFill)}" />
  <g${settings.shadow ? ' filter="url(#sf-shadow)"' : ''}>
    <rect x="${padding}" y="${padding}" width="${cardWidth}" height="${cardHeight}" rx="${radius}" ry="${radius}" fill="${CARD_BACKGROUND}" />
  </g>
  <clipPath id="sf-card-clip">
    <rect x="${padding}" y="${padding}" width="${cardWidth}" height="${cardHeight}" rx="${radius}" ry="${radius}" />
  </clipPath>
  <g clip-path="url(#sf-card-clip)">
    ${titleBarMarkup}
    ${lineNumbersMarkup}
    <foreignObject x="${codeX}" y="${padding + titleBarHeight}" width="${codeWidth}" height="${content.height}">
      <div xmlns="http://www.w3.org/1999/xhtml">${content.html}</div>
    </foreignObject>
  </g>
</svg>`;
}

function buildLineNumbers(content: FrameContent, lineCount: number, textX: number, top: number): string {
  const rowHeight = Math.max(1, content.height) / lineCount;
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
