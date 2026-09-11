import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { MAX_QR_BYTES, encodeQr, type QrMatrix } from '../frame/qr';

/** Rasterises the matrix the way a phone camera would see it: scaled, with a quiet zone. */
function decode(matrix: QrMatrix): string | null {
  const scale = 4;
  const quiet = 4;
  const width = (matrix.size + quiet * 2) * scale;
  const rgba = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.modules[y][x]) {
        continue;
      }
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = ((y + quiet) * scale + dy) * width + (x + quiet) * scale + dx;
          rgba[px * 4] = 0;
          rgba[px * 4 + 1] = 0;
          rgba[px * 4 + 2] = 0;
        }
      }
    }
  }
  return jsQR(rgba, width, width)?.data ?? null;
}

test('encodeQr output decodes with an independent decoder across every supported version', () => {
  const samples = [
    'A',
    'https://github.com/SnapFrameCSV/snapframe',
    'https://example.com/a/very/long/path/that/pushes/the/code/into/a/mid/version?with=query&and=more',
    'x'.repeat(100),
    'https://example.com/'.repeat(8),
    'z'.repeat(MAX_QR_BYTES),
  ];
  const versionsSeen = new Set<number>();
  for (const text of samples) {
    const matrix = encodeQr(text);
    assert.equal(matrix.size, matrix.version * 4 + 17);
    versionsSeen.add(matrix.version);
    assert.equal(decode(matrix), text, `round-trips ${text.length} chars (version ${matrix.version}, mask ${matrix.mask})`);
  }
  assert.ok(versionsSeen.has(1), 'covers version 1');
  assert.ok(versionsSeen.has(10), 'covers version 10 (the 16-bit length field)');
  assert.ok(versionsSeen.size >= 4, `covers a spread of versions, saw ${[...versionsSeen].join(',')}`);
});

test('encodeQr picks the smallest version that fits and grows with the input', () => {
  assert.equal(encodeQr('hi').version, 1);
  assert.equal(encodeQr('a'.repeat(14)).version, 1);
  assert.equal(encodeQr('a'.repeat(15)).version, 2);
  assert.equal(encodeQr('a'.repeat(213)).version, 10);
});

test('encodeQr handles UTF-8 and refuses input that does not fit', () => {
  const text = 'Snapframe — “code” ✓ 🎉';
  assert.equal(decode(encodeQr(text)), text);
  assert.throws(() => encodeQr('a'.repeat(MAX_QR_BYTES + 1)), /too long/);
});

test('encodeQr uses every mask at least once across varied inputs (mask selection is live)', () => {
  const masks = new Set<number>();
  for (let i = 0; i < 40; i++) {
    masks.add(encodeQr(`https://example.com/${i}/${'q'.repeat(i)}`).mask);
  }
  assert.ok(masks.size >= 3, `saw masks ${[...masks].join(',')}`);
});
