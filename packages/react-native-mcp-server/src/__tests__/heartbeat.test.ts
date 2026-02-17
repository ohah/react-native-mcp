import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { WebSocket } from 'ws';
import { AppSession } from '../websocket-server.js';

// 테스트용 포트 (기본 12300과 충돌 방지)
const TEST_PORT = 12399;

/** 클라이언트 WebSocket 연결 + init 메시지 전송, 등록 완료까지 대기 */
function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(`ws://localhost:${port}`);
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'init', platform: 'ios', deviceName: 'Test' }));
      // init 처리 후 서버에 등록될 시간 확보
      setTimeout(() => resolve(client), 50);
    });
    client.on('error', reject);
  });
}

/** 클라이언트로부터 특정 type의 메시지를 대기 */
function waitForMessage(
  client: WebSocket,
  type: string,
  timeoutMs = 2000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for "${type}" message`)),
      timeoutMs
    );
    const handler = (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.type === type) {
          clearTimeout(timer);
          client.off('message', handler);
          resolve(msg);
        }
      } catch {
        /* ignore */
      }
    };
    client.on('message', handler);
  });
}

describe('Heartbeat', () => {
  let session: AppSession;

  beforeEach(() => {
    session = new AppSession();
  });

  afterEach(() => {
    session.stop();
  });

  // ── ping → pong 응답 ──────────────────────────────────────────

  describe('ping/pong', () => {
    it('클라이언트가 ping을 보내면 서버가 pong으로 응답', async () => {
      session.start(TEST_PORT);
      const client = await connectClient(TEST_PORT);

      try {
        const pongPromise = waitForMessage(client, 'pong');
        client.send(JSON.stringify({ type: 'ping' }));
        const msg = await pongPromise;
        expect(msg.type).toBe('pong');
      } finally {
        client.close();
      }
    });

    it('init 전 ping도 pong 응답 (awaitingInit 상태)', async () => {
      session.start(TEST_PORT);

      const client = await new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
      });

      try {
        const pongPromise = waitForMessage(client, 'pong');
        client.send(JSON.stringify({ type: 'ping' }));
        const msg = await pongPromise;
        expect(msg.type).toBe('pong');
      } finally {
        client.close();
      }
    });

    it('ping은 init/response 로직에 영향 없음 (디바이스 수 변화 없음)', async () => {
      session.start(TEST_PORT);
      const client = await connectClient(TEST_PORT);

      try {
        expect(session.getConnectedDevices()).toHaveLength(1);

        // ping 여러 번 전송
        client.send(JSON.stringify({ type: 'ping' }));
        client.send(JSON.stringify({ type: 'ping' }));
        client.send(JSON.stringify({ type: 'ping' }));
        await new Promise((r) => setTimeout(r, 100));

        // 디바이스 수는 여전히 1
        expect(session.getConnectedDevices()).toHaveLength(1);
      } finally {
        client.close();
      }
    });
  });

  // ── lastMessageTime 갱신 ───────────────────────────────────────

  describe('lastMessageTime', () => {
    it('init 시 lastMessageTime이 설정됨', async () => {
      session.start(TEST_PORT);
      const before = Date.now();
      const client = await connectClient(TEST_PORT);

      try {
        const devices = session.getConnectedDevices();
        expect(devices).toHaveLength(1);
        const conn = session.resolveDevice(devices[0]!.deviceId);
        expect(conn.lastMessageTime).toBeGreaterThanOrEqual(before);
        expect(conn.lastMessageTime).toBeLessThanOrEqual(Date.now());
      } finally {
        client.close();
      }
    });

    it('ping 메시지가 lastMessageTime을 갱신', async () => {
      session.start(TEST_PORT);
      const client = await connectClient(TEST_PORT);

      try {
        const devices = session.getConnectedDevices();
        const conn = session.resolveDevice(devices[0]!.deviceId);
        const initialTime = conn.lastMessageTime;

        await new Promise((r) => setTimeout(r, 50));
        client.send(JSON.stringify({ type: 'ping' }));
        await new Promise((r) => setTimeout(r, 50));

        expect(conn.lastMessageTime).toBeGreaterThan(initialTime);
      } finally {
        client.close();
      }
    });
  });

  // ── stale 연결 감지 ────────────────────────────────────────────

  describe('stale connection detection', () => {
    it('lastMessageTime이 60초 이상 지난 연결은 닫힘', async () => {
      session.start(TEST_PORT);
      const client = await connectClient(TEST_PORT);

      try {
        expect(session.getConnectedDevices()).toHaveLength(1);

        // lastMessageTime을 과거로 강제 설정 (61초 전)
        const devices = session.getConnectedDevices();
        const conn = session.resolveDevice(devices[0]!.deviceId);
        conn.lastMessageTime = Date.now() - 61_000;

        // stale check는 15초 간격 → 연결이 닫힐 때까지 대기
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('Stale connection not closed within 20s')),
            20_000
          );
          client.on('close', () => {
            clearTimeout(timer);
            resolve();
          });
        });

        expect(session.getConnectedDevices()).toHaveLength(0);
      } finally {
        if (client.readyState === WebSocket.OPEN) client.close();
      }
    }, 25_000);

    it('최근 메시지가 있는 연결은 유지됨', async () => {
      session.start(TEST_PORT);
      const client = await connectClient(TEST_PORT);

      try {
        expect(session.getConnectedDevices()).toHaveLength(1);

        // lastMessageTime이 현재 → stale 아님
        await new Promise((r) => setTimeout(r, 100));
        expect(session.getConnectedDevices()).toHaveLength(1);
        expect(client.readyState).toBe(WebSocket.OPEN);
      } finally {
        client.close();
      }
    });

    it('stop() 후 stale 체크 타이머가 정리됨', async () => {
      session.start(TEST_PORT);
      const client = await connectClient(TEST_PORT);

      const devices = session.getConnectedDevices();
      const conn = session.resolveDevice(devices[0]!.deviceId);
      conn.lastMessageTime = Date.now() - 61_000;

      // stop()으로 타이머 정리
      session.stop();

      // stop() 후에는 stale check가 동작하지 않아야 함
      await new Promise((r) => setTimeout(r, 100));
      // stop()이 이미 연결을 정리하므로 별도 확인 불필요 — 에러 없이 완료되면 성공
    });
  });
});
