/**
 * get_debugger_status 도구: appSession.isConnected(), getConnectedDevices() 반영 검증
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import { registerGetDebuggerStatus } from '../tools/get-debugger-status.js';
import type { AppSession } from '../websocket-server.js';

describe('get_debugger_status', () => {
  let mockServer: {
    registerTool: (
      name: string,
      def: unknown,
      handler: (args: unknown) => Promise<unknown>
    ) => void;
  };
  let lastHandler: (args: unknown) => Promise<unknown>;
  let appSession: AppSession;

  beforeEach(() => {
    lastHandler = async () => ({ content: [] });
    mockServer = {
      registerTool(name: string, def: unknown, handler: (args: unknown) => Promise<unknown>) {
        expect(name).toBe('get_debugger_status');
        lastHandler = handler;
      },
    };
    appSession = {
      isConnected: () => false,
      getConnectedDevices: () => [],
    } as unknown as AppSession;
    registerGetDebuggerStatus(mockServer as never, appSession);
  });

  it('appSession.isConnected() false, devices 빈 배열일 때 appConnected false·devices none', async () => {
    const result = (await lastHandler({})) as { content: Array<{ type: string; text: string }> };
    expect(result.content).toHaveLength(2);
    const jsonContent = result.content.find(
      (c) => c.type === 'text' && c.text.trim().startsWith('{')
    );
    expect(jsonContent).toBeDefined();
    const status = JSON.parse((jsonContent as { text: string }).text);
    expect(status.appConnected).toBe(false);
    expect(status.devices).toEqual([]);
    const textContent = result.content.find(
      (c) => c.type === 'text' && c.text.includes('appConnected:') && !c.text.startsWith('{')
    );
    expect(textContent?.text).toContain('appConnected: false');
    expect(textContent?.text).toContain('devices: none');
  });

  it('appSession.isConnected() true, getConnectedDevices() 1개일 때 devices 반영', async () => {
    (appSession as { isConnected: () => boolean }).isConnected = () => true;
    (appSession as { getConnectedDevices: () => unknown[] }).getConnectedDevices = () => [
      { deviceId: 'ios-1', platform: 'ios', deviceName: null, connected: true },
    ];
    const result = (await lastHandler({})) as { content: Array<{ type: string; text: string }> };
    const jsonContent = result.content.find((c) => c.type === 'text' && c.text.startsWith('{'));
    const status = JSON.parse((jsonContent as { text: string }).text);
    expect(status.appConnected).toBe(true);
    expect(status.devices).toHaveLength(1);
    expect(status.devices[0].deviceId).toBe('ios-1');
    expect(status.devices[0].platform).toBe('ios');
  });
});
