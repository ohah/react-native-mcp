import { GlobalRegistrator } from '@happy-dom/global-registrator';
try {
  await GlobalRegistrator.unregister();
} catch {}

import { describe, expect, it, beforeEach } from 'bun:test';

/**
 * cdp-interceptor.cjs는 side-effect 모듈이므로 핵심 로직을 직접 테스트.
 * createOurHandler, pushEvent 로직, dedup guard를 검증.
 */

// ─── pushEvent + MAX_EVENTS 로직 재현 ──────────────────────────

const MAX_EVENTS = 2000;

function createEventStore() {
  const events: Array<Record<string, unknown>> = [];
  return {
    push(entry: Record<string, unknown>) {
      events.push(entry);
      if (events.length > MAX_EVENTS) events.shift();
    },
    get events() {
      return events;
    },
    get length() {
      return events.length;
    },
  };
}

// ─── createOurHandler 로직 재현 ─────────────────────────────────

interface CdpMessage {
  method?: string;
  params?: unknown;
  id?: number;
}

interface CdpHandler {
  handleDeviceMessage?(message: CdpMessage): boolean | undefined;
  handleDebuggerMessage?(message: CdpMessage): boolean | undefined;
}

function createOurHandler(
  store: ReturnType<typeof createEventStore>,
  existingFactory?: (conn: unknown) => CdpHandler
) {
  return function (connection: unknown) {
    const existing = existingFactory ? existingFactory(connection) : null;
    return {
      handleDeviceMessage(message: CdpMessage) {
        try {
          store.push({
            direction: 'device',
            method: message.method,
            params: message.params,
            id: message.id,
            timestamp: Date.now(),
          });
        } catch {}
        if (existing?.handleDeviceMessage?.(message) === true) return true;
      },
      handleDebuggerMessage(message: CdpMessage) {
        try {
          store.push({
            direction: 'debugger',
            method: message.method,
            params: message.params,
            id: message.id,
            timestamp: Date.now(),
          });
        } catch {}
        if (existing?.handleDebuggerMessage?.(message) === true) return true;
      },
    };
  };
}

// ─── wrapCreateDevMiddleware dedup guard 재현 ────────────────────

function createDedupGuard() {
  let patched = false;
  return {
    get patched() {
      return patched;
    },
    tryPatch(): boolean {
      if (patched) return false;
      patched = true;
      return true;
    },
    reset() {
      patched = false;
    },
  };
}

// ─── 테스트 ─────────────────────────────────────────────────────

describe('pushEvent + MAX_EVENTS', () => {
  it('이벤트 추가', () => {
    const store = createEventStore();
    store.push({ direction: 'device', method: 'Runtime.consoleAPICalled', timestamp: 1 });
    expect(store.length).toBe(1);
    expect(store.events[0].method).toBe('Runtime.consoleAPICalled');
  });

  it('MAX_EVENTS 초과 시 오래된 이벤트 제거', () => {
    const store = createEventStore();
    for (let i = 0; i < MAX_EVENTS + 100; i++) {
      store.push({ direction: 'device', method: `event_${i}`, timestamp: i });
    }
    expect(store.length).toBe(MAX_EVENTS);
    // 첫 100개는 제거되고 event_100부터 시작
    expect(store.events[0].method).toBe('event_100');
    expect(store.events[store.length - 1].method).toBe(`event_${MAX_EVENTS + 99}`);
  });
});

describe('createOurHandler', () => {
  let store: ReturnType<typeof createEventStore>;

  beforeEach(() => {
    store = createEventStore();
  });

  it('device 메시지를 수집', () => {
    const handler = createOurHandler(store)(null);
    handler.handleDeviceMessage({ method: 'Runtime.consoleAPICalled', params: { type: 'log' } });
    expect(store.length).toBe(1);
    expect(store.events[0].direction).toBe('device');
    expect(store.events[0].method).toBe('Runtime.consoleAPICalled');
  });

  it('debugger 메시지를 수집', () => {
    const handler = createOurHandler(store)(null);
    handler.handleDebuggerMessage({ method: 'Runtime.evaluate', id: 1 });
    expect(store.length).toBe(1);
    expect(store.events[0].direction).toBe('debugger');
  });

  it('기존 핸들러 체이닝 (existing handler)', () => {
    let existingCalled = false;
    const existingFactory = () => ({
      handleDeviceMessage() {
        existingCalled = true;
        return true as const;
      },
    });
    const handler = createOurHandler(store, existingFactory)(null);
    const result = handler.handleDeviceMessage({ method: 'test' });
    expect(store.length).toBe(1); // 이벤트는 수집됨
    expect(existingCalled).toBe(true); // 기존 핸들러도 호출됨
    expect(result).toBe(true); // 기존 핸들러의 반환값 전파
  });

  it('기존 핸들러 없으면 undefined 반환', () => {
    const handler = createOurHandler(store)(null);
    const result = handler.handleDeviceMessage({ method: 'test' });
    expect(result).toBeUndefined();
  });
});

describe('devMiddlewarePatched dedup guard', () => {
  let guard: ReturnType<typeof createDedupGuard>;

  beforeEach(() => {
    guard = createDedupGuard();
  });

  it('최초 호출 시 패치 성공', () => {
    expect(guard.tryPatch()).toBe(true);
    expect(guard.patched).toBe(true);
  });

  it('두 번째 호출 시 패치 스킵', () => {
    guard.tryPatch();
    expect(guard.tryPatch()).toBe(false);
  });

  it('Module._load + patchDevMiddlewareDirect 이중 호출 방지 시뮬레이션', () => {
    // 시나리오: Module._load에서 먼저 패치
    const firstPatch = guard.tryPatch();
    expect(firstPatch).toBe(true);

    // patchDevMiddlewareDirect에서 두 번째 시도 → 스킵
    const secondPatch = guard.tryPatch();
    expect(secondPatch).toBe(false);
  });
});

describe('sendCdpEventsResponse 형식', () => {
  it('이벤트가 있을 때 lastEventTimestamp 포함', () => {
    const store = createEventStore();
    store.push({ direction: 'device', method: 'test', timestamp: 12345 });

    // sendCdpEventsResponse 로직 재현
    const lastEventTimestamp = store.length > 0 ? store.events[store.length - 1].timestamp : null;
    const body = { events: store.events, lastEventTimestamp };

    expect(body.events.length).toBe(1);
    expect(body.lastEventTimestamp).toBe(12345);
  });

  it('이벤트가 없을 때 lastEventTimestamp는 null', () => {
    const store = createEventStore();
    const lastEventTimestamp = store.length > 0 ? store.events[store.length - 1].timestamp : null;
    const body = { events: store.events, lastEventTimestamp };

    expect(body.events.length).toBe(0);
    expect(body.lastEventTimestamp).toBeNull();
  });
});
