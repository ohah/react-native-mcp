/**
 * clear-buffers: 통합 clear 도구 (target: console | network_requests | network_mocks | state_changes | render_profile)
 */

import { describe, expect, it, beforeEach, mock } from 'bun:test';

describe('registerClearBuffers', () => {
  let handlers: Record<string, (args: unknown) => Promise<unknown>>;
  let appSession: {
    isConnected: (deviceId?: string, platform?: string) => boolean;
    sendRequest: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    handlers = {};
    const mockServer = {
      registerTool(name: string, _def: unknown, handler: (args: unknown) => Promise<unknown>) {
        handlers[name] = handler;
      },
    };
    appSession = {
      isConnected: () => true,
      sendRequest: mock(() => Promise.resolve({ error: null, result: true })),
    };
    const { registerClearBuffers } = await import('../tools/clear-buffers.js');
    registerClearBuffers(mockServer as never, appSession as never);
  });

  it('clear 도구만 등록', () => {
    expect(handlers['clear']).toBeDefined();
    expect(Object.keys(handlers)).toEqual(['clear']);
  });

  const targets = [
    { target: 'console', msg: 'Console messages cleared' },
    { target: 'network_requests', msg: 'Network requests cleared' },
    { target: 'network_mocks', msg: 'Network mock rules cleared' },
    { target: 'state_changes', msg: 'State changes cleared' },
    { target: 'render_profile', msg: 'Render profiling stopped' },
  ] as const;

  for (const { target, msg } of targets) {
    it(`clear(target: '${target}') — 성공 메시지`, async () => {
      const clearHandler = handlers['clear'];
      if (!clearHandler) throw new Error('clear handler not registered');
      const result = (await clearHandler({ target })) as {
        content: Array<{ type: string; text: string }>;
      };
      const firstContent = result.content[0];
      expect(firstContent?.text).toContain(msg);
      expect(appSession.sendRequest).toHaveBeenCalledTimes(1);
      const sendRequestMock = appSession.sendRequest as ReturnType<typeof mock>;
      const firstInvocation = sendRequestMock.mock.calls[0];
      if (!firstInvocation) throw new Error('Expected sendRequest to have been called');
      const firstArg = firstInvocation[0] as { params?: { code?: string } } | undefined;
      const code = firstArg?.params?.code ?? '';
      const method =
        target === 'console'
          ? 'clearConsoleLogs'
          : target === 'network_requests'
            ? 'clearNetworkRequests'
            : target === 'network_mocks'
              ? 'clearNetworkMocks'
              : target === 'state_changes'
                ? 'clearStateChanges'
                : 'clearRenderProfile';
      expect(code).toContain(method);
    });
  }

  it('연결 안 됐을 때 에러 메시지', async () => {
    appSession.isConnected = () => false;
    const clearHandler = handlers['clear'];
    if (!clearHandler) throw new Error('clear handler not registered');
    const result = (await clearHandler({ target: 'console' })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0]?.text).toContain('No React Native app connected');
    expect(appSession.sendRequest).not.toHaveBeenCalled();
  });

  it('target 없으면 invalid args', async () => {
    const clearHandler = handlers['clear'];
    if (!clearHandler) throw new Error('clear handler not registered');
    const result = (await clearHandler({})) as {
      isError: boolean;
      content: Array<{ type: string; text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('invalid args');
  });
});
