/**
 * Parses a "3-5, 8, 12-14" style line list (absolute file line numbers, as
 * shown in the gutter) into a sorted, de-duplicated array. Tolerant: junk
 * segments are skipped, reversed ranges are normalised, a range is capped at
 * 10,000 lines so a typo can't allocate a huge set.
 */
export function parseLineRanges(text: string): number[] {
  const lines = new Set<number>();
  for (const segment of text.split(/[,\s]+/)) {
    if (!segment) {
      continue;
    }
    const range = segment.match(/^(\d+)(?:-(\d+))?$/);
    if (!range) {
      continue;
    }
    let start = Number(range[1]);
    let end = range[2] === undefined ? start : Number(range[2]);
    if (start < 1 || end < 1) {
      continue;
    }
    if (end < start) {
      [start, end] = [end, start];
    }
    end = Math.min(end, start + 9_999);
    for (let line = start; line <= end; line++) {
      lines.add(line);
    }
  }
  return [...lines].sort((a, b) => a - b);
}
