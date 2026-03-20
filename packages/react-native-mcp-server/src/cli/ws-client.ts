/**
 * CLI용 WebSocket 클라이언트.
 * 기존 MCP 서버의 WebSocket 서버에 extension client로 연결.
 */

import WebSocket from 'ws';

export interface DeviceInfo {
  deviceId: string;
  platform: string;
  deviceName: string | null;
  connected: boolean;
  topInsetDp: number;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export class WsClient {
  private ws: WebSocket;
  private pending = new Map<string, PendingRequest>();
  private _devices: DeviceInfo[] = [];

  private constructor(ws: WebSocket, devices: DeviceInfo[]) {
    this.ws = ws;
    this._devices = devices;
  }

  /**
   * WebSocket 서버에 extension client로 연결.
   * MCP 서버가 실행 중이어야 함 (포트 12300 기본).
   */
  static async connect(port: number = 12300, timeoutMs: number = 5000): Promise<WsClient> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.close();
        reject(
          new Error(
            `Connection timeout (port ${port}). Is the MCP server running?\n` +
              'Start it with: react-native-mcp-server (via MCP client or directly)'
          )
        );
      }, timeoutMs);

      const ws = new WebSocket(`ws://localhost:${port}`);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'extension-init' }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'extension-init-ack') {
            clearTimeout(timer);
            const client = new WsClient(ws, msg.devices ?? []);
            ws.removeAllListeners('message');
            ws.on('message', (d) => client.handleMessage(d));
            ws.on('close', () => client.onDisconnect());
            resolve(client);
          }
        } catch {
          // ignore malformed
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(
          new Error(
            `Cannot connect to ws://localhost:${port}.\n` +
              'Make sure the MCP server is running (started by your editor or manually).\n' +
              `Error: ${err.message}`
          )
        );
      });
    });
  }

  private handleMessage(data: WebSocket.RawData): void {
    try {
      const msg = JSON.parse(data.toString()) as {
        id?: string;
        result?: unknown;
        error?: string;
      };
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error));
        } else {
          resolve(msg.result);
        }
      }
    } catch {
      // ignore malformed
    }
  }

  /**
   * 앱 런타임에서 JavaScript 코드 실행.
   */
  async eval(
    code: string,
    deviceId?: string,
    platform?: string,
    timeoutMs = 10000
  ): Promise<unknown> {
    const id = crypto.randomUUID();
    const params: Record<string, unknown> = { code };
    if (deviceId) params.deviceId = deviceId;
    if (platform) params.platform = platform;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Request timed out: no response from app'));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.ws.send(JSON.stringify({ method: 'eval', id, params }));
    });
  }

  /** WebSocket 예기치 않은 종료 시 대기 중인 요청 전부 reject */
  private onDisconnect(): void {
    for (const { reject } of this.pending.values()) {
      reject(new Error('WebSocket connection closed unexpectedly'));
    }
    this.pending.clear();
  }

  get devices(): DeviceInfo[] {
    return this._devices;
  }

  close(): void {
    for (const { reject } of this.pending.values()) {
      reject(new Error('Client closed'));
    }
    this.pending.clear();
    this.ws.close();
  }
}
