/**
 * Render highlight (start/stop) — ws-client 메서드 및 message-handler 라우팅 테스트
 */

import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { createMessageHandler } from '../extension/webview/message-handler';
import type { WsClient } from '../extension/ws-client';

/* ── Mock WsClient ── */

function createMockClient(): WsClient {
  return {
    connected: true,
    devices: [],
    selectedDeviceId: null,
    selectedDevice: null,
    selectDevice: mock(() => {}),
    reconnect: mock(() => {}),
    connect: mock(() => {}),
    dispose: mock(() => {}),
    eval: mock(() => Promise.resolve(null)),
    getConsoleLogs: mock(() => Promise.resolve([])),
    clearConsoleLogs: mock(() => Promise.resolve()),
    getNetworkRequests: mock(() => Promise.resolve([])),
    clearNetworkRequests: mock(() => Promise.resolve()),
    getComponentTree: mock(() => Promise.resolve(null)),
    getStateChanges: mock(() => Promise.resolve([])),
    clearStateChanges: mock(() => Promise.resolve()),
    getRenderReport: mock(() => Promise.resolve(null)),
    startRenderProfile: mock(() => Promise.resolve(null)),
    clearRenderProfile: mock(() => Promise.resolve()),
    startRenderHighlight: mock(() => Promise.resolve({ active: true })),
    stopRenderHighlight: mock(() => Promise.resolve()),
    getAccessibilityAudit: mock(() => Promise.resolve([])),
    getDevices: mock(() => Promise.resolve([])),
    // EventEmitter stubs
    on: mock(() => ({}) as any),
    off: mock(() => ({}) as any),
    emit: mock(() => false),
    removeAllListeners: mock(() => ({}) as any),
  } as unknown as WsClient;
}

describe('message-handler: render highlight routing', () => {
  let client: WsClient;
  let handler: ReturnType<typeof createMessageHandler>;

  beforeEach(() => {
    client = createMockClient();
    handler = createMessageHandler(client);
  });

  it('startRenderHighlight 메시지를 client.startRenderHighlight로 라우팅', async () => {
    const res = await handler({
      type: 'startRenderHighlight',
      id: 'h1',
      payload: { showLabels: true, fadeTimeout: 2000 },
    });

    expect(res).toBeDefined();
    expect(res!.type).toBe('response');
    expect(res!.id).toBe('h1');
    expect(res!.error).toBeUndefined();
    expect(res!.result).toEqual({ active: true });

    expect(client.startRenderHighlight).toHaveBeenCalledTimes(1);
    const [opts] = (client.startRenderHighlight as ReturnType<typeof mock>).mock.calls[0]!;
    expect(opts).toMatchObject({ showLabels: true, fadeTimeout: 2000 });
  });

  it('stopRenderHighlight 메시지를 client.stopRenderHighlight로 라우팅', async () => {
    const res = await handler({
      type: 'stopRenderHighlight',
      id: 'h2',
    });

    expect(res).toBeDefined();
    expect(res!.type).toBe('response');
    expect(res!.id).toBe('h2');
    expect(res!.error).toBeUndefined();
    expect(res!.result).toBe(true);

    expect(client.stopRenderHighlight).toHaveBeenCalledTimes(1);
  });

  it('startRenderHighlight에 deviceId/platform 전달', async () => {
    await handler({
      type: 'startRenderHighlight',
      id: 'h3',
      payload: { deviceId: 'ios-1', platform: 'ios', components: ['App'] },
    });

    const [, deviceId, platform] = (client.startRenderHighlight as ReturnType<typeof mock>).mock
      .calls[0]!;
    expect(deviceId).toBe('ios-1');
    expect(platform).toBe('ios');
  });

  it('stopRenderHighlight에 deviceId/platform 전달', async () => {
    await handler({
      type: 'stopRenderHighlight',
      id: 'h4',
      payload: { deviceId: 'android-1', platform: 'android' },
    });

    const [deviceId, platform] = (client.stopRenderHighlight as ReturnType<typeof mock>).mock
      .calls[0]!;
    expect(deviceId).toBe('android-1');
    expect(platform).toBe('android');
  });

  it('client 에러 시 error 응답 반환', async () => {
    (client.startRenderHighlight as ReturnType<typeof mock>).mockRejectedValueOnce(
      new Error('Not connected')
    );

    const res = await handler({
      type: 'startRenderHighlight',
      id: 'h5',
      payload: {},
    });

    expect(res).toBeDefined();
    expect(res!.error).toBe('Not connected');
    expect(res!.result).toBeUndefined();
  });
});

describe('ws-client: render highlight IIFE code generation', () => {
  it('startRenderHighlight가 올바른 IIFE 코드를 eval에 전달', async () => {
    const evalFn = mock(() => Promise.resolve(null));
    const client = createMockClient();
    // Replace eval with a spy to inspect the generated code
    (client as any).eval = evalFn;

    // Import the real WsClient to test code generation
    const { WsClient } = await import('../extension/ws-client');
    const realClient = new WsClient(99999); // non-connecting port
    // Patch eval to capture the code string
    const codes: string[] = [];
    (realClient as any).eval = mock(async (code: string) => {
      codes.push(code);
      return null;
    });

    await realClient.startRenderHighlight({ showLabels: true, fadeTimeout: 1500 });

    expect(codes).toHaveLength(1);
    expect(codes[0]).toContain('startRenderHighlight');
    expect(codes[0]).toContain('"showLabels":true');
    expect(codes[0]).toContain('"fadeTimeout":1500');
    // Should be a valid IIFE
    expect(codes[0]).toMatch(/^\(function\(\)\{.*\}\)\(\);$/);

    realClient.dispose();
  });

  it('stopRenderHighlight가 올바른 IIFE 코드를 eval에 전달', async () => {
    const { WsClient } = await import('../extension/ws-client');
    const realClient = new WsClient(99999);
    const codes: string[] = [];
    (realClient as any).eval = mock(async (code: string) => {
      codes.push(code);
      return null;
    });

    await realClient.stopRenderHighlight();

    expect(codes).toHaveLength(1);
    expect(codes[0]).toContain('stopRenderHighlight');
    expect(codes[0]).toMatch(/^\(function\(\)\{.*\}\)\(\);$/);

    realClient.dispose();
  });
});
