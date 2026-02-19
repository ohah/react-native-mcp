/**
 * WebviewViewProvider for the Activity Bar sidebar.
 * Renders the same DevTools UI (webview.js) but persists in the sidebar
 * instead of opening as an editor tab.
 */

import * as vscode from 'vscode';
import type { WsClient } from '../ws-client';
import { createMessageHandler } from './message-handler';

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'rnMcpDevToolsView';

  private view: vscode.WebviewView | null = null;
  private context: vscode.ExtensionContext;
  private client: WsClient;
  private eventCleanups: (() => void)[] = [];

  constructor(context: vscode.ExtensionContext, client: WsClient) {
    this.context = context;
    this.client = client;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
    };

    const webviewJsUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    const webviewCssUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.css')
    );

    webviewView.webview.html = this.getHtml(
      webviewJsUri,
      webviewCssUri,
      webviewView.webview.cspSource
    );

    // Message routing
    const handler = createMessageHandler(this.client);
    const msgDisposable = webviewView.webview.onDidReceiveMessage(async (msg) => {
      const response = await handler(msg);
      if (response && this.view) {
        this.view.webview.postMessage(response);
      }
    });

    // Push events to webview
    const onDevicesChanged = (devices: unknown[]) => {
      this.view?.webview.postMessage({ type: 'devices-changed', devices });
    };
    const onConnected = () => {
      this.view?.webview.postMessage({ type: 'connection-status', connected: true });
    };
    const onDisconnected = () => {
      this.view?.webview.postMessage({ type: 'connection-status', connected: false });
    };
    const onSelectedDeviceChanged = (deviceId: string | null) => {
      this.view?.webview.postMessage({ type: 'selected-device-changed', deviceId });
    };

    this.client.on('devices-changed', onDevicesChanged);
    this.client.on('connected', onConnected);
    this.client.on('disconnected', onDisconnected);
    this.client.on('selected-device-changed', onSelectedDeviceChanged);

    this.eventCleanups = [
      () => this.client.off('devices-changed', onDevicesChanged),
      () => this.client.off('connected', onConnected),
      () => this.client.off('disconnected', onDisconnected),
      () => this.client.off('selected-device-changed', onSelectedDeviceChanged),
    ];

    webviewView.onDidDispose(() => {
      msgDisposable.dispose();
      this.eventCleanups.forEach((fn) => fn());
      this.eventCleanups = [];
      this.view = null;
    });

    // Send initial state
    webviewView.webview.postMessage({
      type: 'connection-status',
      connected: this.client.connected,
    });
    if (this.client.devices.length > 0) {
      webviewView.webview.postMessage({
        type: 'devices-changed',
        devices: this.client.devices,
      });
    }
  }

  private getHtml(jsUri: vscode.Uri, cssUri: vscode.Uri, cspSource: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource}; font-src ${cspSource};">
  <link rel="stylesheet" href="${cssUri}">
  <title>React Native MCP DevTools</title>
</head>
<body>
  <div id="root"></div>
  <script src="${jsUri}"></script>
</body>
</html>`;
  }
}
