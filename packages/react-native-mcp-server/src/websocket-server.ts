/**
 * MCP 서버 ↔ React Native 앱 간 WebSocket 서버 (Phase 1)
 * 포트 12300에서 앱 연결 수락, eval 요청 전송 및 응답 수신.
 * 다중 연결 지원: 디바이스별 deviceId(예: ios-1, android-1) 할당.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { setMetroBaseUrlFromApp } from './tools/metro-cdp.js';
import { getAndroidInsets } from './tools/adb-utils.js';
import { stopAllRecordings } from './tools/video-recording.js';

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
  /** PixelRatio.get() from React Native runtime (dp→px scale). */
  pixelRatio: number | null;
  /** Android top inset in px (상태바/캡션바). ADB dumpsys에서 감지. */
  topInsetPx: number;
  /** Android에서 ensureAndroidTopInset으로 dumpsys 시도한 적 있음. 0이어도 재호출 방지. */
  topInsetAttempted?: boolean;
  /** window가 statusBar를 포함하는지 여부. true면 measureInWindow이 screen-absolute → topInset 안 더함. */
  windowIncludesStatusBar?: boolean;
  /** 런타임에서 보낸 screen height (dp). */
  screenHeightDp: number;
  /** 런타임에서 보낸 window height (dp). */
  windowHeightDp: number;
  /** Date.now() of last message received from this device (for stale detection). */
  lastMessageTime: number;
}

/**
 * 앱 연결 세션: 다중 WebSocket, 디바이스별 요청/응답 매칭
 */
export class AppSession {
  private devices = new Map<string, DeviceConnection>();
  private deviceByWs = new Map<WebSocket, string>();
  private awaitingInit = new Set<WebSocket>();
  private extensionClients = new Set<WebSocket>();
  private server: WebSocketServer | null = null;
  private staleCheckTimer: ReturnType<typeof setInterval> | null = null;

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
    topInsetDp: number;
  }> {
    return [...this.devices.values()]
      .filter((c) => c.ws.readyState === WebSocket.OPEN)
      .map((c) => {
        const ratio = c.pixelRatio ?? 1;
        let topInsetDp = 0;
        if (c.platform === 'android' && !c.windowIncludesStatusBar && c.topInsetPx > 0) {
          topInsetDp = c.topInsetPx / ratio;
        }
        return {
          deviceId: c.deviceId,
          platform: c.platform,
          deviceName: c.deviceName,
          connected: true as const,
          topInsetDp,
        };
      });
  }

  /** 연결된 디바이스의 pixelRatio 반환 (없으면 null) */
  getPixelRatio(deviceId?: string, platform?: string): number | null {
    try {
      const conn = this.resolveDevice(deviceId, platform);
      return conn.pixelRatio;
    } catch {
      return null;
    }
  }

  /**
   * Android top inset을 dp 단위로 반환.
   * windowIncludesStatusBar가 true면 0 (measureInWindow이 이미 screen-absolute).
   * 그 외: topInsetPx / pixelRatio. iOS는 항상 0.
   */
  getTopInsetDp(deviceId?: string, platform?: string): number {
    try {
      const conn = this.resolveDevice(deviceId, platform);
      if (conn.platform !== 'android') return 0;
      if (conn.windowIncludesStatusBar) return 0;
      if (conn.topInsetPx === 0) return 0;
      const ratio = conn.pixelRatio ?? 1;
      return conn.topInsetPx / ratio;
    } catch {
      return 0;
    }
  }

  /**
   * 수동으로 Android top inset(dp) 설정.
   * ADB 자동 감지 결과를 덮어쓴다. 앱 오버레이에도 전달한다.
   * 수동 오버라이드 시 windowIncludesStatusBar 판별 리셋.
   */
  setTopInsetDp(dp: number, deviceId?: string, platform?: string): void {
    const conn = this.resolveDevice(deviceId, platform);
    const ratio = conn.pixelRatio ?? 1;
    conn.topInsetPx = Math.round(dp * ratio);
    conn.windowIncludesStatusBar = false;
    if (conn.platform === 'android' && conn.ws.readyState === 1) {
      conn.ws.send(JSON.stringify({ type: 'setTopInsetDp', topInsetDp: dp }));
    }
  }

  /**
   * Android tap 전에 top inset이 0이면 한 번만 dumpsys로 보충.
   * 연결당 한 번만 시도(topInsetAttempted). 0이어도 재호출하지 않아 adb 낭비 방지.
   * windowIncludesStatusBar가 true면 skip (이미 판별 완료, inset 불필요).
   */
  async ensureAndroidTopInset(deviceId: string | undefined, serial: string): Promise<void> {
    let conn: DeviceConnection;
    try {
      conn = this.resolveDevice(deviceId, 'android');
    } catch {
      return;
    }
    if (conn.windowIncludesStatusBar) return;
    if (conn.topInsetPx > 0) return;
    if (conn.topInsetAttempted) return;
    conn.topInsetAttempted = true;
    const insets = await getAndroidInsets(serial);
    const topPx = insets.captionBarPx > 0 ? insets.captionBarPx : insets.statusBarPx;
    if (topPx <= 0) return;
    const ratio = conn.pixelRatio ?? 1;
    conn.topInsetPx = topPx;
    // 판별 로직
    const actualGap = conn.screenHeightDp - conn.windowHeightDp;
    const navBarDp = insets.navBarPx / ratio;
    if (Math.abs(actualGap - navBarDp) <= 4) {
      conn.windowIncludesStatusBar = true;
      if (conn.ws.readyState === 1) {
        conn.ws.send(JSON.stringify({ type: 'setTopInsetDp', topInsetDp: 0 }));
      }
      return;
    }
    if (conn.ws.readyState === 1) {
      conn.ws.send(JSON.stringify({ type: 'setTopInsetDp', topInsetDp: topPx / ratio }));
    }
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

  /** Broadcast a message to all connected extension clients. */
  private broadcastToExtensions(msg: Record<string, unknown>): void {
    const data = JSON.stringify(msg);
    for (const ext of this.extensionClients) {
      if (ext.readyState === WebSocket.OPEN) {
        ext.send(data);
      }
    }
  }

  private removeConnection(ws: WebSocket): void {
    // Check if it's an extension client
    if (this.extensionClients.delete(ws)) return;

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
      // Notify extension clients about device disconnect
      this.broadcastToExtensions({
        type: 'devices-changed',
        devices: this.getConnectedDevices(),
      });
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

          // Update lastMessageTime for stale detection
          const existingDeviceId = this.deviceByWs.get(ws);
          if (existingDeviceId) {
            const existingConn = this.devices.get(existingDeviceId);
            if (existingConn) existingConn.lastMessageTime = Date.now();
          }

          // Application-level ping/pong (RN WebSocket doesn't support protocol-level ping)
          if (msg?.type === 'ping') {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
            return;
          }

          // Extension client handshake
          if (this.awaitingInit.has(ws) && msg?.type === 'extension-init') {
            this.awaitingInit.delete(ws);
            this.extensionClients.add(ws);
            ws.send(
              JSON.stringify({
                type: 'extension-init-ack',
                devices: this.getConnectedDevices(),
              })
            );
            return;
          }

          // Extension client eval request → forward to app device
          if (this.extensionClients.has(ws) && msg?.method === 'eval') {
            const reqId = typeof msg.id === 'string' ? msg.id : crypto.randomUUID();
            const params = (msg.params ?? {}) as Record<string, unknown>;
            const deviceId = typeof params.deviceId === 'string' ? params.deviceId : undefined;
            const platform = typeof params.platform === 'string' ? params.platform : undefined;
            const code = typeof params.code === 'string' ? params.code : '';
            this.sendRequest({ method: 'eval', params: { code } }, 10000, deviceId, platform)
              .then((res) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ id: reqId, result: res.result, error: res.error }));
                }
              })
              .catch((err) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      id: reqId,
                      error: err instanceof Error ? err.message : String(err),
                    })
                  );
                }
              });
            return;
          }

          // Extension client: get connected devices directly
          if (this.extensionClients.has(ws) && msg?.method === 'getDevices') {
            const reqId = typeof msg.id === 'string' ? msg.id : crypto.randomUUID();
            ws.send(
              JSON.stringify({
                id: reqId,
                result: this.getConnectedDevices(),
              })
            );
            return;
          }

          if (this.awaitingInit.has(ws) && msg?.type === 'init') {
            this.awaitingInit.delete(ws);
            const platform = typeof msg.platform === 'string' ? msg.platform : 'unknown';
            const deviceId = this.nextDeviceId(platform);
            const deviceName = typeof msg.deviceName === 'string' ? msg.deviceName : null;
            const metroBaseUrl = typeof msg.metroBaseUrl === 'string' ? msg.metroBaseUrl : null;
            const pixelRatio = typeof msg.pixelRatio === 'number' ? msg.pixelRatio : null;
            const screenHeightDp = typeof msg.screenHeight === 'number' ? msg.screenHeight : 0;
            const windowHeightDp = typeof msg.windowHeight === 'number' ? msg.windowHeight : 0;

            const conn: DeviceConnection = {
              deviceId,
              platform,
              deviceName,
              ws,
              pending: new Map(),
              metroBaseUrl,
              pixelRatio,
              topInsetPx: 0,
              screenHeightDp,
              windowHeightDp,
              lastMessageTime: Date.now(),
            };
            this.devices.set(deviceId, conn);
            this.deviceByWs.set(ws, deviceId);
            if (metroBaseUrl) setMetroBaseUrlFromApp(metroBaseUrl, deviceId);

            // Notify extension clients about new device
            this.broadcastToExtensions({
              type: 'devices-changed',
              devices: this.getConnectedDevices(),
            });

            // Android: top inset 감지 + windowIncludesStatusBar 판별
            if (platform === 'android') {
              const ratio = pixelRatio ?? 1;
              // init 메시지에 topInsetDp가 있으면 수동 오버라이드
              const userTopInset = typeof msg.topInsetDp === 'number' ? msg.topInsetDp : null;
              if (userTopInset != null) {
                conn.topInsetPx = Math.round(userTopInset * ratio);
                if (conn.ws.readyState === 1) {
                  conn.ws.send(JSON.stringify({ type: 'setTopInsetDp', topInsetDp: userTopInset }));
                }
              } else {
                getAndroidInsets()
                  .then((insets) => {
                    const topPx =
                      insets.captionBarPx > 0 ? insets.captionBarPx : insets.statusBarPx;
                    conn.topInsetPx = topPx;

                    // 판별: screenHeight - windowHeight ≈ navBarDp → window가 statusBar 포함
                    const actualGap = screenHeightDp - windowHeightDp;
                    const navBarDp = insets.navBarPx / ratio;
                    console.error(
                      `[react-native-mcp-server] topInset detection: screenH=${screenHeightDp} windowH=${windowHeightDp} gap=${actualGap.toFixed(1)} navBarDp=${navBarDp.toFixed(1)} statusBarPx=${insets.statusBarPx} navBarPx=${insets.navBarPx}`
                    );
                    if (Math.abs(actualGap - navBarDp) <= 4) {
                      conn.windowIncludesStatusBar = true;
                      console.error(
                        `[react-native-mcp-server] windowIncludesStatusBar=true → topInset=0dp`
                      );
                      if (conn.ws.readyState === 1) {
                        conn.ws.send(JSON.stringify({ type: 'setTopInsetDp', topInsetDp: 0 }));
                      }
                      return;
                    }

                    // window가 statusBar 미포함 → topInset 더함
                    if (topPx > 0 && conn.ws.readyState === 1) {
                      const topInsetDp = topPx / ratio;
                      console.error(
                        `[react-native-mcp-server] windowIncludesStatusBar=false → topInset=${topInsetDp}dp`
                      );
                      conn.ws.send(JSON.stringify({ type: 'setTopInsetDp', topInsetDp }));
                    }
                  })
                  .catch(() => {
                    /* keep 0 */
                  });
              }
            }
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
    // Stale connection detection: close connections with no messages for 60s
    this.staleCheckTimer = setInterval(() => {
      const now = Date.now();
      for (const conn of this.devices.values()) {
        if (now - conn.lastMessageTime > 60_000) {
          console.error(
            `[react-native-mcp-server] Closing stale connection: ${conn.deviceId} (no message for 60s)`
          );
          conn.ws.close();
        }
      }
    }, 15_000);

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
    stopAllRecordings();
    if (this.staleCheckTimer) {
      clearInterval(this.staleCheckTimer);
      this.staleCheckTimer = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    for (const ext of this.extensionClients) {
      ext.close();
    }
    this.extensionClients.clear();
    for (const [ws] of this.deviceByWs) {
      this.removeConnection(ws);
    }
  }
}

/** 싱글톤 앱 세션 (index에서 생성 후 tools에 전달) */
export const appSession = new AppSession();
