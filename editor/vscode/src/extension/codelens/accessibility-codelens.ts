/**
 * CodeLens provider: "Run React Native MCP accessibility audit" in TSX/JSX files.
 * Clicking the lens runs the accessibility audit (same as Run Accessibility Audit command).
 */

import * as vscode from 'vscode';
import type { WsClient } from '../ws-client';

import { shouldProvideLens } from './accessibility-codelens-logic';

export { shouldProvideLens } from './accessibility-codelens-logic';

const LENS_CMD = 'rnMcp.runAccessibilityAudit';
const LENS_TITLE = 'Run React Native MCP accessibility audit';

export class AccessibilityCodeLensProvider implements vscode.CodeLensProvider {
  constructor(private client: WsClient) {}

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (!shouldProvideLens(document.languageId)) {
      return [];
    }

    const firstLine = new vscode.Range(0, 0, 0, 0);
    const lens = new vscode.CodeLens(firstLine, {
      title: LENS_TITLE,
      command: LENS_CMD,
    });
    return [lens];
  }
}
