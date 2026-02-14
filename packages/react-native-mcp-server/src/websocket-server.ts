/**
 * MCP 서버 ↔ React Native 앱 간 WebSocket 서버 (Phase 1)
 * 포트 12300에서 앱 연결 수락, eval 요청 전송 및 응답 수신.
 * 앱이 연결 시 type:'init', metroBaseUrl 전송하면 CDP 요청에 해당 Metro 포트 사용.
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
 * 앱 연결 세션: 단일 WebSocket으로 요청/응답 매칭
 */
export class AppSession {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingResolver>();
  private server: WebSocketServer | null = null;

  /** 현재 앱이 연결되어 있는지 */
  isConnected(): boolean {
    return this.ws != null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * WebSocket 서버 시작 (지정 포트, 기본 12300)
   */
  start(port: number = DEFAULT_PORT): void {
    if (this.server) return;
    const wss = new WebSocketServer({ port });
    wss.on('connection', (ws: WebSocket) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Another app already connected');
        return;
      }
      this.ws = ws;
      ws.on('message', (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          if (msg?.type === 'init' && typeof msg.metroBaseUrl === 'string') {
            setMetroBaseUrlFromApp(msg.metroBaseUrl);
            return;
          }
          const res = msg as unknown as AppResponse;
          if (res.id && this.pending.has(res.id)) {
            const { resolve } = this.pending.get(res.id)!;
            this.pending.delete(res.id);
            resolve(res);
          }
        } catch {
          // ignore malformed
        }
      });
      ws.on('close', () => {
        setMetroBaseUrlFromApp(null);
        this.ws = null;
      });
      ws.on('error', () => {
        setMetroBaseUrlFromApp(null);
        this.ws = null;
      });
    });
    wss.on('listening', () => {
      this.server = wss;
      console.error(`[react-native-mcp-server] WebSocket server listening on ws://localhost:${port}`);
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

  /**
   * 앱에 요청 전송 후 응답 대기 (타임아웃 ms)
   */
  async sendRequest(
    request: Omit<AppRequest, 'id'>,
    timeoutMs: number = 10000
  ): Promise<AppResponse> {
    const id = crypto.randomUUID();
    const msg: AppRequest = { ...request, id };

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(
        'No React Native app connected. Start the app with Metro and ensure the runtime is loaded.'
      );
    }
    const ws = this.ws;

    return new Promise<AppResponse>((resolve, reject) => {
      const t = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new Error('Request timeout: no response from app'));
        }
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (res) => {
          clearTimeout(t);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(t);
          reject(err);
        },
      });
      ws.send(JSON.stringify(msg));
    });
  }

  /** 서버 종료 */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.ws = null;
    for (const { reject } of this.pending.values()) {
      reject(new Error('Server stopped'));
    }
    this.pending.clear();
  }
}

/** 싱글톤 앱 세션 (index에서 생성 후 tools에 전달) */
export const appSession = new AppSession();
