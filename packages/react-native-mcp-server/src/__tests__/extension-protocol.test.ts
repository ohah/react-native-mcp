/**
 * 확장 클라이언트용 WebSocket 프로토콜 테스트:
 * extension-init, extension-init-ack, getDevices, eval
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { WebSocket } from 'ws';
import { AppSession } from '../websocket-server.js';

const TEST_PORT = 12398;

/** extension-init 전송 후 extension-init-ack 수신까지 대기 */
function connectExtensionClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'extension-init' }));
    });
    const handler = (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.type === 'extension-init-ack') {
          ws.off('message', handler);
          resolve(ws);
        }
      } catch {
        /* ignore */
      }
    };
    ws.on('message', handler);
    ws.on('error', reject);
  });
}

/** 앱 클라이언트: init 전송 후 서버에 디바이스 등록 */
function connectAppClient(port: number, platform = 'ios'): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'init',
          platform,
          deviceName: 'Test Device',
        })
      );
      setTimeout(() => resolve(ws), 50);
    });
    ws.on('error', reject);
  });
}

/** id 필드로 응답 메시지 대기 (getDevices / eval 응답) */
function waitForResponse(
  ws: WebSocket,
  id: string,
  timeoutMs = 5000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for response id=${id}`)),
      timeoutMs
    );
    const handler = (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.id === id) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      } catch {
        /* ignore */
      }
    };
    ws.on('message', handler);
  });
}

describe('Extension client protocol', () => {
  let session: AppSession;

  beforeEach(() => {
    session = new AppSession();
    session.start(TEST_PORT);
  });

  afterEach(() => {
    session.stop();
  });

  describe('extension-init', () => {
    it('extension-init 전송 시 extension-init-ack 수신, devices 배열 포함', async () => {
      const ext = await connectExtensionClient(TEST_PORT);
      try {
        // connectExtensionClient가 이미 ack 수신 후 resolve하므로 확장은 등록됨
        // ack 내용은 연결 시 한 번만 오므로, getDevices로 간접 검증
        const reqId = 'init-check';
        ext.send(
          JSON.stringify({
            method: 'getDevices',
            id: reqId,
          })
        );
        const res = await waitForResponse(ext, reqId);
        expect(res.result).toBeDefined();
        expect(Array.isArray(res.result)).toBe(true);
        expect(res.error).toBeUndefined();
      } finally {
        ext.close();
      }
    });

    it('extension-init 후 getDevices 호출 가능', async () => {
      const ext = await connectExtensionClient(TEST_PORT);
      try {
        ext.send(
          JSON.stringify({
            method: 'getDevices',
            id: 'd1',
          })
        );
        const res = await waitForResponse(ext, 'd1');
        expect(Array.isArray(res.result)).toBe(true);
        expect((res.result as unknown[]).length).toBe(0);
      } finally {
        ext.close();
      }
    });
  });

  describe('getDevices', () => {
    it('앱 연결 없을 때 빈 배열 반환', async () => {
      const ext = await connectExtensionClient(TEST_PORT);
      try {
        ext.send(JSON.stringify({ method: 'getDevices', id: 'g1' }));
        const res = await waitForResponse(ext, 'g1');
        expect(res.result).toEqual([]);
      } finally {
        ext.close();
      }
    });

    it('앱 1대 연결 후 getDevices에 해당 디바이스 포함', async () => {
      const app = await connectAppClient(TEST_PORT, 'ios');
      const ext = await connectExtensionClient(TEST_PORT);
      try {
        ext.send(JSON.stringify({ method: 'getDevices', id: 'g2' }));
        const res = await waitForResponse(ext, 'g2');
        const devices = res.result as Array<{ deviceId: string; platform: string }>;
        expect(devices).toHaveLength(1);
        expect(devices[0]!.deviceId).toBe('ios-1');
        expect(devices[0]!.platform).toBe('ios');
      } finally {
        app.close();
        ext.close();
      }
    });

    it('id 없이 getDevices 요청해도 서버가 id 부여 후 응답', async () => {
      const ext = await connectExtensionClient(TEST_PORT);
      try {
        ext.send(JSON.stringify({ method: 'getDevices' }));
        // 서버가 id를 crypto.randomUUID()로 부여하므로, 첫 번째 수신 메시지가 getDevices 응답
        const msg = await new Promise<Record<string, unknown>>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('timeout')), 3000);
          const handler = (data: Buffer | string) => {
            clearTimeout(t);
            ext.off('message', handler);
            resolve(JSON.parse(data.toString()) as Record<string, unknown>);
          };
          ext.on('message', handler);
        });
        expect(msg.result).toBeDefined();
        expect(Array.isArray(msg.result)).toBe(true);
      } finally {
        ext.close();
      }
    });
  });

  describe('eval', () => {
    it('디바이스 없을 때 eval 요청 시 error 응답', async () => {
      const ext = await connectExtensionClient(TEST_PORT);
      try {
        ext.send(
          JSON.stringify({
            method: 'eval',
            id: 'e1',
            params: { code: '1+1' },
          })
        );
        const res = await waitForResponse(ext, 'e1');
        expect(res.error).toBeDefined();
        expect(String(res.error)).toMatch(/connected|device/i);
      } finally {
        ext.close();
      }
    });

    it('디바이스 연결 시 eval 요청이 앱으로 전달되고 응답이 확장에 반환됨', async () => {
      const app = await connectAppClient(TEST_PORT, 'ios');
      const ext = await connectExtensionClient(TEST_PORT);

      const evalReqId = 'e2';
      app.on('message', (data: Buffer | string) => {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.method === 'eval' && typeof msg.id === 'string') {
          app.send(
            JSON.stringify({
              id: msg.id,
              result: 42,
            })
          );
        }
      });

      try {
        ext.send(
          JSON.stringify({
            method: 'eval',
            id: evalReqId,
            params: { deviceId: 'ios-1', code: '1+1' },
          })
        );
        const res = await waitForResponse(ext, evalReqId);
        expect(res.error).toBeUndefined();
        expect(res.result).toBe(42);
      } finally {
        app.close();
        ext.close();
      }
    });
  });
});
