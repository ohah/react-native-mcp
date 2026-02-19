/**
 * Accessibility audit → VS Code Diagnostics.
 * Runs accessibility_audit eval, searches workspace for matching testIDs,
 * and creates diagnostics (warnings) at matched locations.
 */

import * as vscode from 'vscode';
import type { WsClient } from '../ws-client';

interface Violation {
  rule: string;
  selector: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  testID?: string;
  uid?: string;
}

export class AccessibilityDiagnostics implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private client: WsClient;

  constructor(client: WsClient) {
    this.client = client;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('rnMcpAccessibility');
  }

  async run(): Promise<void> {
    if (!this.client.connected || this.client.devices.length === 0) {
      vscode.window.showWarningMessage(
        'React Native MCP: No device connected. Start app and MCP server first.'
      );
      return;
    }

    try {
      const violations = await this.client.getAccessibilityAudit();
      if (!Array.isArray(violations) || violations.length === 0) {
        vscode.window.showInformationMessage(
          'React Native MCP: No accessibility violations found.'
        );
        this.diagnosticCollection.clear();
        return;
      }

      vscode.window.showInformationMessage(
        `React Native MCP: Found ${violations.length} accessibility violation(s).`
      );

      // Clear previous diagnostics
      this.diagnosticCollection.clear();

      // Group violations by testID for file search
      const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

      for (const v of violations as Violation[]) {
        const searchTerm = v.testID || v.uid;
        if (!searchTerm) continue;

        // Search workspace for the testID
        const files = await vscode.workspace.findFiles(
          '**/*.{tsx,jsx,ts,js}',
          '**/node_modules/**',
          20
        );

        for (const fileUri of files) {
          try {
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const text = doc.getText();
            const idx = text.indexOf(searchTerm);
            if (idx === -1) continue;

            const pos = doc.positionAt(idx);
            const range = new vscode.Range(pos, doc.positionAt(idx + searchTerm.length));

            const severity =
              v.severity === 'error'
                ? vscode.DiagnosticSeverity.Error
                : v.severity === 'warning'
                  ? vscode.DiagnosticSeverity.Warning
                  : vscode.DiagnosticSeverity.Information;

            const diag = new vscode.Diagnostic(range, `[${v.rule}] ${v.message}`, severity);
            diag.source = 'React Native MCP A11y';

            const key = fileUri.toString();
            if (!diagnosticsMap.has(key)) {
              diagnosticsMap.set(key, []);
            }
            diagnosticsMap.get(key)!.push(diag);
          } catch {
            // skip files that can't be read
          }
        }
      }

      // Apply diagnostics
      for (const [uriStr, diags] of diagnosticsMap) {
        this.diagnosticCollection.set(vscode.Uri.parse(uriStr), diags);
      }
    } catch (err) {
      vscode.window.showErrorMessage(
        `React Native MCP: Accessibility audit failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
