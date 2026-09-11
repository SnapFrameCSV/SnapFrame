/**
 * In-house QR encoder (ISO/IEC 18004): byte mode, versions 1-10, error
 * correction level M, automatic mask selection. No dependencies, so the
 * extension stays dependency-free (D06); correctness is proven in
 * qr.test.ts by decoding the output with an independent decoder.
 * Returns the module matrix; drawing is up to the caller.
 */

export interface QrMatrix {
  size: number;
  /** modules[y][x] — true is a dark module. */
  modules: boolean[][];
  version: number;
  mask: number;
}

interface VersionSpec {
  ecPerBlock: number;
  /** [blockCount, dataCodewordsPerBlock] for group 1 and (optionally) group 2. */
  groups: Array<[number, number]>;
  alignment: number[];
}

// Error correction level M.
const VERSIONS: VersionSpec[] = [
  { ecPerBlock: 10, groups: [[1, 16]], alignment: [] },
  { ecPerBlock: 16, groups: [[1, 28]], alignment: [6, 18] },
  { ecPerBlock: 26, groups: [[1, 44]], alignment: [6, 22] },
  { ecPerBlock: 18, groups: [[2, 32]], alignment: [6, 26] },
  { ecPerBlock: 24, groups: [[2, 43]], alignment: [6, 30] },
  { ecPerBlock: 16, groups: [[4, 27]], alignment: [6, 34] },
  { ecPerBlock: 18, groups: [[4, 31]], alignment: [6, 22, 38] },
  {
    ecPerBlock: 22,
    groups: [
      [2, 38],
      [2, 39],
    ],
    alignment: [6, 24, 42],
  },
  {
    ecPerBlock: 22,
    groups: [
      [3, 36],
      [2, 37],
    ],
    alignment: [6, 26, 46],
  },
  {
    ecPerBlock: 26,
    groups: [
      [4, 43],
      [1, 44],
    ],
    alignment: [6, 28, 50],
  },
];

const EC_LEVEL_M_BITS = 0b00;
export const MAX_QR_BYTES = capacityBytes(VERSIONS.length);

function dataCodewords(version: number): number {
  return VERSIONS[version - 1].groups.reduce((sum, [count, per]) => sum + count * per, 0);
}

/** Byte-mode capacity: data bits minus the 4-bit mode and the 8-bit (v1-9) or 16-bit (v10+) length field. */
function capacityBytes(version: number): number {
  return Math.floor((dataCodewords(version) * 8 - 4 - (version >= 10 ? 16 : 8)) / 8);
}

export function encodeQr(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const version = VERSIONS.findIndex((_, i) => capacityBytes(i + 1) >= bytes.length) + 1;
  if (version === 0) {
    throw new Error(`text is too long for a QR code here (${bytes.length} bytes, max ${MAX_QR_BYTES})`);
  }
  const spec = VERSIONS[version - 1];
  const size = version * 4 + 17;

  // --- Data bit stream: mode, length, bytes, terminator, pad to codewords, pad bytes.
  const bits: number[] = [];
  const push = (value: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) {
      bits.push((value >>> i) & 1);
    }
  };
  push(0b0100, 4);
  push(bytes.length, version >= 10 ? 16 : 8);
  for (const byte of bytes) {
    push(byte, 8);
  }
  const totalDataBits = dataCodewords(version) * 8;
  push(0, Math.min(4, totalDataBits - bits.length));
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  for (let pad = 0xec; bits.length < totalDataBits; pad ^= 0xec ^ 0x11) {
    push(pad, 8);
  }
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }

  // --- Split into blocks, compute EC per block, interleave.
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  const generator = rsGenerator(spec.ecPerBlock);
  for (const [count, per] of spec.groups) {
    for (let b = 0; b < count; b++) {
      const block = data.slice(offset, offset + per);
      offset += per;
      blocks.push(block);
      ecBlocks.push(rsRemainder(block, generator));
    }
  }
  const codewords: number[] = [];
  const longest = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < longest; i++) {
    for (const block of blocks) {
      if (i < block.length) {
        codewords.push(block[i]);
      }
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const block of ecBlocks) {
      codewords.push(block[i]);
    }
  }

  // --- Matrix: function patterns first (and remember which modules they own).
  const modules: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    reserved[y][x] = true;
  };
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) {
          continue;
        }
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  for (const cy of spec.alignment) {
    for (const cx of spec.alignment) {
      if (reserved[cy][cx]) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          set(cx + dx, cy + dy, d !== 1);
        }
      }
    }
  }
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) {
      set(i, 6, i % 2 === 0);
    }
    if (!reserved[i][6]) {
      set(6, i, i % 2 === 0);
    }
  }
  set(8, size - 8, true); // the always-dark module
  // Reserve format areas (values written after masking) and version areas.
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][size - 11 + j] = true;
        reserved[size - 11 + j][i] = true;
      }
    }
  }

  // --- Place codewords in the zigzag, skipping the vertical timing column.
  const dataBits: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) {
      dataBits.push((cw >>> i) & 1);
    }
  }
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5;
    }
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (reserved[y][x]) {
          continue;
        }
        modules[y][x] = bitIndex < dataBits.length ? dataBits[bitIndex] === 1 : false;
        bitIndex++;
      }
    }
  }

  // --- Try every mask, keep the lowest penalty, write format/version info.
  let best = { mask: 0, penalty: Number.POSITIVE_INFINITY, modules: modules };
  for (let mask = 0; mask < 8; mask++) {
    const candidate = modules.map((row) => row.slice());
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!reserved[y][x] && maskBit(mask, x, y)) {
          candidate[y][x] = !candidate[y][x];
        }
      }
    }
    writeFormat(candidate, size, mask);
    if (version >= 7) {
      writeVersion(candidate, size, version);
    }
    const penalty = penaltyScore(candidate, size);
    if (penalty < best.penalty) {
      best = { mask, penalty, modules: candidate };
    }
  }
  return { size, modules: best.modules, version, mask: best.mask };
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function writeFormat(modules: boolean[][], size: number, mask: number): void {
  const data = (EC_LEVEL_M_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  const format = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((format >>> i) & 1) === 1;
  // modules[y][x]. Around the top-left finder: down the column x=8, then along the row y=8.
  for (let i = 0; i <= 5; i++) {
    modules[i][8] = bit(i);
  }
  modules[7][8] = bit(6);
  modules[8][8] = bit(7);
  modules[8][7] = bit(8);
  for (let i = 9; i < 15; i++) {
    modules[8][14 - i] = bit(i);
  }
  // Along row y=8 next to the top-right finder, and down column x=8 next to the bottom-left one.
  for (let i = 0; i < 8; i++) {
    modules[8][size - 1 - i] = bit(i);
  }
  for (let i = 8; i < 15; i++) {
    modules[size - 15 + i][8] = bit(i);
  }
}

function writeVersion(modules: boolean[][], size: number, version: number): void {
  let rem = version;
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  }
  const info = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = ((info >>> i) & 1) === 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    modules[a][b] = dark;
    modules[b][a] = dark;
  }
}

function penaltyScore(m: boolean[][], size: number): number {
  let score = 0;
  // Rule 1: runs of 5+ same-colour modules in rows and columns.
  for (let y = 0; y < size; y++) {
    let runRow = 1;
    let runCol = 1;
    for (let x = 1; x < size; x++) {
      runRow = m[y][x] === m[y][x - 1] ? runRow + 1 : 1;
      if (runRow === 5) score += 3;
      else if (runRow > 5) score += 1;
      runCol = m[x][y] === m[x - 1][y] ? runCol + 1 : 1;
      if (runCol === 5) score += 3;
      else if (runCol > 5) score += 1;
    }
  }
  // Rule 2: 2x2 blocks of one colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) {
        score += 3;
      }
    }
  }
  // Rule 3: finder-like patterns 1011101 with 4 light modules on either side.
  const pattern = [true, false, true, true, true, false, true];
  const hasPattern = (get: (i: number) => boolean | undefined, start: number) => {
    for (let i = 0; i < 7; i++) {
      if (get(start + i) !== pattern[i]) return false;
    }
    const lightBefore = [1, 2, 3, 4].every((i) => get(start - i) === false);
    const lightAfter = [7, 8, 9, 10].every((i) => get(start + i) === false);
    return lightBefore || lightAfter;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (hasPattern((i) => (i >= 0 && i < size ? m[y][i] : undefined), x)) score += 40;
      if (hasPattern((i) => (i >= 0 && i < size ? m[i][y] : undefined), x)) score += 40;
    }
  }
  // Rule 4: dark-module proportion away from 50%.
  let dark = 0;
  for (const row of m) for (const cell of row) if (cell) dark++;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

// --- Reed-Solomon over GF(256), polynomial 0x11d.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: number[], generator: number[]): number[] {
  const result = Array<number>(generator.length - 1).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < result.length; i++) {
      result[i] ^= gfMul(generator[i + 1], factor);
    }
  }
  return result;
}
