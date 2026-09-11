import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { buildPdf, splitRgba } from '../export/pdf';

function rgbFor(width: number, height: number): Uint8Array {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < rgb.length; i++) {
    rgb[i] = (i * 7) % 256;
  }
  return rgb;
}

/** Reads the object bodies and xref offsets back out of the PDF bytes. */
function parse(pdf: Buffer): { text: string; offsets: number[]; startxref: number } {
  const text = pdf.toString('latin1');
  const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF/)?.[1]);
  const xrefBlock = text.slice(startxref);
  const offsets = [...xrefBlock.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  return { text, offsets, startxref };
}

test('buildPdf writes a well-formed single-page PDF whose xref offsets land on each object', () => {
  const pdf = buildPdf({ pageWidth: 300, pageHeight: 150.5, pixelWidth: 4, pixelHeight: 2, rgb: rgbFor(4, 2) });
  const { text, offsets, startxref } = parse(pdf);
  assert.match(text, /^%PDF-1\.4\n/);
  assert.match(text, /\/MediaBox \[0 0 300 150\.5\]/);
  assert.match(text, /q 300 0 0 150\.5 0 0 cm \/Im0 Do Q/);
  assert.equal(offsets.length, 5, 'catalog, pages, page, image, content');
  offsets.forEach((offset, index) => {
    assert.equal(pdf.toString('latin1', offset, offset + `${index + 1} 0 obj`.length), `${index + 1} 0 obj`);
  });
  assert.equal(pdf.toString('latin1', startxref, startxref + 4), 'xref');
  assert.match(text, /\/Size 6 \/Root 1 0 R/);
});

test('buildPdf embeds the pixels losslessly as a FlateDecode DeviceRGB image', () => {
  const rgb = rgbFor(5, 3);
  const pdf = buildPdf({ pageWidth: 5, pageHeight: 3, pixelWidth: 5, pixelHeight: 3, rgb });
  const text = pdf.toString('latin1');
  const match = text.match(/\/Subtype \/Image \/Width 5 \/Height 3 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/);
  assert.ok(match, 'image dictionary present');
  const streamStart = (match.index ?? 0) + match[0].length;
  const stream = pdf.subarray(streamStart, streamStart + Number(match[1]));
  assert.deepEqual(new Uint8Array(inflateSync(stream)), rgb);
  assert.doesNotMatch(text, /SMask/);
});

test('buildPdf adds a DeviceGray SMask when an alpha plane is given', () => {
  const alpha = new Uint8Array([255, 128, 0, 64]);
  const pdf = buildPdf({ pageWidth: 2, pageHeight: 2, pixelWidth: 2, pixelHeight: 2, rgb: rgbFor(2, 2), alpha });
  const { text, offsets } = parse(pdf);
  assert.match(text, /\/SMask 6 0 R/);
  assert.equal(offsets.length, 6);
  const match = text.match(/\/ColorSpace \/DeviceGray \/BitsPerComponent 8 \/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/);
  assert.ok(match);
  const streamStart = (match.index ?? 0) + match[0].length;
  assert.deepEqual(new Uint8Array(inflateSync(pdf.subarray(streamStart, streamStart + Number(match[1])))), alpha);
});

test('buildPdf refuses buffers that do not match the pixel dimensions', () => {
  assert.throws(() => buildPdf({ pageWidth: 1, pageHeight: 1, pixelWidth: 2, pixelHeight: 2, rgb: new Uint8Array(3) }));
  assert.throws(() => buildPdf({ pageWidth: 1, pageHeight: 1, pixelWidth: 1, pixelHeight: 1, rgb: new Uint8Array(3), alpha: new Uint8Array(2) }));
});

test('splitRgba separates the planes and reports whether the image is fully opaque', () => {
  const opaque = splitRgba(new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]));
  assert.deepEqual([...opaque.rgb], [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...opaque.alpha], [255, 255]);
  assert.equal(opaque.opaque, true);
  const translucent = splitRgba(new Uint8Array([1, 2, 3, 255, 4, 5, 6, 9]));
  assert.equal(translucent.opaque, false);
  assert.deepEqual([...translucent.alpha], [255, 9]);
});
