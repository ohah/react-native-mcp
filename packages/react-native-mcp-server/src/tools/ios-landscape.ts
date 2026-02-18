/**
 * iOS 시뮬레이터 좌표 변환 유틸리티.
 *
 * idb ui tap/swipe는 GraphicsOrientation=1 (portrait 0°) 기준 좌표를 기대하므로,
 * 다른 orientation에서는 RN 좌표 → portrait 좌표로 변환해야 한다.
 *
 * GraphicsOrientation (com.apple.backboardd):
 *   1 = Portrait 0°        → 변환 없음 (x, y)
 *   2 = Portrait 180°      → 변환: (W - x, H - y)
 *   3 = Landscape A (270°) → 변환: (y, W - x)
 *   4 = Landscape B (90°)  → 변환: (H - y, x)
 *
 * W = window width, H = window height (현재 orientation 기준)
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AppSession } from '../websocket-server.js';

const execFileAsync = promisify(execFile);

const SCREEN_INFO_CODE =
  '(function(){ var M = typeof __REACT_NATIVE_MCP__ !== "undefined" ? __REACT_NATIVE_MCP__ : null; return M && M.getScreenInfo ? M.getScreenInfo() : null; })();';

export interface IOSOrientationInfo {
  /** backboardd GraphicsOrientation 값 (1~4). 기본값 1 (portrait). */
  graphicsOrientation: number;
  /** 현재 orientation의 window width */
  width: number;
  /** 현재 orientation의 window height */
  height: number;
}

/**
 * 앱 런타임 + 시뮬레이터에서 orientation 정보를 수집한다.
 * orientation이 0° (portrait)가 아닐 때만 GraphicsOrientation을 조회.
 * @param orientationOverride e2e.yaml config.orientation 등에서 사용자가 강제 지정한 GraphicsOrientation 값 (1~4). 지정 시 xcrun 자동감지를 건너뛰고 이 값을 사용한다.
 */
export async function getIOSOrientationInfo(
  appSession: AppSession,
  deviceId: string | undefined,
  platform: string,
  udid: string,
  orientationOverride?: number
): Promise<IOSOrientationInfo> {
  const defaultInfo: IOSOrientationInfo = { graphicsOrientation: 1, width: 0, height: 0 };
  if (platform !== 'ios') return defaultInfo;

  // 1) RN 런타임에서 window 크기 수집
  let width = 0;
  let height = 0;
  try {
    const res = await appSession.sendRequest(
      { method: 'eval', params: { code: SCREEN_INFO_CODE } },
      3000,
      deviceId,
      platform
    );
    const info = res.result as {
      window?: { width: number; height: number };
    } | null;
    if (info && typeof info === 'object') {
      width = info.window?.width ?? 0;
      height = info.window?.height ?? 0;
    }
  } catch {
    return defaultInfo;
  }

  // 2) GraphicsOrientation: 사용자 강제값 우선, 없으면 시뮬레이터에서 자동 감지
  let graphicsOrientation = 1;
  if (orientationOverride != null && orientationOverride >= 1 && orientationOverride <= 4) {
    graphicsOrientation = orientationOverride;
  } else {
    try {
      const { stdout } = await execFileAsync(
        'xcrun',
        ['simctl', 'spawn', udid, 'defaults', 'read', 'com.apple.backboardd'],
        { timeout: 3000 }
      );
      const match = stdout.match(/GraphicsOrientation\s*=\s*(\d+)/);
      if (match?.[1]) graphicsOrientation = parseInt(match[1], 10);
    } catch {
      // 조회 실패 시 기본값 1 (portrait, 변환 없음)
    }
  }

  return { graphicsOrientation, width, height };
}

/**
 * RN 좌표 → idb portrait 좌표 변환.
 * GraphicsOrientation=1 이면 그대로 반환.
 * width/height=0 이면 변환 공식이 음수를 만들 수 있으므로 변환 없이 반환.
 */
export function transformForIdb(
  x: number,
  y: number,
  info: IOSOrientationInfo
): { x: number; y: number } {
  // width/height가 유효하지 않으면 변환 불가 → 그대로 반환 (portrait 가정)
  if (info.width <= 0 || info.height <= 0) {
    return { x, y };
  }
  switch (info.graphicsOrientation) {
    case 2: // Portrait 180°: (W - x, H - y)
      return { x: info.width - x, y: info.height - y };
    case 3: // Landscape A: (y, W - x)
      return { x: y, y: info.width - x };
    case 4: // Landscape B: (H - y, x)
      return { x: info.height - y, y: x };
    default: // Portrait 0° (1) or unknown
      return { x, y };
  }
}
