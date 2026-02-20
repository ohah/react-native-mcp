/**
 * Reveal component source: search workspace for testID and open file at that line.
 * Used when user clicks a component tree node that has testID.
 */

import * as vscode from 'vscode';

const GLOB = '**/*.{tsx,jsx,ts,js}';
const EXCLUDE = '**/node_modules/**';
const MAX_FILES = 50;

/** Find first file and line where testID is used with the given value, then reveal. */
export async function revealComponentSource(identifier: string): Promise<void> {
  if (!identifier || typeof identifier !== 'string') {
    return;
  }

  const files = await vscode.workspace.findFiles(GLOB, EXCLUDE, MAX_FILES);
  for (const uri of files) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const text = doc.getText();
      if (!text.includes(identifier)) continue;

      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('testID') || !line.includes(identifier)) continue;
        const lineNum = i;
        const editor = await vscode.window.showTextDocument(doc, {
          selection: new vscode.Range(lineNum, 0, lineNum, line.length),
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: false,
        });
        editor.revealRange(
          new vscode.Range(lineNum, 0, lineNum, line.length),
          vscode.TextEditorRevealType.InCenter
        );
        return;
      }
    } catch {
      // skip unreadable files
    }
  }

  vscode.window.showWarningMessage(
    `React Native MCP: No source found for testID "${identifier}" in workspace.`
  );
}
