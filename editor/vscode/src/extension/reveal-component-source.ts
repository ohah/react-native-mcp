/**
 * Reveal component source: search workspace for testID and open file at that line.
 * Used when user clicks a component tree node that has testID.
 */

import * as vscode from 'vscode';
import { findSourceLine, type FileContent } from './reveal-component-source-logic';

export type { FileContent } from './reveal-component-source-logic';
export { findSourceLine } from './reveal-component-source-logic';

const GLOB = '**/*.{tsx,jsx,ts,js}';
const EXCLUDE = '**/node_modules/**';
const MAX_FILES = 50;

/** Find first file and line where testID is used with the given value, then reveal. */
export async function revealComponentSource(identifier: string): Promise<void> {
  if (!identifier || typeof identifier !== 'string') {
    return;
  }

  const files = await vscode.workspace.findFiles(GLOB, EXCLUDE, MAX_FILES);
  const contents: FileContent[] = [];
  for (const uri of files) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      contents.push({ uri: uri.toString(), text: doc.getText() });
    } catch {
      // skip unreadable files
    }
  }

  const found = findSourceLine(identifier, contents);
  if (found) {
    const uri = vscode.Uri.parse(found.uri);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, {
      selection: new vscode.Range(found.lineIndex, 0, found.lineIndex, found.lineLength),
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false,
    });
    editor.revealRange(
      new vscode.Range(found.lineIndex, 0, found.lineIndex, found.lineLength),
      vscode.TextEditorRevealType.InCenter
    );
    return;
  }

  vscode.window.showWarningMessage(
    `React Native MCP: No source found for testID "${identifier}" in workspace.`
  );
}
