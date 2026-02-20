/**
 * VS Code extension entry point.
 * Activates on startup: connects WS client, shows status bar,
 * registers commands, sets up webview panel and sidebar tree.
 */

import * as vscode from 'vscode';
import { WsClient } from './ws-client';
import { StatusBar } from './status-bar';
import { PanelManager } from './webview/panel-manager';
import { SidebarViewProvider } from './webview/sidebar-view-provider';
import { ComponentTreeProvider } from './tree-view/component-tree-provider';
import { AccessibilityDiagnostics } from './codelens/accessibility-diagnostics';
import { revealComponentSource } from './reveal-component-source';

let client: WsClient;
let statusBar: StatusBar;
let panelManager: PanelManager;
let treeProvider: ComponentTreeProvider;
let accessibilityDiag: AccessibilityDiagnostics;

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('reactNativeMcp');
  const port = config.get<number>('port', 12300);
  client = new WsClient(port);
  statusBar = new StatusBar(client);
  panelManager = new PanelManager(context, client);
  treeProvider = new ComponentTreeProvider(client);
  accessibilityDiag = new AccessibilityDiagnostics(client);

  // Register sidebar DevTools webview view (Activity Bar)
  const sidebarProvider = new SidebarViewProvider(context, client);

  // Register sidebar tree view
  const treeView = vscode.window.createTreeView('rnMcpComponentTree', {
    treeDataProvider: treeProvider,
  });

  // Register commands
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('rnMcp.openDevTools', () => {
      panelManager.show();
    }),
    vscode.commands.registerCommand('rnMcp.refreshTree', () => {
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('rnMcp.runAccessibilityAudit', () => {
      accessibilityDiag.run();
    }),
    vscode.commands.registerCommand('rnMcp.revealComponentSource', (identifier: string) => {
      revealComponentSource(identifier);
    }),
    treeView,
    statusBar,
    panelManager,
    accessibilityDiag,
    { dispose: () => client.dispose() }
  );

  // Connect to MCP server
  if (config.get<boolean>('autoConnect', true)) {
    client.connect();
  }
}

export function deactivate(): void {
  // Disposables are cleaned up by VS Code via context.subscriptions
}
