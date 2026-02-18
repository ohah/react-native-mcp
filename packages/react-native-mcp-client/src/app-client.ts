import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
import type {
  CreateAppOptions,
  Platform,
  DeviceOpts,
  AssertOpts,
  AssertResult,
  AssertCountResult,
  ElementInfo,
  ScrollUntilVisibleResult,
  DebuggerStatus,
  WaitOpts,
} from './types.js';
import { McpToolError, ConnectionError } from './errors.js';
import { clampToViewport, clampCoord, type ScreenBounds } from './viewport-clamp.js';

function resolveServerCwd(): string {
  try {
    const resolved = require.resolve('@ohah/react-native-mcp-server');
    // resolved points to dist/index.js, go up to package root
    return path.resolve(path.dirname(resolved), '..');
  } catch {
    return path.resolve(import.meta.dirname, '../../react-native-mcp-server');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** selector 패턴 감지: #, :, [, >, . 중 하나라도 포함되면 selector로 간주 */
function looksLikeSelector(value: string): boolean {
  return /[#:\[>.]/.test(value);
}

export class AppClient {
  private client: Client;
  private transport: StdioClientTransport;
  private platform: Platform;
  private deviceId?: string;
  private iosOrientation?: number;
  private _screenBounds: ScreenBounds | null = null;

  private constructor(
    client: Client,
    transport: StdioClientTransport,
    platform: Platform,
    deviceId?: string,
    iosOrientation?: number
  ) {
    this.client = client;
    this.transport = transport;
    this.platform = platform;
    this.deviceId = deviceId;
    this.iosOrientation = iosOrientation;
  }

  static async create(opts: CreateAppOptions): Promise<AppClient> {
    const serverCwd = opts.serverCwd ?? resolveServerCwd();

    const transport = new StdioClientTransport({
      command: opts.serverCommand ?? 'node',
      args: opts.serverArgs ?? ['dist/index.js'],
      cwd: serverCwd,
    });

    const client = new Client({ name: 'mcp-client-sdk', version: '1.0.0' });
    await client.connect(transport);

    const app = new AppClient(client, transport, opts.platform, opts.deviceId, opts.iosOrientation);

    // bundleId가 있고 launchApp !== false 이면 서버 시작 후 앱 자동 launch
    if (opts.bundleId && opts.launchApp !== false) {
      const deviceArg = opts.deviceId ?? 'booted';
      try {
        if (opts.platform === 'ios') {
          await execFileAsync('xcrun', ['simctl', 'launch', deviceArg, opts.bundleId]);
        } else {
          const adbArgs = opts.deviceId ? ['-s', opts.deviceId] : [];
          await execFileAsync('adb', [
            ...adbArgs,
            'shell',
            'monkey',
            '-p',
            opts.bundleId,
            '-c',
            'android.intent.category.LAUNCHER',
            '1',
          ]);
        }
      } catch (launchErr) {
        console.error('[mcp-client] Failed to launch app:', (launchErr as Error).message);
      }
    }

    if (opts.launchApp !== false) {
      try {
        await app._waitForConnection(
          opts.connectionTimeout ?? 90_000,
          opts.connectionInterval ?? 2_000
        );
      } catch (err) {
        await transport.close().catch(() => {});
        throw err;
      }
    }
    return app;
  }

  /** 앱 WebSocket 연결 대기 (launchApp: false 로 create() 한 뒤 setup의 launch 스텝 실행 후 호출) */
  async waitForConnection(timeoutMs?: number, intervalMs?: number): Promise<void> {
    await this._waitForConnection(timeoutMs ?? 90_000, intervalMs ?? 2_000);
  }

  // ─── Private helpers ────────────────────────────────────

  private defaultOpts(): Record<string, unknown> {
    const opts: Record<string, unknown> = {};
    if (this.platform) opts.platform = this.platform;
    if (this.deviceId) opts.deviceId = this.deviceId;
    if (this.iosOrientation) opts.iosOrientation = this.iosOrientation;
    return opts;
  }

  private async call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined) cleaned[k] = v;
    }
    const mergedArgs = { ...this.defaultOpts(), ...cleaned };
    const res = await this.client.callTool({ name, arguments: mergedArgs });
    const text = (res.content as Array<{ type: string; text: string }>)[0]?.text;
    if (!text) return res.content;

    if (res.isError) {
      throw new McpToolError(name, text);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private async _waitForConnection(timeoutMs: number, intervalMs: number): Promise<void> {
    const start = Date.now();
    let lastStatus: unknown = null;
    while (Date.now() - start < timeoutMs) {
      const res = (await this.call('get_debugger_status')) as DebuggerStatus;
      lastStatus = res;
      if (res.appConnected) return;
      await sleep(intervalMs);
    }
    throw new ConnectionError(
      `App did not connect within ${timeoutMs / 1000}s. Last status: ${JSON.stringify(lastStatus, null, 2)}`
    );
  }

  private async getScreenBounds(): Promise<ScreenBounds> {
    if (this._screenBounds) return this._screenBounds;
    const result = (await this.evaluate('() => __REACT_NATIVE_MCP__.getScreenInfo()')) as {
      window?: { width: number; height: number };
    };
    if (result?.window) {
      this._screenBounds = { width: result.window.width, height: result.window.height };
      return this._screenBounds;
    }
    // fallback: common screen size
    console.warn('[react-native-mcp] getScreenBounds: evaluate failed, using fallback 390×844');
    return { width: 390, height: 844 };
  }

  // ─── Query ──────────────────────────────────────────────

  async snapshot(opts?: { maxDepth?: number } & DeviceOpts): Promise<unknown> {
    return this.call('take_snapshot', { ...opts });
  }

  async querySelector(selector: string, opts?: DeviceOpts): Promise<ElementInfo | null> {
    const result = await this.call('query_selector', { selector, ...opts });
    if (result == null || (typeof result === 'string' && result.includes('No element'))) {
      return null;
    }
    return result as ElementInfo;
  }

  async querySelectorAll(selector: string, opts?: DeviceOpts): Promise<ElementInfo[]> {
    const result = await this.call('query_selector_all', { selector, ...opts });
    if (!Array.isArray(result)) return [];
    return result as ElementInfo[];
  }

  async screenshot(opts?: { filePath?: string } & DeviceOpts): Promise<unknown> {
    const mergedArgs = { ...this.defaultOpts(), ...opts };
    const res = await this.client.callTool({ name: 'take_screenshot', arguments: mergedArgs });
    return res.content;
  }

  async describeUi(
    opts?: { mode?: 'all' | 'point'; x?: number; y?: number; nested?: boolean } & DeviceOpts
  ): Promise<unknown> {
    return this.call('describe_ui', { ...opts });
  }

  // ─── Assert ─────────────────────────────────────────────

  async assertText(text: string, opts?: { selector?: string } & AssertOpts): Promise<AssertResult> {
    return this.call('assert_text', { text, ...opts }) as Promise<AssertResult>;
  }

  async assertVisible(selector: string, opts?: AssertOpts): Promise<AssertResult> {
    return this.call('assert_visible', { selector, ...opts }) as Promise<AssertResult>;
  }

  async assertNotVisible(selector: string, opts?: AssertOpts): Promise<AssertResult> {
    return this.call('assert_not_visible', { selector, ...opts }) as Promise<AssertResult>;
  }

  async assertElementCount(
    selector: string,
    opts: { expectedCount?: number; minCount?: number; maxCount?: number } & AssertOpts
  ): Promise<AssertCountResult> {
    return this.call('assert_element_count', { selector, ...opts }) as Promise<AssertCountResult>;
  }

  // ─── Interact (raw coordinate) ──────────────────────────

  async tapXY(x: number, y: number, opts?: { duration?: number } & DeviceOpts): Promise<unknown> {
    return this.call('tap', { x, y, ...opts });
  }

  async swipeXY(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opts?: { duration?: number } & DeviceOpts
  ): Promise<unknown> {
    return this.call('swipe', { x1, y1, x2, y2, ...opts });
  }

  async inputText(text: string, opts?: DeviceOpts): Promise<unknown> {
    return this.call('input_text', { text, ...opts });
  }

  async inputKey(keycode: number, opts?: DeviceOpts): Promise<unknown> {
    return this.call('input_key', { keycode, ...opts });
  }

  async pressButton(button: string, opts?: { duration?: number } & DeviceOpts): Promise<unknown> {
    return this.call('press_button', { button, ...opts });
  }

  async switchKeyboard(
    action: 'list' | 'get' | 'switch',
    opts?: { keyboard_id?: string } & DeviceOpts
  ): Promise<unknown> {
    return this.call('switch_keyboard', { action, ...opts });
  }

  async scrollUntilVisible(
    selector: string,
    opts?: {
      direction?: 'up' | 'down' | 'left' | 'right';
      maxScrolls?: number;
      scrollableSelector?: string;
    } & DeviceOpts
  ): Promise<ScrollUntilVisibleResult> {
    return this.call('scroll_until_visible', {
      selector,
      ...opts,
    }) as Promise<ScrollUntilVisibleResult>;
  }

  // ─── Execute ────────────────────────────────────────────

  async evaluate(fn: string, args?: unknown[], opts?: DeviceOpts): Promise<unknown> {
    return this.call('evaluate_script', { function: fn, args, ...opts });
  }

  async webviewEval(webViewId: string, script: string, opts?: DeviceOpts): Promise<unknown> {
    return this.call('webview_evaluate_script', { webViewId, script, ...opts });
  }

  // ─── Debug ──────────────────────────────────────────────

  async getStatus(): Promise<DebuggerStatus> {
    return this.call('get_debugger_status') as Promise<DebuggerStatus>;
  }

  async consoleLogs(
    opts?: { level?: string; since?: number; limit?: number } & DeviceOpts
  ): Promise<unknown> {
    return this.call('list_console_messages', { ...opts });
  }

  async clearConsoleLogs(opts?: DeviceOpts): Promise<unknown> {
    return this.call('clear_console_messages', { ...opts });
  }

  async networkRequests(
    opts?: {
      url?: string;
      method?: string;
      status?: number;
      since?: number;
      limit?: number;
    } & DeviceOpts
  ): Promise<unknown> {
    return this.call('list_network_requests', { ...opts });
  }

  async clearNetworkRequests(opts?: DeviceOpts): Promise<unknown> {
    return this.call('clear_network_requests', { ...opts });
  }

  // ─── Device ─────────────────────────────────────────────

  async listDevices(): Promise<unknown> {
    return this.call('list_devices');
  }

  async filePush(
    localPath: string,
    remotePath: string,
    opts?: { bundleId?: string } & DeviceOpts
  ): Promise<unknown> {
    return this.call('file_push', { localPath, remotePath, ...opts });
  }

  async addMedia(filePaths: string[], opts?: DeviceOpts): Promise<unknown> {
    return this.call('add_media', { filePaths, ...opts });
  }

  async openDeepLink(url: string, opts?: DeviceOpts): Promise<unknown> {
    return this.call('open_deeplink', { url, ...opts });
  }

  // ─── Convenience: tap by selector ───────────────────────

  async tap(selector: string, opts?: { duration?: number } & DeviceOpts): Promise<unknown> {
    const el = await this.querySelector(selector, opts);
    if (!el) throw new McpToolError('tap', `No element found for selector: ${selector}`);
    if (!el.measure) throw new McpToolError('tap', `Element "${selector}" has no measure data`);
    const rawX = el.measure.pageX + el.measure.width / 2;
    const rawY = el.measure.pageY + el.measure.height / 2;
    const screen = await this.getScreenBounds();
    const { cx: x, cy: y } = clampToViewport(rawX, rawY, el.measure, screen);
    return this.tapXY(x, y, opts);
  }

  // ─── Convenience: swipe by selector + direction ─────────

  async swipe(
    selector: string,
    opts: {
      direction: 'up' | 'down' | 'left' | 'right';
      distance?: number | string;
      duration?: number;
    } & DeviceOpts
  ): Promise<unknown> {
    const el = await this.querySelector(selector, opts);
    if (!el) throw new McpToolError('swipe', `No element found for selector: ${selector}`);
    if (!el.measure) throw new McpToolError('swipe', `Element "${selector}" has no measure data`);
    const rawCx = el.measure.pageX + el.measure.width / 2;
    const rawCy = el.measure.pageY + el.measure.height / 2;
    const screen = await this.getScreenBounds();
    const { cx, cy } = clampToViewport(rawCx, rawCy, el.measure, screen);
    let dist: number;
    if (typeof opts.distance === 'string' && opts.distance.endsWith('%')) {
      const pct = parseFloat(opts.distance) / 100;
      const safePct = Number.isFinite(pct) ? pct : 0.6;
      dist =
        opts.direction === 'up' || opts.direction === 'down'
          ? el.measure.height * safePct
          : el.measure.width * safePct;
    } else {
      dist =
        (opts.distance as number | undefined) ??
        Math.min(el.measure.width, el.measure.height) * 0.6;
    }
    let x1: number, y1: number, x2: number, y2: number;
    switch (opts.direction) {
      case 'up':
        x1 = cx;
        y1 = cy + dist / 2;
        x2 = cx;
        y2 = cy - dist / 2;
        break;
      case 'down':
        x1 = cx;
        y1 = cy - dist / 2;
        x2 = cx;
        y2 = cy + dist / 2;
        break;
      case 'left':
        x1 = cx + dist / 2;
        y1 = cy;
        x2 = cx - dist / 2;
        y2 = cy;
        break;
      case 'right':
        x1 = cx - dist / 2;
        y1 = cy;
        x2 = cx + dist / 2;
        y2 = cy;
        break;
    }
    // clamp final swipe endpoints to screen bounds
    const p1 = clampCoord(x1!, y1!, screen);
    const p2 = clampCoord(x2!, y2!, screen);
    return this.swipeXY(p1.x, p1.y, p2.x, p2.y, { duration: opts.duration, ...opts });
  }

  // ─── Convenience: typeText by selector or uid ───────────

  async typeText(selectorOrUid: string, text: string, opts?: DeviceOpts): Promise<unknown> {
    if (looksLikeSelector(selectorOrUid)) {
      const el = await this.querySelector(selectorOrUid, opts);
      if (!el) {
        throw new McpToolError('typeText', `No element found for selector: ${selectorOrUid}`);
      }
      return this.call('type_text', { uid: el.uid, text, ...opts });
    }
    return this.call('type_text', { uid: selectorOrUid, text, ...opts });
  }

  // ─── Convenience: clearText by selector ─────────────────

  async clearText(selector: string, opts?: DeviceOpts): Promise<unknown> {
    return this.typeText(selector, '', opts);
  }

  // ─── Convenience: doubleTap by selector ────────────────

  async doubleTap(selector: string, opts?: { interval?: number } & DeviceOpts): Promise<unknown> {
    const el = await this.querySelector(selector, opts);
    if (!el) throw new McpToolError('doubleTap', `No element found for selector: ${selector}`);
    if (!el.measure)
      throw new McpToolError('doubleTap', `Element "${selector}" has no measure data`);
    const rawX = el.measure.pageX + el.measure.width / 2;
    const rawY = el.measure.pageY + el.measure.height / 2;
    const screen = await this.getScreenBounds();
    const { cx: x, cy: y } = clampToViewport(rawX, rawY, el.measure, screen);
    await this.tapXY(x, y, opts);
    await sleep(opts?.interval ?? 50);
    return this.tapXY(x, y, opts);
  }

  // ─── Convenience: waitFor (Phase B 선구현) ──────────────

  async waitForText(text: string, opts?: { selector?: string } & WaitOpts): Promise<AssertResult> {
    return this.assertText(text, {
      selector: opts?.selector,
      timeoutMs: opts?.timeout ?? 5000,
      intervalMs: opts?.interval ?? 300,
      deviceId: opts?.deviceId,
      platform: opts?.platform,
    });
  }

  async waitForVisible(selector: string, opts?: WaitOpts): Promise<AssertResult> {
    return this.assertVisible(selector, {
      timeoutMs: opts?.timeout ?? 5000,
      intervalMs: opts?.interval ?? 300,
      deviceId: opts?.deviceId,
      platform: opts?.platform,
    });
  }

  async waitForNotVisible(selector: string, opts?: WaitOpts): Promise<AssertResult> {
    return this.assertNotVisible(selector, {
      timeoutMs: opts?.timeout ?? 5000,
      intervalMs: opts?.interval ?? 300,
      deviceId: opts?.deviceId,
      platform: opts?.platform,
    });
  }

  // ─── Phase C: 추가 Assertions ──────────────────────────

  async assertNoText(
    text: string,
    opts?: { selector?: string } & DeviceOpts
  ): Promise<AssertResult> {
    const result = await this.assertText(text, { ...opts, timeoutMs: 0 });
    return {
      pass: !result.pass,
      message: result.pass
        ? `Text "${text}" should not be present but was found`
        : `Text "${text}" correctly not found`,
    };
  }

  async assertCount(
    selector: string,
    count: number,
    opts?: AssertOpts
  ): Promise<AssertCountResult> {
    return this.assertElementCount(selector, { expectedCount: count, ...opts });
  }

  async assertValue(selector: string, expected: string, opts?: DeviceOpts): Promise<AssertResult> {
    const el = await this.querySelector(selector, opts);
    if (!el) return { pass: false, message: `Element not found: ${selector}` };
    const pass = el.value === expected;
    return {
      pass,
      message: pass
        ? `Value matches: "${expected}"`
        : `Expected value "${expected}" but got "${el.value}"`,
    };
  }

  async assertEnabled(selector: string, opts?: DeviceOpts): Promise<AssertResult> {
    const el = await this.querySelector(selector, opts);
    if (!el) return { pass: false, message: `Element not found: ${selector}` };
    const pass = !el.disabled;
    return { pass, message: pass ? `Element is enabled` : `Element is disabled` };
  }

  async assertDisabled(selector: string, opts?: DeviceOpts): Promise<AssertResult> {
    const el = await this.querySelector(selector, opts);
    if (!el) return { pass: false, message: `Element not found: ${selector}` };
    const pass = !!el.disabled;
    return { pass, message: pass ? `Element is disabled` : `Element is enabled` };
  }

  async waitFor(predicate: () => Promise<boolean>, opts?: WaitOpts): Promise<void> {
    const timeout = opts?.timeout ?? 5000;
    const interval = opts?.interval ?? 300;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await predicate()) return;
      await sleep(interval);
    }
    throw new McpToolError('waitFor', `Condition not met within ${timeout}ms`);
  }

  // ─── Phase D: 앱 생명주기 ─────────────────────────────

  async launch(bundleId: string, opts?: DeviceOpts): Promise<string> {
    const platform = opts?.platform ?? this.platform;
    if (platform === 'ios') {
      return this.exec('xcrun', ['simctl', 'launch', this.simctlDevice(opts), bundleId]);
    }
    return this.exec('adb', [
      ...this.adbArgs(opts),
      'shell',
      'monkey',
      '-p',
      bundleId,
      '-c',
      'android.intent.category.LAUNCHER',
      '1',
    ]);
  }

  async terminate(bundleId: string, opts?: DeviceOpts): Promise<string> {
    const platform = opts?.platform ?? this.platform;
    if (platform === 'ios') {
      return this.exec('xcrun', ['simctl', 'terminate', this.simctlDevice(opts), bundleId]);
    }
    return this.exec('adb', [...this.adbArgs(opts), 'shell', 'am', 'force-stop', bundleId]);
  }

  async resetApp(bundleId: string, opts?: DeviceOpts): Promise<void> {
    await this.terminate(bundleId, opts);
    await sleep(500);
    await this.launch(bundleId, opts);
  }

  // ─── Phase D: private helpers ─────────────────────────

  private async exec(command: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync(command, args);
    return stdout.trim();
  }

  private adbArgs(opts?: DeviceOpts): string[] {
    const id = opts?.deviceId ?? this.deviceId;
    return id ? ['-s', id] : [];
  }

  private simctlDevice(opts?: DeviceOpts): string {
    return opts?.deviceId ?? this.deviceId ?? 'booted';
  }

  // ─── Lifecycle ──────────────────────────────────────────

  async close(): Promise<void> {
    await this.transport.close();
  }
}

export async function createApp(opts: CreateAppOptions): Promise<AppClient> {
  return AppClient.create(opts);
}
