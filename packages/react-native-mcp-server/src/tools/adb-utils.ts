/**
 * adb (Android Debug Bridge) 공유 유틸리티
 * 디바이스 시리얼 자동 해석, adb 설치 확인, 명령 실행 래퍼.
 */

import { runCommand } from './run-command.js';

/* ─── adb 디바이스 정보 ─── */

export interface AdbDevice {
  serial: string;
  state: string; // "device" | "offline" | "unauthorized"
  product?: string;
  model?: string;
  device?: string;
  transport_id?: string;
}

/* ─── adb 설치 확인 (프로세스 수명 동안 캐싱) ─── */

let _adbAvailable: boolean | null = null;

export async function checkAdbAvailable(): Promise<boolean> {
  if (_adbAvailable != null) return _adbAvailable;
  try {
    await runCommand('which', ['adb'], { timeoutMs: 3000 });
    _adbAvailable = true;
  } catch {
    _adbAvailable = false;
  }
  return _adbAvailable;
}

/** 테스트용 캐시 초기화 */
export function _resetAdbCache(): void {
  _adbAvailable = null;
}

/* ─── adb devices ─── */

export async function listAdbDevices(): Promise<AdbDevice[]> {
  const buf = await runCommand('adb', ['devices', '-l'], { timeoutMs: 10000 });
  const lines = buf
    .toString('utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  const devices: AdbDevice[] = [];
  for (const line of lines) {
    // Skip header line "List of devices attached"
    if (line.startsWith('List of')) continue;
    // Format: <serial> <state> [key:value ...]
    const match = line.match(/^(\S+)\s+(device|offline|unauthorized|no permissions)\b(.*)$/);
    if (!match) continue;
    const serial = match[1]!;
    const state = match[2]!;
    const rest = match[3] ?? '';
    const device: AdbDevice = { serial, state };

    const productMatch = rest.match(/product:(\S+)/);
    if (productMatch) device.product = productMatch[1];
    const modelMatch = rest.match(/model:(\S+)/);
    if (modelMatch) device.model = modelMatch[1];
    const deviceMatch = rest.match(/device:(\S+)/);
    if (deviceMatch) device.device = deviceMatch[1];
    const transportMatch = rest.match(/transport_id:(\S+)/);
    if (transportMatch) device.transport_id = transportMatch[1];

    devices.push(device);
  }
  return devices;
}

/* ─── 시리얼 해석 ─── */

export async function resolveSerial(serial?: string): Promise<string> {
  if (serial != null && serial !== '') return serial;

  const devices = await listAdbDevices();
  const online = devices.filter((d) => d.state === 'device');

  if (online.length === 0) {
    throw new Error(
      'No connected Android device found. Connect a device or start an emulator with: emulator -avd <avd_name>'
    );
  }
  if (online.length > 1) {
    const list = online.map((d) => `  ${d.serial}${d.model ? ` (${d.model})` : ''}`).join('\n');
    throw new Error(
      `Multiple Android devices connected. Specify serial parameter.\n${list}\nUse list_devices(platform="android") to see all devices.`
    );
  }
  return online[0]!.serial;
}

/* ─── 에뮬레이터 여부 (실기기 vs 에뮬 구분) ─── */

/**
 * 해당 Android 대상이 에뮬레이터(AVD)인지 여부.
 * - adb shell getprop ro.kernel.qemu → "1" 이면 에뮬.
 * - 시리얼이 "emulator-" 로 시작해도 에뮬로 간주 (getprop 실패 시 fallback).
 */
export async function isAndroidEmulator(serial: string): Promise<boolean> {
  try {
    const out = await runAdbCommand(['shell', 'getprop', 'ro.kernel.qemu'], serial, {
      timeoutMs: 3000,
    });
    return out.trim() === '1';
  } catch {
    // getprop 실패 시 시리얼 접두사로 추정 (AVD는 보통 emulator-5554 등)
    return serial.startsWith('emulator-');
  }
}

/* ─── adb 명령 실행 ─── */

export async function runAdbCommand(
  subcommand: string[],
  serial?: string,
  options?: { timeoutMs?: number }
): Promise<string> {
  const args: string[] = [];
  if (serial) args.push('-s', serial);
  args.push(...subcommand);
  const buf = await runCommand('adb', args, { timeoutMs: options?.timeoutMs ?? 10000 });
  return buf.toString('utf8').trim();
}

/* ─── Android density scale (dp → pixel 변환) ─── */

const _scaleBySerial = new Map<string, number>();

/**
 * Android screen density scale (디바이스별 캐싱).
 * density 160 = 1x, 320 = 2x, 480 = 3x 등.
 * dp × scale = pixel.
 */
export async function getAndroidScale(serial?: string): Promise<number> {
  const key = serial ?? '_default';
  const cached = _scaleBySerial.get(key);
  if (cached != null) return cached;
  try {
    const args = serial ? ['-s', serial, 'shell', 'wm', 'density'] : ['shell', 'wm', 'density'];
    const buf = await runCommand('adb', args, { timeoutMs: 5000 });
    const match = buf.toString().match(/(\d+)/);
    if (!match) throw new Error('density not found in wm output');
    const scale = parseInt(match[1]!, 10) / 160;
    _scaleBySerial.set(key, scale);
    return scale;
  } catch {
    // 감지 실패 시 캐싱하지 않음 → 다음 호출에서 재시도
    return 2.75; // 일반적인 Android 밀도 fallback (440dpi)
  }
}

/** 테스트용 density 캐시 초기화 */
export function _resetScaleCache(): void {
  _scaleBySerial.clear();
}

/* ─── Android top inset (상태바/캡션바 높이, px) ─── */

const _topInsetBySerial = new Map<string, number>();

/**
 * Android 디바이스의 실제 top inset(px)을 `dumpsys window displays`에서 파싱.
 * captionBar(태블릿 등)가 있으면 우선, 없으면 statusBars 사용.
 * 파싱 실패 시 0 반환 (호출자가 fallback 처리).
 */
export async function getAndroidTopInset(serial?: string): Promise<number> {
  const key = serial ?? '_default';
  const cached = _topInsetBySerial.get(key);
  if (cached != null) return cached;
  try {
    const text = await runAdbCommand(['shell', 'dumpsys', 'window', 'displays'], serial, {
      timeoutMs: 5000,
    });

    // captionBar가 있으면 우선 (Pixel Tablet 등)
    const captionMatch = text.match(
      /InsetsSource[^\n]*type=captionBar[^\n]*frame=\[\d+,\d+\]\[\d+,(\d+)\]/
    );
    if (captionMatch) {
      const px = parseInt(captionMatch[1]!, 10);
      _topInsetBySerial.set(key, px);
      return px;
    }

    // 없으면 statusBars
    const statusMatch = text.match(
      /InsetsSource[^\n]*type=statusBars[^\n]*frame=\[\d+,\d+\]\[\d+,(\d+)\]/
    );
    if (statusMatch) {
      const px = parseInt(statusMatch[1]!, 10);
      _topInsetBySerial.set(key, px);
      return px;
    }

    _topInsetBySerial.set(key, 0);
    return 0;
  } catch {
    // 파싱 실패 시 캐싱하지 않음 → 다음 호출에서 재시도
    return 0;
  }
}

/** 테스트용 top inset 캐시 초기화 */
export function _resetTopInsetCache(): void {
  _topInsetBySerial.clear();
}

/* ─── 에러 헬퍼 ─── */

export function adbNotInstalledError(): {
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: [
          'adb (Android Debug Bridge) is not installed or not in PATH.',
          '',
          'Install Android SDK Platform-Tools:',
          '  macOS: brew install android-platform-tools',
          '  Or download from: https://developer.android.com/tools/releases/platform-tools',
          '',
          'Verify: adb devices',
        ].join('\n'),
      },
    ],
  };
}
