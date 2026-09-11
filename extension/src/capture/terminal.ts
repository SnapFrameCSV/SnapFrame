import { expandTabs, softWrap } from '../text/transforms';

/**
 * Normalises text copied out of the integrated terminal for the plain-text
 * render path. Pure so it is unit-tested; the copy itself
 * (`workbench.action.terminal.copySelection` → clipboard) lives in panel.ts.
 */
export interface TerminalText {
  text: string;
  lineCount: number;
}

// CSI / OSC escape sequences, in case a shell integration left any in the copy.
const ANSI_ESCAPES = /\[[0-?]*[ -/]*[@-~]|\][^]*(?:|\\)/g;

export function prepareTerminalText(raw: string, wrapColumn: number, tabSize = 8): TerminalText {
  const cleaned = raw
    .replace(ANSI_ESCAPES, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''));
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === '') {
    cleaned.pop();
  }
  while (cleaned.length > 0 && cleaned[0] === '') {
    cleaned.shift();
  }
  const text = softWrap(expandTabs(cleaned.join('\n'), tabSize), wrapColumn);
  return { text, lineCount: text ? text.split('\n').length : 0 };
}
