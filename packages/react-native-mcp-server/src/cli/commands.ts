/**
 * CLI 명령어 구현.
 * 각 명령은 WebSocket extension client로 앱과 통신하고,
 * idb/adb를 직접 실행하여 디바이스를 제어한다.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WsClient, type DeviceInfo } from './ws-client.js';
import { loadSession, saveSession, resolveRef, type Session } from './session.js';
import { GUIDE_EN, GUIDE_KO, MARKER_START, MARKER_END } from './agent-guide.js';
import { assignRefs } from './ref-map.js';
import { resolveUdid, runIdbCommand, checkIdbAvailable } from '../tools/idb-utils.js';
import {
  resolveSerial,
  runAdbCommand,
  checkAdbAvailable,
  getAndroidScale,
  getAndroidTopInset,
} from '../tools/adb-utils.js';
import { transformForIdb, type IOSOrientationInfo } from '../tools/ios-landscape.js';
import {
  buildQuerySelectorEvalCode,
  buildQuerySelectorAllEvalCode,
} from '../tools/query-selector.js';
import { runCommand } from '../tools/run-command.js';

const execFileAsync = promisify(execFile);

// ─── Eval code builders ─────────────────────────────────────────

/** __REACT_NATIVE_MCP__ 메서드 호출 eval 코드 생성 */
function buildEvalCall(method: string, ...args: string[]): string {
  return `(function(){ var M = typeof __REACT_NATIVE_MCP__ !== 'undefined' ? __REACT_NATIVE_MCP__ : null; return M && M.${method} ? M.${method}(${args.join(', ')}) : null; })();`;
}

function evalGetComponentTree(maxDepth: number): string {
  return buildEvalCall('getComponentTree', `{ maxDepth: ${maxDepth} }`);
}

function evalGetScreenInfo(): string {
  return buildEvalCall('getScreenInfo');
}

// ─── 공유 상수 ───────────────────────────────────────────────────

const ANDROID_KEYCODES: Record<string, number> = {
  back: 4, home: 3, enter: 66, tab: 61, delete: 67,
  up: 19, down: 20, left: 21, right: 22,
};

const VALID_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

// ─── Shared helpers ──────────────────────────────────────────────

interface CliOptions {
  device?: string;
  platform?: string;
  port: number;
  json: boolean;
  timeout: number;
}

async function connectAndResolveDevice(
  opts: CliOptions
): Promise<{ ws: WsClient; device: DeviceInfo }> {
  const ws = await WsClient.connect(opts.port, opts.timeout);
  const devices = ws.devices;

  if (devices.length === 0) {
    ws.close();
    throw new Error(
      'No React Native app connected.\n' +
        'Make sure the app is running and connected to the MCP server.'
    );
  }

  let device: DeviceInfo;
  if (opts.device) {
    const found = devices.find((d) => d.deviceId === opts.device);
    if (!found) {
      ws.close();
      const available = devices.map((d) => `  ${d.deviceId} (${d.platform})`).join('\n');
      throw new Error(`Device "${opts.device}" not found.\nAvailable:\n${available}`);
    }
    device = found;
  } else if (opts.platform) {
    const found = devices.filter((d) => d.platform === opts.platform);
    if (found.length === 0) {
      ws.close();
      throw new Error(`No ${opts.platform} device connected.`);
    }
    if (found.length > 1) {
      ws.close();
      const list = found.map((d) => `  ${d.deviceId}`).join('\n');
      throw new Error(`Multiple ${opts.platform} devices. Specify --device:\n${list}`);
    }
    device = found[0]!;
  } else if (devices.length > 1) {
    ws.close();
    const list = devices.map((d) => `  ${d.deviceId} (${d.platform})`).join('\n');
    throw new Error(`Multiple devices connected. Specify --device or --platform:\n${list}`);
  } else {
    device = devices[0]!;
  }

  return { ws, device };
}

/**
 * ref 또는 selector에서 요소의 좌표를 가져온다.
 * @ref → session에서 uid/testID 조회 → selector 빌드 → querySelectorWithMeasure
 * selector → 직접 querySelectorWithMeasure
 */
async function resolveElementCoords(
  ws: WsClient,
  target: string,
  device: DeviceInfo
): Promise<{ pageX: number; pageY: number; width: number; height: number; uid: string }> {
  let selector: string;
  let filterUid: string | undefined;

  if (target.startsWith('@e')) {
    const session = loadSession();
    if (!session || Object.keys(session.refs).length === 0) {
      throw new Error(`No refs available. Run \`rn-mcp snapshot -i\` first.`);
    }
    const ref = resolveRef(session, target);

    if (ref.testID) {
      selector = `#${ref.testID}`;
    } else if (ref.text) {
      selector = `${ref.type}:text(${JSON.stringify(ref.text)})`;
    } else {
      // testID도 text도 없는 요소 → type으로 전부 조회 후 uid로 필터
      selector = ref.type;
      filterUid = ref.uid;
    }
  } else {
    selector = target;
  }

  let result: Record<string, unknown> | null = null;

  if (filterUid) {
    const all = (await ws.eval(
      buildQuerySelectorAllEvalCode(selector),
      device.deviceId,
      device.platform
    )) as Record<string, unknown>[];
    const match = all?.find((el) => el.uid === filterUid);
    if (match) result = match;
  } else {
    result = (await ws.eval(
      buildQuerySelectorEvalCode(selector),
      device.deviceId,
      device.platform
    )) as Record<string, unknown> | null;
  }

  if (!result) {
    throw new Error(
      `${target} not found on screen. Run \`rn-mcp snapshot -i\` to refresh refs.`
    );
  }

  return {
    pageX: Number(result.pageX ?? 0),
    pageY: Number(result.pageY ?? 0),
    width: Number(result.width ?? 0),
    height: Number(result.height ?? 0),
    uid: String(result.uid ?? ''),
  };
}

/**
 * iOS orientation 정보 수집 (CLI용).
 * appSession 없이 ws-client로 eval.
 */
async function getIOSOrientation(
  ws: WsClient,
  device: DeviceInfo,
  udid: string
): Promise<IOSOrientationInfo> {
  const defaultInfo: IOSOrientationInfo = { graphicsOrientation: 1, width: 0, height: 0 };
  if (device.platform !== 'ios') return defaultInfo;

  let width = 0;
  let height = 0;
  try {
    const info = (await ws.eval(evalGetScreenInfo(), device.deviceId, device.platform)) as {
      window?: { width: number; height: number };
    } | null;
    if (info?.window) {
      width = info.window.width;
      height = info.window.height;
    }
  } catch {
    return defaultInfo;
  }

  let graphicsOrientation = 1;
  try {
    const { stdout } = await execFileAsync(
      'xcrun',
      ['simctl', 'spawn', udid, 'defaults', 'read', 'com.apple.backboardd'],
      { timeout: 3000 }
    );
    const match = stdout.match(/GraphicsOrientation\s*=\s*(\d+)/);
    if (match?.[1]) graphicsOrientation = parseInt(match[1], 10);
  } catch {
    // default portrait
  }

  return { graphicsOrientation, width, height };
}

/** 요소 정보를 compact 한 줄 포맷으로 변환 */
function formatElementLine(el: Record<string, unknown>): string {
  const parts = [String(el.type ?? 'element')];
  if (el.testID) parts.push(`#${el.testID}`);
  if (el.uid && el.uid !== el.testID) parts.push(`uid=${el.uid}`);
  if (el.pageX != null) parts.push(`pageX=${Math.round(Number(el.pageX))}`);
  if (el.pageY != null) parts.push(`pageY=${Math.round(Number(el.pageY))}`);
  if (el.width != null) parts.push(`w=${Math.round(Number(el.width))}`);
  if (el.height != null) parts.push(`h=${Math.round(Number(el.height))}`);
  return parts.join(' ');
}

// ─── Commands ────────────────────────────────────────────────────

/**
 * rn-mcp status
 */
export async function cmdStatus(opts: CliOptions): Promise<void> {
  const ws = await WsClient.connect(opts.port, opts.timeout);
  const devices = ws.devices;

  if (devices.length === 0) {
    console.log('No devices connected.');
  } else {
    console.log(`Connected devices: ${devices.length}`);
    for (const d of devices) {
      console.log(`  ${d.deviceId} (${d.platform})${d.deviceName ? ` — ${d.deviceName}` : ''}`);
    }
  }

  const session = loadSession();
  if (session && Object.keys(session.refs).length > 0) {
    console.log(`\nActive refs: ${Object.keys(session.refs).length} (from ${session.updatedAt})`);
  }

  ws.close();
}

/**
 * rn-mcp snapshot [-i] [--max-depth N]
 */
export async function cmdSnapshot(
  opts: CliOptions & { interactive: boolean; maxDepth: number }
): Promise<void> {
  const { ws, device } = await connectAndResolveDevice(opts);

  const tree = await ws.eval(evalGetComponentTree(opts.maxDepth), device.deviceId, device.platform);
  if (!tree) {
    console.error('Snapshot unavailable (DevTools hook or fiber root missing).');
    ws.close();
    process.exit(1);
  }

  const { refs, lines } = assignRefs(tree as any, opts.interactive);

  // 세션 저장
  const session: Session = {
    port: opts.port,
    deviceId: device.deviceId,
    platform: device.platform,
    refs,
    updatedAt: '',
  };
  saveSession(session);

  if (opts.json) {
    console.log(JSON.stringify({ refs, deviceId: device.deviceId, platform: device.platform }));
  } else {
    if (lines.length === 0) {
      console.log('(empty tree)');
    } else {
      for (const line of lines) {
        console.log(line);
      }
    }
    console.error(`\n${Object.keys(refs).length} refs saved.`);
  }

  ws.close();
}

/**
 * rn-mcp tap <@ref|selector> [--long <ms>]
 */
export async function cmdTap(
  target: string,
  opts: CliOptions & { long?: number }
): Promise<void> {
  const { ws, device } = await connectAndResolveDevice(opts);

  const el = await resolveElementCoords(ws, target, device);
  const cx = el.pageX + el.width / 2;
  const cy = el.pageY + el.height / 2;
  const isLongPress = opts.long != null && opts.long > 0;

  try {
    if (device.platform === 'ios') {
      if (!(await checkIdbAvailable())) {
        throw new Error('idb not installed. Run: brew tap facebook/fb && brew install idb-companion');
      }
      const udid = await resolveUdid(device.deviceId);
      const orientInfo = await getIOSOrientation(ws, device, udid);
      const t = transformForIdb(cx, cy, orientInfo);
      const ix = Math.round(t.x);
      const iy = Math.round(t.y);
      const cmd = ['ui', 'tap', String(ix), String(iy)];
      if (isLongPress) cmd.push('--duration', String(opts.long! / 1000));
      await runIdbCommand(cmd, udid, { timeoutMs: opts.timeout });
    } else {
      if (!(await checkAdbAvailable())) {
        throw new Error('adb not installed. Run: brew install android-platform-tools');
      }
      const serial = await resolveSerial(device.deviceId);
      const scale = await getAndroidScale(serial);
      const topInsetPx = await getAndroidTopInset(serial);
      const topInsetDp = topInsetPx / scale;
      const px = Math.round(cx * scale);
      const py = Math.round((cy + topInsetDp) * scale);
      if (isLongPress) {
        await runAdbCommand(
          ['shell', 'input', 'swipe', String(px), String(py), String(px), String(py), String(opts.long!)],
          serial,
          { timeoutMs: opts.timeout }
        );
      } else {
        await runAdbCommand(['shell', 'input', 'tap', String(px), String(py)], serial, {
          timeoutMs: opts.timeout,
        });
      }
    }

    // UI 업데이트 대기
    await new Promise((r) => setTimeout(r, 300));

    let label = target;
    if (target.startsWith('@e')) {
      const s = loadSession();
      const r = s?.refs[target];
      label = `${target} ${r?.type ?? ''}${r?.testID ? ' #' + r.testID : ''}`;
    }
    console.log(`✓ ${isLongPress ? 'long-pressed' : 'tapped'} ${label.trim()}`);
  } finally {
    ws.close();
  }
}

/**
 * rn-mcp type <@ref|selector> <text>
 */
export async function cmdType(
  target: string,
  text: string,
  opts: CliOptions
): Promise<void> {
  const { ws, device } = await connectAndResolveDevice(opts);

  // 요소 찾기 (존재 확인 + uid 획득)
  const el = await resolveElementCoords(ws, target, device);

  // type_text는 uid로 직접 텍스트 입력
  const code = `(function(){
    var M = typeof __REACT_NATIVE_MCP__ !== 'undefined' ? __REACT_NATIVE_MCP__ : null;
    return M && M.typeText ? M.typeText(${JSON.stringify(el.uid)}, ${JSON.stringify(text)}) : null;
  })();`;

  try {
    await ws.eval(code, device.deviceId, device.platform);
    console.log(`✓ typed "${text}" into ${target}`);
  } finally {
    ws.close();
  }
}

/**
 * rn-mcp assert text <text>
 * rn-mcp assert visible <@ref|selector>
 * rn-mcp assert not-visible <@ref|selector>
 * rn-mcp assert count <selector> <n>
 */
export async function cmdAssert(
  subcommand: string,
  args: string[],
  opts: CliOptions
): Promise<void> {
  const { ws, device } = await connectAndResolveDevice(opts);

  try {
    switch (subcommand) {
      case 'text': {
        const text = args[0];
        if (!text) throw new Error('Usage: rn-mcp assert text <text>');
        // :text() 셀렉터로 정확한 텍스트 검색 (JSON.stringify false-positive 방지)
        const result = await ws.eval(
          buildQuerySelectorEvalCode(`:text(${JSON.stringify(text)})`),
          device.deviceId,
          device.platform
        );
        const found = result != null;
        if (found) {
          console.log(`✓ text "${text}" found`);
        } else {
          console.log(`✗ text "${text}" not found`);
          process.exitCode = 1;
        }
        break;
      }
      case 'visible': {
        const target = args[0];
        if (!target) throw new Error('Usage: rn-mcp assert visible <@ref|selector>');
        try {
          await resolveElementCoords(ws, target, device);
          console.log(`✓ ${target} is visible`);
        } catch {
          console.log(`✗ ${target} is not visible`);
          process.exitCode = 1;
        }
        break;
      }
      case 'not-visible': {
        const target = args[0];
        if (!target) throw new Error('Usage: rn-mcp assert not-visible <@ref|selector>');
        try {
          await resolveElementCoords(ws, target, device);
          console.log(`✗ ${target} is visible (expected not visible)`);
          process.exitCode = 1;
        } catch {
          console.log(`✓ ${target} is not visible`);
        }
        break;
      }
      case 'count': {
        const selector = args[0];
        const expected = parseInt(args[1] ?? '', 10);
        if (!selector || isNaN(expected)) {
          throw new Error('Usage: rn-mcp assert count <selector> <n>');
        }
        const list = (await ws.eval(
          buildQuerySelectorAllEvalCode(selector),
          device.deviceId,
          device.platform
        )) as unknown[];
        const actual = Array.isArray(list) ? list.length : 0;
        if (actual === expected) {
          console.log(`✓ ${selector}: ${actual} matches`);
        } else {
          console.log(`✗ ${selector}: expected ${expected}, got ${actual}`);
          process.exitCode = 1;
        }
        break;
      }
      default:
        throw new Error(
          `Unknown assert subcommand: ${subcommand}\n` +
            'Available: text, visible, not-visible, count'
        );
    }
  } finally {
    ws.close();
  }
}

/**
 * rn-mcp query <selector>
 */
export async function cmdQuery(
  selector: string,
  opts: CliOptions & { all: boolean }
): Promise<void> {
  const { ws, device } = await connectAndResolveDevice(opts);

  try {
    if (opts.all) {
      const list = (await ws.eval(
        buildQuerySelectorAllEvalCode(selector),
        device.deviceId,
        device.platform
      )) as Record<string, unknown>[];
      if (!Array.isArray(list) || list.length === 0) {
        console.log(`No elements match: ${selector}`);
        process.exitCode = 1;
        return;
      }
      if (opts.json) {
        console.log(JSON.stringify(list, null, 2));
      } else {
        console.log(`# ${list.length} matches`);
        for (const el of list) {
          console.log(`- ${formatElementLine(el)}`);
        }
      }
    } else {
      const result = (await ws.eval(
        buildQuerySelectorEvalCode(selector),
        device.deviceId,
        device.platform
      )) as Record<string, unknown> | null;
      if (!result) {
        console.log(`No element matches: ${selector}`);
        process.exitCode = 1;
        return;
      }
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatElementLine(result));
      }
    }
  } finally {
    ws.close();
  }
}

/**
 * rn-mcp swipe <@ref|selector> <direction> [--dist <px>]
 */
export async function cmdSwipe(
  target: string,
  direction: string,
  opts: CliOptions & { dist?: number }
): Promise<void> {
  if (!VALID_DIRECTIONS.includes(direction as any)) {
    throw new Error(`Invalid direction: ${direction}. Use: ${VALID_DIRECTIONS.join(', ')}`);
  }

  const { ws, device } = await connectAndResolveDevice(opts);
  const el = await resolveElementCoords(ws, target, device);
  const cx = el.pageX + el.width / 2;
  const cy = el.pageY + el.height / 2;
  const dist = opts.dist ?? Math.min(el.width, el.height) * 0.6;

  let x1: number, y1: number, x2: number, y2: number;
  switch (direction) {
    case 'up':    x1 = cx; y1 = cy + dist / 2; x2 = cx; y2 = cy - dist / 2; break;
    case 'down':  x1 = cx; y1 = cy - dist / 2; x2 = cx; y2 = cy + dist / 2; break;
    case 'left':  x1 = cx + dist / 2; y1 = cy; x2 = cx - dist / 2; y2 = cy; break;
    case 'right': x1 = cx - dist / 2; y1 = cy; x2 = cx + dist / 2; y2 = cy; break;
    default: throw new Error('unreachable');
  }

  try {
    if (device.platform === 'ios') {
      if (!(await checkIdbAvailable())) throw new Error('idb not installed');
      const udid = await resolveUdid(device.deviceId);
      const orientInfo = await getIOSOrientation(ws, device, udid);
      const t1 = transformForIdb(x1, y1, orientInfo);
      const t2 = transformForIdb(x2, y2, orientInfo);
      await runIdbCommand(
        ['ui', 'swipe', String(Math.round(t1.x)), String(Math.round(t1.y)),
         String(Math.round(t2.x)), String(Math.round(t2.y))],
        udid,
        { timeoutMs: opts.timeout }
      );
    } else {
      if (!(await checkAdbAvailable())) throw new Error('adb not installed');
      const serial = await resolveSerial(device.deviceId);
      const scale = await getAndroidScale(serial);
      const topInsetPx = await getAndroidTopInset(serial);
      const topInsetDp = topInsetPx / scale;
      const px1 = Math.round(x1 * scale);
      const py1 = Math.round((y1 + topInsetDp) * scale);
      const px2 = Math.round(x2 * scale);
      const py2 = Math.round((y2 + topInsetDp) * scale);
      await runAdbCommand(
        ['shell', 'input', 'swipe', String(px1), String(py1), String(px2), String(py2), '300'],
        serial,
        { timeoutMs: opts.timeout }
      );
    }

    await new Promise((r) => setTimeout(r, 300));
    console.log(`✓ swiped ${direction} on ${target}`);
  } finally {
    ws.close();
  }
}

/**
 * rn-mcp key <button>
 */
export async function cmdKey(button: string, opts: CliOptions): Promise<void> {
  const { ws, device } = await connectAndResolveDevice(opts);

  try {
    if (device.platform === 'ios') {
      if (!(await checkIdbAvailable())) throw new Error('idb not installed');
      const udid = await resolveUdid(device.deviceId);
      const idbButton = button === 'back' ? 'HOME' : button.toUpperCase();
      await runIdbCommand(['ui', 'button', idbButton], udid, { timeoutMs: opts.timeout });
    } else {
      if (!(await checkAdbAvailable())) throw new Error('adb not installed');
      const serial = await resolveSerial(device.deviceId);
      const keycode = ANDROID_KEYCODES[button.toLowerCase()];
      if (keycode == null) {
        throw new Error(
          `Unknown key: ${button}. Available: ${Object.keys(ANDROID_KEYCODES).join(', ')}`
        );
      }
      await runAdbCommand(['shell', 'input', 'keyevent', String(keycode)], serial, {
        timeoutMs: opts.timeout,
      });
    }

    console.log(`✓ pressed ${button}`);
  } finally {
    ws.close();
  }
}

/**
 * rn-mcp screenshot [-o <file>]
 */
export async function cmdScreenshot(
  opts: CliOptions & { output?: string }
): Promise<void> {
  const { ws, device } = await connectAndResolveDevice(opts);

  try {
    if (device.platform === 'ios') {
      if (!(await checkIdbAvailable())) throw new Error('idb not installed');
      const udid = await resolveUdid(device.deviceId);
      const outFile = opts.output ?? 'screenshot.png';
      await runIdbCommand(['screenshot', '--path', outFile], udid, { timeoutMs: opts.timeout });
      console.log(`✓ saved ${outFile}`);
    } else {
      if (!(await checkAdbAvailable())) throw new Error('adb not installed');
      const serial = await resolveSerial(device.deviceId);
      const outFile = opts.output ?? 'screenshot.png';
      const buf = await runCommand(
        'adb',
        [...(serial ? ['-s', serial] : []), 'exec-out', 'screencap', '-p'],
        { timeoutMs: opts.timeout }
      );
      writeFileSync(outFile, buf);
      console.log(`✓ saved ${outFile}`);
    }
  } finally {
    ws.close();
  }
}

/**
 * rn-mcp init-agent [--target agents|claude] [--lang en|ko]
 * AGENTS.md 또는 CLAUDE.md에 CLI 사용 가이드를 추가.
 */
export async function cmdInitAgent(
  opts: { target: string; lang: string }
): Promise<void> {
  const targets: Array<{ file: string; label: string }> = [];

  if (opts.target === 'all' || opts.target === 'agents') {
    targets.push({ file: 'AGENTS.md', label: 'AGENTS.md' });
  }
  if (opts.target === 'all' || opts.target === 'claude') {
    targets.push({ file: 'CLAUDE.md', label: 'CLAUDE.md' });
  }

  if (targets.length === 0) {
    throw new Error('Invalid --target. Use: agents, claude, or all');
  }

  const guide = opts.lang === 'ko' ? GUIDE_KO : GUIDE_EN;

  for (const { file, label } of targets) {
    const filePath = path.resolve(process.cwd(), file);

    let content: string | null = null;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      // 파일 없음
    }

    if (content != null) {
      // 이미 가이드가 있으면 교체
      if (content.includes(MARKER_START)) {
        const regex = new RegExp(
          `${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}`,
          'g'
        );
        const updated = content.replace(regex, guide);
        writeFileSync(filePath, updated);
        console.log(`✓ ${label}: guide updated`);
      } else {
        // 없으면 끝에 추가
        const separator = content.endsWith('\n') ? '\n' : '\n\n';
        writeFileSync(filePath, content + separator + guide + '\n');
        console.log(`✓ ${label}: guide appended`);
      }
    } else {
      // 파일이 없으면 새로 생성
      writeFileSync(filePath, `# ${file.replace('.md', '')}\n\n${guide}\n`);
      console.log(`✓ ${label}: created with guide`);
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
