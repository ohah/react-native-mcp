import { describe, expect, it, afterEach } from 'bun:test';
import { setMetroBaseUrlFromApp, getMetroBaseUrl } from '../tools/metro-cdp.ts';

// ─── 테스트 ─────────────────────────────────────────────────────

describe('getMetroBaseUrl', () => {
  afterEach(() => {
    setMetroBaseUrlFromApp(null);
    delete process.env.METRO_BASE_URL;
  });

  it('기본값은 http://localhost:8230', () => {
    expect(getMetroBaseUrl()).toBe('http://localhost:8230');
  });

  it('환경변수 METRO_BASE_URL 우선', () => {
    process.env.METRO_BASE_URL = 'http://localhost:9999';
    expect(getMetroBaseUrl()).toBe('http://localhost:9999');
  });

  it('앱이 전송한 metroBaseUrl이 최우선', () => {
    process.env.METRO_BASE_URL = 'http://localhost:9999';
    setMetroBaseUrlFromApp('http://localhost:7777');
    expect(getMetroBaseUrl()).toBe('http://localhost:7777');
  });
});

describe('Multi-device Metro URL', () => {
  afterEach(() => {
    setMetroBaseUrlFromApp(null);
    setMetroBaseUrlFromApp(null, 'ios-1');
    setMetroBaseUrlFromApp(null, 'android-1');
    delete process.env.METRO_BASE_URL;
  });

  it('deviceId별 Metro URL 저장/조회', () => {
    setMetroBaseUrlFromApp('http://localhost:8081', 'ios-1');
    setMetroBaseUrlFromApp('http://localhost:8082', 'android-1');

    expect(getMetroBaseUrl('ios-1')).toBe('http://localhost:8081');
    expect(getMetroBaseUrl('android-1')).toBe('http://localhost:8082');
  });

  it('deviceId 없으면 전역 fallback 사용', () => {
    setMetroBaseUrlFromApp('http://localhost:8081', 'ios-1');
    setMetroBaseUrlFromApp('http://localhost:7777');

    expect(getMetroBaseUrl()).toBe('http://localhost:7777');
  });

  it('등록되지 않은 deviceId는 전역 fallback', () => {
    setMetroBaseUrlFromApp('http://localhost:7777');
    expect(getMetroBaseUrl('unknown-1')).toBe('http://localhost:7777');
  });

  it('deviceId URL 삭제 시 전역 fallback', () => {
    setMetroBaseUrlFromApp('http://localhost:8081', 'ios-1');
    setMetroBaseUrlFromApp(null, 'ios-1');

    expect(getMetroBaseUrl('ios-1')).toBe('http://localhost:8230');
  });
});
