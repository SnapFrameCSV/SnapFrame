import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFrameSvg, FrameContent, FrameSettings } from '../frame/svg';

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

test('buildFrameSvg emits gradient stops matching the configured colours', () => {
  const svg = buildFrameSvg(content, 'index.ts', baseSettings);
  assert.match(svg, /stop-color="#8caaee"/);
  assert.match(svg, /stop-color="#ca9ee6"/);
  assert.match(svg, /fill="url\(#sf-bg-gradient\)"/);
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
