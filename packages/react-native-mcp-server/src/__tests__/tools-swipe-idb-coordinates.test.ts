/**
 * swipe / scroll_until_visible 도구: idb에 좌표 전달 시 정수로 반올림되는지 검증.
 * idb ui swipe는 x_start y_start x_end y_end에 정수만 허용 (소수 시 invalid int value 에러).
 */

import { describe, expect, it, beforeEach, mock } from 'bun:test';

const runIdbCommandCalls: { subcommand: string[]; udid: string }[] = [];

beforeEach(() => {
  runIdbCommandCalls.length = 0;
});

mock.module('../tools/idb-utils.js', () => ({
  checkIdbAvailable: async () => true,
  resolveUdid: async (_deviceId?: string) => 'booted',
  runIdbCommand: async (subcommand: string[], udid: string) => {
    runIdbCommandCalls.push({ subcommand, udid });
    return '';
  },
  idbNotInstalledError: () => ({ content: [{ type: 'text' as const, text: 'idb not installed' }] }),
}));

mock.module('../tools/adb-utils.js', () => ({
  checkAdbAvailable: async () => true,
  resolveSerial: async () => 'emulator-5554',
  runAdbCommand: async () => '',
  adbNotInstalledError: () => ({ content: [{ type: 'text' as const, text: 'adb not installed' }] }),
  getAndroidScale: async () => 3,
}));

describe('swipe 도구 — iOS idb 좌표 정수 반올림', () => {
  it('float 좌표 전달 시 idb에는 정수 문자열로 전달됨', async () => {
    const { registerSwipe } = await import('../tools/swipe.js');
    let handler: (args: unknown) => Promise<unknown>;
    const mockServer = {
      registerTool(_name: string, _def: unknown, h: (args: unknown) => Promise<unknown>) {
        handler = h;
      },
    };
    const appSession = { getPixelRatio: () => undefined };
    registerSwipe(mockServer as never, appSession as never);

    await handler!({
      platform: 'ios',
      x1: 100.4,
      y1: 742.75,
      x2: 100.4,
      y2: 542.25,
    });

    expect(runIdbCommandCalls).toHaveLength(1);
    const firstCall = runIdbCommandCalls[0];
    expect(firstCall).toBeDefined();
    const fullCmd = firstCall!.subcommand;
    expect(fullCmd[0]).toBe('ui');
    expect(fullCmd[1]).toBe('swipe');
    // idb ui swipe x_start y_start x_end y_end — 정수만 허용
    expect(fullCmd[2]).toBe('100'); // Math.round(100.4)
    expect(fullCmd[3]).toBe('743'); // Math.round(742.75)
    expect(fullCmd[4]).toBe('100');
    expect(fullCmd[5]).toBe('542');
    // 값이 정수 문자열인지 (idb invalid int 방지)
    expect(Number.isInteger(Number(fullCmd[2]))).toBe(true);
    expect(Number.isInteger(Number(fullCmd[3]))).toBe(true);
    expect(Number.isInteger(Number(fullCmd[4]))).toBe(true);
    expect(Number.isInteger(Number(fullCmd[5]))).toBe(true);
  });
});

describe('swipe 도구 — iOS duration/delta 인자', () => {
  it('idb 명령에 --delta 10 포함', async () => {
    const { registerSwipe } = await import('../tools/swipe.js');
    let handler: (args: unknown) => Promise<unknown>;
    const mockServer = {
      registerTool(_name: string, _def: unknown, h: (args: unknown) => Promise<unknown>) {
        handler = h;
      },
    };
    const appSession = { getPixelRatio: () => undefined };
    registerSwipe(mockServer as never, appSession as never);

    await handler!({
      platform: 'ios',
      x1: 100,
      y1: 200,
      x2: 100,
      y2: 100,
    });

    expect(runIdbCommandCalls).toHaveLength(1);
    const firstCall = runIdbCommandCalls[0];
    expect(firstCall).toBeDefined();
    const fullCmd = firstCall!.subcommand;
    const deltaIdx = fullCmd.indexOf('--delta');
    expect(deltaIdx).toBeGreaterThanOrEqual(0);
    const deltaValue = fullCmd[deltaIdx + 1];
    expect(deltaValue).toBe('10');
  });
});

describe('scroll_until_visible — iOS swipe 시 좌표 정수 반올림', () => {
  it('getScrollArea가 float 반환해도 idb에는 정수로 전달됨', async () => {
    runIdbCommandCalls.length = 0;
    const { registerScrollUntilVisible } = await import('../tools/scroll-until-visible.js');
    let handler: (args: unknown) => Promise<unknown>;
    const mockServer = {
      registerTool(_name: string, _def: unknown, h: (args: unknown) => Promise<unknown>) {
        handler = h;
      },
    };
    let sendRequestCallCount = 0;
    const appSession = {
      isConnected: () => true,
      sendRequest: async (_req: unknown) => {
        sendRequestCallCount++;
        // 1) getScreenBounds() (getScreenInfo) — return window size
        if (sendRequestCallCount === 1) {
          return { result: { window: { width: 390, height: 844 } } };
        }
        // 2) initial querySelector check — element not found
        if (sendRequestCallCount === 2) return { result: null };
        // 3) getScrollArea() for scrollableSelector — returns measure with floats
        if (sendRequestCallCount === 3) {
          return {
            result: {
              measure: { pageX: 0.5, pageY: 500.3, width: 200.8, height: 600.5 },
            },
          };
        }
        // 4) query after swipe — still not found (not important for this test)
        return { result: null };
      },
      getPixelRatio: () => undefined,
    };
    registerScrollUntilVisible(mockServer as never, appSession as never);

    // scroll_until_visible 내부에서 swipe 후 500ms sleep이 있어 테스트가 느려질 수 있음.
    // 이 테스트는 "idb로 전달되는 좌표가 정수"인지가 핵심이므로, 타이머는 즉시 실행으로 대체한다.
    const originalSetTimeout = globalThis.setTimeout;
    // @ts-expect-error - test-only timer override
    globalThis.setTimeout = ((cb: (...args: any[]) => void) => {
      cb();
      return 0 as any;
    }) as any;
    try {
      await handler!({
        platform: 'ios',
        selector: 'Pressable:text("버튼 99")',
        direction: 'down',
        maxScrolls: 1,
        scrollableSelector: 'ScrollView',
      });
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    const swipeCalls = runIdbCommandCalls.filter(
      (c) => c.subcommand[0] === 'ui' && c.subcommand[1] === 'swipe'
    );
    expect(swipeCalls.length).toBeGreaterThanOrEqual(1);
    const firstSwipe = swipeCalls[0];
    expect(firstSwipe).toBeDefined();
    const cmd = firstSwipe!.subcommand;
    expect(Number.isInteger(Number(cmd[2]))).toBe(true);
    expect(Number.isInteger(Number(cmd[3]))).toBe(true);
    expect(Number.isInteger(Number(cmd[4]))).toBe(true);
    expect(Number.isInteger(Number(cmd[5]))).toBe(true);
  });
});
