/**
 * MCP 서버 ↔ React Native 앱 간 WebSocket 서버 (Multi-Device)
 * 포트 12300에서 N대 앱 연결 수락. 각 디바이스에 고유 deviceId 할당.
 * deviceId/platform 기반 라우팅으로 특정 디바이스에 요청 전송.
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

/** 개별 디바이스 연결 */
export interface DeviceConnection {
  deviceId: string;
  platform: string;
  deviceName: string | null;
  ws: WebSocket;
  pending: Map<string, PendingResolver>;
  metroBaseUrl: string | null;
}

/** 디바이스 정보 (외부 공개용) */
export interface DeviceInfo {
  deviceId: string;
  platform: string;
  deviceName: string | null;
  connected: boolean;
}

/**
 * 다중 디바이스 세션: deviceId로 키, platform 기반 라우팅 지원
 */
export class AppSession {
  private devices = new Map<string, DeviceConnection>();
  private platformCounters = new Map<string, number>();
  private server: WebSocketServer | null = null;

  /** deviceId 생성: "{platform}-{순번}" */
  private generateDeviceId(platform: string): string {
    const count = (this.platformCounters.get(platform) ?? 0) + 1;
    this.platformCounters.set(platform, count);
    return `${platform}-${count}`;
  }

  /** 같은 platform+deviceName의 기존 디바이스 찾기 (재연결 대응) */
  private findExistingDevice(platform: string, deviceName: string | null): DeviceConnection | null {
    for (const device of this.devices.values()) {
      if (device.platform === platform && device.deviceName === deviceName) {
        return device;
      }
    }
    return null;
  }

  /**
   * 디바이스 라우팅:
   * - deviceId 지정 → 해당 디바이스
   * - platform 지정 → 해당 platform 1대면 자동 선택, 2대+ 에러
   * - 미지정 → 전체 1대면 자동 선택, 2대+ 에러
   */
  resolveDevice(deviceId?: string, platform?: string): DeviceConnection {
    if (deviceId) {
      const device = this.devices.get(deviceId);
      if (!device || device.ws.readyState !== WebSocket.OPEN) {
        throw new Error(
          `Device "${deviceId}" not connected. Run get_debugger_status to see connected devices.`
        );
      }
      return device;
    }

    let candidates: DeviceConnection[];

    if (platform) {
      candidates = [...this.devices.values()].filter(
        (d) => d.platform === platform && d.ws.readyState === WebSocket.OPEN
      );
      if (candidates.length === 0) {
        throw new Error(
          `No ${platform} app connected. Start the app with Metro and ensure the MCP runtime is loaded.`
        );
      }
      if (candidates.length > 1) {
        const ids = candidates.map((d) => d.deviceId).join(', ');
        throw new Error(
          `Multiple ${platform} devices connected (${ids}). Specify deviceId to target a specific device.`
        );
      }
      return candidates[0]!;
    }

    candidates = [...this.devices.values()].filter((d) => d.ws.readyState === WebSocket.OPEN);
    if (candidates.length === 0) {
      throw new Error(
        'No React Native app connected. Start the app with Metro and ensure the MCP runtime is loaded.'
      );
    }
    if (candidates.length > 1) {
      const ids = candidates.map((d) => `${d.deviceId}(${d.deviceName ?? d.platform})`).join(', ');
      throw new Error(
        `Multiple devices connected (${ids}). Specify deviceId or platform to target a specific device.`
      );
    }
    return candidates[0]!;
  }

  /** 연결 여부: 인자 없으면 1대라도 연결되어 있으면 true */
  isConnected(deviceId?: string, platform?: string): boolean {
    if (!deviceId && !platform) {
      return [...this.devices.values()].some((d) => d.ws.readyState === WebSocket.OPEN);
    }
    try {
      this.resolveDevice(deviceId, platform);
      return true;
    } catch {
      return false;
    }
  }

  /** 연결된 전체 디바이스 목록 */
  getConnectedDevices(): DeviceInfo[] {
    return [...this.devices.values()]
      .filter((d) => d.ws.readyState === WebSocket.OPEN)
      .map((d) => ({
        deviceId: d.deviceId,
        platform: d.platform,
        deviceName: d.deviceName,
        connected: true,
      }));
  }

  /**
   * WebSocket 서버 시작 (지정 포트, 기본 12300)
   */
  start(port: number = DEFAULT_PORT): void {
    if (this.server) return;
    const wss = new WebSocketServer({ port });
    wss.on('connection', (ws: WebSocket) => {
      // init 메시지를 기다려 디바이스 등록
      let registered = false;

      ws.on('message', (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;

          // init 메시지: 디바이스 등록
          if (!registered && msg?.type === 'init') {
            registered = true;
            const platform = typeof msg.platform === 'string' ? msg.platform : 'unknown';
            const deviceName = typeof msg.deviceName === 'string' ? msg.deviceName : null;
            const metroBaseUrl = typeof msg.metroBaseUrl === 'string' ? msg.metroBaseUrl : null;

            // 같은 platform+deviceName 기존 세션 교체 (앱 재시작)
            const existing = this.findExistingDevice(platform, deviceName);
            let deviceId: string;
            if (existing) {
              deviceId = existing.deviceId;
              // 기존 WebSocket 닫기
              try {
                existing.ws.close(1000, 'Replaced by new connection');
              } catch {}
              // 기존 pending 요청 에러 처리
              for (const { reject } of existing.pending.values()) {
                reject(new Error('Device reconnected'));
              }
              existing.pending.clear();
              this.devices.delete(deviceId);
            } else {
              deviceId = this.generateDeviceId(platform);
            }

            const device: DeviceConnection = {
              deviceId,
              platform,
              deviceName,
              ws,
              pending: new Map(),
              metroBaseUrl,
            };
            this.devices.set(deviceId, device);

            if (metroBaseUrl) {
              setMetroBaseUrlFromApp(metroBaseUrl, deviceId);
            }

            // deviceId를 앱에 알려줌
            ws.send(JSON.stringify({ type: 'deviceId', deviceId }));

            console.error(
              `[react-native-mcp-server] Device connected: ${deviceId} (${platform}${deviceName ? ', ' + deviceName : ''})`
            );
            return;
          }

          // 응답 메시지: 해당 디바이스의 pending 에서 찾기
          const res = msg as unknown as AppResponse;
          if (res.id) {
            // 이 ws에 해당하는 device 찾기
            const device = this.findDeviceByWs(ws);
            if (device && device.pending.has(res.id)) {
              const { resolve } = device.pending.get(res.id)!;
              device.pending.delete(res.id);
              resolve(res);
            }
          }
        } catch {
          // ignore malformed
        }
      });

      ws.on('close', () => {
        const device = this.findDeviceByWs(ws);
        if (device) {
          console.error(`[react-native-mcp-server] Device disconnected: ${device.deviceId}`);
          setMetroBaseUrlFromApp(null, device.deviceId);
          this.devices.delete(device.deviceId);
        }
      });

      ws.on('error', () => {
        const device = this.findDeviceByWs(ws);
        if (device) {
          setMetroBaseUrlFromApp(null, device.deviceId);
          this.devices.delete(device.deviceId);
        }
      });
    });
    wss.on('listening', () => {
      this.server = wss;
      console.error(
        `[react-native-mcp-server] WebSocket server listening on ws://localhost:${port}`
      );
    });
    wss.on('error', (err: Error & { code?: string }) => {
      if (err.code === 'EADDRINUSE' || err.message.includes('EADDRINUSE')) {
        this.server = null;
        wss.close();
        console.error(
          '[react-native-mcp-server] Port',
          port,
          'already in use (another MCP instance?). Close other Cursor windows or restart Cursor so only one instance runs.'
        );
        return;
      }
      console.error('[react-native-mcp-server] WebSocket server error:', err.message);
    });
  }

  /** ws 인스턴스로 DeviceConnection 찾기 */
  private findDeviceByWs(ws: WebSocket): DeviceConnection | null {
    for (const device of this.devices.values()) {
      if (device.ws === ws) return device;
    }
    return null;
  }

  /**
   * 디바이스에 요청 전송 후 응답 대기 (타임아웃 ms)
   */
  async sendRequest(
    request: Omit<AppRequest, 'id'>,
    timeoutMs: number = 10000,
    deviceId?: string,
    platform?: string
  ): Promise<AppResponse> {
    const device = this.resolveDevice(deviceId, platform);
    const id = crypto.randomUUID();
    const msg: AppRequest = { ...request, id };

    return new Promise<AppResponse>((resolve, reject) => {
      const t = setTimeout(() => {
        if (device.pending.delete(id)) {
          reject(new Error('Request timeout: no response from app'));
        }
      }, timeoutMs);
      device.pending.set(id, {
        resolve: (res) => {
          clearTimeout(t);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(t);
          reject(err);
        },
      });
      device.ws.send(JSON.stringify(msg));
    });
  }

  /** 서버 종료 */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    for (const device of this.devices.values()) {
      for (const { reject } of device.pending.values()) {
        reject(new Error('Server stopped'));
      }
      device.pending.clear();
    }
    this.devices.clear();
  }
}

/** 싱글톤 앱 세션 (index에서 생성 후 tools에 전달) */
export const appSession = new AppSession();
