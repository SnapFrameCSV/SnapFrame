import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFrameSvg, FrameSettings } from '../frame/svg';

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

const content = { html: '<pre>const x = 1;</pre>', width: 400, height: 200, startLine: 1, lineCount: 8 };

test('buildFrameSvg sizes the canvas from content size, padding and title bar', () => {
  const svg = buildFrameSvg(content, 'index.ts', baseSettings);
  // 400 + 32*2 wide; 200 + 36 (title bar) + 32*2 tall
  assert.match(svg, /width="464"/);
  assert.match(svg, /height="300"/);
});

test('buildFrameSvg omits the title bar and shrinks the card when titleBar is off', () => {
  const svg = buildFrameSvg(content, 'index.ts', { ...baseSettings, titleBar: false });
  assert.match(svg, /height="264"/); // 200 + 32*2, no title bar
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
  const svg = buildFrameSvg({ html: '<pre>x</pre>', width: 40, height: 10, startLine: 1, lineCount: 1 }, 'a.ts', {
    ...baseSettings,
    titleBar: false,
    cornerRadius: 999,
  });
  // card is 40x10 (no title bar); half of the smaller side (10) is 5
  assert.match(svg, /rx="5" ry="5"/);
});

test('buildFrameSvg escapes the file name against markup injection', () => {
  const svg = buildFrameSvg(content, '<script>alert(1)</script>.ts', baseSettings);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
});

test('buildFrameSvg embeds the content html inside a foreignObject at the title-bar offset', () => {
  const svg = buildFrameSvg(content, 'index.ts', baseSettings);
  assert.match(svg, /<foreignObject x="32" y="68" width="400" height="200">/);
  assert.match(svg, /const x = 1;/);
});

test('buildFrameSvg omits the gutter and line numbers when lineNumbers is off', () => {
  const svg = buildFrameSvg(content, 'index.ts', baseSettings);
  assert.match(svg, /width="464"/); // unchanged from the no-gutter case above
  assert.doesNotMatch(svg, /text-anchor="end"/);
});

test('buildFrameSvg widens the card with a numbered gutter when lineNumbers is on', () => {
  const svg = buildFrameSvg(content, 'index.ts', { ...baseSettings, lineNumbers: true });
  // 1 digit (lines 1-8) * 9 + 20 = 29px gutter; card 400+29=429; total 429+64=493
  assert.match(svg, /width="493"/);
  assert.match(svg, /<foreignObject x="61" /);
  assert.match(svg, />1</);
  assert.match(svg, />8</);
});

test('buildFrameSvg numbers from the capture start line and widens the gutter for more digits', () => {
  const svg = buildFrameSvg({ ...content, startLine: 97, lineCount: 8 }, 'index.ts', { ...baseSettings, lineNumbers: true });
  // last line 97+8-1=104, 3 digits * 9 + 20 = 47px gutter; card 400+47=447; total 447+64=511
  assert.match(svg, /width="511"/);
  assert.match(svg, />97</);
  assert.match(svg, />104</);
  assert.doesNotMatch(svg, />1</);
});
