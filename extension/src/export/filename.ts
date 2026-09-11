/**
 * Pure filename logic for PNG export, kept separate from the vscode-dependent
 * save flow so it can be unit tested directly.
 */

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

export function buildExportFileName(sourceFileName: string, startLine: number): string {
  const withoutExtension = sourceFileName.replace(/\.[^./\\]+$/, '');
  const stem = (withoutExtension || sourceFileName || 'snippet').replace(UNSAFE_FILENAME_CHARS, '_');
  return `snapframe-${stem}-${startLine}.png`;
}
