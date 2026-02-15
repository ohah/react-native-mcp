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
      `Multiple Android devices connected. Specify serial parameter.\n${list}\nUse adb_list_devices to see all devices.`
    );
  }
  return online[0]!.serial;
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

/* ─── 에러 헬퍼 ─── */

export function adbNotInstalledError(): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
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
