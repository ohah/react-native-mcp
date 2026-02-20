/**
 * Network mock — message-handler 라우팅 및 ws-client 코드 생성 테스트
 */

import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { createMessageHandler } from '../extension/webview/message-handler';
import type { WsClient } from '../extension/ws-client';

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
    listNetworkMocks: mock(() => Promise.resolve([])),
    setNetworkMock: mock(() => Promise.resolve({ id: 1, urlPattern: '/api' })),
    removeNetworkMock: mock(() => Promise.resolve(true)),
    clearNetworkMocks: mock(() => Promise.resolve()),
    getComponentTree: mock(() => Promise.resolve(null)),
    getStateChanges: mock(() => Promise.resolve([])),
    clearStateChanges: mock(() => Promise.resolve()),
    getRenderReport: mock(() => Promise.resolve(null)),
    startRenderProfile: mock(() => Promise.resolve(null)),
    clearRenderProfile: mock(() => Promise.resolve()),
    startRenderHighlight: mock(() => Promise.resolve(null)),
    stopRenderHighlight: mock(() => Promise.resolve()),
    getAccessibilityAudit: mock(() => Promise.resolve([])),
    getDevices: mock(() => Promise.resolve([])),
    on: mock(() => ({}) as any),
    off: mock(() => ({}) as any),
    emit: mock(() => false),
    removeAllListeners: mock(() => ({}) as any),
  } as unknown as WsClient;
}

describe('message-handler: network mock routing', () => {
  let client: WsClient;
  let handler: ReturnType<typeof createMessageHandler>;

  beforeEach(() => {
    client = createMockClient();
    handler = createMessageHandler(client);
  });

  it('listNetworkMocks 메시지를 client.listNetworkMocks로 라우팅', async () => {
    (client.listNetworkMocks as ReturnType<typeof mock>).mockResolvedValueOnce([
      { id: 1, urlPattern: '/api', method: 'GET', status: 200, hitCount: 0 },
    ]);

    const res = await handler({
      type: 'listNetworkMocks',
      id: 'm1',
      payload: {},
    });

    expect(res).toBeDefined();
    expect(res!.type).toBe('response');
    expect(res!.id).toBe('m1');
    expect(res!.error).toBeUndefined();
    expect(Array.isArray(res!.result)).toBe(true);
    expect((res!.result as any[]).length).toBe(1);
    expect(client.listNetworkMocks).toHaveBeenCalledTimes(1);
  });

  it('setNetworkMock 메시지를 client.setNetworkMock로 라우팅', async () => {
    const payload = {
      urlPattern: '/api/users',
      method: 'GET',
      status: 200,
      body: '{"ok":true}',
    };

    const res = await handler({
      type: 'setNetworkMock',
      id: 'm2',
      payload,
    });

    expect(res).toBeDefined();
    expect(res!.error).toBeUndefined();
    expect(client.setNetworkMock).toHaveBeenCalledTimes(1);
    const [opts] = (client.setNetworkMock as ReturnType<typeof mock>).mock.calls[0]!;
    expect(opts).toMatchObject(payload);
  });

  it('removeNetworkMock 메시지를 client.removeNetworkMock로 라우팅', async () => {
    const res = await handler({
      type: 'removeNetworkMock',
      id: 'm3',
      payload: { id: 42 },
    });

    expect(res).toBeDefined();
    expect(res!.result).toBe(true);
    expect(client.removeNetworkMock).toHaveBeenCalledWith(42, undefined, undefined);
  });

  it('clearNetworkMocks 메시지를 client.clearNetworkMocks로 라우팅', async () => {
    const res = await handler({
      type: 'clearNetworkMocks',
      id: 'm4',
    });

    expect(res).toBeDefined();
    expect(res!.result).toBe(true);
    expect(client.clearNetworkMocks).toHaveBeenCalledTimes(1);
  });

  it('setNetworkMock에 deviceId/platform 전달', async () => {
    await handler({
      type: 'setNetworkMock',
      id: 'm5',
      payload: { urlPattern: '/api', deviceId: 'ios-1', platform: 'ios' },
    });

    const [, deviceId, platform] = (client.setNetworkMock as ReturnType<typeof mock>).mock
      .calls[0]!;
    expect(deviceId).toBe('ios-1');
    expect(platform).toBe('ios');
  });

  it('listNetworkMocks 에러 시 error 응답 반환', async () => {
    (client.listNetworkMocks as ReturnType<typeof mock>).mockRejectedValueOnce(
      new Error('Not connected')
    );

    const res = await handler({
      type: 'listNetworkMocks',
      id: 'm6',
      payload: {},
    });

    expect(res!.error).toBe('Not connected');
  });
});

describe('ws-client: network mock IIFE code generation', () => {
  it('listNetworkMocks가 올바른 IIFE 코드를 eval에 전달', async () => {
    const { WsClient } = await import('../extension/ws-client');
    const client = new WsClient(99999);
    const codes: string[] = [];
    (client as any).eval = mock(async (code: string) => {
      codes.push(code);
      return [];
    });

    await client.listNetworkMocks();

    expect(codes).toHaveLength(1);
    expect(codes[0]).toContain('listNetworkMocks');
    expect(codes[0]).toMatch(/^\(function\(\)\{.*\}\)\(\);$/);
    client.dispose();
  });

  it('setNetworkMock가 올바른 IIFE 및 opts를 eval에 전달', async () => {
    const { WsClient } = await import('../extension/ws-client');
    const client = new WsClient(99999);
    const codes: string[] = [];
    (client as any).eval = mock(async (code: string) => {
      codes.push(code);
      return { id: 1 };
    });

    await client.setNetworkMock({
      urlPattern: '/api/test',
      method: 'POST',
      status: 201,
      body: '{}',
    });

    expect(codes).toHaveLength(1);
    expect(codes[0]).toContain('addNetworkMock');
    expect(codes[0]).toContain('/api/test');
    expect(codes[0]).toContain('"method":"POST"');
    expect(codes[0]).toContain('"status":201');
    expect(codes[0]).toMatch(/^\(function\(\)\{.*\}\)\(\);$/);
    client.dispose();
  });

  it('removeNetworkMock가 id를 eval에 전달', async () => {
    const { WsClient } = await import('../extension/ws-client');
    const client = new WsClient(99999);
    const codes: string[] = [];
    (client as any).eval = mock(async (code: string) => {
      codes.push(code);
      return true;
    });

    await client.removeNetworkMock(99);

    expect(codes).toHaveLength(1);
    expect(codes[0]).toContain('removeNetworkMock');
    expect(codes[0]).toContain('99');
    client.dispose();
  });

  it('clearNetworkMocks가 올바른 IIFE를 eval에 전달', async () => {
    const { WsClient } = await import('../extension/ws-client');
    const client = new WsClient(99999);
    const codes: string[] = [];
    (client as any).eval = mock(async (code: string) => {
      codes.push(code);
      return undefined;
    });

    await client.clearNetworkMocks();

    expect(codes).toHaveLength(1);
    expect(codes[0]).toContain('clearNetworkMocks');
    expect(codes[0]).toMatch(/^\(function\(\)\{.*\}\)\(\);$/);
    client.dispose();
  });
});
