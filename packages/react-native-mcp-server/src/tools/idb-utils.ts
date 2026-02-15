/**
 * idb (iOS Development Bridge) 공유 유틸리티
 * UDID 자동 해석, idb 설치 확인, 명령 실행 래퍼.
 */

import { runCommand } from './run-command.js';

/* ─── idb 타겟 (list-targets --json NDJSON 한 줄) ─── */

export interface IdbTarget {
  name: string;
  udid: string;
  state: string; // "Booted" | "Shutdown"
  type: string; // "simulator" | "device"
  os_version: string;
  architecture: string;
}

/* ─── idb 설치 확인 (프로세스 수명 동안 캐싱) ─── */

let _idbAvailable: boolean | null = null;

export async function checkIdbAvailable(): Promise<boolean> {
  if (_idbAvailable != null) return _idbAvailable;
  try {
    await runCommand('which', ['idb'], { timeoutMs: 3000 });
    _idbAvailable = true;
  } catch {
    _idbAvailable = false;
  }
  return _idbAvailable;
}

/** 테스트용 캐시 초기화 */
export function _resetIdbCache(): void {
  _idbAvailable = null;
}

/* ─── idb list-targets ─── */

export async function listIdbTargets(): Promise<IdbTarget[]> {
  const buf = await runCommand('idb', ['list-targets', '--json'], { timeoutMs: 10000 });
  const lines = buf
    .toString('utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  const targets: IdbTarget[] = [];
  for (const line of lines) {
    try {
      targets.push(JSON.parse(line) as IdbTarget);
    } catch {
      // skip malformed lines
    }
  }
  return targets;
}

/* ─── UDID 해석 ─── */

export async function resolveUdid(udid?: string): Promise<string> {
  if (udid != null && udid !== '') return udid;

  const targets = await listIdbTargets();
  const booted = targets.filter((t) => t.state === 'Booted' && t.type === 'simulator');

  if (booted.length === 0) {
    throw new Error(
      'No booted iOS simulator found. Boot one with: xcrun simctl boot "<device name>"'
    );
  }
  if (booted.length > 1) {
    const list = booted.map((t) => `  ${t.name} (${t.udid})`).join('\n');
    throw new Error(
      `Multiple booted simulators found. Specify udid parameter.\n${list}\nUse list_devices(platform="ios") to see all devices.`
    );
  }
  return booted[0]!.udid;
}

/* ─── idb 명령 실행 ─── */

export async function runIdbCommand(
  subcommand: string[],
  udid: string,
  options?: { timeoutMs?: number }
): Promise<string> {
  const args = [...subcommand, '--udid', udid];
  const buf = await runCommand('idb', args, { timeoutMs: options?.timeoutMs ?? 10000 });
  return buf.toString('utf8').trim();
}

/* ─── 에러 헬퍼 ─── */

export function idbNotInstalledError(): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
    content: [
      {
        type: 'text' as const,
        text: [
          'idb (iOS Development Bridge) is not installed.',
          '',
          'Install:',
          '  brew tap facebook/fb',
          '  brew install idb-companion',
          '  pip3 install fb-idb',
          '',
          'Verify: idb list-targets',
          'Docs: https://fbidb.io/docs/installation/',
        ].join('\n'),
      },
    ],
  };
}
