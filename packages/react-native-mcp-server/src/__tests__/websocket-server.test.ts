import { describe, expect, it, beforeEach } from 'bun:test';
import { WebSocket } from 'ws';
import { AppSession } from '../websocket-server.js';
import type { DeviceConnection } from '../websocket-server.js';

// ─── Mock WebSocket ──────────────────────────────────────────────

function createMockWs(readyState: number = WebSocket.OPEN): WebSocket {
  return { readyState } as unknown as WebSocket;
}

function makeDevice(
  deviceId: string,
  platform: string,
  opts?: { deviceName?: string; readyState?: number }
): DeviceConnection {
  return {
    deviceId,
    platform,
    deviceName: opts?.deviceName ?? null,
    ws: createMockWs(opts?.readyState ?? WebSocket.OPEN),
    pending: new Map(),
    metroBaseUrl: null,
  };
}

// ─── 테스트 ──────────────────────────────────────────────────────

describe('AppSession', () => {
  let session: AppSession;

  beforeEach(() => {
    session = new AppSession();
  });

  // ── resolveDevice ────────────────────────────────────────────

  describe('resolveDevice', () => {
    it('deviceId로 정확히 조회', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios'));

      const result = session.resolveDevice('ios-1');
      expect(result.deviceId).toBe('ios-1');
    });

    it('없는 deviceId → 에러', () => {
      expect(() => session.resolveDevice('ios-99')).toThrow('not connected');
    });

    it('닫힌 WebSocket의 deviceId → 에러', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios', { readyState: WebSocket.CLOSED }));

      expect(() => session.resolveDevice('ios-1')).toThrow('not connected');
    });

    it('platform으로 1대 자동 선택', () => {
      session._testInjectDevice(makeDevice('android-1', 'android'));

      const result = session.resolveDevice(undefined, 'android');
      expect(result.deviceId).toBe('android-1');
    });

    it('platform으로 2대+ → 에러', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios'));
      session._testInjectDevice(makeDevice('ios-2', 'ios'));

      expect(() => session.resolveDevice(undefined, 'ios')).toThrow('Multiple');
    });

    it('platform에 해당 디바이스 0대 → 에러', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios'));

      expect(() => session.resolveDevice(undefined, 'android')).toThrow('No android');
    });

    it('인자 없이 1대 → 자동 선택', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios'));

      const result = session.resolveDevice();
      expect(result.deviceId).toBe('ios-1');
    });

    it('인자 없이 2대+ → 에러', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios'));
      session._testInjectDevice(makeDevice('android-1', 'android'));

      expect(() => session.resolveDevice()).toThrow('Multiple devices');
    });

    it('인자 없이 0대 → 에러', () => {
      expect(() => session.resolveDevice()).toThrow('No React Native app connected');
    });

    it('닫힌 연결은 후보에서 제외', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios', { readyState: WebSocket.CLOSED }));
      session._testInjectDevice(makeDevice('ios-2', 'ios'));

      const result = session.resolveDevice(undefined, 'ios');
      expect(result.deviceId).toBe('ios-2');
    });
  });

  // ── isConnected ──────────────────────────────────────────────

  describe('isConnected', () => {
    it('디바이스 0대 → false', () => {
      expect(session.isConnected()).toBe(false);
    });

    it('디바이스 1대 → true', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios'));
      expect(session.isConnected()).toBe(true);
    });

    it('디바이스 2대+ → true (에러 아님)', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios'));
      session._testInjectDevice(makeDevice('android-1', 'android'));
      expect(session.isConnected()).toBe(true);
    });

    it('모든 연결 닫힘 → false', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios', { readyState: WebSocket.CLOSED }));
      expect(session.isConnected()).toBe(false);
    });

    it('deviceId 지정 → 해당 디바이스 연결 여부', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios'));
      expect(session.isConnected('ios-1')).toBe(true);
      expect(session.isConnected('ios-99')).toBe(false);
    });

    it('platform 지정 + 1대 → true', () => {
      session._testInjectDevice(makeDevice('android-1', 'android'));
      expect(session.isConnected(undefined, 'android')).toBe(true);
      expect(session.isConnected(undefined, 'ios')).toBe(false);
    });

    it('platform 지정 + 2대 → false (resolveDevice 에러를 잡아서)', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios'));
      session._testInjectDevice(makeDevice('ios-2', 'ios'));
      expect(session.isConnected(undefined, 'ios')).toBe(false);
    });
  });

  // ── getConnectedDevices ──────────────────────────────────────

  describe('getConnectedDevices', () => {
    it('빈 세션 → 빈 배열', () => {
      expect(session.getConnectedDevices()).toEqual([]);
    });

    it('열린 연결만 반환', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios', { deviceName: 'iPhone 15' }));
      session._testInjectDevice(makeDevice('ios-2', 'ios', { readyState: WebSocket.CLOSED }));
      session._testInjectDevice(makeDevice('android-1', 'android'));

      const devices = session.getConnectedDevices();
      expect(devices).toHaveLength(2);
      expect(devices.map((d) => d.deviceId).sort()).toEqual(['android-1', 'ios-1']);
    });

    it('DeviceInfo 형태로 반환 (ws 미포함)', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios', { deviceName: 'iPhone 15' }));

      const [info] = session.getConnectedDevices();
      expect(info).toEqual({
        deviceId: 'ios-1',
        platform: 'ios',
        deviceName: 'iPhone 15',
        connected: true,
      });
      expect((info as Record<string, unknown>).ws).toBeUndefined();
    });
  });

  // ── deviceId 생성 패턴 ───────────────────────────────────────

  describe('deviceId 생성 패턴', () => {
    it('같은 platform 디바이스를 여러 대 주입하면 ID가 다름', () => {
      session._testInjectDevice(makeDevice('ios-1', 'ios'));
      session._testInjectDevice(makeDevice('ios-2', 'ios'));
      session._testInjectDevice(makeDevice('android-1', 'android'));

      const devices = session.getConnectedDevices();
      const ids = devices.map((d) => d.deviceId);
      expect(ids).toContain('ios-1');
      expect(ids).toContain('ios-2');
      expect(ids).toContain('android-1');
    });
  });
});
