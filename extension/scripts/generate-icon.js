#!/usr/bin/env node
// Writes images/icon.png: a 256x256 rounded square in the two brand colours
// with a four-corner viewfinder mark. No text, no dependencies — the pixels
// are composed by hand and PNG-encoded with Node's built-in zlib.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 256;
const RADIUS = 52;
const TOP = [0x8c, 0xaa, 0xee];
const BOTTOM = [0xca, 0x9e, 0xe6];
const MARK = [0xff, 0xff, 0xff];
const MARK_INSET = 44;
const MARK_ARM = 60;
const MARK_THICKNESS = 16;

function insideRoundedSquare(x, y) {
  const cx = x < RADIUS ? RADIUS - x - 0.5 : x >= SIZE - RADIUS ? x - (SIZE - RADIUS) + 0.5 : 0;
  const cy = y < RADIUS ? RADIUS - y - 0.5 : y >= SIZE - RADIUS ? y - (SIZE - RADIUS) + 0.5 : 0;
  return cx * cx + cy * cy <= RADIUS * RADIUS;
}

function insideMark(x, y) {
  const corners = [
    [MARK_INSET, MARK_INSET, 1, 1],
    [SIZE - MARK_INSET, MARK_INSET, -1, 1],
    [MARK_INSET, SIZE - MARK_INSET, 1, -1],
    [SIZE - MARK_INSET, SIZE - MARK_INSET, -1, -1],
  ];
  for (const [ox, oy, dx, dy] of corners) {
    const rx = (x - ox) * dx;
    const ry = (y - oy) * dy;
    const horizontal = rx >= 0 && rx < MARK_ARM && ry >= 0 && ry < MARK_THICKNESS;
    const vertical = ry >= 0 && ry < MARK_ARM && rx >= 0 && rx < MARK_THICKNESS;
    if (horizontal || vertical) return true;
  }
  return false;
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

const rows = [];
for (let y = 0; y < SIZE; y++) {
  const row = Buffer.alloc(1 + SIZE * 4);
  row[0] = 0;
  const t = y / (SIZE - 1);
  for (let x = 0; x < SIZE; x++) {
    const i = 1 + x * 4;
    if (!insideRoundedSquare(x, y)) continue;
    const colour = insideMark(x, y)
      ? MARK
      : [lerp(TOP[0], BOTTOM[0], t), lerp(TOP[1], BOTTOM[1], t), lerp(TOP[2], BOTTOM[2], t)];
    row[i] = colour[0];
    row[i + 1] = colour[1];
    row[i + 2] = colour[2];
    row[i + 3] = 0xff;
  }
  rows.push(row);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', 'images', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`wrote ${path.relative(process.cwd(), out)} (${png.length} bytes)`);
