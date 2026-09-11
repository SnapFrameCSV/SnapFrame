import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PRO_FRAME_OPTIONS, buildFrameSvg, buildMultiFrameSvg, gradientVector, FrameContent, FrameSettings } from '../frame/svg';

const baseSettings: FrameSettings = {
  backgroundType: 'gradient',
  backgroundColor: '#1e1e2e',
  backgroundGradient: ['#8caaee', '#ca9ee6'],
  padding: 32,
  shadow: true,
  cornerRadius: 12,
  windowControls: true,
  titleBar: true,
  lineNumbers: false,
  pro: DEFAULT_PRO_FRAME_OPTIONS,
};

// Text block 400x200 sits inside 16px of code padding on every side, so the
// card is 432 wide and 232 tall before the title bar.
const content: FrameContent = {
  lines: [[{ text: 'const', color: '#569cd6' }, { text: ' x = 1;' }]],
  width: 400,
  height: 200,
  startLine: 1,
  lineCount: 8,
  fontFamily: 'Consolas, "Courier New", monospace',
  fontSize: 14,
  color: '#d4d4d4',
  background: '#1e1e1e',
};

test('buildFrameSvg sizes the canvas from content size, code padding, frame padding and title bar', () => {
  const svg = buildFrameSvg(content, 'index.ts', baseSettings);
  // 400 + 16*2 + 32*2 wide; 200 + 16*2 + 36 (title bar) + 32*2 tall
  assert.match(svg, /width="496"/);
  assert.match(svg, /height="332"/);
});

test('buildFrameSvg omits the title bar and shrinks the card when titleBar is off', () => {
  const svg = buildFrameSvg(content, 'index.ts', { ...baseSettings, titleBar: false });
  assert.match(svg, /height="296"/); // 200 + 32 + 64, no title bar
  assert.doesNotMatch(svg, />index\.ts</);
});

test('buildFrameSvg omits window dots when windowControls is off but keeps the title bar', () => {
  const svg = buildFrameSvg(content, 'index.ts', { ...baseSettings, windowControls: false });
  assert.doesNotMatch(svg, /<circle/);
  assert.match(svg, />index\.ts</);
});

test('buildFrameSvg uses a solid fill and no gradient defs when backgroundType is solid', () => {
  const svg = buildFrameSvg(content, 'index.ts', { ...baseSettings, backgroundType: 'solid', backgroundColor: '#ff0000' });
  assert.doesNotMatch(svg, /linearGradient/);
  assert.match(svg, /fill="#ff0000"/);
});

test('buildFrameSvg draws no backdrop at all when the background is transparent', () => {
  const svg = buildFrameSvg(content, 'index.ts', { ...baseSettings, backgroundType: 'transparent' });
  assert.doesNotMatch(svg, /<rect x="0" y="0"/);
  assert.doesNotMatch(svg, /linearGradient/);
  assert.match(svg, /rx="12" ry="12" fill="#1e1e1e"/, 'the card itself is still drawn');
});

test('buildFrameSvg emits gradient stops matching the configured colours on the free diagonal', () => {
  const svg = buildFrameSvg(content, 'index.ts', baseSettings);
  assert.match(svg, /<linearGradient id="sf-bg-gradient" x1="0" y1="0" x2="1" y2="1">/);
  assert.match(svg, /<stop offset="0%" stop-color="#8caaee"/);
  assert.match(svg, /<stop offset="100%" stop-color="#ca9ee6"/);
  assert.match(svg, /fill="url\(#sf-bg-gradient\)"/);
});

test('gradientVector maps CSS angles onto edge-to-edge box coordinates', () => {
  assert.deepEqual(gradientVector(135), { x1: '0', y1: '0', x2: '1', y2: '1' });
  assert.deepEqual(gradientVector(90), { x1: '0', y1: '0.5', x2: '1', y2: '0.5' });
  assert.deepEqual(gradientVector(180), { x1: '0.5', y1: '0', x2: '0.5', y2: '1' });
  assert.deepEqual(gradientVector(0), { x1: '0.5', y1: '1', x2: '0.5', y2: '0' });
  assert.deepEqual(gradientVector(-90), gradientVector(270));
});

test('buildFrameSvg (Pro) spaces custom gradient stops evenly along the requested angle', () => {
  const svg = buildFrameSvg(content, 'index.ts', {
    ...baseSettings,
    pro: { ...DEFAULT_PRO_FRAME_OPTIONS, gradientAngle: 90, gradientStops: ['#000000', '#777777', '#ffffff'] },
  });
  assert.match(svg, /x1="0" y1="0.5" x2="1" y2="0.5"/);
  assert.match(svg, /<stop offset="0%" stop-color="#000000"/);
  assert.match(svg, /<stop offset="50%" stop-color="#777777"/);
  assert.match(svg, /<stop offset="100%" stop-color="#ffffff"/);
  assert.doesNotMatch(svg, /#8caaee/, 'background.gradient is overridden');
});

test('buildFrameSvg (Pro) draws a data-URI background image covering the whole frame, and ignores non-data hrefs', () => {
  const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
  const svg = buildFrameSvg(content, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, backgroundImage: dataUri } });
  assert.match(svg, new RegExp(`<image href="${dataUri}" x="0" y="0" width="496" height="332" preserveAspectRatio="xMidYMid slice" />`));
  const unsafe = buildFrameSvg(content, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, backgroundImage: 'file:///etc/passwd' } });
  assert.doesNotMatch(unsafe, /<image/);
});

test('buildFrameSvg (Pro) adds a caption band under the card, positioned and escaped', () => {
  const caption = { text: '@snap <dev>', color: '#ffcc00', position: 'right' as const };
  const svg = buildFrameSvg(content, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, caption } });
  assert.match(svg, /height="360"/, '332 + a 28px caption band');
  // x = totalWidth - padding = 464; y sits in the band below the card: 32 + 268 + 16 + 14
  assert.match(svg, /<text x="464" y="330" text-anchor="end"[^>]*fill="#ffcc00"[^>]*>@snap &lt;dev&gt;<\/text>/);
  const left = buildFrameSvg(content, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, caption: { ...caption, position: 'left' } } });
  assert.match(left, /<text x="32" y="330" text-anchor="start"/);
  const center = buildFrameSvg(content, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, caption: { ...caption, position: 'center' } } });
  assert.match(center, /<text x="248" y="330" text-anchor="middle"/);
  const blank = buildFrameSvg(content, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, caption: { ...caption, text: '   ' } } });
  assert.match(blank, /height="332"/, 'a blank caption adds nothing');
});

test('buildFrameSvg omits the shadow filter when shadow is off', () => {
  const svg = buildFrameSvg(content, 'index.ts', { ...baseSettings, shadow: false });
  assert.doesNotMatch(svg, /feDropShadow/);
  assert.doesNotMatch(svg, /filter="url\(#sf-shadow\)"/);
});

test('buildFrameSvg clamps corner radius to half the smaller card dimension', () => {
  const svg = buildFrameSvg({ ...content, lines: [[{ text: 'x' }]], width: 40, height: 10, lineCount: 1 }, 'a.ts', {
    ...baseSettings,
    titleBar: false,
    cornerRadius: 999,
  });
  // card is 72x42 (40x10 text + 16 padding each side, no title bar); half of 42 is 21
  assert.match(svg, /rx="21" ry="21"/);
});

test('buildFrameSvg escapes the file name against markup injection', () => {
  const svg = buildFrameSvg(content, '<script>alert(1)</script>.ts', baseSettings);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
});

test('buildFrameSvg fills the card with the captured editor background', () => {
  const svg = buildFrameSvg({ ...content, background: '#282a36' }, 'index.ts', baseSettings);
  assert.match(svg, /rx="12" ry="12" fill="#282a36"/);
});

test('buildFrameSvg draws each row as native SVG text, never a foreignObject', () => {
  const svg = buildFrameSvg(content, 'index.ts', baseSettings);
  assert.doesNotMatch(svg, /foreignObject/);
  // text starts at frame padding + code padding (x=48); rows are 25px, the
  // first centred at 32 + 36 (title bar) + 16 + 12.5
  assert.match(svg, /<text x="48" y="96\.5" xml:space="preserve" dominant-baseline="central"/);
  assert.match(svg, /font-family="Consolas, &quot;Courier New&quot;, monospace" font-size="14" fill="#d4d4d4"/);
});

test('buildFrameSvg emits one tspan per run, carrying only the styles that differ from the defaults', () => {
  const svg = buildFrameSvg(
    { ...content, lines: [[{ text: 'let', color: '#569cd6', bold: true }, { text: ' y' }, { text: ' // note', italic: true }]] },
    'index.ts',
    baseSettings,
  );
  assert.match(svg, /<tspan fill="#569cd6" font-weight="bold">let<\/tspan><tspan> y<\/tspan><tspan font-style="italic"> \/\/ note<\/tspan><\/text>/);
});

test('buildFrameSvg preserves whitespace and escapes markup inside runs', () => {
  const svg = buildFrameSvg({ ...content, lines: [[{ text: '  if (a < b && c > "d") {' }]] }, 'index.ts', baseSettings);
  assert.match(svg, /<tspan>  if \(a &lt; b &amp;&amp; c &gt; &quot;d&quot;\) \{<\/tspan>/);
});

test('buildFrameSvg skips blank rows but keeps later rows on their own baseline', () => {
  const svg = buildFrameSvg({ ...content, lines: [[{ text: 'a' }], [], [{ text: 'c' }]], height: 75, lineCount: 3 }, 'index.ts', baseSettings);
  // rows are 25px from a top of 84: row 0 centre 96.5, row 2 centre 146.5, nothing at 121.5
  assert.match(svg, /y="96\.5"[^>]*><tspan>a<\/tspan>/);
  assert.doesNotMatch(svg, /y="121\.5"/);
  assert.match(svg, /y="146\.5"[^>]*><tspan>c<\/tspan>/);
});

const threeLines: FrameContent = { ...content, lines: [[{ text: 'a' }], [{ text: 'b' }], [{ text: 'c' }]], height: 75, lineCount: 3, startLine: 10 };

test('buildFrameSvg (Pro) draws a highlight band across the card behind each highlighted row', () => {
  const svg = buildFrameSvg(threeLines, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, highlightLines: [11, 99], highlightColor: '#ff000022' } });
  // rows are 25px from a top of 84 (32 + 36 + 16); line 11 is row 1; the band spans the card (x=32, width=432)
  assert.match(svg, /<rect x="32" y="109" width="432" height="25" fill="#ff000022" \/>/);
  assert.equal((svg.match(/fill="#ff000022"/g) ?? []).length, 1, 'line 99 is outside the capture and ignored');
  assert.doesNotMatch(svg, / opacity="0\.35"/, 'no dimming unless focusDim is on (flood-opacity is the shadow, not a row)');
});

test('buildFrameSvg (Pro) focus-dim fades every non-highlighted row, and does nothing without highlights', () => {
  const svg = buildFrameSvg(threeLines, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, highlightLines: [11], focusDim: true } });
  assert.match(svg, /y="96\.5"[^>]*opacity="0\.35"[^>]*><tspan>a<\/tspan>/);
  assert.match(svg, /y="121\.5"[^>]*fill="#d4d4d4"><tspan>b<\/tspan>/, 'the highlighted row keeps full opacity');
  assert.match(svg, /y="146\.5"[^>]*opacity="0\.35"[^>]*><tspan>c<\/tspan>/);
  const noHighlights = buildFrameSvg(threeLines, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, focusDim: true } });
  assert.doesNotMatch(noHighlights, / opacity="0\.35"/);
});

test('buildFrameSvg (Pro) pins a callout pill to the right edge of its row, escaped and truncated', () => {
  const svg = buildFrameSvg(threeLines, 'index.ts', {
    ...baseSettings,
    pro: { ...DEFAULT_PRO_FRAME_OPTIONS, callouts: [{ line: 12, text: 'the <bug>' }, { line: 3, text: 'ignored' }, { line: 10, text: '   ' }] },
  });
  // "the <bug>" is 9 chars: width 9*6.5+16 = 74.5 -> 75; right edge is textX (48) + textWidth (400) = 448; row 2 centre 146.5
  assert.match(svg, /<rect x="373" y="137\.5" width="75" height="18" rx="9" ry="9" fill="#ffbd2e" \/>/);
  assert.match(svg, /<text x="410\.5" y="146\.5" text-anchor="middle"[^>]*>the &lt;bug&gt;<\/text>/);
  assert.equal((svg.match(/class="sf-callout"/g) ?? []).length, 1, 'out-of-range and blank callouts are skipped');
  const long = buildFrameSvg(threeLines, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, callouts: [{ line: 10, text: 'x'.repeat(100) }] } });
  assert.match(long, />x{40}<\/text>/);
});

test('buildFrameSvg (Pro) draws a QR code in a band under the card and moves a right caption out of its way', () => {
  const svg = buildFrameSvg(content, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, qr: { text: 'https://example.com', size: 80 } } });
  assert.match(svg, /height="428"/, '332 + a band of 80 + 2*8');
  // white tile right-aligned to the card edge (496 - 32 - 80 = 384) in the band starting at 32 + 268 + 16 = 316, + 8
  assert.match(svg, /<g class="sf-qr"><rect x="384" y="324" width="80" height="80" rx="[\d.]+" fill="#ffffff" \/><g fill="#000000" shape-rendering="crispEdges">(<rect [^>]+\/>){50,}<\/g><\/g>/);
  const both = buildFrameSvg(content, 'index.ts', {
    ...baseSettings,
    pro: { ...DEFAULT_PRO_FRAME_OPTIONS, qr: { text: 'https://example.com', size: 80 }, caption: { text: '@me', color: '#fff', position: 'right' } },
  });
  assert.match(both, /<text x="32" y="364" text-anchor="start"[^>]*>@me<\/text>/, 'caption goes left, centred in the shared band');
  const tooLong = buildFrameSvg(content, 'index.ts', { ...baseSettings, pro: { ...DEFAULT_PRO_FRAME_OPTIONS, qr: { text: 'x'.repeat(500), size: 80 } } });
  assert.doesNotMatch(tooLong, /sf-qr/);
  assert.match(tooLong, /height="332"/);
});

test('buildMultiFrameSvg lays two labelled cards side by side with a gap, sized to the taller one', () => {
  const after = { ...content, width: 300, height: 100, lines: [[{ text: 'after' }]] };
  const svg = buildMultiFrameSvg(
    [
      { content, fileName: 'a.ts', label: 'Before' },
      { content: after, fileName: 'b.ts', label: 'After' },
    ],
    baseSettings,
    'side-by-side',
  );
  // cards 432 and 332 wide, 24px gap, 32px padding each side: 432+24+332+64 = 852
  assert.match(svg, /width="852"/);
  // tallest card 268 + 24px label band + 64 padding = 356
  assert.match(svg, /height="356"/);
  assert.match(svg, /<clipPath id="sf-card-clip-0">/);
  assert.match(svg, /<clipPath id="sf-card-clip-1">/);
  assert.match(svg, /<text x="32" y="44"[^>]*>Before<\/text>/, 'label sits in the band above the first card');
  assert.match(svg, /<text x="488" y="44"[^>]*>After<\/text>/, 'second label starts at 32 + 432 + 24');
  assert.match(svg, /<rect x="488" y="56" width="332" height="168" rx="12"/, 'second card starts after the gap, below the label band');
  assert.match(svg, />a\.ts</);
  assert.match(svg, />b\.ts</);
});

test('buildMultiFrameSvg stacks cards vertically when asked, each under its own label', () => {
  const svg = buildMultiFrameSvg(
    [
      { content, fileName: 'a.ts', label: 'Before' },
      { content, fileName: 'a.ts', label: 'After' },
    ],
    baseSettings,
    'stacked',
  );
  assert.match(svg, /width="496"/, 'as wide as one card');
  // 2 cards of 268 + 24 gap + 2 label bands of 24 + 64 padding = 672
  assert.match(svg, /height="672"/);
  assert.match(svg, /<text x="32" y="44"[^>]*>Before<\/text>/);
  // second label band starts at 32 + 24 + 268 + 24 = 348; its text is centred 12px below that
  assert.match(svg, /<text x="32" y="360"[^>]*>After<\/text>/);
  assert.match(svg, /<rect x="32" y="372" width="432" height="268"/);
});

test('buildMultiFrameSvg with one unlabelled panel is exactly buildFrameSvg', () => {
  assert.equal(buildMultiFrameSvg([{ content, fileName: 'index.ts' }], baseSettings, 'side-by-side'), buildFrameSvg(content, 'index.ts', baseSettings));
  assert.throws(() => buildMultiFrameSvg([], baseSettings, 'stacked'));
});

test('buildFrameSvg omits the gutter and line numbers when lineNumbers is off', () => {
  const svg = buildFrameSvg(content, 'index.ts', baseSettings);
  assert.match(svg, /width="496"/); // unchanged from the no-gutter case above
  assert.doesNotMatch(svg, /text-anchor="end"/);
});

test('buildFrameSvg widens the card with a numbered gutter when lineNumbers is on', () => {
  const svg = buildFrameSvg(content, 'index.ts', { ...baseSettings, lineNumbers: true });
  // 1 digit (lines 1-8) * 9 + 20 = 29px gutter; card 432+29=461; total 461+64=525
  assert.match(svg, /width="525"/);
  // code text shifts right by the gutter: 32 + 29 + 16
  assert.match(svg, /<text x="77" y="96\.5"/);
  assert.match(svg, />1</);
  assert.match(svg, />8</);
});

test('buildFrameSvg numbers from the capture start line and widens the gutter for more digits', () => {
  const svg = buildFrameSvg({ ...content, startLine: 97, lineCount: 8 }, 'index.ts', { ...baseSettings, lineNumbers: true });
  // last line 97+8-1=104, 3 digits * 9 + 20 = 47px gutter; card 432+47=479; total 479+64=543
  assert.match(svg, /width="543"/);
  assert.match(svg, />97</);
  assert.match(svg, />104</);
  assert.doesNotMatch(svg, />1</);
});
