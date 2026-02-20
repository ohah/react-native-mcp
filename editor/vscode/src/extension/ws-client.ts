/**
 * WebSocket client for VS Code extension → MCP server communication.
 * Connects to ws://localhost:12300, sends extension-init, forwards eval requests.
 * Auto-reconnect with exponential backoff (1s → 2s → 4s → ... → 30s).
 */

import WebSocket from 'ws';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

const DEFAULT_PORT = 12300;
const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 30000;

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface DeviceInfo {
  deviceId: string;
  platform: string;
  deviceName: string | null;
  connected: boolean;
  topInsetDp: number;
}

export interface WsClientEvents {
  connected: [];
  disconnected: [];
  'devices-changed': [devices: DeviceInfo[]];
  'selected-device-changed': [deviceId: string | null];
}

export class WsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private reconnectDelay = RECONNECT_BASE;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private _connected = false;
  private _devices: DeviceInfo[] = [];
  private _selectedDeviceId: string | null = null;
  private port: number;

  constructor(port: number = DEFAULT_PORT) {
    super();
    this.port = port;
  }

  get connected(): boolean {
    return this._connected;
  }

  get devices(): DeviceInfo[] {
    return this._devices;
  }

  get selectedDeviceId(): string | null {
    return this._selectedDeviceId;
  }

  get selectedDevice(): DeviceInfo | null {
    const id = this._selectedDeviceId;
    if (!id) return this._devices[0] ?? null;
    return this._devices.find((d) => d.deviceId === id) ?? null;
  }

  selectDevice(deviceId: string | null): void {
    this._selectedDeviceId = deviceId;
    this.emit('selected-device-changed', deviceId);
  }

  /** Force immediate reconnect (resets backoff). */
  reconnect(): void {
    this.reconnectDelay = RECONNECT_BASE;
    this.connect();
  }

  connect(): void {
    if (this.disposed) return;
    this.cleanup();

    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}`);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this.reconnectDelay = RECONNECT_BASE;
      this.ws!.send(JSON.stringify({ type: 'extension-init' }));
    });

    this.ws.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;

        // extension-init-ack
        if (msg.type === 'extension-init-ack') {
          this._connected = true;
          this._devices = (msg.devices as DeviceInfo[]) ?? [];
          this.emit('connected');
          this.emit('devices-changed', this._devices);
          return;
        }

        // devices-changed push from server
        if (msg.type === 'devices-changed') {
          this._devices = (msg.devices as DeviceInfo[]) ?? [];
          this.emit('devices-changed', this._devices);
          return;
        }

        // Response to a request
        if (typeof msg.id === 'string') {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            clearTimeout(p.timer);
            if (msg.error != null) {
              p.reject(new Error(String(msg.error)));
            } else {
              p.resolve(msg.result);
            }
          }
        }
      } catch {
        // ignore malformed
      }
    });

    this.ws.on('close', () => {
      this.handleDisconnect();
    });

    this.ws.on('error', () => {
      this.handleDisconnect();
    });
  }

  private handleDisconnect(): void {
    const wasConnected = this._connected;
    this._connected = false;
    this._devices = [];
    this.rejectAllPending('Disconnected from MCP server');
    if (wasConnected) {
      this.emit('disconnected');
      this.emit('devices-changed', []);
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX);
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
      this.pending.delete(id);
    }
  }

  /** Send a request and wait for response. */
  private request(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 10000
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to MCP server'));
        return;
      }
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Request timeout'));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // ─── High-level eval helpers (same IIFE patterns as MCP tools) ───

  /** Resolve a deviceId: explicit arg → selected device → first connected. */
  private resolveDeviceId(deviceId?: string, platform?: string): string | undefined {
    if (deviceId) return deviceId;
    if (platform) {
      const match = this._devices.find((d) => d.platform === platform);
      return match?.deviceId;
    }
    // Use selected device, or fall back to first
    if (this._selectedDeviceId) {
      const exists = this._devices.find((d) => d.deviceId === this._selectedDeviceId);
      if (exists) return this._selectedDeviceId;
    }
    if (this._devices.length > 0) {
      return this._devices[0]!.deviceId;
    }
    return undefined;
  }

  async eval(code: string, deviceId?: string, platform?: string): Promise<unknown> {
    const params: Record<string, unknown> = { code };
    const resolved = this.resolveDeviceId(deviceId, platform);
    if (resolved) params.deviceId = resolved;
    return this.request('eval', params);
  }

  async getConsoleLogs(
    opts: { level?: string; since?: number; limit?: number } = {},
    deviceId?: string,
    platform?: string
  ): Promise<unknown[]> {
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getConsoleLogs ? __REACT_NATIVE_MCP__.getConsoleLogs(${JSON.stringify(opts)}) : []; })();`;
    const result = await this.eval(code, deviceId, platform);
    return Array.isArray(result) ? result : [];
  }

  async clearConsoleLogs(deviceId?: string, platform?: string): Promise<void> {
    const code = `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearConsoleLogs) { __REACT_NATIVE_MCP__.clearConsoleLogs(); return true; } return false; })();`;
    await this.eval(code, deviceId, platform);
  }

  async getNetworkRequests(
    opts: { url?: string; method?: string; status?: number; since?: number; limit?: number } = {},
    deviceId?: string,
    platform?: string
  ): Promise<unknown[]> {
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getNetworkRequests ? __REACT_NATIVE_MCP__.getNetworkRequests(${JSON.stringify(opts)}) : []; })();`;
    const result = await this.eval(code, deviceId, platform);
    return Array.isArray(result) ? result : [];
  }

  async clearNetworkRequests(deviceId?: string, platform?: string): Promise<void> {
    const code = `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearNetworkRequests) { __REACT_NATIVE_MCP__.clearNetworkRequests(); return true; } return false; })();`;
    await this.eval(code, deviceId, platform);
  }

  async listNetworkMocks(deviceId?: string, platform?: string): Promise<unknown[]> {
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.listNetworkMocks ? __REACT_NATIVE_MCP__.listNetworkMocks() : []; })();`;
    const result = await this.eval(code, deviceId, platform);
    return Array.isArray(result) ? result : [];
  }

  async setNetworkMock(
    opts: {
      urlPattern: string;
      isRegex?: boolean;
      method?: string;
      status?: number;
      statusText?: string;
      headers?: Record<string, string>;
      body?: string;
      delay?: number;
    },
    deviceId?: string,
    platform?: string
  ): Promise<unknown> {
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.addNetworkMock ? __REACT_NATIVE_MCP__.addNetworkMock(${JSON.stringify(opts)}) : null; })();`;
    return this.eval(code, deviceId, platform);
  }

  async removeNetworkMock(id: number, deviceId?: string, platform?: string): Promise<boolean> {
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.removeNetworkMock ? __REACT_NATIVE_MCP__.removeNetworkMock(${id}) : false; })();`;
    const result = await this.eval(code, deviceId, platform);
    return result === true;
  }

  async clearNetworkMocks(deviceId?: string, platform?: string): Promise<void> {
    const code = `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearNetworkMocks) { __REACT_NATIVE_MCP__.clearNetworkMocks(); return true; } return false; })();`;
    await this.eval(code, deviceId, platform);
  }

  async getComponentTree(
    opts: { maxDepth?: number } = {},
    deviceId?: string,
    platform?: string
  ): Promise<unknown> {
    const maxDepth = opts.maxDepth ?? 30;
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getComponentTree ? __REACT_NATIVE_MCP__.getComponentTree({ maxDepth: ${maxDepth} }) : null; })();`;
    return this.eval(code, deviceId, platform);
  }

  async getStateChanges(
    opts: { component?: string; since?: number; limit?: number } = {},
    deviceId?: string,
    platform?: string
  ): Promise<unknown[]> {
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getStateChanges ? __REACT_NATIVE_MCP__.getStateChanges(${JSON.stringify(opts)}) : []; })();`;
    const result = await this.eval(code, deviceId, platform);
    return Array.isArray(result) ? result : [];
  }

  async clearStateChanges(deviceId?: string, platform?: string): Promise<void> {
    const code = `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearStateChanges) { __REACT_NATIVE_MCP__.clearStateChanges(); return true; } return false; })();`;
    await this.eval(code, deviceId, platform);
  }

  async getRenderReport(deviceId?: string, platform?: string): Promise<unknown> {
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getRenderReport ? __REACT_NATIVE_MCP__.getRenderReport() : null; })();`;
    return this.eval(code, deviceId, platform);
  }

  async startRenderProfile(
    opts: { components?: string[]; ignore?: string[] } = {},
    deviceId?: string,
    platform?: string
  ): Promise<unknown> {
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.startRenderProfile ? __REACT_NATIVE_MCP__.startRenderProfile(${JSON.stringify(opts)}) : null; })();`;
    return this.eval(code, deviceId, platform);
  }

  async clearRenderProfile(deviceId?: string, platform?: string): Promise<void> {
    const code = `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearRenderProfile) { __REACT_NATIVE_MCP__.clearRenderProfile(); return true; } return false; })();`;
    await this.eval(code, deviceId, platform);
  }

  async startRenderHighlight(
    opts: {
      components?: string[];
      ignore?: string[];
      showLabels?: boolean;
      fadeTimeout?: number;
      maxHighlights?: number;
    } = {},
    deviceId?: string,
    platform?: string
  ): Promise<unknown> {
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.startRenderHighlight ? __REACT_NATIVE_MCP__.startRenderHighlight(${JSON.stringify(opts)}) : null; })();`;
    return this.eval(code, deviceId, platform);
  }

  async stopRenderHighlight(deviceId?: string, platform?: string): Promise<void> {
    const code = `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.stopRenderHighlight) { __REACT_NATIVE_MCP__.stopRenderHighlight(); return true; } return false; })();`;
    await this.eval(code, deviceId, platform);
  }

  async getAccessibilityAudit(
    opts: { maxDepth?: number } = {},
    deviceId?: string,
    platform?: string
  ): Promise<unknown[]> {
    const maxDepth = opts.maxDepth ?? 999;
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getAccessibilityAudit ? __REACT_NATIVE_MCP__.getAccessibilityAudit({ maxDepth: ${maxDepth} }) : []; })();`;
    const result = await this.eval(code, deviceId, platform);
    return Array.isArray(result) ? result : [];
  }

  async getDevices(): Promise<DeviceInfo[]> {
    const result = await this.request('getDevices');
    return Array.isArray(result) ? (result as DeviceInfo[]) : [];
  }

  dispose(): void {
    this.disposed = true;
    this.rejectAllPending('Client disposed');
    this.cleanup();
    this.removeAllListeners();
  }
}
