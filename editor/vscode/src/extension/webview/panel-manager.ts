/**
 * Manages the DevTools WebviewPanel lifecycle.
 * Creates HTML shell that loads dist/webview.js, routes messages to/from WsClient.
 */

import * as vscode from 'vscode';
import type { WsClient } from '../ws-client';
import { createResolveSourceRef } from '../resolve-state-source';
import { createMessageHandler } from './message-handler';

export class PanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private context: vscode.ExtensionContext;
  private client: WsClient;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext, client: WsClient) {
    this.context = context;
    this.client = client;
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'rnMcpDevTools',
      'React Native MCP DevTools',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
      }
    );

    const webviewJsUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    const webviewCssUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.css')
    );

    this.panel.webview.html = getHtml(webviewJsUri, webviewCssUri, this.panel.webview.cspSource);

    // Message routing
    const handler = createMessageHandler(this.client, {
      resolveSourceRef: createResolveSourceRef(this.context),
    });
    this.panel.webview.onDidReceiveMessage(
      async (msg) => {
        const response = await handler(msg);
        if (response && this.panel) {
          this.panel.webview.postMessage(response);
        }
      },
      undefined,
      this.disposables
    );

    // Push device changes to webview
    const onDevicesChanged = (devices: unknown[]) => {
      if (this.panel) {
        this.panel.webview.postMessage({ type: 'devices-changed', devices });
      }
    };
    const onConnected = () => {
      if (this.panel) {
        this.panel.webview.postMessage({ type: 'connection-status', connected: true });
      }
    };
    const onDisconnected = () => {
      if (this.panel) {
        this.panel.webview.postMessage({ type: 'connection-status', connected: false });
      }
    };
    const onSelectedDeviceChanged = (deviceId: string | null) => {
      if (this.panel) {
        this.panel.webview.postMessage({ type: 'selected-device-changed', deviceId });
      }
    };

    this.client.on('devices-changed', onDevicesChanged);
    this.client.on('connected', onConnected);
    this.client.on('disconnected', onDisconnected);
    this.client.on('selected-device-changed', onSelectedDeviceChanged);

    this.panel.onDidDispose(() => {
      this.client.off('devices-changed', onDevicesChanged);
      this.client.off('connected', onConnected);
      this.client.off('disconnected', onDisconnected);
      this.client.off('selected-device-changed', onSelectedDeviceChanged);
      this.panel = null;
      this.disposables.forEach((d) => d.dispose());
      this.disposables = [];
    });

    // Send initial state
    this.panel.webview.postMessage({
      type: 'connection-status',
      connected: this.client.connected,
    });
    if (this.client.devices.length > 0) {
      this.panel.webview.postMessage({
        type: 'devices-changed',
        devices: this.client.devices,
      });
    }
  }

  dispose(): void {
    this.panel?.dispose();
  }
}

function getHtml(jsUri: vscode.Uri, cssUri: vscode.Uri, cspSource: string): string {
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
