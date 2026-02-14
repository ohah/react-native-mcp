/**
 * MCP 서버 ↔ React Native 앱 간 WebSocket 서버 (Phase 1)
 * 포트 12300에서 앱 연결 수락, eval 요청 전송 및 응답 수신.
 * 다중 연결 지원: 디바이스별 deviceId(예: ios-1, android-1) 할당.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { setMetroBaseUrlFromApp } from './tools/metro-cdp.js';

const DEFAULT_PORT = 12300;

/** 앱에서 오는 응답 메시지 */
interface AppResponse {
  id: string;
  result?: unknown;
  error?: string;
}

/** 앱에 보내는 요청 메시지 */
interface AppRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

type PendingResolver = { resolve: (value: AppResponse) => void; reject: (err: Error) => void };

/**
 * 디바이스 하나당 하나의 WebSocket 연결.
 * 테스트에서 _testInjectDevice로 주입할 때 이 형태 사용.
 */
export interface DeviceConnection {
  deviceId: string;
  platform: string;
  deviceName: string | null;
  ws: WebSocket;
  pending: Map<string, PendingResolver>;
  metroBaseUrl: string | null;
}

/**
 * 앱 연결 세션: 다중 WebSocket, 디바이스별 요청/응답 매칭
 */
export class AppSession {
  private devices = new Map<string, DeviceConnection>();
  private deviceByWs = new Map<WebSocket, string>();
  private awaitingInit = new Set<WebSocket>();
  private server: WebSocketServer | null = null;

  /** 연결된 디바이스 중 열린 것 하나로 해석 (deviceId/platform 미지정 시) */
  resolveDevice(deviceId?: string, platform?: string): DeviceConnection {
    const open = () => [...this.devices.values()].filter((c) => c.ws.readyState === WebSocket.OPEN);

    if (deviceId != null && deviceId !== '') {
      const conn = this.devices.get(deviceId);
      if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
        throw new Error('Device not connected: ' + deviceId);
      }
      return conn;
    }
    if (platform != null && platform !== '') {
      const list = open().filter((c) => c.platform === platform);
      if (list.length === 0) throw new Error('No ' + platform + ' device connected');
      if (list.length > 1) throw new Error('Multiple ' + platform + ' devices connected');
      const byPlatform = list[0];
      if (!byPlatform) throw new Error('No ' + platform + ' device connected');
      return byPlatform;
    }
    const list = open();
    if (list.length === 0) {
      throw new Error(
        'No React Native app connected. Start the app with Metro and ensure the runtime is loaded.'
      );
    }
    if (list.length > 1) {
      throw new Error('Multiple devices connected. Specify deviceId or platform.');
    }
    const single = list[0];
    if (!single) throw new Error('No React Native app connected.');
    return single;
  }

  /** 현재 앱이 연결되어 있는지 (인자 없음: 1대 이상 연결 시 true) */
  isConnected(deviceId?: string, platform?: string): boolean {
    try {
      if (deviceId == null && platform == null) {
        return [...this.devices.values()].some((c) => c.ws.readyState === WebSocket.OPEN);
      }
      this.resolveDevice(deviceId, platform);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 연결된 디바이스 목록 (get_debugger_status 등에서 사용).
   * 열린 연결만 반환, 각 항목에 connected: true 포함.
   */
  getConnectedDevices(): Array<{
    deviceId: string;
    platform: string;
    deviceName: string | null;
    connected: true;
  }> {
    return [...this.devices.values()]
      .filter((c) => c.ws.readyState === WebSocket.OPEN)
      .map((c) => ({
        deviceId: c.deviceId,
        platform: c.platform,
        deviceName: c.deviceName,
        connected: true as const,
      }));
  }

  /** 디버깅: WebSocket 서버/클라이언트 상태 */
  getConnectionStatus(): { connected: boolean; hasServer: boolean; deviceCount: number } {
    const open = [...this.devices.values()].filter((c) => c.ws.readyState === WebSocket.OPEN);
    return {
      connected: open.length > 0,
      hasServer: this.server != null,
      deviceCount: open.length,
    };
  }

  /** 테스트용: 디바이스를 직접 주입 (테스트에서만 사용) */
  _testInjectDevice(conn: DeviceConnection): void {
    this.devices.set(conn.deviceId, conn);
    this.deviceByWs.set(conn.ws, conn.deviceId);
  }

  private nextDeviceId(platform: string): string {
    const samePlatform = [...this.devices.values()].filter((c) => c.platform === platform);
    const indices = samePlatform.map((c) => {
      const m = c.deviceId.match(/^(.+)-(\d+)$/);
      return m && m[2] !== undefined ? parseInt(m[2], 10) : 0;
    });
    const max = indices.length > 0 ? Math.max(...indices) : 0;
    return `${platform}-${max + 1}`;
  }

  private removeConnection(ws: WebSocket): void {
    const deviceId = this.deviceByWs.get(ws);
    if (deviceId) {
      setMetroBaseUrlFromApp(null, deviceId);
      const conn = this.devices.get(deviceId);
      if (conn) {
        for (const { reject } of conn.pending.values()) {
          reject(new Error('Device disconnected'));
        }
        conn.pending.clear();
      }
      this.devices.delete(deviceId);
      this.deviceByWs.delete(ws);
    }
    this.awaitingInit.delete(ws);
  }

  /**
   * WebSocket 서버 시작 (지정 포트, 기본 12300)
   */
  start(port: number = DEFAULT_PORT): void {
    if (this.server) return;
    this.server = new WebSocketServer({ port });
    this.server.on('connection', (ws: WebSocket) => {
      console.error('[react-native-mcp-server] WebSocket client connected');
      this.awaitingInit.add(ws);

      ws.on('message', (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;

          if (this.awaitingInit.has(ws) && msg?.type === 'init') {
            this.awaitingInit.delete(ws);
            const platform = typeof msg.platform === 'string' ? msg.platform : 'unknown';
            const deviceId = this.nextDeviceId(platform);
            const deviceName = typeof msg.deviceName === 'string' ? msg.deviceName : null;
            const metroBaseUrl = typeof msg.metroBaseUrl === 'string' ? msg.metroBaseUrl : null;

            const conn: DeviceConnection = {
              deviceId,
              platform,
              deviceName,
              ws,
              pending: new Map(),
              metroBaseUrl,
            };
            this.devices.set(deviceId, conn);
            this.deviceByWs.set(ws, deviceId);
            if (metroBaseUrl) setMetroBaseUrlFromApp(metroBaseUrl, deviceId);
            return;
          }

          const respDeviceId = this.deviceByWs.get(ws);
          if (respDeviceId != null) {
            const conn = this.devices.get(respDeviceId);
            const res = msg as unknown as AppResponse;
            if (res?.id && conn?.pending.has(res.id)) {
              const { resolve } = conn.pending.get(res.id)!;
              conn.pending.delete(res.id);
              resolve(res);
            }
          }
        } catch {
          // ignore malformed
        }
      });

      ws.on('close', () => {
        console.error('[react-native-mcp-server] WebSocket client disconnected');
        this.removeConnection(ws);
      });
      ws.on('error', () => {
        this.removeConnection(ws);
      });
    });
    this.server.on('listening', () => {
      console.error(
        `[react-native-mcp-server] WebSocket server listening on ws://localhost:${port}`
      );
    });
    this.server.on('error', (err: Error) => {
      if (err.message?.includes('EADDRINUSE')) {
        console.error(
          '[react-native-mcp-server] Port %s already in use. Only one MCP server should run. Kill the other process: kill $(lsof -t -i :%s)',
          port,
          port
        );
        process.exit(1);
      }
      console.error('[react-native-mcp-server] WebSocket server error:', err.message);
    });
  }

  /**
   * 앱에 요청 전송 후 응답 대기 (타임아웃 ms).
   * deviceId/platform 지정 시 해당 디바이스로, 미지정 시 연결 1대일 때만 가능.
   */
  async sendRequest(
    request: Omit<AppRequest, 'id'>,
    timeoutMs: number = 10000,
    deviceId?: string,
    platform?: string
  ): Promise<AppResponse> {
    const conn = this.resolveDevice(deviceId, platform);
    const id = crypto.randomUUID();
    const msg: AppRequest = { ...request, id };

    if (conn.ws.readyState !== WebSocket.OPEN) {
      throw new Error(
        'No React Native app connected. Start the app with Metro and ensure the runtime is loaded.'
      );
    }

    return new Promise<AppResponse>((resolve, reject) => {
      const t = setTimeout(() => {
        if (conn.pending.delete(id)) {
          reject(new Error('Request timeout: no response from app'));
        }
      }, timeoutMs);
      conn.pending.set(id, {
        resolve: (res) => {
          clearTimeout(t);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(t);
          reject(err);
        },
      });
      conn.ws.send(JSON.stringify(msg));
    });
  }

  /** 서버 종료 */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    for (const [ws] of this.deviceByWs) {
      this.removeConnection(ws);
    }
  }
}

/** 싱글톤 앱 세션 (index에서 생성 후 tools에 전달) */
export const appSession = new AppSession();
