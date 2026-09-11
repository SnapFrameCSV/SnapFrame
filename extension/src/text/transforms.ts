// Pure text transforms for the capture pipeline. No vscode import here: these
// run identically in the extension host and in node:test.

/** Strip the longest common leading whitespace shared by every non-blank line. */
export function dedent(text: string): string {
  const lines = text.split('\n');
  const indents = lines.filter((line) => line.trim().length > 0).map((line) => /^[ \t]*/.exec(line)![0]);
  if (indents.length === 0) {
    return text;
  }

  let prefix = indents[0];
  for (const indent of indents.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < indent.length && prefix[i] === indent[i]) {
      i++;
    }
    prefix = prefix.slice(0, i);
    if (prefix === '') {
      break;
    }
  }

  if (prefix === '') {
    return text;
  }
  return lines.map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line.replace(/^[ \t]*/, ''))).join('\n');
}

/** Expand tab characters to spaces, aligning to tab stops rather than a flat replace. */
export function expandTabs(text: string, tabSize: number): string {
  if (tabSize <= 0) {
    return text;
  }
  return text.split('\n').map((line) => expandTabsInLine(line, tabSize)).join('\n');
}

function expandTabsInLine(line: string, tabSize: number): string {
  let result = '';
  let column = 0;
  for (const char of line) {
    if (char === '\t') {
      const spaces = tabSize - (column % tabSize);
      result += ' '.repeat(spaces);
      column += spaces;
    } else {
      result += char;
      column += 1;
    }
  }
  return result;
}

/** Soft-wrap lines longer than `column` characters, breaking on the last space when there is one. */
export function softWrap(text: string, column: number): string {
  if (column <= 0) {
    return text;
  }
  return text.split('\n').flatMap((line) => wrapLine(line, column)).join('\n');
}

function wrapLine(line: string, column: number): string[] {
  if (line.length <= column) {
    return [line];
  }
  const rows: string[] = [];
  let rest = line;
  while (rest.length > column) {
    let breakAt = rest.lastIndexOf(' ', column);
    if (breakAt <= 0) {
      breakAt = column;
    }
    rows.push(rest.slice(0, breakAt));
    rest = rest.slice(breakAt).replace(/^ /, '');
  }
  rows.push(rest);
  return rows;
}
