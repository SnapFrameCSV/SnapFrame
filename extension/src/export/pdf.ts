import { deflateSync } from 'node:zlib';

/**
 * Minimal single-page PDF writer with one lossless image, no dependencies:
 * the frame's pixels as a FlateDecode DeviceRGB XObject (plus a DeviceGray
 * SMask when the background is transparent), drawn to fill a page whose
 * size in points equals the frame's CSS-pixel size, so a 2x export is
 * sharper, not bigger. Pure so it can be tested by parsing the output.
 */

export interface PdfImage {
  /** Page size in points (= the frame's CSS pixel size). */
  pageWidth: number;
  pageHeight: number;
  /** Pixel dimensions of `rgb`/`alpha`. */
  pixelWidth: number;
  pixelHeight: number;
  /** pixelWidth * pixelHeight * 3 bytes, row-major, top row first. */
  rgb: Uint8Array;
  /** pixelWidth * pixelHeight bytes; omit for an opaque image. */
  alpha?: Uint8Array;
}

export function buildPdf(image: PdfImage): Buffer {
  if (image.rgb.length !== image.pixelWidth * image.pixelHeight * 3) {
    throw new Error('rgb buffer does not match the pixel dimensions');
  }
  if (image.alpha && image.alpha.length !== image.pixelWidth * image.pixelHeight) {
    throw new Error('alpha buffer does not match the pixel dimensions');
  }
  const pageWidth = round2(image.pageWidth);
  const pageHeight = round2(image.pageHeight);
  const rgbStream = deflateSync(image.rgb);
  const alphaStream = image.alpha ? deflateSync(image.alpha) : undefined;
  const content = Buffer.from(`q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`, 'latin1');

  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'latin1'),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
      'latin1',
    ),
    streamObject(
      `/Type /XObject /Subtype /Image /Width ${image.pixelWidth} /Height ${image.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${alphaStream ? ' /SMask 6 0 R' : ''}`,
      rgbStream,
    ),
    streamObject('', content),
  ];
  if (alphaStream) {
    objects.push(
      streamObject(
        `/Type /XObject /Subtype /Image /Width ${image.pixelWidth} /Height ${image.pixelHeight} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`,
        alphaStream,
      ),
    );
  }

  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets: number[] = [];
  let position = parts[0].length;
  objects.forEach((body, index) => {
    offsets.push(position);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'latin1'), body, Buffer.from('\nendobj\n', 'latin1')]);
    parts.push(chunk);
    position += chunk.length;
  });

  const xrefOffset = position;
  const xref = [`xref`, `0 ${objects.length + 1}`, '0000000000 65535 f '];
  for (const offset of offsets) {
    xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
  }
  parts.push(
    Buffer.from(`${xref.join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, 'latin1'),
  );
  return Buffer.concat(parts);
}

/** Splits canvas RGBA pixels into the RGB and alpha planes the PDF needs. */
export function splitRgba(rgba: Uint8Array): { rgb: Uint8Array; alpha: Uint8Array; opaque: boolean } {
  const pixels = rgba.length / 4;
  const rgb = new Uint8Array(pixels * 3);
  const alpha = new Uint8Array(pixels);
  let opaque = true;
  for (let i = 0; i < pixels; i++) {
    rgb[i * 3] = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
    alpha[i] = rgba[i * 4 + 3];
    if (alpha[i] !== 255) {
      opaque = false;
    }
  }
  return { rgb, alpha, opaque };
}

function streamObject(dictionaryEntries: string, data: Buffer): Buffer {
  const entries = dictionaryEntries ? `${dictionaryEntries} ` : '';
  return Buffer.concat([Buffer.from(`<< ${entries}/Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]);
}

function round2(value: number): string {
  return String(Math.round(value * 100) / 100);
}
