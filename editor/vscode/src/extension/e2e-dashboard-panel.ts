/**
 * E2E Dashboard panel: webview that loads the dashboard served by
 * `test report show` (default http://127.0.0.1:9323).
 * User must run `bun run dashboard:show` or `test report show -o <dir>` first.
 */

import * as vscode from 'vscode';
import { getDashboardHtml } from './e2e-dashboard-html';

const DEFAULT_DASHBOARD_URL = 'http://127.0.0.1:9323/';

export class E2eDashboardPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  show(port?: number): void {
    const url = port != null ? `http://127.0.0.1:${port}/` : DEFAULT_DASHBOARD_URL;

    if (this.panel) {
      this.panel.reveal();
      this.panel.webview.html = getDashboardHtml(url, this.panel.webview.cspSource);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'rnMcpE2eDashboard',
      'E2E Dashboard',
      vscode.ViewColumn.Two,
      {
        enableScripts: false,
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = getDashboardHtml(url, this.panel.webview.cspSource);

    this.panel.onDidDispose(() => {
      this.panel = null;
    });
  }

  dispose(): void {
    this.panel?.dispose();
    this.panel = null;
  }
}
