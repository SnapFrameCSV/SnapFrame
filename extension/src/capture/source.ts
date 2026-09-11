import * as vscode from 'vscode';
import { dedent, expandTabs, softWrap } from '../text/transforms';

export interface CaptureSource {
  /** Normalised text: dedented, tabs expanded, soft-wrapped. Not yet rendered. */
  text: string;
  /** 1-based line number of the first captured line, for line-number display. */
  startLine: number;
  /**
   * Number of raw source lines spanned by the captured range. This is the
   * right line count for the syntax-highlighted HTML capture (which is never
   * re-wrapped) but NOT for the normalised plain-text fallback, which can
   * gain rows from soft-wrap — callers must use `text`'s own line count there.
   */
  rawLineCount: number;
  fileName: string;
  languageId: string;
  /** The exact editor range that was captured, so callers can re-select it if needed. */
  range: vscode.Range;
}

/**
 * Resolves what to capture: the current selection, or the whole document when
 * there is no selection. Applies the free-tier text normalisation (Slice 2).
 */
export function resolveCaptureSource(editor: vscode.TextEditor): CaptureSource {
  const document = editor.document;
  const hasSelection = !editor.selection.isEmpty;
  const range = hasSelection ? editor.selection : fullDocumentRange(document);

  const editorConfig = vscode.workspace.getConfiguration('editor', document.uri);
  const tabSize = editorConfig.get<number>('tabSize', 4);
  const wrapColumn = vscode.workspace.getConfiguration('snapframe').get<number>('wrapColumn', 0);

  const raw = document.getText(range);
  const normalised = softWrap(expandTabs(dedent(raw), tabSize), wrapColumn);

  return {
    text: normalised,
    startLine: range.start.line + 1,
    rawLineCount: range.end.line - range.start.line + 1,
    fileName: baseName(document.fileName),
    languageId: document.languageId,
    range,
  };
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
  const lastLine = document.lineAt(document.lineCount - 1);
  return new vscode.Range(0, 0, lastLine.range.end.line, lastLine.range.end.character);
}

function baseName(fsPath: string): string {
  const parts = fsPath.split(/[\\/]/);
  return parts[parts.length - 1] || fsPath;
}
