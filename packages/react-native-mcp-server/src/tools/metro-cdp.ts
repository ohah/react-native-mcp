/**
 * Metro Base URL 관리 (Multi-Device)
 * 디바이스별 metroBaseUrl 저장 및 조회.
 */

const DEFAULT_METRO_BASE_URL = 'http://localhost:8230';

// ─── 디바이스별 Metro URL 관리 ──────────────────────────────────

/** deviceId → metroBaseUrl */
const deviceMetroUrls = new Map<string, string>();

let metroBaseUrlFromApp: string | null = null;

export function setMetroBaseUrlFromApp(url: string | null, deviceId?: string): void {
  if (deviceId) {
    if (url) {
      deviceMetroUrls.set(deviceId, url);
    } else {
      deviceMetroUrls.delete(deviceId);
    }
  } else {
    metroBaseUrlFromApp = url;
  }
}

export function getMetroBaseUrl(deviceId?: string): string {
  if (deviceId) {
    const url = deviceMetroUrls.get(deviceId);
    if (url) return url;
  }
  return metroBaseUrlFromApp ?? process.env.METRO_BASE_URL ?? DEFAULT_METRO_BASE_URL;
}
