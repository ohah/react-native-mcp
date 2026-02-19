/**
 * StatusBar item showing MCP server connection state.
 * Green circle when connected, red outline when disconnected.
 * Shows selected device name.
 */

import * as vscode from 'vscode';
import type { WsClient } from './ws-client';

export class StatusBar {
  private item: vscode.StatusBarItem;
  private client: WsClient;

  constructor(client: WsClient) {
    this.client = client;
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'rnMcp.openDevTools';
    this.update();

    client.on('connected', () => this.update());
    client.on('disconnected', () => this.update());
    client.on('devices-changed', () => this.update());
    client.on('selected-device-changed', () => this.update());
  }

  private update(): void {
    const deviceCount = this.client.devices.length;
    if (this.client.connected && deviceCount > 0) {
      const sel = this.client.selectedDevice;
      const label = sel
        ? `${sel.platform}:${sel.deviceName ?? sel.deviceId}`
        : `${deviceCount} device(s)`;
      this.item.text = `$(circle-filled) React Native MCP — ${label}`;
      this.item.tooltip = `Connected — ${deviceCount} device(s)\nClick to open DevTools`;
      this.item.backgroundColor = undefined;
    } else if (this.client.connected) {
      this.item.text = '$(circle-large-outline) React Native MCP';
      this.item.tooltip = 'Connected — no devices';
      this.item.backgroundColor = undefined;
    } else {
      this.item.text = '$(circle-outline) React Native MCP';
      this.item.tooltip = 'Disconnected from MCP server';
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
